This plugin adds a simple key-value store to the expose object that can be kept in sync between clients. The store is organized into namespaces and clients have to subscribe to a keys (within a namespace) in order to use them.

 
# On the Server

### Setup

Firstly, we can get ourselves an instance of this plugin by

```
var dbPlugin = require('expose.js').plugins.dbServer(options);
```
where `options` has the following possible fields (all optional)

- `createNamespaceOnSubscribe` Boolean. Controls if a client can create a namespace. Default is `false`.
- `createKeyOnSubscribe` Boolean. Controls if a client can create a key within a namespace. Default is `true`. This can be overridden for individual namespaces.
- `clientReadOnly` Boolean. Controls if a client can write data to the store or not. Default is `true`. This can be overridden for individual namespaces.

We can now make ourselves a server with this plugins like so

```js
var server = require('expose.js').Server({
	...
	plugins: [dbPlugin]
	...
});
```

### Usage
 
With the plugin installed we have access to the following new methods on the server

- `server.db.createNamespace([namespace = 'std'], [options])` creates a namespace with the given name. `options` has the same fields as the global options mentioned above, except without `createNamespaceOnSubscribe`.
- `server.db.createKey([namespace = 'std'], key)` creates a key with the given name in the given namespace.
- `server.db.namespaces()` lists all created namespaces.
- `server.db.keys([namespace = 'std'])` lists all created keys for a given namespace.

Additionally, `server.db` is callable to get a key object

```js
var key = server.db([namespace = 'std'], key)
```
A key object behaves a bit like an Array and has the following methods

- `get([index = 0])` gets the value of the key at the given index.
- `set([index = 0], value)` sets the value of the key at the given index.
- `push(value)` appens a given element to the key.
- `pop()` returns and removes the last element in the key.
- `unshift(value)` prepends the given value to the key.
- `shift()` returns and removes the first element in the key.
- `getAll()` gets the entire contents of the key as an array.
- `setAll(value)` sets the entire content of the key to a given array.

Just like with regular arrays `push` and `pop` are a lot faster than `unshift` and `shift`.

Note that you can use this like a regular (i.e. non array-keys) key-value store by simply using the `get` and `set` methods without specifying an index.



# On the Client

### Setup
 
If you are using the browser client you don't have to do anything to make the key-value store available. If the server has it installed it will be automatically available.
If you are using the node.js client you will have to install the `dbClient` plugin (which takes no options). 
 
 
### Usage

In order to access the store, a client needs to subscribe to namespaces and keys it is interested it. This is accomplished through the only top level method added by the plugin on the client like so

```js
client.db.subscribe([namespace = 'std'], Array<keys>, function(key1, key2, ....))
```
where the objects passed to the callback are the same key objects used in the server. See above for usage.

For example, if we are interested in the keys `foo` and `bar` from the default namespace we would subscribe like this

```js
client.db.subscribe(['foo', 'bar'], function(foo, bar){
	//data in the foo and bar key objects is kept in sync between all subscribed clients (and the server)
)}
```
