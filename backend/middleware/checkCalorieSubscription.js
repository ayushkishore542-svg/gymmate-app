const CalorieSubscription = require('../models/CalorieSubscription');

/**
 * Middleware: verify the requesting member has an active calorie tracker subscription.
 * Attaches `req.calorieSubscription` on success.
 */
const checkCalorieSubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const sub = await CalorieSubscription.findOne({ user_id: userId });

    if (!sub) {
      return res.status(403).json({
        error: 'No subscription found',
        action: 'start_trial'
      });
    }

    const now = new Date();

    if (sub.status === 'trial') {
      if (now > sub.trial_end_date) {
        sub.status = 'expired';
        await sub.save();
        return res.status(403).json({
          error: 'Free trial has expired',
          action: 'subscribe',
          expired_at: sub.trial_end_date
        });
      }
      req.calorieSubscription = sub;
      return next();
    }

    if (sub.status === 'active') {
      if (now > sub.next_billing_date) {
        sub.status = 'expired';
        await sub.save();
        return res.status(403).json({
          error: 'Subscription has expired',
          action: 'renew',
          expired_at: sub.next_billing_date
        });
      }
      req.calorieSubscription = sub;
      return next();
    }

    // cancelled or expired
    return res.status(403).json({
      error: 'Subscription is not active',
      action: sub.status === 'cancelled' ? 'subscribe' : 'renew',
      status: sub.status
    });

  } catch (err) {
    console.error('checkCalorieSubscription error:', err);
    res.status(500).json({ message: 'Server error checking subscription' });
  }
};

module.exports = checkCalorieSubscription;
