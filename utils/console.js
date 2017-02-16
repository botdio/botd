'use strict';

var SlackBuilder = require('slack_builder');
var _ = require('lodash');
var logger = require('../logger');
var co = require('co');

const MAX_TEXT_SIZE = 2048;

class Console {
    constructor(push, ts) {
        this.ts = ts;
        this.sending = false;
        this.buffer = [];
        this.sentCount = 0; // already sent count
        this.push = push;
    }
    _truncate() {
        var text = this.toMsg();
        if(text.length > MAX_TEXT_SIZE) {
            //truncate and create a new console
            this.buffer = this.buffer.slice(this.sentCount, this.buffer.length);
            // console.log(`console: text too large(${text.length} > ${MAX_TEXT_SIZE}) truncate ${this.sendCount} current ${this.buffer.length} size ${text.length}`);
            this.ts = undefined;
            this.sentCount = 0;
            text = this.toMsg();
        }
        return text;
        // return text.length > MAX_TEXT_SIZE ? this._truncate() : text;       
    }
    _send() {
        return co(this.doSend())
    }
    *doSend() {
        var text = this._truncate();
        return yield new Promise((resolve, reject) => {
            this.sending = true;
            var sendingCount = this.buffer.length;
            // logger.debug(`console: start to sending ${sendingCount} to ts ${this.ts} text ${text}`)
            this.push(text, this.ts).then(res => {
                this.ts = res.ts || this.ts;
                this.sentCount = sendingCount;
                this.sending = false;
                // logger.debug(`console: sent done ${sendingCount} to ts ${this.ts} text ${text}`)
                if(!this.sendDone()){
                    co(this.doSend()).then(res => resolve(res)).catch(err => reject(err))
                }else{
                    resolve(res);
                }
            }).catch(err => {
                this.sending = false;
                reject(err);
            });                
        })
    }
    sendDone() {
        return this.sentCount >= this.buffer.length;
    }
    toMsg() {
        return _.map(this.buffer, b => b.build()).join("\n");
    }

    log() {
        var sb = new SlackBuilder();
        _.each(arguments, obj => {
            sb.text(obj + " ");
        });
        this.buffer.push(sb);
        return this.safeSend();
    }
    safeSend() {
        if(!this.sending){
            return this._send();            
        }
        else{
            return Promise.resolve({ts: this.ts});
        }
    }

    error() {
        var sb = new SlackBuilder();
        _.each(arguments, obj => {
            if(obj && obj.stack) {
                sb.pre(obj.stack);
            }else{
                sb.text(obj + " ");
            }
        });
        this.buffer.push(sb);

        return this.safeSend();
    }

    dir() {
        var sb = new SlackBuilder();
        _.each(arguments, obj => {
            sb.pre(JSON.stringify(obj));
        });
        this.buffer.push(sb);
        return this.safeSend();
    }  
}

Console.isItem = function(obj) {
    if(typeof obj === "object") {
        return obj.id && _.find(["story","poll","comment","job","pollopt"],t => t === obj.type);
    }
}
module.exports = Console;