const mongoose = require('mongoose');

/** Idempotent Razorpay webhook processing */
const processedWebhookSchema = new mongoose.Schema(
  {
    dedupeKey: { type: String, required: true, unique: true },
    eventType: { type: String, default: '' },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProcessedWebhook', processedWebhookSchema);
