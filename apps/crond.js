'use strict';
var _ = require('lodash');
var request = require('superagent');
const EventEmitter = require('events');
var logger = require('../logger');
var P = require('../utils/patterns');
var later = require('later');
var shortid = require('shortid');
var SlackBuilder = require('slack_builder');

const CRON_CMD_TYPE = {
    LIST: "list",
    ADD : "add",
    DELETE: "delete",
    SET: "set"
}

const SETTINGS = {
    VERBOSE: {keys:["verbose","v"], values:["false", "true"]}
}

class Cron extends EventEmitter{
    constructor(ctx) {
        super();
        this.cid = ctx.cid;
        this.db = ctx.db;
        this.save = ctx.save;
        this.push = ctx.push;
        this.apps = ctx.apps;

        this.tasks = [];    //running tasks
        
        this.on('slack', this.onSlack);
        this.on('app_loaded', this.onLoadApp);
        this.on('app_removed', this.onRemoveApp);
    }
    onLoadApp(event) {
        this.updateJobs();
    }
    onRemoveApp(event) {
        var cid = event.cid;
        var appName = event.appName;
        this.tasks = _.filter(this.tasks, t => !(t.cid === cid && t.app.constructor.name === appName));
    }
    updateJobs() {
        try{
            logger.debug(`crond: cronjobs is ${JSON.stringify(this.db.cronjobs)}`);
            _.each(this.db.cronjobs || [] ,job=>{
                // app is load?
                var cid = job.cid;
                var time = job.time;
                var cmd = job.cmd;
                var matchedApps = _.filter(this.apps, app => app.cid === cid && app.match(cid, cmd));
                _.each(matchedApps, app => {
                    if(_.find(this.tasks, t => t.app === app)) return ; //alreay loaded
                    var s = later.parse.cron(time);
                    var t = later.setInterval(() => {
                        app.emit("timer", {cid: cid, cmd: cmd, code: job.code, id: job.id, verbose: this.isVerbose()});
                    }, s);
                    this.tasks.push({id: job.id, cid: cid, time: time, cmd: cmd, code: job.code, schedule: s, timer: t, app: app});
                    logger.debug(`crond: load the job ${job.id} into ${app.constructor.name} done`);
                });
            });            
        }catch(err){
            logger.error(`crond: fail to init tasks`, err);
        }
    }
    match(cid, text) {
        var tokens = P.tokenize(text);
        if(tokens.length > 0 && tokens[0] === "cron") {
            return true;   
        }
    }
    parse(text) {
        var tokens = P.tokenize(text);
        if(tokens.length <= 0 || tokens[0] !== "cron") {
            return ;   
        }
        var sub = tokens[1];
        switch(sub) {
            case "add":
            case "a":
            case "-a":
                var cmd = Cron.parseCmd(text);
                var code = Cron.parseCode(text);
                var time = Cron.parseTime(text);
                if(!cmd  || !time) return ;
                return {type: CRON_CMD_TYPE.ADD, time: time, cmd: cmd, code: code}
            break;

            case "delete":
            case "del":
            case "d":
            case "-d":
                var id = tokens[2];
                return {type: CRON_CMD_TYPE.DELETE,id: id};
            break;

            case "set":
            case "s":
                var key = tokens[2];
                var value = tokens[3];
                return {type: CRON_CMD_TYPE.SET, key: key, value: value};

            break;

            default:
                return {type: CRON_CMD_TYPE.LIST}
        }
    }
    
