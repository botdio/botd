var DB = require('./db');
var logger = require('../logger');
var _ = require('lodash');

exports.create = function *(cid, name, tid) {
    var app = {app: name, tid: tid, cid: cid, data: JSON.stringify({})};
    DB.apps.save(app);
    app.db = {};
    delete app.data;
    return app;
}

exports.fetchAll = function *(tid) {
    return _.map(DB.apps.find({tid: tid}), app => {
        app.db = JSON.parse(app.data) || {};
        delete app.data;
        return app;
    });
}

exports.fetchDb = function *(cid, app, tid) {
    var app = DB.apps.findOne({app: app, cid: cid});
    if(!app) return exports.create(cid, app, tid).db;
    return JSON.parse(app.data);
}
exports.updateDb = function* (app, cid, db) {
    var options = { upsert: true, new: true };
    db = (typeof db === "string") ? db : JSON.stringify(db);
    DB.apps.update({app: app, cid: cid}, {data: db}, options);
}
exports.deleteDb = function* (cid, app) {
    DB.apps.remove({app: app, cid: cid}, true);    
}