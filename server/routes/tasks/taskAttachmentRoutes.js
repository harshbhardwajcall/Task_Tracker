import express from 'express';
import path from 'path';
import fs from 'fs';
import db, { logSystemAction } from '../../db/index.js';
import { authenticateUser } from '../../middleware/auth.js';
import { upload, logTaskHistory } from './taskHelpers.js';

const router = express.Router();

// -------------------------------------------------------------
// POST /api/tasks/:id/attachments - Upload File Attachment
// -------------------------------------------------------------
router.post('/:id/attachments', authenticateUser, upload.single('attachment'), (req, res) => {
  const taskId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  // Permission Check: Assigner, Assigned To, Dependencies, Admin, or Manager can attach files
  const isAssigner = Number(task.assigned_by) === Number(req.user.id);
  const isAssignee = Number(task.assigned_to) === Number(req.user.id);
  const isAdmin = req.user.role === 'Admin';
  const isManager = req.user.role === 'Manager';
  const isDependency = db.prepare('SELECT 1 FROM task_dependencies WHERE task_id = ? AND user_id = ?').get(task.id, req.user.id);

  if (!isAssigner && !isAssignee && !isAdmin && !isManager && !isDependency) {
    return res.status(403).json({ message: 'Permission denied. Only the task assigner, assigned employee, dependencies, Admin, or Manager can attach files.' });
  }

  db.prepare(`
    INSERT INTO task_attachments (task_id, user_id, file_name, file_path, file_size)
    VALUES (?, ?, ?, ?, ?)
  `).run(taskId, req.user.id, req.file.originalname, req.file.filename, req.file.size);

  logTaskHistory(taskId, req.user.id, req.user.name, 'Uploaded Attachment', null, req.file.originalname);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'UPLOAD_ATTACHMENT',
    entityType: 'Task',
    entityId: taskId,
    details: `Uploaded attachment "${req.file.originalname}" to task ${task.task_id}`
  });

  const attachments = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM task_attachments a
    JOIN users u ON a.user_id = u.id
    WHERE a.task_id = ?
    ORDER BY a.uploaded_at DESC
  `).all(taskId);

  res.status(201).json({ message: 'Attachment uploaded', attachments });
});

// -------------------------------------------------------------
// GET /api/tasks/:id/attachments/:attachmentId/download - Download Attachment
// -------------------------------------------------------------
router.get('/:id/attachments/:attachmentId/download', authenticateUser, (req, res) => {
  const { id: taskId, attachmentId } = req.params;
  const attachment = db.prepare('SELECT * FROM task_attachments WHERE id = ? AND task_id = ?').get(attachmentId, taskId);

  if (!attachment) {
    return res.status(404).json({ message: 'Attachment not found.' });
  }

  const uploadDir = path.join(process.cwd(), 'uploads');
  const filePath = path.isAbsolute(attachment.file_path) ? attachment.file_path : path.join(uploadDir, attachment.file_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found on disk.' });
  }

  res.download(filePath, attachment.file_name);
});

// -------------------------------------------------------------
// DELETE /api/tasks/:id/attachments/:attachmentId - Delete Attachment
// (Only Admin or the user who attached the file can delete)
// -------------------------------------------------------------
function handleDeleteAttachment(req, res) {
  const taskId = req.params.id || req.params.taskId;
  const { attachmentId } = req.params;

  const attachment = db.prepare('SELECT * FROM task_attachments WHERE id = ? AND task_id = ?').get(attachmentId, taskId);
  if (!attachment) {
    return res.status(404).json({ message: 'Attachment not found.' });
  }

  // Permission Check: Attachment can ONLY be deleted by Admin or the user who attached/uploaded that file
  if (req.user.role !== 'Admin' && attachment.user_id !== req.user.id) {
    return res.status(403).json({ message: 'Only the user who attached this file or an Administrator can delete it.' });
  }

  // Delete physical file from disk
  if (attachment.file_path) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    const filePath = path.isAbsolute(attachment.file_path) ? attachment.file_path : path.join(uploadDir, attachment.file_path);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Failed to delete physical file ${filePath}:`, err);
    }
  }

  db.prepare('DELETE FROM task_attachments WHERE id = ?').run(attachmentId);

  logTaskHistory(taskId, req.user.id, req.user.name, 'Deleted Attachment', attachment.file_name, null);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'DELETE_ATTACHMENT',
    entityType: 'Task',
    entityId: taskId,
    details: `Deleted attachment "${attachment.file_name}" from task ${taskId}`
  });

  const attachments = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM task_attachments a
    JOIN users u ON a.user_id = u.id
    WHERE a.task_id = ?
    ORDER BY a.uploaded_at DESC
  `).all(taskId);

  res.json({ message: 'Attachment deleted successfully', attachments });
}

router.delete('/:id/attachments/:attachmentId', authenticateUser, handleDeleteAttachment);
router.delete('/:taskId/attachments/:attachmentId', authenticateUser, handleDeleteAttachment);

export default router;
