const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Staff = require('../models/Staff');
const authMiddleware = require('../middleware/auth');

// Add staff
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { gymOwnerId, name, phone, role, salary, joiningDate, photo, schedule } = req.body;
    const staff = new Staff({
      gymOwnerId, name, phone,
      role: role || 'trainer',
      salary: salary || 0,
      joiningDate: joiningDate || new Date(),
      photo: photo || null,
      schedule: schedule || ''
    });
    await staff.save();
    res.status(201).json({ message: 'Staff added successfully', staff });
  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all staff for a gym
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const staff = await Staff.find({ gymOwnerId: ownerObjectId }).sort({ createdAt: -1 });
    res.json({ staff, count: staff.length });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update staff
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    res.json({ message: 'Staff updated', staff });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete staff
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const staff = await Staff.findByIdAndDelete(req.params.id);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    res.json({ message: 'Staff deleted' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
