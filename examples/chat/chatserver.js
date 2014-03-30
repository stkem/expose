var expose = require('expose.js').Server({port: 8080});

var registry = {};

expose.exports.register = function (name) {
  registry[this.id] = name;
  expose.forEachClient(function(api){
    api.putMessage(name + " joined");
  });
}

expose.exports.sendMessage = function(msg) {
  var that = this;
  expose.forEachClient(function(api){
    api.putMessage( (registry[that.id] || "Anonymous") + ": " + msg);
  });
}

expose.onDisconnect(function(client){
  delete registry[client.id];
});

expose.start();

