const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // For Owner or Member
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Payment Type
  paymentType: {
    type: String,
    enum: ['subscription', 'membership'], // subscription for owners, membership for members
    required: true
  },
  
  // Amount
  amount: {
    type: Number,
    required: true
  },
  
  // Payment Details
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'card', 'bank_transfer'],
    default: 'cash'
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
  },
  
  // Period covered by this payment
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  
  // Referral discount applied
  discountApplied: {
    type: Number,
    default: 0
  },
  
  // Transaction details
  transactionId: {
    type: String,
    default: null
  },
  
  notes: {
    type: String,
    default: ''
  },
  
  // For member payments - who received it
  gymOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
