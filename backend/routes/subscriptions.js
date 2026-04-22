const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const auth     = require('../middleware/auth');
const razorpay = require('../services/razorpayService');

// ─── Helper ────────────────────────────────────────────────────────────────

function calcTrialDaysLeft(subscriptionEndDate) {
  if (!subscriptionEndDate) return 0;
  const ms = new Date(subscriptionEndDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// ─── GET /api/subscriptions/status ─────────────────────────────────────────
// Returns the owner's current subscription state.

router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'subscriptionStatus subscriptionEndDate subscriptionStartDate ' +
      'razorpaySubscriptionId razorpayShortUrl paymentMethodAdded ' +
      'currentPeriodStart currentPeriodEnd lastPaymentAt lastPaymentStatus'
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    const trialDaysLeft = calcTrialDaysLeft(user.subscriptionEndDate);

    // If a Razorpay subscription exists, optionally sync live status
    // (we rely on webhooks to keep our DB up-to-date; this is just the
    //  stored view — no live Razorpay call on every status poll)

    res.json({
      status:              user.subscriptionStatus,
      planName:            'GymMate Pro',
      amount:              699,
      currency:            'INR',
      trialDaysLeft,
      trialEndDate:        user.subscriptionEndDate,
      trialStartDate:      user.subscriptionStartDate,
      nextBillingDate:     user.currentPeriodEnd,
      paymentMethodAdded:  user.paymentMethodAdded,
      razorpayShortUrl:    user.razorpayShortUrl,
      lastPaymentAt:       user.lastPaymentAt,
      lastPaymentStatus:   user.lastPaymentStatus,
    });
  } catch (err) {
    console.error('[Subscriptions] status error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── POST /api/subscriptions/create ────────────────────────────────────────
// Creates a Razorpay subscription and returns the hosted payment link.

router.post('/create', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // If subscription already exists, just return the existing short URL
    if (user.razorpaySubscriptionId) {
      return res.json({
        shortUrl:       user.razorpayShortUrl,
        subscriptionId: user.razorpaySubscriptionId,
        alreadyExists:  true,
      });
    }

    const { subscriptionId, shortUrl } = await razorpay.createSubscription(
      user._id.toString(),
      user.email,
      user.phone
    );

    user.razorpaySubscriptionId = subscriptionId;
    user.razorpayShortUrl       = shortUrl;
    await user.save();

    console.log(`[Subscriptions] Created for owner ${user._id}: ${subscriptionId}`);

    res.json({ shortUrl, subscriptionId });
  } catch (err) {
    console.error('[Subscriptions] create error:', err);
    res.status(500).json({ message: 'Could not create subscription', error: err.message });
  }
});

// ─── POST /api/subscriptions/cancel ────────────────────────────────────────

router.post('/cancel', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.razorpaySubscriptionId) {
      return res.status(400).json({ message: 'No active subscription found' });
    }

    await razorpay.cancelSubscription(user.razorpaySubscriptionId, true);

    user.subscriptionStatus = 'cancelled';
    await user.save();

    console.log(`[Subscriptions] Cancelled for owner ${user._id}`);

    res.json({ message: 'Subscription cancelled. Access continues until end of current period.' });
  } catch (err) {
    console.error('[Subscriptions] cancel error:', err);
    res.status(500).json({ message: 'Could not cancel subscription', error: err.message });
  }
});

// ─── GET /api/subscriptions/billing-history ────────────────────────────────

router.get('/billing-history', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('razorpaySubscriptionId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.razorpaySubscriptionId) {
      return res.json({ payments: [] });
    }

    // Fetch invoices from Razorpay for this subscription
    const Razorpay = require('razorpay');
    const rzp = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const invoices = await rzp.invoices.all({
      subscription_id: user.razorpaySubscriptionId,
      count: 20,
    });

    const payments = (invoices.items || []).map(inv => ({
      id:         inv.id,
      date:       inv.date ? new Date(inv.date * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '--',
      amount:     (inv.amount || 0) / 100, // paise → rupees
      status:     inv.status === 'paid' ? 'Success' : inv.status === 'cancelled' ? 'Cancelled' : 'Failed',
      invoiceUrl: inv.short_url || null,
      invoiceNo:  inv.receipt || inv.id,
    }));

    res.json({ payments });
  } catch (err) {
    console.error('[Subscriptions] billing-history error:', err);
    res.status(500).json({ message: 'Could not fetch billing history', error: err.message });
  }
});

module.exports = router;
