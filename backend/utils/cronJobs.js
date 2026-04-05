const cron = require('node-cron');
const User = require('../models/User');
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

// Check and update expired gym owner subscriptions - runs daily at midnight
const checkExpiredSubscriptions = cron.schedule('0 0 * * *', async () => {
  try {
    console.log('Running expired subscription check...');
    
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Find owners whose subscription expired more than 3 days ago
    const expiredOwners = await User.find({
      role: 'owner',
      subscriptionStatus: { $in: ['trial', 'active'] },
      subscriptionEndDate: { $lt: threeDaysAgo }
    });

    // Update their status to expired
    for (const owner of expiredOwners) {
      owner.subscriptionStatus = 'expired';
      await owner.save();
      console.log(`Subscription expired for gym ID: ${owner._id} (${owner.gymName})`);
      
      // TODO: Send notification to owner
    }

    console.log(`Processed ${expiredOwners.length} expired subscriptions`);

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

module.exports = {
  checkExpiredMemberships,
  checkExpiredSubscriptions,
  sendMembershipReminders,
  calculateLeaderboards
};
