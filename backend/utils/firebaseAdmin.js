const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

function initFirebaseAdmin() {
  if (admin.apps.length) return admin;

  try {
    let credential;
    const servicePath = path.join(__dirname, '..', 'firebase-service-account.json');
    const envKeyOk = (k) => k && String(k).includes('BEGIN');

    if (fs.existsSync(servicePath)) {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const serviceAccount = require(servicePath);
      credential = admin.credential.cert(serviceAccount);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(json);
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      envKeyOk(process.env.FIREBASE_PRIVATE_KEY)
    ) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: String(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n'),
      });
    } else {
      throw new Error('firebase-service-account.json not found and FIREBASE_* env not set');
    }
    admin.initializeApp({ credential });
    logger.info('Firebase Admin initialized');
  } catch (e) {
    logger.error('Firebase Admin init failed', { err: e.message });
    throw e;
  }
  return admin;
}

module.exports = { initFirebaseAdmin, admin };
