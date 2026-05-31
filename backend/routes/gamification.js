const express        = require('express');
const router         = express.Router();
const mongoose       = require('mongoose');
const auth           = require('../middleware/auth');
const Gamification   = require('../models/Gamification');
const User           = require('../models/User');
const { computeRank } = require('../utils/xpEngine');

// Helper: check if user has active subscription
function isPremium(user) {
  if (user.role === 'owner') return true;
  return user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial';
}

// ── GET /api/gamification/my-stats ────────────────────────────────────────
router.get('/my-stats', auth, async (req, res) => {
  try {
    const memberId = req.user._id;
    let doc = await Gamification.findOne({ memberId }).lean();
    if (!doc) {
      doc = { memberId, lifetimeXP: 0, monthlyXP: { month: '', xp: 0 }, weeklyXP: { weekStart: '', xp: 0 },
        currentStreak: 0, longestStreak: 0, badges: [], totalCheckIns: 0, rank: 'Beginner',
        totalWorkouts: 0, totalReferrals: 0 };
    }
    res.json({ stats: doc });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/gamification/profile/:memberId ───────────────────────────────
router.get('/profile/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(memberId))
      return res.status(400).json({ message: 'Invalid memberId' });

    let doc = await Gamification.findOne({ memberId }).lean();
    if (!doc) {
      doc = { memberId, lifetimeXP: 0, monthlyXP: { month: '', xp: 0 }, weeklyXP: { weekStart: '', xp: 0 },
        currentStreak: 0, longestStreak: 0, badges: [], totalCheckIns: 0, rank: 'Beginner',
        totalWorkouts: 0, totalReferrals: 0 };
    }
    res.json({ stats: doc });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/gamification/leaderboard ────────────────────────────────────
// ?period=monthly|weekly|alltime  (default: monthly)
// ?category=xp|attendance|streak  (default: xp)
// ?limit=50
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const period   = req.query.period   || 'monthly';
    const category = req.query.category || 'xp';
    const premium  = isPremium(req.user);
    const limit    = premium ? Math.min(parseInt(req.query.limit) || 50, 100) : 3;

    // Build sort field
    let sortField;
    if (category === 'attendance') {
      sortField = 'totalCheckIns';
    } else if (category === 'streak') {
      sortField = 'currentStreak';
    } else {
      // xp
      if (period === 'weekly')  sortField = 'weeklyXP.xp';
      else if (period === 'alltime') sortField = 'lifetimeXP';
      else sortField = 'monthlyXP.xp';
    }

    const sort = { [sortField]: -1 };

    // Fetch top N
    const docs = await Gamification.find({})
      .sort(sort)
      .limit(limit)
      .lean();

    // Enrich with user names + avatars
    const memberIds = docs.map(d => d.memberId);
    const users = await User.find({ _id: { $in: memberIds } })
      .select('name profilePhoto role')
      .lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const ranked = docs.map((doc, idx) => {
      const u = userMap[doc.memberId.toString()] || {};
      const score = category === 'attendance' ? doc.totalCheckIns
        : category === 'streak'               ? doc.currentStreak
        : period === 'weekly'                 ? (doc.weeklyXP?.xp || 0)
        : period === 'alltime'                ? doc.lifetimeXP
        :                                       (doc.monthlyXP?.xp || 0);
      return {
        position:   idx + 1,
        memberId:   doc.memberId,
        name:       u.name || 'Member',
        avatar:     u.profilePhoto || null,
        rank:       doc.rank,
        lifetimeXP: doc.lifetimeXP,
        score,
      };
    });

    // Own rank (always included even for free users)
    const myId = req.user._id.toString();
    let myEntry = null;
    const myInList = ranked.find(r => r.memberId.toString() === myId);

    if (!myInList) {
      // Find own position
      const myDoc = await Gamification.findOne({ memberId: req.user._id }).lean();
      if (myDoc) {
        const myScore = category === 'attendance' ? myDoc.totalCheckIns
          : category === 'streak'                 ? myDoc.currentStreak
          : period === 'weekly'                   ? (myDoc.weeklyXP?.xp || 0)
          : period === 'alltime'                  ? myDoc.lifetimeXP
          :                                         (myDoc.monthlyXP?.xp || 0);
        const position = await Gamification.countDocuments({ [sortField]: { $gt: myScore } }) + 1;
        myEntry = {
          position,
          memberId:   myDoc.memberId,
          name:       req.user.name || 'You',
          avatar:     req.user.profilePhoto || null,
          rank:       myDoc.rank,
          lifetimeXP: myDoc.lifetimeXP,
          score:      myScore,
          isCurrentUser: true,
        };
      }
    } else {
      myInList.isCurrentUser = true;
    }

    res.json({
      leaderboard: ranked,
      myEntry,
      isPremium: premium,
      period,
      category,
    });
  } catch (err) {
    console.error('[Gamification] leaderboard error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
