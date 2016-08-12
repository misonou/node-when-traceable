/*globals when,QUnit,test,stop,start,expect,assert.ok,assert.strictEqual*/

var fs = require('fs');
var Promise = require('promise/setimmediate');
var EventEmitter = require('events').EventEmitter;

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

QUnit.module("when(callback)");

test("Fulfilled from Node.js callback", function (assert) {
    expect(1);
    stop();
    when(function (then) {
        fs.readFile(__filename, then());
    }).then(function (content) {
        start();
        assert.strictEqual(content.toString().substr(0, 9), "/*globals");
    }).catch(function () {
        start();  
    });
});

test("Rejected from Node.js callback", function (assert) {
    expect(1);
    stop();
    when(function (then) {
        fs.readFile(__filename + '/inexist/path', then());
    }).then(function () {
        start();  
    }).catch(function (err) {
        start();
        assert.ok(err.code === "ENOENT" || err.code === "ENOTDIR");
    });
});

test("Resolving routine", function (assert) {
    expect(4);
    stop();
    var err1 = new Error();
    when(function (then) {
        fs.readFile(__filename, then(function (content) {
            start();
            assert.strictEqual(content.toString().substr(0, 9), "/*globals", "Handler get correct argument");
            throw err1;
        }));
    }, function (err) {
        start();
        assert.strictEqual(err1, err, "Follow error handling routine on exception");
    });
    when(function (then) {
        fs.readFile(__filename, then(function () {
            return delay(function () {
                return true;
            });
        }));
    }).then(function (value) {
        start();
        assert.strictEqual(value, true, "Follow state of returned promise");
    }).catch(function () {
        start();  
    });
    when(function (then) {
        fs.readFile(__filename, then(function () {
            return true;
        }));
    }).then(function (value) {
        start();
        assert.strictEqual(value, true, "Fulfill with returned value");
    }).catch(function () {
        start();  
    });
});

test("Error handling routine", function (assert) {
    expect(5);
    stop();
    var err1 = new Error();
    when(function (then) {
        fs.readFile(__filename + '/inexist/path', then());
    }, function () {
    }).then(function () {
        start();  
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
    }).catch(function (err) {
        start();
        assert.strictEqual(err, err1, "Follow error handling routine after map function (default)");
    });
});

QUnit.module("when(value)");

test("Return fulfilled promise", function (assert) {
    expect(6);
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
    expect(1);
    stop();
    when(Promise.resolve(1), function (value) {
        start();
        assert.strictEqual(value, 1, "Argument is fulfilled value");
    });
});

test("Calling with onerror", function (assert) {
    expect(1);
    stop();
    var err = new Error();
    when(Promise.reject(err), null, function (e) {
        start();
        assert.strictEqual(e, err, "Argument is rejected reason");
    });
});

test("Calling without then, onerror, monitor", function (assert) {
    var promise = Promise.resolve();
    assert.strictEqual(when(promise), promise, "Return the same instance");
});

QUnit.module("when(Array<Promise>)");

test("Values mapped with index", function (assert) {
    expect(2);
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
    });
});

test("Reject if one of the promise rejects", function (assert) {
    expect(1);
    stop();
    when([
        delay(function () { return 1; }),
        delay(function () { throw new Error(); }),
    ]).then(function () {
        start();
    }).catch(function () {
        start();
        assert.ok(true);
    });
});

QUnit.module("when(Object<Promise>)");

test("Values mapped with keys", function (assert) {
    expect(1);
    stop();
    when({
        one: delay(function () { return 1; }),
        two: delay(function () { return 2; }),
    }).then(function (data) {
        start();
        assert.ok(data.one === 1 && data.two === 2);
    }).catch(function () {
        start();
    });
});

test("Reject if one of the promise rejects", function (assert) {
    expect(1);
    stop();
    when({
        one: delay(function () { return 1; }),
        two: delay(function () { throw new Error(); }),
    }).then(function () {
        start();
    }).catch(function () {
        start();
        assert.ok(true);
    });
});

QUnit.module("when(EventEmitter)");

test("Reject when error event is emitted", function () {
    expect(1);
    stop();
    var event = new EventEmitter();
    var err = new Error();
    when(event).catch(function (e) {
        start();
        assert.strictEqual(e, err);
    });
    delay(function () {
        event.emit('error', err);
    });
});

test("Fulfill when specified event is emitted", function (assert) {
    expect(1);
    stop();
    var event = new EventEmitter();
    when(event, 'done').then(function (value) {
        start();
        assert.strictEqual(value, 1);
    });
    delay(function () {
        event.emit('done', 1);
    });
});

test("Fulfill when any of specified events are emitted", function (assert) {
    expect(1);
    stop();
    var event = new EventEmitter();
    when(event, {
        done1: function (v) { return v; },
        done2: function (v) { return v; }
    }).then(function (value) {
        start();
        assert.ok(value === 1 || value === 2);
    });
    delay(function () {
        event.emit('done1', 1);
    });
    delay(function () {
        event.emit('done2', 2);
    });
});

QUnit.module("when(Array<Function>)");

test("Functions called in sequence", function (assert) {
    expect(1);
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
    }).catch(function (assert) {
        start();
    });
});

QUnit.module("when(Error)");

test("Return rejected promise with same reason", function (assert) {
    expect(1);
    stop();
    var err = new Error();
    when(err).then(function () {
        start();
    }).catch(function (e) {
        start();
        assert.strictEqual(e, err);
    });
});

QUnit.module("when.map");

test("Values mapped in sequence", function (assert) {
    expect(1);
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
    });;
});

QUnit.module("when.forEach");

test("Callback fired in sequence", function (assert) {
    expect(1);
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
    });;
});

QUnit.module("when.while");

test("Run callback until condition false", function (assert) {
    expect(1);
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
    });
});