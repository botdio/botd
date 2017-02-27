'use strict';
var _ = require('lodash');
var EventEmitter = require('events');
var co = require('co');
var fs = require('fs');

var Console = require('../utils/console');
var CONST = require('../constants');
var logger = require('../logger');
var SlackBuilder = require('slack_builder');
var P = require('../utils/patterns');
var spawn = require("child_process").spawn;
var DockerUtils = require("../utils/docker_utils")

const BASH_SUB_TYPE = {
    RUN: "RUN",
    INFO: "INFO"
}

const CMD_PATTERNS = [
        {cmd: "!bash", exec: "bash"},
        {cmd: "!sh", exec: "sh"},
        {cmd: "!python", exec: "python"},
        {cmd: "!ruby", exec: "ruby"}
    ];

class Bash extends EventEmitter{
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
        var tokens = P.tokenize(event.text);
        return _.find(CMD_PATTERNS, o => o.cmd === (tokens[0] || ""));
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
        if(event.type === "loaded" && event.cid === this.cid) {
            this.container = event.containerId;
            logger.debug(`bash: get container loaded event ${this.container}`);
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
                
        var cmd = Bash.parse(text);
        switch(cmd.type) {
            case BASH_SUB_TYPE.RUN:
                try{
                    var code = P.fmt(cmd.code);
                    if(this.container) {
                        logger.debug(`bash: start to run code in container`);
                        co(this.execRunDocker(cmd.exec, ts, code, output)).then(()=>{
                            logger.info(`bash: run the code in docker done`);
                        }).catch(err => {
                            logger.error(`bash: fail to run the code in docker`, err);
                        });
                    }else{
                        this.execRunProcess(cmd.exec, ts, code, output);                        
                    }
                }catch(err) {
                    output.error(err).then(() => {
                        this.attachTs(ts, output.ts);
                    });
                    logger.error(`bash: fail to execute code ${ts}`, err);
                }
            break;
            case BASH_SUB_TYPE.INFO: {
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
        logger.debug(`bash: write the code to file ${filename} and make executable done`);

        // cp the file into container
        yield DockerUtils.cp(`./${filename}`, `${this.container}:./`);
        logger.debug(`bash: cp the code file to docker container ${this.container} done`);

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
                output.log(`_\`bash exit abnormal(${exitCode})\`_`).then(() => that.attachTs(ts, output.ts));
            if(terminals[ts] && terminals[ts].pid === terminal.pid) {
                delete terminals[ts];
                that.save();
            }
        });

        terminals[ts] = {pid: terminal.pid, cmd: code};
        this.save();
        logger.debug(`bash: ts ${ts} attached to terminal ${terminal.pid}`);
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
        var terminals = this.db.terminals;
        terminal.on('exit', function (exitCode) {
            if(exitCode !== 0)
                output.log('_`bash exit abnormal`_').then(() => that.attachTs(ts, output.ts));
            if(terminals[ts] && terminals[ts].pid === terminal.pid) {
                delete terminals[ts];
                that.save();
            }
        });
        terminals[ts] = {pid: terminal.pid, cmd: code};
        this.save();
        logger.debug(`bash: ts ${ts} attached to terminal ${terminal.pid}`);
        terminal.stdin.write(code);
        terminal.stdin.end();
        return terminal;
    }
    attachTs(ts, out) {
        logger.debug(`bash: attach ts ${ts} into out ts ${out}...`);
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

Bash.parse = function(text) {
    var tokens = P.tokenize(text);
    var cmd = _.find(CMD_PATTERNS, o => o.cmd === tokens[0].toLowerCase())
    if(cmd) {
        text = text.substring(text.indexOf(cmd.cmd) + cmd.cmd.length);
        var code = (P.code(text || "") || "").trim();
        if(code) return {type: BASH_SUB_TYPE.RUN, code: code, exec: cmd.exec};
        else return {type: BASH_SUB_TYPE.INFO};
    }
}

Bash.help = function(verbose) {
    var sb = new SlackBuilder();
    sb.b(`Bash`).text(` - write, edit and run bash script`).i().br();
    sb.text("\t_`!bash <code> `").text(" - run bash shell <code> _").br();
    return sb.build();
}

module.exports = Bash;