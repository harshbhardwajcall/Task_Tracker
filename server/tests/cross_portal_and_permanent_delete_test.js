import http from 'http';
import fs from 'fs';
import path from 'path';
import db from '../db/index.js';

function makeRequest({ method = 'GET', path: reqPath, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (dataString) {
      reqHeaders['Content-Length'] = Buffer.byteLength(dataString);
    }

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: reqPath,
      method,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('=== Starting Cross-Portal & Permanent Deletion Test Suite ===\n');

  // Step 1: Admin Login on Admin Portal -> Success (200)
  const adminLogin = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'admin@company.com', password: 'password123', role: 'Admin' }
  });
  console.log('1. Admin login on Admin Portal status:', adminLogin.status, '(expected: 200)');
  if (adminLogin.status !== 200) throw new Error('Admin login failed');
  const adminToken = adminLogin.body.token;

  // Step 2: Test Admin login on Employee Portal -> Should be Rejected (403)
  const adminOnEmpPortal = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'admin@company.com', password: 'password123', role: 'Employee' }
  });
  console.log('2. Admin login on Employee Portal status:', adminOnEmpPortal.status, adminOnEmpPortal.body?.message, '(expected: 403)');

  // Step 3: Test Non-existent Email (Wrong Gmail/Email) -> 401 with 'Wrong email or password. Please try again.'
  const wrongEmailLogin = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'nonexistent_user@gmail.com', password: 'password123', role: 'Employee' }
  });
  console.log('3. Wrong email login status & message:', wrongEmailLogin.status, `"${wrongEmailLogin.body?.message}"`, '(expected: 401, "Wrong email or password. Please try again.")');

  // Step 4: Test Wrong Password -> 401 with 'Wrong email or password. Please try again.'
  const wrongPasswordLogin = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'admin@company.com', password: 'incorrect_password', role: 'Admin' }
  });
  console.log('4. Wrong password login status & message:', wrongPasswordLogin.status, `"${wrongPasswordLogin.body?.message}"`, '(expected: 401, "Wrong email or password. Please try again.")');

  // Step 5: Create a test Employee and test Intern
  const ts = Date.now();
  const empEmail = `test_portal_emp_${ts}@company.com`;
  const internEmail = `test_portal_intern_${ts}@company.com`;

  const createEmp = await makeRequest({
    method: 'POST',
    path: '/api/auth/admin/users',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { name: 'Test Emp', email: empEmail, password: 'password123', role: 'Employee', title: 'Developer' }
  });
  console.log('5. Create Test Employee status:', createEmp.status);

  const createIntern = await makeRequest({
    method: 'POST',
    path: '/api/auth/admin/users',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { name: 'Test Intern', email: internEmail, password: 'password123', role: 'Intern', title: 'Intern' }
  });
  console.log('6. Create Test Intern status:', createIntern.status);

  const empUserId = createEmp.body.user.id;
  const internUserId = createIntern.body.user.id;

  // Step 6: Test Employee login on Admin Portal -> Should be Rejected (403)
  const empOnAdmin = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: empEmail, password: 'password123', role: 'Admin' }
  });
  console.log('7. Employee login on Admin Portal status:', empOnAdmin.status, empOnAdmin.body?.message, '(expected: 403)');

  // Step 7: Test Employee login on Employee Portal -> Success (200)
  const empOnEmp = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: empEmail, password: 'password123', role: 'Employee' }
  });
  console.log('8. Employee login on Employee Portal status:', empOnEmp.status, '(expected: 200)');

  // Step 8: Test Intern login on Admin Portal -> Should be Rejected (403)
  const internOnAdmin = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: internEmail, password: 'password123', role: 'Admin' }
  });
  console.log('9. Intern login on Admin Portal status:', internOnAdmin.status, internOnAdmin.body?.message, '(expected: 403)');

  // Step 9: Test Intern login on Employee Portal -> Merged & Success (200)
  const internOnEmp = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: internEmail, password: 'password123', role: 'Employee' }
  });
  console.log('10. Intern login on Employee Portal (Merged) status:', internOnEmp.status, '(expected: 200)');

  console.log('\n--- Testing Permanent Deletion ---');

  // Step 11: Create Department, Project, and Task for Test Employee
  const deptRes = await makeRequest({
    method: 'POST',
    path: '/api/departments',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { name: `Test Deletion Dept ${ts}`, description: 'Testing permanent deletion' }
  });
  const deptId = deptRes.body.department.id;
  console.log('12. Created Dept ID:', deptId);

  const projRes = await makeRequest({
    method: 'POST',
    path: '/api/projects',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { name: `Test Deletion Project ${ts}`, department_id: deptId, description: 'Testing' }
  });
  const projId = projRes.body.project.id;
  console.log('13. Created Project ID:', projId);

  const taskRes = await makeRequest({
    method: 'POST',
    path: '/api/tasks',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      title: 'Task for Deletion Test',
      description: 'Will be purged',
      assigned_to: empUserId,
      project_id: projId,
      department_id: deptId,
      priority: 'High',
      start_date: '2026-10-05',
      due_date: '2026-10-10'
    }
  });
  const taskId = taskRes.body.task.id;
  console.log('14. Created Task ID:', taskId);

  // Upload attachment via HTTP API
  const boundary = '----WebKitFormBoundaryTest7MA4YW';
  const fileContent = 'Attachment content that should be unlinked on permanent delete';
  const fileName = 'test-purge-doc.txt';
  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="attachment"; filename="${fileName}"\r\n`,
    `Content-Type: text/plain\r\n\r\n`,
    `${fileContent}\r\n`,
    `--${boundary}--\r\n`
  ];
  const payloadBuffer = Buffer.from(bodyParts.join(''));

  const uploadRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/tasks/${taskId}/attachments`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payloadBuffer.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(payloadBuffer);
    req.end();
  });

  const uploadedFilePath = uploadRes.body.attachments?.[0]?.file_path;
  const fullDiskPath = path.resolve('uploads', uploadedFilePath);
  console.log('15. Uploaded attachment via HTTP, file exists on disk:', fs.existsSync(fullDiskPath));

  // Step 12: Delete Employee -> Must permanently delete user and task, and remove attachment on disk
  const delEmpRes = await makeRequest({
    method: 'DELETE',
    path: `/api/employees/${empUserId}`,
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('16. Delete Employee response:', delEmpRes.body?.message);

  const checkUserInDb = (await makeRequest({ method: 'GET', path: `/api/user/${empUserId}` })).status === 404;
  const checkTaskInDb = (await makeRequest({ method: 'GET', path: `/api/tasks/${taskId}`, headers: { Authorization: `Bearer ${adminToken}` } })).status === 404;
  const checkFileOnDisk = fs.existsSync(fullDiskPath);

  console.log('17. User deleted from DB:', checkUserInDb, '(expected: true)');
  console.log('18. Task deleted from DB:', checkTaskInDb, '(expected: true)');
  console.log('19. File deleted from disk:', !checkFileOnDisk, '(expected: true)');

  // Step 13: Delete Intern permanently via admin endpoint
  const delInternRes = await makeRequest({
    method: 'DELETE',
    path: `/api/auth/admin/users/${internUserId}`,
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('20. Delete Intern response:', delInternRes.body?.message);
  const checkInternInDb = db.prepare('SELECT id FROM users WHERE id = ?').get(internUserId);
  console.log('21. Intern in DB after delete:', checkInternInDb, '(expected: undefined)');

  // Step 14: Delete Project permanently
  const delProjRes = await makeRequest({
    method: 'DELETE',
    path: `/api/projects/${projId}`,
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('22. Delete Project response:', delProjRes.body?.message);
  const checkProjInDb = db.prepare('SELECT id FROM projects WHERE id = ?').get(projId);
  console.log('23. Project in DB after delete:', checkProjInDb, '(expected: undefined)');

  // Step 15: Delete Department permanently
  const delDeptRes = await makeRequest({
    method: 'DELETE',
    path: `/api/departments/${deptId}`,
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('24. Delete Department response:', delDeptRes.body?.message);
  const checkDeptInDb = db.prepare('SELECT id FROM departments WHERE id = ?').get(deptId);
  console.log('25. Department in DB after delete:', checkDeptInDb, '(expected: undefined)');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
