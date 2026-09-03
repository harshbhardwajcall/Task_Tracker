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

async function testAdminEditTask() {
  console.log('--- Testing Admin Full Task Edit Capability ---');

  // 1. Admin Login
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  const adminToken = adminLogin.body.token;

  // 2. Fetch Employees & Projects
  const empListRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const emp1 = empListRes.body.employees?.[0];
  const emp2 = empListRes.body.employees?.[1] || emp1;

  // 3. Create a test task assigned to emp1
  const todayStr = new Date().toISOString().split('T')[0];
  const createRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Original Title Before Admin Edit',
    description: 'Original Scope',
    assigned_to: emp1.id,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'Low',
    manager_remarks: 'Initial remarks'
  });

  const taskId = createRes.body.task?.id;
  console.log('1. Created Task ID:', taskId, 'Assigned to:', emp1.name);

  // 4. Admin edits the task (Reassign to emp2, change priority, status, title, remarks)
  const editRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Updated Title By Administrator',
    description: 'Updated Scope & Requirements',
    assigned_to: emp2.id,
    project_id: 2,
    department_id: 2,
    start_date: todayStr,
    due_date: null, // Test No Due Date
    priority: 'Critical',
    status: 'In Progress',
    manager_remarks: 'Supervisory review completed.'
  });

  console.log('2. Admin Edit Task Status:', editRes.status, `(Expected: 200)`);
  const updatedTask = editRes.body.task;
  console.log('   New Title:', updatedTask.title);
  console.log('   New Assignee ID:', updatedTask.assigned_to);
  console.log('   New Priority:', updatedTask.priority);
  console.log('   New Status:', updatedTask.status);
  console.log('   New Due Date:', updatedTask.due_date);
  console.log('   New Remarks:', updatedTask.manager_remarks);

  // Clean up
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/permanent`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (
    editRes.status === 200 &&
    updatedTask.title === 'Updated Title By Administrator' &&
    updatedTask.priority === 'Critical' &&
    updatedTask.status === 'In Progress' &&
    updatedTask.due_date === null
  ) {
    console.log('\n✅ ADMIN FULL TASK EDIT CONTROL VERIFIED 100%!');
  } else {
    throw new Error('Admin task editing verification failed!');
  }
}

testAdminEditTask().catch(console.error);
