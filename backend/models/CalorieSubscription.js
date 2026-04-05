const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  date:           { type: Date, default: Date.now },
  amount:         { type: Number, required: true },
  transaction_id: { type: String, default: '' },
  status:         { type: String, enum: ['success', 'failed'], default: 'success' }
}, { _id: false });

const calorieSubscriptionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  status: {
    type: String,
    enum: ['trial', 'active', 'expired', 'cancelled'],
    default: 'trial'
  },

  trial_start_date:       { type: Date },
  trial_end_date:         { type: Date },
  subscription_start_date:{ type: Date },
  next_billing_date:      { type: Date },

  payment_method: { type: String, default: '' },

  payment_history: [paymentHistorySchema],

  // Allow trial restart once every 6 months
  last_trial_date: { type: Date }

}, { timestamps: true });

// Computed helper
calorieSubscriptionSchema.methods.isAccessible = function () {
  const now = new Date();
  if (this.status === 'trial')  return now <= this.trial_end_date;
  if (this.status === 'active') return now <= this.next_billing_date;
  return false;
};

calorieSubscriptionSchema.methods.daysRemaining = function () {
  const now = new Date();
  if (this.status === 'trial') {
    return Math.max(0, Math.ceil((this.trial_end_date - now) / 86400000));
  }
  if (this.status === 'active') {
    return Math.max(0, Math.ceil((this.next_billing_date - now) / 86400000));
  }
  return 0;
};

module.exports = mongoose.model('CalorieSubscription', calorieSubscriptionSchema);
