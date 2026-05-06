const winston = require('winston');

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'gymmate-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${rest}`;
        })
      ),
    }),
  ],
});

/** Redact known sensitive keys from objects before logging */
function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const SENSITIVE = new Set(['password', 'authorization', 'cookie', 'idToken', 'refreshToken', 'token', 'accessToken']);
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const k of Object.keys(out)) {
    if (SENSITIVE.has(k.toLowerCase())) out[k] = '[REDACTED]';
    else if (typeof out[k] === 'object' && out[k] !== null) out[k] = redact(out[k]);
  }
  return out;
}

module.exports = { logger, redact };
