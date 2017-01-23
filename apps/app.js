'use strict';
var _ = require('lodash');
var request = require('superagent');
const EventEmitter = require('events');
var logger = require('../logger');
var P = require('../utils/patterns');
var SlackBuilder = require('../slack/builder');


//manage the apps
class App extends EventEmitter{
    constructor(ctx) {
        super();
        this.cid = ctx.cid;
        this.db = ctx.db;
        this.save = ctx.save;
        this.push = ctx.push;
        
        this.on('slack', this.onSlack);
    }
    match(cid, text) {
        return App.parseCmd(text);
    }

    onSlack(event) {
        var cid = event.cid;
        var text = event.text;
        var cmd = App.parseCmd(text);
        switch(cmd.type) {
            case "INSTALL":
                this.install(cmd.name);
                break;

            case "REMOVE":
                this.uninstall(cmd.name);
                break;
            case "PRINT":
                this.list();
                break;
        }
    }

    install(name) {
        var Apps = require('./index').common;
        logger.info(`app: install app ${name}`);
        var appClz = _.find(Apps, e => e.name.toLowerCase() === name.toLowerCase());
        if(!appClz){
            this.push(`*${fail}*: not find app - ${name}`);
            return ;
        }
        //check if already installed
        if(_.find(this.db.apps || [], app => app === appClz.name)){
            this.push(new SlackBuilder(`*fail*: app - ${name} is already installed`).i().build());
            return ;
        }
        this.db.apps = ( this.db.apps || [] ).concat(appClz.name);
        this.db[appClz.name] = {}; // give db
        this.save();
        this.list();
        HnTrack.install(this.cid, appClz.name);
    }

    uninstall(name) {
        var Apps = require('./index').common;
        logger.info(`app: uninstall app ${name}`);
        var appClz = _.find(Apps, e => e.name.toLowerCase() === name.toLowerCase());
        if(!appClz){
            this.push(`*${WARN}*: not install app - ${name}`);
            return ;
        }
        this.db.apps = _.filter(this.db.apps, app => app !== appClz.name);
        this.save();
        this.list();
    }

    list() {
        var Apps = require('./index');
        var apps = this.db.apps || [];
        var sb = new SlackBuilder();
        if(apps.length > 0) {
            sb.text(`Already installed : `);
            _.each(apps, app => sb.b(`${app}`));
            sb.i();
        }else{
            sb.text(`Not install any apps.`).i();            
        }
        var lefts = _.filter(Apps.common, a => !_.find(apps, name => a.name === name));
        if(lefts.length > 0) {
            sb.br().i("You can install the following apps:").br();
            _.each(lefts, l => sb.b(l.name).code(`app i ${l.name.toLowerCase()}`).br());
        }
        this.push(sb.build());
    }
}

var APP_PATTERNS = [
    {
        type: "INSTALL",
        patterns: [/^app\s+install\s+(\w+)/i, /^app\s+i\s+(\w+)/i]
    },
    {
        type: "REMOVE",
        patterns: [/^app\s+uninstall\s+(\w+)/i, /^app\s+remove\s+(\w+)/i, /^app\s+ui\s+(\w+)/i]
    },
    {
        type: "PRINT",
        patterns: [/^app/i, /^app\s+install/i, /^app\s+i/i]
    }
]
App.parseCmd = function(text) {
    text = (text || "").trim();
    var cmd;
    _.find(APP_PATTERNS, sub => 
        _.find(sub.patterns, p => {
            var matches = text.match(p);
            if(matches) {
                return cmd = {type: sub.type, name: matches[1]};
            }
        })
    )
    return cmd;
}
App.help = function() {
    return `*App* : install or remove apps
        \`app install\` or \`app i\` - install an app
        \`app uninstall \` - remove an app
        `;
}
module.exports = App;