const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    reminderAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

todoSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('Todo', todoSchema);
