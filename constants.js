exports.MSG_TYPE = {
  DM: "direct_message",
  MENTION: "mention",
  KNOWN: "known"
}
exports.MSG_ACTION = {
    CREATED: "created",
    DELETED: "deleted",   
    EDITED: "edited",
    REPLIED: "replied"
}
exports.DATA_DIR = process.env.DATA || ".";
exports.DEFAULT_DB = `file:${exports.DATA_DIR}/db`
exports.LOG_FILE = `${exports.DATA_DIR}/logs/botd.log`;
exports.LOG_LEVEL = "debug";
exports.BOT_DEFAULT_NAME = "botd"; 
exports.DB = process.env.DB || exports.DEFAULT_DB;
