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

let inMemoryServer = null;

/** True when this process fell back to a throwaway in-memory MongoDB. */
export function isUsingInMemoryFallback() {
  return inMemoryServer !== null;
}

/**
 * Development convenience: with no MONGODB_URI configured and nothing listening
 * on localhost:27017, start a throwaway in-memory MongoDB so `npm run dev`
 * works from a fresh clone. Never used in production, and never used when a
 * MONGODB_URI has been set - a broken URI must still fail loudly.
 */
async function startInMemoryFallback() {
  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = await import('mongodb-memory-server'));
    inMemoryServer = await MongoMemoryServer.create();
  } catch (err) {
    console.error('❌ Could not start the in-memory fallback database either:', err.message);
    console.error('   It downloads a MongoDB binary on first use, so it needs network access once.');
    console.error('   Set MONGODB_URI in .env to a reachable database instead, or start a local MongoDB.');
    throw err;
  }

  const conn = await mongoose.connect(inMemoryServer.getUri(), { maxPoolSize: 10 });
  console.warn('⚠️  No MONGODB_URI set and no local MongoDB reachable.');
  console.warn('   Started a temporary in-memory database. Data is discarded when the server stops.');
  console.warn('   Set MONGODB_URI in .env to use a real database.');
  return conn;
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
      console.error(`   MONGODB_URI is not set, so the default ${MONGODB_URI} was used and nothing is listening there.`);
      console.error('   Set MONGODB_URI in .env, or start a local MongoDB.');
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

    // Only when nothing was configured at all - an explicitly set URI that
    // fails is a real error and must surface.
    if (!process.env.MONGODB_URI && uri === MONGODB_URI) {
      return startInMemoryFallback();
    }

    throw err;
  }
}

export async function closeDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (inMemoryServer) {
    await inMemoryServer.stop();
    inMemoryServer = null;
  }
}
