const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const ProcessedWebhook = require('../models/ProcessedWebhook');
const { verifyWebhookSignature } = require('../services/razorpayService');
const { logger } = require('../utils/logger');

router.get('/razorpay/ping', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }
  logger.info('webhook_ping', { ip: req.ip });
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
  const signature = req.headers['x-razorpay-signature'];

  // ── 1. Verify signature ───────────────────────────────────────────────────
  const rawBody = req.rawBody; // set by express.raw() in server.js
  if (!rawBody) {
    logger.error('webhook_rawbody_missing');
    return res.status(400).json({ message: 'Bad request: missing body' });
  }

  if (!signature) {
    logger.warn('webhook_signature_header_missing', { ip: req.ip });
    return res.status(400).json({ message: 'Bad request: missing signature' });
  }

  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    logger.warn('webhook_invalid_signature', { ip: req.ip });
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

  const dedupeKey = event.id
    ? String(event.id)
    : `${eventType}_${event.created_at || Date.now()}`;
  try {
    await ProcessedWebhook.create({ dedupeKey, eventType });
  } catch (e) {
    if (e.code === 11000) {
      logger.info('webhook_duplicate_ignored', { dedupeKey, eventType });
      return res.status(200).json({ received: true, duplicate: true });
    }
    throw e;
  }

  logger.info('webhook_event', { eventType, dedupeKey });

  // ── 3. Dispatch ───────────────────────────────────────────────────────────
  try {
    switch (eventType) {

      // ── subscription.activated ──────────────────────────────────────────
      case 'subscription.activated': {
        const sub    = payload?.subscription?.entity;
        const subId  = sub?.id;
        if (!subId) break;

        const user = await User.findOne({ razorpaySubscriptionId: subId });
        if (!user) { logger.warn('webhook_no_user', { subId }); break; }

        user.subscriptionStatus  = 'active';
        user.paymentMethodAdded  = true;
        user.currentPeriodStart  = sub.current_start ? new Date(sub.current_start * 1000) : null;
        user.currentPeriodEnd    = sub.current_end   ? new Date(sub.current_end   * 1000) : null;
        await user.save();
        logger.info('webhook_subscription_activated', { userId: String(user._id) });
        break;
      }

      // ── subscription.charged ────────────────────────────────────────────
      case 'subscription.charged': {
        const sub   = payload?.subscription?.entity;
        const pmt   = payload?.payment?.entity;
        const subId = sub?.id;
        if (!subId) break;

        const user = await User.findOne({ razorpaySubscriptionId: subId });
        if (!user) { logger.warn('webhook_no_user', { subId }); break; }

        user.subscriptionStatus = 'active';
        user.lastPaymentAt      = new Date();
        user.lastPaymentStatus  = 'success';
        user.currentPeriodStart = sub.current_start ? new Date(sub.current_start * 1000) : user.currentPeriodStart;
        user.currentPeriodEnd   = sub.current_end   ? new Date(sub.current_end   * 1000) : user.currentPeriodEnd;
        user.paymentMethodAdded = true;
        await user.save();
        logger.info('webhook_subscription_charged', { userId: String(user._id) });
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
        logger.info('webhook_subscription_halted', { userId: String(user._id) });
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
        logger.info('webhook_subscription_cancelled', { userId: String(user._id) });
        break;
      }

      // ── payment.captured ────────────────────────────────────────────────
      case 'payment.captured': {
        const pmt = payload?.payment?.entity;
        logger.info('webhook_payment_captured', { paymentId: pmt?.id });
        // Subscription charged event handles the DB update; this is just a log.
        break;
      }

      // ── payment.failed ──────────────────────────────────────────────────
      case 'payment.failed': {
        const pmt   = payload?.payment?.entity;
        const subId = pmt?.subscription_id;
        logger.warn('webhook_payment_failed', { paymentId: pmt?.id, subId });

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
        logger.info('webhook_unhandled', { eventType });
    }
  } catch (err) {
    logger.error('webhook_dispatch_error', { eventType, err: err.message });
  }

  res.status(200).json({ received: true });
});

module.exports = router;
