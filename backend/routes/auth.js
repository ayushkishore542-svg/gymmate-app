const express = require('express');
const router  = express.Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const QRCode  = require('qrcode');
const { body, validationResult } = require('express-validator');
const admin = require('firebase-admin');
const User       = require('../models/User');
const TrialUsage = require('../models/TrialUsage');
const authMiddleware = require('../middleware/auth');
const { signAccessToken, verifyAccessToken } = require('../utils/jwtAccess');
const { issueRefreshToken, rotateRefreshToken, revokeAllForUser } = require('../utils/refreshTokenService');
const { normalizeIndianE164 } = require('../utils/phoneNormalize');
const { validatePasswordStrength, isCommonPassword } = require('../utils/passwordPolicy');
const { getEffectiveSubStatus } = require('../utils/getEffectiveSubStatus');
const { logger } = require('../utils/logger');

// Reusable helper — returns 400 if any validation rule failed
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: errors.array()[0]?.msg || 'Validation failed', errors: errors.array() });
    return false;
  }
  return true;
};

// Login ID validation regex: 4-20 chars, starts with letter, lowercase letters/numbers/dots/underscores
const LOGIN_ID_REGEX = /^[a-z][a-z0-9._]{3,19}$/;

const validateLoginIdFormat = (loginId) => LOGIN_ID_REGEX.test(loginId);

const verifyPhoneLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const phone = (req.body && req.body.phone) ? String(req.body.phone) : '';
    return `${ipKeyGenerator(req, res)}:${phone}`;
  },
  handler: (req, res, _next, options) => {
    logger.warn('rate_limit', { action: 'verify_phone', ip: req.ip });
    res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
    res.status(429).json({ message: 'Too many verification attempts for this number' });
  },
});

const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
    res.status(429).json({ message: 'Too many refresh attempts' });
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Too many registration attempts. Please try again in an hour.' },
});

// Owner-authenticated member creation. Keyed per-owner (IP fallback) so a single
// owner's bulk onboarding never blocks other owners sharing an IP (Jio CGNAT).
// Must run AFTER authMiddleware so req.user is populated for the key.
const memberCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const uid = req.user && req.user._id ? req.user._id.toString() : 'anon';
    return `${ipKeyGenerator(req, res)}:${uid}`;
  },
  handler: (req, res, _next, options) => {
    logger.warn('rate_limit', { action: 'member_create', ip: req.ip });
    res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
    res.status(429).json({ message: 'Too many member additions. Please try again later.' });
  },
});

// ── GET /api/auth/check-id/:loginId — real-time availability check ───────────
router.get('/check-id/:loginId', async (req, res) => {
  try {
    const raw = req.params.loginId.trim().toLowerCase();

    // Validate format first
    if (!validateLoginIdFormat(raw)) {
      return res.status(200).json({
        available: false,
        message: 'Must be 4-20 characters, start with a letter, use only letters/numbers/./_ '
      });
    }

    const existing = await User.findOne({ loginId: raw });
    if (existing) {
      return res.status(200).json({ available: false, message: 'Already taken' });
    }

    return res.status(200).json({ available: true, message: 'Available!' });
  } catch (error) {
    logger.error('Check ID', { err: error.message });
    res.status(500).json({ available: false, message: 'Server error' });
  }
});

// ── POST /api/auth/verify-phone — verify Firebase ID token from frontend ─────
// Frontend sends OTP via Firebase SDK, gets idToken, and calls this to confirm.
router.post('/verify-phone', verifyPhoneLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'idToken is required' });
    }

    let decoded;
    if (process.env.NODE_ENV === 'development' && idToken === 'dev-mock-token') {
      decoded = { phone_number: req.body.phone || '+919999999999' };
    } else {
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch (firebaseErr) {
        logger.warn('verify-phone firebase', { err: firebaseErr.message });
        return res.status(400).json({ message: 'Phone verification failed: invalid or expired token' });
      }
    }

    const tokenPhone = decoded.phone_number;
    if (!tokenPhone) {
      return res.status(400).json({ message: 'Verified token has no phone number' });
    }

    const canonical = normalizeIndianE164(tokenPhone) || tokenPhone.trim();

    return res.json({ verified: true, phone: canonical });
  } catch (error) {
    logger.error('verify-phone', { err: error.message });
    return res.status(400).json({ message: 'Phone verification failed' });
  }
});

