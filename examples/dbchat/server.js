var expose = require('expose.js');
var server = expose.Server({
    debug: true,
    plugins: [
        expose.plugins.dbServer(),
        expose.plugins.routes()
    ]
});
server.db.createNamespace();
server.routes.any("/", function(req, res){
    res.writeHead(307, {'Location': "/" + Math.random().toString(16).slice(2,7).toUpperCase()});
    res.end();
});
server.routes.any.alias(/^\/[0-9A-F]{5}$/, "/");
server.start('0.0.0.0', 8080);
