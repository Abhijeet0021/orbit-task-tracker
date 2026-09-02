import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

export class AuthController {
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = await User.findOne({ email: normalizedEmail });

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      // Asynchronous, non-blocking bcrypt password comparison without bypasses
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = generateToken(user);
      return res.json({
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          avatar_color: user.avatar_color,
          created_at: user.created_at
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static me(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    return res.json({ user: req.user });
  }

  static async listUsers(req, res, next) {
    try {
      const users = await User.find()
        .sort({ name: 1 })
        .select('name email role avatar_color created_at')
        .lean();

      return res.json({
        users: users.map(u => ({
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          role: u.role,
          avatar_color: u.avatar_color,
          created_at: u.created_at
        }))
      });
    } catch (err) {
      next(err);
    }
  }
}
