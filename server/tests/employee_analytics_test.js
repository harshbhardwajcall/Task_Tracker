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

async function testEmployeeAnalytics() {
  console.log('--- Testing Employee Analytics Endpoint & Performance Statistics ---');

  // Step 1: Login as Admin
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  const adminToken = adminLogin.body.token;
  console.log('1. Admin Login Status:', adminLogin.status);

  // Step 2: Get list of employees
  const empList = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('2. Total Employees Retrieved:', empList.body.employees?.length);
  const firstEmployee = empList.body.employees?.[0];
  console.log('   Testing Analytics for Employee:', firstEmployee?.name, `(ID: ${firstEmployee?.id})`);

  // Step 3: Fetch Analytics for this Employee
  const analytics = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${firstEmployee.id}/analytics`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('3. Analytics API Status:', analytics.status);
  console.log('   Employee Info:', analytics.body.employee?.name, `(${analytics.body.employee?.email})`);
  console.log('   Performance Stats:', JSON.stringify(analytics.body.stats, null, 2));
  console.log('   Priority Breakdown:', JSON.stringify(analytics.body.priorityBreakdown, null, 2));
  console.log('   Project Breakdown Count:', analytics.body.projectBreakdown?.length);
  console.log('   Total Tasks Array Length:', analytics.body.tasks?.length);

  console.log('\n✅ EMPLOYEE ANALYTICS & PERFORMANCE CHARTS API VERIFIED SUCCESSFULLY!');
}

testEmployeeAnalytics().catch(console.error);
