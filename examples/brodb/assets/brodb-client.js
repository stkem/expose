

var BroDB = (function(){
    "use strict";
    var expose = ExposeClient();
    var db = {};

    var changeListeners = {};

    function notifyListeners(key) {
        if (changeListeners[key]){
            changeListeners.forEach(function(cb){
               cb(key);
            })
        }
    }

    expose.exports.brodb_create = function(key, value) {
        db[key] = db[key] || value;
        notifyListeners(key);
    }

    expose.exports.brodb_clear = function(key) {
        db[key] = [];
        notifyListeners(key);
    }

    expose.exports.brodb_popfront = function(key) {
        db[key].shift();
        notifyListeners(key);
    }

    expose.exports.brodb_pushfront = function(key, value) {
        db[key].unshift(value);
        notifyListeners(key);
    }

    expose.exports.brodb_pop = function(key) {
        db[key].pop();
        notifyListeners(key);
    }

    expose.exports.brodb_push = function(key, value) {
        db[key].push(value);
        notifyListeners(key);
    }

    expose.exports.brodb_put = function(key, idx, value) {
        db[key][idx] = value;
        notifyListeners(key);
    }



    var retval = function(key) {

        return {
            get: function(idx){
                return db[key][idx || 0];
            },
            getAll: function(){
              return db[key];
            },
            put: function(value, idx){
                expose.withServerApi(function(api){
                    api.brodb_put(key, idx || 0, value);
                });
                db[key][idx || 0] = value;
            },
            push: function(value){
                expose.withServerApi(function(api){
                    api.brodb_push(key, value);
                });
                db[key].push(value);
            },
            pop: function(){
                expose.withServerApi(function(api){
                    api.brodb_pop(key);
                });
                return db[key].pop();
            },
            pushFront: function(value){
                expose.withServerApi(function(api){
                    api.brodb_pushFront(key, value);
                });
                db[key].unshift(value);
            },
            popFront: function(){
                expose.withServerApi(function(api){
                    api.brodb_popFront(key);
                });
                return db[key].shift();
            },
            clear: function(){
                expose.withServerApi(function(api){
                    api.brodb_clear(key);
                });
                db[key] = [];
            },
            onChange: function(cb){
                changeListeners[key] = changeListeners[key] || [];
                changeListeners[key].push(cb);
            }
        }
    }

    retval.subscribe = function(keys, sync, cb){
        keys.forEach(function(key){
           db[key] = db[key] || [];
        });
        expose.withServerApi(function(api){
            api.brodb_subscribe(keys, sync).onSuccess(function(serverDB){
                if (sync) {
                    keys.forEach(function(key){
                       db[key] = serverDB[key];
                    });
                    if (cb) cb();
                }
            });
        });
    };

    retval.keys = function(){
        var res = [];
        for (var k in db) {
            res.push(k);
        }
        return res;
    }

    expose.start();

    return retval;

})();



