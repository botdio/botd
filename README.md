# BotD - Dev, Daemon and Automation, All in Slack.
[![Build Status](https://travis-ci.org/botdio/botd.svg?branch=master)](https://travis-ci.org/botdio/botd)

BotD start a daemon process in server side, and connect to your Slack. When code submit, the process will run it and output will be piped to your slack.

Write, run and debug nodejs code, when good enough, make a cron job to do automation. **The whole process is in slack.**

BotD can be used to:
> Show team the runnable code, not words;    
> Share team the code and results;  
> Codepen in server side;  
> Operate in server side;  
> Hire talent by coding in slack.  

## Demo: Hello, World
The follow gif is show invite BotD, and write and execute the code, change the code and rerun:
![hello,world](https://dev.botd.io/img/helloworld.gif)

## Start 
```
node ./botd.js -t  <slack bot token> -n <bot name, optional>
```

## API
First, git clone botd or `npm install botd`.

Second (optional), configure libs for Shell script runtime:
```
var Shell = require('botd').Shell;
Shell.addLibs("request", "superagent"); // npm install superagent
Shell.addLibs("format", `${__dirname}/libs/format`); // my own lib
// your shell script can call format and request, just like imported packages.
```

Third, start bot:
```
var SlackBot = require('botd').SlackBot;
var Connector = require('botd').Connector;
var slack = new SlackBot("<bot token>", "<bot name>");
var connector = new Connector(slack);
slack.connect(connector);
slack.startBot();
```

## FAQ
### How to create a BotD bot?
 BotD run as a slack bot. it can be connected by:
 > SaaS: goto botd.io(http://botd.io), click `Add To Slack` button.
 > Self Host: clone code or `npm install botd`, create a bot in slack and get the bot token. Then start botd with it.

### How to run code?
Use `!` as prompt to call BotD, after ! write your code. Wrapper \` for oneline code, wrapper \`\`\`  for multiple line code.
e.g.
```
! `console.log('hello,world')`
```
More samples can be found in  https://gist.github.com/datalet/public .

### Only js code support?
Yes, the bash and other languages need more works.

### How to make code automation?
BotD support Crond - a time-based job scheduler, like *nix.  
E.g. the following command will run counter adding for each minute, and output the value to your slack.
```
cron add "* * * * ? *" !
\`\`\`
db.counter = (db.counter || 0) + 1;
console.log(`current counter ${db.counter}`)
\`\`\`
```

### What happened when trigger a script running?
When bot get a script, it will spawn a node process, along with a NodeVM to sandbox the script code. Each console log/error will be piped to one slack message (only if too big to be seperated by slack). 

### What about the infinitely loop?
If script timeout (infinitely loop), the process will be killed by SIGTERM with an error report (try [infinitely loop](https://gist.github.com/datalet/eb9806a4ae6e6cd567f6a6b46501de16) by yourself ).

### Can I import more packages?
For SaaS mode, you can only choose packages.
For Self-Host mode, you can import any packages:
> change configuration file shell/shell.json to add more libs/packages for script running, e.g. fs, child_process, network, etc. Of couse, you need npm install the packages in your project.

### How to save data?
Take code [db.counter](https://gist.github.com/datalet/0c1385da7886941097b56ee872d19a82) as an example:
```
db.counter = (db.counter || 0) + 1;
console.dir(db)
```
Where:    
1. Directly visit db for read and write.    
2. Write db in script
3. After script run over, bot will check if db changed and do save.
> Notice, if the script is killed for timeout, db will not be saved!

## Security Issues
As default, the shell running scripts are given secure enough packages (co, lodash etc).  
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

Welcome to fire issues in github, or send pull request, or use SaaS for life easy.