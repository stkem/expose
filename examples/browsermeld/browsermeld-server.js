expose = require('expose.js').Server({port: 8080});

expose.exports.update = function(html) {
  var that = this;
  expose.forEachClient(function(api){
    if (that.id!==this.id) api.update(html);
  });
};

expose.start();
