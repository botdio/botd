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
        var oldCount = this.tasks.length;
        this.tasks = _.filter(this.tasks, t => !(t.cid === cid && t.app.constructor.name === appName));
        logger.debug(`crond: remove app event`, oldCount, this.tasks.length);
    }
    updateJobs() {
        try{
            _.each(this.db.cronjobs || [], job=>{
                // app is load?
                var cid = job.cid;
                var time = job.time;
                var cmd = job.cmd;
                var matchedApps = _.filter(this.apps, app => app.cid === cid && app.match(cid, cmd));
                logger.debug(`crond: find matched apps`, cmd, matchedApps.length);
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
        logger.debug(`crond: parse text into opt`, event.text, opt);
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
                    this.push(new SlackBuilder("Fail: already setup same cron job:").i().br()
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
                            .code(next[0]).i()
                            .build());
                        logger.debug(`crond: setup cron job ${id} in app ${app.constructor.name} for time ${time} cmd ${cmd}`);
                    });
                }else{
                    this.push(new SlackBuilder(`Fail: not support command `).code(cmd).i().br().i("make sure you can run it in slack").build());
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
            this.push(new SlackBuilder("Not yet create any cron jobs, run ").i().br()
                        .text(new SlackBuilder().code("help cron").text("to find how to create").i().build())
                        .build());
        }else{
            this.push(new SlackBuilder("Running cron jobs:").i().br()
                    .text(_.map(tasks, t => this.buildTaskSlack(t)).join("\n"))
                    .build());
        }
    }
    deleteJob(cid, jobid) {
        var task = _.find(this.tasks, t => t.id === jobid);
        if(!task) this.push(new SlackBuilder(`Fail: invalid job id`).b(jobid).i()
                            .br()
                            .text(new SlackBuilder("run ").code('cron list').text("to find running jobs").i().build())
                            .build());
        else{
            task.timer.clear();
            this.tasks = _.filter(this.tasks, t => t.id !== jobid);
            this.push(new SlackBuilder(`Good, job`).b(jobid).text("delete done.").i().build());
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
                    .text(' , delete by ').code(`cron delete ${task.id}`)
                    .text(', command')
                    .code(task.cmd);
    if(task.code)
        sb.text("code:").i().pre(task.code);
    else
        sb.i();
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
        return `_*Cron* : cron job managment, a time-based job scheduler _
        _\`cron list\` - list cron jobs_
        _\`cron add\` - add cron job_
        _.e.g \`cron add "*/10 * * * ? *" "db.counter=db.counter+1||1; console.log(db.counter)" \` every 10 minutes, counter++ and print it_
        _\`cron delete <job index>\` - add an cron job_
        _\`cron set <key> <value>\` - set cron job settings_
            `;
    }else{
        return `_*Cron* : cron job managment, a time-based job scheduler_
        _\`cron list\` - list cron jobs_
        _\`cron add\` - add an cron job_
        _\`cron delete <job id>\` - add an cron job_
        _\`cron set <key> <value>\` - set cron job settings_
        `;        
    }
}
module.exports = Cron;