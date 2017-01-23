'use strict';
var md5 = require('js-md5');

class Stack {
    constructor(code, db) {
        this._code = code;
        this._hash = md5(code);
        this._old = JSON.stringify(db);
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