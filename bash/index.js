'use strict';
var _ = require('lodash');
var EventEmitter = require('events');
var co = require('co');

var Console = require('../utils/console');
var CONST = require('../constants');
var logger = require('../logger');
var SlackBuilder = require('slack_builder');
var P = require('../utils/patterns');

const SHELL_TYPE = {
    RUN: "RUN"
}

const SHELL_RESOLVE_KEYWORDS = ["!bash"];

class Bash extends EventEmitter{
    constructor(ctx) {
        super();
        this.cid = ctx.cid;
        this.db = ctx.db;
        this.save = ctx.save;
        this.push = ctx.push;
        
        this.on('slack', this.onSlack);
        this.on('timer', this.onTimer);
        this.terminals = {};
    }

    match(cid, text, ts) {
        if(ts && this.terminals[ts]) return true;
        var tokens = P.tokenize(text);
        return _.find(SHELL_RESOLVE_KEYWORDS, w => w === (tokens[0] || "").toLowerCase());
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
        logger.debug(`bash: code ts ${ts} out ts ${outTs} action ${action}`)

        if(!this.match(cid, text, ts)) return ;

        var output = new Console(this.push.bind(this), outTs);
        if(action === "deleted") {
           try{
                var terminal = this.terminals[ts];
                if(terminal) {
                    terminal.kill();
                    output.error(new SlackBuilder(`process ${terminal.pid} is killed`).code().build());
                    logger.debug(`bash: process ${terminal.pid} is killed for message deleted`);
                }else{
                    logger.debug(`bash: deleted message ${ts} have no running terminal, ignore`);
                }                    
            }
            catch(err) {
                logger.error(`bash: delete message err`, err);
            }
            return ;
        }
                
        var cmd = Bash.parse(text);
        switch(cmd.type) {
            case SHELL_TYPE.RUN:
                try{
                    this.execRunProcess(ts, cmd.code, output);
                }catch(err) {
                    output.error(err).then(() => {
                        if(output.ts){
                            this.attachTs(ts, output.ts);
                        }
                    });
                    logger.error(`bash: fail to execute code ${cmd.code}`, err);
                }
            
            break;
        }
    }
    execRunProcess(ts, code, output) {
        var terminal = require('child_process').spawn('bash');
        terminal.stdout.on('data', function (data) {
            output.log(data);
        });
        var terminals = this.terminals;
        terminal.on('exit', function (exitCode) {
            if(exitCode !== 0)
                output.log('bash exit abnormally!');
            if(terminals[ts] && terminals[ts] === terminal){
                delete terminals[ts];
            }
        });
        terminals[ts] = terminal;
        logger.debug(`bash: ts ${ts} attached to terminal ${terminal.pid}`);
        terminal.stdin.write(code);
        terminal.stdin.end();
        return terminal;
    }
    attachTs(ts, out) {
        if(!ts) return ;
        this.db.outs = this.db.outs || {};
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
    var cmd = _.find(SHELL_RESOLVE_KEYWORDS, s => s === tokens[0])
    if( cmd ) {
        text = text.substring(text.indexOf(cmd) + cmd.length);
        var code = P.code(text).trim();
        if(code) return {type: SHELL_TYPE.RUN, code: code};
    }
}

Bash.help = function(verbose) {
    var sb = new SlackBuilder();
    sb.b(`Bash`).text(` - write, edit and run bash script`).i().br();
    sb.text("\t_`!bash <code> `").text(" - run bash shell <code> _").br();
    return sb.build();
}

module.exports = Bash;