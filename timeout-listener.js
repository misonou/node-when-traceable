'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');

function error(code, message) {
    var err = new Error(message);
    err.code = code;
    err.name = code;
    return err;
}

function resetTimeout(self, t) {
    if (!self.isStopped) {
        t = t || (+new Date() + self.milliseconds);
        clearTimeout(self._handle);
        self._time = t;
        self._handle = setTimeout(function () {
            ontimeout(self);
        }, t - new Date()).unref();
    }
}

function ontimeout(self, err, source) {
    if (!self.isStopped) {
        err = err || self.interceptor(error('ETIMEOUT', 'Operation timeout'));
        self.isTimeout = true;
        self.isStopped = true;
        clearTimeout(self._handle);
        self.removeAllListeners('elapsed');
        self.emit('timeout', err, source || self);
        self.emit('stop', self);
    }
}

function TimeoutListener(monitor, milliseconds) {
    var self = this;
    EventEmitter.call(self);
    self.startTime = +new Date();
    self.milliseconds = milliseconds;
    self.interceptor = monitor.interceptor;
    self.targets = [];
    resetTimeout(self);
    monitor.promise.then(function () {
        self.stop();
    }).catch(function () {
        self.stop();
    });
}
util.inherits(TimeoutListener, EventEmitter);

TimeoutListener.prototype.isStopped = false;
TimeoutListener.prototype.isTimeout = false;
TimeoutListener.prototype.listen = function (other) {
    var self = this;
    var elapsed = new Date() - self.startTime;
    if (!self.isStopped && !other.isStopped) {
        clearTimeout(self._handle);
        self.targets.push(other);
        other.once('timeout', function (err, source) {
            ontimeout(self, err, source);
        });
        other.once('stop', function () {
            self.targets.splice(self.targets.indexOf(other), 1);
            if (self.targets.length === 0 && !self.isStopped) {
                resetTimeout(self, self._time + elapsed);
            }
        });
    }
};
TimeoutListener.prototype.stop = function () {
    if (!this.isStopped) {
        this.isStopped = true;
        clearTimeout(this._handle);
        this.removeAllListeners('timeout');
        this.emit('elapsed', new Date() - this.startTime);
        this.emit('stop', this);
    }
};
TimeoutListener.prototype.addListener = function (eventType, callback) {
    if (this.isStopped) {
        var isElapsedEvent = (eventType === 'elapsed') || undefined;
        if (this.isTimeout ^ isElapsedEvent) {
            callback.call(this, isElapsedEvent && 0);
        }
    } else {
        EventEmitter.prototype.addListener.call(this, eventType, callback);
    }
};
TimeoutListener.prototype.on = function (eventType, callback) {
    this.addListener(eventType, callback);
};

module.exports = TimeoutListener;
