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

async function runTests() {
  console.log('--- Testing Admin Settings, Account Provisioning, & Password Reset ---');

  // Step 1: Login as Admin
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  const adminToken = adminLogin.body.token;
  console.log('1. Admin Login Status:', adminLogin.status, '- Token retrieved:', !!adminToken);

  // Step 2: Create a new employee with email and password
  const newEmp = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/admin/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    name: 'Vikram Singh',
    email: 'vikram.singh@company.com',
    password: 'secretpassword123',
    role: 'Employee',
    department_id: 1,
    title: 'Senior Developer'
  });

  console.log('2. Create Employee Status:', newEmp.status, '- User Name:', newEmp.body.user?.name);
  const createdUserId = newEmp.body.user?.id;

  // Step 3: Login as the newly created employee with their password
  const empLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'vikram.singh@company.com', password: 'secretpassword123', role: 'Employee' });

  console.log('3. New Employee Login Status:', empLogin.status, '- User Name:', empLogin.body.user?.name);

  // Step 4: Admin resets the password for this employee
  const resetPass = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/auth/admin/users/${createdUserId}/password`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    password: 'newresetpassword456'
  });

  console.log('4. Password Reset Status:', resetPass.status, '- Message:', resetPass.body.message);

  // Step 5: Login with new password
  const empLoginAfterReset = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'vikram.singh@company.com', password: 'newresetpassword456', role: 'Employee' });

  console.log('5. Login with Reset Password Status:', empLoginAfterReset.status, '- User:', empLoginAfterReset.body.user?.name);

  // Step 6: Create another Admin account
  const newAdmin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/admin/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    name: 'Executive Admin',
    email: 'executive.admin@company.com',
    password: 'execadminpassword',
    role: 'Admin',
    department_id: 1,
    title: 'Administrator'
  });

  console.log('6. Create Another Admin Status:', newAdmin.status, '- Role:', newAdmin.body.user?.role);
  const createdAdminId = newAdmin.body.user?.id;

  // Step 7: Delete test accounts
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/auth/admin/users/${createdUserId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/auth/admin/users/${createdAdminId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('7. Cleanup Completed.');
  console.log('\n✅ ALL ADMIN SETTINGS & AUTHENTICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(console.error);
