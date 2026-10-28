import jwt from 'jsonwebtoken';
import db from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-task-tracker-key-2026';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      avatar: user.avatar || null
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticateUser(req, res, next) {
  // Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authentication token missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: 'Invalid session token.' });
    }

    // Fetch fresh user record from database
    const user = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, u.avatar, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'Account not found or deactivated.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid. Please sign in again.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    // Admin always has access to all routes
    if (req.user.role === 'Admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`
    });
  };
}
