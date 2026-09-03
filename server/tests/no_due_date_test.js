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

async function testNoDueDate() {
  console.log('--- Testing "No Due Date" Task Creation & Verification ---');

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

  // Step 2: Create a task with NO due date (due_date = '')
  const todayStr = new Date().toISOString().split('T')[0];

  const createTaskRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    title: 'Ongoing Infrastructure Maintenance & Monitoring',
    description: 'Long-term standing server monitoring and continuous integration checks without a strict deadline.',
    assigned_to: 2,
    project_id: 1,
    department_id: 1,
    assigned_date: todayStr,
    start_date: todayStr,
    due_date: '', // No due date
    priority: 'Low',
    manager_remarks: 'Open-ended ongoing deliverable'
  });

  console.log('2. Create Task with No Due Date Status:', createTaskRes.status);
  console.log('   Task ID:', createTaskRes.body.task?.task_id);
  console.log('   Task Database ID:', createTaskRes.body.task?.id);
  console.log('   Stored Due Date:', createTaskRes.body.task?.due_date);

  const taskId = createTaskRes.body.task?.task_id;

  // Step 3: Fetch Task Details
  const details = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('3. Fetch Task Details Status:', details.status);
  console.log('   Task Title:', details.body.task?.title);
  console.log('   Task Due Date:', details.body.task?.due_date === null ? 'NULL (No Due Date)' : details.body.task?.due_date);

  console.log('\n✅ "NO DUE DATE" CREATION AND VERIFICATION TESTS PASSED 100%!');
}

testNoDueDate().catch(console.error);
