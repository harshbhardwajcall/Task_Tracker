import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
        saveDb();
        const lastIdRes = rawDb.exec('SELECT last_insert_rowid() as id');
        const lastInsertRowid = lastIdRes && lastIdRes[0] && lastIdRes[0].values[0] ? lastIdRes[0].values[0][0] : null;
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
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
      comment TEXT NOT NULL,
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
  `);

  // Migrate users table if check constraint fails on Admin
  try {
    const testAdmin = db.prepare("SELECT id FROM users WHERE email = 'admin@company.com'").get();
    if (!testAdmin) {
      try {
        db.prepare("INSERT INTO users (name, email, password, role, department_id, title) VALUES ('System Admin', 'admin@company.com', '$2a$10$wNqV9lqN9a7Qz8zV.p1K5uKq1d.mN7Vp7J9p3K5q9X1K5uKq1d.mN', 'Admin', 1, 'Administrator')").run();
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
        db.prepare("INSERT INTO users (name, email, password, role, department_id, title) VALUES ('System Admin', 'admin@company.com', '$2a$10$wNqV9lqN9a7Qz8zV.p1K5uKq1d.mN7Vp7J9p3K5q9X1K5uKq1d.mN', 'Admin', 1, 'Administrator')").run();
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
    db.exec(`ALTER TABLE tasks ADD COLUMN deleted_at DATETIME DEFAULT NULL;`);
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

  // Ensure Admin Tasks / Administration department exists
  try {
    const adminDept = db.prepare("SELECT id FROM departments WHERE name = 'Admin Tasks' OR name = 'Administration'").get();
    if (!adminDept) {
      db.prepare("INSERT INTO departments (name, description) VALUES ('Admin Tasks', 'Executive administration, leadership deliverables, and management operations')").run();
    }
  } catch (e) {}

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
        db.prepare("DELETE FROM tasks WHERE id = ?").run(t.id);
      }
    }
  } catch (e) {
    console.error('Error purging expired tasks:', e);
  }
}

export default db;
