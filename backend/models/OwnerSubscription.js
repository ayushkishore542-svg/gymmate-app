const mongoose = require('mongoose');

/**
 * OwnerSubscription — owner plans purchased via Google Play (owner_growth / owner_pro).
 * Kept separate from CalorieSubscription (which is member-only).
 */
const ownerSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  productId: { type: String, required: true },

  purchaseToken: { type: String, required: true },

  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },

  expiryTime: { type: Date },

  payment_method: { type: String, default: 'google_play' }

}, { timestamps: true }); // adds createdAt + updatedAt

module.exports = mongoose.model('OwnerSubscription', ownerSubscriptionSchema);
