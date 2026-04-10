const mongoose = require('mongoose');

const rankingSchema = new mongoose.Schema({
  user_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name:          { type: String },
  streak_days:   { type: Number, default: 0 }, // out of 7
  meals_logged:  { type: Number, default: 0 },
  avg_calories:  { type: Number, default: 0 },
  avg_protein:   { type: Number, default: 0 },
  score:         { type: Number, default: 0 },
  rank:          { type: Number }
}, { _id: false });

const gymLeaderboardSchema = new mongoose.Schema({
  gym_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',    // owner user
    required: true
  },

  week_start:       { type: Date, required: true },
  week_identifier:  { type: String, required: true }, // "2024-W03"

  rankings:             [rankingSchema],
  total_participants:   { type: Number, default: 0 }

}, { timestamps: true });

gymLeaderboardSchema.index({ gym_id: 1, week_identifier: 1 }, { unique: true });

module.exports = mongoose.model('GymLeaderboard', gymLeaderboardSchema);
