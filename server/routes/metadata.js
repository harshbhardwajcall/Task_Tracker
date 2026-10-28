import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db, { logSystemAction } from '../db/index.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { purgeUserPermanently, purgeTasksPermanently } from '../utils/attachmentHelper.js';
import { sendUserWelcomeEmail, sendUserDeactivatedEmail, sendProjectAllocatedEmail } from '../utils/emailHelper.js';

const router = express.Router();

// File upload configuration for project media
const projectMediaStorage = multer.diskStorage({
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
    cb(null, `project-media-${uniqueSuffix}${ext}`);
  }
});

const uploadProjectMedia = multer({
  storage: projectMediaStorage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max upload
});



// Get list of employees & interns
router.get('/employees', authenticateUser, (req, res) => {
  const employees = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.role IN ('Employee', 'Intern', 'Manager')
    ORDER BY u.name ASC
  `).all();
  res.json({ employees });
});

// Add a new employee / intern (Admin & Manager only)
router.post('/employees', authenticateUser, requireRole('Admin', 'Manager'), (req, res) => {
  const { name, email, department_id, title, password } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Employee name is required.' });
  }

  let cleanEmail = '';
  if (email && email.trim()) {
    cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ message: 'A user with this email address already exists.' });
    }
  } else {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'employee';
    cleanEmail = `${slug}.${Date.now().toString(36)}@company.local`;
  }

  const empTitle = title && title.trim() ? title.trim() : 'Employee';
  const temporaryPassword = (password && typeof password === 'string' && password.trim().length >= 6)
    ? password.trim()
    : 'Emp@' + Math.floor(100000 + Math.random() * 900000);
  const hashedPassword = bcrypt.hashSync(temporaryPassword, 10);

  db.prepare(`
    INSERT INTO users (name, email, password, role, department_id, title)
    VALUES (?, ?, ?, 'Employee', ?, ?)
  `).run(name.trim(), cleanEmail, hashedPassword, department_id || 1, empTitle);

  const newEmployee = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.email = ?
  `).get(cleanEmail);

  logSystemAction({
    userId: req.user ? req.user.id : newEmployee.id,
    userName: req.user ? req.user.name : newEmployee.name,
    role: req.user ? req.user.role : newEmployee.role,
    action: 'CREATE_EMPLOYEE',
    entityType: 'User',
    entityId: newEmployee.id,
    details: `Created team member "${newEmployee.name}" (${newEmployee.email}) with title "${newEmployee.title || 'Employee'}"`
  });

  // Dispatch Welcome Email Notification
  if (newEmployee && newEmployee.email && !newEmployee.email.endsWith('@company.local')) {
    try {
      sendUserWelcomeEmail({
        toEmail: newEmployee.email,
        name: newEmployee.name,
        role: newEmployee.role,
        title: newEmployee.title,
        temporaryPassword: temporaryPassword,
        createdByName: req.user ? req.user.name : 'System Administrator'
      });
    } catch (mailErr) {
      console.error('Failed to dispatch welcome email:', mailErr);
    }
  }

  res.status(201).json({
    message: `${empTitle} created successfully`,
    employee: newEmployee
  });
});

