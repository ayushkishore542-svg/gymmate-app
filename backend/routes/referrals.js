const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Referral = require('../models/Referral');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// Get my referral code
router.get('/my-code/:ownerId', authMiddleware, async (req, res) => {
  try {
    const owner = await User.findById(req.params.ownerId);
    if (!owner) return res.status(404).json({ message: 'Owner not found' });
    res.json({
      referralCode: owner.referralCode,
      referralEarnings: owner.referralEarnings || 0
    });
  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get referral history
router.get('/history/:ownerId', authMiddleware, async (req, res) => {
  try {
    const referrals = await Referral.find({ referrerId: req.params.ownerId })
      .populate('referredOwnerId', 'name gymName')
      .sort({ createdAt: -1 });
    const totalEarnings = referrals
      .filter(r => r.status === 'active' && r.redeemed)
      .reduce((s, r) => s + r.creditAmount, 0);
    res.json({ referrals, totalEarnings, count: referrals.length });
  } catch (error) {
    console.error('Get referral history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Redeem referral credit
router.post('/redeem', authMiddleware, async (req, res) => {
  try {
    const { referralId } = req.body;
    const referral = await Referral.findById(referralId);
    if (!referral) return res.status(404).json({ message: 'Referral not found' });
    if (referral.redeemed) return res.status(400).json({ message: 'Already redeemed' });
    if (referral.status !== 'active') return res.status(400).json({ message: 'Referral not active' });

    referral.redeemed = true;
    await referral.save();

    // Credit to owner
    const owner = await User.findById(referral.referrerId);
    if (owner) {
      owner.referralEarnings = (owner.referralEarnings || 0) + referral.creditAmount;
      await owner.save();
    }

    res.json({ message: 'Referral redeemed', referral });
  } catch (error) {
    console.error('Redeem referral error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
