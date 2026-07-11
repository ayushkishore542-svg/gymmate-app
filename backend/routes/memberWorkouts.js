const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const MemberWorkout = require('../models/MemberWorkout');

// POST /api/member-workouts — save/update workout for today
router.post('/', auth, async (req, res) => {
  try {
    const memberId = req.user._id;
    const { templateName, exercises, notes, completed, date } = req.body;

    const workoutDate = date ? new Date(date) : new Date();
    const dayStart = new Date(workoutDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(workoutDate); dayEnd.setHours(23, 59, 59, 999);

    let workout = await MemberWorkout.findOne({
      memberId,
      date: { $gte: dayStart, $lte: dayEnd },
    });

    if (workout) {
      if (templateName !== undefined) workout.templateName = templateName;
      if (exercises !== undefined)    workout.exercises    = exercises;
      if (notes !== undefined)        workout.notes        = notes;
      if (completed !== undefined)    workout.completed    = completed;
      await workout.save();
    } else {
      workout = await MemberWorkout.create({
        memberId,
        date: workoutDate,
        templateName: templateName || '',
        exercises:    exercises    || [],
        notes:        notes        || '',
        completed:    completed    || false,
      });
    }

    // Award XP when workout is marked completed
    if (completed === true) {
      const { awardXP } = require('../utils/xpEngine');
      awardXP(memberId.toString(), 'workout').catch(e =>
        console.error('[XP] workout award failed:', e.message)
      );
    }

    res.json({ workout });
  } catch (err) {
    console.error('[MemberWorkout] POST error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/member-workouts/:memberId — history (last 30 entries)
router.get('/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const workouts = await MemberWorkout.find({ memberId })
      .sort({ date: -1 })
      .limit(30);
    res.json({ workouts });
  } catch (err) {
    console.error('[MemberWorkout] GET error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/member-workouts/:memberId/latest — today's or most recent workout
router.get('/:memberId/latest', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    let workout = await MemberWorkout.findOne({
      memberId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (!workout) {
      workout = await MemberWorkout.findOne({ memberId }).sort({ date: -1 });
    }

    res.json({ workout: workout || null, isToday: !!workout });
  } catch (err) {
    console.error('[MemberWorkout] LATEST error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/member-workouts/:id/exercise/:exerciseId — toggle exercise done
router.patch('/:id/exercise/:exerciseId', auth, async (req, res) => {
  try {
    const { id, exerciseId } = req.params;
    const { done } = req.body;

    const workout = await MemberWorkout.findById(id);
    if (!workout) return res.status(404).json({ message: 'Workout not found' });

    const exercise = workout.exercises.id(exerciseId);
    if (!exercise) return res.status(404).json({ message: 'Exercise not found' });

    exercise.done = done;
    workout.completed = workout.exercises.every(e => e.done);
    await workout.save();

    res.json({ workout });
  } catch (err) {
    console.error('[MemberWorkout] PATCH exercise error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/member-workouts/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await MemberWorkout.findByIdAndDelete(req.params.id);
    res.json({ message: 'Workout deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
