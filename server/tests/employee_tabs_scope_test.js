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

async function testEmployeeTabs() {
  console.log('--- Testing Employee "My Tasks" and "Assigned To" Tabs ---');

  // 1. Login as Admin to get employees
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

  console.log('1. Testing with Employee 1:', emp1?.name, `(${emp1?.email})`);
  console.log('   Testing with Employee 2:', emp2?.name, `(${emp2?.email})`);

  // Login as Employee 1
  const emp1Login = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp1.email, password: 'password123', role: 'Employee' });

  const emp1Token = emp1Login.body.token;

  // 2. Admin creates a task assigned TO Employee 1
  const todayStr = new Date().toISOString().split('T')[0];
  const taskToEmp1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Task Assigned TO Employee 1',
    description: 'Should appear in My Tasks tab',
    assigned_to: emp1.id,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'High'
  });

  const taskToEmp1Id = taskToEmp1.body.task?.id;
  console.log('2. Task assigned TO Employee 1 created. ID:', taskToEmp1Id);

  // 3. Employee 1 creates a task assigned BY Employee 1 TO Employee 2
  const taskByEmp1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${emp1Token}` }
  }, {
    title: 'Task Assigned BY Employee 1 to Colleague',
    description: 'Should appear in Assigned To tab',
    assigned_to: emp2.id,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'Medium'
  });

  const taskByEmp1Id = taskByEmp1.body.task?.id;
  console.log('3. Task assigned BY Employee 1 created. ID:', taskByEmp1Id);

  // 4. Test "My Tasks" query (scope=ASSIGNED_TO_ME) for Employee 1
  const myTasksRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks?scope=ASSIGNED_TO_ME',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${emp1Token}` }
  });

  const containsAssignedToMe = myTasksRes.body.tasks?.some(t => t.id === taskToEmp1Id);
  const containsAssignedByMeInMyTasks = myTasksRes.body.tasks?.some(t => t.id === taskByEmp1Id && emp1.id !== emp2.id);

  console.log('4. [My Tasks Tab] contains task assigned TO me:', containsAssignedToMe);

  // 5. Test "Assigned To" query (scope=ASSIGNED_BY_ME) for Employee 1
  const assignedToOthersRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks?scope=ASSIGNED_BY_ME',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${emp1Token}` }
  });

  const containsAssignedByMe = assignedToOthersRes.body.tasks?.some(t => t.id === taskByEmp1Id);
  const containsAssignedToMeInAssignedTo = assignedToOthersRes.body.tasks?.some(t => t.id === taskToEmp1Id);

  console.log('5. [Assigned To Tab] contains task assigned BY me:', containsAssignedByMe);
  console.log('   [Assigned To Tab] does NOT contain task assigned by Admin to me:', !containsAssignedToMeInAssignedTo);

  // Clean up
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskToEmp1Id}/permanent`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskByEmp1Id}/permanent`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (containsAssignedToMe && containsAssignedByMe && !containsAssignedToMeInAssignedTo) {
    console.log('\n✅ EMPLOYEE "MY TASKS" & "ASSIGNED TO" TABS VERIFIED 100%!');
  } else {
    throw new Error('Employee tabs verification failed!');
  }
}

testEmployeeTabs().catch(console.error);
