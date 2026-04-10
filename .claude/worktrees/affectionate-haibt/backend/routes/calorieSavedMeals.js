const express = require('express');
const router  = express.Router();
const authMiddleware           = require('../middleware/auth');
const checkCalorieSubscription = require('../middleware/checkCalorieSubscription');
const SavedMeal  = require('../models/SavedMeal');
const DailyMeal  = require('../models/DailyMeal');
const Food       = require('../models/Food');

router.use(authMiddleware, checkCalorieSubscription);

const MAX_SAVED = 3;

const startOfDay = (d) => {
  const dt = new Date(d || Date.now());
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
};

// ── GET / ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const doc = await SavedMeal.findOne({ user_id: req.user._id });
    res.json({ meals: doc ? doc.meals : [] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch saved meals' });
  }
});

// ── POST / — create saved meal ────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, items } = req.body;
    if (!name || !items?.length) {
      return res.status(400).json({ message: 'name and items are required' });
    }

    let doc = await SavedMeal.findOne({ user_id: req.user._id });
    if (!doc) doc = new SavedMeal({ user_id: req.user._id, meals: [] });

    if (doc.meals.length >= MAX_SAVED) {
      return res.status(400).json({ message: `Maximum ${MAX_SAVED} saved meals allowed` });
    }

    // Resolve food details
    const resolvedItems = [];
    for (const item of items) {
      const food = await Food.findById(item.food_id);
      if (!food) continue;
      const r = item.quantity;
      resolvedItems.push({
        food_id:   food._id,
        food_name: food.name,
        quantity:  r,
        unit:      item.unit || food.unit,
        calories:  Math.round(food.calories * r),
        protein:   Math.round(food.protein  * r * 10) / 10,
        carbs:     Math.round(food.carbs    * r * 10) / 10,
        fats:      Math.round(food.fats     * r * 10) / 10
      });
    }

    const entry = {
      name,
      items:          resolvedItems,
      total_calories: resolvedItems.reduce((s, i) => s + i.calories, 0),
      macros: {
        protein: resolvedItems.reduce((s, i) => s + i.protein, 0),
        carbs:   resolvedItems.reduce((s, i) => s + i.carbs,   0),
        fats:    resolvedItems.reduce((s, i) => s + i.fats,    0)
      }
    };

    doc.meals.push(entry);
    await doc.save();

    res.status(201).json({ message: 'Meal saved!', meal: doc.meals[doc.meals.length - 1] });

  } catch (err) {
    console.error('save meal error:', err);
    res.status(500).json({ message: 'Failed to save meal' });
  }
});

// ── POST /quick-add/:id ───────────────────────────────────────────
router.post('/quick-add/:id', async (req, res) => {
  try {
    const { meal_type, time } = req.body;
    const userId = req.user._id;

    const savedDoc = await SavedMeal.findOne({ user_id: userId });
    if (!savedDoc) return res.status(404).json({ message: 'No saved meals found' });

    const savedMeal = savedDoc.meals.id(req.params.id);
    if (!savedMeal) return res.status(404).json({ message: 'Saved meal not found' });

    const day = startOfDay(new Date());
    const expiresAt = new Date(day);
    expiresAt.setDate(expiresAt.getDate() + 30);

    let doc = await DailyMeal.findOne({ user_id: userId, date: day });
    if (!doc) doc = new DailyMeal({ user_id: userId, date: day, meals: [], expires_at: expiresAt });

    if (doc.meals.length >= 7) {
      return res.status(400).json({ message: 'Daily meal limit reached (7 meals/day)' });
    }

    const meal = {
      meal_type: meal_type || 'snack1',
      time:      time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      items:     savedMeal.items,
      total_calories: savedMeal.total_calories,
      macros:    savedMeal.macros
    };

    doc.meals.push(meal);
    doc.recalculate();
    await doc.save();

    res.json({ message: `${savedMeal.name} added to today's log!`, meal, daily_summary: doc.daily_summary });

  } catch (err) {
    console.error('quick-add error:', err);
    res.status(500).json({ message: 'Failed to quick-add meal' });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const doc = await SavedMeal.findOne({ user_id: req.user._id });
    if (!doc) return res.status(404).json({ message: 'No saved meals found' });

    doc.meals = doc.meals.filter(m => m._id.toString() !== req.params.id);
    await doc.save();

    res.json({ success: true, message: 'Saved meal deleted' });

  } catch (err) {
    res.status(500).json({ message: 'Failed to delete saved meal' });
  }
});

module.exports = router;
