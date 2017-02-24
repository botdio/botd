'use strict';

var _ = require('lodash');
var expect = require('chai').expect;
var should = require('chai').should;
var Node = require('../node');

describe('Node', function() {
  it("should get scripts", () =>{
    expect(Node.parse("!node `console.log(\`abc\`)`")).to.be.eql({type: "RUN", code: "console.log(`abc`)"});
  });
});