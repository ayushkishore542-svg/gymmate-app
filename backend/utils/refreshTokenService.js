const crypto = require('crypto');
const mongoose = require('mongoose');
const RefreshToken = require('../models/RefreshToken');
const { logger } = require('./logger');

const REFRESH_DAYS = 30;

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

    active.status = 'replaced';
    active.revokedAt = new Date();
    await active.save();

    const newPlain = generatePlainRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
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
