'use strict';

var _ = require('lodash');
var EventEmitter = require('events');
var request = require('superagent');
var co = require('co');
var logger = require('./logger');
var Apps = require('./apps/index');
var CONST = require('./constants');
var SlackBuilder = require('slack_builder');

const DB = (process.env.DB || CONST.DEFAULT_DB );
var AppDb = DB.indexOf("mongodb:") === 0 ? require('./db/app') : require('./file/app');
var ChannelDb = DB.indexOf("mongodb:") === 0 ? require('./db/channel') : require('./file/channel');

// connect the bot with slack
class Connector extends EventEmitter {
    constructor(slack) {
        super();
        this._slack = slack;
        //todo: load the apps info
        this.tid = "";
        this.apps = [];
        this.channels = [];

        this.on('start', this.onStart);
        this.on('error', this.onError);
        this.on('join', this.onJoin);
        this.on('left', this.onLeft);
        
        this.on('message', this.onMsg);
        slack.connect(this);
    }
    onStart(event) {
        logger.info(`connector: recv start event`, event);
        if(event.team && event.team.id) {
            var tid = event.team.id;
            this.tid = tid;
            co(function *(){
                yield this.loadChannelAndApps(tid);
                var joinedChannels = (event.joined || []);
                var notInitedChannels = _.filter(joinedChannels, jch => !_.find(this.channels, ch => ch.cid === jch.cid));
                for(var i = 0 ; i < notInitedChannels.length; i ++) {
                    yield this.joinChannel(notInitedChannels[i].cid, this.tid);
                } 
            }.bind(this)).catch(err => logger.error(`connector: fail to init channel and apps`, err));
        }
    }
    *loadChannelAndApps(tid) {
        var channels = yield ChannelDb.fetchChannels(tid);
        this.channels = channels;
        _.each(this.channels, ch => this.installRootApps(ch.cid, ch.db));
        
        var apps = yield AppDb.fetchAll(tid);
        _.each(apps, app => {
            var AClz = _.find(Apps.common, c => c.name === app.app);
            if(!AClz){
                logger.error(`connector: fail to locate common app ${app.app}`);
                return ;
            }
            var already = _.find(this.apps, a => a.cid === app.cid && a.constructor.name === app.app);
            if(already){
                already.db = app.db;
                logger.info(`connector: already load app ${app.app} in channel ${app.cid}, update db`);
                return ;
            }
            this.apps.push(new AClz({
            cid: app.cid,
            db: app.db, //no db
            push: this.push.bind(this, app.cid),
            save: this.saveAppDb.bind(this, app.cid, AClz.name, app.db)}));
            logger.info(`connector: load the app ${app.app} for team ${tid} channel ${app.cid} db`); 
        });

        this.notifyAppEvent("app_loaded");
    }
    *initChananelDb(cid, tid) {
        return yield ChannelDb.createChannel(cid, tid);
    }
    *joinChannel(cid, tid) {
        if(!cid) return ;
        var channel = yield this.initChananelDb(cid, tid);
        this.channels.push(channel);
        logger.info(`connector: init channel ${cid} db done`);

        yield this.initChannelApps(channel);
        logger.info(`connector: init channel ${cid} apps done`);
    }
    *initChannelApps(channel) {
        this.installRootApps(channel.cid, channel.db);
        yield this.installDefaultApps(channel.cid);
    }

    installRootApps(cid, db) {
        _.each(Apps.root, rootApp => {
            this.apps.push(new rootApp({
            cid: cid,
            db: db, //no db
            push: this.push.bind(this, cid),
            save: this.saveChannelDb.bind(this, cid, db),
            apps: this.apps,
            connector: this}));
            logger.info(`connector: install root app ${rootApp.name} in channel ${cid} done`);
        })
    }

    *installDefaultApps(cid) {
        var appManagementApp = _.find(this.apps, a => a.cid === cid && a.constructor.name === "App");
        for(var i = 0; i < Apps.defaults.length; i ++) {
            var DefApp = Apps.defaults[i];
            appManagementApp.install(DefApp.name);
            // yield this.installApp(cid, DefApp);
        }
    }

    *installApp(cid, A) {
        var db = yield AppDb.fetchDb(cid, A.name, this.tid);
        if(!db){
            var app = yield AppDb.create(cid, A.name, this.tid);
            db = app.db;
        }
        this.apps.push(new A({
            cid: cid,
            db: db, //no db
            push: this.push.bind(this, cid),
            save: this.saveAppDb.bind(this, cid, A.name, db)}));
        logger.info(`connector: install app ${A.name} in channel ${cid} done`)        
    }

