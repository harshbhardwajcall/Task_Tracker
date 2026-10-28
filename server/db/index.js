import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'tracker.db');

const SQL = await initSqlJs();
let rawDb;

if (fs.existsSync(dbPath)) {
  const fileBuffer = fs.readFileSync(dbPath);
  rawDb = new SQL.Database(fileBuffer);
} else {
  rawDb = new SQL.Database();
}

function saveDb() {
  const data = rawDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

const db = {
  exec(sql) {
    rawDb.run(sql);
    saveDb();
  },
  prepare(sql) {
    return {
      get(...params) {
        // Flatten params if passed as array
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const stmt = rawDb.prepare(sql);
        stmt.bind(flatParams);
        let result = null;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      all(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const stmt = rawDb.prepare(sql);
        stmt.bind(flatParams);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
      run(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        rawDb.run(sql, flatParams);
        const lastIdRes = rawDb.exec('SELECT last_insert_rowid() as id');
        const lastInsertRowid = lastIdRes && lastIdRes[0] && lastIdRes[0].values[0] ? lastIdRes[0].values[0][0] : null;
        saveDb();
        return { lastInsertRowid };
      }
    };
  }
};

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      department_id INTEGER,
      description TEXT,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      department_id INTEGER,
      title TEXT DEFAULT 'Employee',
      avatar TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      assigned_by INTEGER,
      assigned_to INTEGER,
      project_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      assigned_date TEXT NOT NULL,
      start_date TEXT NOT NULL,
      due_date TEXT,
      completed_date TEXT,
      priority TEXT CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')) NOT NULL DEFAULT 'Medium',
      status TEXT CHECK(status IN ('Not Started', 'In Progress', 'On Hold', 'Completed', 'Overdue')) NOT NULL DEFAULT 'Not Started',
      employee_comments TEXT,
      manager_remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_by) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT,
      image_url TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS task_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      manager_id INTEGER NOT NULL,
      department_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role_in_team TEXT DEFAULT 'Member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, user_id),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_projects (
      team_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      assigned_by INTEGER,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (team_id, project_id),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS self_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      category TEXT DEFAULT 'Test',
      status TEXT DEFAULT 'Open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS manager_permissions (
      user_id INTEGER PRIMARY KEY,
      can_create_tasks INTEGER DEFAULT 1,
      can_edit_tasks INTEGER DEFAULT 1,
      can_delete_tasks INTEGER DEFAULT 1,
      can_create_teams INTEGER DEFAULT 1,
      can_delete_teams INTEGER DEFAULT 1,
      can_manage_members INTEGER DEFAULT 1,
      can_create_projects INTEGER DEFAULT 0,
      can_edit_projects INTEGER DEFAULT 0,
      can_delete_projects INTEGER DEFAULT 0,
      can_view_all_tasks INTEGER DEFAULT 1,
      can_view_reports INTEGER DEFAULT 1,
      can_access_recycle_bin INTEGER DEFAULT 1,
      can_empty_recycle_bin INTEGER DEFAULT 0,
      can_view_change_history INTEGER DEFAULT 0,
      allowed_tabs TEXT DEFAULT '["dashboard","teams","self_logs","completed_tasks","reports"]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender_id INTEGER,
      sender_name TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Migrate users table if check constraint fails on Admin & bootstrap initial admin from .env
  try {
    const adminExists = db.prepare("SELECT id FROM users WHERE role = 'Admin'").get();
    if (!adminExists) {
      const defaultEmail = (process.env.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase();
      const defaultPass = process.env.DEFAULT_ADMIN_PASSWORD || '';

      if (!defaultEmail || !defaultPass) {
        console.warn('⚠️ No Administrator account found in database. Set DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD in your .env file to bootstrap initial admin.');
        return;
      }

      const hashedPass = bcrypt.hashSync(defaultPass, 10);

      try {
        db.prepare("INSERT INTO users (name, email, password, role, department_id, title) VALUES ('System Admin', ?, ?, 'Admin', 1, 'Administrator')").run(defaultEmail, hashedPass);
      } catch (insertErr) {
        // Table has old CHECK constraint - rebuild users table
        db.exec(`
          CREATE TABLE users_temp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            department_id INTEGER,
            title TEXT DEFAULT 'Employee',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
          );
          INSERT INTO users_temp (id, name, email, password, role, department_id, title, created_at)
          SELECT id, name, email, password, role, department_id, COALESCE(title, 'Employee'), created_at FROM users;
          DROP TABLE users;
          ALTER TABLE users_temp RENAME TO users;
        `);

        // Now insert admin
        db.prepare("INSERT INTO users (name, email, password, role, department_id, title) VALUES ('System Admin', ?, ?, 'Admin', 1, 'Administrator')").run(defaultEmail, hashedPass);
      }
    }
  } catch (e) {
    console.error('User table migration error:', e);
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN title TEXT DEFAULT 'Employee';`);
  } catch (e) {
    // Column already exists or already migrated
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT NULL;`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN deleted_at DATETIME DEFAULT NULL;`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE task_comments ADD COLUMN image_url TEXT DEFAULT NULL;`);
  } catch (e) {
    // Column already exists
  }

  // Migrate tasks table to ensure due_date is nullable
  try {
    const testNullable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get();
    if (testNullable && testNullable.sql && testNullable.sql.includes('due_date TEXT NOT NULL')) {
      db.exec(`
        CREATE TABLE tasks_temp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          assigned_by INTEGER NOT NULL,
          assigned_to INTEGER NOT NULL,
          project_id INTEGER NOT NULL,
          department_id INTEGER NOT NULL,
          assigned_date TEXT NOT NULL,
          start_date TEXT NOT NULL,
          due_date TEXT,
          completed_date TEXT,
          priority TEXT NOT NULL DEFAULT 'Medium',
          status TEXT NOT NULL DEFAULT 'Not Started',
          employee_comments TEXT,
          manager_remarks TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          deleted_at DATETIME DEFAULT NULL,
          FOREIGN KEY (assigned_by) REFERENCES users(id),
          FOREIGN KEY (assigned_to) REFERENCES users(id),
          FOREIGN KEY (project_id) REFERENCES projects(id),
          FOREIGN KEY (department_id) REFERENCES departments(id)
        );
        INSERT INTO tasks_temp (id, task_id, title, description, assigned_by, assigned_to, project_id, department_id, assigned_date, start_date, due_date, completed_date, priority, status, employee_comments, manager_remarks, created_at, last_updated, deleted_at)
        SELECT id, task_id, title, description, assigned_by, assigned_to, project_id, department_id, assigned_date, start_date, due_date, completed_date, priority, status, employee_comments, manager_remarks, created_at, last_updated, deleted_at FROM tasks;
        DROP TABLE tasks;
        ALTER TABLE tasks_temp RENAME TO tasks;
      `);
    }
  } catch (e) {
    console.error('Task due_date nullable migration error:', e);
  }

  // Ensure tasks table allows nullable assigned_to and assigned_by so deleted employees' tasks are retained
  try {
    const taskTableInfo = db.prepare("PRAGMA table_info(tasks)").all();
    const assignedToCol = taskTableInfo.find(c => c.name === 'assigned_to');
    if (assignedToCol && assignedToCol.notnull === 1) {
      db.exec(`
        CREATE TABLE tasks_temp_reassign (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          assigned_by INTEGER,
          assigned_to INTEGER,
          project_id INTEGER NOT NULL,
          department_id INTEGER NOT NULL,
          assigned_date TEXT NOT NULL,
          start_date TEXT NOT NULL,
          due_date TEXT,
          completed_date TEXT,
          priority TEXT NOT NULL DEFAULT 'Medium',
          status TEXT NOT NULL DEFAULT 'Not Started',
          employee_comments TEXT,
          manager_remarks TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          deleted_at DATETIME DEFAULT NULL,
          FOREIGN KEY (assigned_by) REFERENCES users(id),
          FOREIGN KEY (assigned_to) REFERENCES users(id),
          FOREIGN KEY (project_id) REFERENCES projects(id),
          FOREIGN KEY (department_id) REFERENCES departments(id)
        );
        INSERT INTO tasks_temp_reassign (id, task_id, title, description, assigned_by, assigned_to, project_id, department_id, assigned_date, start_date, due_date, completed_date, priority, status, employee_comments, manager_remarks, created_at, last_updated, deleted_at)
        SELECT id, task_id, title, description, assigned_by, assigned_to, project_id, department_id, assigned_date, start_date, due_date, completed_date, priority, status, employee_comments, manager_remarks, created_at, last_updated, deleted_at FROM tasks;
        DROP TABLE tasks;
        ALTER TABLE tasks_temp_reassign RENAME TO tasks;
      `);
    }
  } catch (e) {
    console.error('Task table reassignment migration error:', e);
  }

  // Add v2 time evaluation and notification columns to tasks if not present
  const taskCols = [
    { name: 'team_id', def: 'INTEGER REFERENCES teams(id) ON DELETE SET NULL' },
    { name: 'estimated_hours', def: 'REAL DEFAULT 0.0' },
    { name: 'actual_hours', def: 'REAL DEFAULT 0.0' },
    { name: 'started_at', def: 'DATETIME DEFAULT NULL' },
    { name: 'completed_at', def: 'DATETIME DEFAULT NULL' },
    { name: 'completion_duration_hours', def: 'REAL DEFAULT 0.0' },
    { name: 'email_notified_at', def: 'DATETIME DEFAULT NULL' },
    { name: 'deadline_warning_sent', def: 'INTEGER DEFAULT 0' },
    { name: 'overdue_warning_sent', def: 'INTEGER DEFAULT 0' },
    { name: 'links', def: "TEXT DEFAULT '[]'" },
    { name: 'is_loop', def: 'INTEGER DEFAULT 0' },
    { name: 'loop_interval_hours', def: 'REAL DEFAULT 24.0' },
    { name: 'next_run_at', def: 'DATETIME DEFAULT NULL' },
    { name: 'loop_count', def: 'INTEGER DEFAULT 0' },
    { name: 'loop_warning_sent', def: 'INTEGER DEFAULT 0' }
  ];

  for (const col of taskCols) {
    try {
      db.exec(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.def};`);
    } catch (e) {
      // Column already exists
    }
  }

  // Add personal tasks and notes columns to self_logs if not present
  const selfLogCols = [
    { name: 'log_id', def: "TEXT DEFAULT ''" },
    { name: 'type', def: "TEXT DEFAULT 'task'" },
    { name: 'description', def: "TEXT DEFAULT ''" },
    { name: 'links', def: "TEXT DEFAULT '[]'" },
    { name: 'start_date', def: 'TEXT DEFAULT NULL' },
    { name: 'due_date', def: 'TEXT DEFAULT NULL' },
    { name: 'completed_date', def: 'TEXT DEFAULT NULL' },
    { name: 'is_loop', def: 'INTEGER DEFAULT 0' },
    { name: 'loop_interval_hours', def: 'REAL DEFAULT 24.0' },
    { name: 'next_run_at', def: 'DATETIME DEFAULT NULL' },
    { name: 'loop_count', def: 'INTEGER DEFAULT 0' },
    { name: 'loop_warning_sent', def: 'INTEGER DEFAULT 0' },
    { name: 'project_id', def: 'INTEGER DEFAULT NULL' },
    { name: 'project_name', def: 'TEXT DEFAULT NULL' }
  ];

  for (const col of selfLogCols) {
    try {
      db.exec(`ALTER TABLE self_logs ADD COLUMN ${col.name} ${col.def};`);
    } catch (e) {
      // Column already exists
    }
  }

  // Add team_code column to teams if not present
  const teamCols = [
    { name: 'team_code', def: "TEXT DEFAULT ''" }
  ];

  for (const col of teamCols) {
    try {
      db.exec(`ALTER TABLE teams ADD COLUMN ${col.name} ${col.def};`);
    } catch (e) {
      // Column already exists
    }
  }

  // Ensure Admin Tasks / Administration department exists
  try {
    const adminDept = db.prepare("SELECT id FROM departments WHERE name = 'Admin Tasks' OR name = 'Administration'").get();
    if (!adminDept) {
      db.prepare("INSERT INTO departments (name, description) VALUES ('Admin Tasks', 'Executive administration, leadership deliverables, and management operations')").run();
    }
  } catch (e) {}

  // Ensure teams has created_by column
  try {
    db.exec(`ALTER TABLE teams ADD COLUMN created_by INTEGER REFERENCES users(id);`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`UPDATE teams SET created_by = 50 WHERE id = 3 AND created_by IS NULL;`);
    db.exec(`UPDATE teams SET created_by = manager_id WHERE created_by IS NULL;`);
  } catch (e) {}

  // Ensure projects has links, media, and remarks columns
  try { db.exec(`ALTER TABLE projects ADD COLUMN links TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE projects ADD COLUMN media TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE projects ADD COLUMN remarks TEXT;`); } catch (e) {}

  // Ensure job_titles table exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_titles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const jtCount = db.prepare("SELECT COUNT(*) as count FROM job_titles").get();
    if (!jtCount || jtCount.count === 0) {
      const defaultTitles = [
        'Software Engineer',
        'Frontend Developer',
        'Backend Developer',
        'Full Stack Developer',
        'UI/UX Designer',
        'QA Engineer',
        'Engineering Manager',
        'Operations Manager',
        'Product Manager',
        'Project Manager',
        'Tech Lead',
        'DevOps Engineer',
        'Business Analyst',
        'Marketing Specialist',
        'Sales Executive',
        'HR Executive',
        'React Developer Intern',
        'UI/UX Design Intern',
        'Marketing Intern'
      ];
      for (const t of defaultTitles) {
        db.prepare("INSERT OR IGNORE INTO job_titles (title) VALUES (?)").run(t);
      }
    }

    db.exec(`
      INSERT OR IGNORE INTO job_titles (title)
      SELECT DISTINCT TRIM(title) FROM users WHERE title IS NOT NULL AND TRIM(title) != '' AND title != 'Administrator';
    `);
  } catch (e) {
    console.error('Job titles table init error:', e);
  }

  // Ensure task_dependencies table exists in current database
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(task_id, user_id)
      );
    `);
  } catch (e) {
    console.error('Task dependencies table migration error:', e);
  }

  // Ensure project_removed_members table exists and backfill past removals from system_logs
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_removed_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        removed_by INTEGER,
        removed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        unassigned_task_count INTEGER DEFAULT 0,
        unassigned_task_ids TEXT DEFAULT '[]',
        deliverables_snapshot TEXT DEFAULT '[]',
        notes TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (removed_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // Backfill historical removal logs if project_removed_members is empty
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM project_removed_members').get();
    if (!existingCount || existingCount.count === 0) {
      const pastRemovalLogs = db.prepare(`
        SELECT * FROM system_logs 
        WHERE action = 'REMOVE_EMPLOYEE_FROM_PROJECT'
        ORDER BY id ASC
      `).all();

      for (const log of pastRemovalLogs) {
        try {
          const projectId = Number(log.entity_id);
          const match = log.details ? log.details.match(/Removed (.+?) from project/i) : null;
          if (match && match[1]) {
            const userName = match[1].trim();
            const user = db.prepare('SELECT id FROM users WHERE LOWER(name) = LOWER(?)').get(userName);
            if (user && projectId) {
              const countMatch = log.details.match(/unassigned (\d+) deliverables/i);
              const count = countMatch ? parseInt(countMatch[1], 10) : 0;

              // Find unassigned or matching tasks in this project
              const unassignedTasks = db.prepare('SELECT id, task_id, title, status, priority, estimated_hours, due_date FROM tasks WHERE project_id = ? AND (assigned_to IS NULL OR assigned_to = ?)').all(projectId, user.id);
              const taskIds = unassignedTasks.map(t => t.id);

              db.prepare(`
                INSERT INTO project_removed_members (project_id, user_id, removed_by, removed_at, unassigned_task_count, unassigned_task_ids, deliverables_snapshot, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                projectId,
                user.id,
                log.user_id,
                log.created_at,
                count || unassignedTasks.length,
                JSON.stringify(taskIds),
                JSON.stringify(unassignedTasks),
                log.details
              );
            }
          }
        } catch (migErr) {
          console.error('Error backfilling historical removed member:', migErr);
        }
      }
    }
  } catch (err) {
    console.error('Error initializing project_removed_members:', err);
  }

  // Ensure project_shares table exists for co-managing shared projects
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        shared_by INTEGER NOT NULL,
        permission TEXT DEFAULT 'manage',
        shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_project_shares_user ON project_shares(user_id);
      CREATE INDEX IF NOT EXISTS idx_project_shares_proj ON project_shares(project_id);
    `);

    // Ensure created_by column on projects table
    const projCols = db.prepare("PRAGMA table_info(projects)").all();
    if (!projCols.some(c => c.name === 'created_by')) {
      db.exec("ALTER TABLE projects ADD COLUMN created_by INTEGER DEFAULT NULL");
    }

    // Ensure team_shares table exists for co-managing shared teams
    db.exec(`
      CREATE TABLE IF NOT EXISTS team_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        shared_by INTEGER NOT NULL,
        permission TEXT DEFAULT 'manage',
        shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_id, user_id),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_team_shares_user ON team_shares(user_id);
      CREATE INDEX IF NOT EXISTS idx_team_shares_team ON team_shares(team_id);
    `);
  } catch (err) {
    console.error('Error initializing shares tables:', err);
  }

  // Purge expired recycle bin tasks (older than 10 days)
  purgeExpiredRecycleBinTasks();
}

export function purgeExpiredRecycleBinTasks() {
  try {
    const expired = db.prepare(`
      SELECT id FROM tasks 
      WHERE deleted_at IS NOT NULL 
      AND datetime(deleted_at, '+10 days') <= datetime('now')
    `).all();

    if (expired && expired.length > 0) {
      const uploadDir = path.join(process.cwd(), 'uploads');
      for (const t of expired) {
        // Delete attached physical files from disk
        const attachments = db.prepare('SELECT file_path FROM task_attachments WHERE task_id = ?').all(t.id);
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

        db.prepare("DELETE FROM task_history WHERE task_id = ?").run(t.id);
        db.prepare("DELETE FROM task_attachments WHERE task_id = ?").run(t.id);
        db.prepare("DELETE FROM task_comments WHERE task_id = ?").run(t.id);
        db.prepare("DELETE FROM task_dependencies WHERE task_id = ?").run(t.id);
        db.prepare("DELETE FROM tasks WHERE id = ?").run(t.id);
      }
    }
  } catch (e) {
    console.error('Error purging expired tasks:', e);
  }
}

export function logSystemAction({ userId, userName, role, action, entityType, entityId, details }) {
  try {
    db.prepare(`
      INSERT INTO system_logs (user_id, user_name, role, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId || null,
      userName || 'System',
      role || 'System',
      action,
      entityType || null,
      entityId ? String(entityId) : null,
      details || ''
    );
  } catch (err) {
    console.error('Failed to log system action:', err);
  }
}

export const DEFAULT_MANAGER_PERMISSIONS = {
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
};

export function getManagerPermissions(userId) {
  try {
    const row = db.prepare('SELECT * FROM manager_permissions WHERE user_id = ?').get(userId);
    if (!row) {
      return { ...DEFAULT_MANAGER_PERMISSIONS, user_id: Number(userId) };
    }
    let allowedTabs = DEFAULT_MANAGER_PERMISSIONS.allowed_tabs;
    if (row.allowed_tabs) {
      try {
        allowedTabs = JSON.parse(row.allowed_tabs);
      } catch (e) {
        allowedTabs = DEFAULT_MANAGER_PERMISSIONS.allowed_tabs;
      }
    }
    return {
      user_id: Number(row.user_id),
      can_create_tasks: Boolean(row.can_create_tasks),
      can_edit_tasks: Boolean(row.can_edit_tasks),
      can_delete_tasks: Boolean(row.can_delete_tasks),
      can_create_teams: Boolean(row.can_create_teams),
      can_delete_teams: Boolean(row.can_delete_teams),
      can_manage_members: Boolean(row.can_manage_members),
      can_create_projects: Boolean(row.can_create_projects),
      can_edit_projects: Boolean(row.can_edit_projects),
      can_delete_projects: Boolean(row.can_delete_projects),
      can_view_all_tasks: Boolean(row.can_view_all_tasks),
      can_view_reports: Boolean(row.can_view_reports),
      can_access_recycle_bin: Boolean(row.can_access_recycle_bin),
      can_empty_recycle_bin: Boolean(row.can_empty_recycle_bin),
      can_view_change_history: Boolean(row.can_view_change_history),
      allowed_tabs: Array.isArray(allowedTabs) ? allowedTabs : DEFAULT_MANAGER_PERMISSIONS.allowed_tabs,
      updated_at: row.updated_at
    };
  } catch (err) {
    console.error('Error fetching manager permissions:', err);
    return { ...DEFAULT_MANAGER_PERMISSIONS, user_id: Number(userId) };
  }
}

export function createNotification({ userId, senderId, senderName, title, message, type, entityType, entityId }) {
  if (!userId) return;
  // Don't notify oneself
  if (senderId && Number(senderId) === Number(userId)) return;

  try {
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO notifications (user_id, sender_id, sender_name, title, message, type, entity_type, entity_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      Number(userId),
      senderId ? Number(senderId) : null,
      senderName || 'System',
      title,
      message,
      type || 'SYSTEM',
      entityType || null,
      entityId ? Number(entityId) : null,
      createdAt
    );
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

export default db;
