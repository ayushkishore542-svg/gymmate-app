const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  gymOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  overallRating: { type: Number, min: 1, max: 5, required: true },
  trainerRating: { type: Number, min: 1, max: 5, default: null },
  cleanlinessRating: { type: Number, min: 1, max: 5, default: null },
  equipmentRating: { type: Number, min: 1, max: 5, default: null },
  comment: { type: String, default: '' }
}, { timestamps: true });

feedbackSchema.index({ gymOwnerId: 1 });
feedbackSchema.index({ memberId: 1, gymOwnerId: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
