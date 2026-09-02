import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get list of managers
router.get('/managers', (req, res) => {
  const managers = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.role = 'Manager'
    ORDER BY u.name ASC
  `).all();
  res.json({ managers });
});

// Create new manager
router.post('/managers', (req, res) => {
  const { name, email, department_id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Manager name is required.' });
  }

  let cleanEmail = '';
  if (email && email.trim()) {
    cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ message: 'A user with this email address already exists.' });
    }
  } else {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'manager';
    cleanEmail = `${slug}.${Date.now().toString(36)}@company.local`;
  }

  const hashedPassword = bcrypt.hashSync('password123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password, role, department_id)
    VALUES (?, ?, ?, 'Manager', ?)
  `).run(name.trim(), cleanEmail, hashedPassword, department_id || 1);

  const newManager = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.email = ?
  `).get(cleanEmail);

  res.status(201).json({
    message: 'Manager profile created successfully',
    manager: newManager
  });
});

// Delete a manager
router.delete('/managers/:id', (req, res) => {
  const managerId = req.params.id;

  const manager = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'Manager'").get(managerId);
  if (!manager) {
    return res.status(404).json({ message: 'Manager not found.' });
  }

  // Prevent deleting the last remaining manager
  const remaining = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Manager' AND id != ?").get(managerId);
  if (remaining.count === 0) {
    return res.status(400).json({ message: 'Cannot delete the only remaining manager.' });
  }

  // Clean up tasks and associated records assigned by this manager
  db.prepare("DELETE FROM task_history WHERE task_id IN (SELECT id FROM tasks WHERE assigned_by = ?)").run(managerId);
  db.prepare("DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE assigned_by = ?)").run(managerId);
  db.prepare("DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE assigned_by = ?)").run(managerId);
  db.prepare("DELETE FROM tasks WHERE assigned_by = ?").run(managerId);

  // Delete manager user record
  db.prepare("DELETE FROM users WHERE id = ?").run(managerId);

  res.json({
    message: `Manager ${manager.name} deleted successfully.`
  });
});

// Get list of employees
router.get('/employees', authenticateUser, (req, res) => {
  const employees = db.prepare(`
    SELECT u.id, u.name, u.email, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.role = 'Employee'
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

// Delete an employee / intern
router.delete('/employees/:id', (req, res) => {
  const employeeId = req.params.id;

  const emp = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'Employee'").get(employeeId);
  if (!emp) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  // Delete tasks assigned to this employee or associated comments / attachments
  db.prepare("DELETE FROM task_history WHERE task_id IN (SELECT id FROM tasks WHERE assigned_to = ?)").run(employeeId);
  db.prepare("DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE assigned_to = ?)").run(employeeId);
  db.prepare("DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE assigned_to = ?)").run(employeeId);
  db.prepare("DELETE FROM tasks WHERE assigned_to = ?").run(employeeId);

  // Delete employee user record
  db.prepare("DELETE FROM users WHERE id = ?").run(employeeId);

  res.json({
    message: `${emp.title || 'Employee'} ${emp.name} deleted successfully.`
  });
});

// Get departments
router.get('/departments', authenticateUser, (req, res) => {
  const departments = db.prepare(`
    SELECT d.*, COUNT(CASE WHEN u.role = 'Employee' THEN 1 END) as total_users
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

// Delete a department
router.delete('/departments/:id', (req, res) => {
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

  // Unlink department references
  db.prepare('UPDATE users SET department_id = NULL WHERE department_id = ?').run(departmentId);
  db.prepare('UPDATE projects SET department_id = NULL WHERE department_id = ?').run(departmentId);
  db.prepare('UPDATE tasks SET department_id = NULL WHERE department_id = ?').run(departmentId);

  // Delete the department
  db.prepare('DELETE FROM departments WHERE id = ?').run(departmentId);

  res.json({
    message: `Department ${dept.name} deleted successfully.`
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

// Delete a project
router.delete('/projects/:id', (req, res) => {
  const projectId = req.params.id;

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ message: 'Project not found.' });
  }

  // Clean up tasks associated with this project
  db.prepare("DELETE FROM task_history WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)").run(projectId);
  db.prepare("DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)").run(projectId);
  db.prepare("DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)").run(projectId);
  db.prepare("DELETE FROM tasks WHERE project_id = ?").run(projectId);

  // Delete project record
  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);

  res.json({
    message: `Project ${project.name} deleted successfully.`
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

export default router;
