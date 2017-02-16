'use strict';

var program = require('commander');
program
    .version(require('./package.json').version)
    .option('-t, --token <token>', 'specify the token', '')
    .option('-n, --name <name>', 'specify the bot running name', '')
    .parse(process.argv);
checkUsage(program.token, program.name);

var logger = require('./logger');
var SlackBot = require('./slack');
var Connector = require('./connector');

function checkUsage(token) {
    if(!token){
        console.log("no token input");
    }
}


var slack = new SlackBot(program.token, program.name);
var connector = new Connector(slack);
slack.connect(connector);
slack.startBot();

