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
            if (arg.hasOwnProperty("_$exfunid")) {
                return remoteFutureFactory(clientId, arg["_$exfunid"]);
            } else {
                return arg;
            }
        });
    }

    function constructApiObject(clientId, funs) {
        var api = {};
        funs.forEach(function(funName) {
            api[funName] = remoteFutureFactory(clientId, funName);
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
            clients[clientId] = new Client(clientId);
            publishToClient(clientId);
        },
        disconnect: function(clientId) {
            var client = clients[clientId];
            delete clients[clientId];
            disconnectHandlers.forEach(function(cb) {
                cb.call(null, client);
            })
        },
        alive: function(clientId, callback) { //checks if client is responding correctly within clientTimeout. Call callback with true or false

        }
    }

    var instance = {
        internal: internal,
        expose: function(name, fun) {
            if (typeof fun === 'function') functionRegistry[name] = fun;
            else reportError("Attempt to expose non function object!");
        },
        withClientApi: function(clientId, callback) {
            if (clients[clientId]) clients[clientId].apiPromise.onSuccess(callback);
            else callback(null, "Invalid Client ID " + clientId);
        },
        onDisconnect: function(callback) {
            disconnectHandlers.push(callback);
        },
        forEachClient: function(callback) {
            for (var clientId in clients) {
                clients[clientId].apiPromise.onSuccess(callback.bind(clients[clientId]));
            }
        },
        exports: {},
        initExports: function(){
            for (var name in this.exports) {
                var field = this.exports[name];
                if (typeof field === 'function') {
                    this.expose(name, field);
                }
            }
        }
    };

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
        debug: options.debug || false
    }

    function fileServer(req, res) {
        var rawpath = url.parse(req.url).pathname;
        if (rawpath==="/" || rawpath==="") {
                rawpath = "/index.html";
        }
        var mimetype, fullpath;
        if (rawpath === "/_expose.js") {
            mimetype = "application/javascript";
            fullpath = path.resolve(__dirname, __filename);
        } else {
            mimetype = mime.lookup(rawpath);
            fullpath = path.join(opts.assets,rawpath);
        }
        fs.exists(fullpath, function(exists) {
            if (exists) {
                fs.readFile(fullpath, function(err, data) {
                    res.writeHead(200, {'Content-Type': mimetype});
                    res.end(data);
                });
            } else {
                res.writeHead(404);
                res.end();
            }
        })
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
    },options)

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

    instance.start = function(host, port) {
        this.initExports()
        httpServer.listen(port, host);
    }

    instance.stop = function() {
        httpServer.close();
    }

    return instance;
}

function NodeClient(options) {
    var ws = require('ws');
    var socket;

    var instance = Common(function(clientId, msg) {
        if (clientId === "_server") socket.send(msg);
        else console.log("Unknown Client: " + clientId);
    },options || {});

    var onOpen = [];
    var opened = false;

    instance.withServerApi = function(callback) {
        if (opened) instance.withClientApi('_server', callback);
        else onOpen.push(instance.withClientApi.bind(instance,'_server', callback));
    }

    instance.start = function(host,port) {
        this.initExports()
        socket = new ws("ws://" + host + ":" + port);

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

    var instance = Common(function(clientId, msg) {
        if (clientId === "_server") socket.send(msg);
        else console.log("Unknown Client: " + clientId);
    },options || {});

    var onOpen = [];
    var opened = false;

    instance.withServerApi = function(callback) {
        if (opened) instance.withClientApi('_server', callback);
        else onOpen.push(instance.withClientApi.bind(instance,'_server', callback));
    }

    instance.start = function(host,port) {
        this.initExports()

        host = host || window.location.hostname;
        port = port || window.location.port;
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
}

})();



