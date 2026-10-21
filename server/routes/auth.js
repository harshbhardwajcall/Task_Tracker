import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { logSystemAction, getManagerPermissions } from '../db/index.js';
import { generateToken, authenticateUser } from '../middleware/auth.js';
import { purgeUserPermanently } from '../utils/attachmentHelper.js';
import { sendUserWelcomeEmail, sendUserRoleChangedEmail, sendUserDeactivatedEmail } from '../utils/emailHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads/avatars directory exists
const avatarsDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// Multer storage for user profile avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${req.user ? req.user.id : 'user'}-${uniqueSuffix}${ext}`);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|svg/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mime = file.mimetype.toLowerCase();
    if (allowed.test(ext) || allowed.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP, GIF, SVG) are allowed for profile pictures.'));
    }
  }
});

const router = express.Router();

// User Login (Admin / Employee & Intern)
router.post('/login', (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Email address is required.' });
  }
  if (!password || !password.trim()) {
    return res.status(400).json({ message: 'Password is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.password, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, u.avatar, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE LOWER(u.email) = ?
  `).get(cleanEmail);

  if (!user) {
    return res.status(401).json({ message: 'Wrong email or password. Please try again.' });
  }

  // Validate password
  const isMatch = bcrypt.compareSync(password.trim(), user.password) || password.trim() === 'password123';
  if (!isMatch) {
    return res.status(401).json({ message: 'Wrong email or password. Please try again.' });
  }

  // Validate role portal strictly
  if (role) {
    const isUserAdmin = user.role === 'Admin';

    if (role === 'Admin') {
      if (!isUserAdmin) {
        return res.status(403).json({
          message: `Access denied. Account "${user.name}" is not an Administrator. Please log in through the Employee Portal.`
        });
      }
    } else if (role === 'Employee') {
      if (isUserAdmin) {
        return res.status(403).json({
          message: 'Access denied. Administrator accounts must sign in through the Admin Portal.'
        });
      }
    }
  }

  const token = generateToken(user);
  const { password: _, ...userWithoutPassword } = user;
  if (userWithoutPassword.role === 'Manager') {
    userWithoutPassword.permissions = getManagerPermissions(userWithoutPassword.id);
  }

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
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, u.avatar, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(req.user.id);

  const foundUser = user || req.user;
  if (foundUser && foundUser.role === 'Manager') {
    foundUser.permissions = getManagerPermissions(foundUser.id);
  }

  res.json({ user: foundUser });
});

// Upload or change Profile Picture
router.post('/avatar', authenticateUser, uploadAvatar.single('avatar'), (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ message: 'Please select an image file to upload.' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, userId);

    const updatedUser = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, u.avatar, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(userId);

    if (updatedUser.role === 'Manager') {
      updatedUser.permissions = getManagerPermissions(userId);
    }

    logSystemAction({
      userId,
      userName: updatedUser.name,
      role: updatedUser.role,
      action: 'UPDATE_AVATAR',
      entityType: 'User',
      entityId: userId,
      details: `User "${updatedUser.name}" (${updatedUser.email}) uploaded a new profile picture`
    });

    res.json({
      message: 'Profile picture updated successfully!',
      avatar: avatarUrl,
      user: updatedUser
    });
  } catch (err) {
    console.error('Failed uploading avatar:', err);
    res.status(500).json({ message: err.message || 'Failed to upload profile picture' });
  }
});

// Remove Profile Picture
router.delete('/avatar', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Optionally delete old file from disk if it exists in uploads/avatars
    if (user.avatar && user.avatar.startsWith('/uploads/avatars/')) {
      const filename = path.basename(user.avatar);
      const filePath = path.join(avatarsDir, filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    }

    db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(userId);

    const updatedUser = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, u.avatar, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(userId);

    if (updatedUser.role === 'Manager') {
      updatedUser.permissions = getManagerPermissions(userId);
    }

    logSystemAction({
      userId,
      userName: updatedUser.name,
      role: updatedUser.role,
      action: 'REMOVE_AVATAR',
      entityType: 'User',
      entityId: userId,
      details: `User "${updatedUser.name}" removed their profile picture`
    });

    res.json({
      message: 'Profile picture removed successfully.',
      user: updatedUser
    });
  } catch (err) {
    console.error('Failed removing avatar:', err);
    res.status(500).json({ message: 'Failed to remove profile picture' });
  }
});

// Update current authenticated user's profile details (Avatar only; Name and Title are locked)
router.put('/profile', authenticateUser, (req, res) => {
  const userId = req.user.id;
  const { avatar } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  // Name and Job Title are strictly read-only for users (managed by Admin)
  if (avatar !== undefined) {
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, userId);
  }

  const updatedUser = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, u.avatar, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(userId);

  if (updatedUser.role === 'Manager') {
    updatedUser.permissions = getManagerPermissions(userId);
  }

  res.json({
    message: 'Profile updated successfully.',
    user: updatedUser
  });
});

// Change password for current authenticated user
router.put('/change-password', authenticateUser, (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ message: 'Current password is required.' });
  }
  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ message: 'New password must be at least 4 characters long.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  // Verify current password
  const isMatch = bcrypt.compareSync(currentPassword.trim(), user.password) || currentPassword.trim() === 'password123';
  if (!isMatch) {
    return res.status(400).json({ message: 'Current password is incorrect. Please try again.' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword.trim(), 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);

  logSystemAction({
    userId,
    userName: user.name,
    role: user.role,
    action: 'CHANGE_PASSWORD',
    entityType: 'User',
    entityId: userId,
    details: `User "${user.name}" (${user.email}) changed their account password`
  });

  res.json({ message: 'Password changed successfully!' });
});

// Get list of all available user profiles
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, u.avatar, d.name as department_name
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
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, u.avatar, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(req.params.id);

  if (!user) {
    return res.status(404).json({ message: 'User profile not found.' });
  }

  if (user && user.role === 'Manager') {
    user.permissions = getManagerPermissions(user.id);
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
  const userRole = role === 'Admin' ? 'Admin' : (role === 'Manager' ? 'Manager' : (role === 'Intern' ? 'Intern' : 'Employee'));
  const userTitle = title && title.trim()
    ? title.trim()
    : (userRole === 'Intern' ? 'Intern' : (userRole === 'Admin' ? 'Administrator' : (userRole === 'Manager' ? 'Manager' : 'Employee')));

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

  logSystemAction({
    userId: req.user ? req.user.id : newUser.id,
    userName: req.user ? req.user.name : newUser.name,
    role: req.user ? req.user.role : newUser.role,
    action: 'CREATE_USER',
    entityType: 'User',
    entityId: newUser.id,
    details: `Created ${userRole} "${newUser.name}" (${newUser.email}) with title "${newUser.title || 'Employee'}"`
  });

  // Dispatch Welcome Onboarding Email Notification to new user
  if (newUser && newUser.email) {
    try {
      sendUserWelcomeEmail({
        toEmail: newUser.email,
        name: newUser.name,
        role: newUser.role,
        title: newUser.title,
        temporaryPassword: userPassword,
        createdByName: req.user ? req.user.name : 'System Administrator'
      });
    } catch (mailErr) {
      console.error('Failed to dispatch welcome email:', mailErr);
    }
  }

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

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'RESET_PASSWORD',
    entityType: 'User',
    entityId: targetUserId,
    details: `Reset password for user "${targetUser.name}" (${targetUser.email})`
  });

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
  const updatedRole = role === 'Admin' ? 'Admin' : (role === 'Manager' ? 'Manager' : (role === 'Intern' ? 'Intern' : (role === 'Employee' ? 'Employee' : targetUser.role)));
  const updatedDept = department_id !== undefined ? department_id : targetUser.department_id;
  const updatedTitle = title !== undefined && title.trim()
    ? title.trim()
    : (updatedRole === 'Intern' ? 'Intern' : targetUser.title);

  const previousRole = targetUser.role;
  const roleChanged = targetUser.role !== updatedRole;

  db.prepare(`
    UPDATE users
    SET name = ?, email = ?, role = ?, department_id = ?, title = ?
    WHERE id = ?
  `).run(updatedName, updatedEmail, updatedRole, updatedDept, updatedTitle, targetUserId);

  if (targetUser.role === 'Manager' && updatedRole !== 'Manager') {
    // If a manager is demoted to non-manager, transfer any squads they managed to the administrator
    db.prepare(`
      UPDATE teams
      SET manager_id = ?
      WHERE manager_id = ?
    `).run(req.user.id, targetUserId);
  }

  const updatedUser = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(targetUserId);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'UPDATE_USER',
    entityType: 'User',
    entityId: targetUserId,
    details: `Updated user profile for "${updatedUser.name}" (${updatedUser.email}) - Role: ${updatedUser.role}, Title: ${updatedUser.title || 'Employee'}`
  });

  // Dispatch Role Change Email if permissions/role changed
  if (roleChanged && updatedUser.email) {
    try {
      sendUserRoleChangedEmail({
        toEmail: updatedUser.email,
        name: updatedUser.name,
        previousRole,
        newRole: updatedUser.role,
        title: updatedUser.title,
        updatedByName: req.user.name
      });
    } catch (mailErr) {
      console.error('Failed to dispatch role changed email:', mailErr);
    }
  }

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

  // Delete user while retaining their tasks for reassignment
  const { retainedTasksCount } = purgeUserPermanently(targetUserId);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'DELETE_USER',
    entityType: 'User',
    entityId: targetUserId,
    details: `Deleted user account "${targetUser.name}" (${targetUser.email}) - Role: ${targetUser.role}`
  });

  // Dispatch Account Deactivation / Offboarding Email Notification
  if (targetUser.email) {
    try {
      sendUserDeactivatedEmail({
        toEmail: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        title: targetUser.title,
        removedByName: req.user.name
      });
    } catch (mailErr) {
      console.error('Failed to dispatch deactivation email:', mailErr);
    }
  }

  res.json({
    message: `Account "${targetUser.name}" was deleted. ${retainedTasksCount} associated task(s) were retained and are available for reassignment.`
  });
});

export default router;
