// Express 4 predates async handlers: it does not observe a returned promise, so
// a rejection inside `async (req, res) => …` never reaches the error middleware
// in app.js. The request just hangs until the client gives up, and the error is
// reported as an unhandled rejection with no request context attached.
//
// Wrapping a handler in `wrap()` forwards any rejection to next(), which is what
// the synchronous better-sqlite3 code got for free by throwing.
//
// Handlers that already have their own try/catch around the whole body don't
// need this — but wrapping them anyway is harmless and guards against a future
// `await` added outside the try.
export function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
