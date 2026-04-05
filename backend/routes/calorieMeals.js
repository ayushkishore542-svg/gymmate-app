const express = require('express');
const router  = express.Router();
const authMiddleware              = require('../middleware/auth');
const checkCalorieSubscription    = require('../middleware/checkCalorieSubscription');
const DailyMeal = require('../models/DailyMeal');
const Food      = require('../models/Food');
const CheatDaySettings = require('../models/CheatDaySettings');

router.use(authMiddleware, checkCalorieSubscription);

const MAX_MEALS_PER_DAY = 7;

// Normalise a JS Date to start-of-day UTC
const startOfDay = (d) => {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
};

// ── POST /log ─────────────────────────────────────────────────────
router.post('/log', async (req, res) => {
  try {
    const { date, meal_type, time, items } = req.body;
    const userId = req.user._id;

    if (!meal_type || !items || !items.length) {
      return res.status(400).json({ message: 'meal_type and items are required' });
    }

    const day = startOfDay(date || new Date());
    const expiresAt = new Date(day);
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Fetch or create today's document
    let doc = await DailyMeal.findOne({ user_id: userId, date: day });
    if (!doc) {
      doc = new DailyMeal({ user_id: userId, date: day, meals: [], expires_at: expiresAt });
    }

    // Enforce 7-meal daily limit
    if (doc.meals.length >= MAX_MEALS_PER_DAY) {
      return res.status(400).json({
        message: `Daily meal limit reached (${MAX_MEALS_PER_DAY} meals/day)`,
        meal_count: doc.meals.length
      });
    }

    // Resolve food details and compute totals
    const resolvedItems = [];
    for (const item of items) {
      const food = await Food.findById(item.food_id);
      if (!food) continue;

      const ratio = item.quantity;
      resolvedItems.push({
        food_id:   food._id,
        food_name: food.name,
        quantity:  ratio,
        unit:      item.unit || food.unit,
        calories:  Math.round(food.calories * ratio),
        protein:   Math.round(food.protein  * ratio * 10) / 10,
        carbs:     Math.round(food.carbs    * ratio * 10) / 10,
        fats:      Math.round(food.fats     * ratio * 10) / 10
      });

      // Increment use_count for popularity
      Food.findByIdAndUpdate(food._id, { $inc: { use_count: 1 } }).exec();
    }

    if (!resolvedItems.length) {
      return res.status(400).json({ message: 'No valid food items found' });
    }

    const totalCal  = resolvedItems.reduce((s, i) => s + i.calories, 0);
    const totalPro  = resolvedItems.reduce((s, i) => s + i.protein,  0);
    const totalCarb = resolvedItems.reduce((s, i) => s + i.carbs,    0);
    const totalFat  = resolvedItems.reduce((s, i) => s + i.fats,     0);

    // Check if today is cheat day
    const settings = await CheatDaySettings.findOne({ user_id: userId });
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const isCheatDay = settings?.enabled && settings?.cheat_day === todayName;

    const meal = {
      meal_type,
      time: time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      items: resolvedItems,
      total_calories: totalCal,
      macros: { protein: totalPro, carbs: totalCarb, fats: totalFat }
    };

    doc.meals.push(meal);
    doc.is_cheat_day = isCheatDay;
    doc.recalculate();
    await doc.save();

    res.status(201).json({
      message: `${meal_type.charAt(0).toUpperCase() + meal_type.slice(1)} logged! 🎉`,
      meal,
      daily_summary: doc.daily_summary
    });

  } catch (err) {
    console.error('meal log error:', err);
    res.status(500).json({ message: 'Failed to log meal' });
  }
});

// ── GET /today ────────────────────────────────────────────────────
router.get('/today', async (req, res) => {
  try {
    const day = startOfDay(new Date());
    const doc = await DailyMeal.findOne({ user_id: req.user._id, date: day });

    if (!doc) {
      return res.json({
        date: day,
        meals: [],
        daily_summary: { total_calories: 0, protein: 0, carbs: 0, fats: 0, meal_count: 0 },
        is_cheat_day: false
      });
    }

    res.json({
      date:          doc.date,
      meals:         doc.meals,
      daily_summary: doc.daily_summary,
      is_cheat_day:  doc.is_cheat_day
    });

  } catch (err) {
    console.error('today meals error:', err);
    res.status(500).json({ message: 'Failed to fetch today\'s meals' });
  }
});

// ── GET /date/:date ───────────────────────────────────────────────
router.get('/date/:date', async (req, res) => {
  try {
    const day = startOfDay(req.params.date);
    const doc = await DailyMeal.findOne({ user_id: req.user._id, date: day });

    if (!doc) return res.json({ date: day, meals: [], daily_summary: {} });

    res.json({ date: doc.date, meals: doc.meals, daily_summary: doc.daily_summary, is_cheat_day: doc.is_cheat_day });

  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch meals for date' });
  }
});

// ── DELETE /:mealId ───────────────────────────────────────────────
router.delete('/:mealId', async (req, res) => {
  try {
    const day = startOfDay(new Date());
    const doc = await DailyMeal.findOne({ user_id: req.user._id, date: day });

    if (!doc) return res.status(404).json({ message: 'No meals logged today' });

    const before = doc.meals.length;
    doc.meals = doc.meals.filter(m => m._id.toString() !== req.params.mealId);

    if (doc.meals.length === before) {
      return res.status(404).json({ message: 'Meal not found' });
    }

    doc.recalculate();
    await doc.save();

    res.json({ success: true, updated_summary: doc.daily_summary });

  } catch (err) {
    console.error('delete meal error:', err);
    res.status(500).json({ message: 'Failed to delete meal' });
  }
});

// ── GET /summary/weekly ───────────────────────────────────────────
router.get('/summary/weekly', async (req, res) => {
  try {
    const userId = req.user._id;
    const end    = startOfDay(new Date());
    const start  = new Date(end);
    start.setDate(start.getDate() - 6);

    const docs = await DailyMeal.find({
      user_id: userId,
      date:    { $gte: start, $lte: end }
    }).sort({ date: 1 });

    // Build 7-day array
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const doc = docs.find(x => x.date.toDateString() === d.toDateString());
      days.push({
        date:           d.toISOString().split('T')[0],
        total_calories: doc?.daily_summary?.total_calories || 0,
        protein:        doc?.daily_summary?.protein        || 0,
        carbs:          doc?.daily_summary?.carbs          || 0,
        fats:           doc?.daily_summary?.fats           || 0,
        logged:         !!doc,
        is_cheat_day:   doc?.is_cheat_day || false
      });
    }

    // Exclude cheat days from average
    const tracked = days.filter(d => d.logged && !d.is_cheat_day);
    const avg = tracked.length ? {
      calories: Math.round(tracked.reduce((s, d) => s + d.total_calories, 0) / tracked.length),
      protein:  Math.round(tracked.reduce((s, d) => s + d.protein,  0) / tracked.length),
      carbs:    Math.round(tracked.reduce((s, d) => s + d.carbs,    0) / tracked.length),
      fats:     Math.round(tracked.reduce((s, d) => s + d.fats,     0) / tracked.length)
    } : { calories: 0, protein: 0, carbs: 0, fats: 0 };

    // Calculate streak (consecutive days with logs, backwards from today)
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].logged || days[i].is_cheat_day) streak++;
      else break;
    }

    res.json({ days, average: avg, streak });

  } catch (err) {
    console.error('weekly summary error:', err);
    res.status(500).json({ message: 'Failed to get weekly summary' });
  }
});

module.exports = router;
