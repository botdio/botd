var DB = require('./db');
var logger = require('../logger');
var _ = require('lodash');

exports.createChannel = function *(cid, tid) {
    var channel = {cid: cid, tid: tid, data: JSON.stringify({})};
    channel = DB.channels.save(channel);
    channel.db = {};
    channel.data = undefined;
    return channel;
}
exports.fetchChannels = function *(tid) {
    return _.map(DB.channels.find({tid: tid}), ch => {
        ch.db = JSON.parse(ch.data) || {};
        delete ch.data;
        return ch;
    });
}

exports.updateDb = function* (cid, db) {
    var dbStr = JSON.stringify(db);
    var options = { upsert: true, multi: true};
    DB.channels.update({id: cid}, {data: dbStr}, options);    
}

exports.deleteDb = function* (cid) {
    DB.channels.remove({id: cid}, true);    
}