    *uninstallApp(cid, A) {
        var removed = _.find(this.apps, a => a.constructor.name === A.name && a.cid === cid);
        if(!removed) {
            logger.warn(`connector: fail to find the uninstalling app for ${A.name} cid ${cid}`);
            return ;
        }
        removed.emit('destroy');
        yield AppDb.deleteDb(cid, A.name);
        this.apps = _.filter(this.apps, a => a !== removed);
        this.notifyAppEvent("app_removed", {cid: cid, appName: A.name});
        //clean db
        logger.info(`connector: uninstall app ${A.name} in channel ${cid} done`);   
    }
    notifyAppEvent(event, data) {
        _.each(this.apps, app => {
            try{
                app.emit(event, data || {});
            }catch(err) {
                logger.error(`connector: fail to emit app_load into app ${app.constructor.name}`, err);
            }
        });       
    }

    // root app save in channel db
    saveChannelDb(cid, db) {
        co(ChannelDb.updateDb(cid, db))
        .then(() => {
            this.loadChannelAndApps(this.tid);
        })
        .catch(err => logger.error(`connector: fail to update channel db`, err));
    }

    //common app saved
    saveAppDb(cid, appName, db) {
        co(AppDb.updateDb(appName, cid, db))
        .catch(err => {
            logger.error(`connector: fail to update app ${appName} cid ${cid} db`, err);
        });
    }

    onError(event) {
        logger.info(`connector: recv event`, event);
    }
    onJoin(event) {
        logger.info(`connector: recv join event`, JSON.stringify(event));
        var cid = event.channel.id;
        co(this.joinChannel(cid, this.tid)).then(() => {
            logger.info(`connector: channel ${cid} join done`);
            this.push(cid, new SlackBuilder(`OK, channel join done, press \`help\` to start!`).i().build());            
        }).catch(err => {
            logger.info(`connector: channel ${cid} join fail`, err);
            this.push(cid, new SlackBuilder(`ERROR: fail to init channel`).i().br().text(err.toString()).build());            
        });
    }
    onLeft(event) {
        logger.info(`connector: recv left event`, JSON.stringify(event));
        var cid = event.channel;
        var apps = _.filter(this.apps, a => a.cid === cid);
        _.each(apps, a => {
            co(AppDb.deleteDb(cid, a.constructor.name))
            .catch(err => logger.error(`connector: fail to delete channel ${cid} app ${a.constructor.name}`, err));
        });
        this.apps = _.filter(this.apps, a => a.cid !== cid);
        co(ChannelDb.deleteDb(cid)).catch(err => logger.error(`connector: fail to delete channel ${cid} db`, err))
        this.channels = _.filter(this.channels, c => c.cid !== cid);
    }
    onMsg(event) {
        logger.info(`connector: recv message event`, event);
        try{
            var cid = event.cid;
            var text = event.text;
            this.exec(cid, text, event.ts);            
        }catch(err) {
            logger.error(`connector: fail to run slack command ${text}`, err);
        }
    }
    exec(cid, text, ts){
        var apps = this.filterApps(cid);
        logger.debug(`connector: slack apps filter by cid ${cid}, apps ${_.map(apps, a => a.constructor.name).join(',')}`);
        _.each(apps, app => {
            try{
                if(app.match(cid, text)){
                    app.emit('slack', {cid: cid, text: text, ts: ts});
                }
            }catch(err) {
                logger.error(`connector: fail to emit slack command ${text} into app ${app.constructor.name} cid ${cid}`, err);
            }
        });
    }

    filterApps(cid) {
        return _.filter(this.apps, e => e.cid === cid);
    }

    push(cid, text, attachmentsOrTs, attachments) {
        return typeof attachmentsOrTs === "string" ?
         co(this._slack.update(cid, attachmentsOrTs, text, attachments))
         :
         co(this._slack.send(cid, text, attachmentsOrTs));
    }


    *slack(cid, text) {
        var apps = this.filterApps(cid);
        // logger.debug(`hn: try to slack ${cid} text ${text} to app ${_.map(apps, e => e.constructor.name).join(",")}`);
        _.each(apps, app => {
            try{
                app.emit('slack', {cid: cid, text: text});                
            }catch(err) {
                logger.error(`HN: fail to emit slack command ${text} into app ${app.constructor.name} cid ${cid}`, err);
            }
        });
    }
}

module.exports = Connector;