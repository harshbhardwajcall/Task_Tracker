import http from 'http';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Admin & Employee Login Verification Tests ---');

  // 1. Test Admin Login
  console.log('\n[TEST 1] Admin Login (admin@company.com)...');
  const adminLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  console.log('Status:', adminLogin.status);
  console.log('User Role:', adminLogin.data?.user?.role);
  console.log('Token exists:', !!adminLogin.data?.token);

  if (adminLogin.status !== 200 || adminLogin.data?.user?.role !== 'Admin') {
    throw new Error('Admin login failed');
  }

  const adminToken = adminLogin.data.token;
  const adminId = adminLogin.data.user.id;

  // 2. Test Employee Login (Rahul)
  console.log('\n[TEST 2] Employee Login (rahul@company.com)...');
  const employeeLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'rahul@company.com', password: 'password123', role: 'Employee' });

  console.log('Status:', employeeLogin.status);
  console.log('User Role:', employeeLogin.data?.user?.role);
  console.log('User Name:', employeeLogin.data?.user?.name);

  if (employeeLogin.status !== 200 || employeeLogin.data?.user?.role !== 'Employee') {
    throw new Error('Employee login failed');
  }

  const rahulId = employeeLogin.data.user.id;
  const rahulToken = employeeLogin.data.token;

  // 3. Test Employee Task Isolation
  console.log('\n[TEST 3] Employee Task Isolation...');
  const rahulTasks = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'GET',
    headers: {
      'X-User-Id': rahulId,
      'Authorization': `Bearer ${rahulToken}`
    }
  });

  console.log('Rahul task count:', rahulTasks.data?.tasks?.length);
  const nonRahulTasks = (rahulTasks.data?.tasks || []).filter(t => t.assigned_to !== rahulId);
  console.log('Non-Rahul tasks visible to Rahul:', nonRahulTasks.length);
  if (nonRahulTasks.length > 0) {
    throw new Error('Employee task isolation failure: Rahul can see other tasks!');
  }

  // 4. Test Admin System Stats
  console.log('\n[TEST 4] Admin System Stats...');
  const adminStats = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/stats',
    method: 'GET',
    headers: {
      'X-User-Id': adminId,
      'Authorization': `Bearer ${adminToken}`
    }
  });

  console.log('Admin stats:', JSON.stringify(adminStats.data?.stats, null, 2));
  if (adminStats.status !== 200 || !adminStats.data?.stats) {
    throw new Error('Admin stats failed');
  }

  console.log('\n✅ ALL BACKEND AUTH & RBAC TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
