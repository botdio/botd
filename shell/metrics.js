'use strict';
var request = require('superagent');
var logger = require('../logger');
var CONST = require('../constants');
var Counter = require('./counter');

class Metrics {
    constructor(stack){
        this.counter = new Counter(stack.hash(), stack.oldDbSize());
        this.request = {
            get: this.get.bind(this)
        }
    }
    setCurDb(db) {
        this._curDb = db;
    }
    curDb() {
        return this._curDb;
    }
    get() {
        this.counter.httpOnce();
        if(this.counter.net > CONST.MAX_REQUEST_ONCE)
            throw new Error(`too many request, once session http request limit as ${CONST.MAX_REQUEST_ONCE} , please optimize your code`);
        return request.get.apply(request,arguments);
    }
}

module.exports = Metrics;