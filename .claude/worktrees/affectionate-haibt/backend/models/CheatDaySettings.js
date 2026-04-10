const mongoose = require('mongoose');

const cheatDaySettingsSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  cheat_day: {
    type: String,
    enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    default: 'Sunday'
  },

  enabled: { type: Boolean, default: false },

  // Calorie goal (daily target)
  calorie_goal:  { type: Number, default: 2000 },
  protein_goal:  { type: Number, default: 80  }, // grams
  carbs_goal:    { type: Number, default: 250 }, // grams
  fats_goal:     { type: Number, default: 65  }, // grams

  history: [{
    date:         { type: Date },
    logged_meals: { type: Boolean, default: false }
  }]

}, { timestamps: true });

module.exports = mongoose.model('CheatDaySettings', cheatDaySettingsSchema);
