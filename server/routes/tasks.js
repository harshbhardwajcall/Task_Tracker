import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db, { purgeExpiredRecycleBinTasks } from '../db/index.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';

const router = express.Router();

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

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB maximum upload limit
});

// Helper function to safely delete physical attachment files from disk
function deletePhysicalAttachments(taskIds) {
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

// Helper function to dynamically update overdue tasks in DB & audit log
function syncOverdueStatus() {
  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = db.prepare(`
    SELECT id, task_id, status, due_date
    FROM tasks
    WHERE due_date < ? AND status NOT IN ('Completed', 'Overdue')
  `).all(today);

  const updateStmt = db.prepare("UPDATE tasks SET status = 'Overdue', last_updated = CURRENT_TIMESTAMP WHERE id = ?");
  const logStmt = db.prepare(`
    INSERT INTO task_history (task_id, user_id, user_name, action, old_value, new_value)
    VALUES (?, 1, 'System', 'Status Marked Overdue', ?, 'Overdue')
  `);

  for (const task of overdueTasks) {
    updateStmt.run(task.id);
    logStmt.run(task.id, task.status);
  }
}

// Audit logger helper
function logTaskHistory(taskId, userId, userName, action, oldValue, newValue) {
  db.prepare(`
    INSERT INTO task_history (task_id, user_id, user_name, action, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(taskId, userId, userName, action, oldValue, newValue);
}

// Generate next TASK-XXXX ID
function generateTaskId() {
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

// -------------------------------------------------------------
// GET /api/tasks - List all tasks with filters & RBAC
// -------------------------------------------------------------
router.get('/', authenticateUser, (req, res) => {
  // First update any overdue tasks in DB
  syncOverdueStatus();

  const {
    search,
    project_id,
    department_id,
    assigned_to,
    assigned_by,
    scope, // 'ASSIGNED_TO_ME' | 'ASSIGNED_BY_ME' | 'ALL'
    created_by_role, // 'ADMIN' | 'EMPLOYEE' | 'ALL'
    priority,
    status,
    exclude_completed,
    status_not,
    date_filter,
    from_date,
    to_date,
    sort_by = 'created_at',
    order = 'DESC'
  } = req.query;

  purgeExpiredRecycleBinTasks();

  let conditions = ['t.deleted_at IS NULL'];
  let params = [];

  if (req.user.role === 'Employee' || req.user.role === 'Intern') {
    if (scope === 'ASSIGNED_BY_ME' || scope === 'assigned_by_me' || assigned_by === 'ME') {
      // Show ONLY tasks assigned BY this employee
      conditions.push('t.assigned_by = ?');
      params.push(req.user.id);
    } else if (scope === 'ASSIGNED_TO_ME' || scope === 'assigned_to_me' || scope === 'MY_TASKS') {
      // Show ONLY tasks assigned TO this employee
      conditions.push('t.assigned_to = ?');
      params.push(req.user.id);
    } else {
      // General Dashboard: show tasks assigned TO or BY this employee
      conditions.push('(t.assigned_to = ? OR t.assigned_by = ?)');
      params.push(req.user.id, req.user.id);
    }
  } else if (req.user.role === 'Admin') {
    if (assigned_by && assigned_by !== 'ALL' && assigned_by !== 'all') {
      conditions.push('t.assigned_by = ?');
      params.push(assigned_by);
    }
  }

  // Filter by Creator Role (Admin Generated vs Employee Generated)
  if (created_by_role === 'ADMIN' || created_by_role === 'Admin') {
    conditions.push("assigner.role = 'Admin'");
  } else if (created_by_role === 'EMPLOYEE' || created_by_role === 'Employee') {
    conditions.push("assigner.role = 'Employee'");
  }

  if (assigned_to && req.user.role === 'Admin') {
    conditions.push('t.assigned_to = ?');
    params.push(assigned_to);
  }

  if (project_id) {
    conditions.push('t.project_id = ?');
    params.push(project_id);
  }

  if (department_id === 'ADMIN_TASKS' || department_id === 'ADMIN') {
    conditions.push("(d.name LIKE '%Admin%' OR d.name LIKE '%Management%' OR t.department_id = 1)");
  } else if (department_id) {
    conditions.push('t.department_id = ?');
    params.push(department_id);
  }

  if (priority) {
    conditions.push('t.priority = ?');
    params.push(priority);
  }

  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  } else if (status_not) {
    conditions.push('t.status != ?');
    params.push(status_not);
  } else if (exclude_completed === 'true' || exclude_completed === true) {
    conditions.push("t.status != 'Completed'");
  }

  if (search) {
    conditions.push('(t.task_id LIKE ? OR t.title LIKE ? OR t.description LIKE ?)');
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Date Filter handling
  const today = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];

  if (date_filter === 'Today') {
    const tStr = formatDate(today);
    conditions.push('(t.assigned_date = ? OR t.due_date = ?)');
    params.push(tStr, tStr);
  } else if (date_filter === 'Yesterday') {
    const yDay = new Date(today);
    yDay.setDate(today.getDate() - 1);
    const yStr = formatDate(yDay);
    conditions.push('(t.assigned_date = ? OR t.due_date = ?)');
    params.push(yStr, yStr);
  } else if (date_filter === 'Tomorrow') {
    const tmDay = new Date(today);
    tmDay.setDate(today.getDate() + 1);
    const tmStr = formatDate(tmDay);
    conditions.push('(t.assigned_date = ? OR t.due_date = ?)');
    params.push(tmStr, tmStr);
  } else if (date_filter === 'This Week') {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    conditions.push('((t.assigned_date BETWEEN ? AND ?) OR (t.due_date BETWEEN ? AND ?))');
    params.push(formatDate(startOfWeek), formatDate(endOfWeek), formatDate(startOfWeek), formatDate(endOfWeek));
  } else if (date_filter === 'Last Week') {
    const startOfLastWeek = new Date(today);
    startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    conditions.push('((t.assigned_date BETWEEN ? AND ?) OR (t.due_date BETWEEN ? AND ?))');
    params.push(formatDate(startOfLastWeek), formatDate(endOfLastWeek), formatDate(startOfLastWeek), formatDate(endOfLastWeek));
  } else if (date_filter === 'This Month') {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    conditions.push('((t.assigned_date BETWEEN ? AND ?) OR (t.due_date BETWEEN ? AND ?))');
    params.push(formatDate(startOfMonth), formatDate(endOfMonth), formatDate(startOfMonth), formatDate(endOfMonth));
  } else if (date_filter === 'Last Month') {
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    conditions.push('((t.assigned_date BETWEEN ? AND ?) OR (t.due_date BETWEEN ? AND ?))');
    params.push(formatDate(startOfLastMonth), formatDate(endOfLastMonth), formatDate(startOfLastMonth), formatDate(endOfLastMonth));
  } else if ((date_filter === 'Custom' || date_filter === 'Calendar' || date_filter === 'Date' || !date_filter) && (from_date || to_date)) {
    if (from_date && to_date && from_date !== to_date) {
      conditions.push('((t.assigned_date BETWEEN ? AND ?) OR (t.due_date BETWEEN ? AND ?))');
      params.push(from_date, to_date, from_date, to_date);
    } else {
      const singleDate = from_date || to_date;
      conditions.push('(t.assigned_date = ? OR t.due_date = ?)');
      params.push(singleDate, singleDate);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const validSorts = ['created_at', 'due_date', 'priority', 'status', 'task_id', 'title'];
  const safeSort = validSorts.includes(sort_by) ? sort_by : 'created_at';
  const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const query = `
    SELECT
      t.*,
      assigner.name as assigned_by_name,
      assigner.role as assigned_by_role,
      assignee.name as assigned_to_name,
      assignee.role as assigned_to_role,
      p.name as project_name,
      d.name as department_name,
      (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id) as comment_count,
      (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) as attachment_count
    FROM tasks t
    LEFT JOIN users assigner ON t.assigned_by = assigner.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN departments d ON t.department_id = d.id
    ${whereClause}
    ORDER BY t.${safeSort} ${safeOrder}
  `;

  const tasks = db.prepare(query).all(...params);

  // Summary Metrics calculation for Dashboard
  let summaryConditions = ['t.deleted_at IS NULL'];
  if (req.user.role === 'Employee' || req.user.role === 'Intern') {
    if (scope === 'ASSIGNED_BY_ME' || scope === 'assigned_by_me' || assigned_by === 'ME') {
      summaryConditions.push(`t.assigned_by = ${req.user.id}`);
    } else if (scope === 'ASSIGNED_TO_ME' || scope === 'assigned_to_me' || scope === 'MY_TASKS') {
      summaryConditions.push(`t.assigned_to = ${req.user.id}`);
    } else {
      summaryConditions.push(`(t.assigned_to = ${req.user.id} OR t.assigned_by = ${req.user.id})`);
    }
  } else if (req.user.role === 'Admin') {
    if (assigned_by && assigned_by !== 'ALL' && assigned_by !== 'all') {
      summaryConditions.push(`t.assigned_by = ${assigned_by}`);
    }
  }

  const summaryQuery = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN t.status IN ('Not Started', 'On Hold') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN t.status = 'Overdue' THEN 1 ELSE 0 END) as overdue
    FROM tasks t
    WHERE ${summaryConditions.join(' AND ')}
  `;

  const summary = db.prepare(summaryQuery).get();

  res.json({
    tasks,
    summary: {
      total: summary.total || 0,
      pending: summary.pending || 0,
      in_progress: summary.in_progress || 0,
      completed: summary.completed || 0,
      overdue: summary.overdue || 0
    }
  });
});

// -------------------------------------------------------------
// GET /api/tasks/:id - Single Task Details
// -------------------------------------------------------------
router.get('/:id', authenticateUser, (req, res) => {
  syncOverdueStatus();

  const task = db.prepare(`
    SELECT
      t.*,
      assigner.name as assigned_by_name,
      assigner.role as assigned_by_role,
      assigner.email as assigned_by_email,
      assignee.name as assigned_to_name,
      assignee.role as assigned_to_role,
      assignee.email as assigned_to_email,
      p.name as project_name,
      d.name as department_name
    FROM tasks t
    LEFT JOIN users assigner ON t.assigned_by = assigner.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN departments d ON t.department_id = d.id
    WHERE t.id = ? OR t.task_id = ?
  `).get(req.params.id, req.params.id);

  if (!task) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  // Employee guard: access allowed if assigned TO or assigned BY this employee
  if ((req.user.role === 'Employee' || req.user.role === 'Intern') && task.assigned_to !== req.user.id && task.assigned_by !== req.user.id) {
    return res.status(403).json({ message: 'Access denied to this task.' });
  }

  // Fetch comments
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.role as user_role
    FROM task_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(task.id);

  // Fetch attachments
  const attachments = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM task_attachments a
    JOIN users u ON a.user_id = u.id
    WHERE a.task_id = ?
    ORDER BY a.uploaded_at DESC
  `).all(task.id);

  // Fetch audit history
  const history = db.prepare(`
    SELECT * FROM task_history
    WHERE task_id = ?
    ORDER BY created_at DESC
  `).all(task.id);

  res.json({
    task,
    comments,
    attachments,
    history
  });
});

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
    manager_remarks
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

  const stmt = db.prepare(`
    INSERT INTO tasks (
      task_id, title, description, assigned_by, assigned_to, project_id, department_id,
      assigned_date, start_date, due_date, priority, status, manager_remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Started', ?)
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
    manager_remarks ? manager_remarks.trim() : null
  );

  const createdTask = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
  const newTaskId = createdTask.id;

  // Task Creation History Log
  logTaskHistory(newTaskId, req.user.id, req.user.name, 'Task Created', null, `Created task ${taskId}`);

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

  // Permission Check: Admin, Manager, Assigned Employee, or Task Assigner can edit
  if (req.user.role !== 'Admin' && req.user.role !== 'Manager' && existingTask.assigned_to !== req.user.id && existingTask.assigned_by !== req.user.id) {
    return res.status(403).json({ message: 'Permission denied.' });
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

  // Audit history logging for updated fields
  if (title && title !== existingTask.title) {
    logTaskHistory(taskId, req.user.id, req.user.name, 'Title Changed', existingTask.title, title);
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
  }
  if (priority && priority !== existingTask.priority) {
    logTaskHistory(taskId, req.user.id, req.user.name, 'Priority Changed', existingTask.priority, priority);
  }
  if (status && status !== existingTask.status) {
    logTaskHistory(taskId, req.user.id, req.user.name, 'Status Changed', existingTask.status, status);
  }
  if (due_date && due_date !== existingTask.due_date) {
    logTaskHistory(taskId, req.user.id, req.user.name, 'Due Date Changed', existingTask.due_date, due_date);
  }
  if (manager_remarks && manager_remarks !== existingTask.manager_remarks) {
    logTaskHistory(taskId, req.user.id, req.user.name, 'Manager Remarks Updated', existingTask.manager_remarks || 'None', manager_remarks);
  }

  let completedDate = existingTask.completed_date;
  if (status === 'Completed' && existingTask.status !== 'Completed') {
    completedDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
  } else if (status && status !== 'Completed') {
    completedDate = null;
  }

  const newDueDate = req.body.hasOwnProperty('due_date') ? (due_date ? due_date : null) : existingTask.due_date;

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
      priority = COALESCE(?, priority),
      status = COALESCE(?, status),
      manager_remarks = COALESCE(?, manager_remarks),
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
    priority !== undefined ? priority : existingTask.priority,
    status !== undefined ? status : existingTask.status,
    manager_remarks !== undefined ? manager_remarks : existingTask.manager_remarks,
    taskId
  );

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
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

  // Permission Check: Status can ONLY be changed by Admin or the assigned employee
  if (req.user.role !== 'Admin' && existingTask.assigned_to !== req.user.id) {
    return res.status(403).json({ message: 'Status can only be updated by the assigned employee or an Administrator.' });
  }

  let completedDate = existingTask.completed_date;
  if (status === 'Completed') {
    completedDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
  } else {
    completedDate = null;
  }

  db.prepare(`
    UPDATE tasks SET
      status = ?,
      completed_date = ?,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, completedDate, taskId);

  logTaskHistory(
    taskId,
    req.user.id,
    req.user.name,
    'Status Changed',
    existingTask.status,
    status
  );

  res.json({
    message: `Status updated to ${status}`,
    status,
    completed_date: completedDate
  });
});

// -------------------------------------------------------------
// POST /api/tasks/:id/comments - Add Comment
// -------------------------------------------------------------
router.post('/:id/comments', authenticateUser, (req, res) => {
  const taskId = req.params.id;
  const { comment } = req.body;

  if (!comment || !comment.trim()) {
    return res.status(400).json({ message: 'Comment cannot be empty.' });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  if ((req.user.role === 'Employee' || req.user.role === 'Intern') && task.assigned_to !== req.user.id && task.assigned_by !== req.user.id) {
    return res.status(403).json({ message: 'Access denied to this task.' });
  }

  const trimmedComment = comment.trim();
  db.prepare(`
    INSERT INTO task_comments (task_id, user_id, comment)
    VALUES (?, ?, ?)
  `).run(taskId, req.user.id, trimmedComment);

  // Update employee_comments field summary if posted by assigned employee
  if (req.user.role === 'Employee') {
    db.prepare("UPDATE tasks SET employee_comments = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?").run(trimmedComment, taskId);
  }

  logTaskHistory(taskId, req.user.id, req.user.name, 'Added Comment', null, trimmedComment);

  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.role as user_role
    FROM task_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(taskId);

  res.status(201).json({ message: 'Comment added', comments });
});

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

  if ((req.user.role === 'Employee' || req.user.role === 'Intern') && task.assigned_to !== req.user.id && task.assigned_by !== req.user.id) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  db.prepare(`
    INSERT INTO task_attachments (task_id, user_id, file_name, file_path, file_size)
    VALUES (?, ?, ?, ?, ?)
  `).run(taskId, req.user.id, req.file.originalname, req.file.filename, req.file.size);

  logTaskHistory(taskId, req.user.id, req.user.name, 'Uploaded Attachment', null, req.file.originalname);

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
router.delete('/:id/attachments/:attachmentId', authenticateUser, (req, res) => {
  const { id: taskId, attachmentId } = req.params;

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

  const attachments = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM task_attachments a
    JOIN users u ON a.user_id = u.id
    WHERE a.task_id = ?
    ORDER BY a.uploaded_at DESC
  `).all(taskId);

  res.json({ message: 'Attachment deleted successfully', attachments });
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
    db.prepare('DELETE FROM tasks WHERE id = ?').run(t.id);
  }

  res.json({ message: `Recycle bin emptied successfully (${tasks.length} tasks and attached files permanently deleted).` });
});

