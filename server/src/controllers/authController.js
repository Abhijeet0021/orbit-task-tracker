import bcrypt from 'bcryptjs';
import { db } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';

export class AuthController {
  static login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const stmt = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
    const user = stmt.get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_color: user.avatar_color,
        created_at: user.created_at
      }
    });
  }

  static me(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    return res.json({ user: req.user });
  }

  static listUsers(req, res) {
    const stmt = db.prepare('SELECT id, email, name, role, avatar_color, created_at FROM users ORDER BY name ASC');
    const users = stmt.all();
    return res.json({ users });
  }
}
