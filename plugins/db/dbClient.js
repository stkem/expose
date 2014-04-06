(function (){

    function create() {

        var db = {};

        var withInternalApi;

        var changeListeners = {};

        function notifyChangeListeners(namespace, key) {
            var nkey = namespace + "::" + key;
            (changeListeners[nkey] || []).forEach(function(cb){
               cb();
            });
        }

        function notifyServer(namespace, key, operation, value, idx) {
            withInternalApi("_server", function(api){
                api[operation](namespace, key, value, idx)
            });
        }


        function getNamespace(namespace) {
            var ns = db[namespace];
            if (ns != null) {
                return ns;
            } else  {
                db[namespace] = {};
                return db[namespace];
            }
        }

        function get(namespace, key, idx) {
            var ns = getNamespace(namespace);
            return (ns[key] || [])[idx];
        }

        function getAll(namespace, key) {
            var ns = getNamespace(namespace);
            return ns[key];
        }


        function pop(namespace, key, notify) {
            var ns = getNamespace(namespace);
            var keyData = ns[key];
            if (key != null) {
                var ret = keyData.pop();
                notifyChangeListeners(namespace, key);
                if (notify) notifyServer(namespace, key, 'pop');
                return ret;
            }
        }

        function shift(namespace, key, notify) {
            var ns = getNamespace(namespace);
            var keyData = ns[key];
            if (key != null) {
                var ret = keyData.shift();
                notifyChangeListeners(namespace, key);
                if (notify) notifyServer(namespace, key, 'shift');
                return ret;
            }
        }

        function set(namespace, key, idx, value, notify) {
            var ns = getNamespace(namespace);
            if (ns[key] != null) {
                ns[key][idx] = value;
                notifyChangeListeners(namespace, key);
                if (notify) notifyServer(namespace, key, "set", value, idx);
            } else {
                ns[key] = [];
                return set(namespace, key, idx, value);
            }
        }

        function push(namespace, key, value, notify) {
            var ns = getNamespace(namespace);
            if (ns[key] != null) {
                ns[key].push(value);
                notifyChangeListeners(namespace, key);
                if (notify) notifyServer(namespace, key, "push", value);
            } else {
                ns[key] = [];
                return push(namespace, key, value);
            }
        }

        function unshift(namespace, key, value, notify) {
            var ns = getNamespace(namespace);
            if (ns[key] != null) {
                ns[key].unshift(value);
                notifyChangeListeners(namespace, key);
                if (notify) notifyServer(namespace, key, "unshift", value);
            } else {
                ns[key] = [];
                return unshift(namespace, key, value);
            }
        }

        function setAll(namespace, key, value, notify) {
            var ns = getNamespace(namespace);
            if (ns[key] != null) {
                if (!(value instanceof Array)) {
                    value = [value];
                }
                ns[key] = value;
                notifyChangeListeners(namespace, key);
                if (notify) notifyServer(namespace, key, "setAll", value);
            } else {
                ns[key] = [];
                return setAll(namespace, key, value);
            }
        }

        function onChange(namespace, key, cb) {
            var nkey = namespace + "::" + key;
            changeListeners[nkey] = changeListeners[nkey] || [];
            changeListeners[nkey].push(cb);
        }



        var internalApi = {
            pop: function(namespace, key) {
                return pop(namespace, key);
            },
            shift: function(namespace, key) {
                return shift(namespace, key);
            },
            set: function(namespace, key, value, idx) {
                return set(namespace, key, idx, value);
            },
            push: function(namespace, key, value) {
                return push(namespace, key, value);
            },
            unshift: function(namespace, key, value) {
                return push(namespace, key, value);
            },
            setAll: function(namespace, key, value) {
                return setAll(namespace, key, value);
            }
        }


        function Key(namespace, key){
            if (key === undefined) {
                key = namespace;
                namespace = 'std';
            }

            return {
                get     : function(idx) {
                    if (idx != null) {
                        return get(namespace, key, idx);
                    } else {
                        return get(namespace, key, 0);
                    }
                },
                set     : function(idx, value) {
                    if (value === undefined) {
                        value = idx;
                        idx = 0;
                        return set(namespace, key, idx, value, true);
                    } else {
                        return set(namespace, key, idx, value, true);
                    }
                },
                push    : function(value) {
                    return push(namespace, key, value, true);
                },
                unshift : function(value) {
                    return unshift(namespace, key, value, true);
                },
                setAll  : function(value) {
                    return setAll(namespace, key, value, true);
                },
                pop     : function() {
                    return pop(namespace, key, true);
                },
                shift   : function() {
                    return shift(namespace, key, true);
                },
                getAll  : function() {
                    return getAll(namespace, key);
                },
                onChange : function(cb) {
                    onChange(namespace, key, cb);
                }
            };
        }



        var publicApi = {
            subscribe: function (namespace, keys, cb) {
                if (cb === undefined) {
                    cb = keys;
                    keys = namespace;
                    namespace = 'std';
                }
                db[namespace] = db[namespace] || {};
                withInternalApi("_server", function(api){
                    var p = api.subscribe(namespace, keys, true);
                    p.then(function(subDB){
                        for (var k in subDB) {
                            db[namespace][k] = subDB[k];
                        }
                        var keyObjs = [];
                        keys.forEach(function(key){
                           keyObjs.push(Key(namespace, key));
                        });
                        cb.apply(null, keyObjs);
                    });
                });
            }
        }




        return {
            name: 'db',
            init: function(_withInternalApi) {
                withInternalApi = _withInternalApi;
                return publicApi;
            },
            internalApi: internalApi
        }
    }


    if (typeof window != 'undefined') {
        window.__exposePlugins = window.__exposePlugins || [];
        window.__exposePlugins.push(create);
    } else {
        var fs = require('fs');
        var path = require('path');
        var source = fs.readFileSync(path.resolve(__dirname, __filename));
        exports.create = create;
        exports.getSource = function(){
            return source;
        }
    }

})();