// -------------------------------------------------------------
// POST /api/tasks/:id/restore - Restore Task from Recycle Bin (Manager Only)
// -------------------------------------------------------------
router.post('/:id/restore', authenticateUser, requireRole('Manager'), (req, res) => {
  const taskId = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NOT NULL').get(taskId);

  if (!task) {
    return res.status(404).json({ message: 'Task not found in recycle bin.' });
  }

  db.prepare('UPDATE tasks SET deleted_at = NULL WHERE id = ?').run(taskId);
  logTaskHistory(taskId, req.user.id, req.user.name, 'Restored Task', 'In Recycle Bin', 'Active');

  res.json({ message: `Task ${task.task_id} restored successfully.` });
});

// -------------------------------------------------------------
// DELETE /api/tasks/:id/permanent - Permanently Delete Task (Manager Only)
// -------------------------------------------------------------
router.delete('/:id/permanent', authenticateUser, requireRole('Manager'), (req, res) => {
  const taskId = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  // Permanently delete attached physical files from disk
  deletePhysicalAttachments([taskId]);

  db.prepare('DELETE FROM task_history WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM task_attachments WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM task_comments WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

  res.json({ message: `Task ${task.task_id} and all attached files permanently deleted.` });
});

// -------------------------------------------------------------
// DELETE /api/tasks/:taskId/attachments/:attachmentId - Delete Individual Attachment
// -------------------------------------------------------------
router.delete('/:taskId/attachments/:attachmentId', authenticateUser, (req, res) => {
  const { taskId, attachmentId } = req.params;

  const att = db.prepare('SELECT * FROM task_attachments WHERE id = ? AND task_id = ?').get(attachmentId, taskId);
  if (!att) {
    return res.status(404).json({ message: 'Attachment not found.' });
  }

  // Delete physical file from disk
  if (att.file_path) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    const filePath = path.isAbsolute(att.file_path) ? att.file_path : path.join(uploadDir, att.file_path);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error(`Failed deleting attachment file ${filePath}:`, e);
    }
  }

  db.prepare('DELETE FROM task_attachments WHERE id = ?').run(attachmentId);
  logTaskHistory(taskId, req.user.id, req.user.name, 'Deleted Attachment', null, att.file_name);

  res.json({ message: `Attachment ${att.file_name} deleted successfully.` });
});

// -------------------------------------------------------------
// DELETE /api/tasks/:id - Move Task to Recycle Bin & Delete Storage Attachments (Manager Only)
// -------------------------------------------------------------
router.delete('/:id', authenticateUser, requireRole('Manager'), (req, res) => {
  const taskId = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  // Delete physical attachment files from disk storage immediately
  deletePhysicalAttachments([taskId]);
  db.prepare('DELETE FROM task_attachments WHERE task_id = ?').run(taskId);

  db.prepare('UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(taskId);
  logTaskHistory(taskId, req.user.id, req.user.name, 'Moved to Recycle Bin', null, 'Attachments deleted from storage');

  res.json({ message: `Task ${task.task_id} deleted and all attached files purged from storage.` });
});

export default router;
