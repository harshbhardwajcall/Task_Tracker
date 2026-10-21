import http from 'http';

function makeReq(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    if (postData) {
      if (typeof postData === 'string') {
        req.write(postData);
      } else {
        req.write(JSON.stringify(postData));
      }
    }
    req.end();
  });
}

async function run() {
  // 1. Admin Login
  const adminRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });
  const adminToken = adminRes.body.token;

  // Get employees
  const empRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/employees', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  const emps = empRes.body.employees || [];
  const emp1 = emps[0];
  const emp2 = emps[1];

  const emp1Login = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp1.email, password: 'password123', role: 'Employee' });
  const emp1Token = emp1Login.body.token;

  const emp2Login = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: emp2.email, password: 'password123', role: 'Employee' });
  const emp2Token = emp2Login.body.token;

  const deptsRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/departments', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  const projsRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/projects', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  const deptId = deptsRes.body.departments[0].id;
  const projId = projsRes.body.projects[0].id;

  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const postBody = [
    '--' + boundary,
    'Content-Disposition: form-data; name="title"', '', 'Collaborative Task for Dependency Visibility',
    '--' + boundary,
    'Content-Disposition: form-data; name="description"', '', 'Testing dependency visibility across employee portals',
    '--' + boundary,
    'Content-Disposition: form-data; name="assigned_to"', '', String(emp1.id),
    '--' + boundary,
    'Content-Disposition: form-data; name="project_id"', '', String(projId),
    '--' + boundary,
    'Content-Disposition: form-data; name="department_id"', '', String(deptId),
    '--' + boundary,
    'Content-Disposition: form-data; name="start_date"', '', '2026-10-17',
    '--' + boundary,
    'Content-Disposition: form-data; name="due_date"', '', '2026-10-25',
    '--' + boundary,
    'Content-Disposition: form-data; name="dependencies"', '', JSON.stringify([emp2.id]),
    '--' + boundary + '--'
  ].join('\r\n');

  const createRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/tasks', method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + emp1Token,
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    }
  }, postBody);
  console.log('1. Task created status:', createRes.status);
  const createdTaskId = createRes.body.task.id;

  // Emp 2 checks scope=DEPENDENCY_TASKS
  const depTasksRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/tasks?scope=DEPENDENCY_TASKS', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + emp2Token }
  });
  const foundInDepScope = depTasksRes.body.tasks.some(t => t.id === createdTaskId);
  console.log('2. Emp 2 found task in DEPENDENCY_TASKS scope:', foundInDepScope);

  // Emp 2 checks default dashboard (scope='')
  const allTasksRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/tasks', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + emp2Token }
  });
  console.log('allTasksRes status:', allTasksRes.status, allTasksRes.body);
  const foundInDashboard = allTasksRes.body?.tasks?.some(t => t.id === createdTaskId);
  console.log('3. Emp 2 found task in default Dashboard:', foundInDashboard);

  // Emp 2 checks scope=ASSIGNED_TO_ME
  const assignedToMeRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/tasks?scope=ASSIGNED_TO_ME', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + emp2Token }
  });
  console.log('assignedToMeRes status:', assignedToMeRes.status, typeof assignedToMeRes.body);
  const foundInAssignedToMe = assignedToMeRes.body?.tasks?.some(t => t.id === createdTaskId);
  console.log('4. Emp 2 found task in ASSIGNED_TO_ME scope:', foundInAssignedToMe);

  // Emp 2 updates status to In Progress
  const statusUpdateRes = await makeReq({
    hostname: 'localhost', port: 5000, path: `/api/tasks/${createdTaskId}/status`, method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + emp2Token,
      'Content-Type': 'application/json'
    }
  }, JSON.stringify({ status: 'In Progress' }));
  console.log('5. Emp 2 status update result:', statusUpdateRes.status, statusUpdateRes.body.message);

  if (foundInDepScope && foundInDashboard && foundInAssignedToMe && statusUpdateRes.status === 200) {
    console.log('🎉 SUCCESS! Dependency employee visibility & collaboration fully verified.');
    process.exit(0);
  } else {
    console.error('❌ FAILED verification!');
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
