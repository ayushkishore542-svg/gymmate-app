const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const authMiddleware = require('../middleware/auth');

// GET /api/dashboard/stats — owner dashboard aggregated stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user._id);

    // Today's date string (YYYY-MM-DD) for attendance query
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Start of current month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // ── Parallel queries ──────────────────────────────────────────────
    const [
      activeNow,
      totalMembers,
      newThisMonth,
      monthlyRevenueAgg,
      dailyRevenueAgg,
    ] = await Promise.all([
      // 1. Members checked in today (distinct members)
      Attendance.distinct('memberId', {
        gymOwnerId: ownerId,
        date: todayStr,
      }).then(ids => ids.length),

      // 2. Total members for this owner
      User.countDocuments({
        gymOwnerId: ownerId,
        role: 'member',
        isActive: true,
      }),

      // 3. New members this month
      User.countDocuments({
        gymOwnerId: ownerId,
        role: 'member',
        createdAt: { $gte: monthStart },
      }),

      // 4. Monthly revenue (completed membership payments this month)
      Payment.aggregate([
        {
          $match: {
            gymOwnerId: ownerId,
            paymentType: 'membership',
            paymentStatus: 'completed',
            createdAt: { $gte: monthStart },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      // 5. Daily revenue — last 7 days
      (() => {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        return Payment.aggregate([
          {
            $match: {
              gymOwnerId: ownerId,
              paymentType: 'membership',
              paymentStatus: 'completed',
              createdAt: { $gte: sevenDaysAgo },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              amount: { $sum: '$amount' },
            },
          },
          { $sort: { _id: 1 } },
        ]);
      })(),
    ]);

    // Build dailyRevenue array with all 7 days (fill gaps with 0)
    const dailyRevenue = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const match = dailyRevenueAgg.find(r => r._id === dateStr);
      dailyRevenue.push({
        date: dateStr,
        amount: match ? match.amount : 0,
      });
    }

    res.json({
      activeNow,
      totalMembers,
      newThisMonth,
      monthlyRevenue: monthlyRevenueAgg[0]?.total || 0,
      dailyRevenue,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Failed to load dashboard stats' });
  }
});

module.exports = router;
