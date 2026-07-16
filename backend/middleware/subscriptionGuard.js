/**
 * subscriptionGuard — blocks owner API access if subscription is expired.
 *
 * Allowed states:
 *   trial  — trialEndDate hasn't passed yet
 *   active — paid and current
 *   halted — payment failed; Razorpay is retrying → give grace period
 *
 * Blocked states:
 *   expired   — trial ended AND no payment method added
 *   cancelled — cancelled AND currentPeriodEnd has passed
 *   failed    — (legacy, same as expired)
 *
 * Apply ONLY to owner-side routes. Do NOT apply to:
 *   /api/auth, /api/subscriptions, /api/webhooks
 */

const { getEffectiveSubStatus } = require('../utils/getEffectiveSubStatus');
const { logger } = require('../utils/logger');

module.exports = async function subscriptionGuard(req, res, next) {
  try {
    // req.user is attached by the auth middleware (must run before this)
    if (!req.user) return res.status(401).json({ message: 'Unauthorised' });

    // Members are not subject to owner subscription rules
    if (req.user.role !== 'owner') return next();

    // Merge active Google Play subscription over Razorpay/trial (shared helper).
    const eff = await getEffectiveSubStatus(req.user._id);
    if (!eff) return res.status(404).json({ message: 'Owner not found' });

    // Active Play subscription → allow through immediately.
    if (eff.ownerActive) return next();

    const owner  = eff.user;
    const now    = new Date();
    const status = owner.subscriptionStatus;

    // ── Always allow ──────────────────────────────────────────────────────
    if (status === 'active') return next();

    if (status === 'halted') return next(); // Razorpay is retrying — don't lock out yet

    if (status === 'trial') {
      // Allow if trial hasn't expired
      const trialEnd = owner.subscriptionEndDate ? new Date(owner.subscriptionEndDate) : null;
      if (trialEnd && trialEnd > now) return next();

      // Trial expired — block
      return res.status(403).json({
        subscriptionRequired: true,
        message:  'Your free trial has ended. Please set up auto-pay to continue.',
        status:   'trial_expired',
      });
    }

    // ── Cancelled ─────────────────────────────────────────────────────────
    if (status === 'cancelled') {
      // User keeps access until end of paid period
      const periodEnd = owner.currentPeriodEnd ? new Date(owner.currentPeriodEnd) : null;
      if (periodEnd && periodEnd > now) return next();

      return res.status(403).json({
        subscriptionRequired: true,
        message: 'Your subscription has ended. Please resubscribe to continue.',
        status:  'cancelled',
      });
    }

    // ── Expired / Failed ─────────────────────────────────────────────────
    return res.status(403).json({
      subscriptionRequired: true,
      message: 'Your subscription is inactive. Please renew to continue.',
      status,
    });

  } catch (err) {
    logger.error('subscriptionGuard_error', { err: err.message });
    return res.status(503).json({ message: 'Service temporarily unavailable' });
  }
};
