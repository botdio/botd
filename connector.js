'use strict';

var _ = require('lodash');
var EventEmitter = require('events');
var request = require('superagent');
var co = require('co');
var logger = require('./logger');
var Apps = require('./apps');
var CONST = require('./constants');
var AppDb = require('./db/app')
var ChannelDb = require('./db/channel')
var App = require('./apps')

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
        this.on('message', this.onMsg);
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
            this.apps.push(new AClz({
            cid: app.cid,
            db: app.db, //no db
            push: this.push.bind(this, app.cid),
            save: this.saveAppDb.bind(this, app.cid, AClz.name, app.db)}));
            logger.info(`connector: load the app ${app.app} for team ${tid} db`, app.db); 
        });
    }
    *initChananelDb(cid, tid) {
        return yield ChannelDb.createChannel(cid, tid);
    }
    *joinChannel(cid, tid) {
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
        _.each(App.root, rootApp => {
            this.apps.push(new rootApp({
            cid: cid,
            db: db, //no db
            push: this.push.bind(this, cid),
            save: this.saveChannelDb.bind(this, cid, db),
            apps: this.apps}));
            logger.info(`connector: install root app ${rootApp.name} done`);
        })
    }

    *installDefaultApps(cid) {
        for(var i = 0; i < Apps.defaults.length; i ++) {
            var DefApp = Apps.defaults[i];
            yield this.installApp(cid, DefApp);
        }
    }

    *installApp(cid, A) {
        var app = yield AppDb.create(cid, A.name, this.tid);
        this.apps.push(new A({
            cid: cid,
            db: app.db, //no db
            push: this.push.bind(this, cid),
            save: this.saveAppDb.bind(this, cid, A.name, app.db)}));
        logger.info(`connector: install app ${A.name} done`)        
    }

    // root app save in channel db
    saveChannelDb(cid, db) {
        co(ChannelDb.updateDb(cid, db)).catch(err => logger.error(`connector: fail to update channel db`, err));
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
        logger.info(`connector: recv join event`, event);
        var cid = event.cid;
        var apps = _.filter(this.apps, a => a.cid === cid);
        if(apps.length === 0) {
            //install the default apps
            this.installRootApps(cid);
        }
    }
    onMsg(event) {
        logger.info(`connector: recv message event`, event);
        try{
            var cid = event.cid;
            var text = event.text;
            this.exec(cid, text);            
        }catch(err) {
            logger.error(`connector: fail to run slack command ${text}`, err);
        }
    }
    exec(cid, text){
        var apps = this.filterApps(cid);
        logger.debug(`connector: slack apps filter by cid ${cid}, count ${_.map(apps, a => a.constructor.name).join(',')}`);
        _.each(apps, app => {
            try{
                if(app.match(cid, text)){
                    app.emit('slack', {cid: cid, text: text});
                }
            }catch(err) {
                logger.error(`connector: fail to emit slack command ${text} into app ${app.constructor.name} cid ${cid}`, err);
            }
        });
    }

    filterApps(cid) {
        return _.filter(this.apps, e => e.cid === cid);
    }

    loadCommonApps(ch) {//load the common apps
        var apps = (ch || {}).apps || [];
        _.each(apps, appName => {
            var clz = _.find(Apps.common, e => e.name === appName);
            if(!clz || !clz.name) return ;
            var chDb = (_.find(this.channels, d => d.id === ch.id) ||{}).db || {};
            co(AppModel.fetchDb(ch.id, appName, this.props.tid)).then(appDb => {
                //check if app is loaded in this channel
                var app = _.find(this.apps, a => a.cid === ch.id && a.constructor.name === appName);
                if(app){
                    logger.debug(`HN: app ${appName} is alredy loaded, reload db into ${JSON.stringify(appDb)}`);
                    app.db = appDb;
                    return; 
                }
                logger.debug(`HN: app ${appName} load db size ${JSON.stringify(appDb).length}B`);

                this.apps.push(new clz({cid: ch.id, db: appDb,
                    push: this.push.bind(this, ch.id),
                    save: this.saveApp.bind(this, ch.id, appName, appDb)}));

                //send the app_load event to the root apps
                this.notifyAppEvent(ch.id, "app_loaded");
            }).catch(err => {
                logger.error(`hn: fetch app ${appName} cid ${ch.id} db fail`, err);
            });
        });
        //check if app removed
        var removedAppInsts = _.filter(this.apps, appInst => appInst.cid === ch.id 
                        && !_.find(apps, appName => appName === appInst.constructor.name)
                        && !_.find(Apps.root, r => r.name === appInst.constructor.name));
        _.each(removedAppInsts, inst => {
            _.remove(this.apps, inst);
            logger.info(`HN: app ${inst.constructor.name} instance is removed from cid ${ch.id}, apps count ${this.apps.length}`);
            this.notifyAppEvent(ch.id, "app_removed", {cid: ch.id, appName: inst.constructor.name});
        });
    }
    notifyAppEvent(cid, event, data) {
         var apps = this.filterApps(cid);
        _.each(apps, app => {
            try{
                app.emit(event, data || {});
            }catch(err) {
                logger.error(`HN: fail to emit app_load into app ${app.constructor.name} cid ${cid}`, err);
            }
        });       
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