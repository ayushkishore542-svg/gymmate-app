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
    sparse: true, // only members have a loginId; sparse allows owners to omit it
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
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
  
  // Owner's membership status (subscription to app)
  subscriptionStatus: {
    type: String,
    enum: ['trial', 'active', 'expired', 'cancelled'],
    default: 'trial'
  },
  subscriptionStartDate: {
    type: Date,
    default: Date.now
  },
  subscriptionEndDate: {
    type: Date,
    default: function() {
      // 3 days trial
      return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    }
  },
  subscriptionFee: {
    type: Number,
    default: 700 // Monthly fee for gym owners
  },
  
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
    const salt = await bcrypt.genSalt(10);
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
