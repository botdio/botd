var winston = require('winston')
require('winston-daily-rotate-file')

var logger = new (winston.Logger)({
transports: [
  new (winston.transports.Console)({ level: process.env.LOG_LEVEL || 'debug' }),
  new (winston.transports.DailyRotateFile)({ level: 'debug', filename: process.env.LOG_FILE || 'bot.log', datePattern: '.yyyy-MM-dd' })
]
});

module.exports = logger;