const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  id:       { type: String, required: true },
  name:     { type: String, required: true },
  icon:     { type: String, required: true },
  category: { type: String, default: 'Milestone' },
  earnedAt: { type: Date, default: Date.now },
}, { _id: false });

const dailyXPLogSchema = new mongoose.Schema({
  date:   { type: String, required: true },
  earned: { type: Number, default: 0 },
  lost:   { type: Number, default: 0 },
  net:    { type: Number, default: 0 },
}, { _id: false });

const positionHistorySchema = new mongoose.Schema({
  date:     { type: String, required: true },
  position: { type: Number, required: true },
}, { _id: false });

const gamificationSchema = new mongoose.Schema({
  memberId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    unique:   true,
    index:    true,
  },
  lifetimeXP: { type: Number, default: 0 },
  monthlyXP:  { month: { type: String, default: '' }, xp: { type: Number, default: 0 } },
  weeklyXP:   { weekStart: { type: String, default: '' }, xp: { type: Number, default: 0 } },
  dailyXPLog:     { type: [dailyXPLogSchema],     default: [] },
  currentStreak:    { type: Number, default: 0 },
  longestStreak:    { type: Number, default: 0 },
  lastCheckInDate:  { type: Date,   default: null },
  currentMissStreak:{ type: Number, default: 0 },
  lastMissDate:     { type: Date,   default: null },
  positionHistory:  { type: [positionHistorySchema], default: [] },
  consecutiveDaysAtPosition: {
    position: { type: Number, default: 0 },
    days:     { type: Number, default: 0 },
  },
  badges:          { type: [badgeSchema], default: [] },
  totalCheckIns:   { type: Number,  default: 0 },
  monthlyCheckIns: { month: { type: String, default: '' }, count: { type: Number, default: 0 } },
  totalWorkouts:   { type: Number,  default: 0 },
  totalReferrals:  { type: Number,  default: 0 },
  profileComplete: { type: Boolean, default: false },
  feedbackGiven:   { type: Boolean, default: false },
  rank: {
    type:    String,
    enum:    ['Beginner', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'],
    default: 'Beginner',
  },
}, { timestamps: true });

gamificationSchema.index({ lifetimeXP: -1 });
gamificationSchema.index({ 'monthlyXP.xp': -1 });
gamificationSchema.index({ 'weeklyXP.xp': -1 });
gamificationSchema.index({ currentStreak: -1 });
gamificationSchema.index({ totalCheckIns: -1 });

module.exports = mongoose.model('Gamification', gamificationSchema);
