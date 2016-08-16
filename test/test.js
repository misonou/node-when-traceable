/*jshint esversion:6, -W030 */
/*globals describe,it */

var assert = require('assert');
var when = require('../when');
var Promise = require('promise/setimmediate');
var EventEmitter = require('events').EventEmitter;
var TimeoutListener = require('../timeout-listener');

var error = new Error();
error.code = 'ERROR';
var anotherError = new Error();
anotherError.code = 'ANOTHER_ERROR';

var shouldBeFulfilled = new Error('Returned promise object should be fulfilled but now rejected.');
var shouldBeRejected = new Error('Returned promise object should be rejected but now fulfilled.');

function delay(value) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            if (typeof value === 'function') {
                try {
                    value = value();
                } catch (err) {
                    value = err;
                }
            }
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
        return true;
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
                assertNoThrow(done, assert.strictEqual, value, true) && done();
            }).catch(function () {
                done(shouldBeFulfilled);
            });
        });
        it('should fulfill with specified value', function (done) {
            when(function (then) {
                nodeCallback(true, then(false));
            }).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, false) && done();
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
                assertNoThrow(done, assert.strictEqual, err, error) && done();
            });
        });
    });
    describe('when(value)', function () {
        var obj = {};
        it('should fulfill with object', function (done) {
            when(obj).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, obj) && done();
            }).catch(function (err) {
                done(err);
            });
        });
        it('should fulfill with number', function (done) {
            when(1).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, 1) && done();
            }).catch(function (err) {
                done(err);
            });
        });
        it('should fulfill with string', function (done) {
            when('').then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, '') && done();
            }).catch(function (err) {
                done(err);
            });
        });
        it('should fulfill with boolean', function (done) {
            when(false).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, false) && done();
            }).catch(function (err) {
                done(err);
            });
        });
        it('should fulfill with undefined', function (done) {
            when(undefined).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, undefined) && done();
            }).catch(function (err) {
                done(err);
            });
        });
        it('should fulfill with null', function (done) {
            when(null).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, null) && done();
            }).catch(function (err) {
                done(err);
            });
        });
    });
    describe('when(Promise)', function () {
        it('should fulfill with the same fulfilled value', function (done) {
            when(Promise.resolve(1)).then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, 1) && done();
            }).catch(function () {
                done(shouldBeFulfilled);
            });
        });
        it('should reject with the same reason', function (done) {
            when(Promise.reject(error)).then(function () {
                done(shouldBeRejected);
            }).catch(function (err) {
                assertNoThrow(done, assert.strictEqual, err, error) && done();
            });
        });
        it('should return the same promise object when then, onerror, monitor is null', function (done) {
            var promise = Promise.resolve();
            assertNoThrow(done, assert.strictEqual, when(promise), promise) && done();
        });
    });
    describe('when(Array<Promise>)', function () {
        it('should map fulfilled values in correct index', function (done) {
            when([
                delay(undefined),
                delay(1),
                delay(2),
            ]).then(function (data) {
                assertNoThrow(done, assert.strictEqual, data.length, 3, 'Length matches source array') &&
                    assertNoThrow(done, assert.ok, data[0] === undefined && data[1] === 1 && data[2] === 2, 'Undefined is kept in position') &&
                    done();
            }).catch(function (err) {
                done(err);
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
                assertNoThrow(done, assert.ok, data.one === 1 && data.two === 2) && done();
            }).catch(function (err) {
                done(err);
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
            when(event).then(function () {
                done(shouldBeRejected);
            }).catch(function (err) {
                assertNoThrow(done, assert.strictEqual, err, error) && done();
            });
            setTimeout(function () {
                event.emit('error', error);
            });
        });
        it('should fulfill when specified event is emitted', function (done) {
            var event = new EventEmitter();
            when(event, 'done').then(function (value) {
                assertNoThrow(done, assert.strictEqual, value, 1) && done();
            }).catch(function (err) {
                done(err);
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
                assertNoThrow(done, assert.strictEqual, value, 1) && done();
            }).catch(function (err) {
                done(err);
            });
            setTimeout(function () {
                event.emit('done1', 1);
            });
            setTimeout(function () {
                event.emit('done2', 2);
            });
        });
        it('should accept forth argument as error handler', function (done) {
            var event = new EventEmitter();
            when(event, 'done', null, function (err) {
                assertNoThrow(done, assert.strictEqual, err, error) && done();
            }).then(function () {
                done(shouldBeRejected);
            });
            setTimeout(function () {
                event.emit('error', error);
            });
        });
    });
    describe('when(Array<Function>)', function () {
        it('should call functions in sequence', function (done) {
            var dst = [];
            when([
                function () { return delay(function () { dst.push(1); }); },
                function () { return delay(function () { dst.push(2); }); },
                function () { return delay(function () { dst.push(3); }); }
            ]).then(function () {
                assertNoThrow(done, assert.deepStrictEqual, dst, [1, 2, 3]) && done();
            }).catch(function (err) {
                done(err);
            });
        });
        it('should always be fulfilled', function (done) {
            when([
                function () { throw error; }
            ]).then(function () {
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
                assertNoThrow(done, assert.strictEqual, err, error) && done();
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
            assertNoThrow(done, assert.strictEqual, err, error) && done();
        });
    });
    it('should call error handling routine when error returned', function (done) {
        when(function (then) {
            nodeCallback(true, then(function () {
                return error;
            }));
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, error) && done();
        });
    });
    it('should follow state of returned promise', function (done) {
        when(function (then) {
            nodeCallback(true, then(function () {
                return delay(false);
            }));
        }).then(function (value) {
            assertNoThrow(done, assert.strictEqual, value, false) && done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
    it('should follow state of promise given as `then`', function (done) {
        when(delay(true), delay(false)).then(function (value) {
            assertNoThrow(done, assert.strictEqual, value, false) && done();
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
            assertNoThrow(done, assert.strictEqual, value, false) && done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
    it('should fulfill with value given as `then`', function (done) {
        when(delay(true), false).then(function (value) {
            assertNoThrow(done, assert.strictEqual, value, false) && done();
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
            assertNoThrow(done, assert.strictEqual, err, error) && done();
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
            assertNoThrow(done, assert.strictEqual, err, anotherError) && done();
        });
    });
    it('should follow resolving routine with return value', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }, function () {
            return true;
        }).then(function (value) {
            assertNoThrow(done, assert.strictEqual, value, true) && done();
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
            assertNoThrow(done, assert.strictEqual, err, anotherError) && done();
        });
    });
    it('should follow error handling routine after map function (default)', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }, { default: function () { throw anotherError; } }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, anotherError) && done();
        });
    });
    it('should reject with the mapped code', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }, { ERROR: 'ANOTHER_ERROR' }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, 'ANOTHER_ERROR', err.code) && done();
        });
    });
    it('should reject with the same error if no matches in map', function (done) {
        when(function (then) {
            nodeCallback(error, then());
        }, { ANOTHER_ERROR: function () { throw anotherError; } }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, error) && done();
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
            assertNoThrow(done, assert.strictEqual, retryCount, 5) && done();
        });
    });
    it('should not enter the same handler when exception is thrown synchronously', function (done) {
        var count = 0;
        when(delay(error), null, function () {
            if (++count > 1) {
                done(new Error('Error handler called twice'));
            }
            throw error;
        }).catch(function () {
            done();
        });
    });
    it('should not enter the same handler when error is returned', function (done) {
        var count = 0;
        when(delay(error), null, function () {
            if (++count > 1) {
                done(new Error('Error handler called twice'));
            }
            return error;
        }).catch(function () {
            done();
        });
    });
});
describe('when.map', function () {
    it('should map values in sequence', function (done) {
        var src = [1, 2, 3];
        when.map(src, function (value) {
            return delay(value);
        }).then(function (dst) {
            assertNoThrow(done, assert.deepStrictEqual, dst, src) && done();
        }).catch(function (err) {
            done(err);
        });
    });
    it('should return flattened array', function (done) {
        var src = [1, 2, 3];
        when.map(src, function (value) {
            return [value, when([value, value])];
        }).then(function (dst) {
            assertNoThrow(done, assert.deepStrictEqual, dst, [1, 1, 1, 2, 2, 2, 3, 3, 3]) && done();
        }).catch(function (err) {
            done(err);
        });
    });
    it('should accept promise as argument', function (done) {
        var src = [1, 2, 3];
        when.map(delay(src), function (value) {
            return delay(value);
        }).then(function (dst) {
            assertNoThrow(done, assert.deepStrictEqual, dst, src) && done();
        }).catch(function (err) {
            done(err);
        });
    });
    it('should fulfill with emtpy array when promise fulfilled nothing', function (done) {
        when.map(delay(undefined), function (value) {
            return value;
        }).then(function (dst) {
            assertNoThrow(done, assert.strictEqual, dst.length, 0) && done();
        }).catch(function (err) {
            done(err);
        });
    });
    it('should recursively map promises in array to fulfilling values', function (done) {
        var src = [1, 2, 3];
        var delaySrc = src.map(function (v) {
            return delay(v);
        });
        when.map(delaySrc, function (value) {
            return delay(value);
        }).then(function (dst) {
            assertNoThrow(done, assert.deepStrictEqual, dst, src) && done();
        }).catch(function (err) {
            done(err);
        });
    });
    it('should throw error if first argument is not an array or a promise', function () {
        assert.throws(() => when.map(1, function () { }), TypeError);
    });
    it('should throw error if second argument is not a function', function () {
        assert.throws(() => when.map([]), TypeError);
    });
});
describe('when.forEach', function () {
    it('should run callback for each element in sequence', function (done) {
        var src = [1, 2, 3];
        var dst = [];
        when.forEach(src, function (value) {
            return delay(function () { dst.push(value); });
        }).then(function () {
            assertNoThrow(done, assert.deepStrictEqual, dst, src) && done();
        }).catch(function () {
            done();
        });
    });
    it('should accept promise as argument', function (done) {
        var src = [1, 2, 3];
        var dst = [];
        when.forEach(delay(src), function (value) {
            return delay(function () { dst.push(value); });
        }).then(function () {
            assertNoThrow(done, assert.deepStrictEqual, dst, src) && done();
        }).catch(function (err) {
            done(err);
        });
    });
    it('should always be fulfilled', function (done) {
        when.forEach([1], function () {
            throw error;
        }).then(function () {
            done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
    it('should behave as synchronous forEach when no promises returned', function (done) {
        var src = [1, 2, 3];
        var dst = [];
        when.forEach(src, function (v) {
            dst.push(v);
        }).then(function () {
            assertNoThrow(done, assert.deepStrictEqual, dst, src) && done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
    it('should throw error if first argument is not an array or a promise', function () {
        assert.throws(() => when.forEach(1, function () { }), TypeError);
    });
    it('should throw error if second argument is not a function', function () {
        assert.throws(() => when.forEach([]), TypeError);
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
            assertNoThrow(done, assert.strictEqual, str, '321') && done();
        }).catch(function (err) {
            done(err);
        });
    });
    it('should throw error if first argument is not a function', function () {
        assert.throws(() => when.while(), TypeError);
    });
});
describe('uncaughtException event', function () {
    it('should be emitted when exceptions is not handled', function (done) {
        var caughtError;
        when.once('uncaughtException', function (err) {
            setTimeout(function () {
                assertNoThrow(done, assert.strictEqual, err, caughtError === error ? anotherError : error) && done();
            });
        });
        when([
            delay(error),
            delay(anotherError),
        ], null, function (err) {
            caughtError = err;
        });
    });
    it('should be emitted when rejecting the same promise twice', function (done) {
        when.once('uncaughtException', function () {
            done();
        });
        when(function (then) {
            then()(error);
            then()(error);
        });
    });
});
describe('when.monitor', function () {
    it('should fulfill when returned promise is fulfilled', function (done) {
        when.monitor(function () {
            return delay(true);
        }).then(function (value) {
            assertNoThrow(done, assert.strictEqual, value, true) && done();
        }).catch(function () {
            done(shouldBeFulfilled);
        });
    });
    it('should reject when returned promise is rejected', function (done) {
        when.monitor(function () {
            return delay(error);
        }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, error) && done();
        });
    });
    it('should reject on synchronous execption in callback', function (done) {
        when.monitor(function () {
            throw error;
        }).then(function () {
            done(shouldBeRejected);
        }).catch(function (err) {
            assertNoThrow(done, assert.strictEqual, err, error) && done();
        });
    });
    it('should reject on timeout if rejectOnTimeout is set', function (done) {
        when.monitor({
            timeout: 10,
            rejectOnTimeout: true
        }, function () {
            return new Promise(function () { });
        }).then(function () {
            done(shouldBeRejected);
        }).catch(function () {
            done();
        });
    });
    it('should throw error if first or second argument is not a function', function () {
        assert.throws(() => when.monitor({}), TypeError);
    });
    describe('uncaughtException event', function () {
        it('should be emitted when exceptions is not handled', function (done) {
            when.monitor(function () {
                return when([
                    delay(error),
                    delay(anotherError),
                ]);
            }).on('uncaughtException', function () {
                done();
            });
        });
    });
    describe('timeout event', function () {
        it('should be emitted when any promises does not fulfill or reject within given time', function (done) {
            when.monitor({
                timeout: 10
            }, function () {
                return new Promise(function () { });
            }).on('timeout', function () {
                done();
            });
        });
    });
});
describe('TimeoutListener', function () {
    it('should be stopped when promise is fulfilled', function (done) {
        var promise = delay(true);
        var m = new TimeoutListener({
            interceptor: function (err) { return err; },
            promise: promise
        }, 50);
        promise.then(function () {
            setTimeout(function () {
                assertNoThrow(done, assert.equal, m.isStopped, true) &&
                    assertNoThrow(done, assert.equal, m.isTimeout, false) &&
                    done();
            });
        });
    });
    it('should be stopped when promise is rejected', function (done) {
        var promise = delay(error);
        var m = new TimeoutListener({
            interceptor: function (err) { return err; },
            promise: promise
        }, 50);
        promise.catch(function () {
            setTimeout(function () {
                assertNoThrow(done, assert.equal, m.isStopped, true) &&
                    assertNoThrow(done, assert.equal, m.isTimeout, false) &&
                    done();
            });
        });
    });
    it('should fire listener immediately when subscribing elapsed event if already stopped', function (done) {
        var async = false;
        process.nextTick(function () {
            async = true;
        });
        var m = new TimeoutListener({
            interceptor: function (err) { return err; },
            promise: delay()
        }, 0);
        m.stop();
        m.addListener('elapsed', function () {
            assertNoThrow(done, assert.strictEqual, async, false) && done();
        });
    });
    it('should fire listener immediately when subscribing timeout event if already timed out', function (done) {
        var m = new TimeoutListener({
            interceptor: function (err) { return err; },
            promise: delay()
        }, 0);
        setTimeout(function () {
            var async = false;
            process.nextTick(function () {
                async = true;
            });
            m.addListener('timeout', function () {
                assertNoThrow(done, assert.strictEqual, async, false) && done();
            });
        }, 20);
    });
});