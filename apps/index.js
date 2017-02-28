'use strict';
var App = require('./app');
var Help = require('./help');
var Crond = require('./crond');

var Script = require('../script');

module.exports = {
    root: [Crond, App, Help],
    common: [ Script ],
    defaults: [ Script ]
}