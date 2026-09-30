export function notFoundApi(_req, res) {
  res.status(404).json({ error: 'Endpoint not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({
      error: 'That campaign ID is already in use',
      fields: { campaignId: 'That campaign ID is already in use' },
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong on the server' : err.message,
    ...(err.fields && { fields: err.fields }),
  });
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
