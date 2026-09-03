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

async function testAdminTasksMemberCount() {
  console.log('--- Testing Admin Tasks Department Member Count Increment on Admin Creation ---');

  // 1. Login as Admin
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  const adminToken = adminLogin.body.token;

  // 2. Fetch initial departments list
  const deptsBeforeRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const adminDeptBefore = deptsBeforeRes.body.departments?.find(d => d.name === 'Admin Tasks' || d.id === 1);
  const countBefore = adminDeptBefore?.total_users || 0;
  console.log('1. Admin Tasks department member count BEFORE adding new Admin:', countBefore);

  // 3. Add a new Admin account
  const testAdminEmail = `admin_test_${Date.now()}@company.com`;
  const createAdminRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/admin/users',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    name: 'Executive Test Admin',
    email: testAdminEmail,
    password: 'password123',
    role: 'Admin',
    title: 'Operations Director'
  });

  const newAdminId = createAdminRes.body.user?.id;
  console.log('2. Created New Admin. ID:', newAdminId);

  // 4. Fetch departments list again
  const deptsAfterRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const adminDeptAfter = deptsAfterRes.body.departments?.find(d => d.name === 'Admin Tasks' || d.id === 1);
  const countAfter = adminDeptAfter?.total_users || 0;
  console.log('3. Admin Tasks department member count AFTER adding new Admin:', countAfter);

  // 5. Clean up test admin
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/auth/admin/users/${newAdminId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('4. Cleaned up test admin account.');

  if (countAfter === countBefore + 1) {
    console.log('\n✅ ADMIN TASKS DEPARTMENT MEMBER COUNT INCREMENT (+= 1) VERIFIED 100%!');
  } else {
    throw new Error(`Expected countAfter (${countAfter}) to be countBefore + 1 (${countBefore + 1})!`);
  }
}

testAdminTasksMemberCount().catch(console.error);
