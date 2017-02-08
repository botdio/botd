'use strict';

var request = require('superagent');
var _ = require('lodash');
var co = require('co');
var logger = require('../logger');
var CONSTS = require('../constants');

var SB = require('slackbots');

class SlackBot {

    constructor(token, name){
      this.token = token;
      logger.info(`slack: use token ${token} to init bot`)

      this.bot = new SB({
        token: token, // Add a bot https://my.slack.com/services/new/bot and put the token 
        name: name || CONSTS.BOT_DEFAULT_NAME
      });      
    }

    connect(connector) {
      this.connector = connector;
    }
    startBot() {
        // event fired, when Real Time Messaging API is started (via websocket),
        this.bot.on('start', () => {
            // logger.info(`slack: bot self info ${JSON.stringify(this.bot.self)}`);
            var channels = [];
            this.bot.getChannels().then(chs => {
                var joined = _.filter(chs.channels, ch => ch.is_member);
                _.each(joined, ch => channels.push({cid: ch.id,type: "channel"}));
            });
            this.bot.getGroups().then(chs => {
                _.each(chs, ch => channels.push({cid: ch.id, type:"group"}));
            });
            // logger.debug(`slack: collect ims`, JSON.stringify(this.bot.ims));
            _.each(this.bot.ims, im => {
              if(im.latest)
                channels.push({cid: im.id, type:"im"});
            });
            this.connector.emit("start", {joined: channels,
              bot: {id: this.bot.self.id, name: this.bot.self.name}, 
              team: {id: this.bot.team.id}});
        });
        this.bot.on('error', (err) => {
            logger.error(`slack: bot start error`, err);
            this.connector.emit("error", {err: err});
        });
        this.bot.on('message', (msg) => {
          if(!msg) return ;
            // all ingoing events https://api.slack.com/rtm
            switch(msg.type) {
              case "error":
                logger.error(`slack: recv slack error msg`, msg);
                break;

              case "group_joined":
              case "channel_joined":
                logger.debug(`slack: group/channel join msg`, msg);
                this.connector.emit("join", msg);
                break;

              case "group_left":
              case "channel_left":
                logger.debug(`slack: group/channel left msg`, msg);
                this.connector.emit("left", msg);
                break;

              case "message":
                var channel = msg.channel;
                // logger.info(`slack: channel ${channel} got message ${JSON.stringify(msg)}`);
                if(msg.bot_id) return ; //a bot message, ignore
                // if(msg.subtype) return ; // special message, ignore
                if(msg.user && msg.user === "USLACKBOT") return ;
                var ts = msg.ts;
                var text = msg.text;
                if(msg.subtype && msg.subtype === "message_changed") {
                  ts = msg.message.ts;
                  text = msg.message.text;
                }

                var processedMsg = this.preHandleMsg(channel, text);
                this.connector.emit("message", {cid: channel, text: processedMsg.text, type: processedMsg.type, ts: ts});
                break;

              default:
                const wellknowns = ["desktop_notification", "reconnect_url", "presence_change", "user_typing"]
                if(!_.find(wellknowns, t => t === msg.type))
                  logger.info(`slack: channel got msg : ${JSON.stringify(msg)}`);
                break;
            }
        });
    }

    preHandleMsg(channel, text){
      var withoutBotName = SlackBot.withoutBotId(this.bot.self.id, this.bot.self.name, text);
      // logger.debug(`slack: text ${text} without bot name ${withoutBotName}`);
      //check if im
      if(channel.match(/^D/)) {
        return {type: CONSTS.MSG_TYPE.DM, text: withoutBotName};
      }
      if(withoutBotName !== text) {
        return {type: CONSTS.MSG_TYPE.MENTION, text: withoutBotName};
      }
      return {type: CONSTS.MSG_TYPE.KNOWN, text: text, };
    }

    *send(channel, text, attachments) {
      if(!text || text.length == 0)
        return ;
      return yield new Promise((resolve, reject) =>{
        this.bot.postMessage(channel, text, {attachments: attachments})
        .then(data => {
          // logger.debug(`slack: send to channel ${channel} done, resp data ${JSON.stringify(data)}`);
          resolve(data);
        }).catch(err => {
          logger.error(`slack: fail to send to channel: ${channel}`, err);
          reject(err);
        });
      });
    }
    
    *update(channel, ts, text, attachments) {
      if(!text || text.length == 0)
        return ;
      return yield new Promise((resolve, reject) =>{
        this.bot.updateMessage(channel, ts, text, {attachments: attachments, parse: "none"})
        .then(data => {
          // logger.debug(`slack: send to channel ${channel} done, resp data ${JSON.stringify(data)}`);
          resolve(data);
        }).catch(err => {
          logger.error(`slack: fail to send to update channel: ${channel} ts ${ts}`, err);
          reject(err);
        });
      });
    }
}

SlackBot.withoutBotId = function(botId, botName, text) {
  var mentionSyntax = '<@' + botId + '(\\|' + botName.replace('.', '\\.') + ')?>';
  var mention = new RegExp(mentionSyntax, 'i');
  if(text.match(mention)){
    return text.replace(mention, '').trim();  
  }else{
    return text;
  }
}

module.exports = SlackBot;