expose = require('./expose').Server();

var registry = {};

function register(name) {
  registry[this.otherEnd] = name;
  expose.forEachClient(function(api){
    api.putMessage(name + " joined");
  });
}

function sendMessage(msg) {
  var that = this;
  expose.forEachClient(function(api){
    api.putMessage( (registry[that.otherEnd] || "Anonymous") + ": " + msg);
  });
}

expose.expose("register", register);
expose.expose("sendMessage", sendMessage);
expose.onDisconnect(function(client_id){
  delete registry[client_id];
});

expose.start('0.0.0.0', 8080);

