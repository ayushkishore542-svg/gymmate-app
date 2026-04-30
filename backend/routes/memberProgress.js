const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const MemberProgress = require('../models/MemberProgress');

// Helper to compute BMI
function calcBMI(weight, height) {
  if (!weight || !height || height === 0) return null;
  const hm = height / 100;
  return Math.round((weight / (hm * hm)) * 10) / 10;
}

// GET /api/member-progress/:memberId — all entries (latest first)
router.get('/:memberId', auth, async (req, res) => {
  try {
    const entries = await MemberProgress
      .find({ memberId: req.params.memberId })
      .sort({ date: -1 })
      .limit(50);
    res.json({ entries });
  } catch (err) {
    console.error('[MemberProgress] GET error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/member-progress — log new entry
router.post('/', auth, async (req, res) => {
  try {
    const memberId = req.user._id;
    const { date, weight, height, chest, waist, biceps, thighs, photos, notes } = req.body;

    const bmi = calcBMI(weight, height);

    const entry = await MemberProgress.create({
      memberId,
      date: date ? new Date(date) : new Date(),
      weight, height, chest, waist, biceps, thighs,
      bmi: bmi || undefined,
      photos: photos || [],
      notes: notes || '',
    });

    res.status(201).json({ entry });
  } catch (err) {
    console.error('[MemberProgress] POST error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/member-progress/:id — update entry
router.patch('/:id', auth, async (req, res) => {
  try {
    const { weight, height, chest, waist, biceps, thighs, photos, notes } = req.body;
    const bmi = calcBMI(weight, height);

    const entry = await MemberProgress.findByIdAndUpdate(
      req.params.id,
      { $set: { weight, height, chest, waist, biceps, thighs, bmi: bmi || undefined, photos, notes } },
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json({ entry });
  } catch (err) {
    console.error('[MemberProgress] PATCH error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/member-progress/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await MemberProgress.findByIdAndDelete(req.params.id);
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
