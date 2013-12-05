(function () {

  function uuid() {
    return Math.floor(Math.random()*1000000000).toString(36);
  }

  function isNode(){
    return (typeof window)==='undefined';
  }

  var __ = {
    isFunction: function(value) {
      return typeof value == 'function';
    },
    map: function(seq, fun){
      var res = Array(seq.length);
      for (var i=0; i<seq.length; i++){
        res[i] = fun(seq[i]);
      }
      return res;
    },
    has: function(object, property) {
      return object ? hasOwnProperty.call(object, property) : false;
    },
    keys: function(obj) { //not the same semantics as in _, but will do here
      var res = [];
      for (prop in obj){
        res.push(prop);
      }
      return res;
    }
  }

  if (isNode()) {
    var http = require('http');
    var mime = require('mime');
    var url = require('url');
    var fs = require('fs');
    var ws = require('ws');
    var WsServer = ws.Server;
  }

  var common = {}

  common.expose = function expose(name, fun){
    if (__.isFunction(fun)){
      this.registry[name] = fun;
    } else {
      throw "Can only publish Functions!"
    }
  }

  common.getClientApi = function getClientApi(client_id){
    var that = this;
    var api = {};
    var client = this.clients[client_id];
    if (client) {
      client.funs.forEach(function(fun){
        api[fun] = function(){
          var resultCallbacks = [];
          var hasReturned = false;
          var retval = null;
          var err = null;
          that.performCall(client_id, fun, Array.prototype.slice.call(arguments,0), function(_retval, _err){
            hasReturned = true;
            retval = _retval;
            err = _err;
            resultCallbacks.forEach(function(callback){
              callback(retval, err)
            })
          });
          return {
            onComplete: function(f){
              if (hasReturned) {
                f(retval, err);
              } else {
                resultCallbacks.push(f);
              }
            }
          }
        };
      });
    }
    else {
      console.log("Not a valid client for api: " + client_id);
    }
    return api
  }

  common.withClientApi = function withClientApi(client_id, callback){
    var that = this;
    if (this.clients[client_id].published) {
      callback(this.getClientApi(client_id));
    } else {
      this.clients[client_id].publishCallbacks.push(function(){
        callback(that.getClientApi(client_id));
      });
    }
  }

  common.publishToClient = function publishToClient(client_id){
    var message = JSON.stringify({
      kind: "publish",
      funs: __.keys(this.registry)
    });
    this.sendToClient(client_id, message);
  }

  common.sendToClient = function sendToClient(client_id, message){
    var client = this.clients[client_id];
    if (client) {
      client.socket.send(message);
      //console.log("Outgoing: " + message);
    }
    else {
      console.log("Cannot send to client " + client_id + ". No Socket.");
    }
  }

  common.handleMessage = function handleMessage(rawdata, client_id){
      try {
        var data = JSON.parse(rawdata)
      } catch(e) {
        var reply = {
          kind: "error",
          message: "Invalid Json: " + rawdata,
          code: 400
        }
        this.sendToClient(client_id, JSON.stringify(reply));
        return;
      }
      if (data.kind==="call") {
        var fun = this.registry[data.fun] || this.anonRegistry[data.fun]
        if (!fun){
          var reply = {
            kind: "error",
            message: "Unknown Function: " + data.fun,
            code: 404,
            request_id: data.request_id
          };
          this.sendToClient(client_id, JSON.stringify(reply));
          return;
        }
        var context = {other_id: client_id};
        try {
          var reply = {
              kind: "return",
              retval: fun.apply(context, this.processIncomingArguments(data.args, client_id)),
              request_id: data.request_id
          }
        } catch(e) {
          console.log("Bad Call:" + e);
          var reply = {
            kind: "error",
            message: e,
            code: 400,
            request_id: data.request_id
          }
        }
        this.sendToClient(client_id,JSON.stringify(reply));
      } else if (data.kind==="return"){
          var callback = this.callbacks[data.request_id];
          delete this.callbacks[data.request_id];
          var args = data.retval;
          callback.apply(null, [args, null]);
      }
      else if (data.kind==="publish"){
        this.clients[client_id].funs = data.funs;
        this.clients[client_id].published = true;
        this.clients[client_id].publishCallbacks.forEach(function(callback){
          callback();
        });
        this.clients[client_id].publishCallbacks = [];

      }
      else if (data.kind==="ping"){
        var reply = {
          kind: "pong"
        }
        this.sendToClient(client_id, JSON.stringify(reply));
      }
      else if (data.kind==="error"){
        if (__.has(data, "request_id")){
          var callback = this.callbacks[data.request_id];
          delete this.callbacks[data.request_id];
          callback.apply(null, [null, data.message]);
        }
      }
      else {
        var reply = {
          kind: "error",
          message: "Did not understand message: " + rawdata,
          code: 400,
          request_id: data.request_id
        }
        this.sendToClient(client_id, JSON.stringify(reply));
      }
  }


  common.processIncomingArguments = function processIncomingArguments(args, client_id){
    var that = this;
    return __.map(args, function(arg){
      if (__.has(arg, "_$exfunid")){
        return function(){
          that.performCall(client_id, arg["_$exfunid"], arguments, function(){});
        }
      } else {
        return arg;
      }
    })
  }

  common.processOutgoingArguments = function processOutgoingArguments(args) {
    var that = this;
    var retval = __.map(args, function(arg){
      if (__.isFunction(arg)){
        var potential_fun;
        for (pfun in this.registry) {
          if (this.registry[pfun]===arg){
            potential_fun = pfun;
            break;
          }
        }
        if (potential_fun){
          return { "_$exfunid": potential_fun} //This needs testing!!!
        } else {
          var id = uuid();
          that.anonRegistry[id] = arg;
          setTimeout(function(){delete that.anonRegistry[id]}, 10000); //GC
          return { "_$exfunid": id};
        }
      } else {
        return arg;
      }
    })
    return retval;
  }

  common.performCall = function performCall(client_id, fun, args, callback){
      var request_id = uuid();
      this.callbacks[request_id] = callback;
      this.sendToClient(client_id, JSON.stringify({
          kind: "call",
          fun: fun,
          args: this.processOutgoingArguments(args),
          request_id: request_id
      }));
  }

  common.onDisconnect = function onDisconnect(fun) {
    this.disconnectCallbacks.push(fun);
  }

  function startServer(host, port, rootPath){
    var that = this;
    if (this.started) throw "Server already started!";

    var fileServer = function(req, res){ //Need to async file IO here, root path as argument
      var path = url.parse(req.url).pathname;
      var mimetype = mime.lookup(path);
      var fullpath = (rootPath || ".") + path
      if (fs.existsSync(fullpath)){
        var data = fs.readFileSync(fullpath);
        res.writeHead(200, {'Content-Type': mimetype});
        res.end(data);
      } else {
        res.writeHead(404);
        res.end();
      }
    }

    this.started = true;
    var http_server = http.createServer(fileServer).listen(port, host);
    var ws_server = new WsServer({server: http_server});
    var that = this;

    ws_server.on('connection', function(socket){
        var client_id = uuid();
        that.clients[client_id] = {socket: socket, funs: [], published: false, publishCallbacks: []};
        socket.on('close', function(code, message){
          that.disconnectCallbacks.forEach(function(cb){
            cb.call(null, client_id);
          });
          delete that.clients[client_id];
        });
        socket.on('message', function(data, flags){
            //console.log("Incoming: " + data)
            that.handleMessage(data, client_id);
        });
        that.publishToClient(client_id);
    });
  }

  function startClient(host, port){
    if (this.started) throw "Client already started!";
    this.started = true;
    if (isNode()){
      var socket = new ws("ws://" + host + ":" + port);
    } else {
      var socket = new WebSocket("ws://" + host + ":" + port);
    }
    var that = this;
    this.clients['server'] = {socket: socket, funs: [], published: false, publishCallbacks: []};
    if (isNode()){
      socket.on('open', function(){
        that.publishToClient('server');
      });
      socket.on('message', function(data, flags){
        //console.log("Incoming: " + data);
        that.handleMessage(data, 'server');
      });
      socket.on('close', function(){
        delete that.clients['server'];
      });
    } else {
      socket.onopen = function(){
        that.publishToClient('server');
      };
      socket.onmessage = function(event){
        //console.log("Incoming: " + event.data);
        that.handleMessage(event.data, 'server');
      };
      socket.onclose = function(){
        delete that.clients['server'];
      };
    }
  }


  function Client(){
    this.started = false;
    this.clients = {};
    this.registry = {};
    this.anonRegistry = {};
    this.callbacks = {};

    this.start = startClient;
    this.withServerApi = function (callback){
      this.withClientApi('server', callback);
    }
  }

  Client.prototype = common;


  function Server(){
    this.started = false;
    this.clients = {};
    this.registry = {};
    this.anonRegistry = {};
    this.callbacks = {};
    this.disconnectCallbacks = [];

    this.start = startServer;
    this.getAllClients = function(){
      return __.keys(this.clients);
    }
  }

  Server.prototype = common;


  if (isNode()){
    exports.Server = function(){
      var _server = new Server();
      return _server;
    }

    exports.Client = function(){
      var _client = new Client();
      return _client;
    }
  } else {
   window.ExposeClient = function(){
      var _client = new Client();
      return _client;
    };
 }

}).call(this);



