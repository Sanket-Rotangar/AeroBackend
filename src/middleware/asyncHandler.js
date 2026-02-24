/**
 * asyncHandler — wraps async route controllers so you never need
 * try/catch inside a controller. Any thrown error is forwarded to
 * Express's global error handler automatically.
 *
 * Usage:  exports.myAction = asyncHandler(async (req, res) => { ... });
 */

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
