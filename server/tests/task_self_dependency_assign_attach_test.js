import http from 'http';
import assert from 'assert';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      if (typeof postData === 'string') {
        req.write(postData);
      } else {
        req.write(JSON.stringify(postData));
      }
    }
    req.end();
  });
}

async function runTest() {
  console.log('🚀 Running Task Self-Assign, Dependency, Reassignment, and Attachment Permissions Test...');

  // 1. Admin Login
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  assert.strictEqual(adminLogin.status, 200, 'Admin login must succeed');
  const adminToken = adminLogin.body.token;
  const adminUser = adminLogin.body.user;

  // 2. Fetch Employees & Projects
  const empListRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const emp1 = empListRes.body.employees?.[0];
  const emp2 = empListRes.body.employees?.[1];
  assert.ok(emp1 && emp2, 'Must have at least 2 employees in database');

  const projListRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/projects',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const proj1 = projListRes.body.projects?.[0];
  assert.ok(proj1, 'Must have at least 1 project in database');

  // 3. Login as Employee 1
  const emp1Login = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp1.email, password: 'password123', role: 'Employee' });
  const emp1Token = emp1Login.body.token;

  // 4. Test 1: Self-Assignment & Dependencies (Multiple employees over the same task)
  console.log('--- Test 1: Create Task with Self-Assignment & Dependencies ---');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  let bodyData = '';
  const fields = {
    title: 'Self-Assigned Multi-Employee Collab Task',
    description: 'Testing task with multiple employee dependencies and self assignment',
    assigned_to: String(emp1.id), // Assigned to SELF
    project_id: String(proj1.id),
    department_id: String(proj1.department_id || 1),
    start_date: '2026-10-18',
    due_date: '2026-10-25',
    priority: 'High',
    dependencies: JSON.stringify([emp2.id]) // Employee 2 added as Dependency!
  };

  for (const [key, value] of Object.entries(fields)) {
    bodyData += `--${boundary}\r\n`;
    bodyData += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    bodyData += `${value}\r\n`;
  }
  bodyData += `--${boundary}--\r\n`;

  const createTaskRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${emp1Token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    }
  }, bodyData);

  assert.strictEqual(createTaskRes.status, 201, 'Task creation with self-assignment and dependency must succeed');
  const createdTask = createTaskRes.body.task;
  assert.strictEqual(Number(createdTask.assigned_to), Number(emp1.id), 'Task must be assigned to self (emp1)');

  // Verify Single Task Details returns dependencies
  const taskDetailsRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${createdTask.id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${emp1Token}` }
  });
  assert.strictEqual(taskDetailsRes.status, 200);
  assert.ok(taskDetailsRes.body.dependencies?.some(d => Number(d.id) === Number(emp2.id)), 'Employee 2 must be listed in task dependencies');
  console.log('✅ Self-assignment and dependency creation verified!');

  // 5. Test 2: Dependency Employee (emp2) can view task in their scoped query
  console.log('--- Test 2: Dependency Employee Access & Scoped View ---');
  const emp2Login = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp2.email, password: 'password123', role: 'Employee' });
  const emp2Token = emp2Login.body.token;

  const emp2ScopedRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks?scope=ASSIGNED_TO_ME',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${emp2Token}` }
  });
  assert.ok(emp2ScopedRes.body.tasks?.some(t => t.id === createdTask.id), 'Dependency employee must see collaborative task under ASSIGNED_TO_ME scope');
  console.log('✅ Dependency employee successfully views collaborative task in their task list!');

  // 6. Test 3: Reassignment permissions (assigner, admin, manager)
  console.log('--- Test 3: Reassignment permissions (assign by user, admin, manager) ---');
  // 3a: Assigner (emp1) can reassign task to emp2
  const reassignByAssignerRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${createdTask.id}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${emp1Token}`,
      'Content-Type': 'application/json'
    }
  }, { assigned_to: emp2.id });
  assert.strictEqual(reassignByAssignerRes.status, 200, 'Assigner must be allowed to reassign task');
  assert.strictEqual(Number(reassignByAssignerRes.body.task?.assigned_to), Number(emp2.id));

  // 3b: Admin can reassign task back to emp1
  const reassignByAdminRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${createdTask.id}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, { assigned_to: emp1.id });
  assert.strictEqual(reassignByAdminRes.status, 200, 'Admin must be allowed to reassign task');

  console.log('✅ Reassignment by Assigner and Admin verified!');

  // 7. Test 4: Attachment Upload Permissions
  console.log('--- Test 4: Attachment Upload Permissions ---');
  // Upload file by assignee (emp1)
  const attachBoundary = '----WebKitFormBoundaryAttachmentTest';
  let attachData = `--${attachBoundary}\r\n`;
  attachData += `Content-Disposition: form-data; name="attachment"; filename="test_doc.txt"\r\n`;
  attachData += `Content-Type: text/plain\r\n\r\n`;
  attachData += `Hello from attachment test\r\n`;
  attachData += `--${attachBoundary}--\r\n`;

  const attachByAssigneeRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${createdTask.id}/attachments`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${emp1Token}`,
      'Content-Type': `multipart/form-data; boundary=${attachBoundary}`
    }
  }, attachData);
  assert.strictEqual(attachByAssigneeRes.status, 201, 'Assignee must be allowed to attach files');

  // Upload file by Admin
  const attachByAdminRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${createdTask.id}/attachments`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': `multipart/form-data; boundary=${attachBoundary}`
    }
  }, attachData);
  assert.strictEqual(attachByAdminRes.status, 201, 'Admin must be allowed to attach files');

  console.log('✅ Attachment upload permissions verified successfully!');

  // Clean up test task
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${createdTask.id}/permanent`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('\n🎉 ALL SELF-ASSIGNMENT, DEPENDENCY, REASSIGNMENT, AND ATTACHMENT TESTS PASSED 100%!');
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
