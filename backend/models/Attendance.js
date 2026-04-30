const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  gymOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  checkInTime: {
    type: Date,
    default: Date.now
  },
  
  checkOutTime: {
    type: Date,
    default: null
  },
  
  duration: {
    type: Number, // in minutes — null means unknown/not recorded
    default: null
  },

  // true when member never checked out and session was auto-closed
  durationUnknown: {
    type: Boolean,
    default: false
  },

  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  }
}, {
  timestamps: true
});

// Index for fast queries
attendanceSchema.index({ memberId: 1, date: 1 });
attendanceSchema.index({ gymOwnerId: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
