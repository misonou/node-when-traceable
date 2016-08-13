/*globals when,QUnit,test,stop,start,expect,assert.ok,assert.strictEqual*/

var fs = require('fs');
var Promise = require('promise/setimmediate');
var EventEmitter = require('events').EventEmitter;
var err1 = new Error();

function delay(fn) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            try {
                resolve(fn());
            } catch (err) {
                reject(err);
            }
        }, Math.random() * 20);
    });
}

function nodeCallback(value, callback) {
    setTimeout(function () {
        if (value instanceof Error) {
            callback(value);
        } else {
            callback(null, value);
        }
    });
}

QUnit.module("when(callback)");

test("Fulfill from Node.js callback", function (assert) {
    //expect(1);
    stop();
    when(function (then) {
        nodeCallback(true, then());
    }).then(function (value) {
        start();
        assert.strictEqual(value, true);
    }).catch(function () {
        start();
        assert.ok(false);
    });
});

test("Reject from Node.js callback", function (assert) {
    //expect(1);
    stop();
    when(function (then) {
        nodeCallback(err1, then());
    }).then(function () {
        start();
        assert.ok(false);
    }).catch(function (err) {
        start();
        assert.strictEqual(err, err1);
    });
});

test("Resolving routine", function (assert) {
    //expect(5);
    stop();
    when(function (then) {
        nodeCallback(true, then(function () {
            start();
            throw err1;
        }));
    }, function (err) {
        start();
        assert.strictEqual(err1, err, "Call error handling routine when exception raised");
    });
    when(function (then) {
        nodeCallback(true, then(function () {
            start();
            return err1;
        }));
    }, function (err) {
        start();
        assert.strictEqual(err1, err, "Call error handling routine when error returned");
    });
    when(function (then) {
        nodeCallback(true, then(function () {
            return delay(function () {
                return false;
            });
        }));
    }).then(function (value) {
        start();
        assert.strictEqual(value, false, "Follow state of returned promise");
    }).catch(function () {
        start();
        assert.ok(false);
    });
    when(function (then) {
        nodeCallback(true, then(function () {
            return false;
        }));
    }).then(function (value) {
        start();
        assert.strictEqual(value, false, "Fulfill with returned value");
    }).catch(function () {
        start();
        assert.ok(false);
    });
});

test("Error handling routine", function (assert) {
    //expect(5);
    stop();
    var err1 = new Error();
    when(function (then) {
        fs.readFile(__filename + '/inexist/path', then());
    }, function () {
    }).then(function () {
        start();
        assert.ok(false);
    }).catch(function (err) {
        start();
        assert.ok(err.code === "ENOENT" || err.code === "ENOTDIR", "Reject with the same error");
    });
    when(function (then) {
        fs.readFile(__filename + '/inexist/path', then());
    }, function () {
        throw err1;
    }).then(function () {
        start();
        assert.ok(false);
    }).catch(function (err) {
        start();
        assert.strictEqual(err, err1, "Reject with exception thrown in error handler");
    });
    when(function (then) {
        fs.readFile(__filename + '/inexist/path', then());
    }, function () {
        return true;
    }).then(function (value) {
        start();
        assert.strictEqual(value, true, "Follow resolving routine with return value");
    }).catch(function () {
        start();
        assert.ok(false);
    });
    when(function (then) {
        fs.readFile(__filename + '/inexist/path', then());
    }, {
        ENOTDIR: function () {
            throw err1;
        },
        ENOENT: function () {
            throw err1;
        }
    }).then(function () {
        start();
        assert.ok(false);
    }).catch(function (err) {
        start();
        assert.strictEqual(err, err1, "Follow error handling routine after map function");
    });
    when(function (then) {
        fs.readFile(__filename + '/inexist/path', then());
    }, {
        default: function () {
            throw err1;
        }
    }).then(function () {
        start();
        assert.ok(false);
    }).catch(function (err) {
        start();
        assert.strictEqual(err, err1, "Follow error handling routine after map function (default)");
    });
    var retryCount = 0;
    function doSomething() {
        return when(function (then) {
            nodeCallback(err1, then());
        });
    }
    when(doSomething(), null, function () {
        if (++retryCount < 5) {
            return doSomething();
        }
    }).catch(function () {
        start();
        assert.strictEqual(retryCount, 5, "Error handler able to catch subsequent errors");
    });
});

QUnit.module("when(value)");

test("Return fulfilled promise", function (assert) {
    //expect(6);
    stop();
    var obj = {};
    when(obj).then(function (value) {
        start();
        assert.strictEqual(value, obj, "Object");
    });
    when(1).then(function (value) {
        start();
        assert.strictEqual(value, 1, "Number value");
    });
    when('').then(function (value) {
        start();
        assert.strictEqual(value, '', "String value");
    });
    when(false).then(function (value) {
        start();
        assert.strictEqual(value, false, "Boolean value");
    });
    when(undefined).then(function (value) {
        start();
        assert.strictEqual(value, undefined, "undefined");
    });
    when(null).then(function (value) {
        start();
        assert.strictEqual(value, null, "null");
    });
});

QUnit.module("when(Promise)");

test("Calling with then", function (assert) {
    stop();
    when(Promise.resolve(1), function (value) {
        start();
        assert.strictEqual(value, 1, "Argument is fulfilled value");
    }, function () {
        start();
        assert.ok(false);
    });
});

test("Calling with onerror", function (assert) {
    stop();
    when(Promise.reject(err1), function () {
        start();
        assert.ok(false);
    }, function (err) {
        start();
        assert.strictEqual(err, err1, "Argument is rejected reason");
    });
});

