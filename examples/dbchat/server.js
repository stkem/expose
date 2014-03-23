var expose = require('expose.js')
var server = expose.Server({debug: true, plugins: [expose.plugins.dbServer()]})
server.db.createNamespace();
server.start('0.0.0.0', 8080);
