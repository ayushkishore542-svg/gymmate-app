/**
 * xpEngine.js - Central XP award logic for GymMate gamification.
 * v2: no morning bonus, 6-day streak, dailyXPLog, miss penalty, position badges.
 */

const mongoose     = require('mongoose');
const Gamification = require('../models/Gamification');

const XP = {
  checkin:          10,
  workout:          15,
  streak_per_day:    5,
  streak_cap:       50,
  referral:        100,
  profile_complete: 50,
  feedback:         25,
  streak_6:         75,
  streak_30:       300,
  miss_per_day:      5,
  miss_cap:         50,
};

const RANKS = [
  { name: 'Legend',   min: 30000 },
  { name: 'Diamond',  min: 15000 },
  { name: 'Platinum', min: 8000  },
  { name: 'Gold',     min: 4000  },
  { name: 'Silver',   min: 1500  },
  { name: 'Bronze',   min: 500   },
  { name: 'Beginner', min: 0     },
];

function computeRank(xp) {
  for (const r of RANKS) { if (xp >= r.min) return r.name; }
  return 'Beginner';
}

const BADGE_DEFS = {
  first_step:        { name: 'First Step',        icon: '(shoe)',   category: 'Milestone',    criteria: 'First ever check-in' },
  centurion:         { name: 'Centurion',          icon: '(100)',    category: 'Milestone',    criteria: '100 lifetime check-ins' },
  veteran:           { name: 'Veteran',            icon: '(trophy)', category: 'Milestone',    criteria: '365 lifetime check-ins' },
  iron_regular:      { name: 'Iron Regular',       icon: '(dumbbell)',category:'Monthly',      criteria: '20+ check-ins in a month' },
  century_xp:        { name: 'Century XP',         icon: '(rocket)', category: 'Monthly',     criteria: 'Earn 1000+ XP in a single month' },
  streak_master:     { name: 'Streak Master',      icon: '(fire)',   category: 'Streak',      criteria: '6-day consecutive streak (full week)' },
  unstoppable:       { name: 'Unstoppable',        icon: '(bolt)',   category: 'Streak',      criteria: '30-day consecutive streak' },
  social_butterfly:  { name: 'Social Butterfly',   icon: '(butterfly)',category:'Social',     criteria: '3+ successful referrals' },
  feedback_champion: { name: 'Feedback Champion',  icon: '(star)',   category: 'Engagement',  criteria: 'Submitted a review' },
  complete_profile:  { name: 'Complete Profile',   icon: '(check)',  category: 'Engagement',  criteria: '100% profile filled' },
  gold_throne:       { name: 'Gold Throne',        icon: '(crown)',  category: 'Leaderboard', criteria: '#1 on monthly leaderboard for 15 consecutive days' },
  silver_reign:      { name: 'Silver Reign',       icon: '(silver)', category: 'Leaderboard', criteria: '#2 for 15 consecutive days' },
  bronze_hold:       { name: 'Bronze Hold',        icon: '(bronze)', category: 'Leaderboard', criteria: '#3 for 15 consecutive days' },
  top10_regular:     { name: 'Top 10 Regular',     icon: '(10)',     category: 'Leaderboard', criteria: 'Top 10 for 30 consecutive days' },
  comeback_king:     { name: 'Comeback King',      icon: '(eagle)',  category: 'Special',     criteria: 'Returned after 7+ days absence, then 5 consecutive days' },
};

function dateStr(d) {
  const dt = d || new Date();
  return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}

function currentMonth(d) {
  const dt = d || new Date();
  return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
}

function currentWeekStart(d) {
  const dt = new Date(d || new Date());
  const day = dt.getDay() || 7;
  dt.setDate(dt.getDate() - (day - 1));
  return dateStr(dt);
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function daysBetween(a, b) {
  const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bDay - aDay) / (24*60*60*1000));
}

function openDaysBetween(lastDate, today, openDays) {
  const open = new Set(openDays || [1,2,3,4,5,6]);
  let count = 0;
  const cursor = new Date(lastDate);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor < today) {
    const dow = cursor.getDay() || 7;
    if (open.has(dow)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function prunedLog(log, today, earnedDelta, lostDelta) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 29);
  const cutoffStr = dateStr(cutoff);
  let entries = (log || []).filter(e => e.date >= cutoffStr);
  const idx = entries.findIndex(e => e.date === today);
  if (idx >= 0) {
    entries[idx] = {
      date:   today,
      earned: (entries[idx].earned || 0) + earnedDelta,
      lost:   (entries[idx].lost   || 0) + lostDelta,
      net:    (entries[idx].net    || 0) + earnedDelta - lostDelta,
    };
  } else {
    entries.push({ date: today, earned: earnedDelta, lost: lostDelta, net: earnedDelta - lostDelta });
    entries.sort((a, b) => a.date.localeCompare(b.date));
    if (entries.length > 30) entries = entries.slice(-30);
  }
  return entries;
}

