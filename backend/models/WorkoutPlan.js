const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sets: { type: Number, default: 3 },
  reps: { type: Number, default: 12 },
  restSeconds: { type: Number, default: 60 },
  muscleGroup: { type: String, default: '' }
}, { _id: true });

const workoutPlanSchema = new mongoose.Schema({
  gymOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'weight_loss', 'muscle_gain', 'custom'],
    default: 'custom'
  },
  durationWeeks: { type: Number, default: 4 },
  exercises: [exerciseSchema],
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isTemplate: { type: Boolean, default: false }
}, { timestamps: true });

workoutPlanSchema.index({ gymOwnerId: 1 });

module.exports = mongoose.model('WorkoutPlan', workoutPlanSchema);
