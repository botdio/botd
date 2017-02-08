var mongoose = require('./mongo');
var logger = require('../logger');
var timestamps = require('mongoose-timestamp');
var _ = require('lodash');

var ChannelSchema = new mongoose.Schema({
    id: String,
    tid: String,
    data: String
});
ChannelSchema.plugin(timestamps);

var ChannelModel = mongoose.model('channel', ChannelSchema);

exports.createChannel = function *(cid, tid) {
    return yield new Promise((r,j) => {
        new ChannelModel({id: cid, tid: tid, data: JSON.stringify({})}).save((err, saved) =>{
            if(err){
                logger.error(`channel: fail to save new channel`); 
                j(err);
            }else{
                logger.info(`channel: save new channel done`);
                r({cid:cid, db: {}});
            }
        })
    });
}
exports.fetchChannels = function *(tid) {
    return yield new Promise((r,j) => {
        ChannelModel.find({tid: tid}, (err, founds) => {
            if(err) j(err);
            else {
                if(!founds){
                    logger.debug(`channel: fetch channels for tid ${tid} empty`);
                    r([]);
                }else{
                    r(_.map(founds, f => ({cid: f.id, db: JSON.parse(f.data) || {}})));
                    logger.debug(`channel: fetch channels for tid ${tid} count ${founds.length} done`);
                }
            }
        });   
    })
}

exports.updateDb = function* (cid, db) {
    var dbStr = JSON.stringify(db);
    return yield new Promise((r,j) => {
        var options = { upsert: true, new: true, setDefaultsOnInsert: true };
        ChannelModel.findOneAndUpdate({id: cid}, {$set: {data: dbStr}}, options, (err, saved) => {
            if(err) j(err);
            else {
                r(saved);
                logger.info(`channel db: update cid ${cid} db done, size ${dbStr.length}B`);
            }
        });
    })    
}
exports.deleteDb = function* (cid) {
    return yield new Promise((r,j) => {
        ChannelModel.findOneAndRemove({id: cid}, (err, saved) => {
            if(err) j(err);
            else {
                r({});
                logger.info(`channel db: delete cid ${cid} db done`);
            }
        });
    })    
}