const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// Mark attendance via QR scan
router.post('/checkin', authMiddleware, async (req, res) => {
  try {
    const { memberId, gymId } = req.body;

    // Verify member
    const member = await User.findById(memberId);
    if (!member || member.role !== 'member') {
      return res.status(400).json({ message: 'Invalid member' });
    }

    // Verify gym owner
    const gymOwner = await User.findById(gymId);
    if (!gymOwner || gymOwner.role !== 'owner') {
      return res.status(400).json({ message: 'Invalid gym' });
    }

    // Check if member belongs to this gym
    if (member.gymOwnerId.toString() !== gymId) {
      return res.status(403).json({ message: 'Member does not belong to this gym' });
    }

    // Check membership status
    if (member.membershipStatus !== 'active') {
      return res.status(403).json({ message: 'Membership is not active' });
    }

    // Check if membership expired
    if (new Date(member.membershipEndDate) < new Date()) {
      return res.status(403).json({ message: 'Membership has expired' });
    }

    // Check if already checked in today
    const today = new Date().toISOString().split('T')[0];
    const existingAttendance = await Attendance.findOne({
      memberId,
      date: today,
      checkOutTime: null
    });

    if (existingAttendance) {
      return res.status(400).json({ 
        message: 'Already checked in',
        attendance: existingAttendance
      });
    }

    // Create attendance record
    const attendance = new Attendance({
      memberId,
      gymOwnerId: gymId,
      checkInTime: new Date(),
      date: today
    });

    await attendance.save();

    // Update member's last attendance
    member.lastAttendance = new Date();
    await member.save();

    res.status(201).json({
      message: 'Check-in successful',
      attendance,
      member: {
        name: member.name,
        membershipEndDate: member.membershipEndDate
      }
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Checkout
router.post('/checkout', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Find today's attendance
    const attendance = await Attendance.findOne({
      memberId,
      date: today,
      checkOutTime: null
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No active check-in found' });
    }

    // Update checkout time and duration
    attendance.checkOutTime = new Date();
    const durationMs = attendance.checkOutTime - attendance.checkInTime;
    attendance.duration = Math.floor(durationMs / (1000 * 60)); // minutes

    await attendance.save();

    res.json({
      message: 'Check-out successful',
      attendance
    });

  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get attendance for a member
router.get('/member/:memberId', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { startDate, endDate } = req.query;

    let query = { memberId };

    if (startDate && endDate) {
      query.date = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const attendances = await Attendance.find(query)
      .sort({ date: -1, checkInTime: -1 })
      .limit(100);

    // Calculate stats
    const totalDays = attendances.length;
    const totalMinutes = attendances.reduce((sum, att) => sum + (att.duration || 0), 0);
    const avgDuration = totalDays > 0 ? Math.floor(totalMinutes / totalDays) : 0;

    res.json({
      attendances,
      stats: {
        totalDays,
        totalMinutes,
        avgDuration
      }
    });

  } catch (error) {
    console.error('Get member attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get attendance for a gym (all members)
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { date } = req.query;

    let query = { gymOwnerId: ownerId };

    if (date) {
      query.date = date;
    } else {
      // Default to today
      query.date = new Date().toISOString().split('T')[0];
    }

    const attendances = await Attendance.find(query)
      .populate('memberId', 'name email phone')
      .sort({ checkInTime: -1 });

    res.json({ attendances, count: attendances.length });

  } catch (error) {
    console.error('Get gym attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get attendance statistics for gym
router.get('/gym/:ownerId/stats', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { period } = req.query; // 'week', 'month', 'year'

    let startDate = new Date();
    
    switch(period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const attendances = await Attendance.find({
      gymOwnerId: ownerId,
      createdAt: { $gte: startDate }
    });

    // Group by date
    const dailyStats = {};
    attendances.forEach(att => {
      if (!dailyStats[att.date]) {
        dailyStats[att.date] = 0;
      }
      dailyStats[att.date]++;
    });

    // Convert to array
    const stats = Object.keys(dailyStats).map(date => ({
      date,
      count: dailyStats[date]
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ stats, totalAttendances: attendances.length });

  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
