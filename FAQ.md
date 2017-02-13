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
