const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: function() { return this.role === 'owner'; }, // optional for members
    lowercase: true,
    trim: true
  },
  loginId: {
    type: String,
    unique: true,
    sparse: true,   // sparse keeps backward-compat for docs created before this field existed
    trim: true,
    lowercase: true,
    minlength: 4,
    maxlength: 20,
    index: true,
    validate: {
      validator: function(v) {
        // Allow null/undefined (sparse) but validate format when present
        if (!v) return true;
        return /^[a-z][a-z0-9._]{3,19}$/.test(v);
      },
      message: 'Login ID must be 4-20 characters, start with a letter, and only contain lowercase letters, numbers, dots, or underscores.'
    }
  },
  phone: {
    type: String,
    required: true,
    // Not unique — same phone can register multiple owner accounts (e.g. multiple gyms).
    // Trial-per-phone is enforced separately via the TrialUsage model.
    // Member phone uniqueness is still enforced at the application level in register/member.
  },
  password: {
    type: String,
    required: true
  },
  
  // User Type
  role: {
    type: String,
    enum: ['owner', 'member'],
    required: true
  },
  
  // Referral System
  referralCode: {
    type: String,
    unique: true,
    required: true
  },
  referredBy: {
    type: String, // referralCode of referrer
    default: null
  },
  
  // For Gym Owners
  gymName: {
    type: String,
    required: function() { return this.role === 'owner'; }
  },
  gymQRCode: {
    type: String, // Base64 encoded QR code
    default: null
  },
  
  // Owner's subscription to the GymMate app
  subscriptionStatus: {
    type: String,
    enum: ['trial', 'active', 'expired', 'cancelled', 'halted', 'failed'],
    default: 'trial'
  },
  subscriptionStartDate: {
    type: Date,
    default: Date.now
  },
  subscriptionEndDate: {
    type: Date,
    default: function() {
      // 15-day free trial
      return new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    }
  },
  subscriptionFee: {
    type: Number,
    default: 699 // Monthly fee in INR
  },

  // Razorpay Subscription fields
  razorpaySubscriptionId: { type: String, default: null },
  razorpayCustomerId:     { type: String, default: null },
  razorpayShortUrl:       { type: String, default: null }, // hosted payment link
  paymentMethodAdded:     { type: Boolean, default: false },
  currentPeriodStart:     { type: Date, default: null },
  currentPeriodEnd:       { type: Date, default: null },
  lastPaymentAt:          { type: Date, default: null },
  lastPaymentStatus:      { type: String, default: null },
  
  // For Members
  gymOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return this.role === 'member'; }
  },
  membershipStatus: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  membershipStartDate: {
    type: Date
  },
  membershipEndDate: {
    type: Date
  },
  membershipFee: {
    type: Number,
    default: 0
  },
  
  // Attendance tracking
  lastAttendance: {
    type: Date,
    default: null
  },
  
  // Profile
  profilePhoto: {
    type: String,
    default: null
  },
  address: {
    type: String,
    default: ''
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  /** Brute-force protection (login) */
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
    default: null,
  },
  
  // Earnings from referrals
  referralEarnings: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate unique referral code
userSchema.statics.generateReferralCode = function() {
  return 'GM' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

module.exports = mongoose.model('User', userSchema);
