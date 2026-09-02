import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { initDatabase } from './config/database.js';
import { router } from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Environment-based allowed origins with production & development defaults
const defaultAllowedOrigins = [
  'https://orbit-task-tracker.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

const customOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...customOrigins]));

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (server-to-server, curl, mobile, health monitors)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }

    // Support Netlify deploy preview domains
    if (/^https:\/\/[a-z0-9-]+--orbit-task-tracker\.netlify\.app$/.test(origin)) {
      return callback(null, origin);
    }

    return callback(new Error(`Origin '${origin}' not allowed by CORS policy.`));
  },
  credentials: true
}));

app.use(express.json());

// Lightweight Health Check Endpoint (No DB query overhead)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'orbit-api',
    uptime: Math.floor(process.uptime()),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use('/api', router);

const clientDistPath = path.resolve(__dirname, '../../dist/client');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Express Error Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: isProduction ? 'An unexpected server error occurred.' : (err.message || 'An unexpected error occurred.')
  });
});

async function startServer() {
  try {
    // Wait for MongoDB before accepting requests
    await initDatabase();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Task Tracker API Server running on port ${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n⚠️  Port ${PORT} is already in use by another process!`);
        console.error(`   To free port ${PORT}, run: lsof -ti :${PORT} | xargs kill -9\n`);
        process.exit(1);
      }
      throw err;
    });

    return server;
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw err;
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, startServer };
export default app;
