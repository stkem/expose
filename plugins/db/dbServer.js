//usage server expose.db([namespace = "std"], key)
//usage client expose.db.subscribe([[namespace = "std"], Array(keys), [sync], function(k1, k2, k3, etc.) {})
//on a key k: k.get([idx]), k.set([idx], value), k.pop(), k.shift(), k.push(value), k.unshift(value), k.getAll(), k.setAll(value)


exports.create = function(opts) {

    opts = opts || {};

    var defaultConfig = {
        createNamespaceOnSubscribe: (opts.createNamespaceOnSubscribe!=null)?opts.createNamespaceOnSubscribe:false,
        createKeyOnSubscribe: (opts.createKeyOnSubscribe!=null)?opts.createKeyOnSubscribe:true,
        clientReadOnly: (opts.clientReadOnly!=null)?opts.clientReadOnly:false
    }

    var db = {};
    var namespaceConfigs = {};
    var listeners= {};

    var withInternalApi;


    function notifyListeners(excludeId, namespace, key, operation, value, idx) {
        var relevantListeners = listeners[namespace + "::" + key] || [];
        relevantListeners.forEach(function(clientId){
            if (clientId !== excludeId) {
                withInternalApi(clientId, function(api){
                    api[operation](namespace, key, value, idx)
                });
            }
        });
    }


    function getNamespace(namespace, createIfNotExists) {
        var ns = db[namespace];
        if (ns != null) {
            return ns;
        } else if (createIfNotExists) {
            db[namespace] = {};
            return db[namespace];
        } else {
            throw 'Invalid Namespace: ' + namespace;
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

    function pop(namespace, key) {
        var ns = getNamespace(namespace);
        var keyData = ns[key];
        if (key != null) {
            var ret = keyData.pop();
            notifyListeners(this.id, namespace, key, 'pop');
            return ret;
        }
    }

    function shift(namespace, key) {
        var ns = getNamespace(namespace);
        var keyData = ns[key];
        if (key != null) {
            var ret = keyData.shift();
            notifyListeners(this.id, namespace, key, 'shift');
            return ret;
        }
    }


    function set(namespace, key, idx, value, createNamespace, createKey) {
        var ns = getNamespace(namespace, createNamespace);
        if (ns[key] != null) {
            ns[key][idx] = value;
            notifyListeners(this.id, namespace, key, "set", value, idx);
        } else if (createKey) {
            ns[key] = [];
            return set(namespace, key, idx, value);
        } else {
            throw 'Invalid Key: ' + namespace + '::' + key;
        }
    }

    function push(namespace, key, value, createNamespace, createKey) {
        var ns = getNamespace(namespace, createNamespace);
        if (ns[key] != null) {
            ns[key].push(value);
            notifyListeners(this.id, namespace, key, "push", value);
        } else if (createKey) {
            ns[key] = [];
            return push(namespace, key, value);
        } else {
            throw 'Invalid Key: ' + namespace + '::' + key;
        }
    }

    function unshift(namespace, key, value, createNamespace, createKey) {
        var ns = getNamespace(namespace, createNamespace);
        if (ns[key] != null) {
            ns[key].unshift(value);
            notifyListeners(this.id, namespace, key, "unshift", value);
        } else if (createKey) {
            ns[key] = [];
            return unshift(namespace, key, value);
        } else {
            throw 'Invalid Key: ' + namespace + '::' + key;
        }
    }

    function setAll(namespace, key, value, createNamespace, createKey) {
        var ns = getNamespace(namespace, createNamespace);
        if (ns[key] != null) {
            if (!(value instanceof Array)) {
                value = [value];
            }
            ns[key] = value;
            notifyListeners(this.id, namespace, key, "setAll", value);
        } else if (createKey) {
            ns[key] = [];
            return setAll(namespace, key, value);
        } else {
            throw 'Invalid Key: ' + namespace + '::' + key;
        }
    }



    function subscribe(namespace, keys, sync) {
        var ns = getNamespace(namespace, defaultConfig.createNamespaceOnSubscribe);
        var client = this;
        var config = namespaceConfigs[namespace] || defaultConfig;
        var createKeyOnSubscribe = config.createKeyOnSubscribe;
        if (createKeyOnSubscribe === undefined) {
            createKeyOnSubscribe = defaultConfig.createKeyOnSubscribe;
        }
        keys.forEach(function(key){
            var data = ns[key];
            if (data === undefined) {
                if (createKeyOnSubscribe) {
                    ns[key] = [];
                } else {
                    throw "Invalid Key " + namespace + "::" + key;
                }
            }
        });

        keys.forEach(function(key){
            var nkey = namespace + "::" +  key;
            var keyListeners = listeners[nkey] || [];
            if  (keyListeners.indexOf(client.id) < 0){
                keyListeners.push(client.id);
            }
            listeners[nkey] = keyListeners;
        });
        if (sync) {
            var subDB = {};
            keys.forEach(function(key){
                subDB[key] = ns[key];
            });
            return subDB;
        }
    }

    function unsubscribe() {
        var clientId = this.id;
        var newListeners = {};
        for (nkey in listeners) {
            newListeners[nkey] = listeners[nkey].filter(function(cId){
                return cId !== clientId;
            })
        }
        listeners = newListeners;
    }


    function ensureWritable(namespace, key) {
        var config = namespaceConfigs[namespace] || defaultConfig;
        var clientReadOnly = config.clientReadOnly;
        if (clientReadOnly === undefined) {
            clientReadOnly = defaultConfig.clientReadOnly;
        }
        if (clientReadOnly) {
            throw "Namespace is read only: " + namespace;
        }
    }

    var internalApi = {
        pop: function(namespace, key) {
            ensureWritable(namespace, key);
            return pop.call(this, namespace, key);
        },
        shift: function(namespace, key) {
            ensureWritable(namespace, key);
            return shift.call(this, namespace, key);
        },
        set: function(namespace, key, value, idx) {
            ensureWritable(namespace, key);
            return set.call(this, namespace, key, idx, value, false, false);
        },
        push: function(namespace, key, value) {
            ensureWritable(namespace, key);
            return push.call(this, namespace, key, value, false, false);
        },
        unshift: function(namespace, key, value) {
            ensureWritable(namespace, key);
            return unshift.call(this, namespace, key, value, false, false);
        },
        setAll: function(namespace, key, value) {
            ensureWritable(namespace, key);
            return setAll.call(this, namespace, key, value, false, false);
        },
        subscribe: subscribe,
        unsubscribe: unsubscribe
    }

    var publicApi = function(namespace, key){
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
                    return set(namespace, key, idx, value, true, true);
                } else {
                    return set(namespace, key, idx, value, true, true);
                }
            },
            push    : function(value) {
                return push(namespace, key, value, true, true);
            },
            unshift : function(value) {
                return unshift(namespace, key, value, true, true);
            },
            setAll  : function(value) {
                return setAll(namespace, key, value, true, true);
            },
            pop     : function() {
                return pop(namespace, key);
            },
            shift   : function() {
                return shift(namespace, key);
            },
            getAll  : function() {
                return getAll(namespace, key);
            }
        };
    }
    publicApi.createNamespace =  function(name, config) {
        name = name || 'std';
        getNamespace(name, true);
        namespaceConfigs[name] = config;
    }
    publicApi.createKey = function(namespace, key) {
        if (key === undefined) {
            key = namespace;
            namespace = 'std';
        }
        var ns = getNamespace(namespace, true);
        if (ns[key] === undefined) {
            ns[key] = [];
        }
    }
    publicApi.namespaces = function() {
        var list = [];
        for (var ns in db) {
            list.push(ns);
        }
        return list;
    }
    publicApi.keys = function(namespace) {
        if (namespace === undefined) {
            namespace = 'std';
        }
        var list = [];
        for (var key in db[namespace]){
            list.push(key);
        }
        return list;
    }

    return {
        name: 'db',
        init: function(_withInternalApi) {
            withInternalApi = _withInternalApi;
            return publicApi;
        },
        onDisconnect: function(client) {
            unsubscribe.call(client);
        },
        internalApi: internalApi,
        clientJs: require("./dbClient.js").getSource

    }
}













