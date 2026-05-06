const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Wallet   = require('../models/Wallet');
const auth     = require('../middleware/auth');
const { logger } = require('../utils/logger');

function assertWalletSelf(req, userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return { ok: false, status: 400, message: 'Invalid userId' };
  if (req.user._id.toString() !== userId) return { ok: false, status: 403, message: 'Access denied' };
  return { ok: true };
}

// ── GET /api/wallet/transactions/:userId (must be before /:userId) ──────────
router.get('/transactions/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const gate = assertWalletSelf(req, userId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
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
    logger.error('[Wallet] transactions error', { err: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/wallet/:userId — balance + last 20 transactions
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const gate = assertWalletSelf(req, userId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
    const userType = req.user.role || 'owner';
    const wallet = await Wallet.getOrCreate(userId, userType);
    wallet.recomputeBalance();

    const now = new Date();
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
    logger.error('[Wallet] GET error', { err: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/wallet/credit — disabled (credits are applied server-side only)
router.post('/credit', auth, async (_req, res) => {
  return res.status(403).json({ message: 'Forbidden' });
});

// ── POST /api/wallet/withdraw ────────────────────────────────────────────────
// Body: { userId, amount, upiId } OR { userId, amount, bankAccount: { accountNumber, ifsc, accountName } }
// Deductions: 2% gateway + 10% TDS = 12% total
const UPI_REGEX = /^[\w.\-]{2,256}@[\w.\-]{2,64}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

router.post('/withdraw', auth, async (req, res) => {
  try {
    const { userId, amount, upiId, bankAccount } = req.body;

    const gate = assertWalletSelf(req, userId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    if (!amount || amount < 500) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is ₹500' });
    }
    if (!upiId && !bankAccount) {
      return res.status(400).json({ message: 'UPI ID or bank account details required' });
    }
    if (upiId && !UPI_REGEX.test(String(upiId).trim())) {
      return res.status(400).json({ message: 'Invalid UPI ID format' });
    }
    if (bankAccount) {
      const { ifsc } = bankAccount;
      if (!ifsc || !IFSC_REGEX.test(String(ifsc).trim().toUpperCase())) {
        return res.status(400).json({ message: 'Invalid IFSC format' });
      }
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

    wallet.recomputeBalance();
    if (wallet.balance < amount) {
      return res.status(400).json({
        message: `Insufficient balance. Available: ₹${wallet.balance}`,
      });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const withdrawnToday = wallet.transactions
      .filter((t) => t.type === 'withdrawal' && new Date(t.createdAt) >= startOfDay)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const DAILY_CAP = 10_000;
    if (withdrawnToday + amount > DAILY_CAP) {
      return res.status(400).json({
        message: `Daily withdrawal limit is ₹${DAILY_CAP}. Already withdrawn ₹${withdrawnToday} today.`,
      });
    }

    logger.info('wallet_withdraw', { userId, amount, ip: req.ip });

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
    const gate = assertWalletSelf(req, userId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
    if (!UPI_REGEX.test(String(upiId).trim())) {
      return res.status(400).json({ message: 'Invalid UPI ID format' });
    }

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
    const gate = assertWalletSelf(req, userId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });
    if (!IFSC_REGEX.test(String(ifsc).trim().toUpperCase())) {
      return res.status(400).json({ message: 'Invalid IFSC format' });
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
