/**
 * pushNotifications.js
 * Sends push notifications via Expo Push API using Node's built-in https module.
 * No extra npm packages needed.
 */

const https = require('https');
const { logger } = require('./logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send one or more push notifications via Expo Push API.
 * @param {Array<{ to: string, title: string, body: string, data?: object }>} messages
 * @returns {Promise<void>}
 */
async function sendExpoPush(messages) {
  if (!messages || messages.length === 0) return;

  // Filter out blank / invalid tokens
  const valid = messages.filter(m => m.to && m.to.startsWith('ExponentPushToken['));
  if (valid.length === 0) {
    logger.warn('pushNotifications: no valid ExponentPushToken targets', { count: messages.length });
    return;
  }

  const body = JSON.stringify(valid);

  return new Promise((resolve) => {
    const url = new URL(EXPO_PUSH_URL);
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept':         'application/json',
        'Accept-Encoding':'gzip, deflate',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const errors = (parsed.data || []).filter(r => r.status === 'error');
          if (errors.length > 0) {
            logger.warn('pushNotifications: some messages errored', { errors });
          } else {
            logger.info('pushNotifications: sent', { count: valid.length });
          }
        } catch (_) { /* non-JSON response, ignore */ }
        resolve();
      });
    });

    req.on('error', (err) => {
      logger.error('pushNotifications: request failed', { err: err.message });
      resolve(); // non-fatal — don't crash cron job
    });

    req.write(body);
    req.end();
  });
}

/**
 * Send a single push notification to one owner.
 * @param {string} token  — ExponentPushToken[...]
 * @param {string} title
 * @param {string} body
 * @param {object} [data]
 */
async function sendOwnerPush(token, title, body, data = {}) {
  return sendExpoPush([{ to: token, title, body, data }]);
}

module.exports = { sendExpoPush, sendOwnerPush };
