var expect = require('chai').expect;
var should = require('chai').should;
var assert = require('chai').assert;
var codeRun = require('../shell/run_script');

describe('runner', function() {
  it('should run ok for normal code', function(done) {
    codeRun("1 + 1", {timeout: 2 * 1000}, (err, data) => {
      //after exit, should get the exit code
      if(typeof err === "number" && err === 0){
        //exit
        console.log("test: parent get normal exit");
        done();
      }
    });
  });

  it('should send message to parent process', function(done) {
    codeRun("console.log('hello')", {console: {
      log: (msg) => {
        expect(msg).to.be.equal('hello');
        done();
      }
    }}, () => {});
  });

  it('should support db changes', function(done) {
    var db = {counter:1};
    var params = {db: db, timeout: 2 * 1000};
    codeRun("console.log(db.counter); db.counter = 2;",
        params,
        (err, data) => {
            if(data && data.db){
              expect(data.db.counter).to.be.equal(2);  
              done();       
            }
        });
  });

  it('should run ok for dead loop then timeout', function(done) {
    // test dead loop
    codeRun("while(true) {}", {timeout: 1 * 1000}, (err, data) => {
      if(typeof data === "string" && data === 'SIGTERM') {
        //should abnormal exit
        done();
      }
    });
  });

  it('should throw exception when uncaught', function(done) {
    // test dead loop
    codeRun("throw new Error('uncaught');", {
      console:{
        error: (err) => {
            console.log(`test: on console get err ${JSON.stringify(err)}`)
            console.error(err.stack);
          if(err) {
            done();
          }
        }
      }
    }, (err, data) => {
      console.log(`test: recv callback err ${err} data ${JSON.stringify(data)}`)
      if(typeof err === "Error") {
        //should abnormal exit
        done();
      }
    });
  });

});