/**
 * owner.js — Owner-specific endpoints
 *
 * All routes require authMiddleware (scoped to req.user._id = gymOwnerId).
 *
 * GET  /api/owner/inactive-members   — active members with last check-in >= 3 days ago
 * GET  /api/owner/expiring-members   — members expiring in <=3 days OR already expired
 * POST /api/owner/push-token         — save/update owner's Expo push token
 */

const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');
const User       = require('../models/User');
const Attendance = require('../models/Attendance');

// ── GET /inactive-members ────────────────────────────────────────────────────
// Returns active members of THIS owner's gym whose last check-in was >= 3 days ago.
// Scoped to req.user._id (the logged-in owner).
router.get('/inactive-members', async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user._id);

    const now        = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // 1. Get all active members for this gym
    const members = await User.find(
      { gymOwnerId: ownerId, role: 'member', isActive: true, membershipStatus: 'active' },
      '_id name lastAttendance',
    ).lean();

    if (members.length === 0) return res.json({ inactiveMembers: [] });

    const memberIds = members.map(m => m._id);

    // 2. Get most recent check-in per member (single aggregation query)
    const latestCheckIns = await Attendance.aggregate([
      {
        $match: {
          gymOwnerId: ownerId,
          memberId: { $in: memberIds },
        },
      },
      { $sort: { checkInTime: -1 } },
      {
        $group: {
          _id: '$memberId',
          lastCheckIn: { $first: '$checkInTime' },
        },
      },
    ]);

    // Map memberId → lastCheckIn
    const checkInMap = {};
    latestCheckIns.forEach(r => { checkInMap[r._id.toString()] = r.lastCheckIn; });

    // 3. Filter: last check-in >= 3 days ago (or no check-in ever)
    const inactive = [];
    for (const member of members) {
      const lastCheckIn = checkInMap[member._id.toString()] || null;
      const isInactive  = !lastCheckIn || new Date(lastCheckIn) < threeDaysAgo;
      if (!isInactive) continue;

      const daysInactive = lastCheckIn
        ? Math.floor((now - new Date(lastCheckIn)) / (1000 * 60 * 60 * 24))
        : null; // null = never checked in

      inactive.push({
        _id:         member._id,
        name:        member.name,
        lastCheckIn: lastCheckIn || null,
        daysInactive,
      });
    }

    // Sort by most inactive first (never checked in last)
    inactive.sort((a, b) => {
      if (a.daysInactive === null) return 1;
      if (b.daysInactive === null) return -1;
      return b.daysInactive - a.daysInactive;
    });

    res.json({ inactiveMembers: inactive });
  } catch (err) {
    console.error('[owner/inactive-members]', err);
    res.status(500).json({ message: 'Failed to fetch inactive members', error: err.message });
  }
});

// ── GET /expiring-members ────────────────────────────────────────────────────
// Returns members whose membershipEndDate is within next 3 days OR already expired.
// Sort: expired first (pinned), then expiring by soonest.
router.get('/expiring-members', async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user._id);

    const now           = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const members = await User.find(
      {
        gymOwnerId:       ownerId,
        role:             'member',
        isActive:         true,
        membershipEndDate: { $lte: threeDaysLater }, // expiry <= now+3d (includes past)
        membershipEndDate: { $ne: null },
      },
      '_id name membershipEndDate membershipStatus',
    ).lean();

    const result = members.map(m => {
      const expiry   = new Date(m.membershipEndDate);
      const msLeft   = expiry - now;
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      const status   = daysLeft < 0 ? 'expired' : 'expiring';
      return {
        _id:              m._id,
        name:             m.name,
        membershipExpiry: m.membershipEndDate,
        status,
        daysLeft,
      };
    });

    // Sort: expired first (daysLeft < 0), then expiring ascending
    result.sort((a, b) => {
      if (a.status === 'expired' && b.status !== 'expired') return -1;
      if (b.status === 'expired' && a.status !== 'expired') return 1;
      return a.daysLeft - b.daysLeft;
    });

    res.json({ expiringMembers: result });
  } catch (err) {
    console.error('[owner/expiring-members]', err);
    res.status(500).json({ message: 'Failed to fetch expiring members', error: err.message });
  }
});

// ── POST /push-token ─────────────────────────────────────────────────────────
// Save or update the logged-in owner's Expo push token.
// Body: { token: "ExponentPushToken[...]" }
router.post('/push-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'token is required' });
    }
    if (!token.startsWith('ExponentPushToken[')) {
      return res.status(400).json({ message: 'Invalid Expo push token format' });
    }

    await User.findByIdAndUpdate(req.user._id, { expoPushToken: token });
    res.json({ ok: true });
  } catch (err) {
    console.error('[owner/push-token]', err);
    res.status(500).json({ message: 'Failed to save push token', error: err.message });
  }
});

module.exports = router;
