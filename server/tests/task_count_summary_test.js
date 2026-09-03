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

async function testSummaryTaskCount() {
  console.log('--- Testing Employee Dashboard Summary Task Count Accuracy ---');

  // 1. Login as Admin to fetch employees
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  const adminToken = adminLogin.body.token;

  const empListRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const emp1 = empListRes.body.employees?.[0];
  console.log('1. Testing Employee:', emp1?.name, `(${emp1?.email})`);

  // Login as Employee 1
  const emp1Login = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp1.email, password: 'password123', role: 'Employee' });

  const emp1Token = emp1Login.body.token;

  // 2. Fetch Employee Dashboard tasks
  const empTasksRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${emp1Token}` }
  });

  const taskCount = empTasksRes.body.tasks?.length;
  const summaryTotal = empTasksRes.body.summary?.total;

  console.log('2. Tasks in Table:', taskCount);
  console.log('   Summary Cards Total:', summaryTotal);

  if (taskCount === summaryTotal) {
    console.log('\n✅ TASK TABLE COUNT AND SUMMARY CARDS MATCH 100%!');
  } else {
    throw new Error(`Mismatch between tasks length (${taskCount}) and summary total (${summaryTotal})!`);
  }
}

testSummaryTaskCount().catch(console.error);
