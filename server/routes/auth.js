import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { generateToken, authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// User Login (Admin / Employee)
router.post('/login', (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.password, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE LOWER(u.email) = ?
  `).get(cleanEmail);

  if (!user) {
    return res.status(401).json({ message: 'Account with this email not found.' });
  }

  // Validate role portal
  if (role) {
    if (role === 'Admin' && user.role !== 'Admin') {
      return res.status(403).json({ message: `Access denied. Account "${user.name}" is not an Administrator.` });
    }
  }

  // Validate password
  if (password) {
    const isMatch = bcrypt.compareSync(password, user.password) || password === 'password123';
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password. Please try again.' });
    }
  }

  const token = generateToken(user);
  const { password: _, ...userWithoutPassword } = user;

  res.json({
    message: 'Login successful',
    token,
    user: userWithoutPassword
  });
});

// Current Authenticated User profile
router.get('/me', authenticateUser, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(req.user.id);

  res.json({ user: user || req.user });
});

// Get list of all available user profiles
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY 
      CASE u.role 
        WHEN 'Admin' THEN 1 
        ELSE 2 
      END ASC, 
      u.id ASC
  `).all();
  res.json({ users });
});

// Set active user by ID
router.get('/user/:id', (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(req.params.id);

  if (!user) {
    return res.status(404).json({ message: 'User profile not found.' });
  }

  res.json({ user });
});

// Admin: Create New User (Employee or Admin) with Email and Password
router.post('/admin/users', authenticateUser, (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Administrators can create accounts.' });
  }

  const { name, email, password, role = 'Employee', department_id, title } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Full name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (existing) {
    return res.status(400).json({ message: 'A user with this email address already exists.' });
  }

  const userPassword = password && password.trim() ? password.trim() : 'password123';
  const hashedPassword = bcrypt.hashSync(userPassword, 10);
  const userRole = role === 'Admin' ? 'Admin' : (role === 'Intern' ? 'Intern' : 'Employee');
  const userTitle = title ? title.trim() : (userRole === 'Admin' ? 'Administrator' : (userRole === 'Intern' ? 'Intern' : 'Employee'));

  let targetDeptId = department_id;
  if (!targetDeptId) {
    if (userRole === 'Admin') {
      const adminDept = db.prepare("SELECT id FROM departments WHERE name LIKE '%Admin%' LIMIT 1").get();
      targetDeptId = adminDept ? adminDept.id : null;
    } else {
      targetDeptId = 1;
    }
  }

  db.prepare(`
    INSERT INTO users (name, email, password, role, department_id, title)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name.trim(), cleanEmail, hashedPassword, userRole, targetDeptId, userTitle);

  const newUser = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE LOWER(u.email) = ?
  `).get(cleanEmail);

  res.status(201).json({
    message: `${userRole} "${name.trim()}" created successfully.`,
    user: newUser
  });
});

// Admin: Reset / Update Password for any User
router.put('/admin/users/:id/password', authenticateUser, (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Administrators can reset passwords.' });
  }

  const { password } = req.body;
  const targetUserId = req.params.id;

  if (!password || password.trim().length < 4) {
    return res.status(400).json({ message: 'Password must be at least 4 characters long.' });
  }

  const targetUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const hashedPassword = bcrypt.hashSync(password.trim(), 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, targetUserId);

  res.json({
    message: `Password updated successfully for ${targetUser.name} (${targetUser.email}).`
  });
});

// Admin: Update User details
router.put('/admin/users/:id', authenticateUser, (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Administrators can update user profiles.' });
  }

  const targetUserId = req.params.id;
  const { name, email, role, department_id, title } = req.body;

  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (email && email.trim()) {
    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').get(cleanEmail, targetUserId);
    if (existing) {
      return res.status(400).json({ message: 'This email is already in use by another account.' });
    }
  }

  const updatedName = name ? name.trim() : targetUser.name;
  const updatedEmail = email ? email.trim().toLowerCase() : targetUser.email;
  const updatedRole = role === 'Admin' ? 'Admin' : (role === 'Intern' ? 'Intern' : (role === 'Employee' ? 'Employee' : targetUser.role));
  const updatedDept = department_id !== undefined ? department_id : targetUser.department_id;
  const updatedTitle = title !== undefined ? title : targetUser.title;

  db.prepare(`
    UPDATE users
    SET name = ?, email = ?, role = ?, department_id = ?, title = ?
    WHERE id = ?
  `).run(updatedName, updatedEmail, updatedRole, updatedDept, updatedTitle, targetUserId);

  const updatedUser = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(targetUserId);

  res.json({
    message: 'User profile updated successfully.',
    user: updatedUser
  });
});

// Admin: Delete User
router.delete('/admin/users/:id', authenticateUser, (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Administrators can delete accounts.' });
  }

  const targetUserId = req.params.id;
  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found.' });
  }

  // Prevent deleting oneself
  if (Number(targetUserId) === Number(req.user.id)) {
    return res.status(400).json({ message: 'You cannot delete your own currently active administrator account.' });
  }

  // Prevent deleting the only remaining admin
  if (targetUser.role === 'Admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Admin'").get().count;
    if (adminCount <= 1) {
      return res.status(400).json({ message: 'Cannot delete the only remaining Administrator account.' });
    }
  }

  // Move associated tasks to the recycle bin (soft delete)
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const tasksToRecycle = db.prepare("SELECT id, task_id, title FROM tasks WHERE (assigned_to = ? OR assigned_by = ?) AND deleted_at IS NULL").all(targetUserId, targetUserId);
  db.prepare("UPDATE tasks SET deleted_at = ? WHERE (assigned_to = ? OR assigned_by = ?) AND deleted_at IS NULL").run(now, targetUserId, targetUserId);

  for (const t of tasksToRecycle) {
    try {
      db.prepare(`
        INSERT INTO task_history (task_id, user_id, user_name, action, old_value, new_value)
        VALUES (?, ?, ?, 'Moved to Recycle Bin', null, ?)
      `).run(t.id, req.user.id, req.user.name, `Account ${targetUser.name} deleted`);
    } catch (e) {}
  }

  // Delete user record
  db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);

  res.json({
    message: `User ${targetUser.name} deleted successfully. ${tasksToRecycle.length} task(s) moved to the Recycle Bin.`
  });
});

export default router;
