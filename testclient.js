expose = require('./expose').Client();

expose.expose("test", function(x){
  return x*x;
})

expose.start("localhost", 8080)



// setTimeout(function(){
//   var server = expose.getClientApi('server');
//   // console.log(server);
//   server.test(1,2, function(){console.log("$$" + JSON.stringify(arguments))})
// }, 1000);


expose.withServerApi(function(server){


  server.inverse(0).onComplete(function(retval, err){
    console.log(retval);
    console.log(err);
  });

  var future = server.inverse(5)
  future.onComplete(function(retval, err){
    console.log(retval);
    console.log(err);
  });
  setTimeout(function(){
    future.onComplete(function(retval, err){
      console.log(retval);
      console.log(err);
    });
  }, 1000);

  server.inverse(0)

  // function doSquare(x){
  //   if (x<1000) {
  //     server.square(x, doSquare);
  //   }
  // };
  // doSquare(0);

});


setTimeout(function(){
  expose.withServerApi(function(server){
    server.test(1,2,function(){}).onComplete(function(ret,err){
      console.log("blah");
      console.log(ret);
      console.log(err);
    });

  });
}, 5000);



