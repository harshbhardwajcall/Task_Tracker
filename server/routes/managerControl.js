import express from 'express';
import db, { logSystemAction, getManagerPermissions, DEFAULT_MANAGER_PERMISSIONS } from '../db/index.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Preset configurations for managers
export const PRESETS = {
  standard: {
    can_create_tasks: true,
    can_edit_tasks: true,
    can_delete_tasks: true,
    can_create_teams: true,
    can_delete_teams: true,
    can_manage_members: true,
    can_create_projects: false,
    can_edit_projects: false,
    can_delete_projects: false,
    can_view_all_tasks: true,
    can_view_reports: true,
    can_access_recycle_bin: true,
    can_empty_recycle_bin: false,
    can_view_change_history: false,
    allowed_tabs: ['dashboard', 'teams', 'self_logs', 'completed_tasks', 'reports']
  },
  super: {
    can_create_tasks: true,
    can_edit_tasks: true,
    can_delete_tasks: true,
    can_create_teams: true,
    can_delete_teams: true,
    can_manage_members: true,
    can_create_projects: true,
    can_edit_projects: true,
    can_delete_projects: true,
    can_view_all_tasks: true,
    can_view_reports: true,
    can_access_recycle_bin: true,
    can_empty_recycle_bin: true,
    can_view_change_history: true,
    allowed_tabs: ['dashboard', 'teams', 'self_logs', 'completed_tasks', 'reports', 'projects', 'departments', 'employees', 'recycle_bin', 'audit_logs']
  },
  restricted: {
    can_create_tasks: true,
    can_edit_tasks: false,
    can_delete_tasks: false,
    can_create_teams: false,
    can_delete_teams: false,
    can_manage_members: false,
    can_create_projects: false,
    can_edit_projects: false,
    can_delete_projects: false,
    can_view_all_tasks: false,
    can_view_reports: false,
    can_access_recycle_bin: false,
    can_empty_recycle_bin: false,
    can_view_change_history: false,
    allowed_tabs: ['dashboard', 'teams', 'self_logs', 'completed_tasks']
  }
};

