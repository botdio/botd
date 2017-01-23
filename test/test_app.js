'use strict';

var _ = require('lodash');
var expect = require('chai').expect;
var should = require('chai').should;
var App = require('../apps/app');

describe('App', function() {
  it("should get install app name", () =>{
    expect(App.parseCmd("app i   shell")).to.be.eql({type: "INSTALL", name: "shell"});
    expect(App.parseCmd("app install a b")).to.be.eql({type: "INSTALL", name: "a"});
  });

  it("should get uninstall app name", () =>{
    expect(App.parseCmd("app ui   shell")).to.be.eql({type: "REMOVE", name: "shell"});
    expect(App.parseCmd("app uninstall a b")).to.be.eql({type: "REMOVE", name: "a"});
    expect(App.parseCmd("app remove a b")).to.be.eql({type: "REMOVE", name: "a"});
  });

  it("should print", () =>{
    expect(App.parseCmd("app i").type).to.be.eql("PRINT");
    expect(App.parseCmd("app").type).to.be.eql("PRINT");
  });

});