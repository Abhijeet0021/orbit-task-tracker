import mongoose from 'mongoose';

const taskActivitySchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  activity_type: {
    type: String,
    enum: [
      'CREATED',
      'STATUS_CHANGED',
      'COMMENT_ADDED',
      'ASSIGNED',
      'UNASSIGNED',
      'BLOCKER_ADDED',
      'BLOCKER_REMOVED',
      'FIELD_UPDATED'
    ],
    required: true,
  },
  field_name: {
    type: String,
    default: null,
  },
  old_value: {
    type: String,
    default: null,
  },
  new_value: {
    type: String,
    default: null,
  },
  comment_text: {
    type: String,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

taskActivitySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

export const TaskActivity = mongoose.model('TaskActivity', taskActivitySchema);
