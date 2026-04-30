const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const MemberDiet     = require('../models/MemberDiet');
const MealTemplate   = require('../models/MealTemplate');

const FREE_TEMPLATE_LIMIT = 3;

// ── Diet log ──────────────────────────────────────────────────────────────────

// GET /api/member-diet/:memberId?date=YYYY-MM-DD
router.get('/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    let log = await MemberDiet.findOne({ memberId, date });
    if (!log) {
      log = { memberId, date, meals: [], totalCalories: 0, targetCalories: 2000, waterGlasses: 0, waterTarget: 8 };
    }
    res.json({ log });
  } catch (err) {
    console.error('[MemberDiet] GET error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/member-diet — save/upsert daily log
router.post('/', auth, async (req, res) => {
  try {
    const memberId = req.user._id;
    const { date, meals, totalCalories, targetCalories, waterGlasses, waterTarget } = req.body;
    const dateStr = date || new Date().toISOString().split('T')[0];

    const log = await MemberDiet.findOneAndUpdate(
      { memberId, date: dateStr },
      { $set: { meals, totalCalories, targetCalories, waterGlasses, waterTarget } },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ log });
  } catch (err) {
    console.error('[MemberDiet] POST error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/member-diet/:memberId/history?days=7
router.get('/:memberId/history', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const days = parseInt(req.query.days) || 7;
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().split('T')[0];

    const logs = await MemberDiet.find({
      memberId,
      date: { $gte: fromStr },
    }).sort({ date: -1 });

    res.json({ logs });
  } catch (err) {
    console.error('[MemberDiet] HISTORY error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Meal templates ────────────────────────────────────────────────────────────

// GET /api/meal-templates/:memberId
router.get('/templates/:memberId', auth, async (req, res) => {
  try {
    const templates = await MealTemplate.find({ memberId: req.params.memberId });
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/meal-templates
router.post('/templates', auth, async (req, res) => {
  try {
    const memberId = req.user._id;
    const { name, foods } = req.body;

    // Free tier limit check (premium TBD via calorie subscription)
    const count = await MealTemplate.countDocuments({ memberId });
    if (count >= FREE_TEMPLATE_LIMIT) {
      return res.status(403).json({
        message: 'Free plan limit reached. Upgrade to Pro for unlimited templates.',
        limitReached: true,
      });
    }

    const template = await MealTemplate.create({ memberId, name, foods });
    res.status(201).json({ template });
  } catch (err) {
    console.error('[MealTemplate] POST error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/meal-templates/:id
router.delete('/templates/:id', auth, async (req, res) => {
  try {
    await MealTemplate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
