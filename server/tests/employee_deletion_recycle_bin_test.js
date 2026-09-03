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

async function testEmployeeDeletionRecycleBin() {
  console.log('--- Testing Employee Deletion -> Task Recycle Bin Movement ---');

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

  // Step 2: Create a temporary test employee
  const createEmp = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    name: 'Temporary Intern',
    email: 'temp.intern@company.com',
    password: 'password123',
    department_id: 1,
    title: 'Intern'
  });

  console.log('2. Created Temporary Employee Status:', createEmp.status);
  const employeeId = createEmp.body.employee?.id;
  console.log('   Employee ID:', employeeId, '- Name:', createEmp.body.employee?.name);

  // Step 3: Create 2 tasks assigned to this employee
  const todayStr = new Date().toISOString().split('T')[0];

  const task1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Intern First Assignment',
    description: 'Documentation and unit tests for onboarding.',
    assigned_to: employeeId,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'Medium'
  });

  const task2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Intern Secondary Project',
    description: 'Design mockups and user flow diagrams.',
    assigned_to: employeeId,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: '',
    priority: 'Low'
  });

  console.log('3. Created Tasks:', task1.body.task?.task_id, '&', task2.body.task?.task_id);

  // Step 4: Delete the employee
  const deleteEmp = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${employeeId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('4. Delete Employee Status:', deleteEmp.status);
  console.log('   Response Message:', deleteEmp.body.message);

  // Step 5: Check Recycle Bin to verify both tasks are in the Recycle Bin!
  const recycleBin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks/recycle-bin/list',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('5. Recycle Bin Tasks Count:', recycleBin.body.tasks?.length);
  const foundTask1 = recycleBin.body.tasks?.find(t => t.task_id === task1.body.task?.task_id);
  const foundTask2 = recycleBin.body.tasks?.find(t => t.task_id === task2.body.task?.task_id);

  console.log('   Task 1 found in Recycle Bin:', !!foundTask1, '- Title:', foundTask1?.title);
  console.log('   Task 2 found in Recycle Bin:', !!foundTask2, '- Title:', foundTask2?.title);

  if (foundTask1 && foundTask2) {
    console.log('\n✅ EMPLOYEE DELETION SAFELY MOVED ALL TASKS TO RECYCLE BIN WITH 100% SUCCESS!');
  } else {
    throw new Error('Tasks not found in Recycle Bin!');
  }
}

testEmployeeDeletionRecycleBin().catch(console.error);
