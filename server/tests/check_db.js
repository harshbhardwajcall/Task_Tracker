import db from '../db/index.js';

const users = db.prepare('SELECT id, name, email, role FROM users').all();
console.log('Users in DB:', users);

const tasks = db.prepare('SELECT id, task_id, title, assigned_by, assigned_to, project_id, department_id FROM tasks').all();
console.log('Tasks in DB:', tasks);
