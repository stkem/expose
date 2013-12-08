expose = require('./expose').Server();

var registry = {};

function register(name) {
  registry[this.other_id] = name;
  for (var id in registry){
    expose.withClientApi(id, function(api){
      api.putMessage(name + " joined");
    });
  }
}

function sendMessage(msg) {
  var that = this;
  for (var id in registry){
    expose.withClientApi(id, function(api){
      api.putMessage(registry[that.other_id] + ": " + msg);
    });
  }
}

expose.expose("register", register);
expose.expose("sendMessage", sendMessage);
expose.onDisconnect(function(client_id){
  delete registry[client_id];
});

expose.start('0.0.0.0', 8080);

