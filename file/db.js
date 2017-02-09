var db = require('diskdb');
var CONST = require('../constants');

var DB_STR = (process.env.DB || CONST.DEFAULT_DB );
DB_STR = DB_STR.indexOf("file:") === 0 ? DB_STR.substring("file:".length) : DB_STR;
db = db.connect(DB_STR, ['channels', 'apps']);

module.exports = db;