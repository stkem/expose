exports.create = function () {

    var routes = [];

    function httpHook(req, res, next) {
        var route, matches;
        for (var i=0; i<routes.length; i++) {
            route = routes[i];
            if (route.method === 'ANY' || route.method === req.method) {
                if (route.pattern instanceof RegExp) {
                    matches = route.pattern.test(req.url.pathname);
                } else {
                    matches = route.pattern === req.url.pathname;
                }
                if (matches) {
                    if (route.type === 'direct') {
                        return route.target(req, res);
                    } else if (route.type === 'alias') {
                        req.url.pathname = route.target;
                    }
                }
            }
        }
        next();
    }

    function createHandlerCreator(method) {
        var handlerCreator = function (pattern, handler) {
            if (typeof pattern != 'string' && !(pattern instanceof RegExp)) {
                throw "Pattern needs to be RegExp or String!";
            }
            if (typeof handler != 'function') {
                throw 'Handler needs to be a function!';
            }
            routes.push({
                method  : method,
                pattern : pattern,
                type    : 'direct',
                target  : handler
            });
        };
        handlerCreator.alias = function(pattern, target) {
            if (typeof pattern != 'string' && !(pattern instanceof RegExp)) {
                throw 'Pattern needs to be RegExp or String!';
            }
            if (typeof target != 'string') {
                throw 'Alias target needs to be a string!';
            }
            routes.push({
                method  : method,
                pattern : pattern,
                type    : 'alias',
                target  : target
            });
        };
        return handlerCreator;
    }


    var api = {
        get     : createHandlerCreator('GET'),
        post    : createHandlerCreator('POST'),
        put     : createHandlerCreator('PUT'),
        delete  : createHandlerCreator('DELETE'),
        options : createHandlerCreator('OPTIONS'),
        head    : createHandlerCreator('HEAD'),
        any     : createHandlerCreator('ANY')
    }


    return {
        name: 'routes',
        init: function(){
            return api;
        },
        httpHook: httpHook
    }
}

