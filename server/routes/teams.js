import express from 'express';
import db, { logSystemAction, createNotification } from '../db/index.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { sendProjectAllocatedEmail } from '../utils/emailHelper.js';

const router = express.Router();

/**
 * Helper to dispatch project allocation email to all members and manager of a team
 */
function notifyTeamProjectAllocation({ teamId, projectId, allocatedByName }) {
  try {
    const team = db.prepare('SELECT name, department_id, manager_id FROM teams WHERE id = ?').get(teamId);
    const project = db.prepare(`
      SELECT p.id, p.name, p.description, d.name as department_name
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = ?
    `).get(projectId);

    if (!team || !project) return;

    const recipients = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.email, tm.role_in_team
      FROM users u
      LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
      WHERE u.id IN (
        SELECT user_id FROM team_members WHERE team_id = ?
        UNION
        SELECT manager_id FROM teams WHERE id = ?
      )
    `).all(teamId, teamId, teamId);

    for (const r of recipients) {
      if (r.email && !r.email.endsWith('@company.local')) {
        sendProjectAllocatedEmail({
          toEmail: r.email,
          recipientName: r.name,
          projectName: project.name,
          teamName: team.name,
          departmentName: project.department_name,
          description: project.description,
          allocatedByName: allocatedByName || 'System Administrator',
          roleInTeam: r.role_in_team || (r.id === team.manager_id ? 'Team Lead' : 'Member')
        }).catch(err => console.error('Failed to send project allocated email:', err));
      }
    }
  } catch (err) {
    console.error('Failed to dispatch team project allocation notifications:', err);
  }
}


// GET all teams with manager, department, member count, project count (role-isolated)
router.get('/', authenticateUser, (req, res) => {
  try {
    const { scope, manager_id } = req.query;
    let whereClause = '';
    const params = [];

    // Role-based isolation:
    // If user is a Manager, show squads they lead, created, belong to, or allocated deliverables to, or squads associated with shared co-managed projects
    if (req.user.role === 'Manager') {
      whereClause = `WHERE (
        t.manager_id = ? 
        OR (t.created_by IS NOT NULL AND t.created_by = ?)
        OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.user_id = ?)
        OR EXISTS (SELECT 1 FROM team_projects tp WHERE tp.team_id = t.id AND tp.assigned_by = ?)
        OR EXISTS (
          SELECT 1 FROM team_projects tp
          JOIN project_shares ps ON tp.project_id = ps.project_id
          WHERE tp.team_id = t.id AND ps.user_id = ?
        )
      )`;
      params.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    } else if (manager_id) {
      whereClause = `WHERE (
        t.manager_id = ? 
        OR (t.created_by IS NOT NULL AND t.created_by = ?)
        OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.user_id = ?)
        OR EXISTS (SELECT 1 FROM team_projects tp WHERE tp.team_id = t.id AND tp.assigned_by = ?)
        OR EXISTS (
          SELECT 1 FROM team_projects tp
          JOIN project_shares ps ON tp.project_id = ps.project_id
          WHERE tp.team_id = t.id AND ps.user_id = ?
        )
      )`;
      params.push(Number(manager_id), Number(manager_id), Number(manager_id), Number(manager_id), Number(manager_id));
    } else if (scope === 'my') {
      whereClause = `WHERE (
        t.manager_id = ? 
        OR (t.created_by IS NOT NULL AND t.created_by = ?)
        OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.user_id = ?)
        OR EXISTS (SELECT 1 FROM team_projects tp WHERE tp.team_id = t.id AND tp.assigned_by = ?)
        OR EXISTS (
          SELECT 1 FROM team_projects tp
          JOIN project_shares ps ON tp.project_id = ps.project_id
          WHERE tp.team_id = t.id AND ps.user_id = ?
        )
      )`;
      params.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    }

    const currentUserId = req.user ? req.user.id : 0;
    const teams = db.prepare(`
      SELECT 
        t.*,
        u.name as manager_name,
        u.email as manager_email,
        d.name as department_name,
        (SELECT GROUP_CONCAT(p.name, ', ') FROM team_projects tp JOIN projects p ON tp.project_id = p.id WHERE tp.team_id = t.id) as project_names,
        (SELECT p.id FROM team_projects tp JOIN projects p ON tp.project_id = p.id WHERE tp.team_id = t.id LIMIT 1) as project_id,
        (SELECT GROUP_CONCAT(p.id, ', ') FROM team_projects tp JOIN projects p ON tp.project_id = p.id WHERE tp.team_id = t.id) as project_ids,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as total_members,
        (SELECT COUNT(*) FROM team_projects WHERE team_id = t.id) as total_projects,
        (SELECT COUNT(*) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as total_tasks,
        (SELECT COALESCE(SUM(CASE WHEN tsk.status = 'In Progress' THEN 1 ELSE 0 END), 0) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as in_progress_tasks,
        (SELECT COALESCE(SUM(CASE WHEN tsk.status = 'On Hold' THEN 1 ELSE 0 END), 0) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as on_hold_tasks,
        (SELECT COALESCE(SUM(CASE WHEN tsk.status = 'Completed' THEN 1 ELSE 0 END), 0) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as completed_tasks,
        (SELECT COALESCE(SUM(CASE WHEN tsk.status = 'Not Started' THEN 1 ELSE 0 END), 0) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as not_started_tasks,
        (SELECT COALESCE(SUM(CASE WHEN tsk.status = 'Overdue' OR (tsk.due_date < date('now') AND tsk.status != 'Completed') THEN 1 ELSE 0 END), 0) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as overdue_tasks,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM team_projects tp 
            JOIN project_shares ps ON tp.project_id = ps.project_id 
            WHERE tp.team_id = t.id AND ps.user_id = ${currentUserId}
          ) AND t.manager_id != ${currentUserId} THEN 1 
          ELSE 0 
        END as is_co_managed_squad
      FROM teams t
      LEFT JOIN users u ON t.manager_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      ${whereClause}
      ORDER BY t.created_at DESC
    `).all(...params);

    res.json({ teams });
  } catch (err) {
    console.error('Failed to get teams:', err);
    res.status(500).json({ message: 'Failed to retrieve teams' });
  }
});

// GET employee/intern assigned teams, allocated projects, and fellow teammates
router.get('/my-allocation', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Find all teams user is part of (as member, manager, or creator)
    const teams = db.prepare(`
      SELECT 
        t.*,
        u.name as manager_name,
        u.email as manager_email,
        u.avatar as manager_avatar,
        d.name as department_name,
        COALESCE(tm.role_in_team, CASE WHEN t.manager_id = ? THEN 'Team Lead' WHEN t.created_by = ? THEN 'Creator' ELSE 'Member' END) as my_role_in_team,
        COALESCE(tm.joined_at, t.created_at) as my_joined_at,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as total_members,
        (SELECT COUNT(*) FROM team_projects WHERE team_id = t.id) as total_projects,
        (SELECT COUNT(*) FROM tasks WHERE (team_id = t.id OR project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id)) AND deleted_at IS NULL) as total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE (team_id = t.id OR project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id)) AND deleted_at IS NULL AND status = 'In Progress') as in_progress_tasks,
        (SELECT COUNT(*) FROM tasks WHERE (team_id = t.id OR project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id)) AND deleted_at IS NULL AND status = 'On Hold') as on_hold_tasks,
        (SELECT COUNT(*) FROM tasks WHERE (team_id = t.id OR project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id)) AND deleted_at IS NULL AND status = 'Completed') as completed_tasks,
        (SELECT COUNT(*) FROM tasks WHERE (team_id = t.id OR project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id)) AND deleted_at IS NULL AND status = 'Not Started') as not_started_tasks
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
      LEFT JOIN users u ON t.manager_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE tm.user_id = ? 
         OR t.manager_id = ? 
         OR (t.created_by IS NOT NULL AND t.created_by = ?)
      ORDER BY t.created_at DESC
    `).all(userId, userId, userId, userId, userId, userId);

    // For each team, fetch member roster and allocated projects
    const enrichedTeams = teams.map(team => {
      const members = db.prepare(`
        SELECT tm.role_in_team, tm.joined_at, u.id as user_id, u.name, u.email, u.role, u.title, u.avatar,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND deleted_at IS NULL AND status != 'Completed') as active_tasks
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
        ORDER BY 
          CASE WHEN u.id = ? THEN 1 WHEN tm.role_in_team LIKE '%Lead%' OR tm.role_in_team LIKE '%Manager%' OR tm.role_in_team = 'Creator' THEN 2 ELSE 3 END,
          u.name ASC
      `).all(team.id, userId);

      const projects = db.prepare(`
        SELECT p.*, tp.assigned_at, d.name as department_name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL) as total_tasks,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'In Progress') as in_progress_tasks,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'On Hold') as on_hold_tasks,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'Completed') as completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'Not Started') as not_started_tasks,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND assigned_to = ? AND deleted_at IS NULL AND status != 'Completed') as my_active_tasks
        FROM team_projects tp
        JOIN projects p ON tp.project_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        WHERE tp.team_id = ?
        ORDER BY p.name ASC
      `).all(userId, team.id);

      return {
        ...team,
        members,
        projects
      };
    });

    // 2. Fetch all projects assigned to user (via team allocation OR directly via assigned tasks)
    const directProjects = db.prepare(`
      SELECT DISTINCT p.*, d.name as department_name,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL) as total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'In Progress') as in_progress_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'On Hold') as on_hold_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'Completed') as completed_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'Not Started') as not_started_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND (assigned_to = ? OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = tasks.id AND td.user_id = ?)) AND deleted_at IS NULL AND status != 'Completed') as my_active_tasks
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id IN (
        SELECT project_id FROM team_projects tp WHERE tp.team_id IN (
          SELECT id FROM teams WHERE manager_id = ? OR (created_by IS NOT NULL AND created_by = ?) OR id IN (SELECT team_id FROM team_members WHERE user_id = ?)
        )
        UNION
        SELECT project_id FROM tasks WHERE (assigned_to = ? OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = tasks.id AND td.user_id = ?)) AND deleted_at IS NULL
      )
      ORDER BY p.name ASC
    `).all(userId, userId, userId, userId, userId, userId, userId);

    // 3. User's active tasks and squad teammates' tasks in these shared projects
    const teamTasks = db.prepare(`
      SELECT t.*, p.name as project_name, d.name as department_name,
        u_by.name as assigner_name,
        u_to.name as assigned_to_name,
        u_to.avatar as assigned_to_avatar,
        u_to.role as assigned_to_role,
        u_to.title as assigned_to_title,
        CASE WHEN (t.assigned_to = ? OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?)) THEN 1 ELSE 0 END as is_my_task
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users u_by ON t.assigned_by = u_by.id
      LEFT JOIN users u_to ON t.assigned_to = u_to.id
      WHERE t.deleted_at IS NULL
        AND (
          t.assigned_to = ?
          OR t.assigned_by = ?
          OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?)
          OR EXISTS (
            SELECT 1 FROM teams squad
            WHERE (
              (squad.manager_id = ? OR (squad.created_by IS NOT NULL AND squad.created_by = ?) OR EXISTS (SELECT 1 FROM team_members tm1 WHERE tm1.team_id = squad.id AND tm1.user_id = ?))
              AND
              (squad.manager_id = t.assigned_to OR (squad.created_by IS NOT NULL AND squad.created_by = t.assigned_to) OR EXISTS (SELECT 1 FROM team_members tm2 WHERE tm2.team_id = squad.id AND tm2.user_id = t.assigned_to))
              AND
              (
                EXISTS (SELECT 1 FROM team_projects tp WHERE tp.team_id = squad.id AND tp.project_id = t.project_id)
                OR EXISTS (SELECT 1 FROM tasks my_t WHERE (my_t.assigned_to = ? OR EXISTS (SELECT 1 FROM task_dependencies td2 WHERE td2.task_id = my_t.id AND td2.user_id = ?)) AND my_t.project_id = t.project_id AND my_t.deleted_at IS NULL)
              )
            )
          )
        )
      ORDER BY 
        is_my_task DESC,
        CASE t.status 
          WHEN 'In Progress' THEN 1 
          WHEN 'Not Started' THEN 2 
          WHEN 'On Hold' THEN 3 
          ELSE 4 
        END,
        t.due_date ASC
      LIMIT 60
    `).all(userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId);

    // Attach dependencies to team tasks
    if (teamTasks.length > 0) {
      const taskIds = teamTasks.map(t => t.id);
      const deps = db.prepare(`
        SELECT td.task_id, u.id, u.name, u.email, u.role, u.avatar
        FROM task_dependencies td
        JOIN users u ON td.user_id = u.id
        WHERE td.task_id IN (${taskIds.map(() => '?').join(',')})
      `).all(...taskIds);
      const depsMap = {};
      deps.forEach(d => {
        if (!depsMap[d.task_id]) depsMap[d.task_id] = [];
        depsMap[d.task_id].push(d);
      });
      teamTasks.forEach(t => {
        t.dependencies = depsMap[t.id] || [];
      });
    }

    // Collect distinct teammates across all teams
    const teammateMap = new Map();
    enrichedTeams.forEach(t => {
      (t.members || []).forEach(m => {
        if (m.user_id !== userId && !teammateMap.has(m.user_id)) {
          teammateMap.set(m.user_id, m);
        }
      });
    });

    res.json({
      teams: enrichedTeams,
      projects: directProjects,
      tasks: teamTasks,
      teammates: Array.from(teammateMap.values()),
      summary: {
        total_teams: enrichedTeams.length,
        total_projects: directProjects.length,
        total_teammates: teammateMap.size,
        pending_tasks: teamTasks.filter(t => t.status !== 'Completed' && t.is_my_task).length,
        total_shared_tasks: teamTasks.length
      }
    });
  } catch (err) {
    console.error('Failed to get my allocation:', err);
    res.status(500).json({ message: 'Failed to retrieve team allocation' });
  }
});

// GET single team details (members and projects)
router.get('/:id', authenticateUser, (req, res) => {
  try {
    const team = db.prepare(`
      SELECT 
        t.*,
        u.name as manager_name,
        u.email as manager_email,
        d.name as department_name,
        (SELECT GROUP_CONCAT(p.name, ', ') FROM team_projects tp JOIN projects p ON tp.project_id = p.id WHERE tp.team_id = t.id) as project_names,
        (SELECT COUNT(*) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as total_tasks,
        (SELECT COALESCE(SUM(CASE WHEN tsk.status = 'In Progress' THEN 1 ELSE 0 END), 0) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as in_progress_tasks,
        (SELECT COALESCE(SUM(CASE WHEN tsk.status = 'On Hold' THEN 1 ELSE 0 END), 0) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as on_hold_tasks,
        (SELECT COALESCE(SUM(CASE WHEN tsk.status = 'Completed' THEN 1 ELSE 0 END), 0) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as completed_tasks,
        (SELECT COALESCE(SUM(CASE WHEN tsk.status = 'Not Started' THEN 1 ELSE 0 END), 0) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as not_started_tasks,
        (SELECT COALESCE(SUM(CASE WHEN tsk.status = 'Overdue' OR (tsk.due_date < date('now') AND tsk.status != 'Completed') THEN 1 ELSE 0 END), 0) FROM tasks tsk WHERE tsk.deleted_at IS NULL AND (tsk.team_id = t.id OR tsk.project_id IN (SELECT project_id FROM team_projects WHERE team_id = t.id))) as overdue_tasks
      FROM teams t
      LEFT JOIN users u ON t.manager_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const members = db.prepare(`
      SELECT tm.id as membership_id, tm.role_in_team, tm.joined_at, u.id as user_id, u.name, u.email, u.role, u.title,
        (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND deleted_at IS NULL AND status != 'Completed') as active_tasks
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY u.name ASC
    `).all(req.params.id);

    const projects = db.prepare(`
      SELECT p.*, tp.assigned_at, d.name as department_name,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL) as total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'In Progress') as in_progress_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'On Hold') as on_hold_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'Completed') as completed_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND status = 'Not Started') as not_started_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL AND due_date IS NOT NULL AND due_date < date('now') AND status != 'Completed') as overdue_tasks
      FROM team_projects tp
      JOIN projects p ON tp.project_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE tp.team_id = ?
      ORDER BY p.name ASC
    `).all(req.params.id);

    res.json({ team, members, projects });
  } catch (err) {
    console.error('Failed to get team details:', err);
    res.status(500).json({ message: 'Failed to retrieve team details' });
  }
});

// CREATE team
router.post('/', authenticateUser, (req, res) => {
  try {
    let { name, team_code, team_id, project_name, project_id, description, manager_id, department_id, members, links } = req.body;

    const finalCode = team_code || team_id || '';

    // If team name is not provided, but project_id or project_name is provided, use project name
    if (!name || !name.trim()) {
      if (project_id) {
        const proj = db.prepare('SELECT name, department_id FROM projects WHERE id = ?').get(project_id);
        if (proj) {
          name = `${proj.name} Squad`;
          if (!department_id && proj.department_id) {
            department_id = proj.department_id;
          }
        }
      } else if (project_name && project_name.trim()) {
        name = `${project_name.trim()} Squad`;
      }
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Team name or project name is required.' });
    }

    const existing = db.prepare('SELECT id FROM teams WHERE LOWER(name) = ?').get(name.trim().toLowerCase());
    if (existing) {
      return res.status(400).json({ message: 'A team with this name already exists.' });
    }

    // Team lead / manager: use manager_id if provided, else default to current user
    const managerId = manager_id !== undefined ? (manager_id ? Number(manager_id) : null) : req.user.id;

    // Check if team_code and created_by columns exist in table
    const tableCols = db.prepare("PRAGMA table_info(teams)").all();
    const hasTeamCode = tableCols.some(c => c.name === 'team_code');
    const hasCreatedBy = tableCols.some(c => c.name === 'created_by');

    let result;
    if (hasTeamCode && finalCode) {
      if (hasCreatedBy) {
        result = db.prepare(`
          INSERT INTO teams (name, description, manager_id, department_id, team_code, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(name.trim(), description ? description.trim() : '', managerId, department_id || null, finalCode.trim(), req.user.id);
      } else {
        result = db.prepare(`
          INSERT INTO teams (name, description, manager_id, department_id, team_code)
          VALUES (?, ?, ?, ?, ?)
        `).run(name.trim(), description ? description.trim() : '', managerId, department_id || null, finalCode.trim());
      }
    } else {
      if (hasCreatedBy) {
        result = db.prepare(`
          INSERT INTO teams (name, description, manager_id, department_id, created_by)
          VALUES (?, ?, ?, ?, ?)
        `).run(name.trim(), description ? description.trim() : '', managerId, department_id || null, req.user.id);
      } else {
        result = db.prepare(`
          INSERT INTO teams (name, description, manager_id, department_id)
          VALUES (?, ?, ?, ?)
        `).run(name.trim(), description ? description.trim() : '', managerId, department_id || null);
      }
    }

    const newTeamId = result.lastInsertRowid;

    // If project_id was selected, automatically allocate it to this new team
    if (project_id) {
      db.prepare(`
        INSERT OR IGNORE INTO team_projects (team_id, project_id, assigned_by)
        VALUES (?, ?, ?)
      `).run(newTeamId, Number(project_id), req.user.id);

      // Save project links if provided
      if (links) {
        const linksStr = typeof links === 'string' ? links.trim() : JSON.stringify(links);
        if (linksStr && linksStr !== '[]') {
          db.prepare('UPDATE projects SET links = ? WHERE id = ?').run(linksStr, Number(project_id));
        }
      }
    }

    // Automatically ensure the creator is a member of the created team
    db.prepare(`
      INSERT OR IGNORE INTO team_members (team_id, user_id, role_in_team)
      VALUES (?, ?, ?)
    `).run(newTeamId, req.user.id, managerId === req.user.id ? 'Team Lead' : 'Creator');

    // If manager_id is specified and different, ensure manager is also in team_members
    if (managerId && managerId !== req.user.id) {
      db.prepare(`
        INSERT OR IGNORE INTO team_members (team_id, user_id, role_in_team)
        VALUES (?, ?, 'Team Lead')
      `).run(newTeamId, managerId);
    }

    // If members array was provided, add each team member with optional role_in_team
    if (Array.isArray(members) && members.length > 0) {
      const insertMember = db.prepare(`
        INSERT OR IGNORE INTO team_members (team_id, user_id, role_in_team)
        VALUES (?, ?, ?)
      `);
      for (const m of members) {
        const uId = typeof m === 'object' ? m.user_id : m;
        const role = typeof m === 'object' && m.role_in_team ? m.role_in_team.trim() : 'Member';
        if (uId) {
          insertMember.run(newTeamId, Number(uId), role || 'Member');
        }
      }
    }

    // Log action to system_logs
    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'CREATE_TEAM',
      entityType: 'Team',
      entityId: newTeamId,
      details: `Created team "${name.trim()}"`
    });

    // Send Project Allocation Emails if a project was allocated to this new team
    if (project_id) {
      notifyTeamProjectAllocation({
        teamId: newTeamId,
        projectId: Number(project_id),
        allocatedByName: req.user.name
      });
    }


    const newTeam = db.prepare(`
      SELECT t.*, u.name as manager_name, d.name as department_name,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as total_members,
        (SELECT COUNT(*) FROM team_projects WHERE team_id = t.id) as total_projects
      FROM teams t
      LEFT JOIN users u ON t.manager_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.id = ?
    `).get(newTeamId);

    res.status(201).json({ message: 'Team created successfully', team: newTeam });
  } catch (err) {
    console.error('Failed to create team:', err);
    res.status(500).json({ message: 'Failed to create team' });
  }
});

// UPDATE team (allows editing squad details, lead, members, and associated project details)
router.put('/:id', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      manager_id,
      department_id,
      project_id,
      project_name,
      project_description,
      project_department_id,
      members,
      links
    } = req.body;

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Team name is required.' });
    }

    const existing = db.prepare('SELECT id FROM teams WHERE LOWER(name) = ? AND id != ?').get(name.trim().toLowerCase(), id);
    if (existing) {
      return res.status(400).json({ message: 'Another team with this name already exists.' });
    }

    const newManagerId = manager_id !== undefined ? (manager_id ? Number(manager_id) : null) : team.manager_id;

    db.prepare(`
      UPDATE teams
      SET name = ?, description = ?, manager_id = ?, department_id = ?
      WHERE id = ?
    `).run(
      name.trim(),
      description !== undefined ? description.trim() : team.description,
      newManagerId,
      department_id !== undefined ? (department_id ? Number(department_id) : null) : team.department_id,
      id
    );

    // Synchronize members if provided
    if (Array.isArray(members)) {
      db.prepare('DELETE FROM team_members WHERE team_id = ?').run(id);
      const insertMember = db.prepare(`
        INSERT OR IGNORE INTO team_members (team_id, user_id, role_in_team)
        VALUES (?, ?, ?)
      `);
      for (const m of members) {
        const uId = typeof m === 'object' ? m.user_id : m;
        const role = typeof m === 'object' && m.role_in_team ? m.role_in_team.trim() : 'Member';
        if (uId) {
          insertMember.run(id, Number(uId), role || 'Member');
        }
      }
    }

    // Handle Project updates and linking
    if (project_id !== undefined) {
      if (!project_id) {
        // User explicitly unlinked project
        db.prepare('DELETE FROM team_projects WHERE team_id = ?').run(id);
      } else {
        const pId = Number(project_id);
        const prevProject = db.prepare('SELECT project_id FROM team_projects WHERE team_id = ?').get(id);
        db.prepare('DELETE FROM team_projects WHERE team_id = ?').run(id);
        db.prepare(`
          INSERT OR IGNORE INTO team_projects (team_id, project_id, assigned_by)
          VALUES (?, ?, ?)
        `).run(id, pId, req.user.id);

        // Notify team if this is a newly assigned project
        if (!prevProject || Number(prevProject.project_id) !== pId) {
          notifyTeamProjectAllocation({
            teamId: id,
            projectId: pId,
            allocatedByName: req.user.name
          });
        }


        // If project_name is provided, update the project entity itself
        if (project_name && project_name.trim()) {
          db.prepare(`
            UPDATE projects
            SET name = ?, description = ?, department_id = ?
            WHERE id = ?
          `).run(
            project_name.trim(),
            project_description !== undefined ? project_description.trim() : '',
            project_department_id ? Number(project_department_id) : null,
            pId
          );
        }
      }
    } else if (project_name && project_name.trim()) {
      // Find currently linked project or create a new one
      const currentTp = db.prepare('SELECT project_id FROM team_projects WHERE team_id = ?').get(id);
      if (currentTp) {
        db.prepare(`
          UPDATE projects
          SET name = ?, description = ?, department_id = ?
          WHERE id = ?
        `).run(
          project_name.trim(),
          project_description !== undefined ? project_description.trim() : '',
          project_department_id ? Number(project_department_id) : null,
          currentTp.project_id
        );
      } else {
        const newP = db.prepare(`
          INSERT INTO projects (name, description, department_id)
          VALUES (?, ?, ?)
        `).run(
          project_name.trim(),
          project_description ? project_description.trim() : '',
          project_department_id ? Number(project_department_id) : (department_id || null)
        );
        db.prepare(`
          INSERT INTO team_projects (team_id, project_id, assigned_by)
          VALUES (?, ?, ?)
        `).run(id, newP.lastInsertRowid, req.user.id);
      }
    }

    // Handle Project links update if provided
    if (links !== undefined) {
      const currentTp = db.prepare('SELECT project_id FROM team_projects WHERE team_id = ?').get(id);
      const targetPId = project_id ? Number(project_id) : (currentTp ? currentTp.project_id : null);
      if (targetPId) {
        const linksStr = typeof links === 'string' ? links.trim() : JSON.stringify(links);
        db.prepare('UPDATE projects SET links = ? WHERE id = ?').run(linksStr, targetPId);
      }
    }

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'UPDATE_TEAM',
      entityType: 'Team',
      entityId: id,
      details: `Updated squad "${name.trim()}" and associated project details`
    });

    const updated = db.prepare(`
      SELECT t.*, u.name as manager_name, d.name as department_name,
        (SELECT GROUP_CONCAT(p.name, ', ') FROM team_projects tp JOIN projects p ON tp.project_id = p.id WHERE tp.team_id = t.id) as project_names,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as total_members,
        (SELECT COUNT(*) FROM team_projects WHERE team_id = t.id) as total_projects
      FROM teams t
      LEFT JOIN users u ON t.manager_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.id = ?
    `).get(id);

    res.json({ message: 'Team and project updated successfully', team: updated });
  } catch (err) {
    console.error('Failed to update team:', err);
    res.status(500).json({ message: 'Failed to update team' });
  }
});

// DELETE team
router.delete('/:id', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    db.prepare('DELETE FROM teams WHERE id = ?').run(id);

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'DELETE_TEAM',
      entityType: 'Team',
      entityId: id,
      details: `Deleted team "${team.name}"`
    });

    res.json({ message: `Team "${team.name}" was deleted successfully.` });
  } catch (err) {
    console.error('Failed to delete team:', err);
    res.status(500).json({ message: 'Failed to delete team' });
  }
});

// ADD MEMBER to team
router.post('/:id/members', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, role_in_team } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const existing = db.prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?').get(id, user_id);
    if (existing) {
      return res.status(400).json({ message: 'User is already a member of this team.' });
    }

    db.prepare(`
      INSERT INTO team_members (team_id, user_id, role_in_team)
      VALUES (?, ?, ?)
    `).run(id, user_id, role_in_team || 'Member');

    // Notify newly added member of all projects currently allocated to this team
    try {
      const teamProjects = db.prepare(`
        SELECT p.id, p.name, p.description, d.name as department_name
        FROM team_projects tp
        JOIN projects p ON tp.project_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        WHERE tp.team_id = ?
      `).all(id);

      if (teamProjects.length > 0 && user.email && !user.email.endsWith('@company.local')) {
        for (const proj of teamProjects) {
          sendProjectAllocatedEmail({
            toEmail: user.email,
            recipientName: user.name,
            projectName: proj.name,
            teamName: team.name,
            departmentName: proj.department_name,
            description: proj.description,
            allocatedByName: req.user.name,
            roleInTeam: role_in_team || 'Member'
          }).catch(err => console.error('Failed to send project allocation email to new member:', err));
        }
      }
    } catch (projMailErr) {
      console.error('Failed to notify new team member of team projects:', projMailErr);
    }

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'ADD_TEAM_MEMBER',
      entityType: 'Team',
      entityId: id,
      details: `Added ${user.name} (${role_in_team || 'Member'}) to team "${team.name}"`
    });

    res.status(201).json({ message: `Added ${user.name} to team.` });
  } catch (err) {
    console.error('Failed to add team member:', err);
    res.status(500).json({ message: 'Failed to add team member' });
  }
});

// REMOVE MEMBER from team
router.delete('/:id/members/:userId', authenticateUser, (req, res) => {
  try {
    const { id, userId } = req.params;
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
    const team = db.prepare('SELECT name FROM teams WHERE id = ?').get(id);

    db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(id, userId);

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'REMOVE_TEAM_MEMBER',
      entityType: 'Team',
      entityId: id,
      details: `Removed ${user ? user.name : 'user'} from team "${team ? team.name : id}"`
    });

    res.json({ message: 'Member removed from team.' });
  } catch (err) {
    console.error('Failed to remove team member:', err);
    res.status(500).json({ message: 'Failed to remove team member' });
  }
});

// ALLOCATE PROJECT to team
router.post('/:id/projects', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    const { project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ message: 'Project ID is required.' });
    }

    const team = db.prepare('SELECT name FROM teams WHERE id = ?').get(id);
    const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(project_id);
    if (!team || !project) return res.status(404).json({ message: 'Team or Project not found.' });

    const existing = db.prepare('SELECT 1 FROM team_projects WHERE team_id = ? AND project_id = ?').get(id, project_id);
    if (existing) {
      return res.status(400).json({ message: 'Project is already allocated to this team.' });
    }

    db.prepare(`
      INSERT INTO team_projects (team_id, project_id, assigned_by)
      VALUES (?, ?, ?)
    `).run(id, project_id, req.user.id);

    // Dispatch Project Allocation Email to all team members and manager
    notifyTeamProjectAllocation({
      teamId: id,
      projectId: Number(project_id),
      allocatedByName: req.user.name
    });

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'ALLOCATE_PROJECT',
      entityType: 'Team',
      entityId: id,
      details: `Allocated project "${project.name}" to team "${team.name}"`
    });

    res.status(201).json({ message: `Project "${project.name}" allocated to team.` });
  } catch (err) {
    console.error('Failed to allocate project:', err);
    res.status(500).json({ message: 'Failed to allocate project' });
  }
});

// DEALLOCATE PROJECT from team
router.delete('/:id/projects/:projectId', authenticateUser, (req, res) => {
  try {
    const { id, projectId } = req.params;
    db.prepare('DELETE FROM team_projects WHERE team_id = ? AND project_id = ?').run(id, projectId);

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'DEALLOCATE_PROJECT',
      entityType: 'Team',
      entityId: id,
      details: `Deallocated project ${projectId} from team ${id}`
    });

    res.json({ message: 'Project deallocated from team.' });
  } catch (err) {
    console.error('Failed to deallocate project:', err);
    res.status(500).json({ message: 'Failed to deallocate project' });
  }
});

// ============================================================================
// CO-MANAGEMENT & SHARED PROJECT ROUTES
// ============================================================================

// GET projects manageable and shareable by the current user
router.get('/manageable-projects', authenticateUser, (req, res) => {
  try {
    const isUserAdmin = req.user.role === 'Admin';
    let sql = '';
    const params = [];

    if (isUserAdmin) {
      sql = `
        SELECT p.id, p.name, p.department_id, p.description, d.name as department_name,
               (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) as total_tasks,
               (SELECT COUNT(*) FROM project_shares ps WHERE ps.project_id = p.id) as shared_count,
               0 as is_co_managed
        FROM projects p
        LEFT JOIN departments d ON p.department_id = d.id
        ORDER BY p.name ASC
      `;
    } else {
      sql = `
        SELECT DISTINCT p.id, p.name, p.department_id, p.description, d.name as department_name,
               (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) as total_tasks,
               (SELECT COUNT(*) FROM project_shares ps WHERE ps.project_id = p.id) as shared_count,
               CASE 
                 WHEN EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = p.id AND ps.user_id = ?) THEN 1
                 ELSE 0
               END as is_co_managed
        FROM projects p
        LEFT JOIN departments d ON p.department_id = d.id
        WHERE p.created_by = ?
           OR EXISTS (
             SELECT 1 FROM team_projects tp 
             JOIN teams t ON tp.team_id = t.id 
             WHERE tp.project_id = p.id AND (t.manager_id = ? OR t.created_by = ?)
           )
           OR EXISTS (
             SELECT 1 FROM project_shares ps 
             WHERE ps.project_id = p.id AND ps.user_id = ?
           )
        ORDER BY p.name ASC
      `;
      params.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    }

    const projects = db.prepare(sql).all(...params);
    res.json({ projects });
  } catch (err) {
    console.error('Failed to get manageable projects:', err);
    res.status(500).json({ message: 'Failed to retrieve manageable projects' });
  }
});

// GET shares for a specific project
router.get('/projects/:projectId/shares', authenticateUser, (req, res) => {
  try {
    const { projectId } = req.params;
    const project = db.prepare(`
      SELECT p.*, d.name as department_name
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = ?
    `).get(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // Get current shared managers
    const shared_managers = db.prepare(`
      SELECT ps.id as share_id, ps.project_id, ps.user_id, ps.shared_by, ps.shared_at, ps.permission,
             u.name, u.email, u.avatar, u.role, d.name as department_name,
             sharer.name as shared_by_name
      FROM project_shares ps
      JOIN users u ON ps.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN users sharer ON ps.shared_by = sharer.id
      WHERE ps.project_id = ?
      ORDER BY ps.shared_at DESC
    `).all(projectId);

    // Get primary leads / owners for this project
    const owners = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.email, u.role, d.name as department_name, 'Lead' as role_type
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id IN (
        SELECT t.manager_id FROM teams t JOIN team_projects tp ON tp.team_id = t.id WHERE tp.project_id = ?
        UNION
        SELECT p.created_by FROM projects p WHERE p.id = ? AND p.created_by IS NOT NULL
      )
    `).all(projectId, projectId);

    // Get all available managers/admins who don't have access yet
    const existingUserIds = new Set([
      ...shared_managers.map(m => m.user_id),
      ...owners.map(o => o.id),
      req.user.id
    ]);

    const allManagers = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role IN ('Manager', 'Admin')
      ORDER BY u.name ASC
    `).all();

    const available_managers = allManagers.filter(m => !existingUserIds.has(m.id));

    res.json({
      project,
      owners,
      shared_managers,
      available_managers,
      is_co_managed: shared_managers.some(m => m.user_id === req.user.id)
    });
  } catch (err) {
    console.error('Failed to get project shares:', err);
    res.status(500).json({ message: 'Failed to retrieve project shares' });
  }
});

// SHARE PROJECT with one or more managers
router.post('/projects/:projectId/share', authenticateUser, (req, res) => {
  try {
    const { projectId } = req.params;
    const { manager_id, manager_ids } = req.body;

    const targetIds = Array.isArray(manager_ids) ? manager_ids : (manager_id ? [manager_id] : []);
    if (targetIds.length === 0) {
      return res.status(400).json({ message: 'Please select at least one manager to share with.' });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // Permission check: Admin or authorized manager for this project
    const isAdmin = req.user.role === 'Admin';
    const isOwnerOrLead = db.prepare(`
      SELECT 1 FROM projects p WHERE p.id = ? AND p.created_by = ?
      UNION
      SELECT 1 FROM team_projects tp JOIN teams t ON tp.team_id = t.id WHERE tp.project_id = ? AND (t.manager_id = ? OR t.created_by = ?)
    `).get(projectId, req.user.id, projectId, req.user.id, req.user.id);
    const isExistingCoManager = db.prepare('SELECT 1 FROM project_shares WHERE project_id = ? AND user_id = ?').get(projectId, req.user.id);

    if (!isAdmin && !isOwnerOrLead && !isExistingCoManager) {
      return res.status(403).json({ message: 'Permission denied. You do not manage this project.' });
    }

    let sharedCount = 0;
    const targetUsers = [];

    for (const rawId of targetIds) {
      const targetId = Number(rawId);
      if (!targetId || targetId === req.user.id) continue;

      const targetUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(targetId);
      if (!targetUser || !['Manager', 'Admin'].includes(targetUser.role)) continue;

      db.prepare(`
        INSERT OR IGNORE INTO project_shares (project_id, user_id, shared_by, permission)
        VALUES (?, ?, ?, 'manage')
      `).run(Number(projectId), targetId, req.user.id);

      sharedCount++;
      targetUsers.push(targetUser);

      createNotification({
        userId: targetId,
        senderId: req.user.id,
        senderName: req.user.name,
        type: 'PROJECT_SHARED',
        entityType: 'Project',
        entityId: Number(projectId),
        title: 'Project Shared with You (Co-Manager)',
        message: `${req.user.name} shared project "${project.name}" with you. You now have full management powers over this project.`
      });

      logSystemAction({
        userId: req.user.id,
        userName: req.user.name,
        role: req.user.role,
        action: 'SHARE_PROJECT',
        entityType: 'Project',
        entityId: Number(projectId),
        details: `Shared project "${project.name}" with manager ${targetUser.name} (${targetUser.email}) as co-manager`
      });
    }

    res.json({
      message: `Project "${project.name}" shared with ${sharedCount} manager(s) successfully.`,
      sharedCount,
      targetUsers
    });
  } catch (err) {
    console.error('Failed to share project:', err);
    res.status(500).json({ message: 'Failed to share project' });
  }
});

// REVOKE / UNSHARE PROJECT from a manager
router.delete('/projects/:projectId/share/:userId', authenticateUser, (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const targetId = Number(userId);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    const targetUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(targetId);

    // Permission check
    const isAdmin = req.user.role === 'Admin';
    const isSelf = req.user.id === targetId;
    const isOwnerOrLead = db.prepare(`
      SELECT 1 FROM projects p WHERE p.id = ? AND p.created_by = ?
      UNION
      SELECT 1 FROM team_projects tp JOIN teams t ON tp.team_id = t.id WHERE tp.project_id = ? AND (t.manager_id = ? OR t.created_by = ?)
    `).get(projectId, req.user.id, projectId, req.user.id, req.user.id);
    const isSharer = db.prepare('SELECT 1 FROM project_shares WHERE project_id = ? AND user_id = ? AND shared_by = ?').get(projectId, targetId, req.user.id);

    if (!isAdmin && !isSelf && !isOwnerOrLead && !isSharer) {
      return res.status(403).json({ message: 'Permission denied to remove co-manager from this project.' });
    }

    db.prepare('DELETE FROM project_shares WHERE project_id = ? AND user_id = ?').run(projectId, targetId);

    logSystemAction({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'REVOKE_PROJECT_SHARE',
      entityType: 'Project',
      entityId: Number(projectId),
      details: `Revoked co-manager access of ${targetUser ? targetUser.name : `User ${targetId}`} for project "${project.name}"`
    });

    res.json({ message: `Co-management access revoked successfully.` });
  } catch (err) {
    console.error('Failed to revoke project share:', err);
    res.status(500).json({ message: 'Failed to revoke project share' });
  }
});

export default router;
