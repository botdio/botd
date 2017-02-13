# BotD - Dev, Daemon and Automation, All in Slack.
[![Build Status](https://travis-ci.org/botdio/botd.svg?branch=master)](https://travis-ci.org/botdio/botd)

BotD start a daemon process in server side, and connect to your Slack. When code submit, the process will run it and output will be piped to your slack.

Write, run and debug nodejs code, when good enough, make a cron job to do automation. **The whole process is in slack.**

BotD can be used to:
> Show team the runnable code, not words;    
> Share team the code and results;  
> "Codepen" for Team;  
> Operate in server side;  
> Hire talent by coding in slack.  

## Demo: Hello, World
The follow gif shows how to invite BotD, write and execute the code, change and rerun the code:
![hello,world](https://dev.botd.io/img/helloworld.gif)

## Start 
```
node ./botd.js -t  <slack bot token> -n <bot name, optional>
```

## API
First, git clone botd or `npm install botd`.

Second (optional), configure packages/libs for Shell script runtime:
```
var Shell = require('botd').Shell;
Shell.addLibs("request", "superagent"); // install superagent in your project
Shell.addLibs("format", `${__dirname}/libs/format`); // `format` is your my own lib
// then in your shell script, format and request are imported.
```

Third, start bot:
```
var SlackBot = require('botd').SlackBot;
var Connector = require('botd').Connector;
var slack = new SlackBot("<bot token>", "<bot name>");
var connector = new Connector(slack);
slack.startBot();
```

Your bot should be shown in your slack im list!

**Find FAQ in [FAQ]('./FAQ.md')**

## Security Issues
As default, the running scripts are given secure enough packages (co, lodash etc).  
Maybe you have added "dangerous" package( e.g. fs, child_process - crazy `rm -fr /` :(, even network), here are some suggestions:
> start botd running as a limited user (no root please).  
> use cgroup to limit the cpu privilege lower.  

**YOU NEED UNDERSTAND WHAT ARE YOU DOING WHEN HOST BOTD IN YOUR PRODCUTION SERVER!**

## Storage
For now, BotD support two storage types: file(default) and mongodb(optional).

### stored by file
Default, use current dir where generate two json file (./channels.json & ./apps.json) as db file:
```
node ./botd.js -t <bot token> -name <bot name>
```

Use specified dir and generate json file: /path/to/dir/channels.json and /path/to/dir/apps.json:
```
DB=file:/path/to/dir node ./botd.js -t <bot token> -name <bot name>
```
Make sure the dir exist and writable.

### stored by mongodb
Set the process env DB and start it:
```
DB=mongodb://localhost/botd node ./botd.js -t  <slack bot token>
```
> SaaS use mongodb to store your data.

### Samples
For app development, you can find a sample project [Hacker News Bot](https://github.com/botdio/hnbot),
There are several apps:
> **Follow** - to follow Hacker News keyword, items or users, make HN like a twitter.  
> **Checker** - check if a link is submitted in HN automatically.  
> **Agent** - after bind a HN id, get notification when someone comment/upvote my HN items, or when someone reply my comments.

For shell scripts, you can find example gist in https://gist.github.com/datalet/public

### FAQ
Find FAQ [here](./FAQ.md).

## Contact
Welcome to fire issues in github, or send pull request, or use [SaaS](https://botd.io) to make life easy.