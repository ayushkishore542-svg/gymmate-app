const mongoose = require('mongoose');

const photoEntrySchema = new mongoose.Schema({
  month:       { type: String, required: true }, // "Jan 2024"
  year_month:  { type: String, required: true }, // "2024-01"  for querying
  image_url:   { type: String, default: '' },
  weight:      { type: Number },               // kg
  notes:       { type: String, default: '' },
  uploaded_at: { type: Date, default: Date.now }
}, { _id: true });

const progressPhotoSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  photos: [photoEntrySchema]
}, { timestamps: true });

module.exports = mongoose.model('ProgressPhoto', progressPhotoSchema);
