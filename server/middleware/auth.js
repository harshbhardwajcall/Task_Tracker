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
      department_id: user.department_id
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticateUser(req, res, next) {
  // Check for X-User-Id header (for login-free profile switching)
  const customUserId = req.headers['x-user-id'];
  if (customUserId) {
    const user = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(customUserId);

    if (user) {
      req.user = user;
      return next();
    }
  }

  // Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      // fallback to default manager
    }
  }

  // Default auto-login user (Manager A) if no auth header passed
  const defaultUser = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = 1
  `).get();

  req.user = defaultUser || {
    id: 1,
    name: 'Manager A',
    email: 'manager@company.com',
    role: 'Manager',
    department_id: 1,
    department_name: 'Development'
  };

  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`
      });
    }
    next();
  };
}
