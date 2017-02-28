'use strict';
var _ = require('lodash');
var EventEmitter = require('events');
var co = require('co');

var Console = require('../utils/console');
var CONST = require('../constants');
var logger = require('../logger');
var SlackBuilder = require('slack_builder');
var P = require('../utils/patterns');
var spawn = require('child_process').spawn;

const DOCKER_ENTRIES = ["!docker"];

class Docker extends EventEmitter{
    constructor(ctx) {
        super();
        this.cid = ctx.cid;
        this.db = ctx.db;
        this.save = ctx.save;
        this.push = ctx.push;
        this.connector = ctx.connector;
        
        this.on('slack', this.onSlack);
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
        const output = new Console(this.push);
        switch(cmd.type) {
            case "RUN":
                output.log(`_start to load image ${cmd.image} ..._`);
                this.execDockerProcess(["run", "-dit", "--name", ts, cmd.image], output);
            break;

            case "ATTACH":
                output.log(`_first check the container ${cmd.id} status ... _`);
                Docker.ps()
                .then(containers => {
                        if(_.find(containers, c => c.id === cmd.id)){
                            this.db.container = cmd.id;
                            this.save();
                            output.log(`_container is alive, and attach container to this channel done_`);
                            this.checkAndBroadcast();
                        }else{
                            output.log(`_not find the container id ${cmd.id}_`);
                        }
                    })
                .catch(err => logger.error(`docker: fail to run attach command`, err));
                return ;

            case "DETACH":
                this.db.container = undefined;
                this.save();
                this.connector.notifyAppEvent("docker", {cid: this.cid, type:"detached"});
                return;
            
            case "STOP": {
                if(!this.db.container){
                    output.log(`_not attached any channel container_`);
                    return ;
                }
                output.log(`_try to stop container ${this.db.container}..._`);
                Docker.bash(`docker stop ${this.db.container}`, output)
                .then(() => {
                    this.checkAndBroadcast();
                });;
                break;
            }

            case "START": {
                if(!this.db.container){
                    output.log(`_not attached any channel container_`);
                    return ;
                }
                output.log("_try to start container ${this.db.container}..._");
                Docker.bash(`docker start ${this.db.container}`, output)
                .then(() => {
                    this.checkAndBroadcast();
                });
                break;
            }

            case "STATUS": {
                if(!this.db.container){
                    output.log("_this channel is not attach any container_");
                    return ;
                }
                Docker.stats(this.db.container, output);
                break;
            }
        }
    }

    execDockerProcess(params, output) {
        var that = this;
        var docker = spawn('docker', params);
        docker.stdout.on('data', function (data) {
            output.log(data);
        });
        docker.stderr.on('data', function (data) {
            output.error(data);
        });
        docker.on('close', (code) => {
          logger.debug(`docker: docker process done (${code}).`);
          this.checkAndBroadcast();
        });
    }
    checkAndBroadcast() {
        Docker.ps()
        .then(containers => _.find(containers, c => c.id === this.db.container))
        .then(channelContainer => {
            if(channelContainer)
                this.connector.notifyAppEvent("docker", {cid: this.cid, type:"loaded", containerId: this.db.container});
            else
                this.connector.notifyAppEvent("docker", {cid: this.cid, type:"stopped"});
        }).catch(err => {
            logger.error(`docker: fail to get the docker`, err);
        });
    }
}

Docker.containerName = function(cid) {
    return `docker-${cid}`;
}
Docker.bash = function(script, output) {
    if(!output) output = new Out();
    return new Promise((r, j) => {
        const prc = spawn('bash', [ '-c', script]);
        prc.stdout.on('data', function (data) {
            output.log(data);
        });
        prc.stderr.on('data', function (data) {
            output.error(data);
        });
        prc.on('exit', (code) =>{
            code === 0 ? r(output) : j(code);
        })
    });
}
//return [{id:xxx}]
Docker.ps = function() {
    return Docker.bash(`docker ps`)
        .then((out) => {
            var lines = _.filter(out.info.split("\n").slice(1), l => l.trim().length > 1);
            return _.map(lines, line => ({id: line.split(/\s/)[0]}));
        });
}
Docker.stats = function(id, output){
    return Docker.bash(`docker stats --no-stream ${id}`, output);
}
class Out {
    constructor(){
        this.info = "";
        this.err = "";
    }
    log(d){
        this.info += d;
    }
    error(err) {
        this.err += err;
    }
}
var APP_PATTERNS = [
    {
        type: "RUN",
        patterns: [/^!docker\s+run\s+([\w|\/|\:]+)/i, /^!docker\s+l\s+([\w|\/|\:]+)/i]
    },
    {
        type: "ATTACH",
        patterns: [/^!docker\s+attach\s+([\w|\/|\:]+)/i]
    },
    {
        type: "DETACH",
        patterns: [/^!docker\s+detach/i]
    },
    {
        type: "STOP",
        patterns: [/^!docker\s+stop/i]
    },
    {
        type: "START",
        patterns: [/^!docker\s+start/i]
    },
    {
        type: "STATUS",
        patterns: [/^!docker/i]
    }
]
Docker.parseCmd = function(text) {
    text = (text || "").trim();
    var cmd;
    _.find(APP_PATTERNS, sub => 
        _.find(sub.patterns, p => {
            var matches = text.match(p);
            if(matches) {
                return cmd = {type: sub.type, image: matches[1], id: matches[1]};
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
    sb.text("\t_`!docker run <image>`").text(" - load an image into channel and run _").br();
    sb.text("\t_`!docker attach <container id>`").text(" - attach an existed channel to this channel _").br();
    sb.text("\t_`!docker detach`").text(" - detach the attached container from this channel _").br();
    sb.text("\t_`!docker stop`").text(" - stop the channel container _").br();
    sb.text("\t_`!docker start`").text(" - start the channel container _").br();
    sb.text("\t_`!docker status`").text(" - print channel docker status _").br();
    return sb.build();
}

module.exports = Docker;