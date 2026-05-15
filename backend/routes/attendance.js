const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// ─── helpers ───────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];

// Auto-close stale check-ins for a member before creating a new one
// Closes any open check-ins from PREVIOUS days with durationUnknown = true
async function closeStaleCheckIns(memberId) {
  const today = todayStr();
  const stale = await Attendance.find({
    memberId,
    checkOutTime: null,
    date: { $lt: today },
  });
  for (const rec of stale) {
    rec.checkOutTime = null;       // stays null — no checkout happened
    rec.duration = null;           // unknown
    rec.durationUnknown = true;    // flag it
    await rec.save();
  }
}

// ─── POST /checkin ──────────────────────────────────────────────────────────
router.post('/checkin', authMiddleware, async (req, res) => {
  try {
    const { memberId, gymId } = req.body;

    const member = await User.findById(memberId);
    if (!member || member.role !== 'member')
      return res.status(400).json({ message: 'Invalid member' });

    const gymOwner = await User.findById(gymId);
    if (!gymOwner || gymOwner.role !== 'owner')
      return res.status(400).json({ message: 'Invalid gym' });

    if (member.gymOwnerId.toString() !== gymId)
      return res.status(403).json({ message: 'Member does not belong to this gym' });

    if (member.membershipStatus !== 'active')
      return res.status(403).json({ message: 'Membership is not active' });

    if (new Date(member.membershipEndDate) < new Date())
      return res.status(403).json({ message: 'Membership has expired' });

    // Auto-close any stale open check-ins from previous days
    await closeStaleCheckIns(memberId);

    const today = todayStr();

    // Check if already checked in TODAY (no checkout yet)
    const existing = await Attendance.findOne({ memberId, date: today, checkOutTime: null });
    if (existing) {
      return res.status(400).json({
        message: 'Already checked in today',
        attendance: existing,
        alreadyCheckedIn: true,
      });
    }

    const attendance = new Attendance({
      memberId,
      gymOwnerId: gymId,
      checkInTime: new Date(),
      date: today,
    });
    await attendance.save();

    member.lastAttendance = new Date();
    await member.save();

    res.status(201).json({
      message: 'Check-in successful',
      attendance,
      member: { name: member.name, membershipEndDate: member.membershipEndDate },
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── POST /checkout ─────────────────────────────────────────────────────────
// Allows checkout any time on the SAME DAY as check-in
router.post('/checkout', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.body;
    const today = todayStr();

    // Find today's open check-in (no checkout yet)
    const attendance = await Attendance.findOne({
      memberId,
      date: today,
      checkOutTime: null,
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No active check-in found for today' });
    }

    const now = new Date();
    attendance.checkOutTime = now;

    const durationMs = now - attendance.checkInTime;
    attendance.duration = Math.floor(durationMs / (1000 * 60)); // minutes
    attendance.durationUnknown = false;

    await attendance.save();

    res.json({ message: 'Check-out successful', attendance });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /today-status/:memberId ────────────────────────────────────────────
// Returns today's check-in status for a member
router.get('/today-status/:memberId', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.params;
    const today = todayStr();

    const todayRecord = await Attendance.findOne({ memberId, date: today });

    res.json({
      date: today,
      checkedIn: !!todayRecord,
      checkedOut: !!(todayRecord?.checkOutTime),
      attendance: todayRecord || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /member/:memberId ──────────────────────────────────────────────────
router.get('/member/:memberId', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { startDate, endDate } = req.query;

    let query = { memberId };
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendances = await Attendance.find(query)
      .sort({ date: -1, checkInTime: -1 })
      .limit(100);

    const totalDays = attendances.length;
    const totalMinutes = attendances.reduce((sum, att) => sum + (att.duration || 0), 0);
    const avgDuration = totalDays > 0 ? Math.floor(totalMinutes / totalDays) : 0;

    res.json({ attendances, stats: { totalDays, totalMinutes, avgDuration } });
  } catch (error) {
    console.error('Get member attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /gym/:ownerId ──────────────────────────────────────────────────────
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId))
      return res.status(400).json({ message: 'Invalid owner ID' });

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const { date } = req.query;
    const query = { gymOwnerId: ownerObjectId, date: date || todayStr() };

    const attendances = await Attendance.find(query)
      .populate('memberId', 'name email phone')
      .sort({ checkInTime: -1 });

    res.json({ attendances, count: attendances.length });
  } catch (error) {
    console.error('Get gym attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /gym/:ownerId/stats ────────────────────────────────────────────────
router.get('/gym/:ownerId/stats', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId))
      return res.status(400).json({ message: 'Invalid owner ID' });

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const { period } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'week':  startDate.setDate(startDate.getDate() - 7);     break;
      case 'year':  startDate.setFullYear(startDate.getFullYear() - 1); break;
      default:      startDate.setMonth(startDate.getMonth() - 1);
    }

    const attendances = await Attendance.find({ gymOwnerId: ownerObjectId, createdAt: { $gte: startDate } });

    const dailyStats = {};
    attendances.forEach(att => {
      dailyStats[att.date] = (dailyStats[att.date] || 0) + 1;
    });

    const stats = Object.keys(dailyStats)
      .map(date => ({ date, count: dailyStats[date] }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ stats, totalAttendances: attendances.length });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /report/:ownerId ───────────────────────────────────────────────────
router.get('/report/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId))
      return res.status(400).json({ message: 'Invalid owner ID' });

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
      date: { $gte: startDate, $lte: endDate },
    }).populate('memberId', 'name loginId phone');

    const memberMap = {};
    attendances.forEach(att => {
      const mid = att.memberId?._id?.toString();
      if (!mid) return;
      if (!memberMap[mid]) {
        memberMap[mid] = { memberId: mid, name: att.memberId.name, loginId: att.memberId.loginId, daysPresent: 0, records: [] };
      }
      memberMap[mid].daysPresent++;
      memberMap[mid].records.push({ date: att.date, checkInTime: att.checkInTime, checkOutTime: att.checkOutTime });
    });

    const totalDaysInRange = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1);
    const members = Object.values(memberMap).map(m => ({
      ...m,
      attendancePercent: Math.round((m.daysPresent / totalDaysInRange) * 100),
    }));

    const todayCheckins = attendances.filter(a => a.date === todayStr()).length;

    res.json({
      members,
      summary: {
        totalCheckinsToday: todayCheckins,
        averageAttendance: members.length > 0
          ? Math.round(members.reduce((s, m) => s + m.attendancePercent, 0) / members.length)
          : 0,
        totalMembers: members.length,
      },
    });
  } catch (error) {
    console.error('Attendance report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /active-count/:ownerId ─────────────────────────────────────────────
router.get('/active-count/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId))
      return res.status(400).json({ message: 'Invalid owner ID' });

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const today = todayStr();
    const activeCount = await Attendance.countDocuments({ gymOwnerId: ownerObjectId, date: today, checkOutTime: null });
    res.json({ activeCount, date: today });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── POST /qr-checkin ───────────────────────────────────────────────────────
router.post('/qr-checkin', authMiddleware, async (req, res) => {
  try {
    const { memberId, gymOwnerId } = req.body;
    if (!memberId || !gymOwnerId)
      return res.status(400).json({ message: 'memberId and gymOwnerId are required' });

    const member = await User.findById(memberId);
    if (!member || member.role !== 'member')
      return res.status(400).json({ message: 'Invalid member' });
    if (member.gymOwnerId.toString() !== gymOwnerId)
      return res.status(403).json({ message: 'Member does not belong to this gym' });
    if (member.membershipStatus !== 'active')
      return res.status(403).json({ message: 'Membership is not active' });
    if (new Date(member.membershipEndDate) < new Date())
      return res.status(403).json({ message: 'Membership has expired' });

    // Auto-close stale previous days
    await closeStaleCheckIns(memberId);

    const today = todayStr();
    const existing = await Attendance.findOne({ memberId, date: today, checkOutTime: null });
    if (existing) {
      return res.status(400).json({
        message: 'Already checked in today',
        attendance: existing,
        alreadyCheckedIn: true,
      });
    }

    const attendance = new Attendance({ memberId, gymOwnerId, checkInTime: new Date(), date: today });
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

ports = router;
