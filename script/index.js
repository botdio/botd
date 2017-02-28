'use strict';
var _ = require('lodash');
var EventEmitter = require('events');
var co = require('co');
var fs = require('fs');
var spawn = require("child_process").spawn;
var SlackBuilder = require('slack_builder');

var Console = require('../utils/console');
var CONST = require('../constants');
var logger = require('../logger');
var P = require('../utils/patterns');
var DockerUtils = require("../utils/docker_utils")

const SCRIPT_SUB_TYPE = {
    RUN: "RUN",
    INFO: "INFO"
}

const SCRIPT_PATTERNS = [
        {cmd: "!bash", exec: "bash"},
        {cmd: "!sh", exec: "sh"},
        {cmd: "!python", exec: "python"},
        {cmd: "!py", exec: "python"},
        {cmd: "!ruby", exec: "ruby"},
        {cmd: "!rb", exec: "ruby"},
        {cmd: "!node", exec: "node"},
        {cmd: "!js", exec: "node"},
        {cmd: /!(\..*)/},
        {cmd: /!(\/.*)/}
    ];

class Script extends EventEmitter{
    constructor(ctx) {
        super();
        this.cid = ctx.cid;
        this.db = ctx.db;
        this.save = ctx.save;
        this.push = ctx.push;
        
        this.on('slack', this.onSlack);
        this.on('docker', this.onDocker);
        this.on('timer', this.onTimer);

        this.db.terminals = this.db.terminals || {};
    }

    match(event) {
        if(event.ts && this.db.terminals[event.ts]) return true;
        return Script.parse(event.text);
    }
    onTimer(event) {
        var cmd = event.cmd;
        var jobid = event.id;
        var verbose = event.verbose || false;
        // logger.info(`shell: get the cron timer call, code ${code}`);
        if(verbose)
            this.push(new SlackBuilder(`start to run the cron job `).b(jobid).i().build());
        this.onSlack({cid: this.cid, text: cmd});
    }
    onDocker(event) {
        if((event.type === "started" || event.type === "loaded") && event.cid === this.cid) {
            this.container = event.containerId;
            logger.debug(`script: recv container event ${event.type} ${this.container}`);
        }
        if((event.type === "stopped" || event.type === "detached") && event.cid === this.cid) {
            this.container = undefined;
            logger.debug(`script: recv container event ${event.type}`);
        }
    }

    onSlack(event) {
        var cid = event.cid;
        var text = event.text;
        var ts = event.ts;
        var action = event.action;
        var outTs = (this.db.outs || {})[ts];
        logger.debug(`bash: code ${ts} out ts ${outTs} action ${action}`)

        if(!this.match(event)) return ;

        var output = new Console(this.push.bind(this), outTs);
        if(action === "deleted") {
           try{
                var terminal = this.db.terminals[ts];
                if(terminal) {
                    logger.debug(`bash: code ${ts} is deleted and find running process ${terminal.pid}, send kill`)
                    var kill = spawn("kill", ["-9", terminal.pid]);
                    kill.on(`close`, (exitCode) => {
                        logger.debug(`bash: code ${ts} deleted and killed exitCode`); 
                        output.error(new SlackBuilder(`process ${terminal.pid} is killed`).code().build());
                    });
                    delete this.db.terminals[ts];
                    this.save();
                }else{
                    logger.debug(`bash: code ${ts} have no running terminal, ignore`);
                }                    
            }
            catch(err) {
                logger.error(`bash: delete message err`, err);
            }
            return ;
        }
                
        var cmd = Script.parse(text);
        switch(cmd.type) {
            case SCRIPT_SUB_TYPE.RUN:
                try{
                    var code = P.fmt(cmd.code);
                    if(this.container) {
                        logger.debug(`script: start to run code in container`);
                        co(this.execRunDocker(cmd.exec, ts, code, output)).then(()=>{
                            logger.info(`script: run the code in docker done`);
                        }).catch(err => {
                            logger.error(`script: fail to run the code in docker`, err);
                        });
                    }else{
                        this.execRunProcess(cmd.exec, ts, code, output);                        
                    }
                }catch(err) {
                    output.error(err).then(() => {
                        this.attachTs(ts, output.ts);
                    });
                    logger.error(`script: fail to execute code ${ts}`, err);
                }
            break;
            case SCRIPT_SUB_TYPE.INFO: {
                var running = new SlackBuilder('running process : ').i();
                var procs = _.map(this.db.terminals, (t, ts) => `pid: ${t.pid} , cmd: \`${t.cmd}\`_`).join("\n")
                procs ? running.text(procs) : running.i(`none`);
                this.push(running.build());
                break;
            }
        }
    }
    *execRunDocker(exec, ts, code, output) {
        // make the code into a file
        var filename = `${ts}`;
        fs.writeFileSync(filename, code);
        fs.chmodSync(filename, "700");
        logger.debug(`script: write the code to file ${filename} and make executable done`);

        // cp the file into container
        yield DockerUtils.cp(`./${filename}`, `${this.container}:./`);
        logger.debug(`script: cp the code file to docker container ${this.container} done`);

        // run the file
        var that = this;
        var terminal = spawn('docker', ['exec', this.container, exec, `./${filename}`]);
        terminal.stdout.on('data', function (data) {
            output.log(data).then(() => that.attachTs(ts, output.ts));
        });
        terminal.stderr.on('data', function (data) {
            output.error(data).then(() => that.attachTs(ts, output.ts));;
        });
        var terminals = this.db.terminals;
        terminal.on('exit', function (exitCode) {
            if(exitCode !== 0)
                output.log(`_\`script executed abnormal, exit ${exitCode}\`_`).then(() => that.attachTs(ts, output.ts));
            if(terminals[ts] && terminals[ts].pid === terminal.pid) {
                delete terminals[ts];
                that.save();
            }
        });

        terminals[ts] = {pid: terminal.pid, cmd: code};
        this.save();
        logger.debug(`script: ts ${ts} attached to terminal ${terminal.pid}`);
        // terminal.stdin.write(code);
        // terminal.stdin.end();
        return terminal;
    }

