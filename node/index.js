'use strict';
var _ = require('lodash');
var EventEmitter = require('events');
var esprima = require('esprima');
var co = require('co');
var md5 = require('js-md5');

var Console = require('../utils/console');
var CONST = require('../constants');
var RunCode = require('./run_script');
var logger = require('../logger');
var SlackBuilder = require('slack_builder');
var P = require('../utils/patterns');

const SHELL_TYPE = {
    RUN: "RUN"
}

const SHELL_RESOLVE_KEYWORDS = ["!node", "!js"];

class Node extends EventEmitter{
    constructor(ctx) {
        super();
        this.cid = ctx.cid;
        this.db = ctx.db;
        this.save = ctx.save;
        this.push = ctx.push;
        
        this.on('slack', this.onSlack);
        this.on('timer', this.onTimer);
    }

    match(cid, text) {
        var tokens = P.tokenize(text);
        return _.find(SHELL_RESOLVE_KEYWORDS, w => w === (tokens[0] || "").toLowerCase());
    }
    onTimer(event) {
        var code = event.code;
        var jobid = event.id;
        var verbose = event.verbose || false;
        if(!code) return ;
        if(verbose)
            this.push(new SlackBuilder(`start to run the cron job `).b(jobid).build());
        this.onSlack({cid: this.cid, text: `!\n\`\`\`\n${code}\n\`\`\``});
    }

    flushConsole(console) {
        if(console && !console.sendDone() && console._send) {
            setTimeout(() => {
                console._send();
                logger.info(`node: flush the console after code run, console ${console.toMsg()}`);
            },3 * 1000);
        }else{
            logger.info(`node: not need to flush the console, console ${console.toMsg()}`);
        }
    }

    onSlack(event) {
        var cid = event.cid;
        var text = event.text;
        var ts = event.ts;
        var outTs = (this.db.outs || {})[ts];
        logger.debug(`node: code ts ${ts} out ts ${outTs}`)

        if(!this.match(cid, text)) return ;

        var cmd = Node.parse(text);
        switch(cmd.type) {
            case SHELL_TYPE.RUN:
            var code = this.fmd(cmd.code);
            var sandbox = this.buildSandbox(outTs);
            var options = this.options();

            try{
                this.execRunProcess(code, ts, sandbox, options);
            }catch(err) {
                sandbox.console.error(err).then(() => {
                    if(sandbox.console.ts){
                        this.attachTs(ts, sandbox.console.ts);
                    } 
                });
                logger.error(`node: fail to execute code ${ts}`, err);
            }
            break;
        }
    }
    checkDbChangesAndUpdate(old, codeTs, curDb, c) {
        var after = JSON.stringify(curDb);
        if(old !== after){
            if(after.length > old.length && this.isReachLimitTooMuch(after)){
                var err = new Error(`Sorry, your channel db size reach limit (${CONST.DEFAULT_DB_SIZE_LIMIT} characters) too much, db is not saved, please clean it or buy more.`);
                c.error(err);
                //rollback in memory
                this.db = JSON.parse(old);
            }else{
                this.db = curDb;
                this.save();
                logger.info(`node: after execute code ${codeTs} db changed ${after.length - after.length}, update in memory and saved in storage`);
            }
        }
    }
    isReachLimit(str) {
        return str.length > CONST.DEFAULT_DB_SIZE_LIMIT;
    }
    isReachLimitTooMuch(str) {
        return str.length > CONST.DEFAULT_DB_SIZE_LIMIT * 1.2;
    }
    fmt(code) {
        const CHARS = {"\&gt\;" : ">","\&lt\;" : "<", "\&amp\;": "&"};
        _.map(CHARS, (v,k) => code = code.replace(new RegExp(k, 'g'), v));
        return code;
    }
    checkCode(code) {
        esprima.parse(code);
    }
    options() {
        var config = (Node.CONFIG || require(process.env.NODE_CONFIG || "./node.json")) || {};
        const MUST = {co: "co", _: "lodash"};
        var libs = Object.assign({}, config.libs || {}, MUST);

        return {
            filename: "script.js",
            displayErrors: true,
            timeout: config.timeout || CONST.DEFAULT_VM_TIMEOUT,
            libs: libs
        }
    }
    buildSandbox(ts) {
        var sandbox = {
            db: this.db,
            _: _,
            co: co,
            console: new Console(this.push.bind(this), ts),
            SlackBuilder: SlackBuilder
        }
        sandbox.global = sandbox;
        return sandbox;
    }
    execRunProcess(code, codeTs, sandbox, options) {
        var oldDbStr = JSON.stringify(sandbox.db);
        var funcName = "main";
        code = `'use strict'; function *${funcName} () { ${code}
        }
        co(${funcName}()).catch(err => {
            console.error(err);
        })
        `
        try{
            this.checkCode(code);
            logger.debug(`node: code ${codeTs} pass the ast checking`);
        }catch(err) {
            logger.debug(`node: code ${codeTs} not pass the ast checking`);
            throw err;
        }
        RunCode(code,{
                db: sandbox.db, 
                libs: options.libs, 
                timeout: options.timeout,
                network: CONST.MAX_REQUEST_ONCE,
                console: sandbox.console
            },
            (err, data) => {
                this.processEventCallback(oldDbStr, codeTs, sandbox, err, data);
            }
        );
    }
    processEventCallback(oldDbStr, codeTs, sandbox, err, data) {
        if(this.isNormalExit(err, data)) {
            this.checkDbChangesAndUpdate(oldDbStr, codeTs, sandbox.console);
            logger.info(`node: code ${codeTs} normal exit`);
        }else if(this.isAbnormalExit(err, data)) {
            logger.info(`node: code ${codeTs} abnormal exit ${data}, not change db data`);
            sandbox.console.error(new SlackBuilder(`Abnormal program, killed by signal ${data}, please check your code! `).code().build());
        }
        else{
            // logger.debug(`node: code ${stack.hash()} unable handle event data err ${JSON.stringify(err)} data ${JSON.stringify(data)}`)
        }
        if(sandbox.console.ts){
            this.attachTs(codeTs, sandbox.console.ts);
        }
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

Node.addLibs = function(name, file) {
    Node.CONFIG = Node.CONFIG || {libs: {}};
    Node.CONFIG.libs[name] = file;
}

Node.parse = function(text) {
    var tokens = P.tokenize(text);
    var cmd = _.find(SHELL_RESOLVE_KEYWORDS, s => s === tokens[0])
    if( cmd ) {
        text = text.substring(text.indexOf(cmd) + cmd.length);
        var code = P.code(text).trim();
        if(code) return {type: SHELL_TYPE.RUN, code: code};
    }
}

Node.help = function(verbose) {
    var sb = new SlackBuilder();
    sb.b(`Node`).text(` - write, edit and run nodejs script`).i().br();
    sb.text("\t_`!node <code>` `").text(" - run <code> _").br();
    return sb.build();
}

module.exports = Node;