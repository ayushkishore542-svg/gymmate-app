const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Equipment = require('../models/Equipment');
const authMiddleware = require('../middleware/auth');

// Add equipment
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { gymOwnerId, name, quantity, purchaseDate, warrantyExpiry, cost, condition, photo } = req.body;
    const equipment = new Equipment({
      gymOwnerId, name,
      quantity: quantity || 1,
      purchaseDate: purchaseDate || null,
      warrantyExpiry: warrantyExpiry || null,
      cost: cost || 0,
      condition: condition || 'new',
      photo: photo || null
    });
    await equipment.save();
    res.status(201).json({ message: 'Equipment added', equipment });
  } catch (error) {
    console.error('Add equipment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all equipment for gym
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner ID' });
    }
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const equipment = await Equipment.find({ gymOwnerId: ownerObjectId }).sort({ createdAt: -1 });

    const totalValue = equipment.reduce((s, e) => s + (e.cost * e.quantity), 0);

    // Warranty alerts — expiring within 30 days
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const warrantyAlerts = equipment.filter(e =>
      e.warrantyExpiry && new Date(e.warrantyExpiry) <= thirtyDays && new Date(e.warrantyExpiry) >= new Date()
    );

    res.json({ equipment, totalValue, warrantyAlerts: warrantyAlerts.length, count: equipment.length });
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update equipment
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const equipment = await Equipment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!equipment) return res.status(404).json({ message: 'Equipment not found' });
    res.json({ message: 'Equipment updated', equipment });
  } catch (error) {
    console.error('Update equipment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete equipment
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const equipment = await Equipment.findByIdAndDelete(req.params.id);
    if (!equipment) return res.status(404).json({ message: 'Equipment not found' });
    res.json({ message: 'Equipment deleted' });
  } catch (error) {
    console.error('Delete equipment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
