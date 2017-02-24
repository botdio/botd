'use strict';
var _ = require('lodash');
var EventEmitter = require('events');
var co = require('co');

var Console = require('../utils/console');
var CONST = require('../constants');
var logger = require('../logger');
var SlackBuilder = require('slack_builder');
var P = require('../utils/patterns');

const DOCKER_ENTRIES = ["!docker"];

class Docker extends EventEmitter{
    constructor(ctx) {
        super();
        this.cid = ctx.cid;
        this.db = ctx.db;
        this.save = ctx.save;
        this.push = ctx.push;
        
        this.on('slack', this.onSlack);
        this.container = undefined;
    }

    match(event) {
        var tokens = P.tokenize(event.text);
        return _.find(Docker.entries(), w => w === (tokens[0] || "").toLowerCase());
    }

    onSlack(event) {
        var cid = event.cid;
        var text = event.text;
        var ts = event.ts;
        var action = event.action;

        if(!this.match(event)) return ;
                
        var cmd = Docker.parseCmd(text);
        switch(cmd.type) {
            case "LOAD":
                this.push(`start to load image ${cmd.image}`);
            break;
            
            case "STOP": {
                this.push("stopping the channel container");
                break;
            }

            case "START": {
                this.push("starting the channel container");
                break;
            }

            case "STATUS": {
                this.push("not load any images");
                break;
            }
        }
    }
}
var APP_PATTERNS = [
    {
        type: "LOAD",
        patterns: [/^!docker\s+load\s+(\w+)/i, /^!docker\s+l\s+(\w+)/i]
    },
    {
        type: "STOP",
        patterns: [/^!docker\s+stop\s/i]
    },
    {
        type: "START",
        patterns: [/^!docker\s+start\s/i]
    },
    {
        type: "STATUS",
        patterns: [/^!docker\s/i]
    }
]
Docker.parseCmd = function(text) {
    text = (text || "").trim();
    var cmd;
    _.find(APP_PATTERNS, sub => 
        _.find(sub.patterns, p => {
            var matches = text.match(p);
            if(matches) {
                return cmd = {type: sub.type, image: matches[1]};
            }
        })
    )
    return cmd;
}

Docker.entries = function() {
   return DOCKER_ENTRIES; 
}
Docker.help = function(verbose) {
    var sb = new SlackBuilder();
    sb.b(`Docker`).text(` - mange the channel docker container`).i().br();
    sb.text("\t_`!docker load <image>`").text(" - load a image into channel and start _").br();
    sb.text("\t_`!docker stop`").text(" - stop the channel container _").br();
    sb.text("\t_`!docker start`").text(" - start the channel container _").br();
    sb.text("\t_`!docker status`").text(" - print channel docker status _").br();
    return sb.build();
}

module.exports = Docker;