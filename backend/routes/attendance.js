const express = require('express');
const mongoose = require('mongoose');
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

    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    const { date } = req.query;

    let query = { gymOwnerId: ownerObjectId };

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

    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

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
      gymOwnerId: ownerObjectId,
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

// Attendance report — grouped by member for a date range
router.get('/report/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    let { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      const now = new Date();
      endDate = now.toISOString().split('T')[0];
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      startDate = start.toISOString().split('T')[0];
    }

    const attendances = await Attendance.find({
      gymOwnerId: ownerObjectId,
      date: { $gte: startDate, $lte: endDate }
    }).populate('memberId', 'name loginId phone');

    // Group by member
    const memberMap = {};
    attendances.forEach(att => {
      const mid = att.memberId?._id?.toString();
      if (!mid) return;
      if (!memberMap[mid]) {
        memberMap[mid] = {
          memberId: mid,
          name: att.memberId.name,
          loginId: att.memberId.loginId,
          daysPresent: 0,
          records: []
        };
      }
      memberMap[mid].daysPresent++;
      memberMap[mid].records.push({
        date: att.date,
        checkInTime: att.checkInTime,
        checkOutTime: att.checkOutTime
      });
    });

    const totalDaysInRange = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1);
    const members = Object.values(memberMap).map(m => ({
      ...m,
      attendancePercent: Math.round((m.daysPresent / totalDaysInRange) * 100)
    }));

    const todayStr = new Date().toISOString().split('T')[0];
    const todayCheckins = attendances.filter(a => a.date === todayStr).length;

    res.json({
      members,
      summary: {
        totalCheckinsToday: todayCheckins,
        averageAttendance: members.length > 0
          ? Math.round(members.reduce((s, m) => s + m.attendancePercent, 0) / members.length)
          : 0,
        totalMembers: members.length
      }
    });
  } catch (error) {
    console.error('Attendance report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get count of currently checked-in members (checked in today, not yet checked out)
router.get('/active-count/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const today = new Date().toISOString().split('T')[0];

    const activeCount = await Attendance.countDocuments({
      gymOwnerId: ownerObjectId,
      date: today,
      checkOutTime: null,
    });

    res.json({ activeCount, date: today });
  } catch (error) {
    console.error('Active count error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// QR-based check-in (no auth — called by member's phone scanning QR)
router.post('/qr-checkin', async (req, res) => {
  try {
    const { memberId, gymOwnerId } = req.body;
    if (!memberId || !gymOwnerId) {
      return res.status(400).json({ message: 'memberId and gymOwnerId are required' });
    }

    const member = await User.findById(memberId);
    if (!member || member.role !== 'member') {
      return res.status(400).json({ message: 'Invalid member' });
    }
    if (member.gymOwnerId.toString() !== gymOwnerId) {
      return res.status(403).json({ message: 'Member does not belong to this gym' });
    }
    if (member.membershipStatus !== 'active') {
      return res.status(403).json({ message: 'Membership is not active' });
    }
    if (new Date(member.membershipEndDate) < new Date()) {
      return res.status(403).json({ message: 'Membership has expired' });
    }

    const today = new Date().toISOString().split('T')[0];
    const existing = await Attendance.findOne({ memberId, date: today, checkOutTime: null });
    if (existing) {
      return res.status(400).json({ message: 'Already checked in today', attendance: existing });
    }

    const attendance = new Attendance({
      memberId,
      gymOwnerId,
      checkInTime: new Date(),
      date: today
    });
    await attendance.save();
    member.lastAttendance = new Date();
    await member.save();

    res.status(201).json({ message: 'Check-in successful', attendance, member: { name: member.name } });
  } catch (error) {
    console.error('QR check-in error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
