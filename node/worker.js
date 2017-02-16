'use strict';

var vm = require("vm");
var _ = require('lodash');
var co = require('co');
var request = require('superagent');
var CONST = require('../constants');

Error.prototype.toJSON = function() {
    var ret = {
        name: this.name,
        message: this.message,
        stack: this.stack,
        __error__: true
    };
    // Add any custom properties such as .code in file-system errors
    Object.keys(this).forEach(function(key) {
        if (!ret[key]) {
            ret[key] = this[key];
        }
    }, this);
    return ret;
};
function serializeError(err) {
    if(err.constructor.name.indexOf("Error") >= 0) {
        err = {
            __error__: true,
            name: err.constructor.name,
            message: err.message,
            stack: err.stack
        }
    }

    return JSON.stringify(err);
}

class Console {
    log () {
        process.send({type: "log", arguments: arguments});
    }
    error () {
        // console.log(`worker: get error`, _.map(arguments, a => 
        //     a.constructor.name.indexOf("Error") >= 0 ? a.toJSON() : a))
        process.send({type: "error", arguments: _.map(arguments, a => serializeError(a))});
    }
    dir () {
        process.send({type: "dir", arguments: arguments});        
    }
} 

class Request {
    constructor(limit) {
        this._limit = limit;
        this.counter = 0;
    }
    get() {
        // console.log(`worker: start to send get api ${this.counter} / ${this._limit}...`);
        this.counter += 1;
        if(this.counter > this._limit)
            throw new Error(`too many request, once session http request limit as ${this._limit} , please optimize your code`);
        return request.get.apply(request,arguments);
    }
}

function run(code, ctx) {

    function sendDb() {
        process.send({type: "db", db: sandbox.db})
    }

    var output = new Console();
    var script;
    try{
        // console.info(`worker: start to create script ${code}`);
        script = vm.createScript( code, { timeout: ctx.timeout, displayErrors: true} );   
    }
    catch(err) {
        console.error(`worker: fail to create script`, err);
        output.error(err);
        return;
    }
    if(ctx.network) {
        console.log(`worker: set the network limit ${ctx.network}`);
    }
    global.R = new Request(ctx.network || CONST.MAX_REQUEST_ONCE); 

    var db = ctx.db || {};
    // console.log("worker: input context is ", JSON.stringify(ctx));
    var sandbox = Object.assign(ctx, {console: output, db: db});
    _.each(ctx.libs, (file, name) => {
        try{
            sandbox[name] = require(file || name);            
        }catch(err) {
            output.error(`fail to load lib ${name} from ${file}`,err);
            process.exit(-2);
        }
    });
    sandbox.global = sandbox;
    var context = vm.createContext(sandbox);
    try{
        script.runInNewContext(context);
    }catch(err) {
        console.error(`worker: script run err`, err);
        err.stack? output.error(err.stack) : output.error(err);
        process.exit(-1); 
    }

    //do something when app is closing
    process.on('exit', () =>{
        sendDb();
        console.log(`worker: exit normally, and send db done, exit process 0`);
        process.exit(0);
    });

    //catches uncaught exceptions
    process.on('uncaughtException', (err) => {
        console.error(`worker: uncaughtException`, err)
        output.error(err);
        process.exit(-1);
    });
}


var code = process.argv[2];
var ctx = JSON.parse(process.argv[3]) || {};
run(code, ctx);