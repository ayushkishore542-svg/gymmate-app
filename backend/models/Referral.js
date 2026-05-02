const mongoose = require('mongoose');

// Generate an 8-character alphanumeric uppercase code like GYM7X9K2
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I for readability
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const usedBySchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userType:     { type: String, enum: ['owner', 'member'], required: true },
  usedAt:       { type: Date, default: Date.now },
  rewardGiven:  { type: Boolean, default: false },
  rewardAmount: { type: Number, default: 0 },
  paymentId:    { type: String, default: null },
});

const referralSchema = new mongoose.Schema({
  code:      { type: String, unique: true, required: true, uppercase: true, trim: true },
  ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  ownerType: { type: String, enum: ['owner', 'member'], required: true },
  usedBy:    [usedBySchema],
  totalEarned: { type: Number, default: 0 }, // lifetime wallet credits
}, { timestamps: true });

referralSchema.index({ code: 1 });
referralSchema.index({ ownerId: 1 });

// Static: generate unique code
referralSchema.statics.generateUniqueCode = async function () {
  let code, exists;
  do {
    code = generateCode();
    exists = await this.findOne({ code });
  } while (exists);
  return code;
};

// Static: get or create referral record for a user
referralSchema.statics.getOrCreateForUser = async function (userId, userType) {
  let ref = await this.findOne({ ownerId: userId });
  if (!ref) {
    const code = await this.generateUniqueCode();
    ref = await this.create({ code, ownerId: userId, ownerType: userType });
  }
  return ref;
};

module.exports = mongoose.model('Referral', referralSchema);
