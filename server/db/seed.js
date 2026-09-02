import bcrypt from 'bcryptjs';
import db, { initDatabase } from './index.js';

async function seed() {
  console.log('Initializing database tables...');
  initDatabase();

  // Clear existing data in correct foreign-key order
  db.prepare('DELETE FROM task_history').run();
  db.prepare('DELETE FROM task_attachments').run();
  db.prepare('DELETE FROM task_comments').run();
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM users').run();
  db.prepare('DELETE FROM projects').run();
  db.prepare('DELETE FROM departments').run();

  // Reset sqlite autoincrement sequences
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('departments', 'projects', 'users', 'tasks', 'task_comments', 'task_attachments', 'task_history')").run();

  console.log('Seeding departments...');
  const insertDept = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)');
  const depts = [
    ['Development', 'Software engineering and core backend/frontend systems'],
    ['Design', 'UI/UX design, graphics, and asset creation'],
    ['Marketing', 'Product marketing, branding, and customer reach'],
    ['HR', 'Human resources and talent acquisition'],
    ['Finance', 'Financial planning, accounting, and budgeting'],
    ['Testing', 'Quality assurance and software testing'],
    ['Operations', 'Infrastructure, DevOps, and IT support']
  ];
  depts.forEach(d => insertDept.run(d[0], d[1]));

  console.log('Seeding projects...');
  const insertProj = db.prepare('INSERT INTO projects (name, department_id, description) VALUES (?, ?, ?)');
  const projects = [
    ['Skillistry', 1, 'Core learning & skill assessment platform'],
    ['Cloud Migration', 1, 'Migrating legacy servers to modern cloud infrastructure'],
    ['Mobile App v2', 2, 'Redesigning iOS and Android user experiences'],
    ['Design System 3.0', 2, 'Unified design token and UI library'],
    ['Security Audit', 6, 'Penetration testing and vulnerability scanning']
  ];
  projects.forEach(p => insertProj.run(p[0], p[1], p[2]));

  console.log('Seeding users...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  const insertUser = db.prepare('INSERT INTO users (name, email, password, role, department_id) VALUES (?, ?, ?, ?, ?)');

  // Users:
  // 1: Manager A (Development)
  // 2: Manager B (Design)
  // 3: Rahul Sharma (Employee - Development)
  // 4: Priya Patel (Employee - Design)
  // 5: Alex Johnson (Employee - Marketing)
  // 6: Dev Kumar (Employee - Testing)
  // 7: Sara Smith (Employee - HR)
  const users = [
    ['Manager A', 'manager@company.com', hashedPassword, 'Manager', 1],
    ['Manager B', 'sarah.m@company.com', hashedPassword, 'Manager', 2],
    ['Rahul Sharma', 'rahul@company.com', hashedPassword, 'Employee', 1],
    ['Priya Patel', 'priya@company.com', hashedPassword, 'Employee', 2],
    ['Alex Johnson', 'alex@company.com', hashedPassword, 'Employee', 3],
    ['Dev Kumar', 'dev@company.com', hashedPassword, 'Employee', 6],
    ['Sara Smith', 'sara@company.com', hashedPassword, 'Employee', 4]
  ];
  users.forEach(u => insertUser.run(u[0], u[1], u[2], u[3], u[4]));

  console.log('Seeding tasks...');
  const insertTask = db.prepare(`
    INSERT INTO tasks (
      task_id, title, description, assigned_by, assigned_to, project_id, department_id,
      assigned_date, start_date, due_date, completed_date, priority, status,
      employee_comments, manager_remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tasksData = [
    [
      'TASK-0001',
      'Implement Login API',
      'Implement Google OAuth login and JWT authentication endpoints with refresh tokens.',
      1, // Manager A
      3, // Rahul
      1, // Skillistry
      1, // Development
      '2026-09-01',
      '2026-09-02',
      '2026-09-05',
      null,
      'High',
      'In Progress',
      'OAuth integration is currently being implemented. Testing refresh token expiration flow.',
      'Please ensure the API is fully covered with unit tests before the deadline.'
    ],
    [
      'TASK-0002',
      'Create Homepage UI',
      'Design clean, modern UI components for the main dashboard homepage in Figma.',
      2, // Manager B
      4, // Priya
      4, // Design System 3.0
      2, // Design
      '2026-08-25',
      '2026-08-26',
      '2026-08-30',
      '2026-08-29 14:30:00',
      'Critical',
      'Completed',
      'Figma mockups and exported SVG components have been finalized and shared.',
      'Great work on the modern aesthetic!'
    ],
    [
      'TASK-0003',
      'Prepare Project Documentation',
      'Draft detailed technical design specs and deployment guidelines for Cloud Migration.',
      1, // Manager A
      3, // Rahul
      2, // Cloud Migration
      1, // Development
      '2026-09-02',
      '2026-09-03',
      '2026-09-10',
      null,
      'Medium',
      'Not Started',
      null,
      'Focus on the infrastructure diagram and environment variables list.'
    ],
    [
      'TASK-0004',
      'Security Vulnerability Audit',
      'Perform security assessment on public API endpoints and database permissions.',
      1, // Manager A
      6, // Dev Kumar
      5, // Security Audit
      6, // Testing
      '2026-08-20',
      '2026-08-22',
      '2026-08-31',
      null,
      'High',
      'Overdue',
      'Scanning completed, writing remediation report.',
      'Need this completed ASAP for compliance review.'
    ],
    [
      'TASK-0005',
      'Mobile App UI Redesign Assets',
      'Create icon set and illustration assets for Mobile App v2 onboarding screen.',
      2, // Manager B
      4, // Priya
      3, // Mobile App v2
      2, // Design
      '2026-09-01',
      '2026-09-02',
      '2026-09-08',
      null,
      'Low',
      'On Hold',
      'Awaiting updated wireframes from product team.',
      'On hold until branding guidelines are approved.'
    ]
  ];

  tasksData.forEach(t => insertTask.run(...t));

  console.log('Seeding task comments...');
  const insertComment = db.prepare('INSERT INTO task_comments (task_id, user_id, comment, created_at) VALUES (?, ?, ?, ?)');
  const comments = [
    [1, 3, 'Started working on JWT auth middleware.', '2026-09-02 10:15:00'],
    [1, 1, 'Looks good. Make sure to set token expiration to 24 hours.', '2026-09-02 11:30:00'],
    [1, 3, 'OAuth integration is currently being implemented. Testing refresh token expiration flow.', '2026-09-02 14:00:00'],
    [2, 4, 'Uploaded complete mockup set to Figma.', '2026-08-28 16:20:00'],
    [2, 2, 'Approved design! Marked as completed.', '2026-08-29 14:30:00'],
    [4, 6, 'Identified 2 minor vulnerability warnings in open dependencies.', '2026-08-30 09:45:00']
  ];
  comments.forEach(c => insertComment.run(...c));

  console.log('Seeding task history...');
  const insertHistory = db.prepare(`
    INSERT INTO task_history (task_id, user_id, user_name, action, old_value, new_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const history = [
    [1, 1, 'Manager A', 'Task Created', null, 'Task assigned to Rahul Sharma', '2026-09-01 09:00:00'],
    [1, 3, 'Rahul Sharma', 'Status Changed', 'Not Started', 'In Progress', '2026-09-02 10:15:00'],
    [1, 3, 'Rahul Sharma', 'Added Comment', null, 'OAuth integration is currently being implemented.', '2026-09-02 14:00:00'],
    [2, 2, 'Manager B', 'Task Created', null, 'Task assigned to Priya Patel', '2026-08-25 10:00:00'],
    [2, 4, 'Priya Patel', 'Status Changed', 'Not Started', 'In Progress', '2026-08-26 11:00:00'],
    [2, 4, 'Priya Patel', 'Status Changed', 'In Progress', 'Completed', '2026-08-29 14:30:00'],
    [4, 1, 'Manager A', 'Task Created', null, 'Task assigned to Dev Kumar', '2026-08-20 09:30:00'],
    [4, 6, 'Dev Kumar', 'Status Changed', 'Not Started', 'In Progress', '2026-08-22 10:00:00'],
    [4, 1, 'System', 'Status Marked Overdue', 'In Progress', 'Overdue', '2026-09-01 00:00:00']
  ];
  history.forEach(h => insertHistory.run(...h));

  console.log('Database successfully seeded!');
}

seed().catch(err => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
