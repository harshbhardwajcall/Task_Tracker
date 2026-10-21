import express from 'express';
import db, { logSystemAction } from '../db/index.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

function generateLogId(type = 'task') {
  const prefix = type === 'note' ? 'NOTE' : 'PTASK';
  const row = db.prepare(`SELECT id FROM self_logs ORDER BY id DESC LIMIT 1`).get();
  const nextNum = row ? row.id + 1 : 1;
  return `${prefix}-${String(nextNum).padStart(4, '0')}`;
}

// GET all self logs for the authenticated user (supports ?type=task | note | all)
router.get('/', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    let sql = `
      SELECT sl.*,
             COALESCE(sl.project_name, p.name) AS project_name
      FROM self_logs sl
      LEFT JOIN projects p ON sl.project_id = p.id
      WHERE sl.user_id = ?
    `;
    const params = [userId];

    if (type && type !== 'all') {
      sql += ' AND sl.type = ?';
      params.push(type);
    }

    sql += ' ORDER BY sl.updated_at DESC';

    const logs = db.prepare(sql).all(...params);

    // Parse links JSON
    const parsedLogs = logs.map(l => {
      let parsedLinks = [];
      try {
        parsedLinks = l.links ? JSON.parse(l.links) : [];
      } catch (e) {
        parsedLinks = [];
      }
      return {
        ...l,
        links: Array.isArray(parsedLinks) ? parsedLinks : []
      };
    });

    res.json({ logs: parsedLogs });
  } catch (err) {
    console.error('Failed to get self logs:', err);
    res.status(500).json({ message: 'Failed to retrieve personal logs' });
  }
});