    execRunProcess(exec, ts, code, output) {
        var that = this;
        var terminal = spawn(exec);
        terminal.stdout.on('data', function (data) {
            output.log(data).then(() => that.attachTs(ts, output.ts));
        });
        terminal.stderr.on('data', function (data) {
            output.error(data).then(() => that.attachTs(ts, output.ts));;
        });
        var terminals = this.db.terminals;
        terminal.on('exit', function (exitCode) {
            if(exitCode !== 0)
                output.log(`_\`script executed abnormal, exit ${exitCode}\`_`).then(() => that.attachTs(ts, output.ts));
            if(terminals[ts] && terminals[ts].pid === terminal.pid) {
                delete terminals[ts];
                that.save();
            }
        });
        terminals[ts] = {pid: terminal.pid, cmd: code};
        this.save();
        logger.debug(`script: ts ${ts} attached to terminal ${terminal.pid}`);
        terminal.stdin.write(code);
        terminal.stdin.end();
        return terminal;
    }
    attachTs(ts, out) {
        logger.debug(`script: attach ts ${ts} into out ts ${out}...`);
        if(!ts || !out) return ;
        this.db.outs = this.db.outs || {};
        if(this.db.outs[ts] === out) return ;
        this.db.outs[ts] = out;
        this.save();
    }
    isNormalExit(err, data) {
        if(typeof err === "number" && err === 0) return true;
    }
    isAbnormalExit(err, data) {
        if(typeof data === "string" && data === 'SIGTERM') return true;
    }
}

Script.parse = function(text) {
    var tokens = P.tokenize(text);
    if(!tokens || !tokens[0]) return ;
    var found = _.find(SCRIPT_PATTERNS, o => typeof o.cmd === "string" 
                    ? (o.cmd === tokens[0].toLowerCase())
                    : tokens[0].match(o.cmd))
    if(found) {
        var matched = typeof found.cmd === "string" ? found.cmd : tokens[0].match(found.cmd)[1];
        var exec = found.exec || tokens[0].match(found.cmd)[1];
        text = text.substring(text.indexOf(matched) + matched.length).trim();
        var code = (P.code(text || "") || "").trim();
        if(code && code.length > 0) return {type: SCRIPT_SUB_TYPE.RUN, code: code, exec: exec};
        else return {type: SCRIPT_SUB_TYPE.RUN, code: text.length > 0 ? text: undefined, exec: exec};
    }
}

Script.help = function(verbose) {
    var sb = new SlackBuilder();
    sb.b(`Script`).text(` - write, edit and run script (bash, node, ruby, python etc)`).i().br();
    _.each(SCRIPT_PATTERNS, p => {
        sb.text(`\t_\`${p.cmd} <code> \``).text(` - run <code> in ${p.exec || "<custom executer>"}_`).br();
    });
    sb.br().text("_e.g._\n```!bash `echo hello,world` ```").br();
    sb.text("```!python `print 'hello,world'` ```").br();
    sb.text("```!ruby `print 'hello,world'` ```").br();
    sb.text("```!node `console.log('hello,world')` ```").br();
    return sb.build();
}

module.exports = Script;