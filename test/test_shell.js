'use strict';

var _ = require('lodash');
var expect = require('chai').expect;
var should = require('chai').should;
var Shell = require('../shell');

describe('Shell', function() {
  it("should get scripts", () =>{
    expect(Shell.parse("! `console.log(\`abc\`)`")).to.be.eql({type: "RUN", code: "console.log(`abc`)"});
  });
});