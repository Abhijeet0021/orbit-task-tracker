import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/task_tracker';

/**
 * A `mongodb+srv://` URI resolves its hosts and ports from DNS SRV records, so
 * the driver rejects one that carries an explicit port with
 * "MongoParseError: mongodb+srv URI cannot have port number". Atlas hands out
 * the correct form, but a URI that has been hand-edited - or copied from the
 * standard `mongodb://` connection string - often keeps the :27017. Strip it
 * rather than crash-looping the service on boot.
 */
export function normalizeMongoUri(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('mongodb+srv://')) {
    return uri;
  }

  try {
    const parsed = new URL(uri);
    if (!parsed.port) return uri;
    parsed.port = '';
    return parsed.toString();
  } catch {
    // URL() rejects some valid connection strings (unescaped characters in the
    // password, most often). Fall back to a textual strip.
    return uri.replace(/(:\d+)(\/|\?|$)/, '$2');
  }
}

export async function initDatabase(uri = MONGODB_URI) {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    mongoose.set('strictQuery', false);
    const conn = await mongoose.connect(normalizeMongoUri(uri), {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`🌿 Connected to MongoDB at host: ${conn.connection.host || 'local/memory'}`);
    return conn;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);

    // This is the only log a crash-looping deploy leaves behind, so make it
    // say what to check rather than just what failed.
    if (!process.env.MONGODB_URI) {
      console.error('   MONGODB_URI is not set — the default localhost URI cannot work on a hosted instance.');
    } else if (/ENOTFOUND|ESERVFAIL|querySrv/i.test(err.message)) {
      console.error('   The cluster hostname did not resolve. Check the host in MONGODB_URI, and that the Atlas cluster is not paused.');
    } else if (/authentication failed|bad auth/i.test(err.message)) {
      console.error('   Credentials rejected. Check the user and password in MONGODB_URI (the password must be percent-encoded).');
    } else if (/timed out|ETIMEDOUT|ServerSelection/i.test(err.message)) {
      console.error('   Could not reach the cluster. Check the Atlas Network Access allow-list — a hosted service needs 0.0.0.0/0 or the provider’s egress range.');
    }

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw err;
  }
}

export async function closeDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
