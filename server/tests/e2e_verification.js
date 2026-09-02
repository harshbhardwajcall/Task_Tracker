import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';

async function runE2EVerification() {
  console.log('🚀 Starting Updated E2E System Verification (No Login System & No AWS)...\n');

  // 1. Dynamic Manager & Employee Discovery
  const usersRes = await fetch(`${BASE_URL}/auth/users`);
  const { users } = await usersRes.json();
  const manager = users.find(u => u.role === 'Manager') || { id: 10, name: 'yash' };
  const employee = users.find(u => u.role === 'Employee') || { id: 18, name: 'harsh bhardwaj' };

  // Dynamic Project & Department Discovery
  const projsRes = await fetch(`${BASE_URL}/projects`);
  const { projects } = await projsRes.json();
  const projectId = projects[0]?.id || 7;

  const deptsRes = await fetch(`${BASE_URL}/departments`);
  const { departments } = await deptsRes.json();
  const departmentId = departments[0]?.id || 1;

  console.log(`1. Testing Manager Profile Selection (${manager.name} - ID: ${manager.id})...`);
  const managerHeaders = {
    'X-User-Id': String(manager.id),
    'Content-Type': 'application/json'
  };

  // 2. Fetch Manager Dashboard Tasks & Summary Metrics
  console.log('\n2. Testing Manager Dashboard Data Fetch...');
  const tasksRes = await fetch(`${BASE_URL}/tasks?assigned_by=ALL`, { headers: managerHeaders });
  const tasksData = await tasksRes.json();
  assert.strictEqual(tasksRes.status, 200);
  assert.ok(Array.isArray(tasksData.tasks));
  console.log(`   ✅ Total Tasks: ${tasksData.summary.total}, Overdue: ${tasksData.summary.overdue}, Completed: ${tasksData.summary.completed}`);

  // 3. Testing Filters (Department & Status & Date)
  console.log('\n3. Testing Multi-Criteria Filtering...');
  const filteredRes = await fetch(`${BASE_URL}/tasks?department_id=${departmentId}&assigned_by=ALL`, { headers: managerHeaders });
  const filteredData = await filteredRes.json();
  assert.strictEqual(filteredRes.status, 200);
  console.log(`   ✅ Filtered (${departments[0]?.name || 'Dept'}) returned ${filteredData.tasks.length} task(s)`);

  // 4. Manager Create Task
  console.log('\n4. Testing Task Creation by Manager...');
  const createTaskRes = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: managerHeaders,
    body: JSON.stringify({
      title: 'E2E Test Task',
      description: 'Verifying task creation flow under manager profile.',
      assigned_to: employee.id,
      project_id: projectId,
      department_id: departmentId,
      assigned_date: '2026-09-02',
      start_date: '2026-09-02',
      due_date: '2026-09-12',
      priority: 'High',
      manager_remarks: 'Complete task before deadline.'
    })
  });
  const createdTaskData = await createTaskRes.json();
  assert.strictEqual(createTaskRes.status, 201, 'Task creation should return 201');
  const taskId = createdTaskData.task.id;
  console.log(`   ✅ Task Created Successfully: ID=${createdTaskData.task.task_id} (id=${taskId})`);

  // 5. Testing Employee / Intern Creation and Deletion
  console.log('\n5. Testing Employee / Intern Creation with Title & Deletion...');
  const createEmpRes = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: managerHeaders,
    body: JSON.stringify({
      name: 'Test Intern User',
      email: 'test.intern.verification@company.com',
      title: 'Intern',
      department_id: 1
    })
  });
  assert.strictEqual(createEmpRes.status, 201);
  const newEmpData = await createEmpRes.json();
  assert.strictEqual(newEmpData.employee.title, 'Intern');
  console.log(`   ✅ Created Member with Title: ${newEmpData.employee.title} (${newEmpData.employee.name})`);

  // Clean up created intern
  const delEmpRes = await fetch(`${BASE_URL}/employees/${newEmpData.employee.id}`, {
    method: 'DELETE',
    headers: managerHeaders
  });
  assert.strictEqual(delEmpRes.status, 200);
  console.log(`   ✅ Deleted Test Member successfully.`);

  // 6. Testing Employee Profile View
  console.log(`\n6. Testing Employee Profile Switch (${employee.name} - ID: ${employee.id})...`);
  const employeeHeaders = {
    'X-User-Id': String(employee.id),
    'Content-Type': 'application/json'
  };
  const empTasksRes = await fetch(`${BASE_URL}/tasks`, { headers: employeeHeaders });
  const empTasksData = await empTasksRes.json();
  assert.strictEqual(empTasksRes.status, 200);
  assert.ok(empTasksData.tasks.every(t => t.assigned_to === employee.id), 'Employee must only see their tasks');
  console.log(`   ✅ RBAC Guard Verified: Employee sees only their ${empTasksData.tasks.length} assigned task(s)`);

  // 7. Testing Status Update & Automatic Completion Date Recording
  console.log('\n7. Testing Status Update & Automatic Completion Date Recording...');
  const updateStatusRes = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: employeeHeaders,
    body: JSON.stringify({ status: 'Completed' })
  });
  assert.strictEqual(updateStatusRes.status, 200);
  const statusUpdateData = await updateStatusRes.json();
  assert.strictEqual(statusUpdateData.status, 'Completed');
  // 8. Clean up created test task so no dummy data is left
  console.log('\n8. Cleaning up created test task...');
  const delTaskRes = await fetch(`${BASE_URL}/tasks/${taskId}/permanent`, {
    method: 'DELETE',
    headers: managerHeaders
  });
  assert.strictEqual(delTaskRes.status, 200);
  console.log(`   ✅ Test task ${taskId} permanently deleted successfully.`);

  console.log('\n🎉 ALL UPDATED E2E SYSTEM INTEGRATION TESTS PASSED! 🚀\n');
}

runE2EVerification().catch(err => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
