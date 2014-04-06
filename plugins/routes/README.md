This plugin adds classic web framework style http routing to expose.js. It's server side only and takes to options. You can create a server with routing capability simply like so

```js
var expose = require('expose.js');
var server = expose.Server({
	...
	plugins: [expose.plugins.routes()]
	...
});
```

This then let's you do things like 

```js
server.routes.get("/users", function(req, res){
	...
});
```
To serve a `GET` request to the path `/users`. `req` and `res` are just like the objects used by the node.js standard http server, except that `req.url` is a fully parsed url object instead of a string.

More generally what is available is

```js
server.routes.<method>(<pattern>, handler(req, res));
```

The `<method>` specifies the http method type to respond to and can be any of `get`, `put`, `post`, `delete`, `head`, `option` or `any`. 
The `pattern` parameter can be either a string or a regular expression object that will be matched against the path of the request.


In addition to simple routing you can also alias one path (or path pattern) to another path, like so

```js
server.routes.<method>.alias(<pattern>, <target>)
```
where `<pattern>` is just like before and `<target>` should be string. This can be useful for single page apps.


Routes are tried in the order in which they are defined. Once a matching route is found no further ones are tried. Aliasing does not stop the resolution process on the other hand. Thus it can be used in conjuction with the build in file server. The following will serve `index.html` for all request (thorugh the build in file server):

```js
server.routes.get.alias(/.*/, "/index.html");
```
