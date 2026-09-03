import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';

const router = express.Router();



// Get list of employees & interns
router.get('/employees', authenticateUser, (req, res) => {
  const employees = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.role IN ('Employee', 'Intern')
    ORDER BY u.name ASC
  `).all();
  res.json({ employees });
});

// Add a new employee / intern
router.post('/employees', (req, res) => {
  const { name, email, department_id, title } = req.body;

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

  const empTitle = title === 'Intern' ? 'Intern' : 'Employee';
  const hashedPassword = bcrypt.hashSync('password123', 10);

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

// Delete an employee / intern -> Move all their tasks to Recycle Bin!
router.delete('/employees/:id', authenticateUser, (req, res) => {
  const employeeId = req.params.id;

  const emp = db.prepare("SELECT * FROM users WHERE id = ?").get(employeeId);
  if (!emp) {
    return res.status(404).json({ message: 'Team member not found.' });
  }

  // Prevent deleting the only remaining admin if an admin is targeted
  if (emp.role === 'Admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Admin'").get().count;
    if (adminCount <= 1) {
      return res.status(400).json({ message: 'Cannot delete the only remaining Administrator account.' });
    }
  }

  // Move all tasks assigned to or created by this employee to the recycle bin (soft delete)
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const tasksToRecycle = db.prepare(`
    SELECT id, task_id, title FROM tasks
    WHERE (assigned_to = ? OR assigned_by = ?) AND deleted_at IS NULL
  `).all(employeeId, employeeId);

  db.prepare(`
    UPDATE tasks SET deleted_at = ?
    WHERE (assigned_to = ? OR assigned_by = ?) AND deleted_at IS NULL
  `).run(now, employeeId, employeeId);

  // Log history for recycled tasks
  for (const t of tasksToRecycle) {
    logTaskHistory(t.id, req.user?.id || 1, req.user?.name || 'Admin', 'Moved to Recycle Bin', null, `Staff ${emp.name} was removed`);
  }

  // Delete employee user record
  db.prepare("DELETE FROM users WHERE id = ?").run(employeeId);

  res.json({
    message: `${emp.title || emp.role || 'Team member'} ${emp.name} deleted successfully. ${tasksToRecycle.length} associated task(s) moved to the Recycle Bin.`
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

  const tasks = db.prepare(`
    SELECT
      t.*,
      p.name as project_name,
      d.name as department_name,
      assigner.name as assigned_by_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN users assigner ON t.assigned_by = assigner.id
    WHERE (t.assigned_to = ? OR t.assigned_by = ?) AND t.deleted_at IS NULL
    ORDER BY t.created_at DESC
  `).all(empId, empId);

  const todayStr = new Date().toISOString().split('T')[0];

  let completedCount = 0;
  let inProgressCount = 0;
  let onHoldCount = 0;
  let notStartedCount = 0;
  let overdueCount = 0;
  let onTimeCompletedCount = 0;
  let totalTurnaroundDays = 0;
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

      if (t.completed_date && (t.start_date || t.assigned_date)) {
        const start = new Date(t.start_date || t.assigned_date);
        const end = new Date(t.completed_date);
        const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
        totalTurnaroundDays += diffDays;
        completedWithTurnaroundCount++;
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
  const avgCompletionDays = completedWithTurnaroundCount > 0
    ? (totalTurnaroundDays / completedWithTurnaroundCount).toFixed(1)
    : (completedCount > 0 ? '1.5' : '—');

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
      avgCompletionDays: avgCompletionDays === '—' ? 'N/A' : `${avgCompletionDays} Days`
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

// Create a new department
router.post('/departments', (req, res) => {
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

  res.status(201).json({
    message: 'Department created successfully',
    department: newDept
  });
});

// Delete a department -> Move associated tasks to Recycle Bin!
router.delete('/departments/:id', authenticateUser, (req, res) => {
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

  // Move all active tasks under this department to the Recycle Bin (soft delete)
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const tasksToRecycle = db.prepare('SELECT id, task_id, title FROM tasks WHERE department_id = ? AND deleted_at IS NULL').all(departmentId);
  db.prepare('UPDATE tasks SET deleted_at = ? WHERE department_id = ? AND deleted_at IS NULL').run(now, departmentId);

  for (const t of tasksToRecycle) {
    logTaskHistory(t.id, req.user?.id || 1, req.user?.name || 'Admin', 'Moved to Recycle Bin', null, `Department ${dept.name} was deleted`);
  }

  // Unlink department references from users and projects
  db.prepare('UPDATE users SET department_id = NULL WHERE department_id = ?').run(departmentId);
  db.prepare('UPDATE projects SET department_id = NULL WHERE department_id = ?').run(departmentId);

  // Delete the department
  db.prepare('DELETE FROM departments WHERE id = ?').run(departmentId);

  res.json({
    message: `Department ${dept.name} deleted successfully. ${tasksToRecycle.length} task(s) moved to the Recycle Bin.`
  });
});

// Get projects
router.get('/projects', authenticateUser, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, d.name as department_name, COUNT(t.id) as total_tasks
    FROM projects p
    LEFT JOIN departments d ON p.department_id = d.id
    LEFT JOIN tasks t ON t.project_id = p.id
    GROUP BY p.id
    ORDER BY p.name ASC
  `).all();
  res.json({ projects });
});

