const express = require('express');
const router = express.Router();
const GymSettings = require('../models/GymSettings');
const authMiddleware = require('../middleware/auth');

// Helper — get or create default settings for an owner
async function getOrCreate(ownerId) {
  let s = await GymSettings.findOne({ ownerId });
  if (!s) {
    s = await GymSettings.create({ ownerId });
  }
  return s;
}

// GET /api/settings — fetch owner's gym settings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const settings = await getOrCreate(req.user._id);
    res.json({ settings });
  } catch (err) {
    console.error('[Settings GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/settings/gym — update operating hours, capacity, trial days
router.put('/gym', authMiddleware, async (req, res) => {
  try {
    const { openTime, closeTime, maxCapacity, trialPeriodDays } = req.body;
    const settings = await getOrCreate(req.user._id);

    if (openTime !== undefined)      settings.openTime = openTime;
    if (closeTime !== undefined)     settings.closeTime = closeTime;
    if (maxCapacity !== undefined)   settings.maxCapacity = Number(maxCapacity);
    if (trialPeriodDays !== undefined) settings.trialPeriodDays = Number(trialPeriodDays);

    await settings.save();
    res.json({ settings, message: 'Gym settings updated' });
  } catch (err) {
    console.error('[Settings PUT /gym]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/settings/plans — update membership plans array
router.put('/plans', authMiddleware, async (req, res) => {
  try {
    const { plans } = req.body; // [{ name, duration, price }]
    if (!Array.isArray(plans) || plans.length === 0) {
      return res.status(400).json({ message: 'At least one plan is required' });
    }

    const settings = await getOrCreate(req.user._id);
    settings.membershipPlans = plans.map(p => ({
      name: p.name,
      duration: Number(p.duration),
      price: Number(p.price),
    }));
    await settings.save();
    res.json({ settings, message: 'Plans updated' });
  } catch (err) {
    console.error('[Settings PUT /plans]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/settings/notifications — update notification prefs
router.put('/notifications', authMiddleware, async (req, res) => {
  try {
    const prefs = req.body; // partial object
    const settings = await getOrCreate(req.user._id);

    const allowed = ['pushEnabled', 'newMember', 'paymentReceived', 'membershipExpiring', 'dailyAttendance', 'newVisitor'];
    for (const key of allowed) {
      if (prefs[key] !== undefined) {
        settings.notifications[key] = Boolean(prefs[key]);
      }
    }
    settings.markModified('notifications');
    await settings.save();
    res.json({ settings, message: 'Notification preferences updated' });
  } catch (err) {
    console.error('[Settings PUT /notifications]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
