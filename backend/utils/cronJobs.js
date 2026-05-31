const cron = require('node-cron');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Wallet = require('../models/Wallet');
const GymSettings = require('../models/GymSettings');
const Gamification = require('../models/Gamification');
const { calculateForGym } = require('../routes/calorieLeaderboard');
const { applyMissPenalty, checkPositionBadges } = require('./xpEngine');
const { logger } = require('./logger');

// Check and update expired memberships - runs daily at midnight
const checkExpiredMemberships = cron.schedule('0 0 * * *', async () => {
  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Bulk update — single round-trip instead of N individual saves
    const result = await User.updateMany(
      { role: 'member', membershipStatus: 'active', membershipEndDate: { $lt: threeDaysAgo } },
      { $set: { membershipStatus: 'expired' } }
    );

    logger.info('cron_expired_memberships', { updated: result.modifiedCount });
    // TODO: Send push/email notifications to affected members
  } catch (error) {
    logger.error('cron_expired_memberships error', { err: error.message });
  }
});

// Check and update expired gym owner subscriptions - runs daily at midnight IST (18:30 UTC)
const checkExpiredSubscriptions = cron.schedule('30 18 * * *', async () => {
  try {
    const now = new Date();

    // 1. Trial owners whose trial has ended — bulk update
    const trials = await User.updateMany(
      { role: 'owner', subscriptionStatus: 'trial', subscriptionEndDate: { $lt: now }, paymentMethodAdded: { $ne: true } },
      { $set: { subscriptionStatus: 'expired' } }
    );

    // 2. Cancelled subscriptions whose access period has ended — bulk update
    const cancelled = await User.updateMany(
      { role: 'owner', subscriptionStatus: 'cancelled', currentPeriodEnd: { $lt: now } },
      { $set: { subscriptionStatus: 'expired' } }
    );

    logger.info('cron_expired_subscriptions', {
      trials: trials.modifiedCount,
      cancelled: cancelled.modifiedCount,
    });
    // TODO: Send push/email notifications to affected owners
  } catch (error) {
    logger.error('cron_expired_subscriptions error', { err: error.message });
  }
});

// Send membership expiry reminders - runs daily at 9 AM
const sendMembershipReminders = cron.schedule('0 9 * * *', async () => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const expiringMembers = await User.find({
      role: 'member',
      membershipStatus: 'active',
      membershipEndDate: { $gte: now, $lte: threeDaysFromNow },
    }, '_id membershipEndDate').lean();

    logger.info('cron_membership_reminders', { count: expiringMembers.length });
    // TODO: Send push/email/SMS notifications to expiringMembers
  } catch (error) {
    logger.error('cron_membership_reminders error', { err: error.message });
  }
});

// Recalculate leaderboards for all gyms — runs daily at midnight
const calculateLeaderboards = cron.schedule('0 0 * * *', async () => {
  try {
    const owners = await User.find({ role: 'owner' }, '_id gymName').lean();

    // Process in parallel batches of 10 to avoid overwhelming DB
    const BATCH = 10;
    let count = 0;
    for (let i = 0; i < owners.length; i += BATCH) {
      const batch = owners.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(o => calculateForGym(o._id)));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') count++;
        else logger.error('cron_leaderboard_gym_failed', { gym: batch[idx].gymName, err: r.reason?.message });
      });
    }
    logger.info('cron_leaderboards_done', { calculated: count, total: owners.length });
  } catch (err) {
    logger.error('cron_leaderboards error', { err: err.message });
  }
});

// Auto-close stale check-ins — runs every 30 minutes
// If a member checked in more than 3 hours ago (today) and still hasn't
// checked out, mark durationUnknown = true (duration stays null = "--").
// Does NOT set checkOutTime — so member can still check out later same day.
const autoCloseStaleCheckIns = cron.schedule('*/30 * * * *', async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    // Bulk update today's stale check-ins — single round-trip
    const todayResult = await Attendance.updateMany(
      { date: today, checkOutTime: null, durationUnknown: false, checkInTime: { $lt: threeHoursAgo } },
      { $set: { durationUnknown: true } }
    );

    // Bulk close open records from PREVIOUS days
    const prevResult = await Attendance.updateMany(
      { date: { $lt: today }, checkOutTime: null },
      { $set: { durationUnknown: true } }
    );

    if (todayResult.modifiedCount > 0 || prevResult.modifiedCount > 0) {
      logger.info('cron_stale_checkins_closed', {
        today: todayResult.modifiedCount,
        previous: prevResult.modifiedCount,
      });
    }
  } catch (error) {
    logger.error('cron_stale_checkins error', { err: error.message });
  }
});

// Zero-out expired wallet credit balance -- runs daily at 1 AM
const expireWalletCredits = cron.schedule('0 1 * * *', async () => {
  try {
    const now = new Date();

    // Find wallets with at least one expired credit
    const wallets = await Wallet.find({
      transactions: { $elemMatch: { type: 'credit', expiresAt: { $lt: now } } },
    });

    // Recompute balance in JS (requires transaction-level expiry logic),
    // then bulk-write only wallets whose balance actually changed
    const ops = [];
    for (const wallet of wallets) {
      const oldBalance = wallet.balance;
      wallet.recomputeBalance();
      if (wallet.balance !== oldBalance) {
        ops.push({
          updateOne: {
            filter: { _id: wallet._id },
            update: { $set: { balance: wallet.balance } },
          },
        });
      }
    }

    if (ops.length > 0) await Wallet.bulkWrite(ops);
    logger.info('cron_expire_wallet_credits', { checked: wallets.length, updated: ops.length });
  } catch (err) {
    logger.error('cron_expire_wallet_credits error', { err: err.message });
  }
});

