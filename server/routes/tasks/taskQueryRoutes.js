import express from 'express';
import db, { purgeExpiredRecycleBinTasks } from '../../db/index.js';
import { authenticateUser } from '../../middleware/auth.js';
import { syncOverdueStatus } from './taskHelpers.js';

const router = express.Router();

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

  if (req.user.role === 'Employee' || req.user.role === 'Intern' || req.user.role === 'Manager') {
    if (scope === 'ASSIGNED_BY_ME' || scope === 'assigned_by_me' || assigned_by === 'ME') {
      // Show ONLY tasks assigned BY this user
      conditions.push('t.assigned_by = ?');
      params.push(req.user.id);
    } else if (scope === 'ASSIGNED_TO_ME' || scope === 'assigned_to_me' || scope === 'MY_TASKS') {
      // Show tasks assigned TO this user OR where user is added as a dependency
      conditions.push('(t.assigned_to = ? OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?))');
      params.push(req.user.id, req.user.id);
    } else if (scope === 'DEPENDENCY_TASKS' || scope === 'dependency_tasks' || scope === 'COLLABORATIVE_TASKS') {
      // Show tasks where user is added as a dependency
      conditions.push('EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?)');
      params.push(req.user.id);
    } else if (scope === 'TEAM_TASKS' || scope === 'SHARED_PROJECT_TASKS') {
      // Show tasks of teammates in same squad sharing the same project (excluding own tasks and tasks where user is a dependency)
      conditions.push(`(
        t.assigned_to != ?
        AND NOT EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?)
        AND EXISTS (
          SELECT 1 FROM teams squad
          WHERE (
            (squad.manager_id = ? OR EXISTS (SELECT 1 FROM team_members tm1 WHERE tm1.team_id = squad.id AND tm1.user_id = ?))
            AND
            (squad.manager_id = t.assigned_to OR EXISTS (SELECT 1 FROM team_members tm2 WHERE tm2.team_id = squad.id AND tm2.user_id = t.assigned_to))
            AND
            (
              EXISTS (SELECT 1 FROM team_projects tp WHERE tp.team_id = squad.id AND tp.project_id = t.project_id)
              OR EXISTS (SELECT 1 FROM tasks my_t WHERE (my_t.assigned_to = ? OR EXISTS (SELECT 1 FROM task_dependencies td2 WHERE td2.task_id = my_t.id AND td2.user_id = ?)) AND my_t.project_id = t.project_id AND my_t.deleted_at IS NULL)
            )
          )
        )
        OR EXISTS (
          SELECT 1 FROM project_shares ps WHERE ps.project_id = t.project_id AND ps.user_id = ?
        )
      )`);
      params.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    } else if (scope === 'ALL' || (req.user.role === 'Manager' && !scope)) {
      // Manager overview or explicit ALL scope:
      // Show tasks assigned TO or BY this user, or where user is a dependency, OR tasks of teammates in the same team who share the same project, OR tasks in shared projects
      conditions.push(`(
        t.assigned_to = ? 
        OR t.assigned_by = ? 
        OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?)
        OR EXISTS (
          SELECT 1 FROM teams squad
          WHERE (
            (squad.manager_id = ? OR EXISTS (SELECT 1 FROM team_members tm1 WHERE tm1.team_id = squad.id AND tm1.user_id = ?))
            AND
            (squad.manager_id = t.assigned_to OR EXISTS (SELECT 1 FROM team_members tm2 WHERE tm2.team_id = squad.id AND tm2.user_id = t.assigned_to))
            AND
            (
              EXISTS (SELECT 1 FROM team_projects tp WHERE tp.team_id = squad.id AND tp.project_id = t.project_id)
              OR EXISTS (SELECT 1 FROM tasks my_t WHERE (my_t.assigned_to = ? OR EXISTS (SELECT 1 FROM task_dependencies td2 WHERE td2.task_id = my_t.id AND td2.user_id = ?)) AND my_t.project_id = t.project_id AND my_t.deleted_at IS NULL)
            )
          )
        )
        OR EXISTS (
          SELECT 1 FROM project_shares ps WHERE ps.project_id = t.project_id AND ps.user_id = ?
        )
      )`);
      params.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    } else {
      // Default for Employee & Intern (Personal Tasks Dashboard):
      // Shows ONLY deliverables assigned to this user or where they are added as a collaborative dependency.
      // This ensures non-managers never see arbitrary other employees' tasks cluttering their dashboard!
      conditions.push('(t.assigned_to = ? OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?))');
      params.push(req.user.id, req.user.id);
    }
  } else if (req.user.role === 'Admin') {
    if (scope === 'ASSIGNED_TO_ME' || scope === 'assigned_to_me' || scope === 'MY_TASKS') {
      conditions.push('(t.assigned_to = ? OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?))');
      params.push(req.user.id, req.user.id);
    } else if (scope === 'DEPENDENCY_TASKS' || scope === 'dependency_tasks' || scope === 'COLLABORATIVE_TASKS') {
      conditions.push('EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?)');
      params.push(req.user.id);
    } else if (scope === 'ASSIGNED_BY_ME' || scope === 'assigned_by_me') {
      conditions.push('t.assigned_by = ?');
      params.push(req.user.id);
    } else if (assigned_by && assigned_by !== 'ALL' && assigned_by !== 'all') {
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

  // Filter by assigned employee (include both primary assignee and dependencies)
  if (assigned_to) {
    conditions.push('(t.assigned_to = ? OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ?))');
    params.push(assigned_to, assigned_to);
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
      COALESCE(assigner.name, 'Administrator') as assigned_by_name,
      COALESCE(assigner.role, 'Admin') as assigned_by_role,
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

  // Attach dependencies for tasks
  if (tasks.length > 0) {
    const taskIds = tasks.map(t => t.id);
    const deps = db.prepare(`
      SELECT td.task_id, u.id, u.name, u.email, u.role, u.avatar, COALESCE(u.title, 'Employee') as title
      FROM task_dependencies td
      JOIN users u ON td.user_id = u.id
      WHERE td.task_id IN (${taskIds.map(() => '?').join(',')})
    `).all(...taskIds);

    const depsByTaskId = {};
    for (const dep of deps) {
      if (!depsByTaskId[dep.task_id]) depsByTaskId[dep.task_id] = [];
      depsByTaskId[dep.task_id].push(dep);
    }

    for (const t of tasks) {
      t.dependencies = depsByTaskId[t.id] || [];
    }
  }

  // Summary Metrics calculation for Dashboard
  let summaryConditions = ['t.deleted_at IS NULL'];
  if (req.user.role === 'Employee' || req.user.role === 'Intern' || req.user.role === 'Manager') {
    if (scope === 'ASSIGNED_BY_ME' || scope === 'assigned_by_me' || assigned_by === 'ME') {
      summaryConditions.push(`t.assigned_by = ${req.user.id}`);
    } else if (scope === 'ASSIGNED_TO_ME' || scope === 'assigned_to_me' || scope === 'MY_TASKS') {
      summaryConditions.push(`(t.assigned_to = ${req.user.id} OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ${req.user.id}))`);
    } else if (scope === 'DEPENDENCY_TASKS' || scope === 'dependency_tasks' || scope === 'COLLABORATIVE_TASKS') {
      summaryConditions.push(`EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ${req.user.id})`);
    } else if (scope === 'TEAM_TASKS' || scope === 'SHARED_PROJECT_TASKS') {
      summaryConditions.push(`(t.assigned_to != ${req.user.id} AND NOT EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ${req.user.id}) AND EXISTS (SELECT 1 FROM teams squad WHERE ((squad.manager_id = ${req.user.id} OR EXISTS (SELECT 1 FROM team_members tm1 WHERE tm1.team_id = squad.id AND tm1.user_id = ${req.user.id})) AND (squad.manager_id = t.assigned_to OR EXISTS (SELECT 1 FROM team_members tm2 WHERE tm2.team_id = squad.id AND tm2.user_id = t.assigned_to)) AND (EXISTS (SELECT 1 FROM team_projects tp WHERE tp.team_id = squad.id AND tp.project_id = t.project_id) OR EXISTS (SELECT 1 FROM tasks my_t WHERE (my_t.assigned_to = ${req.user.id} OR EXISTS (SELECT 1 FROM task_dependencies td2 WHERE td2.task_id = my_t.id AND td2.user_id = ${req.user.id})) AND my_t.project_id = t.project_id AND my_t.deleted_at IS NULL)))))`);
    } else if (scope === 'ALL' || (req.user.role === 'Manager' && !scope)) {
      summaryConditions.push(`(t.assigned_to = ${req.user.id} OR t.assigned_by = ${req.user.id} OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ${req.user.id}) OR EXISTS (SELECT 1 FROM teams squad WHERE ((squad.manager_id = ${req.user.id} OR EXISTS (SELECT 1 FROM team_members tm1 WHERE tm1.team_id = squad.id AND tm1.user_id = ${req.user.id})) AND (squad.manager_id = t.assigned_to OR EXISTS (SELECT 1 FROM team_members tm2 WHERE tm2.team_id = squad.id AND tm2.user_id = t.assigned_to)) AND (EXISTS (SELECT 1 FROM team_projects tp WHERE tp.team_id = squad.id AND tp.project_id = t.project_id) OR EXISTS (SELECT 1 FROM tasks my_t WHERE (my_t.assigned_to = ${req.user.id} OR EXISTS (SELECT 1 FROM task_dependencies td2 WHERE td2.task_id = my_t.id AND td2.user_id = ${req.user.id})) AND my_t.project_id = t.project_id AND my_t.deleted_at IS NULL)))) OR EXISTS (SELECT 1 FROM project_shares ps WHERE ps.project_id = t.project_id AND ps.user_id = ${req.user.id}))`);
    } else {
      // Default for Employee & Intern (Personal Tasks Dashboard):
      summaryConditions.push(`(t.assigned_to = ${req.user.id} OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ${req.user.id}))`);
    }
  } else if (req.user.role === 'Admin') {
    if (scope === 'ASSIGNED_TO_ME' || scope === 'assigned_to_me' || scope === 'MY_TASKS') {
      summaryConditions.push(`(t.assigned_to = ${req.user.id} OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ${req.user.id}))`);
    } else if (scope === 'DEPENDENCY_TASKS' || scope === 'dependency_tasks' || scope === 'COLLABORATIVE_TASKS') {
      summaryConditions.push(`EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ${req.user.id})`);
    } else if (scope === 'ASSIGNED_BY_ME' || scope === 'assigned_by_me') {
      summaryConditions.push(`t.assigned_by = ${req.user.id}`);
    } else if (assigned_by && assigned_by !== 'ALL' && assigned_by !== 'all') {
      summaryConditions.push(`t.assigned_by = ${assigned_by}`);
    }
  }

  if (assigned_to) {
    summaryConditions.push(`(t.assigned_to = ${Number(assigned_to)} OR EXISTS (SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id AND td.user_id = ${Number(assigned_to)}))`);
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
      COALESCE(assigner.name, 'Administrator') as assigned_by_name,
      COALESCE(assigner.role, 'Admin') as assigned_by_role,
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

  // Employee guard: access allowed if assigned TO, assigned BY, or added as dependency, or teammate in same team with same project
  if ((req.user.role === 'Employee' || req.user.role === 'Intern') && task.assigned_to !== req.user.id && task.assigned_by !== req.user.id) {
    const isDependency = db.prepare('SELECT 1 FROM task_dependencies WHERE task_id = ? AND user_id = ?').get(task.id, req.user.id);
    if (!isDependency) {
      const isSharedTeamProject = db.prepare(`
        SELECT 1 FROM teams squad
        WHERE (
          (squad.manager_id = ? OR EXISTS (SELECT 1 FROM team_members tm1 WHERE tm1.team_id = squad.id AND tm1.user_id = ?))
          AND
          (squad.manager_id = ? OR EXISTS (SELECT 1 FROM team_members tm2 WHERE tm2.team_id = squad.id AND tm2.user_id = ?))
          AND
          (
            EXISTS (SELECT 1 FROM team_projects tp WHERE tp.team_id = squad.id AND tp.project_id = ?)
            OR EXISTS (SELECT 1 FROM tasks my_t WHERE my_t.assigned_to = ? AND my_t.project_id = ? AND my_t.deleted_at IS NULL)
          )
        ) LIMIT 1
      `).get(req.user.id, req.user.id, task.assigned_to, task.assigned_to, task.project_id, req.user.id, task.project_id);

      if (!isSharedTeamProject) {
        return res.status(403).json({ message: 'Access denied to this task.' });
      }
    }
  }

  // Fetch dependencies
  const dependencies = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.avatar, COALESCE(u.title, 'Employee') as title, d.name as department_name
    FROM task_dependencies td
    JOIN users u ON td.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE td.task_id = ?
    ORDER BY u.name ASC
  `).all(task.id);

  task.dependencies = dependencies;

  // Fetch comments
  const comments = db.prepare(`
    SELECT c.*, COALESCE(u.name, 'Former Employee') as user_name, COALESCE(u.role, 'Employee') as user_role, u.avatar as user_avatar
    FROM task_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(task.id);

  // Fetch attachments
  const attachments = db.prepare(`
    SELECT a.*, COALESCE(u.name, 'Former Employee') as user_name
    FROM task_attachments a
    LEFT JOIN users u ON a.user_id = u.id
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
    dependencies,
    comments,
    attachments,
    history
  });
});

export default router;
