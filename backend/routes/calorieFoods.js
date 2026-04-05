const express = require('express');
const router  = express.Router();
const authMiddleware = require('../middleware/auth');
const Food = require('../models/Food');

router.use(authMiddleware);

// ── GET /search?q=roti&limit=20 ───────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const q     = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    if (!q) return res.json({ foods: [] });

    const foods = await Food.find({
      $or: [
        { name:            { $regex: q, $options: 'i' } },
        { search_keywords: { $regex: q, $options: 'i' } }
      ]
    })
      .sort({ verified: -1, use_count: -1 })
      .limit(limit)
      .select('name category calories protein carbs fats fiber serving_size unit');

    res.json({ foods });

  } catch (err) {
    console.error('food search error:', err);
    res.status(500).json({ message: 'Search failed' });
  }
});

// ── GET /popular (top 30 by use_count) ───────────────────────────
router.get('/popular', async (req, res) => {
  try {
    const foods = await Food.find({ verified: true })
      .sort({ use_count: -1 })
      .limit(30)
      .select('name category calories protein carbs fats serving_size unit');

    res.json({ foods });

  } catch (err) {
    console.error('popular foods error:', err);
    res.status(500).json({ message: 'Failed to fetch popular foods' });
  }
});

// ── GET /:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ message: 'Food not found' });
    res.json({ food });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch food' });
  }
});

module.exports = router;
