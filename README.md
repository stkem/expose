# Overview

__Expose.js__ is a minimalist web framework for node.js, primarily targeted at single page apps. All it provides out of the box is a simple file server and the ability to make fully transparent __bidirectional remote procedure calls__ between the server and the browser (there is also a node.js client).
There is an extensive plugins API to extend/build upon this functionality. __Expose.js__ comes with a plugin for directly sharing data between client/server and client/client (i.e. it is kept in sync) and for traditional web framework style _routes_.



#Basic Usage
An instace of the server is obtained simply with ```var expose = require("expose.js").Server([options])```, where options are decribed below. Similarly the node.js client is just ```var expose = require("expose.js").Client([options])```.

Assuming you have an expose server running (with no additional configuration required) you can include ```"/_expose.js"``` in the browser, which then lets you contruct an expose object as ```var expose = ExposeClient([options])```.

Once you have this you can freely export function for remote calls (both on the client and the server) like so

```
expose.exports.<name> = function (arg1, arg2, ...) {
	...
}
```

These functions can then be called remotely as if they were local functions, including passing callbacks as arguments. The clients only have (direct) access to functions exported on the server, whereas the server has access to exported functions on all clients.

When you are done exporting functions, just call ```expose.start()```.

When a function is called remotely, ```this.id``` is bound to a unique identifier for the other end making the call. This is mostly useful on the server to keep track of clients. On the client it will always be ```_server```.

On the client you can gain access to the functions exported on the server via

```
expose.withServerApi(function (api) {
	...
});
```
where ```api``` is an object that has all the methods exported by the server. Similarly, on the server you can gain access to a particular clients api with

```
expose.withClientApi(client_id, function (api) {
	...
});
```
where ```client_id``` is the same id that gets bound to ```this.id``` on incoming calls, and - just like on the client - ```api``` is an object with all the methods exported by that particular client. Additionally the server has a method to get all clients, like so

```
expose.forEachClient(function (api) {
	...
});
```
where ```this``` in the inner function is bound to the current client id.


#A simple Example
Server:

```
var expose = require("expose.js").Server();
expose.exports.ping = function () {
	expose.withClientApi(this.id, function(api){
		api.pong();
	});
};
expose.start();  
```

Client:

```
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


#Limitations

- Functions are only supported as top level arguments to remote functions. If you pass an object to a remote function that contains a function it will be lost. This limitation will likeley (but optionally due to serialization cost) be removed at some point.

- Callbacks passed to remote function time out after a certain (configurable) amount of time, i.e. the remote end can only call teh callbacks for a fixed amount of time before calls result in errors. Therefore you should not sore functions you have received as arguments from remote. This limitation does not apply 

- Only modern browsers are currently supported, since the RPC happen over WebSockets. This requirement will likely go away in the future. If you are not sure what browsers you can use, [check this out](http://caniuse.com/websockets).


#Options
Both Client and Server have the following options (passed as an object at construction time):

- ```host```: String. Which host to listen on (server) or connect to (client). Defaults to "0.0.0.0" on the server, "localhost" in the node.js client and whatever domain the browser is currently on in the Browser client.
- ```port```: Number. What port to listen on (server) or connect to (client). Default to 80.
- ```plugins```: Array of plugin object. See __Plugins__ section below. Defaults to empty Array.
- ```lambdaLifetime```: Number. How long passed callbacks should be available to be called from the remote end in milliseconds. Defaults to 10000. Does not apply t exported functions (which will not expire).

Additionally the Server has the following options

- ```assets```: String. The path of the folder that files should be served from. Defaults to "./assets".
- ```debug```: Boolean. Prints some information to console as calls are being processed.

#Complete API

DOC TODO

#Plugins

DOC TODO


#More Examples

DOC TODO


#Install

DOC TODO
