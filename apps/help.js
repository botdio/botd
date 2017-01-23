'use strict';
var _ = require('lodash');
var request = require('superagent');
const EventEmitter = require('events');
var logger = require('../logger');
var SlackBuilder = require('../slack/builder');
var P = require('../utils/patterns');
var Apps = require('./index');

class Help extends EventEmitter{
    constructor(ctx) {
        super();
        this.cid = ctx.cid;
        this.push = ctx.push;
        this.db = ctx.db;
        this.on('slack', this.onSlack);
    }
    match(cid, text) {
        var tokens = P.tokenize(text);
        if(tokens.length > 0 && (tokens[0] === "help" || tokens[0] === "h")) {
            if(tokens.length > 1)
                return tokens[1];
            return "all";   
        }
    }
    onSlack(event) {
        var cid = event.cid;
        var text = event.text;
        var tokens = P.tokenize(text);
        // logger.debug(`help: recv the slack event ${JSON.stringify(event)} tokens ${JSON.stringify(tokens)}`);
        if(tokens[0] !== "help" && tokens[0] !== "h") return ;
        var selectedApp = tokens[1];
        if(selectedApp) {
            this.printHelp(selectedApp)
        }else{
            this.printAll();
        }
    }

    printHelp(appName) {
        var Apps = require('./index');
        var app = _.find(Apps.root, a => a.name.toLowerCase() === appName) || _.find(Apps.common, a => a.name.toLowerCase() === appName);
        if(!app){
            this.push(new SlackBuilder(`Not found app named`).b(appName).i().build());
        }else{
            this.push(new SlackBuilder(app.help(true)).i().build());
        }
    }

    printAll() {
        // list all apps
        var Apps = require('./index');
        var apps = this.db.apps || [];
        var roots = _.map(Apps.root, r => r.name);
        var allApps = Apps.common.concat(Apps.root);
        apps = apps.concat(roots);
        var helpStr = _.chain(apps)
            .map(app => {
                var clz = _.find(allApps, a => a.name === app);
                if(clz){
                    logger.debug(`help: - try to get help from ${app}`);
                    return clz.help();
                }
            }).filter(h => h).value()
            .join("\n");
        this.push(helpStr);        
    }
}
Help.help = function() {
    return `*Help* : print usage
    \`help\` - print all installed apps help manual
    \`help <app>\` - print <app> help manual verbosely` ;
}
module.exports = Help;