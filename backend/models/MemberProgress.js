const mongoose = require('mongoose');

const memberProgressSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:     { type: Date, default: Date.now },
  weight:   { type: Number }, // kg
  height:   { type: Number }, // cm
  chest:    { type: Number }, // cm
  waist:    { type: Number }, // cm
  biceps:   { type: Number }, // cm
  thighs:   { type: Number }, // cm
  bmi:      { type: Number },
  photos:   [{ type: String }],
  notes:    { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('MemberProgress', memberProgressSchema);
