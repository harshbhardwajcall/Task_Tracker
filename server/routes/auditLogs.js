import express from 'express';
import db from '../db/index.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// GET all system audit logs (Admin only)
router.get('/', authenticateUser, (req, res) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ message: 'Access denied. Change history is restricted to administrators.' });
  }
  try {
    const { action, role, userId, limit = 500 } = req.query;

    let sql = `
      SELECT id, user_id, user_name, role, action, entity_type, entity_id, details, created_at
      FROM system_logs
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(limit) || 500);

    const logs = db.prepare(sql).all(...params);

    res.json({ logs });
  } catch (err) {
    console.error('Failed to get system logs:', err);
    res.status(500).json({ message: 'Failed to retrieve system logs' });
  }
});

export default router;
