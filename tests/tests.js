/*globals describe,it */

var assert = require('assert');
var when = require('../when');
var Promise = require('promise/setimmediate');
var EventEmitter = require('events').EventEmitter;

var error = new Error();
error.code = 'ERROR';
var anotherError = new Error();
anotherError.code = 'ANOTHER_ERROR';

var shouldBeFulfilled = new Error('Returned promise object should be fulfilled but now rejected.');
var shouldBeRejected = new Error('Returned promise object should be rejected but now fulfilled.');

function delay(value) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            if (value instanceof Error) {
                reject(value);
            } else {
                resolve(value);
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

function assertNoThrow(done, fn) {
    try {
        fn.apply(assert, Array.prototype.slice.call(arguments, 2));
    } catch (err) {
        done(err);
    }
}

describe('when', function () {
    describe('when(callback)', function () {
        it('should fulfill from callback', function (done) {
            when(function (then) {
                nodeCallback(true, then());
            }).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, true);
                done();
            }).catch(function () {
                done(shouldBeFulfilled);
            });
        });
        it('should reject from callback', function (done) {
            when(function (then) {
                nodeCallback(error, then());
            }).then(function () {
                done(shouldBeRejected);
            }).catch(function (err) {
                assertNoThrow(done, assert.strictEqual, err, error);
                done();
            });
        });
    });
    describe('when(value)', function () {
        var obj = {};
        it('should fulfill with object', function (done) {
            when(obj).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, obj);
                done();
            });
        });
        it('should fulfill with number', function (done) {
            when(1).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, 1);
                done();
            });
        });
        it('should fulfill with string', function (done) {
            when('').then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, '');
                done();
            });
        });
        it('should fulfill with boolean', function (done) {
            when(false).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, false);
                done();
            });
        });
        it('should fulfill with undefined', function (done) {
            when(undefined).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, undefined);
                done();
            });
        });
        it('should fulfill with null', function (done) {
            when(null).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, null);
                done();
            });
        });
    });
    describe('when(Promise)', function () {
        it('should fulfill with the same fulfilled value', function (done) {
            when(Promise.resolve(1)).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, 1);
                done();
            }, function () {
                done(shouldBeFulfilled);
            });
        });
        it('should reject with the same reason', function (done) {
            when(Promise.reject(error)).then(function () {
                done(shouldBeRejected);
            }).catch(function (err) {
                assertNoThrow(done, assert.strictEqual, err, error);
                done();
            });
        });
        it('should return the same promise object when then, onerror, monitor is null', function (done) {
            var promise = Promise.resolve();
            assertNoThrow(done, assert.strictEqual, when(promise), promise, 'Return the same instance');
            done();
        });
    });
    describe('when(Array<Promise>)', function () {
        it('should map fulfilled values in correct index', function (done) {
            when([
                delay(undefined),
                delay(1),
                delay(2),
            ]).then(function (data) {
                assertNoThrow(done, assert.strictEqual, data.length, 3, 'Length matches source array');
                assertNoThrow(done, assert.ok, data[0] === undefined && data[1] === 1 && data[2] === 2, 'Undefined is kept in position');
                done();
            }).catch(function () {
                done(shouldBeFulfilled);
            });
        });
        it('should reject if one of the promise rejects', function (done) {
            when([
                delay(1),
                delay(error),
            ]).then(function () {
                done(shouldBeRejected);
            }).catch(function () {
                done();
            });
        });
    });
    describe('when(Object<Promise>)', function () {
        it('should map fulfilled values in correct keys', function (done) {
            when({
                one: delay(1),
                two: delay(2),
            }).then(function (data) {
                assertNoThrow(done, assert.ok, data.one === 1 && data.two === 2);
                done();
            }).catch(function () {
                done(shouldBeFulfilled);
            });
        });
        it('should reject if one of the promise rejects', function (done) {
            when({
                one: delay(1),
                two: delay(error),
            }).then(function () {
                done(shouldBeRejected);
            }).catch(function () {
                done();
            });
        });
    });
    describe('when(EventEmitter)', function () {
        it('should reject when error event is emitted', function (done) {
            var event = new EventEmitter();
            var err = new Error();
            when(event).then(function () {
                done(shouldBeRejected);
            }).catch(function (e) {
                assertNoThrow(done, assert.strictEqual, e, err);
                done();
            });
            setTimeout(function () {
                event.emit('error', err);
            });
        });
        it('should fulfill when specified event is emitted', function (done) {
            var event = new EventEmitter();
            when(event, 'done').then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, 1);
                done();
            }).catch(function () {
                done(shouldBeFulfilled);
            });
            setTimeout(function () {
                event.emit('done', 1);
            });
        });
        it('should fulfill when any of specified events are emitted', function (done) {
            var event = new EventEmitter();
            when(event, {
                done1: function (v) { return v; },
                done2: function (v) { return v; }
            }).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, 1);
                done();
            }).catch(function () {
                done(shouldBeFulfilled);
            });
            setTimeout(function () {
                event.emit('done1', 1);
            });
            setTimeout(function () {
                event.emit('done2', 2);
            });
        });
    });
    describe('when(Array<Function>)', function () {
        it('should call functions in sequence', function (done) {
            var dst = [];
            when([
                function () { delay(function () { dst.push(1); }); },
                function () { delay(function () { dst.push(2); }); },
                function () { delay(function () { dst.push(3); }); }
            ]).then(function () {
                assertNoThrow(done, assert.ok, dst.every(function (v, i) {
                    return v === i + 1;
                }));
                done();
            }).catch(function () {
                done(shouldBeFulfilled);
            });
        });
    });
    describe('when(Error)', function () {
        it('should reject with specified reason', function (done) {
            when(error).then(function () {
                done(shouldBeRejected);
            }).catch(function (err) {
                assertNoThrow(done, assert.strictEqual, err, error);
                done();
            });
        });
    });
});
describe('Resolving routine', function () {
    it('should call error handling routine when exception thrown', function (done) {
        when(function (then) {
            nodeCallback(true, then(function () {
                throw error;
            }));
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, error);
            done();
        });
    });
    it('should call error handling routine when error returned', function (done) {
        when(function (then) {
            nodeCallback(true, then(function () {
                return error;
            }));
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, error);
            done();
        });
    });
    it('should follow state of returned promise', function (done) {
        when(function (then) {
            nodeCallback(true, then(function () {
                return delay(false);
            }));
        }).then(function (value) {
            assertNoThrow(done, assert.strictEqual, value, false);
            done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
    it('should fulfill with returned value', function (done) {
        when(function (then) {
            nodeCallback(true, then(function () {
                return false;
            }));
        }).then(function (value) {
            assertNoThrow(done, assert.strictEqual, value, false);
            done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
});
describe('Error handling routine', function () {
    it('should reject the same error', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, error);
            done();
        });
    });
    it('should reject with exception thrown in error handler', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }, function () {
            throw anotherError;
        }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, anotherError);
            done();
        });
    });
    it('should follow resolving routine with return value', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }, function () {
            return true;
        }).then(function (value) {
            assertNoThrow(done, assert.strictEqual, value, true);
            done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
    it('should follow error handling routine after map function', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }, { ERROR: function () { throw anotherError; } }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, anotherError);
            done();
        });
    });
    it('should follow error handling routine after map function (default)', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }, { default: function () { throw anotherError; } }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, anotherError);
            done();
        });
    });
    it('should reject with the mapped code', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }, { ERROR: 'ANOTHER_ERROR' }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, 'ANOTHER_ERROR', err.code);
            done();
        });
    });
    it('should reject if no matches in map', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }, { ANOTHER_ERROR: function () { throw anotherError; } }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, error);
            done();
        });
    });
    it('should be able to catch subsequent errors', function (done) {
        var retryCount = 0;
        function doSomething() {
            return when(function (then) {
                nodeCallback(error, then());
            });
        }
        when(doSomething(), null, function () {
            if (++retryCount < 5) {
                return doSomething();
            }
        }).catch(function () {
            assertNoThrow(done, assert.strictEqual, retryCount, 5);
            done();
        });
    });
});
describe('when.map', function () {
    it('should map values in sequence', function (done) {
        var src = [1, 2, 3];
        when.map(src, function (value) {
            return delay(value * 10);
        }).then(function (dst) {
            assertNoThrow(done, assert.ok, dst.every(function (v, i) {
                return v === src[i] * 10;
            }));
            done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
    it('should return flattened array', function (done) {
        var src = [1, 2, 3];
        when.map(src, function (value) {
            return [when(value), when([value, value])];
        }).then(function (dst) {
            assertNoThrow(done, assert.strictEqual, dst.length, 9);
            done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
});
describe('when.forEach', function () {
    it('should run callback for each element in sequence', function (done) {
        var src = [{}, {}, {}];
        var dst = [];
        when.forEach(src, function (value) {
            return delay(value);
        }).then(function () {
            assertNoThrow(done, assert.ok, dst.every(function (v, i) {
                return v === src[i];
            }));
            done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
});
describe('when.while', function () {
    it('should run callback until condition is false', function (done) {
        var count = 3;
        var str = '';
        when.while(function () {
            str += count;
            return delay(--count > 0 ? count : false);
        }).then(function () {
            assertNoThrow(done, assert.strictEqual, str, '321');
            done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
});
describe('uncaughtException event', function () {
    it('should be emitted when exceptions is not handled', function (done) {
        when.once('uncaughtException', function () {
            done();
        });
        when([
            delay(error),
            delay(anotherError),
        ]);
    });
});
describe('when.monitor', function () {
    describe('uncaughtException event', function () {
        it('should be emitted when exceptions is not handled', function (done) {
            when.monitor(function () {
                return when([
                    delay(error),
                    delay(anotherError),
                ]);
            }).once('uncaughtException', function () {
                done();
            });
        });
    });
    describe('timeout event', function () {
        this.slow(2000);
        it('should be emitted when any promises does not fulfill or reject within given time', function (done) {
            when.monitor({
                timeout: 1000
            }, function () {
                return new Promise(function () { });
            }).once('timeout', function () {
                done();
            });
        });
    });
});