/**
 * owner.js — Owner-specific endpoints
 *
 * GET  /api/owner/inactive-members        — active members with last check-in >= 3 days ago
 * GET  /api/owner/expiring-members?days=N — members expiring within N days (default 7) + expired
 * POST /api/owner/push-token              — save/update owner's Expo push token
 */

const express    = require('express');
const router     = express.Router();
const mongoose   = require('mongoose');
const User       = require('../models/User');
const Attendance = require('../models/Attendance');

// ── GET /inactive-members ─────────────────────────────────────────────────────
router.get('/inactive-members', async (req, res) => {
  try {
    const ownerId      = new mongoose.Types.ObjectId(req.user._id);
    const now          = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // 1. Active members for this gym (include createdAt so we can compute days for never-visited)
    const members = await User.find(
      { gymOwnerId: ownerId, role: 'member', isActive: true, membershipStatus: 'active' },
      '_id name createdAt',
    ).lean();

    if (members.length === 0) return res.json({ inactiveMembers: [] });

    const memberIds = members.map(m => m._id);

    // 2. Most recent check-in per member
    const latestCheckIns = await Attendance.aggregate([
      { $match: { gymOwnerId: ownerId, memberId: { $in: memberIds } } },
      { $sort: { checkInTime: -1 } },
      { $group: { _id: '$memberId', lastCheckIn: { $first: '$checkInTime' } } },
    ]);

    const checkInMap = {};
    latestCheckIns.forEach(r => { checkInMap[r._id.toString()] = r.lastCheckIn; });

    // 3. Filter: last check-in >= 3 days ago (or no check-in ever)
    const inactive = [];
    for (const member of members) {
      const lastCheckIn = checkInMap[member._id.toString()] || null;
      const isInactive  = !lastCheckIn || new Date(lastCheckIn) < threeDaysAgo;
      if (!isInactive) continue;

      let daysInactive;
      if (lastCheckIn) {
        // Has visited before — compute from last check-in
        daysInactive = Math.floor((now - new Date(lastCheckIn)) / (1000 * 60 * 60 * 24));
      } else {
        // Never visited — compute from registration date
        const joinDate = member.createdAt ? new Date(member.createdAt) : now;
        daysInactive   = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));
        // Clamp to minimum 3 (they're in the inactive list so >= 3 days must have passed)
        daysInactive   = Math.max(3, daysInactive);
      }

      inactive.push({
        _id:         member._id,
        name:        member.name,
        lastCheckIn: lastCheckIn || null,
        daysInactive,
      });
    }

    // Sort most inactive first
    inactive.sort((a, b) => b.daysInactive - a.daysInactive);

    res.json({ inactiveMembers: inactive });
  } catch (err) {
    console.error('[owner/inactive-members]', err);
    res.status(500).json({ message: 'Failed to fetch inactive members', error: err.message });
  }
});

// ── GET /expiring-members?days=N ──────────────────────────────────────────────
// Returns members expiring within N days (default 7) PLUS already-expired ones.
// Expired pinned first (sorted by most overdue), then expiring soonest.
router.get('/expiring-members', async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user._id);
    const days    = Math.max(1, Math.min(90, parseInt(req.query.days, 10) || 7));

    const now      = new Date();
    const cutoff   = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const members = await User.find(
      {
        gymOwnerId:       ownerId,
        role:             'member',
        isActive:         true,
        membershipEndDate: { $ne: null, $lte: cutoff },
      },
      '_id name membershipEndDate membershipStatus',
    ).lean();

    const result = members.map(m => {
      const expiry   = new Date(m.membershipEndDate);
      const msLeft   = expiry - now;
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      return {
        _id:              m._id,
        name:             m.name,
        membershipExpiry: m.membershipEndDate,
        status:           daysLeft < 0 ? 'expired' : 'expiring',
        daysLeft,
      };
    });

    // Expired first (most overdue), then expiring soonest
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

// ── POST /push-token ──────────────────────────────────────────────────────────
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