// ── Gamification: daily penalty + leaderboard position ─────────────────────
// Runs at 00:30 IST every day (19:00 UTC previous day)
const gamificationDailyJob = cron.schedule('30 0 * * *', async () => {
  try {
    const now = new Date();

    // yesterday in IST
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.getFullYear() + '-' +
      String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
      String(yesterday.getDate()).padStart(2, '0');

    // getDay() → 0=Sun..6=Sat; convert to 1=Mon..7=Sun
    const yesterdayDow = yesterday.getDay() || 7;

    // 1. Load all GymSettings to know which gyms were open yesterday
    const allSettings = await GymSettings.find({}, 'ownerId openDays').lean();
    const settingsMap  = {};
    allSettings.forEach(s => { settingsMap[s.ownerId.toString()] = s.openDays || [1,2,3,4,5,6]; });

    // 2. Load all active members grouped by gymOwnerId
    const members = await User.find(
      { role: 'member', membershipStatus: 'active' },
      '_id gymOwnerId',
    ).lean();

    // 3. Load all check-ins for yesterday in one query
    const checkinDocs = await Attendance.find({ date: yesterdayStr }, 'memberId').lean();
    const checkinSet  = new Set(checkinDocs.map(c => c.memberId.toString()));

    // 4. Process each member
    let penalized = 0;
    let reset     = 0;
    for (const member of members) {
      const ownerId  = member.gymOwnerId?.toString();
      const openDays = settingsMap[ownerId] || [1,2,3,4,5,6];

      const wasOpenDay = openDays.includes(yesterdayDow);
      if (!wasOpenDay) continue; // gym closed yesterday → skip

      const checkedIn = checkinSet.has(member._id.toString());
      if (checkedIn) {
        // Reset miss streak if it was > 0
        await Gamification.updateOne(
          { memberId: member._id, currentMissStreak: { $gt: 0 } },
          { $set: { currentMissStreak: 0 } },
        );
        reset++;
      } else {
        await applyMissPenalty(member._id.toString(), yesterdayStr);
        penalized++;
      }
    }

    // 5. Store daily leaderboard positions and check position badges
    const topDocs = await Gamification.find({})
      .sort({ 'monthlyXP.xp': -1 })
      .limit(50)
      .select('memberId positionHistory consecutiveDaysAtPosition')
      .lean();

    const bulkOps = [];
    for (let i = 0; i < topDocs.length; i++) {
      const doc      = topDocs[i];
      const position = i + 1;
      const prevPos  = doc.consecutiveDaysAtPosition;

      const newConsec = (prevPos?.position === position)
        ? (prevPos.days || 0) + 1
        : 1;

      // Prune positionHistory to last 30 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 29);
      const cutoffStr = cutoff.getFullYear() + '-' +
        String(cutoff.getMonth() + 1).padStart(2, '0') + '-' +
        String(cutoff.getDate()).padStart(2, '0');

      const existingHistory = (doc.positionHistory || []).filter(p => p.date >= cutoffStr);
      existingHistory.push({ date: yesterdayStr, position });

      bulkOps.push({
        updateOne: {
          filter: { memberId: doc.memberId },
          update: {
            $set: {
              positionHistory:              existingHistory,
              consecutiveDaysAtPosition:    { position, days: newConsec },
            },
          },
        },
      });

      // Check position badges (async, non-blocking)
      checkPositionBadges(doc.memberId.toString(), position, newConsec)
        .catch(e => logger.error('cron_position_badge_error', { err: e.message }));
    }

    if (bulkOps.length) await Gamification.bulkWrite(bulkOps);

    logger.info('cron_gamification_daily', { penalized, reset, positions: topDocs.length });
  } catch (err) {
    logger.error('cron_gamification_daily error', { err: err.message });
  }
}, { timezone: 'Asia/Kolkata' });

// ── Gamification: monthly XP reset ─────────────────────────────────────────
// Runs on 1st of every month at 00:00 IST
const gamificationMonthlyReset = cron.schedule('0 0 1 * *', async () => {
  try {
    const now   = new Date();
    const month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    // Reset monthlyXP + monthlyCheckIns for all members
    const result = await Gamification.updateMany(
      {},
      {
        $set: {
          'monthlyXP.month':        month,
          'monthlyXP.xp':           0,
          'monthlyCheckIns.month':  month,
          'monthlyCheckIns.count':  0,
        },
      },
    );

    logger.info('cron_gamification_monthly_reset', { updated: result.modifiedCount, month });
  } catch (err) {
    logger.error('cron_gamification_monthly_reset error', { err: err.message });
  }
}, { timezone: 'Asia/Kolkata' });

module.exports = {
  checkExpiredMemberships,
  checkExpiredSubscriptions,
  sendMembershipReminders,
  calculateLeaderboards,
  autoCloseStaleCheckIns,
  expireWalletCredits,
  gamificationDailyJob,
  gamificationMonthlyReset,
};
