import express from 'express';
import fs from 'fs';
import path from 'path';
import db, { logSystemAction, createNotification } from '../../db/index.js';
import { authenticateUser } from '../../middleware/auth.js';
import { upload, logTaskHistory } from './taskHelpers.js';

const router = express.Router();

// -------------------------------------------------------------
// POST /api/tasks/:id/comments - Add Comment / WhatsApp Message (Text and/or Image)
// -------------------------------------------------------------
router.post('/:id/comments', authenticateUser, upload.single('image'), (req, res) => {
  const taskId = req.params.id;
  const commentText = req.body.comment ? req.body.comment.trim() : '';
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.imageUrl ? req.body.imageUrl.trim() : null);

  if (!commentText && !imageUrl) {
    return res.status(400).json({ message: 'Message text or image is required.' });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  const isDependency = db.prepare('SELECT 1 FROM task_dependencies WHERE task_id = ? AND user_id = ?').get(task.id, req.user.id);

  if ((req.user.role === 'Employee' || req.user.role === 'Intern') && task.assigned_to !== req.user.id && task.assigned_by !== req.user.id && !isDependency) {
    return res.status(403).json({ message: 'Access denied to this task.' });
  }

  db.prepare(`
    INSERT INTO task_comments (task_id, user_id, comment, image_url)
    VALUES (?, ?, ?, ?)
  `).run(taskId, req.user.id, commentText, imageUrl);

  // Update employee_comments field summary if posted by assigned employee
  if (req.user.role === 'Employee') {
    const summary = commentText || (imageUrl ? 'Sent an image' : '');
    db.prepare("UPDATE tasks SET employee_comments = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?").run(summary, taskId);
  }

  const historyDetail = commentText && imageUrl ? `${commentText} [Image attached]` : (commentText || '[Image attached]');
  logTaskHistory(taskId, req.user.id, req.user.name, 'Sent Message', null, historyDetail);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'ADD_COMMENT',
    entityType: 'Task',
    entityId: taskId,
    details: `Added message on task ${task.task_id}: "${historyDetail.length > 50 ? historyDetail.substring(0, 47) + '...' : historyDetail}"`
  });

  // In-App Notification on Comment to other party
  const targetRecipientId = Number(task.assigned_to) === Number(req.user.id) ? task.assigned_by : task.assigned_to;
  if (targetRecipientId && Number(targetRecipientId) !== Number(req.user.id)) {
    createNotification({
      userId: targetRecipientId,
      senderId: req.user.id,
      senderName: req.user.name,
      title: 'New Message on Task',
      message: `${req.user.name}: ${historyDetail.length > 40 ? historyDetail.substring(0, 37) + '...' : historyDetail}`,
      type: 'TASK_COMMENT',
      entityType: 'Task',
      entityId: taskId
    });
  }

  const comments = db.prepare(`
    SELECT c.*, COALESCE(u.name, 'Former Employee') as user_name, COALESCE(u.role, 'Employee') as user_role, u.avatar as user_avatar
    FROM task_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(taskId);

  res.status(201).json({ message: 'Message sent', comments });
});

// -------------------------------------------------------------
// DELETE /api/tasks/:id/comments/:commentId - Delete Comment/Message
// -------------------------------------------------------------
router.delete('/:id/comments/:commentId', authenticateUser, (req, res) => {
  const { id: taskId, commentId } = req.params;

  const comment = db.prepare('SELECT * FROM task_comments WHERE id = ? AND task_id = ?').get(commentId, taskId);
  if (!comment) {
    return res.status(404).json({ message: 'Message not found.' });
  }

  // Only the author or an Admin can delete the message
  if (req.user.role !== 'Admin' && Number(comment.user_id) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'Permission denied. You can only delete your own messages.' });
  }

  // Delete physical image file from disk if present
  if (comment.image_url && comment.image_url.startsWith('/uploads/')) {
    const filename = comment.image_url.replace('/uploads/', '');
    const diskPath = path.join(process.cwd(), 'uploads', filename);
    try {
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    } catch (err) {
      console.error(`Failed to delete comment image file ${diskPath}:`, err);
    }
  }

  db.prepare('DELETE FROM task_comments WHERE id = ?').run(commentId);

  const comments = db.prepare(`
    SELECT c.*, COALESCE(u.name, 'Former Employee') as user_name, COALESCE(u.role, 'Employee') as user_role, u.avatar as user_avatar
    FROM task_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(taskId);

  res.json({ message: 'Message deleted', comments });
});

export default router;
