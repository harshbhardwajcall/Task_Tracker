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

async function testCompletedTasksLifecycle() {
  console.log('--- Testing Automatic Move to Completed Tasks Tab ---');

  // 1. Login as Admin to fetch valid employee
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

  const targetEmp = empListRes.body.employees?.[0];
  console.log('1. Target Employee for test:', targetEmp?.name, `(${targetEmp?.email})`);

  // Login as that employee
  const empLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: targetEmp.email, password: 'password123', role: 'Employee' });

  const empToken = empLogin.body.token;
  const empId = targetEmp.id;
  console.log('2. Employee Login Status:', empLogin.status);

  // 2. Create a test deliverable for this employee
  const todayStr = new Date().toISOString().split('T')[0];
  const createTaskRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Deliverable Lifecycle Completion Test',
    description: 'Testing automatic movement to Completed Tasks tab upon completion.',
    assigned_to: empId,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'High'
  });

  const taskId = createTaskRes.body.task?.id;
  console.log('3. Created Task ID:', taskId);

  // 3. Query Active Dashboard (exclude_completed=true)
  const activeDashboardRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks?exclude_completed=true',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });

  const existsInActive = activeDashboardRes.body.tasks?.some(t => t.id === taskId);
  console.log('4. Task exists in Active Dashboard before completion:', existsInActive);

  // 4. Update task status to "Completed"
  const updateStatusRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/status`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${empToken}` }
  }, { status: 'Completed' });

  console.log('5. Updated Status to Completed:', updateStatusRes.status, '- Message:', updateStatusRes.body.message);

  // 5. Query Active Dashboard again
  const activeAfterRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks?exclude_completed=true',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });

  const existsInActiveAfter = activeAfterRes.body.tasks?.some(t => t.id === taskId);
  console.log('6. Task exists in Active Dashboard after completion:', existsInActiveAfter, '(Expected: false)');

  // 6. Query Completed Tasks tab (status=Completed)
  const completedTabRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks?status=Completed',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });

  const existsInCompletedTab = completedTabRes.body.tasks?.some(t => t.id === taskId);
  console.log('7. Task exists in Completed Tasks Tab:', existsInCompletedTab, '(Expected: true)');

  // Cleanup
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/permanent`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (existsInActive && !existsInActiveAfter && existsInCompletedTab) {
    console.log('\n✅ AUTOMATIC MOVE TO COMPLETED TASKS TAB VERIFIED 100%!');
  } else {
    throw new Error('Task movement to Completed Tasks tab failed verification!');
  }
}

testCompletedTasksLifecycle().catch(console.error);
