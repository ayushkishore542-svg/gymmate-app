const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const Payment = require('../models/Payment');
const Attendance = require('../models/Attendance');
const authMiddleware = require('../middleware/auth');

function assertOwnerSelf(req, ownerId) {
  if (req.user.role !== 'owner') return { ok: false, status: 403, message: 'Owners only' };
  if (req.user._id.toString() !== ownerId) return { ok: false, status: 403, message: 'Access denied' };
  return { ok: true };
}

// Get all members for a gym owner
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const gate = assertOwnerSelf(req, ownerId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    
    const members = await User.find({ 
      gymOwnerId: ownerObjectId,
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

    if (req.user.role === 'member') {
      if (member._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'owner') {
      const gid = member.gymOwnerId && member.gymOwnerId._id
        ? member.gymOwnerId._id.toString()
        : String(member.gymOwnerId);
      if (!member.gymOwnerId || gid !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
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
    const existing = await User.findById(memberId);
    if (!existing || existing.role !== 'member') {
      return res.status(404).json({ message: 'Member not found' });
    }
    if (req.user.role !== 'owner' || existing.gymOwnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

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
    if (req.user.role !== 'owner' || member.gymOwnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
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

    const { validatePasswordStrength } = require('../utils/passwordPolicy');
    const pwdCheck = validatePasswordStrength(newPassword);
    if (!pwdCheck.ok) {
      return res.status(400).json({ message: pwdCheck.message });
    }

    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    const isOwner = req.user.role === 'owner' && member.gymOwnerId.toString() === req.user._id.toString();
    const isSelf = req.user.role === 'member' && member._id.toString() === req.user._id.toString();
    if (!isOwner && !isSelf) {
      return res.status(403).json({ message: 'Access denied' });
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

    const existing = await User.findById(memberId);
    if (!existing || existing.role !== 'member') {
      return res.status(404).json({ message: 'Member not found' });
    }
    if (req.user.role !== 'owner' || existing.gymOwnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

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
    
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const gate = assertOwnerSelf(req, ownerId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringMembers = await User.find({
      gymOwnerId: ownerObjectId,
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
    
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const gate = assertOwnerSelf(req, ownerId);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const inactiveMembers = await User.find({
      gymOwnerId: ownerObjectId,
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