function logTaskHistory(taskId, userId, userName, action, oldValue, newValue) {
  try {
    const stmt = db.prepare(`
      INSERT INTO task_history (task_id, user_id, user_name, action, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(taskId, userId, userName, action, oldValue ? String(oldValue) : null, newValue ? String(newValue) : null);
  } catch (err) {
    console.error('Failed to log task history:', err);
  }
}

// Delete an employee / intern permanently from database! (Admin & Manager only)
router.delete('/employees/:id', authenticateUser, requireRole('Admin', 'Manager'), (req, res) => {
  const employeeId = req.params.id;

  const emp = db.prepare("SELECT * FROM users WHERE id = ?").get(employeeId);
  if (!emp) {
    return res.status(404).json({ message: 'Team member not found.' });
  }

  // Prevent deleting oneself
  if (Number(employeeId) === Number(req.user?.id)) {
    return res.status(400).json({ message: 'You cannot delete your own currently active user account.' });
  }

  // Prevent deleting the only remaining admin if an admin is targeted
  if (emp.role === 'Admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Admin'").get().count;
    if (adminCount <= 1) {
      return res.status(400).json({ message: 'Cannot delete the only remaining Administrator account.' });
    }
  }

  // Delete user while retaining their tasks for reassignment
  const { retainedTasksCount } = purgeUserPermanently(employeeId);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'DELETE_EMPLOYEE',
    entityType: 'User',
    entityId: employeeId,
    details: `Deleted team member "${emp.name}" (${emp.email}) - Title: ${emp.title || emp.role}`
  });

  // Dispatch Deactivation / Offboarding Email Notification
  if (emp && emp.email && !emp.email.endsWith('@company.local')) {
    try {
      sendUserDeactivatedEmail({
        toEmail: emp.email,
        name: emp.name,
        role: emp.role,
        title: emp.title,
        removedByName: req.user.name
      });
    } catch (mailErr) {
      console.error('Failed to dispatch deactivation email:', mailErr);
    }
  }

  res.json({
    message: `${emp.title || emp.role || 'Team member'} "${emp.name}" was deleted. ${retainedTasksCount} associated task(s) were retained and are available for reassignment.`
  });
});

// Get comprehensive analytics and performance statistics for a specific employee
router.get('/employees/:id/analytics', authenticateUser, (req, res) => {
  const empId = req.params.id;
  const emp = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(empId);

  if (!emp) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  const { startDate, endDate } = req.query;

  let tasksSql = `
    SELECT
      t.*,
      p.name as project_name,
      d.name as department_name,
      assigner.name as assigned_by_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN users assigner ON t.assigned_by = assigner.id
    WHERE (t.assigned_to = ? OR t.assigned_by = ? OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?)) AND t.deleted_at IS NULL
  `;
  const tasksParams = [empId, empId, empId];

  if (startDate) {
    tasksSql += ` AND COALESCE(t.assigned_date, t.start_date, SUBSTR(t.created_at, 1, 10)) >= ?`;
    tasksParams.push(startDate);
  }
  if (endDate) {
    tasksSql += ` AND COALESCE(t.assigned_date, t.start_date, SUBSTR(t.created_at, 1, 10)) <= ?`;
    tasksParams.push(endDate);
  }

  tasksSql += ` ORDER BY t.created_at DESC`;

  const tasks = db.prepare(tasksSql).all(...tasksParams);

  const todayStr = new Date().toISOString().split('T')[0];

  let completedCount = 0;
  let inProgressCount = 0;
  let onHoldCount = 0;
  let notStartedCount = 0;
  let overdueCount = 0;
  let onTimeCompletedCount = 0;
  let totalTurnaroundHours = 0;
  let completedWithTurnaroundCount = 0;

  const priorityBreakdown = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  const projectMap = {};

  tasks.forEach(t => {
    // Priority
    if (priorityBreakdown[t.priority] !== undefined) {
      priorityBreakdown[t.priority]++;
    }

    // Project breakdown
    const projKey = t.project_name || 'General';
    if (!projectMap[projKey]) {
      projectMap[projKey] = { project_name: projKey, total: 0, completed: 0, in_progress: 0 };
    }
    projectMap[projKey].total++;

    // Status
    if (t.status === 'Completed') {
      completedCount++;
      projectMap[projKey].completed++;
      if (t.completed_date && t.due_date && t.completed_date <= t.due_date) {
        onTimeCompletedCount++;
      } else if (!t.due_date) {
        onTimeCompletedCount++;
      }

      if (t.completed_date) {
        let startTimeStr = t.start_date || t.assigned_date || t.created_at;
        // If start_date is in the future relative to completed_date, fall back to creation/assigned timestamp
        if (t.start_date && new Date(t.start_date) > new Date(t.completed_date)) {
          startTimeStr = t.assigned_date || t.created_at || t.start_date;
        }
        if (startTimeStr) {
          const start = new Date(startTimeStr);
          const end = new Date(t.completed_date);
          const diffMs = Math.max(0, end - start);
          const diffHours = diffMs / (1000 * 60 * 60);
          totalTurnaroundHours += diffHours;
          completedWithTurnaroundCount++;
        }
      }
    } else if (t.status === 'In Progress') {
      inProgressCount++;
      projectMap[projKey].in_progress++;
    } else if (t.status === 'On Hold') {
      onHoldCount++;
    } else if (t.status === 'Not Started') {
      notStartedCount++;
    }

    if (t.status === 'Overdue' || (t.status !== 'Completed' && t.due_date && t.due_date < todayStr)) {
      overdueCount++;
    }
  });

  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const onTimeRate = completedCount > 0 ? Math.round((onTimeCompletedCount / completedCount) * 100) : 100;
  const avgCompletionHours = completedWithTurnaroundCount > 0
    ? (totalTurnaroundHours / completedWithTurnaroundCount)
    : (completedCount > 0 ? 24 : null);

  let formattedAvgTime = '—';
  if (avgCompletionHours !== null) {
    if (avgCompletionHours < 1) {
      const mins = Math.max(1, Math.round(avgCompletionHours * 60));
      formattedAvgTime = `${mins} min${mins === 1 ? '' : 's'}`;
    } else if (avgCompletionHours < 24) {
      formattedAvgTime = `${avgCompletionHours.toFixed(1)} hrs`;
    } else {
      const days = (avgCompletionHours / 24).toFixed(1);
      formattedAvgTime = `${days} Day${days === '1.0' ? '' : 's'}`;
    }
  }

  res.json({
    employee: emp,
    stats: {
      totalTasks,
      completedTasks: completedCount,
      inProgressTasks: inProgressCount,
      onHoldTasks: onHoldCount,
      notStartedTasks: notStartedCount,
      overdueTasks: overdueCount,
      completionRate,
      onTimeRate,
      avgCompletionTime: formattedAvgTime,
      avgCompletionDays: formattedAvgTime
    },
    priorityBreakdown,
    projectBreakdown: Object.values(projectMap),
    tasks
  });
});

// Get departments
router.get('/departments', authenticateUser, (req, res) => {
  const departments = db.prepare(`
    SELECT
      d.*,
      CASE
        WHEN d.name LIKE '%Admin Tasks%' OR d.name LIKE '%Admin%' OR d.name LIKE '%Management%' THEN
          (SELECT COUNT(*) FROM users WHERE role = 'Admin')
        ELSE
          COUNT(CASE WHEN u.id IS NOT NULL AND u.role != 'Admin' THEN 1 END)
      END as total_users
    FROM departments d
    LEFT JOIN users u ON u.department_id = d.id
    GROUP BY d.id
    ORDER BY d.name ASC
  `).all();
  res.json({ departments });
});

// Job Titles: Get all job titles
router.get('/job-titles', authenticateUser, (req, res) => {
  try {
    const titles = db.prepare('SELECT id, title FROM job_titles ORDER BY title COLLATE NOCASE ASC').all();
    res.json({ job_titles: titles });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch job titles.' });
  }
});

// Job Titles: Add a new job title
router.post('/job-titles', authenticateUser, (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Job title is required.' });
  }

  const cleanTitle = title.trim();
  const existing = db.prepare('SELECT id, title FROM job_titles WHERE LOWER(title) = ?').get(cleanTitle.toLowerCase());
  if (existing) {
    return res.json({ message: 'Job title already exists', job_title: existing });
  }

  try {
    db.prepare('INSERT INTO job_titles (title) VALUES (?)').run(cleanTitle);
    const newTitle = db.prepare('SELECT id, title FROM job_titles WHERE title = ?').get(cleanTitle);

    logSystemAction({
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'Admin',
      role: req.user ? req.user.role : 'Admin',
      action: 'CREATE_JOB_TITLE',
      entityType: 'JobTitle',
      entityId: newTitle ? newTitle.id : null,
      details: `Created job title "${cleanTitle}"`
    });

    res.status(201).json({
      message: 'Job title created successfully',
      job_title: newTitle
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create job title.' });
  }
});

// Job Titles: Delete a job title
router.delete('/job-titles/:id', authenticateUser, (req, res) => {
  const titleId = req.params.id;
  const existing = db.prepare('SELECT id, title FROM job_titles WHERE id = ?').get(titleId);
  if (!existing) {
    return res.status(404).json({ message: 'Job title not found.' });
  }

  try {
    db.prepare('DELETE FROM job_titles WHERE id = ?').run(titleId);

    logSystemAction({
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'Admin',
      role: req.user ? req.user.role : 'Admin',
      action: 'DELETE_JOB_TITLE',
      entityType: 'JobTitle',
      entityId: titleId,
      details: `Deleted job title "${existing.title}"`
    });

    res.json({ message: `Job title "${existing.title}" deleted successfully.` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete job title.' });
  }
});

// Create a new department (Admin only)
router.post('/departments', authenticateUser, requireRole('Admin'), (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Department name is required.' });
  }

  const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name.trim());
  if (existing) {
    return res.status(400).json({ message: 'A department with this name already exists.' });
  }

  db.prepare(`
    INSERT INTO departments (name, description)
    VALUES (?, ?)
  `).run(name.trim(), description ? description.trim() : '');

  const newDept = db.prepare(`
    SELECT d.*, 0 as total_users
    FROM departments d
    WHERE d.name = ?
  `).get(name.trim());

  logSystemAction({
    userId: req.user ? req.user.id : null,
    userName: req.user ? req.user.name : 'System',
    role: req.user ? req.user.role : 'Admin',
    action: 'CREATE_DEPARTMENT',
    entityType: 'Department',
    entityId: newDept ? newDept.id : null,
    details: `Created department "${newDept ? newDept.name : name.trim()}"`
  });

  res.status(201).json({
    message: 'Department created successfully',
    department: newDept
  });
});

// Update a department (Admin only)
router.put('/departments/:id', authenticateUser, requireRole('Admin'), (req, res) => {
  const departmentId = req.params.id;
  const { name, description } = req.body;

  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
  if (!dept) {
    return res.status(404).json({ message: 'Department not found.' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Department name is required.' });
  }

  const existing = db.prepare('SELECT id FROM departments WHERE LOWER(name) = ? AND id != ?').get(name.trim().toLowerCase(), departmentId);
  if (existing) {
    return res.status(400).json({ message: 'A department with this name already exists.' });
  }

  const newDesc = description !== undefined ? description.trim() : (dept.description || '');

  db.prepare(`
    UPDATE departments
    SET name = ?, description = ?
    WHERE id = ?
  `).run(name.trim(), newDesc, departmentId);

  const updatedDept = db.prepare(`
    SELECT d.*, COUNT(u.id) as total_users
    FROM departments d
    LEFT JOIN users u ON u.department_id = d.id
    WHERE d.id = ?
    GROUP BY d.id
  `).get(departmentId);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'UPDATE_DEPARTMENT',
    entityType: 'Department',
    entityId: departmentId,
    details: `Updated department "${updatedDept.name}"`
  });

  res.json({
    message: 'Department updated successfully',
    department: updatedDept
  });
});

// Delete a department permanently from database! (Admin only)
router.delete('/departments/:id', authenticateUser, requireRole('Admin'), (req, res) => {
  const departmentId = req.params.id;

  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
  if (!dept) {
    return res.status(404).json({ message: 'Department not found.' });
  }

  // Prevent deleting the only remaining department
  const remaining = db.prepare('SELECT COUNT(*) as count FROM departments WHERE id != ?').get(departmentId);
  if (remaining.count === 0) {
    return res.status(400).json({ message: 'Cannot delete the only remaining department.' });
  }

  // Find all tasks under this department and purge permanently
  const deptTasks = db.prepare('SELECT id FROM tasks WHERE department_id = ?').all(departmentId);
  const purgedTasksCount = purgeTasksPermanently(deptTasks.map(t => t.id));

  // Find and delete all projects under this department (and their tasks if any)
  const deptProjects = db.prepare('SELECT id FROM projects WHERE department_id = ?').all(departmentId);
  for (const proj of deptProjects) {
    const projTasks = db.prepare('SELECT id FROM tasks WHERE project_id = ?').all(proj.id);
    purgeTasksPermanently(projTasks.map(t => t.id));
    db.prepare('DELETE FROM projects WHERE id = ?').run(proj.id);
  }

  // Unlink department references from any remaining users
  db.prepare('UPDATE users SET department_id = NULL WHERE department_id = ?').run(departmentId);

  // Delete the department permanently
  db.prepare('DELETE FROM departments WHERE id = ?').run(departmentId);

  logSystemAction({
    userId: req.user ? req.user.id : null,
    userName: req.user ? req.user.name : 'Admin',
    role: req.user ? req.user.role : 'Admin',
    action: 'DELETE_DEPARTMENT',
    entityType: 'Department',
    entityId: departmentId,
    details: `Deleted department "${dept.name}" and purged ${purgedTasksCount} associated task(s)`
  });

  res.json({
    message: `Department "${dept.name}" and ${purgedTasksCount} associated task(s) were permanently deleted from the database.`
  });
});

// Get projects
router.get('/projects', authenticateUser, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, d.name as department_name, 
      COUNT(t.id) as total_tasks,
      COALESCE(SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END), 0) as in_progress_tasks,
      COALESCE(SUM(CASE WHEN t.status = 'On Hold' THEN 1 ELSE 0 END), 0) as on_hold_tasks,
      COALESCE(SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END), 0) as completed_tasks,
      COALESCE(SUM(CASE WHEN t.status = 'Not Started' THEN 1 ELSE 0 END), 0) as not_started_tasks,
      COALESCE(SUM(CASE WHEN t.status = 'Overdue' OR (t.due_date < date('now') AND t.status != 'Completed') THEN 1 ELSE 0 END), 0) as overdue_tasks
    FROM projects p
    LEFT JOIN departments d ON p.department_id = d.id
    LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
    GROUP BY p.id
    ORDER BY p.name ASC
  `).all();
  res.json({ projects });
});

