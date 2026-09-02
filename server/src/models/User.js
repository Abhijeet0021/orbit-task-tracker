import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['MANAGER', 'MEMBER'],
    default: 'MEMBER',
    required: true,
  },
  avatar_color: {
    type: String,
    default: '#3b82f6',
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

export const User = mongoose.model('User', userSchema);
