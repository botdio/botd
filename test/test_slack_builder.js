'use strict';

var expect = require('chai').expect;
var should = require('chai').should;
var SB = require('../slack/builder');

describe('slack builder', function() {
  it('should suport bold and i', function() {
    expect(new SB("abc").build()).to.be.equal("abc");
    expect(new SB().text("abc").build()).to.be.equal("abc");
    expect(new SB("abc").b().build()).to.be.equal("*abc* ");
    expect(new SB("abc").b("def").build()).to.be.equal("abc *def* ");
    expect(new SB("abc").del("def").build()).to.be.equal("abc ~def~ ");

    expect(new SB("abc").a("def","http://abc.com").build()).to.be.equal("abc <http://abc.com|def>");

    expect(new SB("abc").i("def").build()).to.be.equal("abc _def_ ");
    expect(new SB("abc").code("def").build()).to.be.equal("abc `def` ");
    expect(new SB("abc").pre("def").build()).to.be.equal("abc ```def``` ");
    expect(new SB("abc").comment("wow\nddd").build()).to.be.equal("abc\n>>>\nwow\nddd");
  });  
})