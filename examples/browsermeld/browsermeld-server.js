expose = require('expose.js').Server();

expose.expose("update", function(html) {
  var that = this;
  expose.forEachClient(function(api){
    if (that.id!==this.id) api.update(html);
  });
});

expose.start('0.0.0.0', 8080);
