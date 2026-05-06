const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { verifyPaymentCaptureSignature } = require('../services/razorpayService');
const { logger } = require('../utils/logger');

const OWNER_REFERRAL_DISCOUNT = 250;

// Record a payment (owner only — gym membership collections)
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only gym owners can record payments' });
    }

    const {
      userId,
      paymentType,
      amount,
      paymentMethod,
      periodStart,
      periodEnd,
      notes,
    } = req.body;

    const gymOwnerId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    const member = await User.findById(userId).select('role gymOwnerId');
    if (!member || member.role !== 'member' || member.gymOwnerId.toString() !== gymOwnerId.toString()) {
      return res.status(403).json({ message: 'Invalid member for this gym' });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt > 10_000_000) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const payment = new Payment({
      userId,
      paymentType,
      amount: amt,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: 'completed',
      periodStart,
      periodEnd,
      notes: notes || '',
      gymOwnerId,
    });

    await payment.save();

    res.status(201).json({
      message: 'Payment recorded successfully',
      payment,
    });
  } catch (error) {
    logger.error('Create payment error', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all payments for a user
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (req.user._id.toString() === userId) {
      const payments = await Payment.find({ userId })
        .sort({ createdAt: -1 })
        .populate('gymOwnerId', 'name gymName')
        .lean();
      return res.json({ payments });
    }

    if (req.user.role === 'owner') {
      const member = await User.findById(userId).select('gymOwnerId role');
      if (!member || member.role !== 'member' || member.gymOwnerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const payments = await Payment.find({ userId })
        .sort({ createdAt: -1 })
        .populate('gymOwnerId', 'name gymName')
        .lean();
      return res.json({ payments });
    }

    return res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    logger.error('Get user payments error', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all payments for a gym owner
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    if (req.user.role !== 'owner' || req.user._id.toString() !== ownerId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    const payments = await Payment.find({ gymOwnerId: ownerObjectId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone');

    // Calculate total revenue
    const totalRevenue = payments.reduce((sum, payment) => {
      return payment.paymentStatus === 'completed' ? sum + payment.amount : sum;
    }, 0);

    res.json({ 
      payments, 
      totalRevenue,
      count: payments.length 
    });

  } catch (error) {
    console.error('Get gym payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Process subscription payment for gym owner
router.post('/subscription', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Owners only' });
    }

    const {
      ownerId,
      paymentMethod,
      durationMonths,
      referralCode,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    if (!ownerId || ownerId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Invalid owner' });
    }

    const owner = await User.findById(ownerId);
    if (!owner || owner.role !== 'owner') {
      return res.status(400).json({ message: 'Invalid owner' });
    }

    const baseAmount = Number(owner.subscriptionFee) > 0 ? Number(owner.subscriptionFee) : 699;
    let finalAmount = baseAmount;
    let discountApplied = 0;

    const refNorm = referralCode ? String(referralCode).trim().toUpperCase() : '';
    const ownerRef = owner.referredBy ? String(owner.referredBy).trim().toUpperCase() : '';
    if (refNorm && ownerRef && refNorm === ownerRef) {
      discountApplied = OWNER_REFERRAL_DISCOUNT;
      finalAmount = Math.max(0, baseAmount - discountApplied);

      const referrer = await User.findOne({ referralCode: ownerRef });
      if (referrer) {
        referrer.referralEarnings += OWNER_REFERRAL_DISCOUNT;
        await referrer.save();
      }
    }

    const method = (paymentMethod || 'cash').toLowerCase();
    if (['upi', 'card', 'razorpay', 'bank_transfer'].includes(method)) {
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ message: 'Razorpay order id, payment id, and signature required' });
      }
      const ok = verifyPaymentCaptureSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      if (!ok) {
        logger.warn('subscription_payment_signature_invalid', { ownerId: String(owner._id), ip: req.ip });
        return res.status(400).json({ message: 'Invalid payment signature' });
      }
      const existing = await Payment.findOne({ externalDedupeKey: razorpayPaymentId });
      if (existing) {
        return res.json({
          message: 'Payment already processed',
          payment: existing,
          owner: {
            subscriptionStatus: owner.subscriptionStatus,
            subscriptionEndDate: owner.subscriptionEndDate,
          },
        });
      }
    }

    // Calculate subscription period
    const now = new Date();
    const currentEnd = new Date(owner.subscriptionEndDate);
    const startDate = currentEnd > now ? currentEnd : now;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + (durationMonths || 1));

    // Update owner subscription
    owner.subscriptionStatus = 'active';
    owner.subscriptionEndDate = endDate;
    await owner.save();

    const payment = new Payment({
      userId: ownerId,
      paymentType: 'subscription',
      amount: finalAmount,
      paymentMethod: method,
      paymentStatus: 'completed',
      periodStart: startDate,
      periodEnd: endDate,
      discountApplied,
      razorpayOrderId: razorpayOrderId || null,
      razorpayPaymentId: razorpayPaymentId || null,
      externalDedupeKey: razorpayPaymentId || null,
    });

    try {
      await payment.save();
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ message: 'Duplicate payment' });
      }
      throw e;
    }

    res.json({ 
      message: 'Subscription payment processed successfully', 
      payment,
      owner: {
        subscriptionStatus: owner.subscriptionStatus,
        subscriptionEndDate: owner.subscriptionEndDate
      }
    });

  } catch (error) {
    logger.error('Process subscription error', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment statistics
router.get('/gym/:ownerId/stats', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    if (req.user.role !== 'owner' || req.user._id.toString() !== ownerId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    const { period } = req.query; // 'month', 'year'

    let startDate = new Date();
    
    if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else {
      startDate.setMonth(startDate.getMonth() - 1); // Default to last month
    }

    const payments = await Payment.find({
      gymOwnerId: ownerObjectId,
      paymentStatus: 'completed',
      createdAt: { $gte: startDate }
    });

    // Calculate stats
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPayments = payments.length;
    
    // Group by month
    const monthlyRevenue = {};
    payments.forEach(payment => {
      const month = payment.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyRevenue[month]) {
        monthlyRevenue[month] = 0;
      }
      monthlyRevenue[month] += payment.amount;
    });

    const monthlyStats = Object.keys(monthlyRevenue).map(month => ({
      month,
      revenue: monthlyRevenue[month]
    })).sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      totalRevenue,
      totalPayments,
      monthlyStats
    });

  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Revenue summary for owner dashboard
router.get('/summary/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    if (req.user.role !== 'owner' || req.user._id.toString() !== ownerId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // All membership payments for this gym
    const allPayments = await Payment.find({
      gymOwnerId: ownerObjectId,
      paymentType: 'membership'
    }).populate('userId', 'name loginId phone membershipPlan membershipEndDate membershipStatus');

    const thisMonthPayments = allPayments.filter(p => new Date(p.createdAt) >= monthStart);

    const collected = thisMonthPayments
      .filter(p => p.paymentStatus === 'completed')
      .reduce((s, p) => s + p.amount, 0);

    const pending = allPayments
      .filter(p => p.paymentStatus === 'pending')
      .reduce((s, p) => s + p.amount, 0);

    const overdue = allPayments
      .filter(p => p.paymentStatus === 'pending' && new Date(p.periodEnd) < now)
      .reduce((s, p) => s + p.amount, 0);

    // Member-wise payment list
    const memberPayments = allPayments.map(p => ({
      _id: p._id,
      memberId: p.userId?._id,
      name: p.userId?.name || 'Unknown',
      loginId: p.userId?.loginId,
      plan: p.userId?.membershipPlan,
      amount: p.amount,
      dueDate: p.periodEnd,
      paidDate: p.paymentStatus === 'completed' ? p.createdAt : null,
      status: p.paymentStatus === 'completed' ? 'Paid'
        : (new Date(p.periodEnd) < now ? 'Overdue' : 'Pending')
    }));

    res.json({
      collected,
      pending,
      overdue,
      memberPayments,
      count: memberPayments.length
    });
  } catch (error) {
    console.error('Payment summary error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/payments/member/:memberId — payment history for a specific member
router.get('/member/:memberId', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: 'Invalid member ID' });
    }
    if (req.user.role === 'member' && req.user._id.toString() !== memberId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'owner') {
      const m = await User.findById(memberId).select('gymOwnerId role');
      if (!m || m.role !== 'member' || m.gymOwnerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    if (req.user.role !== 'owner' && req.user.role !== 'member') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const payments = await Payment.find({ userId: new mongoose.Types.ObjectId(memberId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ payments });
  } catch (error) {
    logger.error('Member payment history error', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
