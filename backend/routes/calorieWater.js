const express = require('express');
const router  = express.Router();
const authMiddleware           = require('../middleware/auth');
const checkCalorieSubscription = require('../middleware/checkCalorieSubscription');
const WaterLog = require('../models/WaterLog');

router.use(authMiddleware, checkCalorieSubscription);

const startOfDay = (d) => {
  const dt = new Date(d || Date.now());
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
};

// ── POST /log ─────────────────────────────────────────────────────
router.post('/log', async (req, res) => {
  try {
    const { amount_ml = 250 } = req.body;
    const userId   = req.user._id;
    const day      = startOfDay(new Date());
    const expiresAt = new Date(day);
    expiresAt.setDate(expiresAt.getDate() + 30);

    let log = await WaterLog.findOne({ user_id: userId, date: day });
    if (!log) {
      log = new WaterLog({ user_id: userId, date: day, glasses: [], total_ml: 0, goal_ml: 2000, expires_at: expiresAt });
    }

    log.glasses.push({ time: new Date(), amount_ml });
    log.total_ml += amount_ml;
    log.achieved  = log.total_ml >= log.goal_ml;

    await log.save();

    res.json({
      message:      `Added ${amount_ml}ml 💧`,
      total_ml:     log.total_ml,
      goal_ml:      log.goal_ml,
      achieved:     log.achieved,
      glasses_count: log.glasses.length
    });

  } catch (err) {
    console.error('water log error:', err);
    res.status(500).json({ message: 'Failed to log water' });
  }
});

// ── GET /today ────────────────────────────────────────────────────
router.get('/today', async (req, res) => {
  try {
    const day = startOfDay(new Date());
    const log = await WaterLog.findOne({ user_id: req.user._id, date: day });

    if (!log) {
      return res.json({ glasses: [], total_ml: 0, goal_ml: 2000, achieved: false, glasses_count: 0 });
    }

    res.json({
      glasses:       log.glasses,
      total_ml:      log.total_ml,
      goal_ml:       log.goal_ml,
      achieved:      log.achieved,
      glasses_count: log.glasses.length,
      last_logged:   log.glasses.length ? log.glasses[log.glasses.length - 1].time : null
    });

  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch water log' });
  }
});

module.exports = router;
