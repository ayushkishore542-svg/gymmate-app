const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// Record a payment
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      userId, 
      paymentType, 
      amount, 
      paymentMethod, 
      periodStart, 
      periodEnd,
      notes,
      gymOwnerId 
    } = req.body;

    const payment = new Payment({
      userId,
      paymentType,
      amount,
      paymentMethod,
      paymentStatus: 'completed',
      periodStart,
      periodEnd,
      notes,
      gymOwnerId
    });

    await payment.save();

    res.status(201).json({ 
      message: 'Payment recorded successfully', 
      payment 
    });

  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all payments for a user
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .populate('gymOwnerId', 'name gymName');

    res.json({ payments });

  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all payments for a gym owner
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;

    const payments = await Payment.find({ gymOwnerId: ownerId })
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
    const { 
      ownerId, 
      amount, 
      paymentMethod, 
      durationMonths,
      referralCode 
    } = req.body;

    const owner = await User.findById(ownerId);
    if (!owner || owner.role !== 'owner') {
      return res.status(400).json({ message: 'Invalid owner' });
    }

    let finalAmount = amount;
    let discountApplied = 0;

    // Apply referral discount if applicable
    if (referralCode && owner.referredBy === referralCode) {
      discountApplied = 200; // Rs. 200 discount
      finalAmount = amount - discountApplied;

      // Credit referrer
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referrer.referralEarnings += 200;
        await referrer.save();
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

    // Create payment record
    const payment = new Payment({
      userId: ownerId,
      paymentType: 'subscription',
      amount: finalAmount,
      paymentMethod,
      paymentStatus: 'completed',
      periodStart: startDate,
      periodEnd: endDate,
      discountApplied
    });

    await payment.save();

    res.json({ 
      message: 'Subscription payment processed successfully', 
      payment,
      owner: {
        subscriptionStatus: owner.subscriptionStatus,
        subscriptionEndDate: owner.subscriptionEndDate
      }
    });

  } catch (error) {
    console.error('Process subscription error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get payment statistics
router.get('/gym/:ownerId/stats', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
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
      gymOwnerId: ownerId,
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

module.exports = router;
