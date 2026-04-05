const mongoose = require('mongoose');

const glassSchema = new mongoose.Schema({
  time:      { type: Date, default: Date.now },
  amount_ml: { type: Number, default: 250 }
}, { _id: false });

const waterLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  date: { type: Date, required: true },

  glasses:   [glassSchema],
  total_ml:  { type: Number, default: 0 },
  goal_ml:   { type: Number, default: 2000 },
  achieved:  { type: Boolean, default: false },

  // TTL — auto-delete after 30 days
  expires_at: { type: Date, required: true }

}, { timestamps: true });

waterLogSchema.index({ user_id: 1, date: 1 }, { unique: true });
waterLogSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('WaterLog', waterLogSchema);
