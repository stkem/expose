This page is about writing plugins. Looking for...

- The shared DB plugin? [Here](https://github.com/stkem/expose/tree/master/plugins/db).
- The routes plugin? [Here](https://github.com/stkem/expose/tree/master/plugins/routes).

#Plugin Objects
A plugin object can have the following fields. Pretty much all are optional. In the following `expose` refers to an instance of the client or the server, not the package itself.

- `name` String. The name of the plugin. It's public api (if any) will be available as `expose.<name>`. The name `std` is reserved.
- `init(withInternalApi)` Function. First thing that is called on a new plugin. The argument `withInternalApi` is a function that behaves just like the top level `withClientApi` except that it retrieves the internal api object of the plugin of the same name on the given client. Whaever `init` returns is assinged to `expose.<name>`.
- `onConnect(client)` Function. Called when a client connects. The argument is a full client object that can be augmented. It is the same object that is assigned to the `this` context of remotely called function. Thus this can be used, e.g. to add authentication information.
- `onDisconnect(client)` Function. Counterpart of `onConnect`.
- `internalApi` Object. All functions on this object will be exported to remote plugins of the same name, i.e. this is the object accessible with the `withInternalApi` function passed to `init`. 
- `clientJS` Function. Called with no arguments. Should return a string which will be served to browser clients along with the main expose.js libary in the request for `/_expose.js`
- `httpHook(req, res, next)` Function. Will be called for all incoming http requests that have not been handled by a plugin earlier in the plugins list. `req` and `res` are just like the request and response objects used by the standard node.js http server, except that `req.url` is a fully parsed object. Next is a function that should be called to indicate that this plugin does not which to handle the current request.