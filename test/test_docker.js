'use strict';

var _ = require('lodash');
var expect = require('chai').expect;
var should = require('chai').should;
var Docker = require('../docker');

describe('Docker', function() {
  it("should parse docker cmd well", () =>{
    expect(Docker.parseCmd("!docker").type).to.be.eql("STATUS");
    expect(Docker.parseCmd("!docker run huan9huan/test").type).to.be.eql("RUN");
    expect(Docker.parseCmd("!docker run ubuntu:1").type).to.be.eql("RUN");
    expect(Docker.parseCmd("!docker start").type).to.be.eql("START");
  });

  it("should ps container", (done) => {
    Docker.ps().then(containers => {console.log(containers);done()});
  })

});