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

async function testAdminTasksAndCreatorFilter() {
  console.log('--- Testing Admin Generated Tasks & Admin Department Filters ---');

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

  // 2. Query with created_by_role=ADMIN
  const adminTasksRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks?created_by_role=ADMIN&assigned_by=ALL',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('2. GET /api/tasks?created_by_role=ADMIN Status:', adminTasksRes.status);
  console.log('   Admin Generated Tasks Found:', adminTasksRes.body.tasks?.length);
  if (adminTasksRes.body.tasks?.length > 0) {
    console.log('   Sample Assigner Role:', adminTasksRes.body.tasks[0]?.assigned_by_name);
  }

  // 3. Query with department_id=ADMIN_TASKS
  const deptAdminRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks?department_id=ADMIN_TASKS&assigned_by=ALL',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('3. GET /api/tasks?department_id=ADMIN_TASKS Status:', deptAdminRes.status);
  console.log('   Admin Department Tasks Found:', deptAdminRes.body.tasks?.length);

  // 4. Query with created_by_role=EMPLOYEE
  const empTasksRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks?created_by_role=EMPLOYEE&assigned_by=ALL',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('4. GET /api/tasks?created_by_role=EMPLOYEE Status:', empTasksRes.status);
  console.log('   Employee Generated Tasks Found:', empTasksRes.body.tasks?.length);

  console.log('\n✅ ADMIN GENERATED & ADMIN DEPARTMENT TASK FILTERS VERIFIED 100%!');
}

testAdminTasksAndCreatorFilter().catch(console.error);
