import express from 'express';
import db from '../db/index.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// GET all notifications for the authenticated user
router.get('/', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 40 } = req.query;

    const rawNotifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(userId, Number(limit) || 40);

    const notifications = rawNotifications.map((n) => {
      let created_at = n.created_at;
      if (created_at && typeof created_at === 'string') {
        let clean = created_at.trim();
        if (!clean.includes('T') && !clean.endsWith('Z')) {
          clean = clean.replace(' ', 'T') + 'Z';
        } else if (clean.includes('T') && !clean.endsWith('Z') && !clean.includes('+')) {
          clean = clean + 'Z';
        }
        created_at = clean;
      }
      return { ...n, created_at };
    });

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(userId)?.count || 0;

    res.json({
      notifications,
      unreadCount
    });
  } catch (err) {
    console.error('Failed to get notifications:', err);
    res.status(500).json({ message: 'Failed to retrieve notifications' });
  }
});

// PATCH mark single notification as read
router.patch('/:id/read', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE id = ? AND user_id = ?
    `).run(id, userId);

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(userId)?.count || 0;

    res.json({ message: 'Notification marked as read', unreadCount });
  } catch (err) {
    console.error('Failed to update notification:', err);
    res.status(500).json({ message: 'Failed to mark notification read' });
  }
});

// PATCH mark all notifications as read
router.patch('/read-all', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;

    db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE user_id = ?
    `).run(userId);

    res.json({ message: 'All notifications marked as read', unreadCount: 0 });
  } catch (err) {
    console.error('Failed to mark all notifications read:', err);
    res.status(500).json({ message: 'Failed to mark notifications read' });
  }
});

// DELETE clear all notifications for user
router.delete('/clear-all', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;

    db.prepare(`
      DELETE FROM notifications
      WHERE user_id = ?
    `).run(userId);

    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    console.error('Failed to clear notifications:', err);
    res.status(500).json({ message: 'Failed to clear notifications' });
  }
});

// DELETE single notification
router.delete('/:id', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'clear-all') {
      db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(req.user.id);
      return res.json({ message: 'All notifications cleared' });
    }

    const userId = req.user.id;

    db.prepare(`
      DELETE FROM notifications
      WHERE id = ? AND user_id = ?
    `).run(id, userId);

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Failed to delete notification:', err);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
});

export default router;
