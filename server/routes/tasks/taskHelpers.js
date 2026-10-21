import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../../db/index.js';
import { sendTaskOverdueEmail } from '../../utils/emailHelper.js';

// File upload configuration for task attachments with 10MB cap
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB maximum upload limit
});

// Helper function to safely delete physical attachment files from disk
export function deletePhysicalAttachments(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return;
  const placeholders = taskIds.map(() => '?').join(',');
  const attachments = db.prepare(`SELECT file_path FROM task_attachments WHERE task_id IN (${placeholders})`).all(...taskIds);

  const uploadDir = path.join(process.cwd(), 'uploads');
  for (const att of attachments) {
    if (att.file_path) {
      const filePath = path.isAbsolute(att.file_path) ? att.file_path : path.join(uploadDir, att.file_path);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`Failed to delete physical file ${filePath}:`, err);
      }
    }
  }
}

// Helper function to dynamically update overdue tasks in DB & audit log and send alerts
export function syncOverdueStatus() {
  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = db.prepare(`
    SELECT t.id, t.task_id, t.title, t.status, t.due_date, u.email as assignee_email, u.name as assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.due_date < ? AND t.status NOT IN ('Completed', 'Overdue')
  `).all(today);

  const updateStmt = db.prepare("UPDATE tasks SET status = 'Overdue', last_updated = CURRENT_TIMESTAMP WHERE id = ?");
  const logStmt = db.prepare(`
    INSERT INTO task_history (task_id, user_id, user_name, action, old_value, new_value)
    VALUES (?, 1, 'System', 'Status Marked Overdue', ?, 'Overdue')
  `);

  for (const task of overdueTasks) {
    updateStmt.run(task.id);
    logStmt.run(task.id, task.status);

    if (task.assignee_email) {
      try {
        sendTaskOverdueEmail({
          toEmail: task.assignee_email,
          assigneeName: task.assignee_name,
          taskTitle: task.title,
          taskId: task.task_id,
          dueDate: task.due_date
        });
      } catch (err) {
        console.error('Failed to send overdue email for task ' + task.task_id, err);
      }
    }
  }
}

// Audit logger helper
export function logTaskHistory(taskId, userId, userName, action, oldValue, newValue) {
  db.prepare(`
    INSERT INTO task_history (task_id, user_id, user_name, action, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(taskId, userId, userName, action, oldValue, newValue);
}

// Generate next TASK-XXXX ID
export function generateTaskId() {
  const result = db.prepare("SELECT task_id FROM tasks ORDER BY id DESC LIMIT 1").get();
  if (!result || !result.task_id) {
    return 'TASK-0001';
  }
  const match = result.task_id.match(/TASK-(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10) + 1;
    return `TASK-${String(num).padStart(4, '0')}`;
  }
  return `TASK-${Date.now()}`;
}
