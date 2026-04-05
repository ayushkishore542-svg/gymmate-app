const express = require('express');
const router = express.Router();
const Visitor = require('../models/Visitor');
const authMiddleware = require('../middleware/auth');

// Add a visitor
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { gymOwnerId, name, phone, email, interestedInMembership, notes } = req.body;

    const visitor = new Visitor({
      gymOwnerId,
      name,
      phone,
      email,
      interestedInMembership,
      notes
    });

    await visitor.save();

    res.status(201).json({ 
      message: 'Visitor added successfully', 
      visitor 
    });

  } catch (error) {
    console.error('Add visitor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all visitors for a gym
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { converted } = req.query;

    let query = { gymOwnerId: ownerId };
    
    if (converted !== undefined) {
      query.convertedToMember = converted === 'true';
    }

    const visitors = await Visitor.find(query)
      .sort({ visitDate: -1 })
      .populate('memberId', 'name email phone');

    res.json({ visitors, count: visitors.length });

  } catch (error) {
    console.error('Get visitors error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update visitor (e.g., mark as converted to member)
router.put('/:visitorId', authMiddleware, async (req, res) => {
  try {
    const { visitorId } = req.params;
    const updates = req.body;

    const visitor = await Visitor.findByIdAndUpdate(
      visitorId,
      updates,
      { new: true, runValidators: true }
    );

    if (!visitor) {
      return res.status(404).json({ message: 'Visitor not found' });
    }

    res.json({ message: 'Visitor updated successfully', visitor });

  } catch (error) {
    console.error('Update visitor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete visitor
router.delete('/:visitorId', authMiddleware, async (req, res) => {
  try {
    const { visitorId } = req.params;

    const visitor = await Visitor.findByIdAndDelete(visitorId);

    if (!visitor) {
      return res.status(404).json({ message: 'Visitor not found' });
    }

    res.json({ message: 'Visitor deleted successfully' });

  } catch (error) {
    console.error('Delete visitor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
