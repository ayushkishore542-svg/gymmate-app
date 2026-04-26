const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  gymOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: { type: String, required: true },
  startTime: { type: String, required: true },   // "06:00"
  endTime: { type: String, required: true },     // "07:30"
  maxCapacity: { type: Number, default: 20 },
  trainerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

batchSchema.index({ gymOwnerId: 1 });

module.exports = mongoose.model('Batch', batchSchema);
