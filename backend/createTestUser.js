/**
 * createTestUser.js — one-time script to seed a test owner account.
 * Usage: node createTestUser.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./models/User');

const TEST_USER = {
  name:             'John Doe',
  loginId:          'john08',
  email:            'john@gmail.com',
  password:         'Hellobro@08',
  role:             'owner',
  gymName:          'Test Gym',
  membershipStatus: 'active',
  subscriptionStatus: 'active',
  subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  phone:            '+919999999999',
};

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {
    authSource: 'admin',
    retryWrites: true,
    w: 'majority',
  });
  console.log('Connected to MongoDB');

  // Check if already exists
  const existing = await User.findOne({
    $or: [{ email: TEST_USER.email }, { loginId: TEST_USER.loginId }],
  });

  if (existing) {
    console.log('User already exists:');
    console.log('  _id:     ', existing._id.toString());
    console.log('  email:   ', existing.email);
    console.log('  loginId: ', existing.loginId);
    console.log('  role:    ', existing.role);
    await mongoose.connection.close();
    process.exit(0);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(TEST_USER.password, 12);

  // Generate unique referral code
  const referralCode = 'JOHN' + Math.random().toString(36).substring(2, 6).toUpperCase();

  const user = new User({
    ...TEST_USER,
    password:     hashedPassword,
    referralCode,
    isActive:     true,
  });

  await user.save();

  console.log('Test owner created successfully:');
  console.log('  _id:         ', user._id.toString());
  console.log('  email:       ', user.email);
  console.log('  loginId:     ', user.loginId);
  console.log('  role:        ', user.role);
  console.log('  gymName:     ', user.gymName);
  console.log('  referralCode:', user.referralCode);
  console.log('  password:     Hellobro@08 (hashed)');

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