// ── GET /api/auth/check-trial/:phone — check if trial is available ───────────
router.get('/check-trial/:phone', async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.phone).trim();
    const phone = normalizeIndianE164(raw) || raw;
    if (!phone.startsWith('+91') || phone.length < 13) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }
    const existing = await TrialUsage.findOne({ phone });
    return res.json({ trialAvailable: !existing });
  } catch (error) {
    logger.error('check-trial', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/auth/refresh-token — rotate refresh token, issue new access JWT ─
router.post('/refresh-token', refreshTokenLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }
    const { plain: newRefresh, userId } = await rotateRefreshToken(refreshToken, {
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });
    const user = await User.findById(userId).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }
    const token = signAccessToken({ _id: user._id, role: user.role });
    return res.json({ token, refreshToken: newRefresh });
  } catch (e) {
    const status = e.status || 401;
    return res.status(status).json({ message: e.message || 'Invalid refresh token' });
  }
});

// Register Owner
router.post('/register/owner', registerLimiter, [
  body('name').notEmpty().trim().escape(),
  body('loginId').notEmpty().trim(),
  body('email').isEmail().normalizeEmail().trim(),
  body('password').isLength({ min: 8 }).trim(),
  body('password').custom((v) => {
    const r = validatePasswordStrength(v);
    if (!r.ok) throw new Error(r.message);
    return true;
  }),
  body('gymName').notEmpty().trim().escape(),
  body('phone').optional().trim(),
  body('idToken').notEmpty().withMessage('Phone verification token is required'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { name, loginId, email, phone, password, gymName, referralCode, idToken } = req.body;

    const pwdCheck = validatePasswordStrength(password);
    if (!pwdCheck.ok) {
      return res.status(400).json({ message: pwdCheck.message });
    }

    // ── Step 1: Verify Firebase phone token ───────────────────────────────
    let verifiedPhone;
    try {
      let decoded;
      if (process.env.NODE_ENV === 'development' && idToken === 'dev-mock-token') {
        decoded = { phone_number: phone || '+919999999999' };
      } else {
        decoded = await admin.auth().verifyIdToken(idToken);
      }
      if (!decoded.phone_number) {
        return res.status(400).json({ message: 'Phone not verified: token has no phone' });
      }
      verifiedPhone = normalizeIndianE164(decoded.phone_number) || decoded.phone_number.trim();
      if (phone) {
        const bodyPhone = normalizeIndianE164(phone.trim());
        if (bodyPhone && bodyPhone !== verifiedPhone) {
          return res.status(400).json({ message: 'Phone not verified: token phone does not match submitted phone' });
        }
      }
    } catch (firebaseErr) {
      logger.warn('register/owner firebase', { err: firebaseErr.message });
      return res.status(400).json({ message: 'Phone not verified: invalid or expired token. Please verify your phone again.' });
    }

    // Validate loginId format
    const normalizedLoginId = loginId.trim().toLowerCase();
    if (!validateLoginIdFormat(normalizedLoginId)) {
      return res.status(400).json({ message: 'Invalid Login ID format. Use 4-20 characters, start with a letter, only letters/numbers/./_ allowed.' });
    }

    // Check loginId uniqueness (globally across owners + members)
    const existingLoginId = await User.findOne({ loginId: normalizedLoginId });
    if (existingLoginId) {
      return res.status(400).json({ message: 'This Login ID is already taken' });
    }

    // Check email uniqueness only — same phone is allowed (owner with multiple gyms).
    // Trial-per-phone is enforced via TrialUsage below.
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    // Generate unique referral code
    let newReferralCode;
    let isUnique = false;
    while (!isUnique) {
      newReferralCode = User.generateReferralCode();
      const existing = await User.findOne({ referralCode: newReferralCode });
      if (!existing) isUnique = true;
    }

    // Check if referred by someone
    if (referralCode) {
      await User.findOne({ referralCode });
    }

    // ── Step 2: Check trial abuse — has this phone used a trial before? ───
    const existingTrial = await TrialUsage.findOne({ phone: verifiedPhone });
    const trialUsed = !!existingTrial;

    // Create owner
    const trialStart = new Date();
    // If trial already used: set end date in the past (no trial period)
    const trialEnd = trialUsed
      ? new Date(Date.now() - 1000) // expired immediately
      : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days

    const owner = new User({
      name,
      loginId: normalizedLoginId,
      email,
      phone: verifiedPhone,
      password,
      role: 'owner',
      gymName,
      referralCode: newReferralCode,
      referredBy: referralCode || null,
      // Subscription
      subscriptionStatus:    trialUsed ? 'expired' : 'trial',
      subscriptionStartDate: trialStart,
      subscriptionEndDate:   trialEnd,
      // Razorpay fields — all null until owner sets up auto-pay
      paymentMethodAdded:       false,
      razorpaySubscriptionId:   null,
      razorpayCustomerId:       null,
      razorpayShortUrl:         null,
      currentPeriodStart:       null,
      currentPeriodEnd:         null,
      lastPaymentAt:            null,
      lastPaymentStatus:        null,
    });

    await owner.save();

    // Generate QR Code for gym
    const qrData = JSON.stringify({
      gymId: owner._id,
      gymName: owner.gymName,
      type: 'attendance'
    });
    
    const qrCodeDataURL = await QRCode.toDataURL(qrData);
    owner.gymQRCode = qrCodeDataURL;
    await owner.save();

    // ── Step 3: Record trial usage (only if trial was granted) ───────────
    if (!trialUsed) {
      await TrialUsage.create({ phone: verifiedPhone, gymOwnerId: owner._id });
    }

    const token = signAccessToken({ _id: owner._id, role: owner.role });
    const { plain: refreshToken } = await issueRefreshToken(owner._id, {
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    res.status(201).json({
      message: 'Owner registered successfully',
      trialGranted: !trialUsed,
      token,
      refreshToken,
      user: {
        id: owner._id,
        name: owner.name,
        loginId: owner.loginId,
        email: owner.email,
        phone: owner.phone,
        role: owner.role,
        gymName: owner.gymName,
        referralCode: owner.referralCode,
        subscriptionStatus: owner.subscriptionStatus,
        subscriptionEndDate: owner.subscriptionEndDate,
        gymQRCode: owner.gymQRCode
      }
    });

  } catch (error) {
    logger.error('Register owner error', { err: error.message });
    res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server error' : error.message });
  }
});

// Register Member (by gym owner — must be authenticated as owner)
router.post('/register/member', authMiddleware, memberCreateLimiter, [
  body('name').notEmpty().trim().escape(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().trim(),
  // Relaxed policy for owner-created member accounts: min 6, no complexity,
  // but common/worst-case passwords still blocked. Strict paths keep validatePasswordStrength.
  body('password').isLength({ min: 6 }).withMessage('Min 6 characters').trim(),
  body('password').custom((v) => {
    if (isCommonPassword(v)) throw new Error('This password is too common');
    return true;
  }),
  body('loginId').notEmpty().trim(),
  body('phone').notEmpty().trim(),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only gym owners can register members' });
    }
    const gymOwnerId = req.user._id.toString();

    const {
      name,
      email,
      phone,
      password,
      loginId,
      membershipFee,
      membershipDuration,
      membershipPlan,
      membershipStartDate: membershipStartDateInput,
      profilePhoto,
      address
    } = req.body;

    // Normalise duration: accept a number, a plan string ('1month','3months','6months','1year'),
    // or fall back to 1. This makes the backend tolerant of both old and new frontend payloads.
    const planToMonths = { '1month': 1, '3months': 3, '6months': 6, '1year': 12 };
    const durationMonths = Number.isFinite(Number(membershipDuration))
      ? Number(membershipDuration)
      : planToMonths[membershipPlan] || planToMonths[membershipDuration] || 1;

    // Validate loginId
    if (!loginId) {
      return res.status(400).json({ message: 'Login ID is required' });
    }
    const normalizedMemberLoginId = loginId.trim().toLowerCase();
    if (!validateLoginIdFormat(normalizedMemberLoginId)) {
      return res.status(400).json({ message: 'Invalid Login ID format. Use 4-20 characters, start with a letter, only letters/numbers/./_ allowed.' });
    }

    // Check loginId uniqueness globally (owners + members share the same namespace)
    const existingLoginId = await User.findOne({ loginId: normalizedMemberLoginId });
    if (existingLoginId) {
      return res.status(400).json({ message: 'Login ID is already taken' });
    }

    const gymOwner = await User.findById(gymOwnerId);
    if (!gymOwner || gymOwner.role !== 'owner') {
      return res.status(400).json({ message: 'Invalid gym owner' });
    }

    const memberPhone = normalizeIndianE164(phone.trim()) || phone.trim();
    const existingPhone = await User.findOne({ phone: memberPhone });
    if (existingPhone) {
      return res.status(400).json({ message: 'Phone number is already registered' });
    }

    // Check if a member with the same email already exists in this gym (only if email provided)
    if (email) {
      const existingMember = await User.findOne({ email, gymOwnerId });
      if (existingMember) {
        return res.status(400).json({ message: 'A member with this email already exists in your gym' });
      }
    }

    // Generate unique referral code
    let newReferralCode;
    let isUnique = false;
    while (!isUnique) {
      newReferralCode = User.generateReferralCode();
      const existing = await User.findOne({ referralCode: newReferralCode });
      if (!existing) isUnique = true;
    }

    // Calculate membership end date
    const membershipStartDate = membershipStartDateInput ? new Date(membershipStartDateInput) : new Date();
    const membershipEndDate = new Date(membershipStartDate);
    membershipEndDate.setMonth(membershipEndDate.getMonth() + durationMonths);

    // Create member
    const member = new User({
      name,
      ...(email && { email }),
      phone: memberPhone,
      password,
      loginId: normalizedMemberLoginId,
      role: 'member',
      gymOwnerId,
      referralCode: newReferralCode,
      membershipStatus: 'active',
      membershipStartDate,
      membershipEndDate,
      membershipFee: membershipFee || 0,
      profilePhoto: profilePhoto || null,
      address: address || ''
    });

    await member.save();

    const token = signAccessToken({ _id: member._id, role: member.role });
    const { plain: refreshToken } = await issueRefreshToken(member._id, {
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    res.status(201).json({
      message: 'Member registered successfully',
      token,
      refreshToken,
      user: {
        id: member._id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        loginId: member.loginId,
        role: member.role,
        referralCode: member.referralCode,
        membershipStatus: member.membershipStatus,
        membershipEndDate: member.membershipEndDate,
        profilePhoto: member.profilePhoto,
        gymOwner: {
          id: gymOwner._id,
          name: gymOwner.name,
          gymName: gymOwner.gymName
        }
      }
    });

  } catch (error) {
    logger.error('Register member error', { err: error.message });
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const messages = {
        phone: 'Phone number is already registered',
        loginId: 'Login ID is already taken',
        email: 'Email is already registered',
      };
      return res.status(400).json({ message: messages[field] || 'Duplicate entry — please check your details' });
    }
    res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server error' : error.message });
  }
});

// Login
router.post('/login', [
  body('email').optional().isEmail().normalizeEmail().trim(),
  body('loginId').optional().trim(),
  body('password').isLength({ min: 1 }).trim(),
  body('role').notEmpty().trim(),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { email, loginId, password, role } = req.body;

    // Determine the single identifier used for lookup and audit logs.
    // Both owners and members now log in with loginId.
    // Fallback: if the identifier contains '@' treat it as email (backward compat).
    const rawIdentifier = loginId || email || '';
    const identifier = rawIdentifier.trim();

    // Find user
    let user;
    if (role === 'member') {
      if (!identifier) {
        return res.status(400).json({ message: 'Login ID is required' });
      }
      user = await User.findOne({ loginId: identifier.toLowerCase(), role });
    } else {
      // Owner: prefer loginId lookup; fall back to email if identifier looks like one
      if (!identifier) {
        return res.status(400).json({ message: 'Login ID is required' });
      }
      if (identifier.includes('@')) {
        // Legacy email login
        user = await User.findOne({ email: identifier.toLowerCase(), role });
      } else {
        user = await User.findOne({ loginId: identifier.toLowerCase(), role });
      }
    }

    if (!user) {
      logger.warn('login_failed', { reason: 'no_user', identifier, role, ip: req.ip });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const mins = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({ message: `Account locked. Try again in ${mins} minute(s).` });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        user.loginAttempts = 0;
      }
      await user.save();
      logger.warn('login_failed', { reason: 'bad_password', userId: String(user._id), ip: req.ip });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    const token = signAccessToken({ _id: user._id, role: user.role });
    const { plain: refreshToken } = await issueRefreshToken(user._id, {
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    logger.info('login_success', { userId: String(user._id), role: user.role, ip: req.ip });

    // Prepare response based on role
    let responseData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      referralCode: user.referralCode
    };

    if (user.role === 'owner') {
      responseData.loginId = user.loginId;
      responseData.gymName = user.gymName;
      responseData.gymQRCode = user.gymQRCode;
      responseData.subscriptionStatus = user.subscriptionStatus;
      responseData.subscriptionEndDate = user.subscriptionEndDate;
      responseData.razorpayShortUrl = user.razorpayShortUrl;
      responseData.paymentMethodAdded = user.paymentMethodAdded;

      // Detect trial used on a DIFFERENT account with the same phone.
      // Applies when this account has 'expired' status immediately (never had a trial).
      let trialUsedOnAnotherAccount = false;
      if (user.subscriptionStatus === 'expired') {
        const trialRecord = await TrialUsage.findOne({ phone: user.phone });
        if (trialRecord && trialRecord.gymOwnerId.toString() !== user._id.toString()) {
          trialUsedOnAnotherAccount = true;
        }
      }
      responseData.trialUsedOnAnotherAccount = trialUsedOnAnotherAccount;
    } else {
      const gymOwner = await User.findById(user.gymOwnerId);
      responseData.loginId = user.loginId;
      responseData.membershipStatus = user.membershipStatus;
      responseData.membershipEndDate = user.membershipEndDate;
      responseData.profilePhoto = user.profilePhoto;
      responseData.gymOwner = {
        id: gymOwner._id,
        name: gymOwner.name,
        gymName: gymOwner.gymName
      };
    }

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: responseData
    });

  } catch (error) {
    logger.error('Login error', { err: error.message });
    res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server error' : error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const out = verifyAccessToken(token);
    if (out.expired) {
      return res.status(401).json({ message: 'Token expired' });
    }
    const user = await User.findById(out.decoded._id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userObj = user.toObject();

    // Merge effective subscription state so Profile doesn't show a stale
    // legacy "Expired" when an active Google Play OwnerSubscription exists.
    // Only owners have OwnerSubscription; skip the extra lookup for members.
    if (user.role === 'owner') {
      try {
        const eff = await getEffectiveSubStatus(user._id);
        if (eff && eff.ownerActive) {
          // Same field names + types (Date). Only values corrected.
          userObj.subscriptionStatus  = eff.status;          // 'active'
          userObj.subscriptionEndDate = eff.nextBillingDate; // OwnerSubscription.expiryTime
        }
      } catch (e) {
        // Never let sub-status lookup break /me (critical boot path).
        // Fallback: legacy user fields as-is.
        if (process.env.NODE_ENV !== 'production') console.error('[/me] sub status failed:', e.message);
      }
    }

    res.json({ user: userObj });

  } catch (error) {
    logger.error('Get me error', { err: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Update Profile ──────────────────────────────────────────────────────────

router.put('/update-profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, address, gymName, profilePhoto, gymLogo } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined)         user.name = name.trim();
    if (phone !== undefined)        user.phone = phone.trim();
    if (address !== undefined)      user.address = address.trim();
    if (gymName !== undefined)      user.gymName = gymName.trim();
    if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;
    if (gymLogo !== undefined)      user.gymLogo = gymLogo;

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ user: userObj, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('[Update profile]', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Phone number already in use' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Change Password ─────────────────────────────────────────────────────────
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old and new passwords are required' });
    }
    const pwdCheck = validatePasswordStrength(newPassword);
    if (!pwdCheck.ok) {
      return res.status(400).json({ message: pwdCheck.message });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();
    await revokeAllForUser(user._id);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('[Change password]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Deactivate Gym ──────────────────────────────────────────────────────────
router.put('/deactivate-gym', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can deactivate their gym' });
    }

    user.isActive = false;
    await user.save();

    // Deactivate all members under this gym
    await User.updateMany({ gymOwnerId: user._id, role: 'member' }, { isActive: false });

    res.json({ message: 'Gym deactivated. All members have been deactivated.' });
  } catch (err) {
    console.error('[Deactivate gym]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Delete Account ──────────────────────────────────────────────────────────
router.delete('/delete-account', authMiddleware, async (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'DELETE') {
      return res.status(400).json({ message: 'Type DELETE to confirm account deletion' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'owner') {
      // Delete all members under this gym
      await User.deleteMany({ gymOwnerId: user._id, role: 'member' });
    }

    await User.findByIdAndDelete(user._id);
    res.json({ message: 'Account deleted permanently' });
  } catch (err) {
    console.error('[Delete account]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /update-member-profile — member-specific profile update ─────────────
router.put('/update-member-profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'member')
      return res.status(403).json({ message: 'Only members can use this endpoint' });

    const { name, phone, address, profilePhoto, avatarId, fitnessGoal, targetWeight, dailyCalorieTarget } = req.body;

    if (name    !== undefined) user.name    = name.trim();
    if (phone   !== undefined) user.phone   = phone.trim();
    if (address !== undefined) user.address = address.trim();
    if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;
    if (avatarId     !== undefined) user.avatarId     = avatarId;
    if (fitnessGoal  !== undefined) user.fitnessGoal  = fitnessGoal;
    if (targetWeight !== undefined) user.targetWeight = targetWeight;
    if (dailyCalorieTarget !== undefined) user.dailyCalorieTarget = dailyCalorieTarget;

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ user: userObj, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('[Update member profile]', err);
    if (err.code === 11000)
      return res.status(400).json({ message: 'Phone number already in use' });
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /delete-member-account — member self-deletion ────────────────────
router.delete('/delete-member-account', authMiddleware, async (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'DELETE')
      return res.status(400).json({ message: 'Send confirmation: "DELETE" to proceed' });

    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'member')
      return res.status(403).json({ message: 'Only members can use this endpoint' });

    await User.findByIdAndDelete(user._id);
    res.json({ message: 'Account deleted permanently' });
  } catch (err) {
    console.error('[Delete member account]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/auth/gym-contact/:ownerId — gym contact info for members ────────
router.get('/gym-contact/:ownerId', authMiddleware, async (req, res) => {
  try {
    const owner = await User.findById(req.params.ownerId)
      .select('name gymName email phone');
    if (!owner) {
      return res.status(404).json({ message: 'Gym not found' });
    }
    res.json({
      gymName:   owner.gymName  || '',
      ownerName: owner.name     || '',
      email:     owner.email    || '',
      phone:     owner.phone    || '',
    });
  } catch (error) {
    console.error('[Gym contact]', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;