const cron = require('node-cron');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Wallet = require('../models/Wallet');
const { calculateForGym } = require('../routes/calorieLeaderboard');

// Check and update expired memberships - runs daily at midnight
const checkExpiredMemberships = cron.schedule('0 0 * * *', async () => {
  try {
    console.log('Running expired membership check...');
    
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Find members whose membership expired more than 3 days ago
    const expiredMembers = await User.find({
      role: 'member',
      membershipStatus: 'active',
      membershipEndDate: { $lt: threeDaysAgo }
    });

    // Update their status to expired
    for (const member of expiredMembers) {
      member.membershipStatus = 'expired';
      await member.save();
      console.log(`Membership expired for member ID: ${member._id}`);
      
      // TODO: Send notification to member and gym owner
    }

    console.log(`Processed ${expiredMembers.length} expired memberships`);

  } catch (error) {
    console.error('Error checking expired memberships:', error);
  }
});

// Check and update expired gym owner subscriptions - runs daily at midnight IST (18:30 UTC)
const checkExpiredSubscriptions = cron.schedule('30 18 * * *', async () => {
  try {
    console.log('Running expired subscription check...');

    const now = new Date();

    // 1. Trial owners whose trial has ended AND have not added payment method
    const expiredTrials = await User.find({
      role: 'owner',
      subscriptionStatus: 'trial',
      subscriptionEndDate: { $lt: now },
      paymentMethodAdded: { $ne: true },
    });

    for (const owner of expiredTrials) {
      owner.subscriptionStatus = 'expired';
      await owner.save();
      console.log(`Trial expired for owner ${owner._id} (${owner.gymName})`);
      // TODO: Send push/email notification
    }

    // 2. Cancelled subscriptions whose access period has ended
    const accessEnded = await User.find({
      role: 'owner',
      subscriptionStatus: 'cancelled',
      currentPeriodEnd: { $lt: now },
    });

    for (const owner of accessEnded) {
      owner.subscriptionStatus = 'expired';
      await owner.save();
      console.log(`Cancelled access ended for owner ${owner._id} (${owner.gymName})`);
    }

    console.log(`Processed ${expiredTrials.length + accessEnded.length} expired subscriptions`);

  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
  }
});

// Send membership expiry reminders - runs daily at 9 AM
const sendMembershipReminders = cron.schedule('0 9 * * *', async () => {
  try {
    console.log('Sending membership expiry reminders...');
    
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Find members whose membership expires in next 3 days
    const expiringMembers = await User.find({
      role: 'member',
      membershipStatus: 'active',
      membershipEndDate: {
        $gte: now,
        $lte: threeDaysFromNow
      }
    }).populate('gymOwnerId', 'name gymName email');

    for (const member of expiringMembers) {
      const daysLeft = Math.ceil((new Date(member.membershipEndDate) - now) / (1000 * 60 * 60 * 24));
      console.log(`Reminder queued for member ID: ${member._id}, expires in ${daysLeft} day(s)`);
      
      // TODO: Send email/SMS notification to member
      // TODO: Send notification to gym owner
    }

    console.log(`Sent ${expiringMembers.length} membership reminders`);

  } catch (error) {
    console.error('Error sending membership reminders:', error);
  }
});

// Recalculate leaderboards for all gyms — runs daily at midnight
const calculateLeaderboards = cron.schedule('0 0 * * *', async () => {
  try {
    console.log('🏆 Calculating weekly leaderboards...');
    const owners = await User.find({ role: 'owner' }, '_id gymName');
    let count = 0;
    for (const owner of owners) {
      try {
        await calculateForGym(owner._id);
        count++;
      } catch (err) {
        console.error(`Leaderboard failed for gym ${owner.gymName}:`, err.message);
      }
    }
    console.log(`✅ Leaderboards calculated for ${count} gyms`);
  } catch (err) {
    console.error('Error calculating leaderboards:', err);
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

    const staleToday = await Attendance.find({
      date: today,
      checkOutTime: null,
      durationUnknown: false,
      checkInTime: { $lt: threeHoursAgo },
    });

    for (const rec of staleToday) {
      rec.durationUnknown = true;
      // NOTE: checkOutTime stays null so member CAN still check out
      await rec.save();
    }

    if (staleToday.length > 0) {
      console.log(`⏰ Marked ${staleToday.length} stale check-in(s) as durationUnknown`);
    }

    // Also close open records from PREVIOUS days (member never came back)
    const stalePrevious = await Attendance.find({
      date: { $lt: today },
      checkOutTime: null,
    });
    for (const rec of stalePrevious) {
      rec.durationUnknown = true;
      await rec.save();
    }
    if (stalePrevious.length > 0) {
      console.log(`⏰ Closed ${stalePrevious.length} unclosed check-in(s) from previous days`);
    }
  } catch (error) {
    console.error('Auto-close stale check-ins error:', error);
  }
});

// Zero-out expired wallet credit balance -- runs daily at 1 AM
const expireWalletCredits = cron.schedule('0 1 * * *', async () => {
  try {
    console.log('Checking expired wallet credits...');
    const now = new Date();

    // Find all wallets that have at least one credit transaction that has expired
    const wallets = await Wallet.find({
      'transactions.type': 'credit',
      'transactions.expiresAt': { $lt: now },
    });

    let updated = 0;
    for (const wallet of wallets) {
      const hadExpired = wallet.transactions.some(
        t => t.type === 'credit' && t.expiresAt && new Date(t.expiresAt) < now
      );
      if (hadExpired) {
        const oldBalance = wallet.balance;
        wallet.recomputeBalance();
        if (wallet.balance !== oldBalance) {
          await wallet.save();
          updated++;
          console.log(
            'Wallet expired credits zeroed for userId:',
            wallet.userId,
            '| Old balance:', oldBalance,
            '| New balance:', wallet.balance
          );
        }
      }
    }
    console.log('Expired wallet credits processed for ' + updated + ' wallets');
  } catch (err) {
    console.error('Error expiring wallet credits:', err);
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
