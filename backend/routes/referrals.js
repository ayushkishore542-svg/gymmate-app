const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Referral = require('../models/Referral');
const Wallet   = require('../models/Wallet');
const User     = require('../models/User');
const auth     = require('../middleware/auth');

// Reward amounts
const OWNER_REWARD  = 250; // ₹250 to code-owner when an owner uses their code
const MEMBER_REWARD = 20;  // ₹20  to code-owner when a member uses their code

// ── GET /api/referrals/my-code/:userId ─────────────────────────────────────
// Returns user's referral code + stats
router.get('/my-code/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ref = await Referral.getOrCreateForUser(userId, user.role);

    const usedCount    = ref.usedBy.length;
    const rewardedCount = ref.usedBy.filter(u => u.rewardGiven).length;

    res.json({
      code:           ref.code,
      usedCount,
      rewardedCount,
      totalEarned:    ref.totalEarned,
      ownerType:      ref.ownerType,
    });
  } catch (err) {
    console.error('[Referrals] my-code error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/referrals/earnings/:userId ─────────────────────────────────────
// Referral earnings history
router.get('/earnings/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const ref = await Referral.findOne({ ownerId: userId })
      .populate('usedBy.userId', 'name loginId gymName role');

    if (!ref) return res.json({ earnings: [], totalEarned: 0 });

    const earnings = ref.usedBy.map(u => ({
      userId:       u.userId?._id,
      userName:     u.userId?.name || 'Unknown',
      loginId:      u.userId?.loginId,
      gymName:      u.userId?.gymName,
      userType:     u.userType,
      usedAt:       u.usedAt,
      rewardGiven:  u.rewardGiven,
      rewardAmount: u.rewardAmount,
      paymentId:    u.paymentId,
    }));

    res.json({ earnings, totalEarned: ref.totalEarned });
  } catch (err) {
    console.error('[Referrals] earnings error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/referrals/validate ────────────────────────────────────────────
// Check if code is valid before registration
// Body: { code, userId (optional — who is using it) }
// Returns: { valid, discountAmount, ownerName }
// NOTE: No auth required — called during registration flow
router.post('/validate', async (req, res) => {
  try {
    const { code, userId, userType } = req.body;
    if (!code) return res.status(400).json({ message: 'Code required' });

    const ref = await Referral.findOne({ code: code.toUpperCase().trim() })
      .populate('ownerId', 'name gymName role');

    if (!ref) {
      return res.json({ valid: false, message: 'Invalid referral code' });
    }

    // Check if same userId already used this exact code
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const alreadyUsed = ref.usedBy.some(
        u => u.userId.toString() === userId.toString()
      );
      if (alreadyUsed) {
        return res.json({ valid: false, message: 'You have already used this code' });
      }
    }

    // Discount depends on who is using: owner = ₹250, member = ₹20
    const discountAmount = (userType === 'member') ? MEMBER_REWARD : OWNER_REWARD;

    res.json({
      valid:          true,
      discountAmount,
      ownerName:      ref.ownerId?.name || 'GymMate User',
      ownerGymName:   ref.ownerId?.gymName || null,
      code:           ref.code,
    });
  } catch (err) {
    console.error('[Referrals] validate error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/referrals/apply ───────────────────────────────────────────────
// Apply referral reward AFTER payment completes
// Body: { code, userId, userType, paymentId }
router.post('/apply', auth, async (req, res) => {
  try {
    const { code, userId, userType, paymentId } = req.body;
    if (!code || !userId || !userType) {
      return res.status(400).json({ message: 'code, userId, userType required' });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const ref = await Referral.findOne({ code: code.toUpperCase().trim() })
      .populate('ownerId', 'name role');

    if (!ref) return res.status(404).json({ message: 'Referral code not found' });

    // Prevent double-application for same userId
    const alreadyApplied = ref.usedBy.some(
      u => u.userId.toString() === userId && u.rewardGiven
    );
    if (alreadyApplied) {
      return res.json({ success: true, message: 'Reward already applied', alreadyApplied: true });
    }

    // Reward amount depends on who used the code
    const rewardAmount = (userType === 'member') ? MEMBER_REWARD : OWNER_REWARD;

    // Add or update usedBy entry
    const existingEntry = ref.usedBy.find(u => u.userId.toString() === userId);
    if (existingEntry) {
      existingEntry.rewardGiven  = true;
      existingEntry.rewardAmount = rewardAmount;
      existingEntry.paymentId    = paymentId || null;
    } else {
      ref.usedBy.push({
        userId,
        userType,
        usedAt:       new Date(),
        rewardGiven:  true,
        rewardAmount,
        paymentId:    paymentId || null,
      });
    }

    ref.totalEarned += rewardAmount;
    await ref.save();

    // Credit the code owner's wallet
    const ownerWallet = await Wallet.getOrCreate(
      ref.ownerId._id,
      ref.ownerType
    );
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    ownerWallet.transactions.push({
      type:        'credit',
      amount:      rewardAmount,
      description: 'Referral reward — ' +
                   (userType === 'member' ? 'member joined' : 'gym owner joined') +
                   ' with your code',
      referenceId: paymentId || code,
      expiresAt,
    });
    ownerWallet.recomputeBalance();
    await ownerWallet.save();

    res.json({
      success:      true,
      rewardAmount,
      ownerBalance: ownerWallet.balance,
      message:      'Referral reward of Rs.' + rewardAmount + ' credited to code owner.',
    });
  } catch (err) {
    console.error('[Referrals] apply error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
