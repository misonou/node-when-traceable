'use strict';

var EventEmitter = require('events').EventEmitter;
var traceable = require('traceable');
var Promise = require('promise');
var TimeoutListener = require('./timeout-listener');

var monitorOptions = null;

function PromiseMonitor(promise, options, interceptor, reject) {
    this.id = options.id + '/' + (++options.promiseCount);
    this.options = options;
    this.promise = emittify(promise);
    this.interceptor = interceptor || null;

    if (reject && options.rejectOnTimeout) {
        promise.once('timeout', reject);
    }
}

PromiseMonitor.prototype.listen = function (promise, errorHandler, interceptor) {
    var self = this;
    var other = getPromiseMonitor(promise, self.options, interceptor || self.interceptor);
    this.ifPending(function () {
        if (self.options.timeout) {
            self._timeout = self._timeout || new TimeoutListener(self, self.options.timeout);
            other._timeout = other._timeout || new TimeoutListener(other, self.options.timeout);
            self._timeout.listen(other._timeout);
            self._timeout.once('timeout', function (err) {
                self.promise.emit('timeout', err);
            });
        }
    });
    promise.on('uncaughtException', function (err) {
        self.promise.emit('uncaughtException', err);
    });
};
PromiseMonitor.prototype.ifPending = function (callback) {
    var pending = true;
    always(this.promise, function () {
        pending = false;
    });
    process.nextTick(function () {
        if (pending) {
            callback();
        }
    });
};

function emittify(obj) {
    if (typeof obj.emit !== 'function') {
        EventEmitter.call(obj);
        each(EventEmitter.prototype, function (i, v) {
            if (i !== 'constructor') {
                obj[i] = v;
            }
        });
    }
    return obj;
}

function fastargs() {
    var length = arguments.length;
    var arr = new Array(length);
    for (var i = 0; i < length; i++) {
        arr[i] = arguments[i];
    }
    return arr;
}

function each(obj, callback) {
    var i, len;
    if (Array.isArray(obj)) {
        for (i = 0, len = obj.length; i < len; i++) {
            callback(i, obj[i]);
        }
    } else if (obj && typeof obj === 'object') {
        var arr = Object.getOwnPropertyNames(obj);
        for (i = 0, len = arr.length; i < len; i++) {
            callback(arr[i], obj[arr[i]]);
        }
    }
}

function flatten(src) {
    var dst = [];
    for (var i = 0, len = src.length; i < len; i++) {
        if (Array.isArray(src[i])) {
            for (var j = 0, src2 = src[i], len2 = src2.length; j < len2; j++) {
                if (src2[j] !== undefined && src2[j] !== null) {
                    dst[dst.length] = src2[j];
                }
            }
        } else if (src[i] !== undefined && src[i] !== null) {
            dst[dst.length] = src[i];
        }
    }
    return dst;
}

function isThenable(obj) {
    return obj && typeof obj.then === 'function';
}

function isArrayOfThenable(obj) {
    if (Array.isArray(obj)) {
        return isThenable(obj[0]);
    }
    if (obj) {
        for (var i in obj) {
            return isThenable(obj[i]);
        }
    }
}

function getPromiseMonitor(obj, options, interceptor) {
    var promise = obj;
    if (typeof promise.promise === 'function') {
        promise = promise.promise();
    }
    if (!promise._when) {
        Object.defineProperty(promise, '_when', {
            value: {}
        });
    }
    var key = '_monitor' + options.id;
    if (!promise._when[key]) {
        promise._when[key] = new PromiseMonitor(promise, options, interceptor, obj.reject);
    }
    return promise._when[key];
}

function always(promise, callback) {
    promise.then(callback, callback);
}

function defer() {
    var state = 'pending';
    var resolve, reject;
    var promise = new Promise(function (_resolve, _reject) {
        resolve = function () {
            state = 'resolved';
            _resolve.apply(this, arguments);
        };
        reject = function () {
            state = 'rejected';
            _reject.apply(this, arguments);
        };
    });
    var deferred = {
        resolve: resolve,
        reject: reject,
        state: function () {
            return state;
        },
        promise: function () {
            return promise;
        }
    };
    if (monitorOptions) {
        getPromiseMonitor(deferred, monitorOptions, traceable.prepAsyncStack(3));
    }
    return deferred;
}

