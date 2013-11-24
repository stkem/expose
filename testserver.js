expose = require('./expose').Server();


expose.expose("test", function(a,b,c){
  // console.log(arguments); 
  c("Adding " + a + " and " + b);
  setTimeout(function(){c("which yields their sum")}, 2000); 
  return a+b;
});

expose.expose("square", function(x, f){
  f(x+1);
});

expose.expose("inverse", function(x){
  if (x===0) {throw "Division by zero!"}
  return 1/x;
});

expose.start('0.0.0.0', 8080);