test("Calling without then, onerror, monitor", function (assert) {
    var promise = Promise.resolve();
    assert.strictEqual(when(promise), promise, "Return the same instance");
});

QUnit.module("when(Array<Promise>)");

test("Values mapped with index", function (assert) {
    stop();
    when([
        delay(function () { }),
        delay(function () { return 1; }),
        delay(function () { return 2; }),
    ]).then(function (data) {
        start();
        assert.strictEqual(data.length, 3, "Length matches source array");
        assert.ok(data[0] === undefined && data[1] === 1 && data[2] === 2, "Undefined is kept in position");
    }).catch(function () {
        start();
        assert.ok(false);
    });
});

test("Reject if one of the promise rejects", function (assert) {
    stop();
    when([
        delay(function () { return 1; }),
        delay(function () { throw new Error(); }),
    ]).then(function () {
        start();
        assert.ok(false);
    }).catch(function () {
        start();
        assert.ok(true);
    });
});

QUnit.module("when(Object<Promise>)");

test("Values mapped with keys", function (assert) {
    stop();
    when({
        one: delay(function () { return 1; }),
        two: delay(function () { return 2; }),
    }).then(function (data) {
        start();
        assert.ok(data.one === 1 && data.two === 2);
    }).catch(function () {
        start();
        assert.ok(false);
    });
});

test("Reject if one of the promise rejects", function (assert) {
    stop();
    when({
        one: delay(function () { return 1; }),
        two: delay(function () { throw new Error(); }),
    }).then(function () {
        start();
        assert.ok(false);
    }).catch(function () {
        start();
        assert.ok(true);
    });
});

QUnit.module("when(EventEmitter)");

test("Reject when error event is emitted", function (assert) {
    //expect(1);
    stop();
    var event = new EventEmitter();
    var err = new Error();
    when(event).then(function () {
        start();
        assert.ok(false);
    }).catch(function (e) {
        start();
        assert.strictEqual(e, err);
    });
    setTimeout(function () {
        event.emit('error', err);
    });
});

test("Fulfill when specified event is emitted", function (assert) {
    stop();
    var event = new EventEmitter();
    when(event, 'done').then(function (value) {
        start();
        assert.strictEqual(value, 1);
    }).catch(function () {
        start();
        assert.ok(false);
    });
    setTimeout(function () {
        event.emit('done', 1);
    });
});

test("Fulfill when any of specified events are emitted", function (assert) {
    stop();
    var event = new EventEmitter();
    when(event, {
        done1: function (v) { return v; },
        done2: function (v) { return v; }
    }).then(function (value) {
        start();
        assert.strictEqual(value, 1);
    }).catch(function () {
        start();
        assert.ok(false);
    });
    setTimeout(function () {
        event.emit('done1', 1);
    });
    setTimeout(function () {
        event.emit('done2', 2);
    });
});

QUnit.module("when(Array<Function>)");

test("Functions called in sequence", function (assert) {
    stop();
    var dst = [];
    when([
        function () { delay(function () { dst.push(1); }); },
        function () { delay(function () { dst.push(2); }); },
        function () { delay(function () { dst.push(3); }); }
    ]).then(function () {
        start();
        assert.ok(dst.every(function (v, i) {
            return v === i + 1;
        }));
    }).catch(function () {
        start();
        assert.ok(false);
    });
});

QUnit.module("when(Error)");

test("Return rejected promise with same reason", function (assert) {
    stop();
    when(err1).then(function () {
        start();
        assert.ok(false);
    }).catch(function (err) {
        start();
        assert.strictEqual(err, err1);
    });
});

QUnit.module("when.map");

test("Values mapped in sequence", function (assert) {
    stop();
    var src = [1, 2, 3];
    when.map(src, function (value) {
        return delay(function () {
            return value * 10;
        });
    }).then(function (dst) {
        start();
        assert.ok(dst.every(function (v, i) {
            return v === src[i] * 10;
        }));
    }).catch(function () {
        start();
        assert.ok(false);
    });
});

test("Result array is flattened", function (assert) {
    stop();
    var src = [1, 2, 3];
    when.map(src, function (value) {
        return [when(value), when([value, value])];
    }).then(function (dst) {
        start();
        assert.strictEqual(dst.length, 9);
    }).catch(function () {
        start();
        assert.ok(false);
    });
});

QUnit.module("when.forEach");

test("Callback fired in sequence", function (assert) {
    stop();
    var src = [{}, {}, {}];
    var dst = [];
    when.forEach(src, function (value) {
        return delay(function () {
            dst.push(value);
        });
    }).then(function () {
        start();
        assert.ok(dst.every(function (v, i) {
            return v === src[i];
        }));
    }).catch(function () {
        start();
        assert.ok(false);
    });
});

QUnit.module("when.while");

test("Run callback until condition false", function (assert) {
    stop();
    var count = 9;
    var str = '';
    when.while(function () {
        return delay(function () {
            str += count;
            return --count > 0 ? count : false;
        });
    }).then(function () {
        start();
        assert.strictEqual(str, '987654321');
    }).catch(function () {
        start();
        assert.ok(false);
    });
});

/*
QUnit.module('when.monitor');

test("Uncaught exception event", function (assert) {
    stop();
    when([
        delay(function () { throw err1; }),
        delay(function () { throw err1; }),
    ]);
    when.once('uncaughtException', function (err) {
        start();
        assert.strictEqual(err, err1, "Without monitor");
    });
    when.monitor(function () {
        return when([
            delay(function () { throw err1; }),
            delay(function () { throw err1; }),
        ]);
    }).once('uncaughtException', function (err) {
        start();
        assert.strictEqual(err, err1, "With monitor");
    });
});
*/