    onSlack(event) {
        var cid = event.cid;
        var opt = this.parse(event.text);
        if(!opt) return ;

        switch(opt.type) {
            case CRON_CMD_TYPE.LIST:
                this.listAll(cid);
                break;
            case CRON_CMD_TYPE.DELETE:
                var id = opt.id;
                this.deleteJob(cid, id);
                break;
            case CRON_CMD_TYPE.SET:
                var key = opt.key;
                var value = opt.value;
                if(key && value) {
                    this.db.cronsettings = ( this.db.cronsettings || {} );
                    this.db.cronsettings[key] = value;
                    this.save(); 
                    this.push(new SlackBuilder("OK, cron setting changes, current is:")
                        .br()
                        .pre(JSON.stringify(this.db.cronsettings))
                        .build());
                }else{
                    //list setting
                    var settings = this.db.cronsettings || {};
                    this.push(new SlackBuilder("this channel cron setting:")
                        .br()
                        .pre(JSON.stringify(settings))
                        .build());
                }
                break;
            case CRON_CMD_TYPE.ADD:
                var cmd = opt.cmd;
                var code = opt.code;
                var time = opt.time;
                var already;
                //check if cmd is already setup
                if(already = _.find(this.tasks, j => j.cmd === cmd && j.time === time)){
                    this.push(new SlackBuilder("Fail: already setup same cron job:").br()
                                .text(this.buildTaskSlack(already))
                                .build());
                    break;
                }
                //check if cmd is supported
                var matchedApps = _.filter(this.apps, app => app.cid === this.cid && app.match(cid, cmd));
                // tell the user will run them
                if(matchedApps.length > 0) {
                    _.each(matchedApps, app => {
                        var id = shortid.generate().substring(0,4);
                        var s = later.parse.cron(time);
                        var next = later.schedule(s).next(2);
                        var t = later.setInterval(() => {
                            app.emit("timer", {cid: cid, cmd: cmd, code: code, id: id, verbose: this.isVerbose()});
                        }, s);
                        // save
                        var newjob = {id: id, cid: cid, time: time, cmd: cmd, code: code};
                        this.db.cronjobs = (this.db.cronjobs || []).concat([newjob])
                        this.save();

                        this.tasks.push({id: id, cid: app.cid, 
                            time: time, cmd: cmd, code: code,
                            schedule: s, timer: t, app: app});
                        this.push(new SlackBuilder("OK!")
                            .text(" Command").code(cmd)
                            .text("install done, next run time")
                            .code(next[0])
                            .build());
                        logger.debug(`crond: setup cron job ${id} in app ${app.constructor.name} for time ${time} cmd ${cmd}`);
                    });
                }else{
                    this.push(new SlackBuilder(`Fail: not support command `).code(cmd).br().text("make sure you can run it in slack").build());
                }
                break ;
        }
    }
    isVerbose() {
        var settings = this.db.cronsettings || {};
        var key = _.find(SETTINGS.VERBOSE.keys, k => settings[k]) || SETTINGS.VERBOSE.keys[0];
        return _.find(["true","1"], t => t === "" + settings[key]);
    }
    listAll(cid) {
        var tasks = _.filter(this.tasks, t => t.cid === cid);
        if(tasks.length === 0){
            this.push(new SlackBuilder("Not yet create any cron jobs, run ").br().code("help cron").text("to find how to create").build());
        }else{
            this.push(new SlackBuilder("Running cron jobs:").br()
                    .text(_.map(tasks, t => this.buildTaskSlack(t)).join("\n"))
                    .build());
        }
    }
    deleteJob(cid, jobid) {
        var task = _.find(this.tasks, t => t.id === jobid);
        if(!task) this.push(new SlackBuilder(`Fail: invalid job id`).b(jobid)
                            .br().text("run ").code('cron')
                            .text("to find running jobs").build());
        else{
            task.timer.clear();
            this.tasks = _.filter(this.tasks, t => t.id !== jobid);
            this.push(new SlackBuilder(`Good, job`).b(jobid).text("delete done.").build());
            this.db.cronjobs = _.filter(this.db.cronjobs || [], j => j.id !== jobid);
            this.save();
            logger.info(`crond: job ${jobid} is stopped and removed done`);
            //todo: update db
        }
    }
    buildTaskSlack(task) {
    var sb = new SlackBuilder()
                    .text('id')
                    .code(task.id)
                    .text(', time')
                    .code(task.time)
                    .text(', command')
                    .code(task.cmd)
                    .text(',');
    if(task.code)
        sb.text("code:").pre(task.code);
    sb.text(' , cancel it by ').code(`cron delete ${task.id}`);
    return sb.build();
    }
}
const PATTERN = /(["|'])(.*)\1\s(['|\`|"]*)([\w|!].*)\2/;

Cron.parseTime  = function(text) {
    var ms = text.match(/(["|'])(.*)\1\s/)
    if(ms) return ms[2];
}

Cron.parseCmd = function(text) {
    var m = text.match(/(["|']).*\1\s(['|\`|"]*)([\w|!].*)\2[\`]?/);
    if(m) return m[3];
}

Cron.parseCode = function(text) {
    return P.code(text);
}

Cron.help = function(verbose) {
    if(verbose) {
        return `*Cron* : cron job managment, to build newsletter or poll works
            \`cron list\` - list cron jobs
            \`cron add\` - add cron job
            .e.g \`cron add "*/10 * * * ? *" "follow" \` to print my follow list every 10 minutes
            \`cron delete <job index>\` - add an cron job
            \`cron set <key> <value>\` - set cron job settings
            `;
    }else{
        return `*Cron* : cron job managment
            \`cron list\` - list cron jobs
            \`cron add\` - add an cron job
            \`cron delete <job id>\` - add an cron job
            \`cron set <key> <value>\` - set cron job settings
            `;        
    }
}
module.exports = Cron;