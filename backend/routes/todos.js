const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Todo = require('../models/Todo');
const authMiddleware = require('../middleware/auth');

// GET /api/todos — list owner's todos (incomplete first, then by createdAt desc)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const todos = await Todo.find({ ownerId: req.user._id })
      .sort({ isCompleted: 1, createdAt: -1 })
      .lean();
    res.json({ todos });
  } catch (err) {
    console.error('List todos error:', err);
    res.status(500).json({ message: 'Failed to load todos' });
  }
});

// POST /api/todos — create new todo
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, reminderAt } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (title.length > 200) {
      return res.status(400).json({ message: 'Title must be 200 characters or less' });
    }

    const todo = await Todo.create({
      ownerId: req.user._id,
      title: title.trim(),
      reminderAt: reminderAt || null,
    });

    res.status(201).json({ todo });
  } catch (err) {
    console.error('Create todo error:', err);
    res.status(500).json({ message: 'Failed to create todo' });
  }
});

// PATCH /api/todos/:id/toggle — toggle isCompleted
router.patch('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid todo ID' });
    }

    const todo = await Todo.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    todo.isCompleted = !todo.isCompleted;
    await todo.save();

    res.json({ todo });
  } catch (err) {
    console.error('Toggle todo error:', err);
    res.status(500).json({ message: 'Failed to toggle todo' });
  }
});

// DELETE /api/todos/:id — delete todo
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid todo ID' });
    }

    const todo = await Todo.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    res.json({ message: 'Todo deleted' });
  } catch (err) {
    console.error('Delete todo error:', err);
    res.status(500).json({ message: 'Failed to delete todo' });
  }
});

module.exports = router;
