expose = require('expose.js').Client();


expose.expose('putMessage', function(msg){
  console.log(msg);
});

expose.start("localhost", 8080);

expose.withServerApi(function(api){
  api.register(process.argv[2]);
  var i = 0;
  setInterval(function(){
    api.sendMessage('#' + i);
    i = i + 1;
  },1000);
});
