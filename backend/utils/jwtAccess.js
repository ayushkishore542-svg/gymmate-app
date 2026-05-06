const jwt = require('jsonwebtoken');
const { getJwtSigningSecret, getJwtVerifySecrets } = require('./env');

const ACCESS_EXPIRES = '24h';

function signAccessToken(payload) {
  const secret = getJwtSigningSecret();
  return jwt.sign(payload, secret, { expiresIn: ACCESS_EXPIRES });
}

/**
 * @returns {{ decoded: object, expired: boolean }}
 */
function verifyAccessToken(token) {
  const secrets = getJwtVerifySecrets();
  let sawExpired = false;
  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret);
      return { decoded, expired: false };
    } catch (err) {
      if (err.name === 'TokenExpiredError') sawExpired = true;
    }
  }
  if (sawExpired) return { decoded: null, expired: true };
  const err = new Error('Invalid token');
  err.name = 'JsonWebTokenError';
  throw err;
}

module.exports = { signAccessToken, verifyAccessToken, ACCESS_EXPIRES };
