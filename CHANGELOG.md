# v0.2.3 / 2016-08-17

- `when.map` and `when.forEach` now accept promise as argument
- `when.map` now recursively resolves for promises
- Fix: `when(Promise)` does not correctly recognize `then` argument
- Fix: `when.forEach` does not wait returned promises
- Fix: infinite loop when error handler returns error

# v0.2.2 / 2016-08-15

- Fix: corruption that make misbehavior of Promise class after extending with EventEmitter
- Fix: error handler routine not correctly executed when error code does not map any handlers

# v0.2.1 / 2016-08-14

- Instead of rethrow unhandled errors they can be caught by `uncaughtException` event on `when`
- Fix: `uncaughtException` now gets propagated up the promise chain
- Fix: `EventEmitter` init twice on promise objects
- Fix: `when.map` always return empty arrays
- Fix: avoid sychronous exception calling the same error handler
- Fix: error handler not called when subsequent rejections from promises returned in error handler

# v0.2.0 / 2016-08-12

Initial release
