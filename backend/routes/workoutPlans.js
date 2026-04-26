const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');
const authMiddleware = require('../middleware/auth');

// Create plan
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { gymOwnerId, name, category, durationWeeks, exercises, isTemplate } = req.body;
    const plan = new WorkoutPlan({
      gymOwnerId, name,
      category: category || 'custom',
      durationWeeks: durationWeeks || 4,
      exercises: exercises || [],
      isTemplate: isTemplate || false
    });
    await plan.save();
    res.status(201).json({ message: 'Plan created', plan });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all plans for gym
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const plans = await WorkoutPlan.find({ gymOwnerId: ownerObjectId })
      .populate('assignedTo', 'name loginId')
      .sort({ createdAt: -1 });
    res.json({ plans, count: plans.length });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single plan
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.id)
      .populate('assignedTo', 'name loginId');
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json({ plan });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update plan
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const plan = await WorkoutPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json({ message: 'Plan updated', plan });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Assign plan to member
router.post('/assign', authMiddleware, async (req, res) => {
  try {
    const { planId, memberId } = req.body;
    const plan = await WorkoutPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    if (!plan.assignedTo.includes(memberId)) {
      plan.assignedTo.push(memberId);
      await plan.save();
    }
    res.json({ message: 'Plan assigned', plan });
  } catch (error) {
    console.error('Assign plan error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete plan
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const plan = await WorkoutPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json({ message: 'Plan deleted' });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
