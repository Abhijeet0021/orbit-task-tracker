import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  task_number: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'],
    default: 'BACKLOG',
    required: true,
  },
  previous_status: {
    type: String,
    enum: ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', null],
    default: null,
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM',
    required: true,
  },
  due_date: {
    type: String, // Format YYYY-MM-DD
    default: null,
  },
  assignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  blockers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  }],
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Primary unique project task code index
taskSchema.index({ project: 1, task_number: 1 }, { unique: true });

// Targeted query indexes for dashboard, filters, and SLA overdue calculation
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignees: 1, status: 1 });
taskSchema.index({ status: 1, due_date: 1 });
taskSchema.index({ status: 1, updated_at: -1 });

taskSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

export const Task = mongoose.model('Task', taskSchema);
