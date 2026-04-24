const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const { verifyWebhookSignature } = require('../services/razorpayService');

// ─── GET /api/webhooks/razorpay/ping ────────────────────────────────────────
// Simple health check to confirm the webhook route is reachable by Razorpay.
// Test: curl https://gymmate-app-production.up.railway.app/api/webhooks/razorpay/ping
router.get('/razorpay/ping', (req, res) => {
  console.log('[Webhook] PING received from', req.ip, 'at', new Date().toISOString());
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});

// ─── POST /api/webhooks/razorpay ────────────────────────────────────────────
//
// IMPORTANT: This route uses express.raw() so we receive the raw body
// for HMAC verification. It is registered with rawBody middleware in server.js.
//
// Razorpay sends: x-razorpay-signature header (HMAC-SHA256 of raw body)
// ────────────────────────────────────────────────────────────────────────────

router.post('/razorpay', async (req, res) => {
  // ── VERBOSE ENTRY LOGGING (pre-validation) ────────────────────────────────
  console.log('─────────────────────────────────────────────────────────');
  console.log('🔔 [WEBHOOK] Request received at', new Date().toISOString());
  console.log('🔔 [WEBHOOK] Method:', req.method, '| IP:', req.ip);
  console.log('🔔 [WEBHOOK] Headers:', JSON.stringify({
    'content-type':        req.headers['content-type'],
    'x-razorpay-signature': req.headers['x-razorpay-signature']
      ? req.headers['x-razorpay-signature'].substring(0, 20) + '…'
      : 'MISSING',
    'user-agent': req.headers['user-agent'],
  }, null, 2));
  console.log('🔔 [WEBHOOK] req.rawBody type:', typeof req.rawBody,
    '| is Buffer:', Buffer.isBuffer(req.rawBody),
    '| length:', req.rawBody ? req.rawBody.length : 'N/A');
  console.log('🔔 [WEBHOOK] RAZORPAY_WEBHOOK_SECRET set?',
    process.env.RAZORPAY_WEBHOOK_SECRET ? 'YES (len=' + process.env.RAZORPAY_WEBHOOK_SECRET.length + ')' : 'NO ❌');
  console.log('─────────────────────────────────────────────────────────');

  const signature = req.headers['x-razorpay-signature'];

  // ── 1. Verify signature ───────────────────────────────────────────────────
  const rawBody = req.rawBody; // set by express.raw() in server.js
  if (!rawBody) {
    console.error('❌ [WEBHOOK] rawBody missing — check server.js middleware order');
    return res.status(400).json({ message: 'Bad request: missing body' });
  }

  if (!signature) {
    console.error('❌ [WEBHOOK] x-razorpay-signature header missing');
    return res.status(400).json({ message: 'Bad request: missing signature' });
  }

  const isValid = verifyWebhookSignature(rawBody, signature);
  console.log('🔔 [WEBHOOK] Signature valid?', isValid ? 'YES ✅' : 'NO ❌');
  if (!isValid) {
    console.warn('❌ [WEBHOOK] Invalid signature — rejecting. Secret used (first 5 chars):',
      process.env.RAZORPAY_WEBHOOK_SECRET
        ? process.env.RAZORPAY_WEBHOOK_SECRET.substring(0, 5)
        : 'NOT SET');
    return res.status(400).json({ message: 'Invalid signature' });
  }

  // ── 2. Parse event ────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  const eventType = event.event;
  const payload   = event.payload;

  console.log(`✅ [WEBHOOK] Event parsed: "${eventType}"`);
  const subId = payload?.subscription?.entity?.id || payload?.payment?.entity?.subscription_id || 'N/A';
  console.log(`✅ [WEBHOOK] Subscription ID in payload: ${subId}`);

  // ── 3. Dispatch ───────────────────────────────────────────────────────────
  try {
    switch (eventType) {

      // ── subscription.activated ──────────────────────────────────────────
      case 'subscription.activated': {
        const sub    = payload?.subscription?.entity;
        const subId  = sub?.id;
        if (!subId) break;

        const user = await User.findOne({ razorpaySubscriptionId: subId });
        if (!user) { console.warn(`[Webhook] No user for subscription ${subId}`); break; }

        user.subscriptionStatus  = 'active';
        user.paymentMethodAdded  = true;
        user.currentPeriodStart  = sub.current_start ? new Date(sub.current_start * 1000) : null;
        user.currentPeriodEnd    = sub.current_end   ? new Date(sub.current_end   * 1000) : null;
        await user.save();
        console.log(`[Webhook] Subscription ACTIVATED for owner ${user._id} (${user.gymName})`);
        break;
      }

      // ── subscription.charged ────────────────────────────────────────────
      case 'subscription.charged': {
        const sub   = payload?.subscription?.entity;
        const pmt   = payload?.payment?.entity;
        const subId = sub?.id;
        if (!subId) break;

        const user = await User.findOne({ razorpaySubscriptionId: subId });
        if (!user) { console.warn(`[Webhook] No user for subscription ${subId}`); break; }

        user.subscriptionStatus = 'active';
        user.lastPaymentAt      = new Date();
        user.lastPaymentStatus  = 'success';
        user.currentPeriodStart = sub.current_start ? new Date(sub.current_start * 1000) : user.currentPeriodStart;
        user.currentPeriodEnd   = sub.current_end   ? new Date(sub.current_end   * 1000) : user.currentPeriodEnd;
        user.paymentMethodAdded = true;
        await user.save();
        console.log(`[Webhook] Subscription CHARGED for owner ${user._id} — ₹${(pmt?.amount || 0) / 100}`);
        break;
      }

      // ── subscription.halted ─────────────────────────────────────────────
      case 'subscription.halted': {
        const sub   = payload?.subscription?.entity;
        const subId = sub?.id;
        if (!subId) break;

        const user = await User.findOne({ razorpaySubscriptionId: subId });
        if (!user) break;

        user.subscriptionStatus = 'halted'; // Razorpay will retry payment
        await user.save();
        console.log(`[Webhook] Subscription HALTED for owner ${user._id} — payment retries in progress`);
        break;
      }

      // ── subscription.cancelled ──────────────────────────────────────────
      case 'subscription.cancelled': {
        const sub   = payload?.subscription?.entity;
        const subId = sub?.id;
        if (!subId) break;

        const user = await User.findOne({ razorpaySubscriptionId: subId });
        if (!user) break;

        user.subscriptionStatus = 'cancelled';
        await user.save();
        console.log(`[Webhook] Subscription CANCELLED for owner ${user._id}`);
        break;
      }

      // ── payment.captured ────────────────────────────────────────────────
      case 'payment.captured': {
        const pmt = payload?.payment?.entity;
        console.log(`[Webhook] Payment CAPTURED: ${pmt?.id} — ₹${(pmt?.amount || 0) / 100}`);
        // Subscription charged event handles the DB update; this is just a log.
        break;
      }

      // ── payment.failed ──────────────────────────────────────────────────
      case 'payment.failed': {
        const pmt   = payload?.payment?.entity;
        const subId = pmt?.subscription_id;
        console.warn(`[Webhook] Payment FAILED: ${pmt?.id} for subscription ${subId}`);

        if (subId) {
          const user = await User.findOne({ razorpaySubscriptionId: subId });
          if (user) {
            user.lastPaymentStatus = 'failed';
            user.lastPaymentAt     = new Date();
            await user.save();
          }
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    console.error(`[Webhook] Error processing ${eventType}:`, err);
    // Still return 200 so Razorpay doesn't retry indefinitely
  }

  res.status(200).json({ received: true });
});

module.exports = router;
