'use strict';
var _ = require('lodash');
var EventEmitter = require('events');
var co = require('co');

var Console = require('../utils/console');
var CONST = require('../constants');
var logger = require('../logger');
var SlackBuilder = require('slack_builder');
var P = require('../utils/patterns');
var spawn = require("child_process").spawn;

const BASH_SUB_TYPE = {
    RUN: "RUN",
    INFO: "INFO"
}

const BASH_CMDS = ["!bash"];

class Bash extends EventEmitter{
    constructor(ctx) {
        super();
        this.cid = ctx.cid;
        this.db = ctx.db;
        this.save = ctx.save;
        this.push = ctx.push;
        
        this.on('slack', this.onSlack);
        this.on('timer', this.onTimer);

        this.db.terminals = this.db.terminals || {};
    }

    match(cid, text, ts) {
        if(ts && this.db.terminals[ts]) return true;
        var tokens = P.tokenize(text);
        return _.find(BASH_CMDS, w => w === (tokens[0] || "").toLowerCase());
    }
    onTimer(event) {
        var code = event.code;
        var jobid = event.id;
        var verbose = event.verbose || false;
        // logger.info(`shell: get the cron timer call, code ${code}`);
        if(!code) return ;
        if(verbose)
            this.push(new SlackBuilder(`start to run the cron job `).b(jobid).build());
        this.onSlack({cid: this.cid, text: `!\n\`\`\`\n${code}\n\`\`\``});
    }

    onSlack(event) {
        var cid = event.cid;
        var text = event.text;
        var ts = event.ts;
        var action = event.action;
        var outTs = (this.db.outs || {})[ts];
        logger.debug(`bash: code ${ts} out ts ${outTs} action ${action}`)

        if(!this.match(cid, text, ts)) return ;

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
                    this.execRunProcess(ts, code, output);
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
    execRunProcess(ts, code, output) {
        var that = this;
        var terminal = require('child_process').spawn('bash');
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
    var cmd = _.find(BASH_CMDS, s => s === tokens[0])
    if(cmd) {
        text = text.substring(text.indexOf(cmd) + cmd.length);
        var code = (P.code(text || "") || "").trim();
        if(code) return {type: BASH_SUB_TYPE.RUN, code: code};
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