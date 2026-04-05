const express = require('express');
const router  = express.Router();
const authMiddleware = require('../middleware/auth');
const CalorieSubscription = require('../models/CalorieSubscription');

// All routes require JWT auth
router.use(authMiddleware);

// ── POST /start-trial ─────────────────────────────────────────────
router.post('/start-trial', async (req, res) => {
  try {
    const userId = req.user._id;

    // Only members can subscribe
    if (req.user.role !== 'member') {
      return res.status(403).json({ message: 'Only members can access the calorie tracker' });
    }

    const existing = await CalorieSubscription.findOne({ user_id: userId });

    if (existing) {
      // Allow restart if last trial was >6 months ago OR status is expired/cancelled
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      if (existing.status === 'active' || existing.status === 'trial') {
        return res.status(400).json({
          message: 'You already have an active subscription or trial',
          subscription: existing
        });
      }

      if (existing.last_trial_date && existing.last_trial_date > sixMonthsAgo) {
        const nextEligible = new Date(existing.last_trial_date);
        nextEligible.setMonth(nextEligible.getMonth() + 6);
        return res.status(400).json({
          message: 'Trial already used. Next trial eligible on: ' + nextEligible.toDateString(),
          action: 'subscribe'
        });
      }

      // Restart trial
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      existing.status           = 'trial';
      existing.trial_start_date = new Date();
      existing.trial_end_date   = trialEnd;
      existing.last_trial_date  = new Date();
      await existing.save();

      return res.json({
        message: 'Free trial restarted!',
        subscription: existing,
        trial_end_date: trialEnd
      });
    }

    // Create new subscription
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    const sub = await CalorieSubscription.create({
      user_id:          userId,
      status:           'trial',
      trial_start_date: new Date(),
      trial_end_date:   trialEnd,
      last_trial_date:  new Date()
    });

    res.status(201).json({
      message: '7-day free trial started! Enjoy full access.',
      subscription: sub,
      trial_end_date: trialEnd
    });

  } catch (err) {
    console.error('start-trial error:', err);
    res.status(500).json({ message: 'Failed to start trial' });
  }
});

// ── GET /status ───────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const sub = await CalorieSubscription.findOne({ user_id: req.user._id });

    if (!sub) {
      return res.json({ status: null, action: 'start_trial' });
    }

    const now = new Date();
    let days_remaining = 0;

    if (sub.status === 'trial' && now > sub.trial_end_date) {
      sub.status = 'expired';
      await sub.save();
    } else if (sub.status === 'active' && now > sub.next_billing_date) {
      sub.status = 'expired';
      await sub.save();
    }

    if (sub.status === 'trial') {
      days_remaining = Math.max(0, Math.ceil((sub.trial_end_date - now) / 86400000));
    }

    res.json({
      status:              sub.status,
      days_remaining,
      trial_end_date:      sub.trial_end_date,
      next_billing_date:   sub.next_billing_date,
      subscription_start:  sub.subscription_start_date,
      payment_history:     sub.payment_history,
      payment_method:      sub.payment_method
    });

  } catch (err) {
    console.error('subscription status error:', err);
    res.status(500).json({ message: 'Failed to fetch subscription status' });
  }
});

// ── POST /subscribe ───────────────────────────────────────────────
// TODO: Integrate Razorpay for real payment verification
router.post('/subscribe', async (req, res) => {
  try {
    const { payment_method, transaction_id } = req.body;
    const userId = req.user._id;

    // TODO: Verify Razorpay payment signature here
    // const isValid = razorpay.verifySignature(req.body);
    // if (!isValid) return res.status(400).json({ message: 'Invalid payment' });

    let sub = await CalorieSubscription.findOne({ user_id: userId });

    const now      = new Date();
    const nextBill = new Date();
    nextBill.setDate(nextBill.getDate() + 30);

    if (!sub) {
      sub = new CalorieSubscription({ user_id: userId });
    }

    sub.status                  = 'active';
    sub.subscription_start_date = now;
    sub.next_billing_date       = nextBill;
    sub.payment_method          = payment_method || 'UPI';

    sub.payment_history.push({
      date:           now,
      amount:         99,
      transaction_id: transaction_id || 'MOCK_' + Date.now(),
      status:         'success'
    });

    await sub.save();

    res.json({
      message: 'Subscription activated! Welcome to Premium Calorie Tracker 🎉',
      subscription: sub,
      next_billing_date: nextBill
    });

  } catch (err) {
    console.error('subscribe error:', err);
    res.status(500).json({ message: 'Failed to activate subscription' });
  }
});

// ── POST /cancel ──────────────────────────────────────────────────
router.post('/cancel', async (req, res) => {
  try {
    const sub = await CalorieSubscription.findOne({ user_id: req.user._id });
    if (!sub) return res.status(404).json({ message: 'No subscription found' });

    sub.status = 'cancelled';
    await sub.save();

    res.json({ success: true, message: 'Subscription cancelled. Your data is safe for 30 days.' });

  } catch (err) {
    console.error('cancel error:', err);
    res.status(500).json({ message: 'Failed to cancel subscription' });
  }
});

module.exports = router;
