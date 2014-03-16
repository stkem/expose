

/**********************
** Testing Helpers
**********************/

function TestEnv() {

  var testsInFlight = 0;
  var testsPassed = 0;
  var testsFailed = 0;

  var started = false;

  var onFinishCBs = [];

  function startTest(){
    started = true;
    testsInFlight += 1;
  }

  function completeTest(){
    testsInFlight -= 1;
    if (testsInFlight<=0){ //last running test
      setTimeout(function(){
        var stats = "(Passed: " + testsPassed + "; Failed: " + testsFailed + ")";
        if (testsFailed>0) {
          console.log("> Failure " + stats);
        } else {
          console.log("> Success " + stats);
        }
        onFinishCBs.forEach(function(cb){
          cb();
        });
      },1);
    }
  }

  function passTest(){
    testsPassed += 1;
    completeTest();
  }

  function failTest(){
    testsFailed += 1;
    completeTest();
  }

  this.onComplete = function(cb){
    if (testsInFlight<=0 && started) {
      cb();
    } else {
      onFinishCBs.push(cb);
    }
  }

  this.expect = function expect(name, value) {
    startTest();
    var intime = true;
    var resolved = false;
    var shouldBeCalled = true;
    var result = function(arg){
      if (shouldBeCalled) {
        if (intime) {
          if (arg===value) {
            console.log(">>> Success. (" + name + ") " + value + " == " + arg);
            passTest();
          } else {
            console.log(">>> Failured. (" + name + ") " + value + " != " + arg);
            failTest();
          }
        } else {
          if (arg===value) {
            console.log(">>> Delayed. (" + name + ") " + value + " == " + arg);
          } else {
            console.log(">>> Failure. (" + name + ") " + value + " != " + arg + "(also late)");
          }
        }
      } else {
        console.log(">>> Failure. (" + name + ") Should not have been called. (called with: " + arg + ")");
        failTest();
      }
      resolved = true;
    };
    result.within = function(time){
      setTimeout(function(){
        if (!resolved) {
          console.log(">>> Failure. (" + name + ") Taking too long.");
          intime = false;
          failTest();
        }
      }, time);
      return this;
    };
    result.never = function() {
      shouldBeCalled = false;
      completeTest();
      return this;
    };
    return result;
  };


}


/**********************
** Tests
**********************/


expose = require('expose.js');
testPlugin = require('./plugins/bing.js');
server = expose.Server({debug: true, lambdaLifetime: 500, plugins: [testPlugin.create()]});
client = expose.Client({debug: true, lambdaLifetime: 500, plugins: [testPlugin.create()]});
testenv = new TestEnv();

testenv.onComplete(function(){
  setTimeout(function(){ //give it some time to catch erroneous not expected responses
    try {
      client.stop();
      server.stop();
    } catch(err) {}
  },100);
});


server.exports.sum = function(){
  var sum = 0;
  for (var i=0; i<arguments.length; i++){
    sum += arguments[i];
  }
  return sum;
};

server.exports.inverse = function(x){
  if (x===0) throw "Division by Zero!";
  return 1/x;
};

server.exports.callme = function(f,x){
  f(x);
};

client.exports.indirect = function(f,x){
  client.withServerApi(function(api){
    api.callme(f,x);
  });
};


server.start('0.0.0.0', 8080);

client.start('0.0.0.0', 8080);


//give it some time for connections to be established
setTimeout(function(){

  server.forEachClient(function(api){
    api.indirect(testenv.expect("circuitous", "circuitous").within(10), "circuitous");
  });

  server.bing();

  client.bing();

  client.withServerApi(function(api){
    api.sum(1,2,3).onSuccess(testenv.expect("sum of 1,2 and 3 is 6", 6).within(10));
    api.inverse(2).onSuccess(testenv.expect("One over 2 is 0.5", 0.5).within(10));
    var inverseOfZeroFuture = api.inverse(0);
    inverseOfZeroFuture.onFailure(testenv.expect("Inverse of zero is an error", "Division by Zero!").within(10));
    inverseOfZeroFuture.onSuccess(testenv.expect("Inverse of zero is not a thing").never());
  });

}, 200);






