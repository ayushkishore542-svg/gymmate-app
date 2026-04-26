const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Feedback = require('../models/Feedback');
const authMiddleware = require('../middleware/auth');

// Submit feedback (member)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { gymOwnerId, memberId, overallRating, trainerRating, cleanlinessRating, equipmentRating, comment } = req.body;
    const feedback = new Feedback({
      gymOwnerId, memberId, overallRating,
      trainerRating: trainerRating || null,
      cleanlinessRating: cleanlinessRating || null,
      equipmentRating: equipmentRating || null,
      comment: comment || ''
    });
    await feedback.save();
    res.status(201).json({ message: 'Feedback submitted', feedback });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all feedback for gym
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const feedbacks = await Feedback.find({ gymOwnerId: ownerObjectId })
      .populate('memberId', 'name loginId')
      .sort({ createdAt: -1 });
    res.json({ feedbacks, count: feedbacks.length });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Feedback summary (averages)
router.get('/summary/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const feedbacks = await Feedback.find({ gymOwnerId: ownerObjectId });

    if (feedbacks.length === 0) {
      return res.json({
        avgOverall: 0, avgTrainer: 0, avgCleanliness: 0, avgEquipment: 0, totalFeedbacks: 0
      });
    }

    const avg = (arr) => arr.length > 0 ? +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : 0;

    const overalls = feedbacks.map(f => f.overallRating);
    const trainers = feedbacks.filter(f => f.trainerRating).map(f => f.trainerRating);
    const cleanliness = feedbacks.filter(f => f.cleanlinessRating).map(f => f.cleanlinessRating);
    const equipment = feedbacks.filter(f => f.equipmentRating).map(f => f.equipmentRating);

    res.json({
      avgOverall: avg(overalls),
      avgTrainer: avg(trainers),
      avgCleanliness: avg(cleanliness),
      avgEquipment: avg(equipment),
      totalFeedbacks: feedbacks.length
    });
  } catch (error) {
    console.error('Feedback summary error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