// CREATE personal task or note
router.post('/', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;
    const {
      log_id,
      type = 'task',
      title,
      description,
      content,
      category = 'Personal',
      status = 'Not Started',
      start_date,
      due_date,
      completed_date,
      links = [],
      project_id,
      project_name
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title / Task name is required.' });
    }

    const assignedLogId = log_id && log_id.trim() ? log_id.trim() : generateLogId(type);
    const descText = (description !== undefined ? description : content) || '';
    const serializedLinks = JSON.stringify(Array.isArray(links) ? links : []);

    let actualCompletedDate = completed_date || null;
    if (status === 'Completed' && !actualCompletedDate) {
      actualCompletedDate = new Date().toISOString().split('T')[0];
    } else if (status !== 'Completed') {
      actualCompletedDate = null;
    }

    let taskIsLoop = 0;
    let taskLoopInterval = 24.0;
    let taskNextRunAt = null;

    if (req.body.is_loop === true || req.body.is_loop === 'true' || req.body.is_loop === 1 || req.body.is_loop === '1') {
      taskIsLoop = 1;
      taskLoopInterval = Math.max(0.1, Number(req.body.loop_interval_hours) || 24);
      taskNextRunAt = new Date(Date.now() + taskLoopInterval * 3600 * 1000).toISOString();
    }

    const finalProjectId = project_id ? Number(project_id) : null;
    const finalProjectName = project_name && project_name.trim() ? project_name.trim() : null;

    const result = db.prepare(`
      INSERT INTO self_logs (
        user_id, log_id, type, title, description, content, category, status,
        start_date, due_date, completed_date, links, is_loop, loop_interval_hours, next_run_at,
        project_id, project_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      assignedLogId,
      type,
      title.trim(),
      descText.trim(),
      descText.trim(),
      category,
      status,
      start_date || null,
      due_date || null,
      actualCompletedDate,
      serializedLinks,
      taskIsLoop,
      taskLoopInterval,
      taskNextRunAt,
      finalProjectId,
      finalProjectName
    );

    const newLog = db.prepare(`
      SELECT sl.*, COALESCE(sl.project_name, p.name) AS project_name
      FROM self_logs sl
      LEFT JOIN projects p ON sl.project_id = p.id
      WHERE sl.id = ?
    `).get(result.lastInsertRowid);
    let parsedLinks = [];
    try { parsedLinks = JSON.parse(newLog.links); } catch (e) {}

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: type === 'note' ? 'CREATE_NOTE' : 'CREATE_PERSONAL_TASK',
      entityType: 'PersonalLog',
      entityId: result.lastInsertRowid,
      details: `Created ${type === 'note' ? 'note' : 'personal task'} [${assignedLogId}]: "${title.trim()}"`
    });

    res.status(201).json({
      message: `${type === 'note' ? 'Note' : 'Personal task'} saved successfully`,
      log: { ...newLog, links: parsedLinks }
    });
  } catch (err) {
    console.error('Failed to create self log:', err);
    res.status(500).json({ message: 'Failed to save personal log' });
  }
});

// UPDATE personal task or note
router.put('/:id', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      log_id,
      type,
      title,
      description,
      content,
      category,
      status,
      start_date,
      due_date,
      completed_date,
      links,
      project_id,
      project_name
    } = req.body;

    const log = db.prepare('SELECT * FROM self_logs WHERE id = ? AND user_id = ?').get(id, userId);
    if (!log) {
      return res.status(404).json({ message: 'Personal log not found.' });
    }

    const newTitle = title !== undefined ? title.trim() : log.title;
    const descText = description !== undefined ? description : (content !== undefined ? content : (log.description || log.content || ''));
    const newStatus = status !== undefined ? status : log.status;
    const newType = type || log.type || 'task';

    let actualCompletedDate = completed_date !== undefined ? completed_date : log.completed_date;
    if (newStatus === 'Completed' && !actualCompletedDate) {
      actualCompletedDate = new Date().toISOString().split('T')[0];
    } else if (newStatus !== 'Completed') {
      actualCompletedDate = null;
    }

    let serializedLinks = log.links;
    if (links !== undefined) {
      serializedLinks = JSON.stringify(Array.isArray(links) ? links : []);
    }

    let finalIsLoop = log.is_loop !== undefined ? log.is_loop : 0;
    let finalLoopInterval = log.loop_interval_hours || 24.0;
    let finalNextRunAt = log.next_run_at;

    if (req.body.hasOwnProperty('is_loop')) {
      const reqIsLoop = req.body.is_loop === true || req.body.is_loop === 'true' || req.body.is_loop === 1 || req.body.is_loop === '1';
      finalIsLoop = reqIsLoop ? 1 : 0;

      if (finalIsLoop === 1) {
        if (req.body.loop_interval_hours) {
          finalLoopInterval = Math.max(0.1, Number(req.body.loop_interval_hours) || 24);
        }
        if (!log.is_loop || log.loop_interval_hours !== finalLoopInterval || !finalNextRunAt) {
          finalNextRunAt = new Date(Date.now() + finalLoopInterval * 3600 * 1000).toISOString();
        }
      } else {
        finalNextRunAt = null;
      }
    } else if (req.body.hasOwnProperty('loop_interval_hours') && finalIsLoop === 1) {
      finalLoopInterval = Math.max(0.1, Number(req.body.loop_interval_hours) || 24);
      finalNextRunAt = new Date(Date.now() + finalLoopInterval * 3600 * 1000).toISOString();
    }

    let finalProjectId = log.project_id;
    let finalProjectName = log.project_name;
    if (req.body.hasOwnProperty('project_id')) {
      finalProjectId = project_id ? Number(project_id) : null;
    }
    if (req.body.hasOwnProperty('project_name')) {
      finalProjectName = project_name && project_name.trim() ? project_name.trim() : null;
    }

    db.prepare(`
      UPDATE self_logs SET
        log_id = COALESCE(?, log_id),
        type = ?,
        title = ?,
        description = ?,
        content = ?,
        category = COALESCE(?, category),
        status = ?,
        start_date = ?,
        due_date = ?,
        completed_date = ?,
        links = ?,
        is_loop = ?,
        loop_interval_hours = ?,
        next_run_at = ?,
        project_id = ?,
        project_name = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      log_id || log.log_id,
      newType,
      newTitle,
      descText.trim(),
      descText.trim(),
      category || log.category,
      newStatus,
      start_date !== undefined ? start_date : log.start_date,
      due_date !== undefined ? due_date : log.due_date,
      actualCompletedDate,
      serializedLinks,
      finalIsLoop,
      finalLoopInterval,
      finalNextRunAt,
      finalProjectId,
      finalProjectName,
      id,
      userId
    );

    const updated = db.prepare(`
      SELECT sl.*, COALESCE(sl.project_name, p.name) AS project_name
      FROM self_logs sl
      LEFT JOIN projects p ON sl.project_id = p.id
      WHERE sl.id = ?
    `).get(id);
    let parsedLinks = [];
    try { parsedLinks = JSON.parse(updated.links); } catch (e) {}

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: newType === 'note' ? 'UPDATE_NOTE' : 'UPDATE_PERSONAL_TASK',
      entityType: 'PersonalLog',
      entityId: id,
      details: `Updated ${newType === 'note' ? 'note' : 'personal task'} [${updated.log_id}]: "${updated.title}"`
    });

    res.json({
      message: 'Personal log updated successfully',
      log: { ...updated, links: parsedLinks }
    });
  } catch (err) {
    console.error('Failed to update self log:', err);
    res.status(500).json({ message: 'Failed to update personal log' });
  }
});

// DELETE personal log / note
router.delete('/:id', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const item = db.prepare('SELECT * FROM self_logs WHERE id = ? AND user_id = ?').get(id, userId);
    if (!item) {
      return res.status(404).json({ message: 'Personal log not found.' });
    }

    db.prepare('DELETE FROM self_logs WHERE id = ? AND user_id = ?').run(id, userId);

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: item.type === 'note' ? 'DELETE_NOTE' : 'DELETE_PERSONAL_TASK',
      entityType: 'PersonalLog',
      entityId: id,
      details: `Deleted ${item.type === 'note' ? 'note' : 'personal task'} [${item.log_id}]: "${item.title}"`
    });

    res.json({ message: 'Item deleted.' });
  } catch (err) {
    console.error('Failed to delete self log:', err);
    res.status(500).json({ message: 'Failed to delete item' });
  }
});

export default router;