async function awardXP(memberId, eventType, metadata) {
  if (!metadata) metadata = {};
  const mid = new mongoose.Types.ObjectId(memberId);
  let doc = await Gamification.findOne({ memberId: mid });
  if (!doc) doc = await Gamification.create({ memberId: mid });

  let xpEarned = 0;
  const newBadges = [];
  const now       = metadata.timestamp ? new Date(metadata.timestamp) : new Date();
  const today     = dateStr(now);
  const month     = currentMonth(now);
  const weekStart = currentWeekStart(now);
  const openDays  = metadata.openDays || [1,2,3,4,5,6];

  const inc = {};
  const set = {};
  const hasBadge = (id) => doc.badges && doc.badges.some(function(b){ return b.id === id; });

  if (eventType === 'checkin') {
    xpEarned       += XP.checkin;
    inc.lifetimeXP  = XP.checkin;
    inc.totalCheckIns = 1;

    if (doc.monthlyCheckIns && doc.monthlyCheckIns.month === month) {
      inc['monthlyCheckIns.count'] = 1;
    } else {
      set['monthlyCheckIns.month'] = month;
      set['monthlyCheckIns.count'] = 1;
    }

    const lastDate = doc.lastCheckInDate ? new Date(doc.lastCheckInDate) : null;
    if (!lastDate || !sameDay(lastDate, now)) {
      let newStreak = 1;
      if (lastDate) {
        const openMissed = openDaysBetween(lastDate, now, openDays);
        if (openMissed === 0) newStreak = (doc.currentStreak || 0) + 1;
      }

      const streakBonus = Math.min(newStreak * XP.streak_per_day, XP.streak_cap);
      xpEarned       += streakBonus;
      inc.lifetimeXP  = (inc.lifetimeXP || 0) + streakBonus;

      if (newStreak === 6) {
        xpEarned      += XP.streak_6;
        inc.lifetimeXP = (inc.lifetimeXP || 0) + XP.streak_6;
      }
      if (newStreak === 30) {
        xpEarned      += XP.streak_30;
        inc.lifetimeXP = (inc.lifetimeXP || 0) + XP.streak_30;
      }

      set.currentStreak     = newStreak;
      set.lastCheckInDate   = now;
      set.currentMissStreak = 0;
      if (newStreak > (doc.longestStreak || 0)) set.longestStreak = newStreak;

      if (newStreak >= 6  && !hasBadge('streak_master'))
        newBadges.push({ id: 'streak_master',  ...BADGE_DEFS.streak_master,  earnedAt: now });
      if (newStreak >= 30 && !hasBadge('unstoppable'))
        newBadges.push({ id: 'unstoppable',     ...BADGE_DEFS.unstoppable,    earnedAt: now });

      // Comeback King: gap >= 7 days before this return AND now on 5th consecutive day
      const gapBefore = lastDate ? daysBetween(lastDate, now) : 0;
      if (newStreak === 5 && gapBefore >= 7 && !hasBadge('comeback_king'))
        newBadges.push({ id: 'comeback_king', ...BADGE_DEFS.comeback_king, earnedAt: now });
    }

    const newTotal = (doc.totalCheckIns || 0) + 1;
    if (newTotal === 1  && !hasBadge('first_step'))
      newBadges.push({ id: 'first_step', ...BADGE_DEFS.first_step, earnedAt: now });
    if (newTotal >= 100 && !hasBadge('centurion'))
      newBadges.push({ id: 'centurion', ...BADGE_DEFS.centurion, earnedAt: now });
    if (newTotal >= 365 && !hasBadge('veteran'))
      newBadges.push({ id: 'veteran', ...BADGE_DEFS.veteran, earnedAt: now });

    const prevMonthlyCount = (doc.monthlyCheckIns && doc.monthlyCheckIns.month === month)
      ? (doc.monthlyCheckIns.count || 0) : 0;
    const newMonthlyCount = prevMonthlyCount + 1;
    const alreadyIron = doc.badges && doc.badges.some(function(b){
      return b.id === 'iron_regular' && new Date(b.earnedAt).toISOString().startsWith(month);
    });
    if (newMonthlyCount >= 20 && !alreadyIron)
      newBadges.push({ id: 'iron_regular', ...BADGE_DEFS.iron_regular, earnedAt: now });

  } else if (eventType === 'workout') {
    xpEarned         += XP.workout;
    inc.lifetimeXP    = XP.workout;
    inc.totalWorkouts = 1;

  } else if (eventType === 'referral') {
    xpEarned          += XP.referral;
    inc.lifetimeXP     = XP.referral;
    inc.totalReferrals = 1;
    const newRefs = (doc.totalReferrals || 0) + 1;
    if (newRefs >= 3 && !hasBadge('social_butterfly'))
      newBadges.push({ id: 'social_butterfly', ...BADGE_DEFS.social_butterfly, earnedAt: now });

  } else if (eventType === 'profile_complete') {
    if (!doc.profileComplete) {
      xpEarned          += XP.profile_complete;
      inc.lifetimeXP     = XP.profile_complete;
      set.profileComplete = true;
      if (!hasBadge('complete_profile'))
        newBadges.push({ id: 'complete_profile', ...BADGE_DEFS.complete_profile, earnedAt: now });
    }

  } else if (eventType === 'feedback') {
    if (!doc.feedbackGiven) {
      xpEarned        += XP.feedback;
      inc.lifetimeXP   = XP.feedback;
      set.feedbackGiven = true;
      if (!hasBadge('feedback_champion'))
        newBadges.push({ id: 'feedback_champion', ...BADGE_DEFS.feedback_champion, earnedAt: now });
    }
  }

  if (xpEarned === 0 && Object.keys(set).length === 0 && Object.keys(inc).length === 0 && newBadges.length === 0) {
    return { xpEarned: 0, newBadges: [], rankUp: false, newRank: doc.rank };
  }

  const earned = inc.lifetimeXP || 0;

  if (earned > 0) {
    if (doc.monthlyXP && doc.monthlyXP.month === month) {
      inc['monthlyXP.xp'] = earned;
    } else {
      set['monthlyXP.month'] = month;
      set['monthlyXP.xp']    = earned;
    }
    if (doc.weeklyXP && doc.weeklyXP.weekStart === weekStart) {
      inc['weeklyXP.xp'] = earned;
    } else {
      set['weeklyXP.weekStart'] = weekStart;
      set['weeklyXP.xp']        = earned;
    }

    // Century XP badge
    const prevMonthlyXP = (doc.monthlyXP && doc.monthlyXP.month === month) ? (doc.monthlyXP.xp || 0) : 0;
    const newMonthlyXP  = prevMonthlyXP + earned;
    const alreadyCentury = doc.badges && doc.badges.some(function(b){
      return b.id === 'century_xp' && new Date(b.earnedAt).toISOString().startsWith(month);
    });
    if (newMonthlyXP >= 1000 && !alreadyCentury)
      newBadges.push({ id: 'century_xp', ...BADGE_DEFS.century_xp, earnedAt: now });
  }

  const newLifetimeXP = (doc.lifetimeXP || 0) + earned;
  const newRank       = computeRank(newLifetimeXP);
  const rankUp        = newRank !== doc.rank;
  set.rank       = newRank;
  set.dailyXPLog = prunedLog(doc.dailyXPLog, today, earned, 0);

  const update = {};
  if (Object.keys(inc).length)  update.$inc  = inc;
  if (Object.keys(set).length)  update.$set  = set;
  if (newBadges.length)         update.$push = { badges: { $each: newBadges } };

  await Gamification.findOneAndUpdate({ memberId: mid }, update, { upsert: true, new: true });
  return { xpEarned, newBadges, rankUp, newRank };
}

