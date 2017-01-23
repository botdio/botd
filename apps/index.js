'use strict';
var App = require('./app');
var Shell = require('../shell');
var Help = require('./help');
var Crond = require('./crond');

module.exports = {
    root: [App, Crond, Help],
    common: [Shell],
    defaults: [Shell]
}