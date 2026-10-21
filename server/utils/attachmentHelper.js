import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootUploadDir = path.resolve(__dirname, '../../uploads');

// Helper to safely delete physical attachment files from uploads directory for specific tasks
export function deletePhysicalAttachments(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return;
  const placeholders = taskIds.map(() => '?').join(',');
  const attachments = db.prepare(`SELECT file_path FROM task_attachments WHERE task_id IN (${placeholders})`).all(...taskIds);

  for (const att of attachments) {
    if (att.file_path) {
      const candidates = [
        att.file_path,
        path.join(rootUploadDir, att.file_path),
        path.join(process.cwd(), 'uploads', att.file_path),
        path.join(process.cwd(), att.file_path)
      ];
      for (const targetPath of candidates) {
        try {
          if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
            fs.unlinkSync(targetPath);
            break;
          }
        } catch (err) {
          console.error(`Failed to delete physical file ${targetPath}:`, err);
        }
      }
    }
  }
}

// Helper to permanently purge tasks and all their related data (attachments, comments, history) from disk and database
export function purgeTasksPermanently(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return 0;
  
  // 1. Delete physical files from uploads directory
  deletePhysicalAttachments(taskIds);

  let deletedCount = 0;
  for (const taskId of taskIds) {
    try {
      db.prepare('DELETE FROM task_history WHERE task_id = ?').run(taskId);
      db.prepare('DELETE FROM task_attachments WHERE task_id = ?').run(taskId);
      db.prepare('DELETE FROM task_comments WHERE task_id = ?').run(taskId);
      db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(taskId);
      const res = db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
      if (res.changes > 0) deletedCount++;
    } catch (err) {
      console.error(`Failed to purge task ${taskId}:`, err);
    }
  }

  return deletedCount;
}

// Helper to delete user account while retaining their tasks for reassignment
export function purgeUserPermanently(userId) {
  // 1. Find all tasks assigned to this user
  const assignedTasks = db.prepare('SELECT id, title, task_id FROM tasks WHERE assigned_to = ?').all(userId);

  // 2. Retain all tasks so they can be reassigned to someone else!
  db.prepare(`
    UPDATE tasks
    SET assigned_to = NULL,
        last_updated = CURRENT_TIMESTAMP
    WHERE assigned_to = ?
  `).run(userId);

  // 3. For any tasks created by this user, reassign author to fallback Admin so governance is preserved
  const fallbackAdmin = db.prepare("SELECT id FROM users WHERE role = 'Admin' ORDER BY id ASC LIMIT 1").get();
  const fallbackAdminId = fallbackAdmin?.id || 1;
  db.prepare(`
    UPDATE tasks
    SET assigned_by = ?
    WHERE assigned_by = ?
  `).run(fallbackAdminId, userId);

  // 4. Record history on retained tasks for audit trail
  for (const t of assignedTasks) {
    db.prepare(`
      INSERT INTO task_history (task_id, user_id, user_name, action, old_value, new_value)
      VALUES (?, ?, 'System', 'Unassigned (Pending Reassignment)', 'User Deleted', 'Unassigned')
    `).run(t.id, fallbackAdminId);
  }

  // 5. Delete the user record permanently from database
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  return {
    deletedUser: result.changes > 0,
    retainedTasksCount: assignedTasks.length,
    purgedTasksCount: 0
  };
}
