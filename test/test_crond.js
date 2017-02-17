'use strict';

const Crond = require('../apps/crond');
var expect = require('chai').expect;
var should = require('chai').should;

describe('crond', function() {
  it('should parse time ok', function() {
    expect(Crond.parseTime("cron add '10 * * * ? *' `f`")).to.be.equal("10 * * * ? *");
    expect(Crond.parseTime("cron add '10 * * * ? *' !bash `console.log('abc')`")).to.be.equal("10 * * * ? *");
  });

  it('should parse cmd ok', function() {
    expect(Crond.parseCmd("cron add '10 * * * ? *' `f`")).to.be.equal("`f`");
    expect(Crond.parseCmd("cron add '10 * * * ? *' f")).to.be.equal("f");
    expect(Crond.parseCmd("cron add '10 * * * ? *' !")).to.be.equal("!");
    expect(Crond.parseCmd("cron add '10 * * * ? *' !bash")).to.be.equal("!bash");
    expect(Crond.parseCmd("cron add '10 * * * ? *' !bash hello")).to.be.equal("!bash hello");
    expect(Crond.parseCmd('cron add "* * * * ? *" !bash\n``` console.log("bingo~") ```')).to.be.equal('!bash\n``` console.log("bingo~") ```');
  });

  it('should check verbose setting ok', () => {
    expect(new Crond({db: {}}).isVerbose()).to.be.equal(undefined);
    expect(new Crond({db: {cronsettings: {verbose: "true"}}}).isVerbose()).to.be.equal("true");
    expect(new Crond({db: {cronsettings: {verbose: "false"}}}).isVerbose()).to.be.equal(undefined);
    expect(new Crond({db: {cronsettings: {verbose: "0"}}}).isVerbose()).to.be.equal(undefined);
  })
})