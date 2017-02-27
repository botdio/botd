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
        var name = Docker.containerName(cid);
        const output = new Console(this.push);
        switch(cmd.type) {
            case "LOAD":
                output.log(`_start to load image ${cmd.image} ..._`);
                this.execDockerProcess(["run","-dit", "--name", name, cmd.image], output);
            break;
            
            case "STOP": {
                output.log("_current channel container status..._");
                Docker.bash(`docker ps -a -f name=${name}`, output);
                output.log("_try to stop ..._");
                Docker.bash(`docker stop $(docker ps -a -q -f name=${name})`, output);
                break;
            }

            case "START": {
                output.log("current channel container status:");
                Docker.bash(`docker ps -a -f name=${name}`, output);
                output.log("_try to start ..._");
                Docker.bash(`docker start $(docker ps -a -q -f name=${name})`, output)
                .then(() => {
                    this.checkAndBroadcast();
                });
                break;
            }

            case "STATUS": {
                Docker.bash(`docker ps -a -f name=${name}`, output);
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
        Docker.fetchContainerId(this.cid).then(containerId => {
            this.connector.notifyAppEvent("docker", {cid: this.cid, type:"loaded", containerId: containerId});
        }).catch(err => {
            logger.error(`docker: fail to get the docker id`, err);
        });
    }
}

Docker.containerName = function(cid) {
    return `docker-${cid}`;
}
Docker.bash = function(script, output) {
    logger.info(`docker: start to run script ${script}`);
    return new Promise((r, j) => {
        const prc = spawn('bash', [ '-c', script]);
        prc.stdout.on('data', function (data) {
            output.log(data);
        });
        prc.stderr.on('data', function (data) {
            output.error(data);
        });
        prc.on('exit', (code) =>{
            code === 0 ? r(code) : j(code);
        })
    });
}
Docker.stopAndRm = function(cid) {
    Docker.bash(`docker rm $(docker stop $(docker ps -a -q -f name=${Docker.containerName(cid)}))`, console); 
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
Docker.fetchContainerId = function(cid) {
    var out = new Out();
    var script = `docker ps -a -q -f name=${Docker.containerName(cid)}`;
    return new Promise((resolve, reject) => {
        Docker.bash(script, out)
        .then(code => {
            if(out.info) {
                resolve(out.info.trim());
            }else if(out.err){
                reject(out.err);
            }
        }).catch(code => {
            logger.error(`fail to run bash script ${script}, exit code ${code}`);
        });        
    });
}
var APP_PATTERNS = [
    {
        type: "LOAD",
        patterns: [/^!docker\s+load\s+([\w|\/|\:]+)/i, /^!docker\s+l\s+([\w|\/|\:]+)/i]
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