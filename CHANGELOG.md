# v0.2.1 / 2016-08-14

- Instead of rethrow unhandled errors they can be caught by `uncaughtException` event on `when`
- Fix: `uncaughtException` now gets propagated up the promise chain
- Fix: `EventEmitter` init twice on promise objects
- Fix: `when.map` always return empty arrays
- Fix: avoid sychronous exception calling the same error handler
- Fix: error handler not called when subsequent rejections from promises returned in error handler

# v0.2.0 / 2016-08-12

Initial release