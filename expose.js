//Expose 0.1

///////////
// UTIL ///
//////////

(function(){
"use strict";

function keys(obj) {
    var res = [];
    for (var prop in obj){
        res.push(prop);
    }
    return res;
}

function uuid() {
    return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

function reportError(msg) {
    console.error(msg);
}

function Promise() {
    var completeCallbacks = [];
    var successCallbacks    = [];
    var failureCallbacks    = [];

    var value;
    var failureReason;

    var isComplete     = false;
    var isSuccessful = false;

    function callCompleteCallbacks() {
        completeCallbacks.forEach(function(callback) {
            callback(value,failureReason);
        });
    }

    function callSuccessCallbacks() {
        successCallbacks.forEach(function(callback) {
            callback(value);
        });
    }

    function callFailureCallbacks() {
        failureCallbacks.forEach(function(callback) {
            callback(failureReason);
        });
    }

    this.isComplete = function() { return isComplete };
    this.isSuccessful = function() { return isSuccessful };
    this.success = function(result) {
        isComplete = true;
        isSuccessful = true;
        value = result;
        callCompleteCallbacks();
        callSuccessCallbacks();
    };
    this.failure = function(reason) {
        isComplete = true;
        isSuccessful = false;
        failureReason = reason;
        callCompleteCallbacks();
        callFailureCallbacks();
    };
    this.onComplete = function(callback) {
        if (isComplete) callback(value, failureReason);
        else completeCallbacks.push(callback);
    };
    this.onSuccess = function(callback) {
        if (isComplete && isSuccessful) callback(value);
        else successCallbacks.push(callback);
    };
    this.onFailure = function(callback) {
        if (isComplete && !isSuccessful) callback(failureReason);
        else failureCallbacks.push(callback);
    };
    this.then = function(good, bad) {
        if (good != null) {
            this.onSuccess(good);
        }
        if (bad != null) {
            this.onFailure(bad);
        }
    };

}

function SimpleFuture(fun) {
    var promise = new Promise()
    fun(function(res, err){
        if (err) {
            promise.failure(err);
        } else {
            promise.success(res);
        }
    });
    return promise;
}

function Client(id) {
    this.apiPromise = new Promise();
    this.id = id;
}


function Common(transmit, options) { //transmit takes clientId and string to send

    var opts = {
        lambdaLifetime: options.lambdaLifetime || 10000
    }

    //state
    var functionRegistry = {}; //maps name to function object
    var lambdaRegistry = {}; //anonymous callbacks
    var clients = {};    //maps client ids (string) to Client object
    var returnCallbacks = {}; //function to be called when the other side send 'return' or 'error'
    var disconnectHandlers = [];

    var plugins = options.plugins || [];


    function serializeFunction(fun) {
        var maybeFunction;
        for (var candidate in functionRegistry) {
            if (functionRegistry[candidate]===fun) {
                maybeFunction = candidate;
                break;
            }
        }
        if (maybeFunction) {
            return { "_$exfunid": maybeFunction};
        } else {
            var lambdaId = uuid();
            lambdaRegistry[lambdaId] = fun;
            setTimeout(function() {
                delete lambdaRegistry[lambdaId];
            }, opts.lambdaLifetime) //GC
            return { "_$exfunid": lambdaId};
        }
    }

    function processOutgoingArguments(rawArgs) { //this deals with callbacks in the arguments to a remote function
        var args = Array.prototype.slice.call(rawArgs,0); //first, make sure it's a real array
        return args.map(function(arg) {
            if (typeof arg === 'function') {
                return serializeFunction(arg);
            } else {
                return arg;
            }
        });
    }

    function performRemoteCall(clientId, funName, args, callback) {
        var requestId = uuid();
        var message = {
            'kind': 'call',
            'fun': funName,
            'args': processOutgoingArguments(args),
            'request_id': requestId
        };
        returnCallbacks[requestId] = callback;
        transmit(clientId, JSON.stringify(message));
    }

    function remoteFutureFactory(clientId, funName) {
        return function() {
            return SimpleFuture(performRemoteCall.bind(null, clientId, funName, arguments))
        }
    }

    function processIncomingArguments(clientId, args) {
        return args.map(function(arg) {
            if (arg != null && arg.hasOwnProperty("_$exfunid")) {
                return remoteFutureFactory(clientId, arg["_$exfunid"]);
            } else {
                return arg;
            }
        });
    }

    function constructApiObject(clientId, funs) {
        var api = {};
        funs.forEach(function(funName) {
            var namespace = funName.split("::")[0];
            var simpleName = funName.split("::")[1];
            api[namespace] = api[namespace] || {};
            api[namespace][simpleName] = remoteFutureFactory(clientId, funName);
        })
        return api;
    }

    function publishToClient(clientId) {
        var message = {
            kind: "publish",
            funs: keys(functionRegistry)
        };
        transmit(clientId, JSON.stringify(message));
    }


    var handlers = {
        '_missing': function(client, data) {
            var message = {
                kind: "error",
                message: "Did not understand message: >>>" + JSON.stringify(data) + "<<<",
                code: 400,
                request_id: data.request_id
            }
            transmit(client.id, JSON.stringify(message));
        },
        'publish': function(client, data) {
            client.apiPromise.success(constructApiObject(client.id, data.funs));
        },
        'call': function(client, data) {
            var fun = functionRegistry[data.fun] || lambdaRegistry[data.fun];
            if (!fun) {
                var message = {
                    kind: "error",
                    message: "Unknown Function: " + data.fun,
                    code: 404,
                    request_id: data.request_id
                };
                transmit(client.id, JSON.stringify(message));
            } else {
                try {
                    var message = {
                        kind: "return",
                        retval: fun.apply(client, processIncomingArguments(client.id, data.args)),
                        request_id: data.request_id
                    };
                } catch(e) {
                    //throw e;
                    var message = {
                        kind: "error",
                        message: '' + e,
                        code: 400,
                        request_id: data.request_id
                    };
                }
                transmit(client.id,JSON.stringify(message));
            }
        },
        'return': function(client, data) {
            var callback = returnCallbacks[data.request_id];
            delete returnCallbacks[data.request_id];
            var returnValue = data.retval;
            if (returnValue && returnValue.hasOwnProperty("_$exfunid")) {
                returnValue = remoteFutureFactory(client.id, arg["_$exfunid"]);
            }
            callback.apply(null, [returnValue, null]);
        },
        'error': function(client, data) {
            if (data.hasOwnProperty("request_id")) {
                var callback = returnCallbacks[data.request_id];
                delete returnCallbacks[data.request_id];
                callback.apply(null, [null, data.message]);
            }
        },
        'ping': function(client, data) {
            var message = {
                kind: 'pong'
            };
            transmit(client.id, JSON.stringify(reply));
        },
        'pong': function(client, data) { //ZZZ tie in with 'alive' function

        }
    }

    var internal = {
        receive: function(clientId, rawData) {
            try {
                var data = JSON.parse(rawData)
            } catch(e) {
                var message = {
                    kind: "error",
                    message: "Invalid Json: >>>" + rawData + "<<<",
                    code: 400
                }
                transmit(clientId, JSON.stringify(message));
                return;
            }
            var handler = handlers[data.kind] || handlers["_missing"];
            var client = clients[clientId]; //ZZZ what if there is no client
            handler(client, data);
        },
        connect: function(clientId) {
            var newClient = new Client(clientId);
            plugins.forEach(function(plugin){
               if (plugin.onConnect != null) plugin.onConnect(newClient);
            });
            clients[clientId] = newClient;
            publishToClient(clientId);
        },
        disconnect: function(clientId) {
            var client = clients[clientId];
            delete clients[clientId];
            plugins.forEach(function(plugin){
                if (plugin.onDisconnect != null) plugin.onDisconnect(client);
            });
            disconnectHandlers.forEach(function(cb) {
                cb.call(null, client);
            })
        },
        alive: function(clientId, callback) { //checks if client is responding correctly within clientTimeout. Call callback with true or false

        }
    }

    var instance = {
        internal: internal,
        expose: function(namespace, name, fun) {
            if (typeof fun === 'function') functionRegistry[namespace + "::" + name] = fun;
            else reportError("Attempt to expose non function object!");
        },
        withClientApi: function(clientId, callback) {
            if (clients[clientId]) clients[clientId].apiPromise.onSuccess(function(fullApi){
                callback(fullApi["std"]);
            });
            else callback(null, "Invalid Client ID " + clientId);
        },
        onDisconnect: function(callback) {
            disconnectHandlers.push(callback);
        },
        forEachClient: function(callback) {
            for (var clientId in clients) {
                clients[clientId].apiPromise.onSuccess(function(fullApi){
                    callback.call(clients[clientId], fullApi["std"]);
                });
            }
        },
        exports: {},
        initExports: function(){
            for (var name in this.exports) {
                var field = this.exports[name];
                if (typeof field === 'function') {
                    this.expose("std", name, field);
                }
            }
        }
    };

    //apply plugins
    plugins.forEach(function(plugin){
        instance[plugin.name] = plugin.init(function(clientId, callback){
            if (clients[clientId]) clients[clientId].apiPromise.onSuccess(function(fullApi){
                callback(fullApi[plugin.name]);
            });
            else callback(null, "Invalid Client ID " + clientId);
        })
        if (plugin.internalApi != null) {
            for (var f in plugin.internalApi) {
                instance.expose(plugin.name, f, plugin.internalApi[f]);
            }
        }
    });

    return instance;
}



function Server(options) {
    var ws = require('ws');
    var http = require('http');
    var mime = require('mime');
    var url = require('url');
    var fs = require('fs');
    var path = require('path');

    options = options || {};
    var opts = {
        assets: options.assets ||    "./assets",
        debug: options.debug || false,
        host: options.host || '0.0.0.0',
        port: options.port || 80
    }


    var httpHandlers = [];
    httpHandlers.push(function(req, res, next){
        if (req.url.pathname === "/_expose.js" && req.method === 'GET') {
            fs.readFile(path.resolve(__dirname, __filename), function(err, data) {
                res.writeHead(200, {'Content-Type': "application/javascript"});
                var fullData = data;
                (options.plugins || []).forEach(function(plugin){
                    if (plugin.clientJs != null) fullData += plugin.clientJs();
                });
                res.end(fullData);
            });
        } else {
            next();
        }
    });
    (options.plugins || []).forEach(function(plugin) {
        if (plugin.httpHook != null) {
            httpHandlers.push(plugin.httpHook);
        }
    });
    httpHandlers.push(function(req, res){
        var rawpath = req.url.pathname;
        if (rawpath==="/" || rawpath==="") {
            rawpath = "/index.html";
        }
        var mimetype = mime.lookup(rawpath);
        var fullpath = path.join(opts.assets,rawpath);
        fs.exists(fullpath, function(exists) {
            if (exists) {
                fs.readFile(fullpath, function(err, data) {
                    res.writeHead(200, {'Content-Type': mimetype});
                    res.end(data);
                });
            } else {
                res.writeHead(404);
                res.end("Not found");
            }
        });
    });



    function fileServer(req, res) {
        req.url = url.parse(req.url);
        function tryToHandle(idx) {
            var handler = httpHandlers[idx];
            if (handler === undefined) {
                res.writeHead(500);
                res.end("No Handler");
            }
            handler(req, res, function(){
                tryToHandle(idx+1);
            });
        }
        tryToHandle(0);
    }

    var httpServer = http.createServer(fileServer);
    var wsServer = new ws.Server({server: httpServer});

    var sockets = {}; //clientId to Socket object

    var instance = Common(function(clientId, msg) { //ZZZ this transmit function needs to buffer for reconnects
        var socket = sockets[clientId];
        if (socket) {
            if (opts.debug) console.log("Outgoing: " + msg);
            socket.send(msg);
        }
        else console.log("Warning. No socket for <" + clientId + ">. Not sending: " + msg);
    },options);

    wsServer.on('connection', function(socket) {
        var clientId = uuid();
        sockets[clientId] = socket;
        instance.internal.connect(clientId);

        socket.on('close', function(code, message) {
            instance.internal.disconnect(clientId);
            delete sockets[clientId];
        });

        socket.on('message', function(data, flags) {
            if (opts.debug) console.log("Incoming: " + data);
            instance.internal.receive(clientId, data);
        });
    });

    instance.start = function() {
        this.initExports()
        httpServer.listen(opts.port, opts.host);
    }

    instance.stop = function() {
        httpServer.close();
    }

    return instance;
}

function NodeClient(options) {
    var ws = require('ws');
    var socket;

    options = options || {};

    var instance = Common(function(clientId, msg) {
        if (clientId === "_server") socket.send(msg);
        else console.log("Unknown Client: " + clientId);
    },options);

    var opts= {
        host: options.host || 'localhost',
        port: options.port || 80
    }

    var onOpen = [];
    var opened = false;

    instance.withServerApi = function(callback) {
        if (opened) instance.withClientApi('_server', callback);
        else onOpen.push(instance.withClientApi.bind(instance,'_server', callback));
    }

    instance.start = function(onConnect) {
        if (onConnect) onOpen.push(onConnect);
        this.initExports();
        socket = new ws("ws://" + opts.host + ":" + opts.port);

        socket.on('open', function(){
            instance.internal.connect("_server");
            opened = true;
            onOpen.forEach(function(callback) {
                callback();
            });
        });
        socket.on('message', function(data, flags){
            instance.internal.receive("_server", data);
        });
        socket.on('close', function(){
            instance.internal.disconnect("_server");
        });
    }

    instance.stop = function() {
        socket.close();
    }

    return instance;
}

function BrowserClient(options) {
    var socket;
    options = options || {};
    options.plugins = options.plugins || [];
    (window.__exposePlugins || []).forEach(function(plugin){
        options.plugins.push(plugin());
    });

    var instance = Common(function(clientId, msg) {
        if (clientId === "_server") socket.send(msg);
        else console.log("Unknown Client: " + clientId);
    },options);

    var onOpen = [];
    var opened = false;

    instance.withServerApi = function(callback) {
        if (opened) instance.withClientApi('_server', callback);
        else onOpen.push(instance.withClientApi.bind(instance,'_server', callback));
    }

    instance.start = function(onConnect) {
        if (onConnect) onOpen.push(onConnect);
        this.initExports();

        var host = options.host || window.location.hostname;
        var port = options.port || window.location.port;
        socket = new WebSocket("ws://" + host + ":" + port);

        socket.onopen = function(){
            instance.internal.connect("_server");
            opened = true;
            onOpen.forEach(function(callback) {
                callback();
            });
        }
        socket.onmessage = function(event){
            instance.internal.receive("_server", event.data);
        }
        socket.onclose = function(){
            instance.internal.disconnect("_server");
        }
    }

    return instance;
}


if (typeof window != 'undefined') {
    window.ExposeClient = BrowserClient;
} else {
    exports.Server = Server;
    exports.Client = NodeClient;
    exports.plugins = {
        dbServer : require("./plugins/db/dbServer.js").create,
        dbClient : require("./plugins/db/dbClient.js").create,
        routes   : require("./plugins/routes/routes.js").create
    }
}

})();



