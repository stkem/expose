# Overview

__Expose__ is a simple, low level web framework for single page web apps. It's very different from most common web frameworks in that there are no Models, Views or Controllers out of the box. With the exception of the root page of your site, __Expose__ also does not deal with serving up any resources directly.
__Expose__ instead lets you treat client and server code (almost) as if they were in the same process. Both client and server can expose arbitrary functions, which the other can then call as if they were local functions, passing callbacks and all.
You will likely still be writing seperate code for the client and the server, but __Expose__ makes the interaction between the two a whole lot easier.

## Example
Here is a terribly contrived example that has the client offloading some complicated computation to the server:

### Server
```js
function square(x, callback){
	callback(x,x*x);
}
expose("square", square)
```

### Client

```js
function updateResult(x, x2){
	console.log("The square of " + x + " is " + x2);
}

function doSquare(x){
	withServerApi(function(api){
		api.square(x, updateResult);
	});
}
```

You can also get the return value of a remote function. Using that functionality - throwing in some anonymous functions - the example would look like this

### Server Take 2
```js
expose("square", function(x, callback){
	return x*x;
});
```

### Client Take 2
```js
function doSquare(x){ use return value here
	withServerApi(function(api){
		var future = api.square(x);
		future.onComplete(function(value, error){ //'error' will pass through exceptions that occured on the server
			if (!error){
				console.log("The square of " + x + " is " + value);
			} else {
				console.log("Error: " + error);
			}
		});
	});
}
```

__The client can expose functions just as easily as the server with a very similar api on the server to access those.__


# Server Api


# Client Api


# Complete Example


# Gotchas
Only top level callbacks are supported at the moment, i.e. if you want to pass a callback to a remote function, it has to be one of the actual direct arguments to the function and not be nested inside another data structure (i.e. object or array).

Callbacks expire after 10 seconds, i.e. if you pass a callback to a remote function, the remote has to call it within 10 seconds or it results in an error. This is for garbadge collection purposes. This does not apply if the callback is also an exposed function.



#Client-Client communication
##WebRTC

#Dependencies
Node Packages: uuid, ws, lodash, mime

On the Client: uuid.js and lodash.js in the directory you are serving from.
