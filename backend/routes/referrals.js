const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Referral = require('../models/Referral');
const Wallet   = require('../models/Wallet');
const User     = require('../models/User');
const auth     = require('../middleware/auth');
const { logger } = require('../utils/logger');

function assertSelfUserId(req, userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return { ok: false, status: 400, message: 'Invalid userId' };
  if (req.user._id.toString() !== userId) return { ok: false, status: 403, message: 'Access denied' };
  return { ok: true };
}

// Reward amounts
const OWNER_REWARD  = 250; // ₹250 to code-owner when an owner uses their code
const MEMBER_REWARD = 20;  // ₹20  to code-owner when a member uses their code

// ── GET /api/referrals/my-code/:userId ─────────────────────────────────────
// Returns user's referral code + stats
router.get('/my-code/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const gate = assertSelfUserId(req, userId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

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
    const gate = assertSelfUserId(req, userId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

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
    const { code, userType } = req.body;
    if (!code) return res.status(400).json({ message: 'Code required' });

    const ref = await Referral.findOne({ code: code.toUpperCase().trim() })
      .populate('ownerId', 'name gymName role');

    if (!ref) {
      return res.json({ valid: false, message: 'Invalid referral code' });
    }

    let trustedUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { verifyAccessToken } = require('../utils/jwtAccess');
        const out = verifyAccessToken(authHeader.split(' ')[1]);
        if (!out.expired && out.decoded && out.decoded._id) {
          trustedUserId = out.decoded._id.toString();
        }
      } catch {
        /* ignore invalid token */
      }
    }

    if (trustedUserId && mongoose.Types.ObjectId.isValid(trustedUserId)) {
      const alreadyUsed = ref.usedBy.some(
        (u) => u.userId.toString() === trustedUserId
      );
      if (alreadyUsed) {
        return res.json({ valid: false, message: 'You have already used this code' });
      }
    }

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
    const { code, paymentId } = req.body;
    const userId = req.user._id.toString();
    const userType = req.user.role;

    if (!code) {
      return res.status(400).json({ message: 'code required' });
    }

    // Reward amount depends on who used the code
    const rewardAmount = (userType === 'member') ? MEMBER_REWARD : OWNER_REWARD;

    // Atomic: apply referral only if userId hasn't already been rewarded.
    // findOneAndUpdate with $elemMatch condition prevents race condition where
    // two concurrent requests both pass the alreadyApplied check.
    const ref = await Referral.findOneAndUpdate(
      {
        code:   code.toUpperCase().trim(),
        usedBy: { $not: { $elemMatch: { userId: new mongoose.Types.ObjectId(userId), rewardGiven: true } } },
      },
      {
        $push: {
          usedBy: {
            userId,
            userType,
            usedAt:       new Date(),
            rewardGiven:  true,
            rewardAmount,
            paymentId:    paymentId || null,
          },
        },
        $inc: { totalEarned: rewardAmount },
      },
      { new: true }
    ).populate('ownerId', 'name role');

    if (!ref) {
      // Either code doesn't exist OR reward already applied — distinguish for caller
      const exists = await Referral.exists({ code: code.toUpperCase().trim() });
      if (!exists) return res.status(404).json({ message: 'Referral code not found' });
      return res.json({ success: true, message: 'Reward already applied', alreadyApplied: true });
    }

    logger.info('referral_apply', { code: ref.code, userId, userType, ip: req.ip, paymentId });

    // Atomically credit code owner's wallet — $inc prevents balance race condition
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);
    const txnDoc = {
      type:        'credit',
      amount:      rewardAmount,
      description: 'Referral reward — ' +
                   (userType === 'member' ? 'member joined' : 'gym owner joined') +
                   ' with your code',
      referenceId: paymentId || code,
      expiresAt,
    };
    await Wallet.getOrCreate(ref.ownerId._id, ref.ownerType);
    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId: ref.ownerId._id },
      { $push: { transactions: txnDoc }, $inc: { balance: rewardAmount } },
      { new: true }
    );

    res.json({
      success:      true,
      rewardAmount,
      ownerBalance: updatedWallet?.balance ?? 0,
      message:      'Referral reward of Rs.' + rewardAmount + ' credited to code owner.',
    });
  } catch (err) {
    console.error('[Referrals] apply error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
