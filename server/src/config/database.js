import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/task_tracker';

export async function initDatabase(uri = MONGODB_URI) {
  try {
    if (mongoose.connection.readyState !== 0) {
      return mongoose.connection;
    }

    mongoose.set('strictQuery', false);
    const conn = await mongoose.connect(uri);
    console.log(`🌿 Connected to MongoDB at: ${conn.connection.host || 'local/memory'}`);
    return conn;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

export async function closeDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
