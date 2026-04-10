const mongoose = require('mongoose');

const mealItemSchema = new mongoose.Schema({
  food_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
  food_name:  { type: String, required: true }, // denormalised for display
  quantity:   { type: Number, required: true, min: 0.1 },
  unit:       { type: String, default: 'piece' },
  calories:   { type: Number, required: true },
  protein:    { type: Number, default: 0 },
  carbs:      { type: Number, default: 0 },
  fats:       { type: Number, default: 0 }
}, { _id: true });

const mealSchema = new mongoose.Schema({
  meal_type: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2', 'snack3', 'snack4'],
    required: true
  },
  time:           { type: String, default: '' }, // "8:30 AM"
  items:          [mealItemSchema],
  total_calories: { type: Number, default: 0 },
  macros: {
    protein: { type: Number, default: 0 },
    carbs:   { type: Number, default: 0 },
    fats:    { type: Number, default: 0 }
  }
}, { _id: true });

const dailyMealSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  date: { type: Date, required: true }, // start-of-day UTC

  meals: [mealSchema],

  daily_summary: {
    total_calories: { type: Number, default: 0 },
    protein:        { type: Number, default: 0 },
    carbs:          { type: Number, default: 0 },
    fats:           { type: Number, default: 0 },
    meal_count:     { type: Number, default: 0 }
  },

  is_cheat_day: { type: Boolean, default: false },

  // TTL field — MongoDB auto-deletes after 30 days
  expires_at: { type: Date, required: true }

}, { timestamps: true });

// Compound index for fast user+date lookup
dailyMealSchema.index({ user_id: 1, date: 1 }, { unique: true });

// TTL index — auto-deletes documents 0 seconds after expires_at
dailyMealSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Helper to recalculate daily_summary
dailyMealSchema.methods.recalculate = function () {
  let cal = 0, pro = 0, carb = 0, fat = 0;
  this.meals.forEach(m => {
    cal  += m.total_calories;
    pro  += m.macros.protein;
    carb += m.macros.carbs;
    fat  += m.macros.fats;
  });
  this.daily_summary = {
    total_calories: Math.round(cal),
    protein:        Math.round(pro),
    carbs:          Math.round(carb),
    fats:           Math.round(fat),
    meal_count:     this.meals.length
  };
};

module.exports = mongoose.model('DailyMeal', dailyMealSchema);