// Create a new project (Admin & Manager only)
router.post('/projects', authenticateUser, requireRole('Admin', 'Manager'), uploadProjectMedia.single('media_file'), (req, res) => {
  const { name, department_id, description, links, remarks } = req.body;
  let media = req.body.media || '';
  if (req.file) {
    media = `/uploads/${req.file.filename}`;
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Project name is required.' });
  }

  const existing = db.prepare('SELECT id FROM projects WHERE LOWER(name) = ?').get(name.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ message: 'A project with this name already exists.' });
  }

  const tableCols = db.prepare("PRAGMA table_info(projects)").all();
  const hasLinks = tableCols.some(c => c.name === 'links');

  if (hasLinks) {
    db.prepare(`
      INSERT INTO projects (name, department_id, description, links, media, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      department_id ? Number(department_id) : null,
      description ? description.trim() : '',
      links ? (typeof links === 'string' ? links.trim() : JSON.stringify(links)) : '',
      media ? media.trim() : '',
      remarks ? remarks.trim() : ''
    );
  } else {
    db.prepare(`
      INSERT INTO projects (name, department_id, description)
      VALUES (?, ?, ?)
    `).run(name.trim(), department_id ? Number(department_id) : null, description ? description.trim() : '');
  }

  const newProject = db.prepare(`
    SELECT p.*, d.name as department_name, 0 as total_tasks
    FROM projects p
    LEFT JOIN departments d ON p.department_id = d.id
    WHERE LOWER(p.name) = ?
  `).get(name.trim().toLowerCase());

  logSystemAction({
    userId: req.user ? req.user.id : null,
    userName: req.user ? req.user.name : 'Admin',
    role: req.user ? req.user.role : 'Admin',
    action: 'CREATE_PROJECT',
    entityType: 'Project',
    entityId: newProject ? newProject.id : null,
    details: `Created project "${newProject ? newProject.name : name.trim()}" (Department: ${newProject?.department_name || 'None'})`
  });

  // Dispatch Project Allocation Email if assigned to a specific department
  if (newProject && newProject.department_id) {
    try {
      const deptManagers = db.prepare(`
        SELECT id, name, email 
        FROM users 
        WHERE department_id = ? AND role IN ('Manager', 'Admin')
      `).all(newProject.department_id);

      for (const mgr of deptManagers) {
        if (mgr.email && !mgr.email.endsWith('@company.local')) {
          sendProjectAllocatedEmail({
            toEmail: mgr.email,
            recipientName: mgr.name,
            projectName: newProject.name,
            departmentName: newProject.department_name,
            description: newProject.description,
            allocatedByName: req.user ? req.user.name : 'Administrator',
            roleInTeam: 'Department Lead'
          }).catch(err => console.error('Failed to send project allocated email to dept lead:', err));
        }
      }
    } catch (mailErr) {
      console.error('Failed to dispatch department project allocated email:', mailErr);
    }
  }

  res.status(201).json({
    message: 'Project created successfully',
    project: newProject
  });
});

// Update an existing project (Admin & Manager only)
router.put('/projects/:id', authenticateUser, requireRole('Admin', 'Manager'), uploadProjectMedia.single('media_file'), (req, res) => {
  const projectId = req.params.id;
  const { name, department_id, description, links, remarks } = req.body;
  let media = req.body.media;
  if (req.file) {
    media = `/uploads/${req.file.filename}`;
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ message: 'Project not found.' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Project name is required.' });
  }

  // Check for duplicate name in other projects (case-insensitive)
  const existing = db.prepare('SELECT id FROM projects WHERE LOWER(name) = ? AND id != ?').get(name.trim().toLowerCase(), projectId);
  if (existing) {
    return res.status(400).json({ message: 'Another project with this name already exists.' });
  }

  const newDeptId = department_id !== undefined ? (department_id ? Number(department_id) : null) : project.department_id;
  const newDesc = description !== undefined ? description.trim() : (project.description || '');
  const newLinks = links !== undefined 
    ? (typeof links === 'string' ? links.trim() : JSON.stringify(links)) 
    : (project.links || '');
  const newMedia = media !== undefined ? media.trim() : (project.media || '');
  const newRemarks = remarks !== undefined ? remarks.trim() : (project.remarks || '');

  const tableCols = db.prepare("PRAGMA table_info(projects)").all();
  const hasLinks = tableCols.some(c => c.name === 'links');

  if (hasLinks) {
    db.prepare(`
      UPDATE projects
      SET name = ?, department_id = ?, description = ?, links = ?, media = ?, remarks = ?
      WHERE id = ?
    `).run(name.trim(), newDeptId, newDesc, newLinks, newMedia, newRemarks, projectId);
  } else {
    db.prepare(`
      UPDATE projects
      SET name = ?, department_id = ?, description = ?
      WHERE id = ?
    `).run(name.trim(), newDeptId, newDesc, projectId);
  }

  const updatedProject = db.prepare(`
    SELECT p.*, d.name as department_name, COUNT(t.id) as total_tasks
    FROM projects p
    LEFT JOIN departments d ON p.department_id = d.id
    LEFT JOIN tasks t ON t.project_id = p.id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(projectId);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'UPDATE_PROJECT',
    entityType: 'Project',
    entityId: projectId,
    details: `Updated project "${updatedProject ? updatedProject.name : name.trim()}"`
  });

  res.json({
    message: `Project "${name.trim()}" updated successfully.`,
    project: updatedProject
  });
});

