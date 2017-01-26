# BotD
[![Build Status](https://travis-ci.org/botdio/botd.svg?branch=master)](https://travis-ci.org/botdio/botd)

play es6 code in slack
> write and run es6 code in slack 
> and cron the scripts

## How to Start BotD
`
node ./botd.js -t  <slack bot token> -n <bot name, optional>
`

### Configuration
- the mongodb connection string
BotD use mongodb as the storage, you can config the mongodb connection by `DB` environment.
```
DB=mongodb://localhost/botd 
node ./index.js -t  <slack bot token>
```

- logging
set the level by LOG_LEVEL environment setting

```
export LOG_LEVEL=info

export LOG_FILE=mylog.log #default as botd.log, hosted in /logs/botd/${LOG_FILE}    

node ./index.js -t  <slack bot token>
```


todo: shell config?

todo: how to extension?
