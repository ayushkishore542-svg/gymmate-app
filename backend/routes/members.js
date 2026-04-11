const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Payment = require('../models/Payment');
const Attendance = require('../models/Attendance');
const authMiddleware = require('../middleware/auth');

// Get all members for a gym owner
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    
    const members = await User.find({ 
      gymOwnerId: ownerId,
      role: 'member'
    }).select('-password').sort({ createdAt: -1 });

    res.json({ members });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single member details
router.get('/:memberId', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const member = await User.findById(memberId)
      .select('-password')
      .populate('gymOwnerId', 'name gymName');

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Get payment history
    const payments = await Payment.find({ userId: memberId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get attendance stats
    const totalAttendance = await Attendance.countDocuments({ memberId });
    const thisMonthAttendance = await Attendance.countDocuments({
      memberId,
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });

    res.json({
      member,
      payments,
      stats: {
        totalAttendance,
        thisMonthAttendance
      }
    });

  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update member details
router.put('/:memberId', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.password;
    delete updates.role;
    delete updates.referralCode;
    delete updates.gymOwnerId;

    const member = await User.findByIdAndUpdate(
      memberId,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.json({ message: 'Member updated successfully', member });

  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update membership (renew/extend)
router.post('/:memberId/membership', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { membershipFee, durationMonths, paymentMethod } = req.body;

    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Calculate new membership dates
    const now = new Date();
    const currentEnd = new Date(member.membershipEndDate);
    
    // If membership expired, start from now, otherwise extend from current end
    const startDate = currentEnd > now ? currentEnd : now;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + (durationMonths || 1));

    // Update member
    member.membershipStatus = 'active';
    member.membershipEndDate = endDate;
    member.membershipFee = membershipFee || member.membershipFee;
    await member.save();

    // Create payment record
    const payment = new Payment({
      userId: memberId,
      paymentType: 'membership',
      amount: membershipFee,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: 'completed',
      periodStart: startDate,
      periodEnd: endDate,
      gymOwnerId: member.gymOwnerId
    });
    await payment.save();

    res.json({ 
      message: 'Membership updated successfully', 
      member,
      payment
    });

  } catch (error) {
    console.error('Update membership error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change member password
router.put('/:memberId/password', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Verify current password
    const isValid = await member.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    member.password = newPassword;
    await member.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete member
router.delete('/:memberId', authMiddleware, async (req, res) => {
  try {
    const { memberId } = req.params;

    // Soft delete - just deactivate
    const member = await User.findByIdAndUpdate(
      memberId,
      { isActive: false },
      { new: true }
    );

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.json({ message: 'Member deactivated successfully' });

  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get members with expiring memberships (within 7 days)
router.get('/gym/:ownerId/expiring', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringMembers = await User.find({
      gymOwnerId: ownerId,
      role: 'member',
      membershipStatus: 'active',
      membershipEndDate: {
        $lte: sevenDaysFromNow,
        $gte: new Date()
      }
    }).select('-password').sort({ membershipEndDate: 1 });

    res.json({ expiringMembers });

  } catch (error) {
    console.error('Get expiring members error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get inactive members (not attended in last 3 days)
router.get('/gym/:ownerId/inactive', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const inactiveMembers = await User.find({
      gymOwnerId: ownerId,
      role: 'member',
      membershipStatus: 'active',
      $or: [
        { lastAttendance: { $lte: threeDaysAgo } },
        { lastAttendance: null }
      ]
    }).select('-password').sort({ lastAttendance: 1 });

    res.json({ inactiveMembers });

  } catch (error) {
    console.error('Get inactive members error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
