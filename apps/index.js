'use strict';
var App = require('./app');
var Help = require('./help');
var Crond = require('./crond');

var Bash = require('../bash');
var Node = require('../node');

module.exports = {
    root: [App, Crond, Help],
    common: [Bash, Node],
    defaults: [Bash, Node]
}