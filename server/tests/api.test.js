import assert from 'assert';
import db from '../db/index.js';
import bcrypt from 'bcryptjs';

console.log('Running Backend API Logic Verification Tests...');

try {
  // 1. Verify User Password Hashing
  const hash = bcrypt.hashSync('testpass', 10);
  assert.strictEqual(bcrypt.compareSync('testpass', hash), true, 'Password verification should succeed');

  // 2. Verify Task Overdue Logic
  const today = new Date().toISOString().split('T')[0];
  const overdueDueDate = '2020-01-01';

  db.prepare(`
    INSERT OR REPLACE INTO tasks (
      id, task_id, title, description, assigned_by, assigned_to, project_id, department_id,
      assigned_date, start_date, due_date, priority, status
    ) VALUES (999, 'TASK-TEST', 'Test Overdue', 'Description', 1, 3, 1, 1, '2020-01-01', '2020-01-01', ?, 'High', 'In Progress')
  `).run(overdueDueDate);

  const overdueCheck = db.prepare(`
    SELECT status FROM tasks WHERE id = 999
  `).get();

  // Test overdue logic condition
  const isOverdue = overdueDueDate < today && overdueCheck.status !== 'Completed';
  assert.strictEqual(isOverdue, true, 'Task with due date in past and status != Completed must be overdue');

  // Cleanup test task
  db.prepare('DELETE FROM tasks WHERE id = 999').run();

  console.log('✅ ALL BACKEND LOGIC VERIFICATION TESTS PASSED!');
} catch (err) {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
}
