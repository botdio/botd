var cp = require('child_process');
var _ = require('lodash');
var CONST = require('../constants');

//params: {db, libs, timeout, console}
function runUnsafeScript(script, params, callback) {
  var context = {db: params.db || {}, libs: params.libs || [], network: params.network || CONST.MAX_REQUEST_ONCE};
  var timeout = params.timeout || 5 * 1000;
  var workerJs = `${__dirname}/worker.js`;
  var worker = cp.fork(workerJs, [script, JSON.stringify(context)]);
  worker.on('message', function(data) {
    console.log(`run_script: recv child process message ${JSON.stringify(data)}`);
    var c = params.console || console;
    switch(data.type) {
      case "log":
        c.log.apply(c, _.map(data.arguments, a => a));
        break;
      case "error":
        c.error.apply(c, _.map(data.arguments, str => {
          var json = JSON.parse(str);
          if(json.name === "Error") return new Error(json.message, json.stack);
          else return json;
        }));
        return ;
      case "dir":
        c.dir.apply(c, _.map(data.arguments, a => a));
        return ;
      case "db":
        callback(null, {db: data.db || {}});
        break;
      default:
        worker.kill();
        callback(false, data); 
        break;
    }
 });

 worker.on('exit', function (code, signal) {
    callback(code, signal);
 });

 worker.on('error', function (err) {
    callback(err, false);
 });

 setTimeout(function killOnTimeOut() {
    worker.kill();
    callback(new Error("Timeout"), false);
 }, timeout);
}

module.exports = runUnsafeScript;