function unhandledException(promise, err) {
    if (typeof promise.emit === 'function' && promise.listeners('uncaughtException').length) {
        promise.emit('uncaughtException', err);
    } else {
        when.emit('uncaughtException', err);
    }
}

function reject(deferred, err, errorHandler, interceptor) {
    if (deferred.state() !== 'pending') {
        return unhandledException(deferred.promise());
    }
    if (errorHandler) {
        if (typeof errorHandler !== 'function') {
            errorHandler = errorHandler[err.code || err] || errorHandler.default || errorHandler;
        }
        if (typeof errorHandler === 'string') {
            var nerr = new Error(err.message);
            Object.getOwnPropertyNames(err).forEach(function (prop) {
                nerr[prop] = err[prop];
            });
            err = nerr;
            err.code = errorHandler;
            err.name = errorHandler;
        } else if (typeof errorHandler === 'function') {
            var wrapperHandler = function () {
                try {
                    return errorHandler.apply(this, arguments);
                } catch (err) {
                    // avoid sychronous exception calling the same error handler
                    reject(deferred, err, null, interceptor);
                }
            };
            if (resolveWithCallback(deferred, wrapperHandler, [err], null, arguments[2], interceptor)) {
                return;
            }
        }
    }
    if (interceptor) {
        interceptor(err);
    }
    deferred.reject(err);
}

function resolveWithCallback(deferred, then, args, thisArg, errorHandler, interceptor, alwaysResolve) {
    try {
        var value = then.apply(thisArg, args);
        if (value !== undefined || alwaysResolve) {
            watch(deferred, value, null, errorHandler, interceptor);
            return true;
        }
    } catch (err) {
        reject(deferred, err, errorHandler, interceptor);
        return true;
    }
}

function resolve(deferred, then, args, thisArg, errorHandler, interceptor) {
    if (typeof then === 'function') {
        resolveWithCallback(deferred, then, args, thisArg, errorHandler, interceptor, true);
    } else if (isThenable(then)) {
        watch(deferred, then, null, errorHandler, interceptor);
    } else if (then !== undefined && then !== null) {
        deferred.resolve(then);
    } else {
        deferred.resolve.apply(deferred, args);
    }
}

function attachMonitor(obj, promise, errorHandler, interceptor) {
    each(obj._when, function (i, v) {
        v.listen(promise, errorHandler, interceptor);
    });
}

function watch(deferred, promise, then, errorHandler, interceptor) {
    if (deferred.state() === 'pending') {
        if (promise instanceof Error) {
            return reject(deferred, promise, errorHandler, interceptor);
        }
        if (!promise || !isThenable(promise)) {
            return deferred.resolve(promise);
        }
        interceptor = interceptor || traceable.prepAsyncStack(3);
        promise.then(function () {
            var args = fastargs.apply(null, arguments);
            resolve(deferred, then, args, this, errorHandler, interceptor, true);
        }, function (err) {
            reject(deferred, err, errorHandler, interceptor);
        });
        attachMonitor(deferred.promise(), promise, errorHandler, interceptor);
    }
}

