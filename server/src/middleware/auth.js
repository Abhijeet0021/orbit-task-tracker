import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-task-tracker-jwt-key-2026';

export function generateToken(user) {
  const userId = user.id || user._id.toString();
  return jwt.sign(
    { id: userId, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('name email role avatar_color created_at');

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      avatar_color: user.avatar_color,
      created_at: user.created_at
    };
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

export async function hasProjectAccess(projectId, user) {
  if (user.role === 'MANAGER') return true;
  const exists = await Project.exists({ _id: projectId, members: user.id });
  return !!exists;
}

export async function requireProjectAccess(req, res, next) {
  const projectId = req.params.projectId || req.params.id || req.body.project_id;
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid project ID provided.' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const hasAccess = await hasProjectAccess(projectId, req.user);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
  }

  next();
}
