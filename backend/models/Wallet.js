const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit', 'withdrawal'],
    required: true,
  },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  referenceId: { type: String, default: null },
  expiresAt: { type: Date, default: null }, // 12 months from credit date (null for debit/withdrawal)
}, { timestamps: true });

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  userType: {
    type: String,
    enum: ['owner', 'member'],
    required: true,
  },
  balance: { type: Number, default: 0 },
  transactions: [transactionSchema],

  // Withdrawal details (optional, saved for future use)
  upiId: { type: String, default: null },
  bankAccount: {
    accountNumber: { type: String, default: null },
    ifsc:          { type: String, default: null },
    accountName:   { type: String, default: null },
  },
}, { timestamps: true });

// ── Helper: recompute balance from non-expired credits minus debits ──────────
walletSchema.methods.recomputeBalance = function () {
  const now = new Date();
  let bal = 0;
  for (const tx of this.transactions) {
    if (tx.type === 'credit') {
      // Only count if not yet expired
      if (!tx.expiresAt || tx.expiresAt > now) {
        bal += tx.amount;
      }
    } else if (tx.type === 'debit' || tx.type === 'withdrawal') {
      bal -= tx.amount;
    }
  }
  this.balance = Math.max(0, bal);
  return this.balance;
};

// ── Static: get or create wallet for a user ──────────────────────────────────
walletSchema.statics.getOrCreate = async function (userId, userType) {
  let wallet = await this.findOne({ userId });
  if (!wallet) {
    wallet = await this.create({ userId, userType, balance: 0, transactions: [] });
  }
  return wallet;
};

module.exports = mongoose.model('Wallet', walletSchema);
