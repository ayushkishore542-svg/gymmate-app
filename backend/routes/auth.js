const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const QRCode  = require('qrcode');
const { body, validationResult } = require('express-validator');
const admin = require('firebase-admin');
const User       = require('../models/User');
const TrialUsage = require('../models/TrialUsage');

// Reusable helper — returns 400 if any validation rule failed
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

// Login ID validation regex: 4-20 chars, starts with letter, lowercase letters/numbers/dots/underscores
const LOGIN_ID_REGEX = /^[a-z][a-z0-9._]{3,19}$/;

const validateLoginIdFormat = (loginId) => LOGIN_ID_REGEX.test(loginId);

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
    console.error('[Check ID]', error);
    res.status(500).json({ available: false, message: 'Server error' });
  }
});

// ── POST /api/auth/verify-phone — verify Firebase ID token from frontend ─────
// Frontend sends OTP via Firebase SDK, gets idToken, and calls this to confirm.
router.post('/verify-phone', async (req, res) => {
  try {
    const { idToken, phone } = req.body;
    if (!idToken || !phone) {
      return res.status(400).json({ message: 'idToken and phone are required' });
    }

    // Verify token using Firebase Admin SDK
    const decoded = await admin.auth().verifyIdToken(idToken);
    const tokenPhone = decoded.phone_number; // e.g. "+919876543210"

    // Normalise the phone from the body for comparison
    const normalizedPhone = phone.trim();

    if (tokenPhone !== normalizedPhone) {
      return res.status(400).json({ message: 'Phone number does not match the verified token' });
    }

    return res.json({ verified: true, phone: normalizedPhone });
  } catch (error) {
    console.error('[verify-phone]', error.message);
    return res.status(400).json({ message: 'Phone verification failed', error: error.message });
  }
});

// ── GET /api/auth/check-trial/:phone — check if trial is available ───────────
router.get('/check-trial/:phone', async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone).trim();
    const existing = await TrialUsage.findOne({ phone });
    return res.json({ trialAvailable: !existing });
  } catch (error) {
    console.error('[check-trial]', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign(
    { _id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Register Owner
router.post('/register/owner', [
  body('name').notEmpty().trim().escape(),
  body('loginId').notEmpty().trim(),
  body('email').isEmail().normalizeEmail().trim(),
  body('password').isLength({ min: 6 }).trim(),
  body('gymName').notEmpty().trim().escape(),
  body('phone').notEmpty().trim(),
  body('idToken').notEmpty().withMessage('Phone verification token is required'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { name, loginId, email, phone, password, gymName, referralCode, idToken } = req.body;

    // ── Step 1: Verify Firebase phone token ───────────────────────────────
    let verifiedPhone;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      verifiedPhone = decoded.phone_number; // "+91XXXXXXXXXX"
      if (verifiedPhone !== phone.trim()) {
        return res.status(400).json({ message: 'Phone not verified: token phone does not match submitted phone' });
      }
    } catch (firebaseErr) {
      console.error('[register/owner firebase]', firebaseErr.message);
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

    // Generate token
    const token = generateToken(owner._id, owner.role);

    res.status(201).json({
      message: 'Owner registered successfully',
      trialGranted: !trialUsed,
      token,
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
    console.error('Register owner error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Register Member (by gym owner)
router.post('/register/member', [
  body('name').notEmpty().trim().escape(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().trim(),
  body('password').isLength({ min: 6 }).trim(),
  body('loginId').notEmpty().trim(),
  body('gymOwnerId').notEmpty().trim(),
  body('phone').notEmpty().trim(),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const {
      name,
      email,
      phone,
      password,
      loginId,
      gymOwnerId,
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

    // Verify gym owner exists
    const gymOwner = await User.findById(gymOwnerId);
    if (!gymOwner || gymOwner.role !== 'owner') {
      return res.status(400).json({ message: 'Invalid gym owner' });
    }

    // phone is globally unique in the schema — check across all users first
    const existingPhone = await User.findOne({ phone });
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
      phone,
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

    // Generate token
    const token = generateToken(member._id, member.role);

    res.status(201).json({
      message: 'Member registered successfully',
      token,
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
    console.error('Register member error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const messages = {
        phone: 'Phone number is already registered',
        loginId: 'Login ID is already taken',
        email: 'Email is already registered',
      };
      return res.status(400).json({ message: messages[field] || 'Duplicate entry — please check your details' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', [
  body('email').optional().isEmail().normalizeEmail().trim(),
  body('loginId').optional().trim(),
  body('password').isLength({ min: 6 }).trim(),
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
    const ts = () => new Date().toISOString();

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
      console.warn(`⚠️ Failed login attempt for non-existent user: ${identifier} (${role}) from IP: ${req.ip} at ${ts()}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.warn(`⚠️ Failed login attempt (bad password): ${identifier} (${role}) from IP: ${req.ip} at ${ts()}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    console.log(`✅ Successful login: ${identifier} (${user.role}) from IP: ${req.ip} at ${ts()}`);

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
      user: responseData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    // Extract token from header
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ── Update Profile ──────────────────────────────────────────────────────────
const authMiddleware = require('../middleware/auth');

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
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword; // pre-save hook will hash it
    await user.save();
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
router.get('/gym-contact/:ownerId', async (req, res) => {
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
