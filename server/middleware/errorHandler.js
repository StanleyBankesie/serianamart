export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const payload = {
    error: err.code || 'INTERNAL_ERROR',
    message: err.message || 'Internal server error',
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}
