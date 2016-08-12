This is an experimental extension to the traceable package.

This packge will eventually integrated to the [traceable](https://www.npmjs.com/package/traceable) package.

## when

Returns a Promise/A+ object that is to be fulfilled or rejected in the future or immediately.
Specifically promise objects created by this library relies on the [promise](https://www.npmjs.com/package/promise) package.

However for arguments that requires a promise object, any objects of Promise/A+ implementation should work.


### `when(fn, [onerror])`

Runs the callback `fn` and returns a promise object.

```javascript
when(function (then) {
    fs.readFile('/path/to/file', then(function (data) {
        // something
    }));
});
```

The `fn` function receives a function argument `then`.
The primary usage of `then` is to deal with Node.js callback pattern.

If `then` is called with `value`, it returns a callback function that handles Node.js callback where:
- If error is received, follow the **error handling routine** with `onerror` as *handler*.
- Otherwise follow the **resolving routine** with `value` as *handler* and **null action** being doing nothing.

> **Note**: All errors raised during asynchronous callback are all processed by the [traceable](https://www.npmjs.com/package/traceable) package
  so you can access the stack trace of the previous event loop.

```javascript
when(function (then) {
    fs.readFile('/inexist/path', then(function (data) { }));
}).catch(function (err) {
    console.log(err.stack);      // Error: ENOENT: ... at Error (native)
    console.log(err.asyncStack); // Error at myfile.js:2:35 at ...
});
```

#### Resolving routine

With *handler* and *fulfilling value*: 

- If *handler* is a function, call the function with the *fulfilling value*:
    - If exception raised during callback or an `Error` object is returned, follow the **error handling routine**.
    - Otherwise let *handler* to be the returned value and continue.
- If *handler* is a promise object, wait until:
  - When that promise is fulfilled, fulfill with its fulfilling value.
  - When that promise is rejected, follow the **error handling routine**.
- If *handler* is not `undefined` fulfill with *handler*.
- Otherwise fulfill with *fulfilling value* or otherwise specified (**null action**).

#### Error handling routine

With *handler* and *error*:

- If *handler* is a function, follow **resolving routine** with *handler* and **null action** being rejecting with the same error.
- If *handler* is a map:
  - If exception code (i.e. `Error#name` or `Error#code`) is one of the keys:
    - If the associated map value is a `string`, reject with an error with the new code and same message.
    - If the associated map value is a `function`, follow the **error handling routine** again.
  - If the `default` key presents on the map:
    - Follow the subroutine as if the exception code is one of the keys.
- Otherwise reject with the same error.

```javascript
when(promise, function (value) {
    return anotherPromise; // Take the state of `anotherPromise`
    return anotherValue;   // Fulfull with `anotherValue`
    throw new Error();     // Call `onerror` if supplied or reject with error
});
when(promise, function (value) {
    console.log(value);    // Tap on fulfillment
});
when(promise, null, function (err) {
    return anotherPromise; // Take the state of `anotherPromise`
    return value;          // Fulfill with `value` instead of rejection
    throw new Error();     // Reject with new error 
});
when(promise, null, function (err) {
    console.log(err);      // Tap on rejection
});
when(promise, null, {
    ETIMEOUT: function () {
        return null;       // Ignore ETIMEOUT error
    },
    default: 'ENOENT'      // Throw ENOENT in case of any other errors
});

// Combining `then` and `onerror`
when(promise, function (value) {
    /* `onerror` will be called with the raised exception */
    throw new Error();
}, function (err) {
    /* Reach here when promise is fulfilled or rejected */
});
```

### `when(value, [then], [onerror])`

If none of the overloads listed below matches, returns a fulfilled promise with `value`.
`then` and `onerror` will be supplied as handlers for **resolving routine** and
**error handling rountine**.

> **Note**: It is very similar to calling `Promise#then(then, onerror)` ***except*** that
  the `Promise#then` method returns a new promise and left the callee untouched;
  while for `then` and `onerror` are modifiers to the resolution of the promise itself.
  For example if exception is raised and is caught by **error handling routine**
  which then fulfilled the promise, it had never been a rejected promise in the promise chain.

### `when(Promise, [then], [onerror])`

Returns a promise that wait until the given promise is fulfilled or rejected,
and resolve the promise by **resolving routine** with the fulfilled value as *handler*.

```javascript
when(promiseOne, function (value) {
    assert(value === 1);
    return value + 1;
}).then(function (value) {
    assert(value === 2);  
});
```

### `when(Array<Promise>, [then], [onerror])`

Returns a promise that wait until all promises are fulfilled or rejected:
- If any promises is rejected, follow the **error handling routine** with the first encountered error.
- Otherwise follow the **resolving routine** with an array of fulfilled values as *handler*.

If more than one promise is rejected, other errors will sinked silently.
To catch the sinked errors use `when.monitor`.

```javascript
when([promiseUndefined, promiseOne, promiseTwo], function (data) {
    assert(data.length === 3);
    assert(data[0] === undefined);
    assert(data[1] === 1);
    assert(data[2] === 2);
});
```

### `when(Object<Promise>, [then], [onerror])`

Returns a promise that wait until all promises are fulfilled or rejected:
- If any promises is rejected, follow the **error handling routine** with the first encountered error.
- Otherwise follow the **resolving routine** with a map of fulfilled values as *handler*.

If more than one promise is rejected, other errors will sinked silently.
To catch the sinked errors use `when.monitor`.

```javascript
when({
    one: promiseOne,
    two: promiseTwo
}, function (data) {
    assert(data.one === 1);
    assert(data.two === 2);
});
```

### `when(EventEmitter, [eventHandlers], [onerror])`

Returns a promise that:
- When the `EventEmitter` emits an `error` event, follow the **error handling routine** with the error.
- If listened event is emitted, follow the **resolving routine** with the first argument as *handler*.

```javascript
// Fulfill when response emit `end` event with the first argument
// Reject when response emit `error` event
when(response, 'end');

// Fulfill when response emit `end` event with custom value
when(response, 'end', function () {
    return state;
});

// Fulfill on multiple event
when(response, {
    end: function () { /* ... */ },
    close: function () { /* ... */ }
});
```

### `when(Array<Function>)`

Returns a promise that sequentially calls the functions.

The promise will always be resolved after call on the last element.
Any exception raised in `callback` will not break the asynchronous loop.
To catch the sinked errors use `when.monitor`.

```javascript
when([printOne, printTwo, printThree]); // Print out "123"
```

### `when(Error)`

Returns a rejected promise with the given error.

## Utilities

### `when.map(array, callback, [then], [onerror])`

Calls `callback` on each element in the `array`, creating promise objects on each value from the calls, and
returns a promise that wait until all promises are fulfilled or rejected.

```javascript
// Promise fulfilled with [1, 4, 9] 
when.map([1, 2, 3], function (number) {
    return squarePromise(number);
});
// Both the immediately returned promises and the fulfilled values of the promises
// are flatten if their elements contains arrays
// the following promise is fulfilled with [2, 3, 1, 4, 6, 4, 6, 9, 9]
when.map([1, 2, 3], function (number) {
    return [
        doubleAndTriplePromise(number),
        squarePromise(number)
    ];
});
// Promises and values can be mixed on the map callback
// the following promise is fulfilled with [1, 4, 3]
when.map([1, 2, 3], function (number) {
    return isOdd(number) ? number : doublePromise(number);
});
```

### `when.forEach(array, callback, [then], [onerror])`

Sequentially calls `callback` on each element in the array after the promise returned from the last call is fulfilled or rejected.

The promise will always be resolved after call on the last element.
Any exception raised in `callback` will not break the asynchronous loop.
To catch the sinked errors use `when.monitor`.

```javascript
// `arr` will contain the exact sequence of numbers as the input array
var arr = [];
when.forEach([1, 2, 3, 4, 5], function (number) {
    return delayRandomPromise(function () {
        arr.push(number);
    });
});
```

### `when.while(fn, [then], [onerror])`

Asychronous version of `while((value = fn(value)) !== false)`.
The fulfilled value returned from the `fn` callback will be tested and as the parameter of the next call to `fn`.

```javascript
var result = [];
when.while(function (pageIndex) {
    return when(getPagedResult(pageIndex || 0), function (data) {
        Array.prototype.push.apply(result, data.items);
        // If there is next page of results return the next page index
        // `fn` will be called with the returned page index
        if (data.hasNextPage) {
            return (pageIndex || 0) + 1;
        }
        // Return `false` to end the asynchronous loop
        // Can also return a promise if it is not immediately available
        return false;
    });
},
// Resolve the promise from `when.while` by the combined results
result);
```

### `when.monitor([options], callback)`

By this the returned promise object is exteneded with `EventEmitter` so you can listen various event.

##### `timeout` event

If `timeout` options is specified, the `timeout` event is emitted when one of the promise in the promise chain
did not fulfill or reject in the given amount of time.

The error object is raised with call stack information about the promise creation location.

```javascript
when.monitor({
    // timeout in milliseconds
    timeout: 10000 
}, function () {
    return wontFulfillPromise();
}).on('timeout', function (err) {
    // prints call stack where the promise has been created
    console.log(err.asyncStack);
});
```

##### `uncaughtException` event

The `uncaughtException` event is emitted when creating a promise from an array of promise, where
only the first encountered error is propagated through the promise chain.

The other errors they are considered uncaught and will be sinked silently.
By attaching a monitor you can catch those errors.

```javascript
when.monitor(function () {
    return when([
        rejectPromise(),
        rejectPromise(),
        rejectPromise()
    ]);
}).on('uncaughtException', function (err) {
    // uncaughtException event will be emitted two times
});
```
