import express from 'express';
import db, { logSystemAction, createNotification } from '../../db/index.js';
import { authenticateUser } from '../../middleware/auth.js';
import { sendTaskAssignedEmail, sendTaskModifiedEmail } from '../../utils/emailHelper.js';
import { upload, deletePhysicalAttachments, generateTaskId, logTaskHistory } from './taskHelpers.js';

const router = express.Router();

// -------------------------------------------------------------
// POST /api/tasks - Create Task (Available to Everyone)
// -------------------------------------------------------------
router.post('/', authenticateUser, upload.array('attachments'), (req, res) => {
  const {
    title,
    description,
    assigned_to,
    project_id,
    department_id,
    assigned_date,
    start_date,
    due_date,
    priority = 'Medium',
    manager_remarks,
    estimated_hours = 0,
    team_id = null
  } = req.body;

  // Validation
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Task title is required.' });
  }
  if (!description || !description.trim()) {
    return res.status(400).json({ message: 'Task description is required.' });
  }
  if (!assigned_to) {
    return res.status(400).json({ message: 'Assigned employee is required.' });
  }
  if (!project_id) {
    return res.status(400).json({ message: 'Project selection is required.' });
  }
  if (!department_id) {
    return res.status(400).json({ message: 'Department selection is required.' });
  }
  if (!start_date) {
    return res.status(400).json({ message: 'Start date is required.' });
  }
  if (due_date && due_date.trim() && new Date(due_date) < new Date(start_date)) {
    return res.status(400).json({ message: 'Due date cannot be earlier than start date.' });
  }

  const assignedBy = req.user.id;
  const taskId = generateTaskId();
  const assignDate = assigned_date || new Date().toISOString().split('T')[0];
  const cleanDueDate = due_date && due_date.trim() ? due_date.trim() : null;

  // Process Repeat Task Loop
  let taskIsLoop = 0;
  let taskLoopInterval = 24.0;
  let taskNextRunAt = null;

  if (req.body.is_loop === true || req.body.is_loop === 'true' || req.body.is_loop === 1 || req.body.is_loop === '1') {
    if (req.user.role !== 'Admin' && req.user.role !== 'Manager') {
      return res.status(403).json({ message: 'Only Admins and Managers can configure repeat task loops.' });
    }
    taskIsLoop = 1;
    taskLoopInterval = Math.max(0.1, Number(req.body.loop_interval_hours) || 24);
    taskNextRunAt = new Date(Date.now() + taskLoopInterval * 3600 * 1000).toISOString();
  }

  // Process reference links: link URL CANNOT be empty
  let cleanLinks = '[]';
  if (req.body.links) {
    if (typeof req.body.links === 'string') {
      try {
        const parsed = JSON.parse(req.body.links);
        if (Array.isArray(parsed)) {
          for (const l of parsed) {
            if (!l || typeof l.url !== 'string' || !l.url.trim()) {
              return res.status(400).json({ message: 'Reference link URL cannot be empty.' });
            }
          }
          const valid = parsed
            .map(l => {
              const u = l.url.trim();
              const fullUrl = u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`;
              const title = (l.title || '').trim() || u.replace(/^https?:\/\//i, '');
              return { title, url: fullUrl };
            });
          cleanLinks = JSON.stringify(valid);
        }
      } catch (e) {
        if (e.message === 'Reference link URL cannot be empty.') {
          return res.status(400).json({ message: e.message });
        }
        if (typeof req.body.links === 'string' && req.body.links.trim()) {
          const u = req.body.links.trim();
          const fullUrl = u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`;
          cleanLinks = JSON.stringify([{ title: u.replace(/^https?:\/\//i, ''), url: fullUrl }]);
        }
      }
    } else if (Array.isArray(req.body.links)) {
      for (const l of req.body.links) {
        if (!l || typeof l.url !== 'string' || !l.url.trim()) {
          return res.status(400).json({ message: 'Reference link URL cannot be empty.' });
        }
      }
      const valid = req.body.links
        .map(l => {
          const u = l.url.trim();
          const fullUrl = u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`;
          const title = (l.title || '').trim() || u.replace(/^https?:\/\//i, '');
          return { title, url: fullUrl };
        });
      cleanLinks = JSON.stringify(valid);
    }
  }

  const stmt = db.prepare(`
    INSERT INTO tasks (
      task_id, title, description, assigned_by, assigned_to, project_id, department_id,
      assigned_date, start_date, due_date, priority, status, manager_remarks,
      estimated_hours, team_id, links, is_loop, loop_interval_hours, next_run_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Started', ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    taskId,
    title.trim(),
    description.trim(),
    assignedBy,
    assigned_to,
    project_id,
    department_id,
    assignDate,
    start_date,
    cleanDueDate,
    priority,
    manager_remarks ? manager_remarks.trim() : null,
    Number(estimated_hours) || 0,
    team_id ? Number(team_id) : null,
    cleanLinks,
    taskIsLoop,
    taskLoopInterval,
    taskNextRunAt
  );

  const createdTask = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
  const newTaskId = createdTask.id;

  // Task Creation History Log
  logTaskHistory(newTaskId, req.user.id, req.user.name, 'Task Created', null, `Created task ${taskId}`);

  // System-wide Audit Log
  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'CREATE_TASK',
    entityType: 'Task',
    entityId: newTaskId,
    details: `Created task ${taskId}: "${title.trim()}" (Priority: ${priority})`
  });

  // In-App Notification for Assignee
  if (assigned_to) {
    createNotification({
      userId: assigned_to,
      senderId: req.user.id,
      senderName: req.user.name,
      title: 'New Task Assigned',
      message: `You were assigned task ${taskId}: "${title.trim()}"`,
      type: 'TASK_ASSIGNED',
      entityType: 'Task',
      entityId: newTaskId
    });
  }

  // Handle dependencies (more than 1 employee over the same task)
  let depUserIds = [];
  if (req.body.dependencies) {
    if (Array.isArray(req.body.dependencies)) {
      depUserIds = req.body.dependencies;
    } else if (typeof req.body.dependencies === 'string') {
      try {
        const parsed = JSON.parse(req.body.dependencies);
        depUserIds = Array.isArray(parsed) ? parsed : [req.body.dependencies];
      } catch (e) {
        depUserIds = req.body.dependencies.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
  }
  depUserIds = [...new Set(depUserIds.map(Number).filter(id => id && !isNaN(id) && id !== Number(assigned_to)))];

  if (depUserIds.length > 0) {
    const insertDep = db.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, user_id) VALUES (?, ?)');
    for (const depId of depUserIds) {
      insertDep.run(newTaskId, depId);
      logTaskHistory(newTaskId, req.user.id, req.user.name, 'Added Dependency', null, `User ID: ${depId}`);

      createNotification({
        userId: depId,
        senderId: req.user.id,
        senderName: req.user.name,
        title: 'Added as Task Dependency / Collaborator',
        message: `You were added as a dependency/collaborator on task ${taskId}: "${title.trim()}"`,
        type: 'TASK_ASSIGNED',
        entityType: 'Task',
        entityId: newTaskId
      });
    }
  }

  // Handle uploaded attachments
  if (req.files && req.files.length > 0) {
    const insertAttach = db.prepare(`
      INSERT INTO task_attachments (task_id, user_id, file_name, file_path, file_size)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const file of req.files) {
      insertAttach.run(newTaskId, req.user.id, file.originalname, file.filename || file.path, file.size);
      logTaskHistory(newTaskId, req.user.id, req.user.name, 'Uploaded Attachment', null, file.originalname);
    }
  }

  // Send Email Notification to Assignee
  try {
    const assignee = db.prepare('SELECT email, name FROM users WHERE id = ?').get(assigned_to);
    const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(project_id);
    if (assignee && assignee.email) {
      sendTaskAssignedEmail({
        toEmail: assignee.email,
        assigneeName: assignee.name,
        taskTitle: title.trim(),
        priority,
        dueDate: cleanDueDate,
        projectName: project ? project.name : '',
        assignedByName: req.user.name,
        taskId
      });
    }
  } catch (emailErr) {
    console.error('Failed to trigger task assignment email:', emailErr);
  }

  res.status(201).json({
    message: 'Task created successfully',
    task: createdTask
  });
});

// -------------------------------------------------------------
// PUT /api/tasks/:id - Edit Task
// -------------------------------------------------------------
router.put('/:id', authenticateUser, (req, res) => {
  const taskId = req.params.id;
  const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!existingTask) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  // Permission Check: Admin, Manager, or the user who assigned (created) the task can edit and reassign it.
  const isAssigner = Number(existingTask.assigned_by) === Number(req.user.id);
  const isAdmin = req.user.role === 'Admin';
  const isManager = req.user.role === 'Manager';

  if (!isAdmin && !isManager && !isAssigner) {
    return res.status(403).json({ message: 'Permission denied. Only the task assigner, an Admin, or a Manager can edit or reassign tasks.' });
  }

  const {
    title,
    description,
    assigned_to,
    project_id,
    department_id,
    start_date,
    due_date,
    priority,
    status,
    manager_remarks
  } = req.body;

  if (due_date && start_date && new Date(due_date) < new Date(start_date)) {
    return res.status(400).json({ message: 'Due date cannot be earlier than start date.' });
  }

  // Audit history logging & changes tracking for updated fields
  const modifiedChanges = [];

  if (title && title !== existingTask.title) {
    logTaskHistory(taskId, req.user.id, req.user.name, 'Title Changed', existingTask.title, title);
    modifiedChanges.push({ field: 'Title', oldValue: existingTask.title, newValue: title });
  }
  if (assigned_to && Number(assigned_to) !== existingTask.assigned_to) {
    const oldAssignee = db.prepare('SELECT name FROM users WHERE id = ?').get(existingTask.assigned_to);
    const newAssignee = db.prepare('SELECT name FROM users WHERE id = ?').get(assigned_to);
    logTaskHistory(
      taskId,
      req.user.id,
      req.user.name,
      'Reassigned Task',
      oldAssignee ? oldAssignee.name : String(existingTask.assigned_to),
      newAssignee ? newAssignee.name : String(assigned_to)
    );
    modifiedChanges.push({
      field: 'Assignee',
      oldValue: oldAssignee ? oldAssignee.name : 'Unassigned',
      newValue: newAssignee ? newAssignee.name : 'Unassigned'
    });
  }
  if (priority && priority !== existingTask.priority) {
    logTaskHistory(taskId, req.user.id, req.user.name, 'Priority Changed', existingTask.priority, priority);
    modifiedChanges.push({ field: 'Priority', oldValue: existingTask.priority, newValue: priority });
  }
  if (status && status !== existingTask.status) {
    logTaskHistory(taskId, req.user.id, req.user.name, 'Status Changed', existingTask.status, status);
    modifiedChanges.push({ field: 'Status', oldValue: existingTask.status, newValue: status });
  }
  if (due_date !== undefined && due_date !== existingTask.due_date) {
    logTaskHistory(taskId, req.user.id, req.user.name, 'Due Date Changed', existingTask.due_date || 'None', due_date || 'None');
    modifiedChanges.push({ field: 'Due Date', oldValue: existingTask.due_date || 'None', newValue: due_date || 'None' });
  }
  if (manager_remarks && manager_remarks !== existingTask.manager_remarks) {
    logTaskHistory(taskId, req.user.id, req.user.name, 'Manager Remarks Updated', existingTask.manager_remarks || 'None', manager_remarks);
    modifiedChanges.push({ field: 'Manager Remarks', oldValue: existingTask.manager_remarks || 'None', newValue: manager_remarks });
  }

  let completedDate = existingTask.completed_date;
  let startedAt = existingTask.started_at;
  let completedAt = existingTask.completed_at;
  let completionDurationHours = existingTask.completion_duration_hours || 0;

  if (status === 'In Progress' && !startedAt) {
    startedAt = new Date().toISOString();
  }

  if (status === 'Completed' && existingTask.status !== 'Completed') {
    completedDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
    completedAt = new Date().toISOString();
    const startPoint = new Date(startedAt || existingTask.created_at);
    const endPoint = new Date(completedAt);
    const diffHours = Math.max(0.01, (endPoint - startPoint) / (1000 * 60 * 60));
    completionDurationHours = Math.round(diffHours * 10) / 10;
  } else if (status && status !== 'Completed') {
    completedDate = null;
    completedAt = null;
    completionDurationHours = 0;
  }

  const newDueDate = req.body.hasOwnProperty('due_date') ? (due_date ? due_date : null) : existingTask.due_date;

  // Process reference links if supplied: link URL CANNOT be empty
  let cleanLinks = existingTask.links || '[]';
  if (req.body.hasOwnProperty('links')) {
    if (typeof req.body.links === 'string') {
      try {
        const parsed = JSON.parse(req.body.links);
        if (Array.isArray(parsed)) {
          for (const l of parsed) {
            if (!l || typeof l.url !== 'string' || !l.url.trim()) {
              return res.status(400).json({ message: 'Reference link URL cannot be empty.' });
            }
          }
          const valid = parsed
            .map(l => {
              const u = l.url.trim();
              const fullUrl = u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`;
              const title = (l.title || '').trim() || u.replace(/^https?:\/\//i, '');
              return { title, url: fullUrl };
            });
          cleanLinks = JSON.stringify(valid);
        }
      } catch (e) {
        if (e.message === 'Reference link URL cannot be empty.') {
          return res.status(400).json({ message: e.message });
        }
        if (typeof req.body.links === 'string' && req.body.links.trim()) {
          const u = req.body.links.trim();
          const fullUrl = u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`;
          cleanLinks = JSON.stringify([{ title: u.replace(/^https?:\/\//i, ''), url: fullUrl }]);
        }
      }
    } else if (Array.isArray(req.body.links)) {
      for (const l of req.body.links) {
        if (!l || typeof l.url !== 'string' || !l.url.trim()) {
          return res.status(400).json({ message: 'Reference link URL cannot be empty.' });
        }
      }
      const valid = req.body.links
        .map(l => {
          const u = l.url.trim();
          const fullUrl = u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`;
          const title = (l.title || '').trim() || u.replace(/^https?:\/\//i, '');
          return { title, url: fullUrl };
        });
      cleanLinks = JSON.stringify(valid);
    }
  }

  // Process Repeat Task Loop update
  let finalIsLoop = existingTask.is_loop !== undefined ? existingTask.is_loop : 0;
  let finalLoopInterval = existingTask.loop_interval_hours || 24.0;
  let finalNextRunAt = existingTask.next_run_at;

  if (req.body.hasOwnProperty('is_loop')) {
    if (req.user.role !== 'Admin' && req.user.role !== 'Manager') {
      return res.status(403).json({ message: 'Only Admins and Managers can configure repeat task loops.' });
    }
    const reqIsLoop = req.body.is_loop === true || req.body.is_loop === 'true' || req.body.is_loop === 1 || req.body.is_loop === '1';
    finalIsLoop = reqIsLoop ? 1 : 0;

    if (finalIsLoop === 1) {
      if (req.body.loop_interval_hours) {
        finalLoopInterval = Math.max(0.1, Number(req.body.loop_interval_hours) || 24);
      }
      if (!existingTask.is_loop || existingTask.loop_interval_hours !== finalLoopInterval || !finalNextRunAt) {
        finalNextRunAt = new Date(Date.now() + finalLoopInterval * 3600 * 1000).toISOString();
      }
    } else {
      finalNextRunAt = null;
    }
  } else if (req.body.hasOwnProperty('loop_interval_hours') && finalIsLoop === 1) {
    if (req.user.role !== 'Admin' && req.user.role !== 'Manager') {
      return res.status(403).json({ message: 'Only Admins and Managers can configure repeat task loops.' });
    }
    finalLoopInterval = Math.max(0.1, Number(req.body.loop_interval_hours) || 24);
    finalNextRunAt = new Date(Date.now() + finalLoopInterval * 3600 * 1000).toISOString();
  }

  const stmt = db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      assigned_to = COALESCE(?, assigned_to),
      project_id = COALESCE(?, project_id),
      department_id = COALESCE(?, department_id),
      start_date = COALESCE(?, start_date),
      due_date = ?,
      completed_date = ?,
      completed_at = ?,
      completion_duration_hours = ?,
      started_at = ?,
      priority = COALESCE(?, priority),
      status = COALESCE(?, status),
      manager_remarks = COALESCE(?, manager_remarks),
      links = ?,
      is_loop = ?,
      loop_interval_hours = ?,
      next_run_at = ?,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(
    title !== undefined ? title : existingTask.title,
    description !== undefined ? description : existingTask.description,
    assigned_to !== undefined ? assigned_to : existingTask.assigned_to,
    project_id !== undefined ? project_id : existingTask.project_id,
    department_id !== undefined ? department_id : existingTask.department_id,
    start_date !== undefined ? start_date : existingTask.start_date,
    newDueDate,
    completedDate,
    completedAt,
    completionDurationHours,
    startedAt,
    priority !== undefined ? priority : existingTask.priority,
    status !== undefined ? status : existingTask.status,
    manager_remarks !== undefined ? manager_remarks : existingTask.manager_remarks,
    cleanLinks,
    finalIsLoop,
    finalLoopInterval,
    finalNextRunAt,
    taskId
  );

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'UPDATE_TASK',
    entityType: 'Task',
    entityId: taskId,
    details: `Updated task ${existingTask.task_id} ("${updated.title}")`
  });

  // In-App Notification for Assignee if updated by someone else
  if (assigned_to && Number(assigned_to) !== Number(existingTask.assigned_to)) {
    createNotification({
      userId: assigned_to,
      senderId: req.user.id,
      senderName: req.user.name,
      title: 'Task Assigned To You',
      message: `Task ${existingTask.task_id} ("${updated.title}") was assigned to you`,
      type: 'TASK_ASSIGNED',
      entityType: 'Task',
      entityId: taskId
    });
  } else if (existingTask.assigned_to && Number(existingTask.assigned_to) !== Number(req.user.id)) {
    createNotification({
      userId: existingTask.assigned_to,
      senderId: req.user.id,
      senderName: req.user.name,
      title: 'Assigned Task Updated',
      message: `Task ${existingTask.task_id} ("${updated.title}") was modified by ${req.user.name}`,
      type: 'TASK_UPDATED',
      entityType: 'Task',
      entityId: taskId
    });
  }

  // Update dependencies if provided in payload
  if (req.body.hasOwnProperty('dependencies')) {
    let depUserIds = [];
    if (Array.isArray(req.body.dependencies)) {
      depUserIds = req.body.dependencies;
    } else if (typeof req.body.dependencies === 'string') {
      try {
        const parsed = JSON.parse(req.body.dependencies);
        depUserIds = Array.isArray(parsed) ? parsed : [req.body.dependencies];
      } catch (e) {
        depUserIds = req.body.dependencies.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    const finalAssignedTo = assigned_to !== undefined ? Number(assigned_to) : Number(existingTask.assigned_to);
    depUserIds = [...new Set(depUserIds.map(Number).filter(id => id && !isNaN(id) && id !== finalAssignedTo))];

    const currentDeps = db.prepare('SELECT user_id FROM task_dependencies WHERE task_id = ?').all(taskId).map(r => r.user_id);
    db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(taskId);
    const insertDep = db.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, user_id) VALUES (?, ?)');
    for (const depId of depUserIds) {
      insertDep.run(taskId, depId);
      if (!currentDeps.includes(depId)) {
        createNotification({
          userId: depId,
          senderId: req.user.id,
          senderName: req.user.name,
          title: 'Added as Task Dependency',
          message: `You were added as a dependency/collaborator on task ${existingTask.task_id}: "${updated.title}"`,
          type: 'TASK_ASSIGNED',
          entityType: 'Task',
          entityId: taskId
        });
      }
    }
    logTaskHistory(taskId, req.user.id, req.user.name, 'Updated Dependencies', `${currentDeps.length} employees`, `${depUserIds.length} employees`);
  }

  const updatedDeps = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.avatar, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM task_dependencies td
    JOIN users u ON td.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE td.task_id = ?
    ORDER BY u.name ASC
  `).all(taskId);

  updated.dependencies = updatedDeps;

  // Dispatch Task Modified Email Notification to Assignee
  if (modifiedChanges.length > 0) {
    try {
      const targetUserId = updated.assigned_to || existingTask.assigned_to;
      if (targetUserId) {
        const assignee = db.prepare('SELECT email, name FROM users WHERE id = ?').get(targetUserId);
        if (assignee && assignee.email) {
          sendTaskModifiedEmail({
            toEmail: assignee.email,
            assigneeName: assignee.name,
            taskTitle: updated.title,
            taskId: existingTask.task_id,
            updatedByName: req.user.name,
            changes: modifiedChanges
          });
        }
      }
    } catch (emailErr) {
      console.error('Failed to dispatch task modified email:', emailErr);
    }
  }

  res.json({ message: 'Task updated successfully', task: updated });
});

// -------------------------------------------------------------
// PATCH /api/tasks/:id/status - Employee or Manager Status Update
// -------------------------------------------------------------
router.patch('/:id/status', authenticateUser, (req, res) => {
  const taskId = req.params.id;
  const { status } = req.body;

  const validStatuses = ['Not Started', 'In Progress', 'On Hold', 'Completed'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value.' });
  }

  const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!existingTask) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  // Permission Check: Status can be changed by Admin, Manager, the task assigner, the assigned employee, or a dependency/collaborator
  const isAssigner = Number(existingTask.assigned_by) === Number(req.user.id);
  const isAssignee = Number(existingTask.assigned_to) === Number(req.user.id);
  const isAdmin = req.user.role === 'Admin';
  const isManager = req.user.role === 'Manager';
  const isDependency = db.prepare('SELECT 1 FROM task_dependencies WHERE task_id = ? AND user_id = ?').get(taskId, req.user.id);

  if (!isAdmin && !isManager && !isAssigner && !isAssignee && !isDependency) {
    return res.status(403).json({ message: 'Permission denied. Only the assigned employee, collaborators, assigner, or a Manager/Admin can update task status.' });
  }

  let completedDate = existingTask.completed_date;
  let startedAt = existingTask.started_at;
  let completedAt = existingTask.completed_at;
  let completionDurationHours = existingTask.completion_duration_hours || 0;

  if (status === 'In Progress' && !startedAt) {
    startedAt = new Date().toISOString();
  }

  if (status === 'Completed') {
    completedDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
    completedAt = new Date().toISOString();
    // Calculate duration in hours from started_at (or created_at) to completed_at
    const startPoint = new Date(startedAt || existingTask.created_at);
    const endPoint = new Date(completedAt);
    const diffHours = Math.max(0.01, (endPoint - startPoint) / (1000 * 60 * 60));
    completionDurationHours = Math.round(diffHours * 10) / 10;
  } else if (status !== 'Completed') {
    completedDate = null;
    completedAt = null;
  }

  db.prepare(`
    UPDATE tasks SET
      status = ?,
      completed_date = ?,
      started_at = ?,
      completed_at = ?,
      completion_duration_hours = ?,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, completedDate, startedAt, completedAt, completionDurationHours, taskId);

  logTaskHistory(
    taskId,
    req.user.id,
    req.user.name,
    'Status Changed',
    existingTask.status,
    status
  );

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'TASK_STATUS_CHANGE',
    entityType: 'Task',
    entityId: taskId,
    details: `Updated task ${existingTask.task_id} status from "${existingTask.status}" to "${status}" (Duration: ${completionDurationHours} hrs)`
  });

  // In-App Notifications for Status Change
  if (existingTask.assigned_by && Number(existingTask.assigned_by) !== Number(req.user.id)) {
    createNotification({
      userId: existingTask.assigned_by,
      senderId: req.user.id,
      senderName: req.user.name,
      title: 'Task Status Updated',
      message: `${req.user.name} changed status of task ${existingTask.task_id} to "${status}"`,
      type: 'TASK_STATUS_CHANGED',
      entityType: 'Task',
      entityId: taskId
    });
  }
  if (existingTask.assigned_to && Number(existingTask.assigned_to) !== Number(req.user.id)) {
    createNotification({
      userId: existingTask.assigned_to,
      senderId: req.user.id,
      senderName: req.user.name,
      title: 'Task Status Updated',
      message: `Status of task ${existingTask.task_id} was updated to "${status}" by ${req.user.name}`,
      type: 'TASK_STATUS_CHANGED',
      entityType: 'Task',
      entityId: taskId
    });
  }

  res.json({
    message: `Status updated to ${status}`,
    status,
    completed_date: completedDate,
    completion_duration_hours: completionDurationHours
  });
});

// -------------------------------------------------------------
// DELETE /api/tasks/:id - Move Task to Recycle Bin & Delete Storage Attachments
// (Admin can delete any task; Manager, Employee, and Intern can ONLY delete tasks they assigned)
// -------------------------------------------------------------
router.delete('/:id', authenticateUser, (req, res) => {
  const taskId = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  // Permission Check: Admin can delete any task.
  // Managers, Employees, and Interns can ONLY delete tasks that they assigned (created).
  if (req.user.role !== 'Admin' && Number(task.assigned_by) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'Permission denied. You are only allowed to delete tasks that you assigned.' });
  }

  // Delete physical attachment files from disk storage immediately
  deletePhysicalAttachments([taskId]);
  db.prepare('DELETE FROM task_attachments WHERE task_id = ?').run(taskId);

  db.prepare('UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(taskId);
  logTaskHistory(taskId, req.user.id, req.user.name, 'Moved to Recycle Bin', null, 'Attachments deleted from storage');

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'SOFT_DELETE_TASK',
    entityType: 'Task',
    entityId: taskId,
    details: `Moved task ${task.task_id} ("${task.title}") to recycle bin`
  });

  res.json({ message: `Task ${task.task_id} deleted and all attached files purged from storage.` });
});

export default router;
