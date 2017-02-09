# BotD - Dev, Daemon and Automation, All in Slack.
[![Build Status](https://travis-ci.org/botdio/botd.svg?branch=master)](https://travis-ci.org/botdio/botd)

Write, run and debug nodejs code, when good enough, make a cron job to do automation. **The whole process is happening in slack.**

BotD is target on:
> Team code learning and sharing;  
> Server side codepen;  
> Server side operation;  
> Talent hiring with real coding  

## Start 
`
node ./botd.js -t  <slack bot token> -n <bot name, optional>
`

## Basic concepts
### Bot
 BotD run as a slack bot. it can be added by:
 > Host by botd.io: Goto http://botd.io , and click `Add To Slack` button, you can invite BotD into you slack team.
 > Host by your self: clone code, create a bot in your slack and get the bot token. Then start botd with it.

Then you can send directly message to botd, or `/invite botd` into a channel.

#### App
  App handle channel events( message send/edit, join, leave etc), and send response to you.

  Apps are hosted in channel space, you can use command `app list/install/uninstall` to manage thems. 
  
  Based on storage space, App is separated into two types: _root_ and _common_.
  All root apps share same storage, the following root apps are supported:
  > App - common apps management
  > Help - print help manual
  > Cron - a time-based job scheduler
  
Each common app have its own db storage.

#### Cron App
Learn from *nix, a time-based job scheduler, execute app or script, with minute unit.

#### Shell App
 A common app, which help you to run scripts.
 Use `app uninstall Shell` to remove it. 
 
 **When running a script, BotD will spawn a node process, along with a NodeVM to sandbox the script code. Each console log/error will be piped to slack . When timeout, the process will be killed with a error report(for infinitely loop).**

 > You can change the file shell/shell.json to add more libs/packages for script running, e.g. fs, child_process, network, etc. But you need npm install the botd project.
 > 
 > You can change the file shell/shell.json timeout value to give more cpu time.

## Security Issue
 As default, the shell running scripts are given configured and secure enough packages (co, lodash etc, find default configuration in shell/shell.json file).

 If you host the BotD as your self, you may want to give more powerful runtime packages. You can set environment variable SHELL_CONFIG (SHELL_CONFIG=/path/to/shell-config ) to override the default shell config file, or directly change file shell/shell.json to add more libs.

Maybe you have add "dangerous" package( e.g. fs, child_process, network), here are some suggestions:
> make botd running as a limited user (no root please).
> 
> use cgroup to limit the cpu privilege lower.

### Storage
Each botd common app(e.g. shell) is assigned a json db. After shell script run done, the changed db will be flushed into storage.

For now, BotD support two storage types: file(default) and mongodb(optional).

### store by file
Use current dir (./channels.json & ./apps.json)
```
node ./botd.js -t <bot token> -name <bot name>
```

Use specified dir (/path/to/dir/channels.json and /path/to/dir/apps.json)
```
DB=file:/path/to/dir node ./botd.js -t <bot token> -name <bot name>
```

### store by mongodb
```
DB=mongodb://localhost/botd node ./botd.js -t  <slack bot token>
```

## API
First, git clone botd or `npm install botd`.

Second (optional), config libs for Shell script runtime:
```
var Shell = require('botd').Shell;
Shell.addLibs("request", "superagent"); // npm install superagent
Shell.addLibs("format", `${__dirname}/libs/format`); // my own lib
// later, you shell script can call format and request.
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

### Samples
For app development, you can find a sample project [Hacker News Bot](https://github.com/botdio/hnbot),
There are several apps:
> **Follow** - to follow Hacker News keyword, items or users, make HN like a twitter.
> 
> **Checker** - check if a link is submitted in HN automatically.
> 
> **Agent** - after bind my HN id, get notification when someone comment/upvote my HN item, or when someone reply my comment.

For shell scripts, you can find example gist in https://gist.github.com/datalet/public

Welcome to fire issues in github, or send pull request!