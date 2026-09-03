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

async function testInternRole() {
  console.log('--- Testing Intern Account Role Creation & Management ---');

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

  // 2. Create an Intern account
  const internEmail = `intern_${Date.now()}@company.com`;
  const createInternRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/admin/users',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    name: 'Rohan Sharma',
    email: internEmail,
    password: 'password123',
    role: 'Intern',
    department_id: 1,
    title: 'Software Engineering Intern'
  });

  console.log('2. Create Intern Account Status:', createInternRes.status);
  console.log('   Created User Role:', createInternRes.body.user?.role);
  console.log('   Created User Title:', createInternRes.body.user?.title);

  const internId = createInternRes.body.user?.id;

  // 3. Verify Intern appears in GET /api/employees
  const getEmployeesRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const foundInEmployees = getEmployeesRes.body.employees?.some(e => e.id === internId);
  console.log('3. Intern found in /api/employees list:', foundInEmployees);

  // 4. Test Login as Intern
  const internLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: internEmail, password: 'password123', role: 'Employee' });

  console.log('4. Intern Login Status:', internLogin.status);
  console.log('   Intern Authenticated Name:', internLogin.body.user?.name);

  // 5. Clean up intern test user
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/auth/admin/users/${internId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('5. Cleaned up Intern test account.');

  if (createInternRes.status === 201 && foundInEmployees && internLogin.status === 200) {
    console.log('\n✅ INTERN ACCOUNT ROLE PROVISIONING & WORKFLOW VERIFIED 100%!');
  } else {
    throw new Error('Intern account verification failed!');
  }
}

testInternRole().catch(console.error);
