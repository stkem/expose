var expose = require("expose.js").Server({debug: true});


var db = {};

var listeners = {};


function forEachListener(key, exceptId, cb){
    var keyListeners = listeners[key] || [];
    keyListeners.forEach(function(clientId){
        if (clientId!==exceptId){
            expose.withClientApi(clientId, function(api){
                cb(api);
            });
        }
    });
}

expose.exports.brodb_put = function(key, idx, value){
    db[key][idx] = value;
    forEachListener(key, this.id, function(api){
        api.brodb_put(key, idx, value);
    });
};

expose.exports.brodb_push = function(key, value){
    db[key].push(value);
    forEachListener(key, this.id, function(api){
        api.brodb_push(key, value);
    });
};

expose.exports.brodb_pop = function(key){
    db[key].pop();
    forEachListener(key, this.id, function(api){
        api.brodb_pop(key);
    });
};


expose.exports.brodb_pushFront = function(key, value){
    db[key].unshift(value);
    forEachListener(key, this.id, function(api){
        api.brodb_pushFront(key, value);
    });
};

expose.exports.brodb_popFront = function(key){
    db[key].shift();
    forEachListener(key, this.id, function(api){
        api.brodb_popFront(key);
    });
};

expose.exports.brodb_clear = function(key){
    db[key] = [];
    forEachListener(key, this.id, function(api){
        api.brodb_clear(key)
    });
};



expose.exports.brodb_subscribe = function(keys, sync){
    var client = this;
    keys.forEach(function(key){
        db[key] = db[key] || [];
        var keyListeners = listeners[key] || [];
        if  (keyListeners.indexOf(client.id) < 0){
            keyListeners.push(client.id);
        }
        listeners[key] = keyListeners;
        forEachListener(key, client.id, function(api){
            api.brodb_create(key, db[key]);
        })
    });
    if (sync) {
        var subDB = {};
        keys.forEach(function(key){
            subDB[key] = db[key] || [];
        });
        return subDB;
    }
};


expose.onDisconnect(function(client){
    var newListeners = {};
    for (var key in listeners) {
        newListeners[key] = listeners[key].filter(function (id) {return id!==client.id});
    }
    listeners = newListeners;
});


expose.start("0.0.0.0", 8080);

