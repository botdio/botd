'use strict';

var vm = require("vm");
var _ = require('lodash');
var co = require('co');
var request = require('superagent');
var CONST = require('../constants');

function serializeError(err) {
    if(err.name == "Error") {
        err = {
            name: "Error",
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
        console.log(`worker: will send error`, arguments[0]);
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
    

var code = process.argv[2];
var output = new Console();
var ctx = JSON.parse(process.argv[3]) || {};
var script = vm.createScript( code, {
    timeout: ctx.timeout || 5 * 1000, 
    displayErrors: true} );

if(ctx.network) {
    console.log(`worker: set the network limit ${ctx.network}`);
}
global.R = new Request(ctx.network || CONST.MAX_REQUEST_ONCE); 

var db = ctx.db || {};
// console.log("worker: input context is ", JSON.stringify(ctx));
var sandbox = Object.assign(ctx, 
    {
        console: output,
        db: db
    }
);
_.each(ctx.libs, (file, name) => {
    sandbox[name] = require(file || name);
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

function sendDb() {
    process.send({type: "db", db: sandbox.db})
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