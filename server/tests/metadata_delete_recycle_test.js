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

async function testMetadataDeleteRecycle() {
  console.log('--- Testing Employee, Department, and Project Deletion -> Move Tasks to Recycle Bin ---');

  // 1. Admin Login
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  const adminToken = adminLogin.body.token;

  // 2. Create a temporary department
  const deptRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { name: `Temp Dept ${Date.now()}`, description: 'Testing task recycling' });

  const deptId = deptRes.body.department?.id;
  console.log('1. Created Department ID:', deptId);

  // 3. Create a temporary project
  const projRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/projects',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { name: `Temp Proj ${Date.now()}`, department_id: deptId, description: 'Testing task recycling' });

  const projId = projRes.body.project?.id;
  console.log('2. Created Project ID:', projId);

  // 4. Create a temporary employee
  const empRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { name: `Temp Staff ${Date.now()}`, department_id: deptId, title: 'Employee' });

  const empId = empRes.body.employee?.id;
  console.log('3. Created Employee ID:', empId);

  // 5. Create tasks linked to this Project, Dept, and Employee
  const todayStr = new Date().toISOString().split('T')[0];
  const task1Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Recycle on Emp Delete Test Task',
    description: 'Testing task recycling',
    assigned_to: empId,
    project_id: projId,
    department_id: deptId,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'Medium'
  });

  const task1Id = task1Res.body.task?.id;
  console.log('4. Created Task 1 ID:', task1Id);

  // 6. Delete the employee -> Task 1 should be moved to Recycle Bin
  const delEmpRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${empId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('5. Employee delete status:', delEmpRes.status);

  // Check recycle bin for Task 1
  const recycleList1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks/recycle-bin/list',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const foundTask1InBin = recycleList1.body.tasks?.some(t => t.id === task1Id);
  console.log('   Task 1 found in Recycle Bin after employee deleted:', foundTask1InBin, `(Expected: true)`);
  if (!foundTask1InBin) throw new Error('Task 1 was not moved to recycle bin when employee was deleted!');

  // 7. Create Task 2 linked to Project & Dept
  const task2Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Recycle on Project Delete Test Task',
    description: 'Testing project task recycling',
    assigned_to: 1,
    project_id: projId,
    department_id: deptId,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'High'
  });

  const task2Id = task2Res.body.task?.id;
  console.log('6. Created Task 2 ID:', task2Id);

  // Delete Project -> Task 2 should be moved to Recycle Bin
  const delProjRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/projects/${projId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('7. Project delete status:', delProjRes.status);

  const recycleList2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks/recycle-bin/list',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const foundTask2InBin = recycleList2.body.tasks?.some(t => t.id === task2Id);
  console.log('   Task 2 found in Recycle Bin after project deleted:', foundTask2InBin, `(Expected: true)`);
  if (!foundTask2InBin) throw new Error('Task 2 was not moved to recycle bin when project was deleted!');

  // 8. Create Task 3 linked to Dept
  const task3Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Recycle on Dept Delete Test Task',
    description: 'Testing department task recycling',
    assigned_to: 1,
    project_id: 1,
    department_id: deptId,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'Low'
  });

  const task3Id = task3Res.body.task?.id;
  console.log('8. Created Task 3 ID:', task3Id);

  // Delete Department -> Task 3 should be moved to Recycle Bin
  const delDeptRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/departments/${deptId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('9. Department delete status:', delDeptRes.status);

  const recycleList3 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks/recycle-bin/list',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const foundTask3InBin = recycleList3.body.tasks?.some(t => t.id === task3Id);
  console.log('   Task 3 found in Recycle Bin after department deleted:', foundTask3InBin, `(Expected: true)`);
  if (!foundTask3InBin) throw new Error('Task 3 was not moved to recycle bin when department was deleted!');

  // Clean up recycled test tasks
  for (const tid of [task1Id, task2Id, task3Id]) {
    await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/tasks/${tid}/permanent`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
  }

  console.log('\n✅ EMPLOYEE, DEPARTMENT, AND PROJECT DELETION -> RECYCLE BIN BEHAVIOR VERIFIED 100%!');
}

testMetadataDeleteRecycle().catch(console.error);
