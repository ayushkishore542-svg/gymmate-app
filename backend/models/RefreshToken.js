const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['active', 'revoked', 'replaced'],
      default: 'active',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    // Grace-window rotation: set when this token is rotated into a replacement.
    // Used to distinguish a legit parallel-refresh race from real token theft.
    replacedByHash: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
