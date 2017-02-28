# BotD - Connect the docker and slack, then run code in slack.
[![Build Status](https://travis-ci.org/botdio/botd.svg?branch=master)](https://travis-ci.org/botdio/botd)

BotD is a server side code playground. When start, it will listen the Slack message and executed the scripts.

## Key Features:
> Connect the stdio/stderr into slack message;    
> Edit code, save then run again;  
> Connect the docker container to channel;  
> Cron jobs support for easy automation.  

## Scenario:
> Team code pen or playground, to show the runnable and workable code;  
> Server operation without SSH but in Slack, more easy in mobile.  
> Hire talent by peer coding in slack guest channel.  
> Test the docker images

## Demo: Hello, World
The follow gif shows how to invite BotD, write and execute the code, change and rerun the code:
![hello,world](https://dev.botd.io/img/helloworld.gif)

## Start 
```
mkdir ./db && mkdir ./logs;
node ./botd.js -t  <slack bot token> -n <bot name, optional>
```

## API
1. git clone botd or `npm install --save botd`.
2. start bot:
```
var SlackBot = require('botd').SlackBot;
var Connector = require('botd').Connector;
var slack = new SlackBot("<bot token>", "<bot name>");
var connector = new Connector(slack);
slack.startBot();
```

Your bot should be shown in your slack im list!

## FAQ

### How to run code?
Format: `!<app> <code>`, where  
1. _app_ should be knowable, use `!help` to find avaliable apps.  
2. _code_ should be wrapped by \` (for one line code), or by ``` (for multiple line codes).  
e.g. 
```
!py `print 'hello,world'`
```
Then BotD bot will start a python process, and run code `print 'hello,world'`. If the channel container is attached, the python process will run in the containter.  
Also the code part can be multiple lines, e.g.
```
!bash
 ```while(true);do
    date;
    sleep 1;
    done```
```

**NOTICE** : if you want to interupt a script, you can kill it by two methods:
1. `!bash kill <pid>` -- find pid by `!bash ps`
2. Directly delete the command message in slack, then BotD will find the attached process and kill it.

### How to manage the channel containter
1. Attach  
> Use `!docker run <docker-image>` to start a container, then it will be attached to this channel;  
> Or use `!docker attach <existed-container-id>` to attach the existed container into this channel;  
Then all the script will be run in it.  
2. Start/Stop  
> Use `!docker start/stop` to mange the container;  
3. Detach  
> Use `!docker detach` to detach the container.  

**NOTICE** : the attach/detach is no related to docker attach/detach.  
Use `!help docker` to find more.

### How to use cron job
BotD support Crond - a time-based job scheduler, like *nix.  
E.g. the following command will run counter adding for each minute, and output the value to your slack.
```
cron add "* * * * ? *" !node `console.log(new Date()) `
```

### What is the script runtime?
If you attach the slack channel into a docker container, the script will be run in it.
If not, it will run in the native environment.

### Without Docker, can run it?
Yes, then all channels will share the same runtime environment (your server).

### More languages support?
For now, built in support: shell/python/ruby/nodejs.
You can use `!/path/to/lang/executable <code>` for your code language. e.g. `!/bin/r <r code>` to run r code.

## Storage
Bot need store the bot state data into _db_ , along with logs files.
DB support two types: file(default) and mongodb(optional).

### stored by file
Defaultly, use current dir as data dir:
```
node ./botd.js -t <bot token> -n <bot name>
```

Or use specified dir: (make sure ${DATA} dir have _db_ and _logs_ sub folder):
```
DATA=file:/path/to/dir node ./botd.js -t <bot token> -n <bot name>
```
Make sure the dir exist and writable.

### stored by mongodb
Set the process env DB and start it:
```
DB=mongodb://localhost/botd node ./botd.js -t  <slack bot token>
```

## Support
Welcome to fire issues in github, send pull request.
And I am not native English speaker, this document should be fixed very much, feel free to send pull request.
Or if you need bussiness support, please send to hhhust@gmail.com 