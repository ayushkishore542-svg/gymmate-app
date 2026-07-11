/**
 * googlePlayVerify.js — verify Google Play subscription purchases server-side.
 *
 * Uses a Google service account (Play Console → linked GCP project) to call the
 * Android Publisher API and confirm a purchaseToken is genuine + active.
 *
 * ── ENV ───────────────────────────────────────────────────────────────────
 *   GOOGLE_PLAY_SA_JSON   base64-encoded service-account JSON key.
 *                         Encode the downloaded key file:
 *                           Linux/mac : base64 -w0 sa.json
 *                           PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes("sa.json"))
 *   ANDROID_PACKAGE_NAME  (optional) defaults to 'com.ayush.gymmate'.
 *
 * The service account needs the "View financial data" + "Manage orders and
 * subscriptions" permission on the Play Console app.
 */
const { JWT } = require('google-auth-library');

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

/** Cached JWT client so we don't rebuild it on every request. */
let cachedClient = null;

/**
 * Build (or reuse) an authorized JWT client from GOOGLE_PLAY_SA_JSON.
 * @returns {JWT}
 * @throws {Error} when the env var is missing or malformed.
 */
function getClient() {
  if (cachedClient) return cachedClient;

  const b64 = process.env.GOOGLE_PLAY_SA_JSON;
  if (!b64) {
    throw new Error('GOOGLE_PLAY_SA_JSON env var not set');
  }

  let sa;
  try {
    sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch (e) {
    throw new Error('GOOGLE_PLAY_SA_JSON is not valid base64-encoded JSON');
  }

  if (!sa.client_email || !sa.private_key) {
    throw new Error('Service account JSON missing client_email / private_key');
  }

  cachedClient = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: [ANDROID_PUBLISHER_SCOPE],
  });
  return cachedClient;
}

/** States (subscriptionsv2) we treat as an entitled/valid subscription. */
const VALID_V2_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
]);

/**
 * Verify a Google Play subscription purchase.
 *
 * Tries purchases.subscriptionsv2.get first, falls back to the legacy
 * purchases.subscriptions.get. Never throws — a bad token resolves to
 * { valid: false, error }.
 *
 * @param {string} packageName    e.g. 'com.ayush.gymmate'
 * @param {string} subscriptionId product id (SKU), used by the v1 fallback
 * @param {string} purchaseToken  token from the Play purchase
 * @returns {Promise<{valid: boolean, expiryTime: string|null, status: string|null, raw: object|null, error?: string}>}
 */
async function verifySubscription(packageName, subscriptionId, purchaseToken) {
  if (!packageName || !purchaseToken) {
    return { valid: false, expiryTime: null, status: null, raw: null, error: 'packageName and purchaseToken required' };
  }

  let client;
  try {
    client = getClient();
  } catch (e) {
    return { valid: false, expiryTime: null, status: null, raw: null, error: e.message };
  }

  // ── Attempt 1: subscriptionsv2 ────────────────────────────────────────────
  try {
    const url = `${API_BASE}/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const resp = await client.request({ url });
    const data = resp.data || {};

    const state = data.subscriptionState || null;
    const expiryTime = extractV2Expiry(data);

    return {
      valid: state ? VALID_V2_STATES.has(state) : false,
      expiryTime,
      status: state,
      raw: data,
    };
  } catch (v2Err) {
    // Fall through to v1. Only fall back on 404/400 (endpoint/product shape);
    // for auth errors the fallback will fail the same way and surface below.
    const v1 = await verifyV1(client, packageName, subscriptionId, purchaseToken);
    if (v1) return v1;
    return {
      valid: false,
      expiryTime: null,
      status: null,
      raw: null,
      error: describeError(v2Err),
    };
  }
}

/** Legacy purchases.subscriptions.get fallback. Returns null if it also fails. */
async function verifyV1(client, packageName, subscriptionId, purchaseToken) {
  if (!subscriptionId) return null;
  try {
    const url = `${API_BASE}/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(subscriptionId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const resp = await client.request({ url });
    const data = resp.data || {};

    const expiryMillis = data.expiryTimeMillis ? Number(data.expiryTimeMillis) : null;
    const notExpired = expiryMillis ? expiryMillis > Date.now() : false;
    // paymentState: 0 pending, 1 received, 2 free trial, 3 pending deferred
    const paid = data.paymentState === 1 || data.paymentState === 2;

    return {
      valid: notExpired && paid,
      expiryTime: expiryMillis ? new Date(expiryMillis).toISOString() : null,
      status: typeof data.paymentState === 'number' ? `paymentState:${data.paymentState}` : null,
      raw: data,
    };
  } catch (e) {
    return null;
  }
}

/** Newest lineItem expiryTime from a subscriptionsv2 response. */
function extractV2Expiry(data) {
  const items = Array.isArray(data.lineItems) ? data.lineItems : [];
  let latest = null;
  for (const it of items) {
    if (it && it.expiryTime) {
      if (!latest || new Date(it.expiryTime) > new Date(latest)) latest = it.expiryTime;
    }
  }
  return latest;
}

/** Human-readable error string from a google-auth-library request error. */
function describeError(err) {
  const status = err && err.response && err.response.status;
  const apiMsg = err && err.response && err.response.data && err.response.data.error && err.response.data.error.message;
  if (apiMsg) return `${status || ''} ${apiMsg}`.trim();
  return (err && err.message) || 'Unknown verification error';
}

module.exports = { verifySubscription };