// Delete a project permanently from database! (Admin & Manager only)
router.delete('/projects/:id', authenticateUser, (req, res) => {
  const userRole = (req.user?.role || '').toLowerCase();
  if (userRole !== 'admin' && userRole !== 'manager') {
    return res.status(403).json({ message: 'Forbidden. Only managers and administrators can delete projects.' });
  }

  const projectId = req.params.id;

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ message: 'Project not found.' });
  }

  // Find all tasks under this project and permanently purge from DB & storage
  const projTasks = db.prepare('SELECT id FROM tasks WHERE project_id = ?').all(projectId);
  const purgedTasksCount = purgeTasksPermanently(projTasks.map(t => t.id));

  // Permanently clean up relational project tables
  try {
    db.prepare("DELETE FROM project_shares WHERE project_id = ?").run(projectId);
  } catch (e) {
    // ignore if table doesn't exist
  }
  try {
    db.prepare("DELETE FROM team_projects WHERE project_id = ?").run(projectId);
  } catch (e) {}
  try {
    db.prepare("DELETE FROM project_removed_members WHERE project_id = ?").run(projectId);
  } catch (e) {}

  // Permanently delete project record
  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'DELETE_PROJECT',
    entityType: 'Project',
    entityId: projectId,
    details: `Deleted project "${project.name}" and purged ${purgedTasksCount} associated task(s)`
  });

  res.json({
    message: `Project "${project.name}" and ${purgedTasksCount} associated task(s) were permanently deleted from the database.`
  });
});