// GET all managers with their respective permissions (Admin Only)
router.get('/managers', authenticateUser, (req, res) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ message: 'Access denied. Manager control is restricted to administrators.' });
  }

  try {
    const managers = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department_id, COALESCE(u.title, 'Manager') as title, d.name as department_name,
        (SELECT COUNT(*) FROM teams WHERE manager_id = u.id) as squad_count
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'Manager'
      ORDER BY u.name ASC
    `).all();

    const managersWithPermissions = managers.map(m => ({
      ...m,
      permissions: getManagerPermissions(m.id)
    }));

    res.json({ managers: managersWithPermissions });
  } catch (err) {
    console.error('Failed to get managers list:', err);
    res.status(500).json({ message: 'Failed to retrieve manager list' });
  }
});

// GET current manager's own permissions (Self)
router.get('/my-permissions', authenticateUser, (req, res) => {
  try {
    const permissions = getManagerPermissions(req.user.id);
    res.json({ permissions });
  } catch (err) {
    console.error('Failed to get my permissions:', err);
    res.status(500).json({ message: 'Failed to retrieve permissions' });
  }
});

// GET permissions for a specific manager (Admin only)
router.get('/:userId', authenticateUser, (req, res) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ message: 'Access denied.' });
  }

  const { userId } = req.params;
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const permissions = getManagerPermissions(userId);
  res.json({ user, permissions });
});

// PUT update manager permissions & allowed navigation tabs (Admin only)
router.put('/:userId', authenticateUser, (req, res) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Administrators can customize manager views and permissions.' });
  }

  const { userId } = req.params;
  const targetUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId);
  if (!targetUser) {
    return res.status(404).json({ message: 'Manager user not found.' });
  }

  const {
    can_create_tasks = true,
    can_edit_tasks = true,
    can_delete_tasks = true,
    can_create_teams = true,
    can_delete_teams = true,
    can_manage_members = true,
    can_create_projects = false,
    can_edit_projects = false,
    can_delete_projects = false,
    can_view_all_tasks = true,
    can_view_reports = true,
    can_access_recycle_bin = true,
    can_empty_recycle_bin = false,
    can_view_change_history = false,
    allowed_tabs = DEFAULT_MANAGER_PERMISSIONS.allowed_tabs
  } = req.body;

  const serializedTabs = JSON.stringify(Array.isArray(allowed_tabs) ? allowed_tabs : DEFAULT_MANAGER_PERMISSIONS.allowed_tabs);

  // Upsert into manager_permissions
  const existing = db.prepare('SELECT user_id FROM manager_permissions WHERE user_id = ?').get(userId);

  if (existing) {
    db.prepare(`
      UPDATE manager_permissions SET
        can_create_tasks = ?,
        can_edit_tasks = ?,
        can_delete_tasks = ?,
        can_create_teams = ?,
        can_delete_teams = ?,
        can_manage_members = ?,
        can_create_projects = ?,
        can_edit_projects = ?,
        can_delete_projects = ?,
        can_view_all_tasks = ?,
        can_view_reports = ?,
        can_access_recycle_bin = ?,
        can_empty_recycle_bin = ?,
        can_view_change_history = ?,
        allowed_tabs = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      can_create_tasks ? 1 : 0,
      can_edit_tasks ? 1 : 0,
      can_delete_tasks ? 1 : 0,
      can_create_teams ? 1 : 0,
      can_delete_teams ? 1 : 0,
      can_manage_members ? 1 : 0,
      can_create_projects ? 1 : 0,
      can_edit_projects ? 1 : 0,
      can_delete_projects ? 1 : 0,
      can_view_all_tasks ? 1 : 0,
      can_view_reports ? 1 : 0,
      can_access_recycle_bin ? 1 : 0,
      can_empty_recycle_bin ? 1 : 0,
      can_view_change_history ? 1 : 0,
      serializedTabs,
      userId
    );
  } else {
    db.prepare(`
      INSERT INTO manager_permissions (
        user_id, can_create_tasks, can_edit_tasks, can_delete_tasks, can_create_teams,
        can_delete_teams, can_manage_members, can_create_projects, can_edit_projects,
        can_delete_projects, can_view_all_tasks, can_view_reports, can_access_recycle_bin,
        can_empty_recycle_bin, can_view_change_history, allowed_tabs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      can_create_tasks ? 1 : 0,
      can_edit_tasks ? 1 : 0,
      can_delete_tasks ? 1 : 0,
      can_create_teams ? 1 : 0,
      can_delete_teams ? 1 : 0,
      can_manage_members ? 1 : 0,
      can_create_projects ? 1 : 0,
      can_edit_projects ? 1 : 0,
      can_delete_projects ? 1 : 0,
      can_view_all_tasks ? 1 : 0,
      can_view_reports ? 1 : 0,
      can_access_recycle_bin ? 1 : 0,
      can_empty_recycle_bin ? 1 : 0,
      can_view_change_history ? 1 : 0,
      serializedTabs
    );
  }

  const updatedPermissions = getManagerPermissions(userId);

  // System Audit Logging
  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'UPDATE_MANAGER_PERMISSIONS',
    entityType: 'ManagerControl',
    entityId: userId,
    details: `Updated visibility and powers for manager "${targetUser.name}" (${targetUser.email})`
  });

  res.json({
    message: `Permissions updated successfully for Manager "${targetUser.name}".`,
    permissions: updatedPermissions
  });
});

// POST apply quick preset (Admin only)
router.post('/apply-preset', authenticateUser, (req, res) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Administrators can apply manager presets.' });
  }

  const { user_id, preset } = req.body;
  if (!user_id || !preset || !PRESETS[preset]) {
    return res.status(400).json({ message: 'Invalid manager ID or preset selection (must be standard, super, or restricted).' });
  }

  const targetUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(user_id);
  if (!targetUser) {
    return res.status(404).json({ message: 'Manager user not found.' });
  }

  const p = PRESETS[preset];
  const serializedTabs = JSON.stringify(p.allowed_tabs);

  const existing = db.prepare('SELECT user_id FROM manager_permissions WHERE user_id = ?').get(user_id);
  if (existing) {
    db.prepare(`
      UPDATE manager_permissions SET
        can_create_tasks = ?, can_edit_tasks = ?, can_delete_tasks = ?,
        can_create_teams = ?, can_delete_teams = ?, can_manage_members = ?,
        can_create_projects = ?, can_edit_projects = ?, can_delete_projects = ?,
        can_view_all_tasks = ?, can_view_reports = ?, can_access_recycle_bin = ?,
        can_empty_recycle_bin = ?, can_view_change_history = ?, allowed_tabs = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      p.can_create_tasks ? 1 : 0, p.can_edit_tasks ? 1 : 0, p.can_delete_tasks ? 1 : 0,
      p.can_create_teams ? 1 : 0, p.can_delete_teams ? 1 : 0, p.can_manage_members ? 1 : 0,
      p.can_create_projects ? 1 : 0, p.can_edit_projects ? 1 : 0, p.can_delete_projects ? 1 : 0,
      p.can_view_all_tasks ? 1 : 0, p.can_view_reports ? 1 : 0, p.can_access_recycle_bin ? 1 : 0,
      p.can_empty_recycle_bin ? 1 : 0, p.can_view_change_history ? 1 : 0,
      serializedTabs,
      user_id
    );
  } else {
    db.prepare(`
      INSERT INTO manager_permissions (
        user_id, can_create_tasks, can_edit_tasks, can_delete_tasks, can_create_teams,
        can_delete_teams, can_manage_members, can_create_projects, can_edit_projects,
        can_delete_projects, can_view_all_tasks, can_view_reports, can_access_recycle_bin,
        can_empty_recycle_bin, can_view_change_history, allowed_tabs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user_id,
      p.can_create_tasks ? 1 : 0, p.can_edit_tasks ? 1 : 0, p.can_delete_tasks ? 1 : 0,
      p.can_create_teams ? 1 : 0, p.can_delete_teams ? 1 : 0, p.can_manage_members ? 1 : 0,
      p.can_create_projects ? 1 : 0, p.can_edit_projects ? 1 : 0, p.can_delete_projects ? 1 : 0,
      p.can_view_all_tasks ? 1 : 0, p.can_view_reports ? 1 : 0, p.can_access_recycle_bin ? 1 : 0,
      p.can_empty_recycle_bin ? 1 : 0, p.can_view_change_history ? 1 : 0,
      serializedTabs
    );
  }

  const updatedPermissions = getManagerPermissions(user_id);

  logSystemAction({
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    action: 'APPLY_MANAGER_PRESET',
    entityType: 'ManagerControl',
    entityId: user_id,
    details: `Applied "${preset}" permission preset to manager "${targetUser.name}"`
  });

  res.json({
    message: `Applied "${preset}" preset to manager "${targetUser.name}".`,
    permissions: updatedPermissions
  });
});

export default router;
