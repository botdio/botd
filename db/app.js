var mongoose = require('./mongo');
var logger = require('../logger');
var timestamps = require('mongoose-timestamp');
var _ = require('lodash');

var AppSchema = new mongoose.Schema({
    app: String,
    tid: String,
    cid: String,
    data: String
});
AppSchema.plugin(timestamps);

var AppModel = mongoose.model('apps', AppSchema);

exports.create = function *(cid, name, tid) {
    return yield new Promise((r,j) => {
        new AppModel({app: name, tid: tid, cid: cid, data: JSON.stringify({})}).save((err, saved) =>{
            if(err){
                logger.error(`app db: fail to save new app ${name}`, err); 
                j(err);
            }else{
                logger.info(`app db: save new app ${name} done`);
                r({cid:cid, db: {}});
            }
        })
    });
}

exports.fetchAll = function *(tid) {
    return yield new Promise((r,j) => {
        AppModel.find({tid: tid}, (err, founds) => {
            if(err) return j(err);
            r(_.map(founds, f => ({cid: f.cid, db: JSON.parse(f.data), app: f.app})));
        });
    })
}

exports.fetchDb = function *(cid, app, tid) {
    return yield new Promise((r,j) => {
        AppModel.findOne({app: app, cid: cid}, (err, found) => {
            if(err) j(err);
            else {
                if(!found){
                    new AppModel({app: app, tid: tid, cid: cid, data: JSON.stringify({})})
                    .save((err, res) => {
                        logger.info(`app_db: save app ${app} cid ${cid} db done`);
                    });
                    r({});
                }else{
                    r(JSON.parse(found.data) || {});
                    logger.info(`app_db: fetch app ${app} cid ${cid} db done`);
                }
            }
        });   
    })
}
exports.updateDb = function* (app, cid, db) {
    return yield new Promise((r,j) => {
        var options = { upsert: true, new: true, setDefaultsOnInsert: true };
        db = (typeof db === "string") ? db : JSON.stringify(db);
        AppModel.findOneAndUpdate({app: app, cid: cid}, {$set: {data: db}}, options, (err, saved) => {
            if(err) j(err);
            else {
                r(saved);
                logger.info(`app_db: update app ${app} cid ${cid} db done, size ${db.length}B`);
            }
        });
    })    
}
exports.deleteDb = function* (cid, app) {
    return yield new Promise((r,j) => {
        AppModel.findOneAndRemove({app: app, cid: cid},(err) => {
            if(err) j(err);
            else {
                r({});
                logger.info(`app_db: delete app ${app} cid ${cid} db done`);
            }
        });
    })    
}