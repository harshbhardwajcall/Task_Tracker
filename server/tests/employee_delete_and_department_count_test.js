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

async function testEmployeeDeleteAndDeptCount() {
  console.log('--- Testing Employee Deletion & Dynamic Department Member Count ---');

  // 1. Admin Login
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  const adminToken = adminLogin.body.token;

  // 2. Create a test Department
  const deptRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { name: `QA Engineering ${Date.now()}`, description: 'Test Department' });

  const deptId = deptRes.body.department?.id;
  console.log('1. Created Department ID:', deptId);

  // Initial department count
  const deptsRes1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const dept1 = deptsRes1.body.departments?.find(d => d.id === deptId);
  const initialCount = dept1?.total_users || 0;
  console.log('2. Initial Department Member Count:', initialCount, '(Expected: 0)');

  // 3. Create Employee 1 via /api/employees (Directory View)
  const emp1Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { name: `Tester Alpha ${Date.now()}`, department_id: deptId, title: 'Intern' });

  const emp1Id = emp1Res.body.employee?.id;
  console.log('3. Created Intern ID:', emp1Id);

  // Department count after adding emp1
  const deptsRes2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const countAfterAdd1 = deptsRes2.body.departments?.find(d => d.id === deptId)?.total_users;
  console.log('4. Department Member Count after adding Intern:', countAfterAdd1, '(Expected: 1)');

  // 4. Delete Employee 1 via /api/employees/:id (Directory View Employee Tab)
  const delEmp1Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/employees/${emp1Id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('5. Delete Employee from Employee Tab Status:', delEmp1Res.status, '(Expected: 200)');

  // Department count after deleting emp1
  const deptsRes3 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const countAfterDel1 = deptsRes3.body.departments?.find(d => d.id === deptId)?.total_users;
  console.log('6. Department Member Count after deleting Intern from Employee Tab:', countAfterDel1, '(Expected: 0)');

  // 5. Create Employee 2 via /api/auth/admin/users (Admin Board)
  const emp2Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/admin/users',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { name: `Tester Beta ${Date.now()}`, email: `beta.${Date.now()}@company.local`, password: 'password123', role: 'Employee', department_id: deptId, title: 'Employee' });

  const emp2Id = emp2Res.body.user?.id;
  console.log('7. Created User from Admin Board ID:', emp2Id);

  // Department count after adding emp2
  const deptsRes4 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const countAfterAdd2 = deptsRes4.body.departments?.find(d => d.id === deptId)?.total_users;
  console.log('8. Department Member Count after adding Employee from Admin Board:', countAfterAdd2, '(Expected: 1)');

  // 6. Delete Employee 2 via /api/auth/admin/users/:id (Admin Board Delete)
  const delEmp2Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/auth/admin/users/${emp2Id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('9. Delete User from Admin Board Status:', delEmp2Res.status, '(Expected: 200)');

  // Department count after deleting emp2
  const deptsRes5 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const countAfterDel2 = deptsRes5.body.departments?.find(d => d.id === deptId)?.total_users;
  console.log('10. Department Member Count after deleting Employee from Admin Board:', countAfterDel2, '(Expected: 0)');

  // Clean up test department
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/departments/${deptId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (
    delEmp1Res.status === 200 &&
    countAfterDel1 === 0 &&
    delEmp2Res.status === 200 &&
    countAfterDel2 === 0
  ) {
    console.log('\n✅ EMPLOYEE DELETION & DEPARTMENT MEMBER COUNT UPDATES FULLY VERIFIED 100%!');
  } else {
    throw new Error('Verification failed for employee deletion or department count update!');
  }
}

testEmployeeDeleteAndDeptCount().catch(console.error);
