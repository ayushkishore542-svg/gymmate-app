const express = require('express');
const router  = express.Router();
const authMiddleware           = require('../middleware/auth');
const checkCalorieSubscription = require('../middleware/checkCalorieSubscription');
const CheatDaySettings = require('../models/CheatDaySettings');

router.use(authMiddleware, checkCalorieSubscription);

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// ── GET /cheat-day ────────────────────────────────────────────────
router.get('/cheat-day', async (req, res) => {
  try {
    const s = await CheatDaySettings.findOne({ user_id: req.user._id });
    res.json(s || { cheat_day: 'Sunday', enabled: false, calorie_goal: 2000, protein_goal: 80, carbs_goal: 250, fats_goal: 65 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

// ── POST /cheat-day ───────────────────────────────────────────────
router.post('/cheat-day', async (req, res) => {
  try {
    const { cheat_day, enabled } = req.body;

    if (cheat_day && !DAYS.includes(cheat_day)) {
      return res.status(400).json({ message: 'Invalid day' });
    }

    const update = {};
    if (cheat_day !== undefined) update.cheat_day = cheat_day;
    if (enabled   !== undefined) update.enabled   = enabled;

    const s = await CheatDaySettings.findOneAndUpdate(
      { user_id: req.user._id },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({ message: 'Settings saved!', settings: s });

  } catch (err) {
    console.error('cheat day settings error:', err);
    res.status(500).json({ message: 'Failed to save settings' });
  }
});

// ── POST /goals ───────────────────────────────────────────────────
router.post('/goals', async (req, res) => {
  try {
    const { calorie_goal, protein_goal, carbs_goal, fats_goal } = req.body;

    const update = {};
    if (calorie_goal) update.calorie_goal = calorie_goal;
    if (protein_goal) update.protein_goal = protein_goal;
    if (carbs_goal)   update.carbs_goal   = carbs_goal;
    if (fats_goal)    update.fats_goal    = fats_goal;

    const s = await CheatDaySettings.findOneAndUpdate(
      { user_id: req.user._id },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({ message: 'Goals updated!', settings: s });

  } catch (err) {
    res.status(500).json({ message: 'Failed to update goals' });
  }
});

// ── GET /goals ────────────────────────────────────────────────────
router.get('/goals', async (req, res) => {
  try {
    const s = await CheatDaySettings.findOne({ user_id: req.user._id });
    res.json({
      calorie_goal: s?.calorie_goal || 2000,
      protein_goal: s?.protein_goal || 80,
      carbs_goal:   s?.carbs_goal   || 250,
      fats_goal:    s?.fats_goal    || 65
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch goals' });
  }
});

// ── GET /is-cheat-day ─────────────────────────────────────────────
router.get('/is-cheat-day', async (req, res) => {
  try {
    const s = await CheatDaySettings.findOne({ user_id: req.user._id });
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const isCheatDay = !!(s?.enabled && s?.cheat_day === todayName);
    res.json({ is_cheat_day: isCheatDay, day: todayName, cheat_day_set: s?.cheat_day });
  } catch (err) {
    res.status(500).json({ message: 'Failed to check cheat day' });
  }
});

module.exports = router;
