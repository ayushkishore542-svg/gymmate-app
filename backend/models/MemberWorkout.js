const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sets: { type: Number, default: 3 },
  reps: { type: Number, default: 10 },
  weight: { type: Number, default: 0 },
  muscleGroup: {
    type: String,
    enum: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'],
    default: 'Chest',
  },
  done: { type: Boolean, default: false },
}, { _id: true });

const memberWorkoutSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:     { type: Date, default: Date.now, index: true },
  templateName: { type: String, default: '' },
  exercises:    [exerciseSchema],
  notes:        { type: String, default: '' },
  completed:    { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('MemberWorkout', memberWorkoutSchema);
