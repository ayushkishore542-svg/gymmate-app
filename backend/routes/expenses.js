const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const { EXPENSE_CATEGORIES } = require('../models/Expense');
const authMiddleware = require('../middleware/auth');

// ── GET /api/expenses — list owner's expenses (newest first, optional month filter)
// Query params: ?month=2026-04 (optional — defaults to current month)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user._id);
    const { month } = req.query; // format: YYYY-MM

    let dateFilter = {};
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      dateFilter = {
        date: {
          $gte: new Date(y, m - 1, 1),
          $lt: new Date(y, m, 1),
        },
      };
    }

    const expenses = await Expense.find({ ownerId, ...dateFilter })
      .sort({ date: -1 })
      .lean();

    res.json({ expenses });
  } catch (err) {
    console.error('List expenses error:', err);
    res.status(500).json({ message: 'Failed to load expenses' });
  }
});

// ── GET /api/expenses/monthly-summary — category breakdown for a month
// Query params: ?month=2026-04 (optional — defaults to current month)
router.get('/monthly-summary', authMiddleware, async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user._id);
    const now = new Date();
    let startDate, endDate;

    const { month } = req.query;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m, 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const categoryAgg = await Expense.aggregate([
      {
        $match: {
          ownerId,
          date: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const totalBurn = categoryAgg.reduce((s, c) => s + c.total, 0);

    // Build ordered result with all categories (0 for missing)
    const categories = EXPENSE_CATEGORIES.map(name => {
      const match = categoryAgg.find(c => c._id === name);
      const total = match ? match.total : 0;
      return {
        name,
        amount: total,
        percentage: totalBurn > 0 ? total / totalBurn : 0,
        count: match ? match.count : 0,
      };
    });

    res.json({ totalBurn, categories });
  } catch (err) {
    console.error('Monthly summary error:', err);
    res.status(500).json({ message: 'Failed to load expense summary' });
  }
});

// ── POST /api/expenses — create new expense
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, amount, category, date, notes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (amount == null || amount < 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }
    if (!EXPENSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}` });
    }

    const expense = await Expense.create({
      ownerId: req.user._id,
      title: title.trim(),
      amount,
      category,
      date: date || new Date(),
      notes: notes || '',
    });

    res.status(201).json({ expense });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ message: 'Failed to create expense' });
  }
});

// ── DELETE /api/expenses/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid expense ID' });
    }

    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ message: 'Failed to delete expense' });
  }
});

module.exports = router;
