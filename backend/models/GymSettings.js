const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  duration: { type: Number, required: true }, // months
  price:    { type: Number, required: true }, // INR
}, { _id: true });

const gymSettingsSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },

  // Operating hours
  openTime:  { type: String, default: '05:00' },  // HH:mm
  closeTime: { type: String, default: '23:00' },

  // Capacity
  maxCapacity: { type: Number, default: 50 },

  // Trial
  trialPeriodDays: { type: Number, default: 3 },

  // Membership plans
  membershipPlans: {
    type: [membershipPlanSchema],
    default: [
      { name: 'Monthly',   duration: 1,  price: 1000 },
      { name: 'Quarterly', duration: 3,  price: 2500 },
      { name: 'Yearly',    duration: 12, price: 8000 },
    ],
  },

  // Notification preferences
  notifications: {
    pushEnabled:          { type: Boolean, default: true },
    newMember:            { type: Boolean, default: true },
    paymentReceived:      { type: Boolean, default: true },
    membershipExpiring:   { type: Boolean, default: true },
    dailyAttendance:      { type: Boolean, default: false },
    newVisitor:           { type: Boolean, default: true },
  },
}, { timestamps: true });

module.exports = mongoose.model('GymSettings', gymSettingsSchema);
