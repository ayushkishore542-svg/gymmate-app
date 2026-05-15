const cron = require('node-cron');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Wallet = require('../models/Wallet');
const { calculateForGym } = require('../routes/calorieLeaderboard');
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

module.exports = {
  checkExpiredMemberships,
  checkExpiredSubscriptions,
  sendMembershipReminders,
  calculateLeaderboards,
  autoCloseStaleCheckIns,
  expireWalletCredits,
};
