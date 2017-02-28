'use strict';

var _ = require('lodash');
var expect = require('chai').expect;
var should = require('chai').should;
var Script = require('../script');

describe('Script', function() {
  it("should match right", () =>{
    expect(Script.parse("!node `console.log(\`abc\`)`")).to.be.eql({type: "RUN", exec: "node", code: "console.log(`abc`)"});
    expect(Script.parse("!sh `echo 1`")).to.be.eql({type: "RUN", exec: "sh", code: "echo 1"});
    expect(Script.parse("!/bin/r `1 + 1`")).to.be.eql({type: "RUN", exec: "/bin/r", code: "1 + 1"});
    expect(Script.parse("!./abc `1 + 1`")).to.be.eql({type: "RUN", exec: "./abc", code: "1 + 1"});
    expect(Script.parse("!/bin/grep")).to.be.eql({type: "RUN", exec: "/bin/grep", code: undefined});
    expect(Script.parse("!/bin/grep abc def.log")).to.be.eql({type: "RUN", exec: "/bin/grep", code: "abc def.log"});

    expect(Script.parse("!abc `1 + 1`")).to.be.eql(undefined);
  });
});