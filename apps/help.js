'use strict';
var _ = require('lodash');
var request = require('superagent');
const EventEmitter = require('events');
var logger = require('../logger');
var SlackBuilder = require('slack_builder');
var P = require('../utils/patterns');
var Apps = require('./index');

const ENTRIES = ["!h", "!help"];

class Help extends EventEmitter{
    constructor(ctx) {
        super();
        this.cid = ctx.cid;
        this.push = ctx.push;
        this.db = ctx.db;
        this.on('slack', this.onSlack);
    }
    match(event) {
        var tokens = P.tokenize(event.text);
        if(tokens.length > 0 && _.find(ENTRIES, e => e.toLowerCase() === tokens[0])) {
            if(tokens.length > 1)
                return tokens[1];
            return "all";
        }
    }
    onSlack(event) {
        var cid = event.cid;
        var text = event.text;
        var tokens = P.tokenize(text);
        if(!this.match(event)) return ;
        var selectedApp = tokens[1];
        if(selectedApp) {
            this.printHelp(selectedApp)
        }else{
            this.printAll();
        }
    }

    printHelp(appName) {
        appName = appName.toLowerCase();
        var Apps = require('./index');
        var app = _.find(Apps.root, a => a.name.toLowerCase() === appName) || _.find(Apps.common, a => a.name.toLowerCase() === appName);
        if(!app){
            this.push(new SlackBuilder(`Not found app named`).b(appName).i().build());
        }else{
            this.push(new SlackBuilder(app.help(true)).build());
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
                    return clz.help();
                }
            }).filter(h => h).value()
            .join("\n");
        this.push(helpStr);        
    }
}
Help.help = function() {
    return `_*Help* : print usage for installed apps_
    _\`!help\` - print all installed apps help manual_
    _\`!help <app>\` - print specified <app> help manual verbosely_` ;
}
module.exports = Help;