function when(source, then, errorHandler) {
    var deferred = defer();
    var promise = deferred.promise();
    if (source !== null && source !== undefined) {
        if (typeof source === 'function') {
            errorHandler = then;
            resolveWithCallback(deferred, source, [function (callback) {
                var interceptor = traceable.prepAsyncStack(2);
                var hasArg = arguments.length > 0;
                return function () {
                    var args = fastargs.apply(null, arguments);
                    var err = args.shift();
                    if (err) {
                        reject(deferred, err, errorHandler, interceptor);
                    } else if (typeof callback === 'function') {
                        resolveWithCallback(deferred, callback, args, this, errorHandler, interceptor);
                    } else {
                        watch(deferred, hasArg ? callback : args[0], null, errorHandler, interceptor);
                    }
                };
            }], null, errorHandler);
            return promise;
        }
        if (source instanceof Error) {
            return deferred.reject(source), promise;
        }
        if (source instanceof EventEmitter) {
            if (typeof then === 'string') {
                var event = then;
                then = {};
                then[event] = errorHandler || function (v) {
                    return v;
                };
                errorHandler = arguments.length >= 4 ? arguments[3] : null;
            }
            var interceptor = traceable.prepAsyncStack(2);
            var listeners = {};
            listeners.error = function (err) {
                reject(deferred, err, errorHandler, interceptor);
            };
            each(then, function (i, v) {
                listeners[i] = function () {
                    resolveWithCallback(deferred, v, fastargs.apply(null, arguments), source, errorHandler, interceptor);
                };
            });
            each(listeners, source.on.bind(source));
            always(promise, function () {
                each(listeners, source.removeListener.bind(source));
            });
            return promise;
        }
        if (isThenable(source)) {
            if (then || errorHandler || monitorOptions) {
                return watch(deferred, source, then, errorHandler), promise;
            }
            return source;
        }
        if (isArrayOfThenable(source)) {
            var master = defer();
            var result = Array.isArray(source) ? new Array(source.length) : {};
            var count = 0;
            var error;
            each(source, function (i, v) {
                attachMonitor(master.promise(), v, errorHandler);
                v.then(function (obj) {
                    result[i] = obj;
                }, function (err) {
                    error = error || err;
                    result[i] = err;
                });
                always(v, function () {
                    if (--count === 0) {
                        if (error) {
                            master.reject(error);
                            each(result, function (i, v) {
                                if (v instanceof Error && v !== error) {
                                    unhandledException(promise, v);
                                }
                            });
                        } else {
                            master.resolve(result);
                        }
                    }
                });
                count++;
            });
            return watch(deferred, master.promise(), then, errorHandler), promise;
        }
        if (Array.isArray(source) && typeof source[0] === 'function') {
            return when.forEach(source, function (fn) {
                return fn();
            }, then, errorHandler);
        }
    }
    return resolve(deferred, then, [source], null, errorHandler, null, true), promise;
}

when.monitor = function (options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    if (typeof callback !== 'function') {
        throw new TypeError('The second argument must be a function.');
    }
    var previousOptions = monitorOptions;
    try {
        monitorOptions = Object.assign({
            id: Math.random().toString(36).substr(2, 6),
            promiseCount: 0
        }, options);
        return when(callback());
    } catch (err) {
        return when(err);
    } finally {
        monitorOptions = previousOptions;
    }
};

when.map = function (arr, fn, then, errorHandler) {
    if (!Array.isArray(arr)) {
        throw new TypeError('The first argument must be an Array.');
    }
    if (typeof fn !== 'function') {
        throw new TypeError('The second argument must be a function.');
    }
    var i, len, promise = [];
    for (i = 0, len = arr.length; i < len; i++) {
        promise[promise.length] = fn(arr[i], i);
    }
    promise = flatten(promise);
    for (i = 0, len = promise.length; i < len; i++) {
        promise[i] = when(promise[i]);
    }
    return when(when(promise, flatten), then, errorHandler);
};

when.while = function (fn, then, errorHandler) {
    if (typeof fn !== 'function') {
        throw new TypeError('The first argument must be a function.');
    }
    return (function next(value) {
        return when(fn(value), function (value) {
            return value !== false ? next(value) : when(undefined, then, errorHandler);
        });
    } ());
};

when.forEach = function (arr, fn, then, errorHandler) {
    if (!Array.isArray(arr)) {
        throw new TypeError('The first argument must be an Array.');
    }
    if (typeof fn !== 'function') {
        throw new TypeError('The second argument must be a function.');
    }
    arr = arr.slice(0);
    var index = 0;
    var promise = when(when.while(function () {
        if (index >= arr.length) {
            return false;
        }
        return when(function () {
            return fn(arr[index++]), true;
        }, function (err) {
            return unhandledException(promise, err), true;
        });
    }), then, errorHandler);
    return promise;
};

module.exports = emittify(when);