async function applyMissPenalty(memberId, dateString) {
  const mid = new mongoose.Types.ObjectId(memberId);
  const doc = await Gamification.findOne({ memberId: mid });
  if (!doc) return;

  const newMissStreak = (doc.currentMissStreak || 0) + 1;
  const penalty       = Math.min(newMissStreak * XP.miss_per_day, XP.miss_cap);
  const newLifetimeXP = Math.max((doc.lifetimeXP || 0) - penalty, 0);
  const newMonthlyXP  = Math.max((doc.monthlyXP && doc.monthlyXP.xp ? doc.monthlyXP.xp : 0) - penalty, 0);
  const newRank       = computeRank(newLifetimeXP);
  const updatedLog    = prunedLog(doc.dailyXPLog, dateString, 0, penalty);

  await Gamification.findOneAndUpdate(
    { memberId: mid },
    { $set: {
        lifetimeXP:         newLifetimeXP,
        'monthlyXP.xp':     newMonthlyXP,
        currentMissStreak:  newMissStreak,
        lastMissDate:       new Date(dateString),
        rank:               newRank,
        dailyXPLog:         updatedLog,
    }},
    { new: true },
  );
}

async function checkPositionBadges(memberId, position, consecutiveDays) {
  const mid = new mongoose.Types.ObjectId(memberId);
  const doc = await Gamification.findOne({ memberId: mid });
  if (!doc) return [];

  const now = new Date();
  const hasBadge = (id) => doc.badges && doc.badges.some(function(b){ return b.id === id; });
  const newBadges = [];

  if (position === 1  && consecutiveDays >= 15 && !hasBadge('gold_throne'))
    newBadges.push({ id: 'gold_throne',   ...BADGE_DEFS.gold_throne,   earnedAt: now });
  if (position === 2  && consecutiveDays >= 15 && !hasBadge('silver_reign'))
    newBadges.push({ id: 'silver_reign',  ...BADGE_DEFS.silver_reign,  earnedAt: now });
  if (position === 3  && consecutiveDays >= 15 && !hasBadge('bronze_hold'))
    newBadges.push({ id: 'bronze_hold',   ...BADGE_DEFS.bronze_hold,   earnedAt: now });
  if (position <= 10  && consecutiveDays >= 30 && !hasBadge('top10_regular'))
    newBadges.push({ id: 'top10_regular', ...BADGE_DEFS.top10_regular, earnedAt: now });

  if (newBadges.length) {
    await Gamification.findOneAndUpdate({ memberId: mid }, { $push: { badges: { $each: newBadges } } });
  }
  return newBadges;
}

module.exports = { awardXP, applyMissPenalty, checkPositionBadges, computeRank, BADGE_DEFS, RANKS };
