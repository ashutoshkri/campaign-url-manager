import crypto from 'node:crypto';

/**
 * HTTP Basic Auth for the admin dashboard and API.
 * Disabled when no password is configured so the app runs with zero setup locally.
 */
export function basicAuth({ user, password }) {
  if (!password) return (_req, _res, next) => next();

  const expected = Buffer.from(`${user}:${password}`);

  return (req, res, next) => {
    const [scheme, encoded] = (req.get('authorization') || '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const given = Buffer.from(Buffer.from(encoded, 'base64').toString('utf8'));
      if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) {
        return next();
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="Campaign URL Manager", charset="UTF-8"');
    res.status(401).json({ error: 'Sign in to manage campaigns' });
  };
}
