import http from 'http';
import db from '../db/index.js';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function testAttachmentDeletePermissions() {
  console.log('--- Testing Attachment Delete Permission (Uploader & Admin ONLY) ---');

  // 1. Admin Login
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  const adminToken = adminLogin.body.token;

  // 2. Fetch Employees
  const empListRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const emp1 = empListRes.body.employees?.[0];
  const emp2 = empListRes.body.employees?.[1];

  const emp1Login = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp1.email, password: 'password123', role: 'Employee' });

  const emp1Token = emp1Login.body.token;

  const emp2Login = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp2.email, password: 'password123', role: 'Employee' });

  const emp2Token = emp2Login.body.token;

  // Find an active task
  const activeTask = db.prepare('SELECT id FROM tasks WHERE deleted_at IS NULL LIMIT 1').get();
  const taskId = activeTask.id;

  db.prepare(`
    INSERT INTO task_attachments (task_id, user_id, file_name, file_path, file_size)
    VALUES (?, ?, 'test-document.pdf', 'dummy-test.pdf', 1024)
  `).run(taskId, emp1.id);

  const inserted = db.prepare('SELECT id FROM task_attachments ORDER BY id DESC LIMIT 1').get();
  const attachmentId = inserted.id;
  console.log('1. Created attachment ID:', attachmentId, 'for Task ID:', taskId, 'by User:', emp1.name);

  // Employee 2 (NOT the uploader) tries to delete -> Should be 403 FORBIDDEN
  const emp2DeleteRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/attachments/${attachmentId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${emp2Token}` }
  });
  console.log('2. Non-uploader delete attempt:', emp2DeleteRes.status, `(Expected: 403)`);
  if (emp2DeleteRes.status !== 403) {
    throw new Error(`Non-uploader should not be allowed to delete attachment! Got ${emp2DeleteRes.status}`);
  }

  // Employee 1 (Uploader) deletes -> Should SUCCEED (200)
  const emp1DeleteRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/attachments/${attachmentId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${emp1Token}` }
  });
  console.log('3. Uploader delete attempt:', emp1DeleteRes.status, `(Expected: 200)`);

  if (emp1DeleteRes.status === 200) {
    console.log('\n✅ ATTACHMENT DELETION PERMISSION RESTRICTION VERIFIED 100%!');
  }
}

testAttachmentDeletePermissions().catch(console.error);
