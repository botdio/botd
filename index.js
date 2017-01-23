'use strict';

var program = require('commander');
var co = require('co');
var logger = require('./logger');
var SlackBot = require('./slack');
var Connector = require('./connector');

function checkUsage(token) {
    if(!token)
        throw new Error("bad input, need -t <token>");
}

program
    .option('-t, --token <token>', 'specify the token', '')
    .option('-n, --name <name>', 'specify the bot running name', '')
    .parse(process.argv);
checkUsage(program.token, program.name);

var slack = new SlackBot(program.token, program.name);
var connector = new Connector(slack);
slack.connect(connector);
slack.startBot();

