import http from 'http';
import assert from 'assert';

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
  console.log('🚀 Running Task Reference Links Test...');

  // 1. Admin Login
  const adminRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });
  const adminToken = adminRes.body.token;

  // 2. Metadata
  const empRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/employees', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  const emp = empRes.body.employees[0];

  const deptsRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/departments', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  const projsRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/projects', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + adminToken }
  });

  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const initialLinks = [
    { url: 'https://github.com/astrocally/tasks', title: 'GitHub Repo' },
    { url: 'figma.com/design/task-specs', title: 'Figma UI' }
  ];

  const postBody = [
    '--' + boundary,
    'Content-Disposition: form-data; name="title"', '', 'Task with Reference Links',
    '--' + boundary,
    'Content-Disposition: form-data; name="description"', '', 'Checking reference links in task',
    '--' + boundary,
    'Content-Disposition: form-data; name="assigned_to"', '', String(emp.id),
    '--' + boundary,
    'Content-Disposition: form-data; name="project_id"', '', String(projsRes.body.projects[0].id),
    '--' + boundary,
    'Content-Disposition: form-data; name="department_id"', '', String(deptsRes.body.departments[0].id),
    '--' + boundary,
    'Content-Disposition: form-data; name="start_date"', '', '2026-10-18',
    '--' + boundary,
    'Content-Disposition: form-data; name="links"', '', JSON.stringify(initialLinks),
    '--' + boundary + '--'
  ].join('\r\n');

  const createRes = await makeReq({
    hostname: 'localhost', port: 5000, path: '/api/tasks', method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + adminToken,
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    }
  }, postBody);

  assert.strictEqual(createRes.status, 201, 'Task creation should succeed');
  const taskId = createRes.body.task.id;
  console.log('1. Created task ID:', taskId);

  // 3. Fetch single task
  const taskRes = await makeReq({
    hostname: 'localhost', port: 5000, path: `/api/tasks/${taskId}`, method: 'GET',
    headers: { 'Authorization': 'Bearer ' + adminToken }
  });

  assert.strictEqual(taskRes.status, 200, 'Fetch task details must succeed');
  const fetchedLinks = JSON.parse(taskRes.body.task.links || '[]');
  console.log('2. Fetched links:', fetchedLinks);
  assert.strictEqual(fetchedLinks.length, 2);
  assert.strictEqual(fetchedLinks[0].title, 'GitHub Repo');
  assert.strictEqual(fetchedLinks[1].url, 'https://figma.com/design/task-specs');

  // 4. Test that empty URL is rejected
  const invalidUpdateRes = await makeReq({
    hostname: 'localhost', port: 5000, path: `/api/tasks/${taskId}`, method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + adminToken,
      'Content-Type': 'application/json'
    }
  }, {
    title: 'Task with Reference Links (Updated)',
    links: [{ title: 'Empty Link', url: '' }]
  });
  console.log('4. Rejection of empty link URL status:', invalidUpdateRes.status);
  assert.strictEqual(invalidUpdateRes.status, 400, 'Empty link URL must be rejected with 400');

  // 5. Update task links via PUT with valid links
  const updatedLinks = [
    { url: 'https://jira.atlassian.com/browse/TASK-101', title: 'Jira Ticket' },
    { url: 'https://docs.google.com/document/d/123', title: 'Tech Spec Doc' },
    { url: 'gitlab.com/ci-cd', title: '' }
  ];

  const updateRes = await makeReq({
    hostname: 'localhost', port: 5000, path: `/api/tasks/${taskId}`, method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + adminToken,
      'Content-Type': 'application/json'
    }
  }, {
    title: 'Task with Reference Links (Updated)',
    links: updatedLinks
  });

  assert.strictEqual(updateRes.status, 200, 'Update task must succeed');

  // 6. Verify update
  const taskUpdatedRes = await makeReq({
    hostname: 'localhost', port: 5000, path: `/api/tasks/${taskId}`, method: 'GET',
    headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  const reFetchedLinks = JSON.parse(taskUpdatedRes.body.task.links || '[]');
  console.log('5. Re-fetched updated links:', reFetchedLinks);
  assert.strictEqual(reFetchedLinks.length, 3);
  assert.strictEqual(reFetchedLinks[0].title, 'Jira Ticket');
  assert.strictEqual(reFetchedLinks[1].url, 'https://docs.google.com/document/d/123');

  console.log('🎉 ALL REFERENCE LINKS AND EMPTY VALIDATION TESTS PASSED 100%!');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
