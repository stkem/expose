//dummy plugin used in tests. Implements all currently supported plugin hooks.
exports.create = function(){
    var clients = [];
    var withInternalApi;
    return {
        name: "bing",
        init: function(_withInternalApi){
            console.log("I Haz Initialized.");
            withInternalApi = _withInternalApi;
            return function(){
                clients.forEach(function(clientId){
                    withInternalApi(clientId, function(api, err){
                        api.bing();
                    });
                })
            }
        },
        onConnect: function(client){
            clients.push(client.id);
            console.log("Connected: " +  client.id);
        },
        onDisconnect: function(client){
            var idx = clients.indexOf(client.id);
            if (idx>-1){
                clients.splice(idx,1);
            }
            console.log("Disconnected: " + client.id);
        },
        internalApi: {
            bing: function(){console.log(this.id + " => bing")}
        },
        clientJs: function(){
            return "window.foooo = 'blah';";
        },
        httpHook: function(req, res, next) {
            next();
        }
    }
}


