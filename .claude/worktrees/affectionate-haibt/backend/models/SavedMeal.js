const mongoose = require('mongoose');

const savedItemSchema = new mongoose.Schema({
  food_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
  food_name: { type: String, required: true },
  quantity:  { type: Number, required: true },
  unit:      { type: String, default: 'piece' },
  calories:  { type: Number, required: true },
  protein:   { type: Number, default: 0 },
  carbs:     { type: Number, default: 0 },
  fats:      { type: Number, default: 0 }
}, { _id: false });

const savedMealEntrySchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  items:          [savedItemSchema],
  total_calories: { type: Number, default: 0 },
  macros: {
    protein: { type: Number, default: 0 },
    carbs:   { type: Number, default: 0 },
    fats:    { type: Number, default: 0 }
  },
  created_at: { type: Date, default: Date.now }
}, { _id: true });

const savedMealSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  meals: {
    type: [savedMealEntrySchema],
    validate: {
      validator: (arr) => arr.length <= 3,
      message: 'Maximum 3 saved meals allowed'
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('SavedMeal', savedMealSchema);
