'use strict';
var App = require('./app');
var Help = require('./help');
var Crond = require('./crond');

var Script = require('../script');
var Node = require('../node');

module.exports = {
    root: [App, Crond, Help],
    common: [ Script ],
    defaults: [ Script ]
}