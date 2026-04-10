const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const QRCode  = require('qrcode');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

// Reusable helper — returns 400 if any validation rule failed
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

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
  body('email').isEmail().normalizeEmail().trim(),
  body('password').isLength({ min: 6 }).trim(),
  body('gymName').notEmpty().trim().escape(),
  body('phone').notEmpty().trim(),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { name, email, phone, password, gymName, referralCode } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or phone' });
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
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode });
    }

    // Create owner
    const owner = new User({
      name,
      email,
      phone,
      password,
      role: 'owner',
      gymName,
      referralCode: newReferralCode,
      referredBy: referralCode || null,
      subscriptionStatus: 'trial',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days trial
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

    // Generate token
    const token = generateToken(owner._id, owner.role);

    res.status(201).json({
      message: 'Owner registered successfully',
      token,
      user: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
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
  body('email').isEmail().normalizeEmail().trim(),
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
      membershipDuration, // in months
      membershipStartDate: membershipStartDateInput
    } = req.body;

    // Validate loginId
    if (!loginId) {
      return res.status(400).json({ message: 'Login ID is required' });
    }
    if (!/^[a-zA-Z0-9]{4,}$/.test(loginId)) {
      return res.status(400).json({ message: 'Login ID must be alphanumeric and at least 4 characters' });
    }

    // Check loginId uniqueness
    const existingLoginId = await User.findOne({ loginId: loginId.toLowerCase() });
    if (existingLoginId) {
      return res.status(400).json({ message: 'Login ID is already taken' });
    }

    // Verify gym owner exists
    const gymOwner = await User.findById(gymOwnerId);
    if (!gymOwner || gymOwner.role !== 'owner') {
      return res.status(400).json({ message: 'Invalid gym owner' });
    }

    // Check if member already exists in this gym
    const existingMember = await User.findOne({
      $or: [{ email }, { phone }],
      gymOwnerId: gymOwnerId
    });
    if (existingMember) {
      return res.status(400).json({ message: 'Member already exists' });
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
    membershipEndDate.setMonth(membershipEndDate.getMonth() + (membershipDuration || 1));

    // Create member
    const member = new User({
      name,
      email,
      phone,
      password,
      loginId: loginId.toLowerCase(),
      role: 'member',
      gymOwnerId,
      referralCode: newReferralCode,
      membershipStatus: 'active',
      membershipStartDate,
      membershipEndDate,
      membershipFee: membershipFee || 0
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
        role: member.role,
        referralCode: member.referralCode,
        membershipStatus: member.membershipStatus,
        membershipEndDate: member.membershipEndDate,
        gymOwner: {
          id: gymOwner._id,
          name: gymOwner.name,
          gymName: gymOwner.gymName
        }
      }
    });

  } catch (error) {
    console.error('Register member error:', error);
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

    // Single identifier string used in audit logs (members use loginId, owners use email)
    const identifier = role === 'member' ? loginId : email;
    const ts = () => new Date().toISOString();

    // Find user — owners log in with email, members log in with loginId
    let user;
    if (role === 'member') {
      if (!loginId) {
        return res.status(400).json({ message: 'Login ID is required for members' });
      }
      user = await User.findOne({ loginId: loginId.toLowerCase(), role });
    } else {
      user = await User.findOne({ email, role });
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
      responseData.gymName = user.gymName;
      responseData.gymQRCode = user.gymQRCode;
      responseData.subscriptionStatus = user.subscriptionStatus;
      responseData.subscriptionEndDate = user.subscriptionEndDate;
    } else {
      const gymOwner = await User.findById(user.gymOwnerId);
      responseData.loginId = user.loginId;
      responseData.membershipStatus = user.membershipStatus;
      responseData.membershipEndDate = user.membershipEndDate;
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

module.exports = router;
