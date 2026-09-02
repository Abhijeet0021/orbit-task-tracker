import mongoose from 'mongoose';

const alertDismissalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  dismissed_due_date: {
    type: String,
    required: true,
  },
  dismissed_at: {
    type: Date,
    default: Date.now,
  },
});

alertDismissalSchema.index({ user: 1, task: 1 }, { unique: true });

alertDismissalSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

export const AlertDismissal = mongoose.model('AlertDismissal', alertDismissalSchema);
