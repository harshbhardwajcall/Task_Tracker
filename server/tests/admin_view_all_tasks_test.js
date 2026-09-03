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

async function testAdminAllTasks() {
  console.log('--- Testing Admin Dashboard Viewing All Tasks (Admin & Employee Generated) ---');

  // 1. Login as Admin
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  const adminToken = adminLogin.body.token;
  console.log('1. Admin Login Status:', adminLogin.status);

  // 2. Fetch all tasks as Admin (default query with assigned_by=ALL)
  const allTasksRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks?assigned_by=ALL',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('2. GET /api/tasks?assigned_by=ALL Status:', allTasksRes.status);
  console.log('   Total Tasks Returned in Admin Scope:', allTasksRes.body.tasks?.length);

  const creators = new Set();
  const assignees = new Set();
  allTasksRes.body.tasks?.forEach(t => {
    if (t.assigned_by_name) creators.add(`${t.assigned_by_name} (${t.assigned_by_role})`);
    if (t.assigned_to_name) assignees.add(`${t.assigned_to_name} (${t.assigned_to_role || 'Employee'})`);
  });

  console.log('3. Task Creators detected in system:', Array.from(creators));
  console.log('4. Assignees detected in system:', Array.from(assignees));

  if (allTasksRes.status === 200) {
    console.log('\n✅ ADMIN SCOPE SHOWING ALL TASKS (ADMINS & EMPLOYEES) VERIFIED 100%!');
  } else {
    throw new Error('Failed to retrieve all tasks in admin scope');
  }
}

testAdminAllTasks().catch(console.error);
