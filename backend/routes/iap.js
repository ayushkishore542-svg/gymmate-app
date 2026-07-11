/**
 * routes/iap.js — In-App Purchase (Google Play) receipt verification.
 *
 * POST /api/iap/verify
 *   Body: { platform: 'android', productId, purchaseToken }
 *   Auth: JWT (reuses existing authMiddleware)
 *   On valid member purchase → upserts CalorieSubscription (member premium).
 *   Owner plans are verified but persistence is deferred (separate model TBD).
 */
const express = require('express');
const router  = express.Router();

const authMiddleware      = require('../middleware/auth');
const CalorieSubscription = require('../models/CalorieSubscription');
const OwnerSubscription   = require('../models/OwnerSubscription');
const { verifySubscription } = require('../services/googlePlayVerify');

const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || 'com.ayush.gymmate';

// Product SKUs (must match frontend services/iap.ts)
const MEMBER_PREMIUM = 'member_premium_monthly';
const OWNER_SKUS = new Set(['owner_growth_monthly', 'owner_pro_monthly']);

// All IAP routes require JWT auth
router.use(authMiddleware);

// ── POST /verify ────────────────────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  try {
    const { platform, productId, purchaseToken } = req.body || {};

    if (platform !== 'android') {
      return res.status(400).json({ success: false, message: 'Only android is supported right now' });
    }
    if (!productId || !purchaseToken) {
      return res.status(400).json({ success: false, message: 'productId and purchaseToken are required' });
    }

    const result = await verifySubscription(PACKAGE_NAME, productId, purchaseToken);

    if (!result.valid) {
      // Not a crash — token is simply invalid/expired.
      return res.status(200).json({
        success: true,
        valid: false,
        error: result.error || result.status || 'Subscription not active',
      });
    }

    const expiryDate = result.expiryTime ? new Date(result.expiryTime) : null;

    // Persist based on which SKU was purchased.
    if (productId === MEMBER_PREMIUM) {
      // Member calorie premium → CalorieSubscription
      await CalorieSubscription.findOneAndUpdate(
        { user_id: req.user._id },
        {
          $set: {
            status: 'active',
            subscription_start_date: new Date(),
            next_billing_date: expiryDate,
            payment_method: 'google_play',
          },
          $push: {
            payment_history: {
              amount: 0, // amount is billed by Google; recorded here as entitlement grant
              transaction_id: String(purchaseToken).slice(0, 60),
              status: 'success',
            },
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else if (OWNER_SKUS.has(productId)) {
      // Owner plans → OwnerSubscription
      await OwnerSubscription.findOneAndUpdate(
        { userId: req.user._id },
        {
          $set: {
            productId,
            purchaseToken: String(purchaseToken),
            status: 'active',
            expiryTime: expiryDate,
            payment_method: 'google_play',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    return res.json({
      success: true,
      valid: true,
      expiryTime: result.expiryTime,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

module.exports = router;
