const mongoose = require('mongoose');

/**
 * TrialUsage — tracks which phone numbers have already consumed the 15-day free trial.
 * Checked during owner registration to prevent trial abuse via multiple accounts.
 */
const trialUsageSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  gymOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  usedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: false });

module.exports = mongoose.model('TrialUsage', trialUsageSchema);
