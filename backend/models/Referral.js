const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referredGymName: { type: String, default: '' },
  referredOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralCode: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'active', 'expired'],
    default: 'pending'
  },
  creditAmount: { type: Number, default: 200 },
  redeemed: { type: Boolean, default: false }
}, { timestamps: true });

referralSchema.index({ referrerId: 1 });

module.exports = mongoose.model('Referral', referralSchema);
