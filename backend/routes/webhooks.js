const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const { verifyWebhookSignature } = require('../services/razorpayService');

// ─── POST /api/webhooks/razorpay ────────────────────────────────────────────
//
// IMPORTANT: This route uses express.raw() so we receive the raw body
// for HMAC verification. It is registered with rawBody middleware in server.js.
//
// Razorpay sends: x-razorpay-signature header (HMAC-SHA256 of raw body)
// ────────────────────────────────────────────────────────────────────────────

router.post('/razorpay', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  // ── 1. Verify signature ───────────────────────────────────────────────────
  const rawBody = req.rawBody; // set by express.raw() in server.js
  if (!rawBody) {
    console.error('[Webhook] rawBody missing — check server.js middleware order');
    return res.status(400).json({ message: 'Bad request: missing body' });
  }

  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    console.warn('[Webhook] Invalid signature — rejecting');
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

  console.log(`[Webhook] Received: ${eventType}`);

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
