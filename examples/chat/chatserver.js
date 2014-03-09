expose = require('expose.js').Server();

var registry = {};

function register(name) {
  registry[this.id] = name;
  expose.forEachClient(function(api){
    api.putMessage(name + " joined");
  });
}

function sendMessage(msg) {
  var that = this;
  expose.forEachClient(function(api){
    api.putMessage( (registry[that.id] || "Anonymous") + ": " + msg);
  });
}

expose.expose("register", register);
expose.expose("sendMessage", sendMessage);
expose.onDisconnect(function(client){
  delete registry[client.id];
});

expose.start('0.0.0.0', 8080);

