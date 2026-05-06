const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

function validateEnv(opts = {}) {
  const prod = process.env.NODE_ENV === 'production';
  if (opts.productionOnly && !prod) return;

  const missing = [];
  const need = ['JWT_SECRET', 'MONGO_URI', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];

  for (const k of need) {
    if (!process.env[k] || String(process.env[k]).trim() === '') missing.push(k);
  }

  const servicePath = path.join(__dirname, '..', 'firebase-service-account.json');
  const envKeyOk = (k) => k && String(k).includes('BEGIN');
  const firebaseOk =
    fs.existsSync(servicePath) ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      envKeyOk(process.env.FIREBASE_PRIVATE_KEY));

  if (!firebaseOk) {
    missing.push('FIREBASE_SERVICE_ACCOUNT (JSON env or firebase-service-account.json or FIREBASE_* vars)');
  }

  if (prod && !process.env.RAZORPAY_WEBHOOK_SECRET) {
    missing.push('RAZORPAY_WEBHOOK_SECRET');
  }

  if (missing.length) {
    logger.error('Missing required environment variables', { missing });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function getJwtSigningSecret() {
  return process.env.JWT_SECRET;
}

function getJwtVerifySecrets() {
  const primary = process.env.JWT_SECRET;
  const prev = process.env.JWT_SECRET_PREVIOUS;
  const legacy = (process.env.JWT_SECRETS_LEGACY || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const list = [primary, prev, ...legacy];
  return [...new Set(list.filter(Boolean))];
}

module.exports = { validateEnv, getJwtSigningSecret, getJwtVerifySecrets };