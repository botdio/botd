var winston = require('winston')
require('winston-daily-rotate-file')
var constants = require('./constants');

var logger = new (winston.Logger)({
transports: [
  new (winston.transports.Console)({ level: constants.LOG_LEVEL || 'debug', timestamp:true }),
  new (winston.transports.DailyRotateFile)({ level: 'debug', timestamp:true, filename: constants.LOG_FILE, datePattern: '.yyyy-MM-dd' })
]
});

module.exports = logger;