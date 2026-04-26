const express = require('express');
const router = express.Router();
const BugReport = require('../models/BugReport');
const authMiddleware = require('../middleware/auth');

// Submit bug report
router.post('/bug-report', authMiddleware, async (req, res) => {
  try {
    const { userId, title, description, screenshot } = req.body;
    const report = new BugReport({
      userId,
      title,
      description: description || '',
      screenshot: screenshot || null
    });
    await report.save();
    res.status(201).json({ message: 'Bug report submitted', report });
  } catch (error) {
    console.error('Bug report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's bug reports
router.get('/bug-reports/:userId', authMiddleware, async (req, res) => {
  try {
    const reports = await BugReport.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json({ reports, count: reports.length });
  } catch (error) {
    console.error('Get bug reports error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
