import express from 'express';
import db, { purgeExpiredRecycleBinTasks, logSystemAction } from '../../db/index.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { deletePhysicalAttachments, logTaskHistory } from './taskHelpers.js';

const router = express.Router();

// -------------------------------------------------------------
// GET /api/tasks/recycle-bin/list - Get Recycled Tasks (Manager Only)
// -------------------------------------------------------------
router.get('/recycle-bin/list', authenticateUser, requireRole('Manager'), (req, res) => {
  purgeExpiredRecycleBinTasks();

  const tasks = db.prepare(`
    SELECT
      t.*,
      assigner.name as assigned_by_name,
      assignee.name as assigned_to_name,
      p.name as project_name,
      d.name as department_name,
      ROUND(10 - (julianday('now') - julianday(t.deleted_at)), 1) as days_remaining
    FROM tasks t
    LEFT JOIN users assigner ON t.assigned_by = assigner.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN departments d ON t.department_id = d.id
    WHERE t.deleted_at IS NOT NULL
    ORDER BY t.deleted_at DESC
  `).all();

  res.json({ tasks });
});

// -------------------------------------------------------------
// DELETE /api/tasks/recycle-bin/empty - Empty Recycle Bin (Manager Only)
// -------------------------------------------------------------
router.delete('/recycle-bin/empty', authenticateUser, requireRole('Manager'), (req, res) => {
  const tasks = db.prepare('SELECT id FROM tasks WHERE deleted_at IS NOT NULL').all();
  const taskIds = tasks.map(t => t.id);

  // Permanently delete physical files from uploads directory
  deletePhysicalAttachments(taskIds);

  for (const t of tasks) {
    db.prepare('DELETE FROM task_history WHERE task_id = ?').run(t.id);
    db.prepare('DELETE FROM task_attachments WHERE task_id = ?').run(t.id);
    db.prepare('DELETE FROM task_comments WHERE task_id = ?').run(t.id);
    db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(t.id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(t.id);
  }

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'EMPTY_RECYCLE_BIN',
    entityType: 'Task',
    entityId: null,
    details: `Emptied recycle bin (${tasks.length} tasks permanently deleted)`
  });

  res.json({ message: `Recycle bin emptied successfully (${tasks.length} tasks and attached files permanently deleted).` });
});

// -------------------------------------------------------------
// POST /api/tasks/:id/restore - Restore Task from Recycle Bin
// -------------------------------------------------------------
router.post('/:id/restore', authenticateUser, (req, res) => {
  const taskId = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NOT NULL').get(taskId);

  if (!task) {
    return res.status(404).json({ message: 'Task not found in recycle bin.' });
  }

  // Permission Check: Admin or the user who assigned the task can restore it
  if (req.user.role !== 'Admin' && Number(task.assigned_by) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'Permission denied. You can only restore tasks that you assigned.' });
  }

  db.prepare('UPDATE tasks SET deleted_at = NULL WHERE id = ?').run(taskId);
  logTaskHistory(taskId, req.user.id, req.user.name, 'Restored Task', 'In Recycle Bin', 'Active');

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'RESTORE_TASK',
    entityType: 'Task',
    entityId: taskId,
    details: `Restored task ${task.task_id} ("${task.title}") from recycle bin`
  });

  res.json({ message: `Task ${task.task_id} restored successfully.` });
});

// -------------------------------------------------------------
// DELETE /api/tasks/:id/permanent - Permanently Delete Task
// -------------------------------------------------------------
router.delete('/:id/permanent', authenticateUser, (req, res) => {
  const taskId = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  // Permission Check: Admin or the user who assigned the task can permanently delete it
  if (req.user.role !== 'Admin' && Number(task.assigned_by) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'Permission denied. You can only permanently delete tasks that you assigned.' });
  }

  // Permanently delete attached physical files from disk
  deletePhysicalAttachments([taskId]);

  db.prepare('DELETE FROM task_history WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM task_attachments WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM task_comments WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'PERMANENT_DELETE_TASK',
    entityType: 'Task',
    entityId: taskId,
    details: `Permanently deleted task ${task.task_id} ("${task.title}")`
  });

  res.json({ message: `Task ${task.task_id} and all attached files permanently deleted.` });
});

// -------------------------------------------------------------
// GET /api/tasks/:id/history - Get Audit History Log
// -------------------------------------------------------------
router.get('/:id/history', authenticateUser, (req, res) => {
  const taskId = req.params.id;
  const history = db.prepare(`
    SELECT * FROM task_history
    WHERE task_id = ?
    ORDER BY created_at DESC
  `).all(taskId);

  res.json({ history });
});

export default router;
