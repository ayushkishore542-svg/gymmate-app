const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const authMiddleware = require('../middleware/auth');

// Create a notice
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { gymOwnerId, title, content, priority, expiryDate } = req.body;

    const notice = new Notice({
      gymOwnerId,
      title,
      content,
      priority,
      expiryDate
    });

    await notice.save();

    res.status(201).json({ 
      message: 'Notice created successfully', 
      notice 
    });

  } catch (error) {
    console.error('Create notice error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all notices for a gym
router.get('/gym/:ownerId', authMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { active } = req.query;

    let query = { gymOwnerId: ownerId };
    
    if (active !== undefined) {
      query.isActive = active === 'true';
      
      // Also filter out expired notices if looking for active ones
      if (active === 'true') {
        query.$or = [
          { expiryDate: null },
          { expiryDate: { $gte: new Date() } }
        ];
      }
    }

    const notices = await Notice.find(query)
      .sort({ priority: -1, createdAt: -1 });

    res.json({ notices, count: notices.length });

  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update notice
router.put('/:noticeId', authMiddleware, async (req, res) => {
  try {
    const { noticeId } = req.params;
    const updates = req.body;

    const notice = await Notice.findByIdAndUpdate(
      noticeId,
      updates,
      { new: true, runValidators: true }
    );

    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    res.json({ message: 'Notice updated successfully', notice });

  } catch (error) {
    console.error('Update notice error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete notice
router.delete('/:noticeId', authMiddleware, async (req, res) => {
  try {
    const { noticeId } = req.params;

    const notice = await Notice.findByIdAndDelete(noticeId);

    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    res.json({ message: 'Notice deleted successfully' });

  } catch (error) {
    console.error('Delete notice error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
