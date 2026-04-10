const express = require('express');
const router  = express.Router();
const authMiddleware           = require('../middleware/auth');
const checkCalorieSubscription = require('../middleware/checkCalorieSubscription');
const GymLeaderboard    = require('../models/GymLeaderboard');
const CalorieSubscription = require('../models/CalorieSubscription');
const DailyMeal         = require('../models/DailyMeal');
const CheatDaySettings  = require('../models/CheatDaySettings');
const User              = require('../models/User');

router.use(authMiddleware, checkCalorieSubscription);

// ── Shared calculation logic (also used by cron) ──────────────────────────
async function calculateForGym(gymId) {
  const now       = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday

  // week_identifier: "2024-W03"
  const jan1       = new Date(now.getFullYear(), 0, 1);
  const weekNum    = Math.ceil((((now - jan1) / 86400000) + jan1.getDay() + 1) / 7);
  const weekId     = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  // Find all active calorie subscribers who belong to this gym
  const gymMembers = await User.find({ gymOwnerId: gymId, role: 'member' }, '_id name');
  const memberIds  = gymMembers.map(m => m._id);

  // Filter to only those with active/trial calorie subscription
  const activeSubs = await CalorieSubscription.find({
    user_id: { $in: memberIds },
    status:  { $in: ['trial', 'active'] }
  }, 'user_id');
  const subUserIds = activeSubs.map(s => s.user_id);

  // Fetch this week's daily meals for all subscribed members
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekMeals = await DailyMeal.find({
    user_id: { $in: subUserIds },
    date:    { $gte: weekStart, $lt: weekEnd }
  });

  // Fetch cheat day settings for all members (to exclude cheat days from avg)
  const cheatSettings = await CheatDaySettings.find(
    { user_id: { $in: subUserIds } },
    'user_id cheat_day enabled'
  );
  const cheatMap = {};
  cheatSettings.forEach(s => { cheatMap[s.user_id.toString()] = s; });

  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // Build per-user stats
  const userStatsMap = {};
  weekMeals.forEach(day => {
    const uid     = day.user_id.toString();
    const dayName = DAYS[day.date.getDay()];
    const cheat   = cheatMap[uid];
    const isCheat = cheat?.enabled && cheat?.cheat_day === dayName;

    if (!userStatsMap[uid]) {
      userStatsMap[uid] = { logged_days: 0, total_cal: 0, total_protein: 0, non_cheat_days: 0, meals_logged: 0 };
    }
    const s = userStatsMap[uid];
    s.logged_days++;
    s.meals_logged += day.meals.length;
    if (!isCheat) {
      s.total_cal     += day.daily_summary.total_calories;
      s.total_protein += day.daily_summary.protein;
      s.non_cheat_days++;
    }
  });

  // Score: (streak_days × 10) + (avg_protein ÷ 10)
  const memberMap = {};
  gymMembers.forEach(m => { memberMap[m._id.toString()] = m.name; });

  const rankings = subUserIds.map(uid => {
    const s    = userStatsMap[uid.toString()] || { logged_days: 0, total_cal: 0, total_protein: 0, non_cheat_days: 0, meals_logged: 0 };
    const days = s.non_cheat_days || 1;
    const avgCal     = Math.round(s.total_cal / days);
    const avgProtein = Math.round(s.total_protein / days);
    const score      = (s.logged_days * 10) + Math.round(avgProtein / 10);

    return {
      user_id:      uid,
      name:         memberMap[uid.toString()] || 'Member',
      streak_days:  s.logged_days,
      meals_logged: s.meals_logged,
      avg_calories: avgCal,
      avg_protein:  avgProtein,
      score
    };
  });

  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((r, i) => { r.rank = i + 1; });

  // Upsert leaderboard doc
  await GymLeaderboard.findOneAndUpdate(
    { gym_id: gymId, week_identifier: weekId },
    { $set: { week_start: weekStart, rankings, total_participants: rankings.length } },
    { upsert: true }
  );

  return { weekId, rankings };
}

module.exports.calculateForGym = calculateForGym;

// ── POST /calculate ───────────────────────────────────────────────────────
router.post('/calculate', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const gymId = user.role === 'owner' ? user._id : user.gymOwnerId;
    if (!gymId) return res.status(400).json({ message: 'No gym associated' });

    const result = await calculateForGym(gymId);
    res.json({ message: 'Leaderboard calculated!', week: result.weekId, total: result.rankings.length });
  } catch (err) {
    console.error('leaderboard calculate error:', err);
    res.status(500).json({ message: 'Failed to calculate leaderboard' });
  }
});

// ── GET /weekly ───────────────────────────────────────────────────────────
router.get('/weekly', async (req, res) => {
  try {
    const user  = await User.findById(req.user._id);
    const gymId = user.role === 'owner' ? user._id : user.gymOwnerId;
    if (!gymId) return res.status(400).json({ message: 'No gym associated' });

    // Current week identifier
    const now    = new Date();
    const jan1   = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((now - jan1) / 86400000) + jan1.getDay() + 1) / 7);
    const weekId  = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

    let board = await GymLeaderboard.findOne({ gym_id: gymId, week_identifier: weekId });

    // Auto-calculate on first fetch if no board exists yet
    if (!board) {
      await calculateForGym(gymId);
      board = await GymLeaderboard.findOne({ gym_id: gymId, week_identifier: weekId });
    }

    if (!board) return res.json({ rankings: [], user_rank: null, total_participants: 0 });

    const top20     = board.rankings.slice(0, 20);
    const userRank  = board.rankings.find(r => r.user_id.toString() === req.user._id.toString());

    res.json({
      rankings:           top20,
      user_rank:          userRank  || null,
      total_participants: board.total_participants,
      week_identifier:    board.week_identifier,
      week_start:         board.week_start
    });
  } catch (err) {
    console.error('leaderboard fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