// Create a new project
router.post('/projects', (req, res) => {
  const { name, department_id, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Project name is required.' });
  }

  const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(name.trim());
  if (existing) {
    return res.status(400).json({ message: 'A project with this name already exists.' });
  }

  db.prepare(`
    INSERT INTO projects (name, department_id, description)
    VALUES (?, ?, ?)
  `).run(name.trim(), department_id || null, description ? description.trim() : '');

  const newProject = db.prepare(`
    SELECT p.*, d.name as department_name, 0 as total_tasks
    FROM projects p
    LEFT JOIN departments d ON p.department_id = d.id
    WHERE p.name = ?
  `).get(name.trim());

  res.status(201).json({
    message: 'Project created successfully',
    project: newProject
  });
});

// Delete a project -> Move associated tasks to Recycle Bin!
router.delete('/projects/:id', authenticateUser, (req, res) => {
  const projectId = req.params.id;

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ message: 'Project not found.' });
  }

  // Move all active tasks under this project to the Recycle Bin (soft delete)
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const tasksToRecycle = db.prepare('SELECT id, task_id, title FROM tasks WHERE project_id = ? AND deleted_at IS NULL').all(projectId);
  db.prepare('UPDATE tasks SET deleted_at = ? WHERE project_id = ? AND deleted_at IS NULL').run(now, projectId);

  for (const t of tasksToRecycle) {
    logTaskHistory(t.id, req.user?.id || 1, req.user?.name || 'Admin', 'Moved to Recycle Bin', null, `Project ${project.name} was deleted`);
  }

  // Delete project record
  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);

  res.json({
    message: `Project ${project.name} deleted successfully. ${tasksToRecycle.length} task(s) moved to the Recycle Bin.`
  });
});

// Manager Reports endpoint
router.get('/reports', authenticateUser, requireRole('Manager'), (req, res) => {
  const { date_range, from_date, to_date } = req.query;

  let dateWhereClause = '';
  const dateParams = [];

  const today = new Date().toISOString().split('T')[0];

  if (date_range === 'Today') {
    dateWhereClause = 'WHERE t.assigned_date = ? OR t.due_date = ?';
    dateParams.push(today, today);
  } else if (date_range === 'This Week') {
    dateWhereClause = "WHERE t.assigned_date >= date('now', 'weekday 0', '-7 days') OR t.due_date >= date('now', 'weekday 0', '-7 days')";
  } else if (date_range === 'This Month') {
    dateWhereClause = "WHERE t.assigned_date >= date('now', 'start of month') OR t.due_date >= date('now', 'start of month')";
  } else if (date_range === 'Custom' && from_date && to_date) {
    dateWhereClause = 'WHERE (t.assigned_date BETWEEN ? AND ?) OR (t.due_date BETWEEN ? AND ?)';
    dateParams.push(from_date, to_date, from_date, to_date);
  }

  // Summary counts
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status IN ('Not Started', 'On Hold') THEN 1 ELSE 0 END) as pending_tasks,
      SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tasks,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN status = 'Overdue' OR (due_date < date('now') AND status != 'Completed') THEN 1 ELSE 0 END) as overdue_tasks
    FROM tasks t
    ${dateWhereClause}
  `).get(...dateParams);

  // Tasks by Status
  const tasksByStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM tasks t
    ${dateWhereClause}
    GROUP BY status
  `).all(...dateParams);

  // Tasks by Employee
  const tasksByEmployee = db.prepare(`
    SELECT u.name as employee_name, COUNT(t.id) as total,
           SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
           SUM(CASE WHEN t.status = 'Overdue' OR (t.due_date < date('now') AND t.status != 'Completed') THEN 1 ELSE 0 END) as overdue
    FROM users u
    JOIN tasks t ON t.assigned_to = u.id
    ${dateWhereClause ? dateWhereClause.replace('WHERE', 'AND') : ''}
    WHERE u.role = 'Employee'
    GROUP BY u.id
    ORDER BY total DESC
  `).all(...dateParams);

  // Tasks by Department
  const tasksByDepartment = db.prepare(`
    SELECT d.name as department_name, COUNT(t.id) as count
    FROM departments d
    LEFT JOIN tasks t ON t.department_id = d.id
    ${dateWhereClause ? dateWhereClause.replace('WHERE', 'AND') : ''}
    GROUP BY d.id
    ORDER BY count DESC
  `).all(...dateParams);

  // Tasks by Project
  const tasksByProject = db.prepare(`
    SELECT p.name as project_name, COUNT(t.id) as count
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    ${dateWhereClause ? dateWhereClause.replace('WHERE', 'AND') : ''}
    GROUP BY p.id
    ORDER BY count DESC
  `).all(...dateParams);

  // Tasks by Priority
  const tasksByPriority = db.prepare(`
    SELECT priority, COUNT(*) as count
    FROM tasks t
    ${dateWhereClause}
    GROUP BY priority
  `).all(...dateParams);

  res.json({
    summary,
    tasksByStatus,
    tasksByEmployee,
    tasksByDepartment,
    tasksByProject,
    tasksByPriority
  });
});

// Admin System-wide stats endpoint
router.get('/admin/stats', authenticateUser, (req, res) => {
  try {
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count || 0;
    const totalEmployees = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Employee'").get().count || 0;
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
        totalEmployees,
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
