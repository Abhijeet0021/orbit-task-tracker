import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-task-tracker-jwt-key-2026';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const stmt = db.prepare('SELECT id, email, name, role, avatar_color, created_at FROM users WHERE id = ?');
    const user = stmt.get(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireManager(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.user.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Forbidden: Only managers are authorized to perform this action.' });
  }
  next();
}

export function hasProjectAccess(projectId, user) {
  if (user.role === 'MANAGER') return true;
  const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, user.id);
  return !!member;
}

export function requireProjectAccess(req, res, next) {
  const projectId = parseInt(req.params.projectId || req.params.id || req.body.project_id, 10);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID provided.' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (!hasProjectAccess(projectId, req.user)) {
    return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
  }

  next();
}
