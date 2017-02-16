'use strict';
var md5 = require('js-md5');

class Stack {
    constructor(code, db, ts) {
        this._code = code;
        this._ts = ts;
        this._hash = md5(code);
        this._old = JSON.stringify(db);
    }
    ts() {
        return this._ts;
    }
    code() {
        return this._code;
    }
    hash() {
        return this._hash;
    }
    oldDbStr() {
        return this._old;
    }
    oldDbSize() {
        return this._old.length;
    }
}

module.exports = Stack;