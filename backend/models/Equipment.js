const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  gymOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  purchaseDate: { type: Date, default: null },
  warrantyExpiry: { type: Date, default: null },
  cost: { type: Number, default: 0 },
  condition: {
    type: String,
    enum: ['new', 'good', 'needs_repair', 'out_of_order'],
    default: 'new'
  },
  photo: { type: String, default: null }
}, { timestamps: true });

equipmentSchema.index({ gymOwnerId: 1 });

module.exports = mongoose.model('Equipment', equipmentSchema);
