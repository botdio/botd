'use strict';

var _ = require('lodash');
var expect = require('chai').expect;
var should = require('chai').should;
var Docker = require('../docker');

describe('Docker', function() {
  it("should parse docker cmd well", () =>{
    expect(Docker.parseCmd("!docker")).to.be.eql({type: "STATUS", image: undefined});
    expect(Docker.parseCmd("!docker l huan9huan/test")).to.be.eql({type: "LOAD", image: "huan9huan/test"});
    expect(Docker.parseCmd("!docker load ubuntu:1")).to.be.eql({type: "LOAD", image: "ubuntu:1"});
    expect(Docker.parseCmd("!docker start")).to.be.eql({type: "START", image: undefined});
  });

});