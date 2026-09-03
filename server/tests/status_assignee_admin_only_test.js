import http from 'http';

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

async function testStatusPermissions() {
  console.log('--- Testing Status Change Permission (Admin & Assigned Employee ONLY) ---');

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
  const emp2 = empListRes.body.employees?.[1] || empListRes.body.employees?.[0];

  console.log('1. Employee 1 (Assigner):', emp1.name);
  console.log('   Employee 2 (Assignee):', emp2.name);

  // Login as Employee 1
  const emp1Login = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp1.email, password: 'password123', role: 'Employee' });

  const emp1Token = emp1Login.body.token;

  // Login as Employee 2
  const emp2Login = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp2.email, password: 'password123', role: 'Employee' });

  const emp2Token = emp2Login.body.token;

  // 3. Employee 1 creates a task assigned TO Employee 2
  const todayStr = new Date().toISOString().split('T')[0];
  const createTaskRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${emp1Token}` }
  }, {
    title: 'Status Restriction Strict Test',
    description: 'Testing that only Employee 2 (assignee) or Admin can update status',
    assigned_to: emp2.id,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'High'
  });

  const taskId = createTaskRes.body.task?.id;
  console.log('2. Created Task assigned TO Employee 2. ID:', taskId);

  // 4. Employee 1 (Creator/Assigner, but NOT assignee) tries to update status -> Should be FORBIDDEN (403)
  if (emp1.id !== emp2.id) {
    const creatorStatusAttempt = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/tasks/${taskId}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${emp1Token}` }
    }, { status: 'Completed' });

    console.log('3. Creator (non-assignee) update status response:', creatorStatusAttempt.status, `(Expected: 403)`);
    if (creatorStatusAttempt.status !== 403) {
      throw new Error('Creator should NOT be allowed to update status of delegated task!');
    }
  }

  // 5. Employee 2 (Assignee) updates status -> Should SUCCEED (200)
  const assigneeStatusAttempt = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/status`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${emp2Token}` }
  }, { status: 'In Progress' });

  console.log('4. Assignee (Employee 2) update status response:', assigneeStatusAttempt.status, `(Expected: 200)`);

  // 6. Admin updates status -> Should SUCCEED (200)
  const adminStatusAttempt = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/status`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { status: 'Completed' });

  console.log('5. Admin update status response:', adminStatusAttempt.status, `(Expected: 200)`);

  // Clean up
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/permanent`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (assigneeStatusAttempt.status === 200 && adminStatusAttempt.status === 200) {
    console.log('\n✅ STATUS CHANGE RESTRICTION (ADMIN & ASSIGNED EMPLOYEE ONLY) VERIFIED 100%!');
  } else {
    throw new Error('Status permission verification failed!');
  }
}

testStatusPermissions().catch(console.error);
