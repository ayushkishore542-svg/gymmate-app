const crypto = require('crypto');
const mongoose = require('mongoose');
const RefreshToken = require('../models/RefreshToken');
const { logger } = require('./logger');

const REFRESH_DAYS = 30;
const GRACE_MS = 20 * 1000; // 20s window: legit parallel-refresh race, not theft

function hashToken(plain) {
  return crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
}

function generatePlainRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {{ ip?: string, userAgent?: string }} meta
 * @returns {Promise<{ plain: string, familyId: import('mongoose').Types.ObjectId }>}
 */
async function issueRefreshToken(userId, meta = {}) {
  const plain = generatePlainRefreshToken();
  const familyId = new mongoose.Types.ObjectId();
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId,
    familyId,
    tokenHash: hashToken(plain),
    status: 'active',
    expiresAt,
    ip: meta.ip || '',
    userAgent: meta.userAgent || '',
  });
  return { plain, familyId };
}

/**
 * Rotate refresh token. On reuse of revoked token, revokes whole family.
 * @returns {Promise<{ plain: string, userId: string }>}
 */
async function rotateRefreshToken(plain, meta = {}) {
  if (!plain || typeof plain !== 'string') {
    const err = new Error('Invalid refresh token');
    err.status = 401;
    throw err;
  }
  const tokenHash = hashToken(plain);

  const active = await RefreshToken.findOne({ tokenHash, status: 'active' });
  if (active) {
    if (active.expiresAt.getTime() < Date.now()) {
      active.status = 'revoked';
      active.revokedAt = new Date();
      await active.save();
      const err = new Error('Refresh token expired');
      err.status = 401;
      throw err;
    }

    const newPlain = generatePlainRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

    active.status = 'replaced';
    active.revokedAt = new Date();
    active.replacedByHash = hashToken(newPlain); // link old → replacement
    active.rotatedAt = new Date();               // grace-window anchor
    await active.save();

    await RefreshToken.create({
      userId: active.userId,
      familyId: active.familyId,
      tokenHash: hashToken(newPlain),
      status: 'active',
      expiresAt,
      ip: meta.ip || '',
      userAgent: meta.userAgent || '',
    });
    return { plain: newPlain, userId: active.userId.toString() };
  }

  const compromised = await RefreshToken.findOne({
    tokenHash,
    status: { $in: ['revoked', 'replaced'] },
  });
  if (compromised) {
    // Grace window: a token that was legitimately rotated moments ago and is
    // being replayed by a parallel request (dashboard fires ~8 reqs at once,
    // all 401, all refresh). That's a race, not theft — issue a fresh pair in
    // the SAME family instead of nuking the family.
    const withinGrace =
      compromised.status === 'replaced' &&   // normal rotation only, NOT a revoked family
      compromised.replacedByHash &&
      compromised.rotatedAt &&
      Date.now() - new Date(compromised.rotatedAt).getTime() <= GRACE_MS &&
      compromised.expiresAt &&
      new Date(compromised.expiresAt).getTime() > Date.now(); // don't inherit a dead expiry

    if (withinGrace) {
      const newPlain = generatePlainRefreshToken();
      // Inherit the original token's expiry, not a fresh 30d or short TTL.
      // Client usually keeps the grace token (last response wins) → giving it a
      // short TTL caused surprise logouts on next app open. Inheriting keeps
      // session lifetime unchanged; orphans die on the family's original expiry.
      const expiresAt = compromised.expiresAt;
      await RefreshToken.create({
        userId: compromised.userId,
        familyId: compromised.familyId,
        tokenHash: hashToken(newPlain),
        status: 'active',
        expiresAt,
        ip: meta.ip || '',
        userAgent: meta.userAgent || '',
      });
      logger.info('refresh_race_grace', {
        familyId: String(compromised.familyId),
        ip: meta.ip,
      });
      return { plain: newPlain, userId: compromised.userId.toString() };
    }

    // Outside grace (or an unknown/old token with no replacedByHash) → treat as
    // reuse/theft: revoke the whole family. Security behaviour unchanged.
    await RefreshToken.updateMany(
      { familyId: compromised.familyId, status: 'active' },
      { $set: { status: 'revoked', revokedAt: new Date() } }
    );
    logger.warn('Refresh token reuse detected — family revoked', {
      familyId: String(compromised.familyId),
      ip: meta.ip,
    });
  }

  const err = new Error('Invalid refresh token');
  err.status = 401;
  throw err;
}

async function revokeAllForUser(userId) {
  await RefreshToken.updateMany(
    { userId, status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  );
}

module.exports = {
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllForUser,
  REFRESH_DAYS,
};
