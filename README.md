# BotD
[![Build Status](https://travis-ci.org/botdio/botd.svg?branch=master)](https://travis-ci.org/botdio/botd)

empower slack by es6 code
> write and run es6 code in slack 
> 
> and cron the scripts

### How to Start BotD
`
node ./index.js -t  <slack bot token> -n <bot name, optional>
`

#### Config the mongodb connection string
BotD use mongodb as the storage, you can config the mongodb connection by `DB` environment.
`
DB=mongodb://localhost/botd

node ./index.js -t  <slack bot token>
`
