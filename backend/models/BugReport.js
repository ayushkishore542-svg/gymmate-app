const mongoose = require('mongoose');

const bugReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  screenshot: { type: String, default: null },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  }
}, { timestamps: true });

module.exports = mongoose.model('BugReport', bugReportSchema);
