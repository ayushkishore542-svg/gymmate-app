const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Wallet   = require('../models/Wallet');
const auth     = require('../middleware/auth');

// ── GET /api/wallet/:userId ──────────────────────────────────────────────────
// Returns wallet balance + last 20 transactions
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    const userType = req.user.role || 'owner';
    const wallet = await Wallet.getOrCreate(userId, userType);
    wallet.recomputeBalance();

    const now = new Date();
    // Filter to last 20 transactions, newest first
    const txns = [...wallet.transactions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20)
      .map(t => ({
        _id:         t._id,
        type:        t.type,
        amount:      t.amount,
        description: t.description,
        referenceId: t.referenceId,
        createdAt:   t.createdAt,
        expiresAt:   t.expiresAt,
        expired:     t.type === 'credit' && t.expiresAt && new Date(t.expiresAt) < now,
      }));

    res.json({
      balance:      wallet.balance,
      upiId:        wallet.upiId,
      bankAccount:  wallet.bankAccount,
      transactions: txns,
    });
  } catch (err) {
    console.error('[Wallet] GET error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/wallet/transactions/:userId ────────────────────────────────────
// Full transaction history
router.get('/transactions/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return res.json({ transactions: [] });

    const now = new Date();
    const txns = [...wallet.transactions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(t => ({
        _id:         t._id,
        type:        t.type,
        amount:      t.amount,
        description: t.description,
        referenceId: t.referenceId,
        createdAt:   t.createdAt,
        expiresAt:   t.expiresAt,
        expired:     t.type === 'credit' && t.expiresAt && new Date(t.expiresAt) < now,
      }));

    res.json({ transactions: txns, total: txns.length });
  } catch (err) {
    console.error('[Wallet] transactions error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/wallet/credit (internal helper, called by referral system) ─────
// Body: { userId, userType, amount, description, referenceId }
router.post('/credit', auth, async (req, res) => {
  try {
    const { userId, userType, amount, description, referenceId } = req.body;
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'userId and positive amount required' });
    }
    const wallet = await Wallet.getOrCreate(userId, userType || 'owner');

    // Credit expires 12 months from now
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    wallet.transactions.push({
      type: 'credit',
      amount,
      description: description || 'Referral reward',
      referenceId: referenceId || null,
      expiresAt,
    });
    wallet.recomputeBalance();
    await wallet.save();

    res.json({ success: true, balance: wallet.balance });
  } catch (err) {
    console.error('[Wallet] credit error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/wallet/withdraw ────────────────────────────────────────────────
// Body: { userId, amount, upiId } OR { userId, amount, bankAccount: { accountNumber, ifsc, accountName } }
// Deductions: 2% gateway + 10% TDS = 12% total
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { userId, amount, upiId, bankAccount } = req.body;

    if (!userId) return res.status(400).json({ message: 'userId required' });
    if (!amount || amount < 500) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is ₹500' });
    }
    if (!upiId && !bankAccount) {
      return res.status(400).json({ message: 'UPI ID or bank account details required' });
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

    wallet.recomputeBalance();
    if (wallet.balance < amount) {
      return res.status(400).json({
        message: `Insufficient balance. Available: ₹${wallet.balance}`,
      });
    }

    // Calculate net amount after 12% deduction
    const deductionPct  = 0.12; // 2% gateway + 10% TDS
    const deductionAmt  = Math.round(amount * deductionPct);
    const netAmount     = amount - deductionAmt;

    // Save UPI/bank for future use if provided
    if (upiId) wallet.upiId = upiId;
    if (bankAccount) wallet.bankAccount = bankAccount;

    wallet.transactions.push({
      type: 'withdrawal',
      amount,
      description: upiId
        ? 'Cash withdrawal to UPI: ' + upiId
        : 'Cash withdrawal to bank account',
      referenceId: 'WITHDRAW_' + Date.now(),
      expiresAt: null,
    });
    wallet.recomputeBalance();
    await wallet.save();

    res.json({
      success:       true,
      withdrawnAmt:  amount,
      deductionAmt,
      netAmount,
      method:        upiId ? 'UPI' : 'Bank',
      balance:       wallet.balance,
      message:       `Withdrawal request of ₹${amount} submitted. You will receive ₹${netAmount} after deductions.`,
    });
  } catch (err) {
    console.error('[Wallet] withdraw error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/wallet/link-upi ────────────────────────────────────────────────
router.post('/link-upi', auth, async (req, res) => {
  try {
    const { userId, upiId } = req.body;
    if (!userId || !upiId) return res.status(400).json({ message: 'userId and upiId required' });

    const wallet = await Wallet.getOrCreate(userId, req.user.role || 'owner');
    wallet.upiId = upiId.trim();
    await wallet.save();

    res.json({ success: true, upiId: wallet.upiId });
  } catch (err) {
    console.error('[Wallet] link-upi error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/wallet/link-bank ────────────────────────────────────────────────
router.post('/link-bank', auth, async (req, res) => {
  try {
    const { userId, accountNumber, ifsc, accountName } = req.body;
    if (!userId || !accountNumber || !ifsc || !accountName) {
      return res.status(400).json({ message: 'All bank account fields required' });
    }

    const wallet = await Wallet.getOrCreate(userId, req.user.role || 'owner');
    wallet.bankAccount = { accountNumber, ifsc, accountName };
    await wallet.save();

    res.json({ success: true, bankAccount: wallet.bankAccount });
  } catch (err) {
    console.error('[Wallet] link-bank error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
