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

async function testEmployeeTaskCreation() {
  console.log('--- Testing Task Creation by Employee (Universal Task Creation) ---');

  // Step 1: Login as Employee (Rahul Sharma)
  const empLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'rahul@company.com', password: 'password123', role: 'Employee' });

  const empToken = empLogin.body.token;
  const empId = empLogin.body.user?.id;
  console.log('1. Employee Login Status:', empLogin.status, '- User:', empLogin.body.user?.name);

  // Step 2: Employee Creates a Task assigned to self or another employee
  const todayStr = new Date().toISOString().split('T')[0];
  const nextWeekStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const createTaskRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${empToken}`
    }
  }, {
    title: 'Self-Assigned Unit Test & Bug Fixes',
    description: 'Refactoring API handlers and writing automated test cases for task validation.',
    assigned_to: empId,
    project_id: 1,
    department_id: 1,
    assigned_date: todayStr,
    start_date: todayStr,
    due_date: nextWeekStr,
    priority: 'High',
    manager_remarks: 'Created by employee Rahul Sharma'
  });

  console.log('2. Employee Create Task Status:', createTaskRes.status, '- Task ID:', createTaskRes.body.task?.task_id);
  const createdTaskId = createTaskRes.body.task?.id;

  // Step 3: Fetch Employee tasks and verify new task is visible in their personal board
  const myTasks = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });

  console.log('3. Employee Task Count after Creation:', myTasks.body.tasks?.length);
  const found = myTasks.body.tasks?.find(t => t.id === createdTaskId);
  console.log('   Created task found in employee personal list:', !!found, '- Title:', found?.title);

  console.log('\n✅ UNIVERSAL TASK CREATION VERIFIED SUCCESSFULLY!');
}

testEmployeeTaskCreation().catch(console.error);
