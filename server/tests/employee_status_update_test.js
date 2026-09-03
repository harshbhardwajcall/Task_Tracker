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

async function testEmployeeStatusUpdate() {
  console.log('--- Testing Employee & Delegated Task Status Updates ---');

  // 1. Admin Login & Get Employees
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
  const emp2 = empListRes.body.employees?.[1] || empListRes.body.employees?.[0];

  console.log('1. Employee 1:', emp1.name, `(${emp1.email})`);
  console.log('   Employee 2:', emp2.name, `(${emp2.email})`);

  // Login as Employee 1
  const emp1Login = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp1.email, password: 'password123', role: 'Employee' });

  const emp1Token = emp1Login.body.token;

  // Case A: Task assigned TO Employee 1 by Admin -> Employee 1 updates status
  const todayStr = new Date().toISOString().split('T')[0];
  const taskToEmp1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Status Update Test Task A',
    description: 'Testing employee updating assigned task status',
    assigned_to: emp1.id,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'Medium'
  });

  const taskAId = taskToEmp1.body.task?.id;
  console.log('2. Created Task A (assigned TO Emp1). ID:', taskAId);

  // Employee 1 updates Task A status to 'In Progress'
  const updateA1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskAId}/status`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${emp1Token}` }
  }, { status: 'In Progress' });

  console.log('3. Employee 1 updated Task A status to "In Progress":', updateA1.status, updateA1.body.message);

  // Employee 1 updates Task A status to 'Completed'
  const updateA2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskAId}/status`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${emp1Token}` }
  }, { status: 'Completed' });

  console.log('4. Employee 1 updated Task A status to "Completed":', updateA2.status, updateA2.body.message);

  // Case B: Task created & assigned BY Employee 1 to Employee 2 -> Employee 1 updates status
  const taskByEmp1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${emp1Token}` }
  }, {
    title: 'Status Update Test Task B',
    description: 'Testing employee creator updating delegated task status',
    assigned_to: emp2.id,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'High'
  });

  const taskBId = taskByEmp1.body.task?.id;
  console.log('5. Created Task B (assigned BY Emp1 to Emp2). ID:', taskBId);

  // Employee 1 (Creator/Assigner) updates Task B status
  const updateB1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskBId}/status`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${emp1Token}` }
  }, { status: 'In Progress' });

  console.log('6. Employee 1 (Creator) updated Task B status to "In Progress":', updateB1.status, updateB1.body.message);

  // Clean up
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskAId}/permanent`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskBId}/permanent`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (updateA1.status === 200 && updateA2.status === 200 && updateB1.status === 200) {
    console.log('\n✅ ALL EMPLOYEE STATUS UPDATE SCENARIOS VERIFIED 100%!');
  } else {
    throw new Error('Status update test failed!');
  }
}

testEmployeeStatusUpdate().catch(console.error);
