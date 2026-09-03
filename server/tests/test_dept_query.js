import db from '../db/index.js';

// Update admin users so their default department is Admin Tasks (id: 9) instead of Development (id: 1)
const adminDept = db.prepare("SELECT id FROM departments WHERE name LIKE '%Admin%' LIMIT 1").get();
if (adminDept) {
  db.prepare("UPDATE users SET department_id = ? WHERE role = 'Admin' AND department_id = 1").run(adminDept.id);
}

const query = `
  SELECT
    d.*,
    CASE
      WHEN d.name LIKE '%Admin Tasks%' OR d.name LIKE '%Admin%' OR d.name LIKE '%Management%' THEN
        (SELECT COUNT(*) FROM users WHERE role = 'Admin')
      ELSE
        COUNT(CASE WHEN u.id IS NOT NULL AND u.role != 'Admin' THEN 1 END)
    END as total_users
  FROM departments d
  LEFT JOIN users u ON u.department_id = d.id
  GROUP BY d.id
  ORDER BY d.name ASC
`;

const departmentsResult = db.prepare(query).all();
console.table(departmentsResult);
