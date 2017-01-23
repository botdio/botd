'use strict';
var _ = require('lodash');

function tokenize(text) {
  return _.filter((text || "").split(/[\s,]+/), t => t.length > 0)
}
function code(text) {
    var m = text.match(/```([\s|\S]*)```/m);
    if(m) return m[1].trim();
    m = text.match(/`([\s|\S]*)`/m);
    if(m) return m[1].trim();   
}
module.exports = {
  tokenize: tokenize,
  code: code
}