// Manager Reports endpoint
// Manager Reports endpoint
router.get('/reports', authenticateUser, requireRole('Manager'), (req, res) => {
  const { date_range, from_date, to_date, department_id, project_id } = req.query;

  const conditions = ['t.deleted_at IS NULL'];
  const params = [];

  const today = new Date().toISOString().split('T')[0];

  if (date_range === 'Today') {
    conditions.push('(t.assigned_date = ? OR t.due_date = ?)');
    params.push(today, today);
  } else if (date_range === 'This Week') {
    conditions.push("(t.assigned_date >= date('now', 'weekday 0', '-7 days') OR t.due_date >= date('now', 'weekday 0', '-7 days'))");
  } else if (date_range === 'This Month') {
    conditions.push("(t.assigned_date >= date('now', 'start of month') OR t.due_date >= date('now', 'start of month'))");
  } else if (date_range === 'Custom' && from_date && to_date) {
    conditions.push('((t.assigned_date BETWEEN ? AND ?) OR (t.due_date BETWEEN ? AND ?))');
    params.push(from_date, to_date, from_date, to_date);
  }

  if (department_id) {
    conditions.push('t.department_id = ?');
    params.push(Number(department_id));
  }

  if (project_id) {
    conditions.push('t.project_id = ?');
    params.push(Number(project_id));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Summary counts
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN t.status IN ('Not Started', 'On Hold') THEN 1 ELSE 0 END) as pending_tasks,
      SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tasks,
      SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN t.status = 'Overdue' OR (t.due_date < date('now') AND t.status != 'Completed') THEN 1 ELSE 0 END) as overdue_tasks,
      ROUND(COALESCE(SUM(t.estimated_hours), 0), 1) as total_estimated_hours,
      ROUND(COALESCE(SUM(CASE WHEN t.status != 'Completed' THEN t.estimated_hours ELSE 0 END), 0), 1) as active_estimated_hours,
      COUNT(DISTINCT t.assigned_to) as total_active_employees,
      COUNT(DISTINCT t.project_id) as total_active_projects
    FROM tasks t
    ${whereClause}
  `).get(...params);

  // Tasks by Status
  const tasksByStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM tasks t
    ${whereClause}
    GROUP BY status
  `).all(...params);

  // Tasks & Workload by Employee
  const tasksByEmployee = db.prepare(`
    SELECT u.id as employee_id,
           u.name as employee_name,
           u.email as employee_email,
           u.role as employee_role,
           COALESCE(u.title, u.role) as employee_title,
           d.name as department_name,
           COUNT(t.id) as total,
           SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
           SUM(CASE WHEN t.status IN ('Not Started', 'On Hold') THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN t.status = 'Overdue' OR (t.due_date < date('now') AND t.status != 'Completed') THEN 1 ELSE 0 END) as overdue,
           COUNT(DISTINCT t.project_id) as project_count,
           ROUND(COALESCE(SUM(t.estimated_hours), 0), 1) as total_estimated_hours,
           ROUND(COALESCE(SUM(CASE WHEN t.status != 'Completed' THEN t.estimated_hours ELSE 0 END), 0), 1) as active_estimated_hours
    FROM users u
    JOIN tasks t ON t.assigned_to = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.role IN ('Employee', 'Intern', 'Manager')
      AND ${conditions.join(' AND ')}
    GROUP BY u.id
    ORDER BY total DESC
  `).all(...params);

  // Detailed Employee Workload Broken Down by Assigned Project
  const employeeProjectWorkload = db.prepare(`
    SELECT u.id as employee_id,
           u.name as employee_name,
           u.email as employee_email,
           u.role as employee_role,
           COALESCE(u.title, u.role) as employee_title,
           d.name as department_name,
           p.id as project_id,
           COALESCE(p.name, 'Unassigned / Global') as project_name,
           COUNT(t.id) as total_tasks,
           SUM(CASE WHEN t.status IN ('Not Started', 'On Hold') THEN 1 ELSE 0 END) as pending_tasks,
           SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tasks,
           SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completed_tasks,
           SUM(CASE WHEN t.status = 'Overdue' OR (t.due_date < date('now') AND t.status != 'Completed') THEN 1 ELSE 0 END) as overdue_tasks,
           ROUND(COALESCE(SUM(t.estimated_hours), 0), 1) as total_estimated_hours,
           ROUND(COALESCE(SUM(CASE WHEN t.status != 'Completed' THEN t.estimated_hours ELSE 0 END), 0), 1) as active_estimated_hours
    FROM users u
    JOIN tasks t ON t.assigned_to = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.role IN ('Employee', 'Intern', 'Manager')
      AND ${conditions.join(' AND ')}
    GROUP BY u.id, p.id
    ORDER BY u.name ASC, total_tasks DESC
  `).all(...params);

  // Tasks by Department
  const tasksByDepartment = db.prepare(`
    SELECT d.id as department_id, d.name as department_name, COUNT(t.id) as count,
           SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
           SUM(CASE WHEN t.status = 'Overdue' OR (t.due_date < date('now') AND t.status != 'Completed') THEN 1 ELSE 0 END) as overdue
    FROM departments d
    LEFT JOIN tasks t ON t.department_id = d.id AND ${conditions.join(' AND ')}
    GROUP BY d.id
    HAVING count > 0
    ORDER BY count DESC
  `).all(...params);

  // Tasks by Project with member counts & hours
  const tasksByProject = db.prepare(`
    SELECT p.id as project_id,
           p.name as project_name,
           d.name as department_name,
           COUNT(t.id) as count,
           SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
           SUM(CASE WHEN t.status IN ('Not Started', 'On Hold') THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN t.status = 'Overdue' OR (t.due_date < date('now') AND t.status != 'Completed') THEN 1 ELSE 0 END) as overdue,
           COUNT(DISTINCT t.assigned_to) as assigned_members_count,
           ROUND(COALESCE(SUM(t.estimated_hours), 0), 1) as total_estimated_hours
    FROM projects p
    LEFT JOIN departments d ON p.department_id = d.id
    LEFT JOIN tasks t ON t.project_id = p.id AND ${conditions.join(' AND ')}
    GROUP BY p.id
    HAVING count > 0
    ORDER BY count DESC
  `).all(...params);

  // Tasks by Priority
  const tasksByPriority = db.prepare(`
    SELECT priority, COUNT(*) as count
    FROM tasks t
    ${whereClause}
    GROUP BY priority
  `).all(...params);

  // Previous Members who were removed from projects
  const prevMemberConditions = [];
  const prevMemberParams = [];

  if (project_id) {
    prevMemberConditions.push('prm.project_id = ?');
    prevMemberParams.push(Number(project_id));
  }
  if (department_id) {
    prevMemberConditions.push('u.department_id = ?');
    prevMemberParams.push(Number(department_id));
  }

  const prevWhere = prevMemberConditions.length > 0 ? `WHERE ${prevMemberConditions.join(' AND ')}` : '';

  const rawPreviousMembers = db.prepare(`
    SELECT prm.id as removal_id,
           prm.id,
           prm.project_id,
           prm.user_id as employee_id,
           prm.removed_at,
           prm.unassigned_task_count,
           prm.unassigned_task_ids,
           prm.deliverables_snapshot,
           prm.notes,
           u.name as employee_name,
           u.email as employee_email,
           u.role as employee_role,
           COALESCE(u.title, u.role) as employee_title,
           u.avatar as employee_avatar,
           d.name as department_name,
           p.name as project_name,
           remover.name as removed_by_name
    FROM project_removed_members prm
    JOIN users u ON prm.user_id = u.id
    JOIN projects p ON prm.project_id = p.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN users remover ON prm.removed_by = remover.id
    ${prevWhere}
    ORDER BY prm.removed_at DESC
  `).all(...prevMemberParams);

  const previousMembers = rawPreviousMembers.map(row => {
    let taskIds = [];
    let snapshotTasks = [];
    try {
      if (row.unassigned_task_ids) taskIds = JSON.parse(row.unassigned_task_ids);
      if (row.deliverables_snapshot) snapshotTasks = JSON.parse(row.deliverables_snapshot);
    } catch (e) {}

    // Fetch current tasks for those IDs or fallback to snapshot
    let tasks = [];
    if (Array.isArray(taskIds) && taskIds.length > 0) {
      const placeholders = taskIds.map(() => '?').join(',');
      tasks = db.prepare(`
        SELECT t.id, t.task_id, t.title, t.status, t.priority, t.estimated_hours, t.assigned_to, t.due_date, t.completed_date,
               u.name as current_assigned_name
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.id IN (${placeholders})
      `).all(...taskIds);
    }

    if (!tasks || tasks.length === 0) {
      tasks = snapshotTasks;
    }

    // Calculate aggregated metrics for this previous member's deliverables in this project
    const total_tasks = tasks.length || row.unassigned_task_count || 0;
    const completed_tasks = tasks.filter(t => t.status === 'Completed').length;
    const in_progress_tasks = tasks.filter(t => t.status === 'In Progress').length;
    const pending_tasks = tasks.filter(t => t.status === 'Not Started' || t.status === 'On Hold').length;
    const overdue_tasks = tasks.filter(t => t.status === 'Overdue' || (t.due_date && t.due_date < today && t.status !== 'Completed')).length;
    const total_estimated_hours = Math.round(tasks.reduce((sum, t) => sum + Number(t.estimated_hours || 0), 0) * 10) / 10;
    const active_estimated_hours = Math.round(tasks.filter(t => t.status !== 'Completed').reduce((sum, t) => sum + Number(t.estimated_hours || 0), 0) * 10) / 10;

    return {
      ...row,
      total_tasks,
      completed_tasks,
      in_progress_tasks,
      pending_tasks,
      overdue_tasks,
      total_estimated_hours,
      active_estimated_hours,
      tasks
    };
  });

  // Filter option lists
  const availableProjects = db.prepare('SELECT id, name FROM projects ORDER BY name ASC').all();
  const availableDepartments = db.prepare('SELECT id, name FROM departments ORDER BY name ASC').all();

  res.json({
    summary,
    tasksByStatus,
    tasksByEmployee,
    employeeProjectWorkload,
    tasksByDepartment,
    tasksByProject,
    tasksByPriority,
    availableProjects,
    availableDepartments,
    previousMembers
  });
});

