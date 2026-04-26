const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Batch = require('../models/Batch');
const authMiddleware = require('../middleware/auth');

// Create batch
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { gymOwnerId, name, startTime, endTime, maxCapacity, trainerId } = req.body;
    const batch = new Batch({
      gymOwnerId, name, startTime, endTime,
      maxCapacity: maxCapacity || 20,
      trainerId: trainerId || null
    });
    await batch.save();
    res.status(201).json({ message: 'Batch created', batch });
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all batches for gym
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const batches = await Batch.find({ gymOwnerId: ownerObjectId })
      .populate('trainerId', 'name')
      .populate('members', 'name loginId')
      .sort({ startTime: 1 });
    res.json({ batches, count: batches.length });
  } catch (error) {
    console.error('Get batches error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add member to batch
router.post('/:id/add-member', authMiddleware, async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const { memberId } = req.body;
    if (batch.members.length >= batch.maxCapacity) {
      return res.status(400).json({ message: 'Batch is full' });
    }
    if (!batch.members.includes(memberId)) {
      batch.members.push(memberId);
      await batch.save();
    }
    res.json({ message: 'Member added to batch', batch });
  } catch (error) {
    console.error('Add member to batch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove member from batch
router.post('/:id/remove-member', authMiddleware, async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const { memberId } = req.body;
    batch.members = batch.members.filter(m => m.toString() !== memberId);
    await batch.save();
    res.json({ message: 'Member removed', batch });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update batch
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const batch = await Batch.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    res.json({ message: 'Batch updated', batch });
  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete batch
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const batch = await Batch.findByIdAndDelete(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    res.json({ message: 'Batch deleted' });
  } catch (error) {
    console.error('Delete batch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
