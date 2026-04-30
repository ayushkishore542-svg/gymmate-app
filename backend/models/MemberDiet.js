const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  calories:  { type: Number, default: 0 },
  protein:   { type: Number, default: 0 },
  carbs:     { type: Number, default: 0 },
  fat:       { type: Number, default: 0 },
  quantity:  { type: Number, default: 1 },
  isCustom:  { type: Boolean, default: false },
}, { _id: true });

const mealSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snacks'],
    required: true,
  },
  foods: [foodItemSchema],
}, { _id: false });

const memberDietSchema = new mongoose.Schema({
  memberId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:           { type: String, required: true, index: true }, // 'YYYY-MM-DD'
  meals:          [mealSchema],
  totalCalories:  { type: Number, default: 0 },
  targetCalories: { type: Number, default: 2000 },
  waterGlasses:   { type: Number, default: 0 },
  waterTarget:    { type: Number, default: 8 },
}, { timestamps: true });

memberDietSchema.index({ memberId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MemberDiet', memberDietSchema);
