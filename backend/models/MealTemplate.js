const mongoose = require('mongoose');

const mealTemplateFoodSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  calories: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
}, { _id: true });

const mealTemplateSchema = new mongoose.Schema({
  memberId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:      { type: String, required: true },
  foods:     [mealTemplateFoodSchema],
}, { timestamps: true });

module.exports = mongoose.model('MealTemplate', mealTemplateSchema);
