# Overview

__Expose.js__ is a minimalist web framework for node.js, primarily targeted at single page apps. All it provides out of the box is a simple file server and the ability to make fully transparent __bidirectional remote procedure calls__ between the server and the browser (there is also a node.js client).
There is an extensive plugins API to extend/build upon this functionality. __Expose.js__ comes with a plugin for directly sharing data between client/server and client/client (i.e. it is kept in sync) and for traditional web framework style _routes_.



#Basic Usage
An instace of the server is obtained simply with 
```js
var expose = require("expose.js").Server([options])
```
where options are decribed below. Similarly the node.js client is just 
```js
var expose = require("expose.js").Client([options])
```

Assuming you have an expose server running (with no additional configuration required) you can include ```"/_expose.js"``` in the browser, which then lets you contruct an expose object as 
```js
var expose = ExposeClient([options])
```

Once you have this you can freely export function for remote calls (both on the client and the server) like so

```js
expose.exports.<name> = function (arg1, arg2, ...) {
	...
}
```

These functions can then be called remotely as if they were local functions, including passing callbacks as arguments. The clients only have (direct) access to functions exported on the server, whereas the server has access to exported functions on all clients.

When you are done exporting functions, just call ```expose.start()```.

When a function is called remotely, ```this.id``` is bound to a unique identifier for the other end making the call. This is mostly useful on the server to keep track of clients. On the client it will always be ```_server```.

On the client you can gain access to the functions exported on the server via

```js
expose.withServerApi(function (api) {
	...
});
```
where ```api``` is an object that has all the methods exported by the server. Similarly, on the server you can gain access to a particular clients api with

```js
expose.withClientApi(client_id, function (api) {
	...
});
```
where ```client_id``` is the same id that gets bound to ```this.id``` on incoming calls, and - just like on the client - ```api``` is an object with all the methods exported by that particular client. Additionally the server has a method to get all clients, like so

```js
expose.forEachClient(function (api) {
	...
});
```
where ```this``` in the inner function is bound to the current client id.


#A simple Example
Server:

```js
var expose = require("expose.js").Server();
expose.exports.ping = function () {
	expose.withClientApi(this.id, function(api){
		api.pong();
	});
};
expose.start();  
```

Client:

```js
< script src="/_expose.js" ></ script >
< script >
var expose = ExposeClient();
expose.exports.pong = function () {
	console.log(pong);
};
expose.start(function (){
	//we are all connected to the server now
	expose.withServerApi(function(api){
		server.ping();
	});
});
</ script>
```

A few more elaborate examples can be found [here](https://github.com/stkem/expose/tree/master/examples).


#Limitations

- Functions are only supported as top level arguments to remote functions. If you pass an object to a remote function that contains a function it will be lost. This limitation will likely (but optionally due to serialization cost) be removed at some point.

- Callbacks passed to remote function time out after a certain (configurable) amount of time, i.e. the remote end can only call the callbacks for a fixed amount of time before calls result in errors. Therefore you should not store functions you have received as arguments from remote. This limitation does not apply to functions that have previously been exported.

- Only modern browsers are currently supported, since the RPCs happen over WebSockets. This requirement will likely go away in the future. If you are not sure what browsers you can use, [check this out](http://caniuse.com/websockets).


#Options
Both Client and Server have the following options (passed as an object at construction time):

- ```host```: String. Which host to listen on (server) or connect to (client). Defaults to "0.0.0.0" on the server, "localhost" in the node.js client and whatever domain the browser is currently on in the Browser client.
- ```port```: Number. What port to listen on (server) or connect to (client). Defaults to 80.
- ```plugins```: Array of plugin object. See __Plugins__ section below. Defaults to empty Array.
- ```lambdaLifetime```: Number. How long passed callbacks should be available to be called from the remote end in milliseconds. Defaults to 10000. Does not apply to exported functions (which will not expire).

Additionally the Server has the following options

- ```assets```: String. The path of the folder that files should be served from. Defaults to "./assets".
- ```debug```: Boolean. Prints some information to console as calls are being processed.

#Complete API

The entire api on the constructed expose object looks as follows. All methods are available on all clients and the server unless otehrwise noted.

- `withClientApi(clientId, callback(api, err))` to access the API of a given remote. The clientId of the server is always `_server`.
- `forEachClient(callback(api, err))` Same as `withClientApi` except that `callback` will be called for every currently connected remote. The `this` parameter of the callback will be set to the current client id.
- `exports` An object which you can attach methods to. Any methods on this object before `start` is called will be made available to remotes.
- `start` Starts the server/Connects to the server.
- `stop` Stops the server/Disconnects form the server. Not available in the Browser client.
- `withServerApi(callback(api,err))` A shortcut for `withClientApi('_server', callback(api, err))`. Not available on the server.
- `onDisconnect(callback(client))` Called when a remote disconnects. `client` is an object where `client.id` is the client id.

#Plugins

Expose.js has an extensive API for plugins to hook into. More information on how to write plugins is [here](https://github.com/stkem/expose/tree/master/plugins). There are two plugins currently included:

- A simple key value store that is automatically kept in sync between clients (available as `expose.plugins.dbServer()` and `expose.plugins.dbClient()`). If the server plugin is installed the data store is automatically also available in the browser client. More [here](https://github.com/stkem/expose/tree/master/plugins/db).
- A routes system plugin, akin to traditional web framework http request routing (available as `expose.plugins.routes()`). More [here](https://github.com/stkem/expose/tree/master/plugins/routes).


#Install

DOC TODO****