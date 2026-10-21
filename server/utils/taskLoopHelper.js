import db, { logSystemAction, createNotification } from '../db/index.js';
import { sendTaskLoopResetEmail, sendTaskLoopWarningEmail } from './emailHelper.js';

/**
 * Checks all repeating tasks (normal tasks and self-logs) and executes:
 * 1. Warning alerts before time duration completes.
 * 2. In-place reset once duration completes (no matter if task is completed or not).
 */
export function checkAndProcessTaskLoops() {
  const now = new Date();
  const nowIso = now.toISOString();

  // -----------------------------------------------------------------
  // 1. Process Normal Tasks (Company Tasks)
  // -----------------------------------------------------------------
  try {
    const normalTasks = db.prepare(`
      SELECT t.*, u.name as assignee_name, u.email as assignee_email
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.is_loop = 1
        AND t.deleted_at IS NULL
        AND t.next_run_at IS NOT NULL
    `).all();

    for (const task of normalTasks) {
      const intervalHours = Number(task.loop_interval_hours) || 24;
      const nextRun = new Date(task.next_run_at);
      const diffMs = nextRun.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Warning threshold: e.g. 2 hours before if interval >= 12h, or 10-20% before if smaller
      const warningThresholdHours = intervalHours >= 12 ? 2 : Math.max(0.15, intervalHours * 0.15);

      // Warning Notification Before Time Complete
      if (diffHours > 0 && diffHours <= warningThresholdHours && (!task.loop_warning_sent || task.loop_warning_sent === 0)) {
        const formattedRemaining = diffHours >= 1
          ? `${Math.round(diffHours)} hour(s)`
          : `${Math.max(1, Math.round(diffHours * 60))} minute(s)`;

        if (task.assigned_to) {
          createNotification({
            userId: task.assigned_to,
            senderId: null,
            senderName: 'System Loop',
            title: '⚠️ Repeat Task Cycle Ending Soon',
            message: `Task "${task.title}" cycle will reset in ~${formattedRemaining} (no matter status).`,
            type: 'TASK_LOOP_WARNING',
            entityType: 'Task',
            entityId: task.id
          });

          if (task.assignee_email) {
            sendTaskLoopWarningEmail({
              toEmail: task.assignee_email,
              assigneeName: task.assignee_name,
              taskTitle: task.title,
              hoursLeft: formattedRemaining,
              intervalHours
            });
          }
        }

        db.prepare('UPDATE tasks SET loop_warning_sent = 1 WHERE id = ?').run(task.id);
      }

      // Reset after time duration completes (no matter if completed or not!)
      if (diffMs <= 0) {
        const newLoopCount = (task.loop_count || 0) + 1;
        const newNextRun = new Date(Date.now() + intervalHours * 3600 * 1000).toISOString();
        const todayDate = new Date().toISOString().split('T')[0];

        // Shift due_date forward if present
        let updatedDueDate = task.due_date;
        if (task.due_date) {
          updatedDueDate = new Date(Date.now() + intervalHours * 3600 * 1000).toISOString().split('T')[0];
        }

        db.prepare(`
          UPDATE tasks SET
            status = 'Not Started',
            completed_date = NULL,
            completed_at = NULL,
            started_at = NULL,
            completion_duration_hours = 0,
            deadline_warning_sent = 0,
            overdue_warning_sent = 0,
            loop_warning_sent = 0,
            loop_count = ?,
            next_run_at = ?,
            start_date = ?,
            due_date = ?,
            last_updated = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newLoopCount, newNextRun, todayDate, updatedDueDate, task.id);

        // System audit log
        logSystemAction({
          userId: task.assigned_by || task.assigned_to,
          userName: 'System Task Loop Engine',
          role: 'System',
          action: 'TASK_LOOP_CYCLE_RESET',
          entityType: 'Task',
          entityId: task.id,
          details: `Task [${task.task_id}] "${task.title}" repeat timer completed. Reset in-place for cycle #${newLoopCount} (Interval: ${intervalHours}h).`
        });

        // In-App Notification after reset
        if (task.assigned_to) {
          createNotification({
            userId: task.assigned_to,
            senderId: null,
            senderName: 'System Loop',
            title: `🔁 Task Repeat Reset (Cycle #${newLoopCount})`,
            message: `Task "${task.title}" has completed its cycle and reset to 'Not Started' for cycle #${newLoopCount}.`,
            type: 'TASK_LOOP_RESET',
            entityType: 'Task',
            entityId: task.id
          });

          if (task.assignee_email) {
            sendTaskLoopResetEmail({
              toEmail: task.assignee_email,
              assigneeName: task.assignee_name,
              taskTitle: task.title,
              cycleNumber: newLoopCount,
              intervalHours
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error during normal task loop processing:', err);
  }

  // -----------------------------------------------------------------
  // 2. Process Self Tasks (Personal Tasks / self_logs)
  // -----------------------------------------------------------------
  try {
    const selfTasks = db.prepare(`
      SELECT sl.*, u.name as user_name, u.email as user_email
      FROM self_logs sl
      JOIN users u ON sl.user_id = u.id
      WHERE sl.is_loop = 1
        AND sl.type = 'task'
        AND sl.next_run_at IS NOT NULL
    `).all();

    for (const log of selfTasks) {
      const intervalHours = Number(log.loop_interval_hours) || 24;
      const nextRun = new Date(log.next_run_at);
      const diffMs = nextRun.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      const warningThresholdHours = intervalHours >= 12 ? 2 : Math.max(0.15, intervalHours * 0.15);

      // Warning before time duration complete
      if (diffHours > 0 && diffHours <= warningThresholdHours && (!log.loop_warning_sent || log.loop_warning_sent === 0)) {
        const formattedRemaining = diffHours >= 1
          ? `${Math.round(diffHours)} hour(s)`
          : `${Math.max(1, Math.round(diffHours * 60))} minute(s)`;

        createNotification({
          userId: log.user_id,
          senderId: null,
          senderName: 'Personal Task Loop',
          title: '⚠️ Personal Repeat Task Ending Soon',
          message: `Your personal task "${log.title}" cycle will reset in ~${formattedRemaining}.`,
          type: 'SELF_TASK_LOOP_WARNING',
          entityType: 'PersonalLog',
          entityId: log.id
        });

        db.prepare('UPDATE self_logs SET loop_warning_sent = 1 WHERE id = ?').run(log.id);
      }

      // Reset after time duration complete (no matter if completed or not!)
      if (diffMs <= 0) {
        const newLoopCount = (log.loop_count || 0) + 1;
        const newNextRun = new Date(Date.now() + intervalHours * 3600 * 1000).toISOString();
        const todayDate = new Date().toISOString().split('T')[0];

        let updatedDueDate = log.due_date;
        if (log.due_date) {
          updatedDueDate = new Date(Date.now() + intervalHours * 3600 * 1000).toISOString().split('T')[0];
        }

        db.prepare(`
          UPDATE self_logs SET
            status = 'Not Started',
            completed_date = NULL,
            loop_warning_sent = 0,
            loop_count = ?,
            next_run_at = ?,
            start_date = ?,
            due_date = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newLoopCount, newNextRun, todayDate, updatedDueDate, log.id);

        logSystemAction({
          userId: log.user_id,
          userName: log.user_name,
          role: 'Employee',
          action: 'SELF_TASK_LOOP_RESET',
          entityType: 'PersonalLog',
          entityId: log.id,
          details: `Personal task [${log.log_id || log.id}] "${log.title}" repeat timer completed. Reset in-place for cycle #${newLoopCount} (Interval: ${intervalHours}h).`
        });

        createNotification({
          userId: log.user_id,
          senderId: null,
          senderName: 'Personal Task Loop',
          title: `🔁 Personal Repeat Task Reset (Cycle #${newLoopCount})`,
          message: `Your personal task "${log.title}" has reset to 'Not Started' for cycle #${newLoopCount}.`,
          type: 'SELF_TASK_LOOP_RESET',
          entityType: 'PersonalLog',
          entityId: log.id
        });
      }
    }
  } catch (err) {
    console.error('Error during self task loop processing:', err);
  }
}

/**
 * Starts periodic task loop watcher (checks every 60 seconds)
 */
export function startTaskLoopWatcher() {
  // Run check 3 seconds after server starts
  setTimeout(() => {
    checkAndProcessTaskLoops();
  }, 3000);

  // Re-check every 60 seconds
  setInterval(() => {
    checkAndProcessTaskLoops();
  }, 60 * 1000);
}
