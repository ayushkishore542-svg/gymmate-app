const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['Grains', 'Proteins', 'Dairy', 'Vegetables', 'Fruits',
           'Legumes', 'Fats & Oils', 'Beverages', 'Snacks', 'Sweets', 'Other'],
    default: 'Other'
  },

  // Per serving nutritional values
  calories: { type: Number, required: true },
  protein:  { type: Number, default: 0 }, // grams
  carbs:    { type: Number, default: 0 }, // grams
  fats:     { type: Number, default: 0 }, // grams
  fiber:    { type: Number, default: 0 }, // grams

  serving_size: { type: String, default: '1 serving' }, // e.g. "1 piece (40g)"
  unit:         { type: String, default: 'piece' },      // piece | bowl | glass | gram | tbsp

  search_keywords: [{ type: String, lowercase: true }],

  verified: { type: Boolean, default: true },
  use_count: { type: Number, default: 0 } // for popularity sorting
}, { timestamps: true });

// Text index for fast search
foodSchema.index({ name: 'text', search_keywords: 'text' });
foodSchema.index({ use_count: -1 });

module.exports = mongoose.model('Food', foodSchema);
