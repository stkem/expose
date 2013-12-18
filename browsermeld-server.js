expose = require('./expose').Server();

expose.expose("update", function(html) {
  var that = this;
  expose.forEachClient(function(api){
    if (that.otherEnd!==this.otherEnd) api.update(html);
  });
});

expose.start('0.0.0.0', 8080);