// REMOVE EMPLOYEE FROM PROJECT (Unassign tasks, clear dependencies, and record removal history)
router.delete('/reports/employees/:employeeId/projects/:projectId', authenticateUser, (req, res) => {
  try {
    const { employeeId, projectId } = req.params;
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(employeeId);
    const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(projectId);

    if (!user) {
      return res.status(404).json({ message: 'Employee not found.' });
    }
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // Find all tasks assigned to this employee in this project
    const tasksToUnassign = db.prepare(`
      SELECT id, task_id, title, status, priority, estimated_hours, assigned_date, start_date, due_date, completed_date
      FROM tasks 
      WHERE project_id = ? AND assigned_to = ? AND deleted_at IS NULL
    `).all(projectId, employeeId);

    const unassignedCount = tasksToUnassign.length;
    const taskIds = tasksToUnassign.map(t => t.id);

    // Record removal in project_removed_members
    db.prepare(`
      INSERT INTO project_removed_members (project_id, user_id, removed_by, removed_at, unassigned_task_count, unassigned_task_ids, deliverables_snapshot, notes)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
    `).run(
      Number(projectId),
      Number(employeeId),
      req.user.id,
      unassignedCount,
      JSON.stringify(taskIds),
      JSON.stringify(tasksToUnassign),
      `Removed by ${req.user.name}`
    );

    // Log to task_history for each task
    for (const t of tasksToUnassign) {
      try {
        db.prepare(`
          INSERT INTO task_history (task_id, user_id, user_name, action, old_value, new_value)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(t.id, req.user.id, req.user.name, 'Unassigned from Member', `Assigned to: ${user.name}`, 'Unassigned (Member Removed from Project)');
      } catch (hErr) {}
    }

    // Unassign tasks from this employee for this project
    db.prepare('UPDATE tasks SET assigned_to = NULL, last_updated = CURRENT_TIMESTAMP WHERE project_id = ? AND assigned_to = ?').run(projectId, employeeId);

    // Remove any task dependencies for this employee on tasks in this project
    db.prepare(`
      DELETE FROM task_dependencies 
      WHERE user_id = ? AND task_id IN (SELECT id FROM tasks WHERE project_id = ?)
    `).run(employeeId, projectId);

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'REMOVE_EMPLOYEE_FROM_PROJECT',
      entityType: 'Project',
      entityId: Number(projectId),
      details: `Removed ${user.name} from project "${project.name}" (unassigned ${unassignedCount} deliverables)`
    });

    res.json({
      message: `Successfully removed ${user.name} from project "${project.name}". ${unassignedCount} tasks unassigned.`,
      unassignedCount
    });
  } catch (err) {
    console.error('Failed to remove employee from project:', err);
    res.status(500).json({ message: 'Failed to remove employee from project' });
  }
});

// RESTORE EMPLOYEE TO PROJECT (Reassign unassigned deliverables back to member)
router.post('/reports/employees/:employeeId/projects/:projectId/restore', authenticateUser, (req, res) => {
  try {
    const { employeeId, projectId } = req.params;
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(employeeId);
    const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(projectId);

    if (!user) return res.status(404).json({ message: 'Employee not found.' });
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    const removal = db.prepare('SELECT * FROM project_removed_members WHERE project_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1').get(projectId, employeeId);
    let reassignedCount = 0;

    if (removal && removal.unassigned_task_ids) {
      try {
        const taskIds = JSON.parse(removal.unassigned_task_ids);
        if (Array.isArray(taskIds)) {
          for (const tid of taskIds) {
            const t = db.prepare('SELECT id, assigned_to FROM tasks WHERE id = ? AND project_id = ?').get(tid, projectId);
            if (t && (t.assigned_to === null || t.assigned_to === Number(employeeId))) {
              db.prepare('UPDATE tasks SET assigned_to = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(employeeId, tid);
              reassignedCount++;
            }
          }
        }
      } catch (e) {}
    }

    db.prepare('DELETE FROM project_removed_members WHERE project_id = ? AND user_id = ?').run(projectId, employeeId);

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'RESTORE_EMPLOYEE_TO_PROJECT',
      entityType: 'Project',
      entityId: Number(projectId),
      details: `Restored ${user.name} to project "${project.name}" (reassigned ${reassignedCount} deliverables)`
    });

    res.json({
      message: `Successfully restored ${user.name} to project "${project.name}". ${reassignedCount} deliverables reassigned.`,
      reassignedCount
    });
  } catch (err) {
    console.error('Failed to restore employee to project:', err);
    res.status(500).json({ message: 'Failed to restore employee to project' });
  }
});

// DELETE RECORD FROM PREVIOUS MEMBERS LIST
router.delete('/reports/previous-members/:recordId', authenticateUser, (req, res) => {
  try {
    const { recordId } = req.params;
    const record = db.prepare(`
      SELECT prm.*, u.name as user_name, p.name as project_name
      FROM project_removed_members prm
      LEFT JOIN users u ON prm.user_id = u.id
      LEFT JOIN projects p ON prm.project_id = p.id
      WHERE prm.id = ?
    `).get(recordId);

    if (!record) {
      return res.status(404).json({ message: 'Previous member record not found.' });
    }

    db.prepare('DELETE FROM project_removed_members WHERE id = ?').run(recordId);

    logSystemAction({
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'System',
      role: req.user ? req.user.role : 'Admin',
      action: 'DELETE_PREVIOUS_MEMBER_RECORD',
      entityType: 'Project',
      entityId: record.project_id,
      details: `Deleted historical record of ${record.user_name || 'member'} from previous members list for project "${record.project_name || 'Unknown'}"`
    });

    res.json({ message: `Successfully removed ${record.user_name || 'member'} from previous members list.` });
  } catch (err) {
    console.error('Failed to delete previous member record:', err);
    res.status(500).json({ message: 'Failed to delete record from previous members list' });
  }
});



// Admin System-wide stats endpoint
router.get('/admin/stats', authenticateUser, (req, res) => {
  try {
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count || 0;
    const totalEmployeesOnly = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Employee' AND (title IS NULL OR title != 'Intern')").get().count || 0;
    const totalInterns = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Intern' OR title = 'Intern'").get().count || 0;
    const totalEmployeesAndInterns = totalEmployeesOnly + totalInterns;
    const totalAdmins = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Admin'").get().count || 0;
    const totalDepartments = db.prepare("SELECT COUNT(*) as count FROM departments").get().count || 0;
    const totalProjects = db.prepare("SELECT COUNT(*) as count FROM projects").get().count || 0;

    const taskStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'On Hold' THEN 1 ELSE 0 END) as on_hold,
        SUM(CASE WHEN status = 'Overdue' OR (due_date < date('now') AND status != 'Completed') THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status = 'Not Started' THEN 1 ELSE 0 END) as not_started
      FROM tasks
      WHERE deleted_at IS NULL
    `).get();

    res.json({
      stats: {
        totalUsers,
        totalEmployees: totalEmployeesOnly,
        totalInterns,
        totalEmployeesAndInterns,
        totalAdmins,
        totalDepartments,
        totalProjects,
        totalTasks: taskStats?.total || 0,
        inProgressTasks: taskStats?.in_progress || 0,
        onHoldTasks: taskStats?.on_hold || 0,
        completedTasks: taskStats?.completed || 0,
        overdueTasks: taskStats?.overdue || 0,
        notStartedTasks: taskStats?.not_started || 0
      }
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
});

export default router;
