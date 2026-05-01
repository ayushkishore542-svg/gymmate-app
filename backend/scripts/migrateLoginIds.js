/**
 * migrateLoginIds.js
 *
 * One-time migration: auto-generate a loginId for every user that doesn't have one.
 * Format: <name_cleaned>_<3 random digits>
 *   e.g.  "John Doe"   → "john_doe_482"
 *         "FitLife Gym" → "fitlife_gym_197"
 *
 * Rules enforced:
 *   - 4-20 chars, starts with a letter
 *   - Only lowercase letters, numbers, dots, underscores
 *   - Globally unique (checked in DB before saving)
 *
 * Called once from server.js after MongoDB connects.
 * Safe to call on every startup — it only touches users without a loginId.
 */

const User = require('../models/User');

const LOGIN_ID_REGEX = /^[a-z][a-z0-9._]{3,19}$/;

/**
 * Derive a base slug from a name string.
 * "John Doe" → "john_doe"
 * "FitLife Gym Owner!" → "fitlife_gym_owner"
 */
function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')   // strip special chars
    .trim()
    .replace(/\s+/g, '_')          // spaces → underscores
    .replace(/^[^a-z]+/, '')       // ensure starts with letter
    .slice(0, 14);                  // leave room for _XXX suffix (max 17 + suffix = 20)
}

/**
 * Generate a candidate loginId from name, appending random 3-digit suffix.
 * Retries up to `maxAttempts` times if the generated ID is taken.
 */
async function generateUniqueLoginId(name, maxAttempts = 20) {
  const base = nameToSlug(name) || 'user';

  for (let i = 0; i < maxAttempts; i++) {
    const suffix = Math.floor(100 + Math.random() * 900); // 100–999
    const candidate = `${base}_${suffix}`.slice(0, 20);

    // Must pass format check (base might be very short)
    if (!LOGIN_ID_REGEX.test(candidate)) continue;

    // Must be unique
    const exists = await User.findOne({ loginId: candidate });
    if (!exists) return candidate;
  }

  // Last resort: use ObjectId fragment
  return null;
}

async function migrateLoginIds() {
  try {
    const usersWithoutId = await User.find({ loginId: { $in: [null, undefined, ''] } });

    if (usersWithoutId.length === 0) {
      console.log('✅ [Migration] All users already have a Login ID — nothing to do.');
      return;
    }

    console.log(`🔄 [Migration] Found ${usersWithoutId.length} user(s) without a Login ID. Generating...`);

    let success = 0;
    let failed = 0;

    for (const user of usersWithoutId) {
      const loginId = await generateUniqueLoginId(user.name);
      if (!loginId) {
        console.warn(`⚠️ [Migration] Could not generate loginId for user: ${user._id} (${user.name})`);
        failed++;
        continue;
      }

      // Use updateOne to bypass the pre-save hook (password re-hash)
      await User.updateOne({ _id: user._id }, { $set: { loginId } });
      console.log(`  ✓ ${user.role} "${user.name}" → @${loginId}`);
      success++;
    }

    console.log(`✅ [Migration] Done. ${success} updated, ${failed} skipped.`);
  } catch (err) {
    console.error('❌ [Migration] migrateLoginIds failed:', err.message);
    // Non-fatal — don't crash the server
  }
}

module.exports = migrateLoginIds;
