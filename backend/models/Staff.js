const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  gymOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  role: {
    type: String,
    enum: ['trainer', 'manager', 'cleaner', 'receptionist', 'other'],
    default: 'trainer'
  },
  salary: { type: Number, default: 0 },
  joiningDate: { type: Date, default: Date.now },
  photo: { type: String, default: null },
  schedule: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

staffSchema.index({ gymOwnerId: 1 });

module.exports = mongoose.model('Staff', staffSchema);
