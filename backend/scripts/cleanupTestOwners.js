/**
 * cleanupTestOwners.js
 * Deletes all owner users and their related data from MongoDB.
 * Safe to run on test data only — NEVER run on production.
 *
 * Usage: node scripts/cleanupTestOwners.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User       = require('../models/User');
const Notice     = require('../models/Notice');
const Payment    = require('../models/Payment');
const Visitor    = require('../models/Visitor');
const Attendance = require('../models/Attendance');

async function cleanup() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI not set. Check your .env file.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    authSource: 'admin',
  });
  console.log('✅ Connected\n');

  // 1. Find all owner IDs first
  const owners = await User.find({ role: 'owner' }).select('_id gymName email');
  const ownerIds = owners.map(o => o._id);

  console.log(`Found ${owners.length} owner(s):`);
  owners.forEach(o => console.log(`  - ${o.gymName} (${o.email}) [${o._id}]`));
  console.log('');

  if (ownerIds.length === 0) {
    console.log('No owners found. Nothing to delete.');
    await mongoose.disconnect();
    return;
  }

  // 2. Find all members linked to these owners
  const memberIds = await User.find({ role: 'member', gymOwnerId: { $in: ownerIds } })
    .select('_id')
    .then(ms => ms.map(m => m._id));

  console.log(`Found ${memberIds.length} member(s) linked to these owners`);

  // 3. Delete related data
  const allUserIds = [...ownerIds, ...memberIds];

  const [
    noticesDel,
    visitorsDel,
    paymentsDel,
    attendanceDel,
    membersDel,
    ownersDel,
  ] = await Promise.all([
    Notice    .deleteMany({ gymOwnerId: { $in: ownerIds } }),
    Visitor   .deleteMany({ gymOwnerId: { $in: ownerIds } }),
    Payment   .deleteMany({ gymOwnerId: { $in: ownerIds } }),
    Attendance.deleteMany({ $or: [
      { gymOwnerId: { $in: ownerIds } },
      { memberId:   { $in: memberIds } },
    ]}),
    User.deleteMany({ role: 'member', gymOwnerId: { $in: ownerIds } }),
    User.deleteMany({ role: 'owner',  _id:        { $in: ownerIds } }),
  ]);

  console.log('\n📊 Cleanup results:');
  console.log(`  Owners deleted:      ${ownersDel.deletedCount}`);
  console.log(`  Members deleted:     ${membersDel.deletedCount}`);
  console.log(`  Notices deleted:     ${noticesDel.deletedCount}`);
  console.log(`  Visitors deleted:    ${visitorsDel.deletedCount}`);
  console.log(`  Payments deleted:    ${paymentsDel.deletedCount}`);
  console.log(`  Attendance deleted:  ${attendanceDel.deletedCount}`);
  console.log('\n✅ Cleanup complete. Fresh start ready.');

  await mongoose.disconnect();
}

cleanup().catch(err => {
  console.error('❌ Cleanup failed:', err.message);
  process.exit(1);
});
