'use strict';
var _ = require('lodash');
var program = require('commander');
program
    .version(require('./package.json').version)
    .option('-t, --token <token>', 'specify the token', '')
    .option('-n, --name <name>', 'specify the bot running name', '')
    .option('-m, --mode <native|docker>', 'specify the script runtime mode, docker or native[default]')
    .parse(process.argv);
checkUsage(program.token, program.name);

var logger = require('./logger');
var SlackBot = require('./slack');
var Connector = require('./connector');
if(program.mode && program.mode === "docker"){
    //add the docker into root apps
    var Apps = require('./apps').root;  
    var Docker = require('./docker');  
    if(!_.find(Apps, a => a.name === Docker.name)){
        Apps.push(Docker);
        console.log(`mode set as ${program.mode}, load App Docker done`);
    }
}else{
    console.log(`botd mode use native, not start Docker App`);
}

function checkUsage(token) {
    if(!token){
        console.log("no token input");
    }
}

var slack = new SlackBot(program.token, program.name);
var connector = new Connector(slack);
slack.connect(connector);
slack.startBot();

