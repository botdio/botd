'use strict';

class Counter {
    constructor(md5, db){
        this.md5 = md5;
        this.time = 0;
        this.net = 0;
        this.db = db;
        this.diff = 0;
    }
    httpOnce() {
        this.net += 1;
        return this.net;
    }
    start(){
        this.startAt = new Date().getTime();
    }
    end(){
        this.time = new Date().getTime() - this.startAt;
    }
    stopAt(reason) {
        this.stop = reason;
        if(this.startAt) {
            this.time = new Date().getTime() - this.startAt;
        }
    }
    countDb(diff) {
        this.diff = diff;
    }
}
module.exports = Counter;