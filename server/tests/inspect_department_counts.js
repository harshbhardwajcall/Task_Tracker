import db from '../db/index.js';

console.log('--- USERS IN DATABASE ---');
const users = db.prepare('SELECT id, name, email, role, title, department_id FROM users').all();
console.table(users);

console.log('--- DEPARTMENTS IN DATABASE ---');
const depts = db.prepare('SELECT id, name FROM departments').all();
console.table(depts);

console.log('--- USERS PER DEPARTMENT ---');
depts.forEach(d => {
  const deptUsers = users.filter(u => u.department_id === d.id);
  console.log(`Department [ID: ${d.id}, Name: "${d.name}"]: ${deptUsers.length} members ->`, deptUsers.map(u => `${u.name} (Role: ${u.role}, Title: ${u.title})`));
});

console.log('\n--- ADMIN USERS ---');
const adminUsers = users.filter(u => u.role === 'Admin');
console.log(`Total Admins: ${adminUsers.length} ->`, adminUsers.map(u => `${u.name} (Dept ID: ${u.department_id})`));

console.log('\n--- QUERY RESULT FOR GET /departments ---');
const departmentsResult = db.prepare(`
  SELECT
    d.*,
    CASE
      WHEN d.name LIKE '%Admin%' OR d.name LIKE '%Management%' OR d.id = 1 THEN
        (
          COUNT(CASE WHEN u.id IS NOT NULL AND u.role != 'Admin' THEN 1 END) +
          (SELECT COUNT(*) FROM users WHERE role = 'Admin')
        )
      ELSE
        COUNT(CASE WHEN u.id IS NOT NULL THEN 1 END)
    END as total_users
  FROM departments d
  LEFT JOIN users u ON u.department_id = d.id
  GROUP BY d.id
  ORDER BY d.name ASC
`).all();
console.table(departmentsResult);
