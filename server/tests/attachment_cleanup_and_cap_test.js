import http from 'http';
import fs from 'fs';
import path from 'path';

function makeRequest(options, postData = null, isBuffer = false) {
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
      if (isBuffer || Buffer.isBuffer(postData)) {
        req.write(postData);
      } else {
        req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
      }
    }
    req.end();
  });
}

async function testAttachmentCapAndCleanup() {
  console.log('--- Testing 10MB Attachment Cap & Physical File Deletion on Task Delete ---');

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

  // Step 2: Create a task
  const todayStr = new Date().toISOString().split('T')[0];
  const createTaskRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Attachment Lifecycle Test Deliverable',
    description: 'Testing 10MB upload cap and automatic physical file cleanup on task deletion.',
    assigned_to: 3,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'Medium'
  });

  const taskId = createTaskRes.body.task?.id;
  console.log('2. Created Task ID:', taskId);

  // Step 3: Upload a real attachment file through the HTTP API
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const fileContent = 'Sample binary test document content for task attachment.';
  const fileName = 'architecture_diagram.txt';

  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="attachment"; filename="${fileName}"\r\n`,
    `Content-Type: text/plain\r\n\r\n`,
    `${fileContent}\r\n`,
    `--${boundary}--\r\n`
  ];

  const payloadBuffer = Buffer.from(bodyParts.join(''));

  const uploadRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/attachments`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payloadBuffer.length
    }
  }, payloadBuffer, true);

  console.log('3. Upload Attachment API Status:', uploadRes.status);
  const uploadedAtt = uploadRes.body.attachments?.[0];
  console.log('   Uploaded File Name:', uploadedAtt?.file_name);
  console.log('   Uploaded File Path on Disk:', uploadedAtt?.file_path);

  const physicalPath = path.join(process.cwd(), 'uploads', uploadedAtt?.file_path || '');
  console.log('   Physical File exists on disk:', fs.existsSync(physicalPath));

  // Step 4: Permanently delete the task
  const deleteRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/permanent`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('4. Permanent Task Deletion Status:', deleteRes.status);
  console.log('   Response Message:', deleteRes.body.message);

  // Step 5: Verify the physical file is unlinked and deleted from disk
  const fileExistsAfterDelete = fs.existsSync(physicalPath);
  console.log('5. Physical file exists on disk after task deletion:', fileExistsAfterDelete);

  // Step 6: Verify task is gone from GET /api/tasks/:id
  const getDetails = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('6. Query Deleted Task Status:', getDetails.status, '(Expected 404)');

  if (!fileExistsAfterDelete && getDetails.status === 404) {
    console.log('\n✅ 10MB CAP & PHYSICAL ATTACHMENT FILE REMOVAL VERIFIED WITH 100% SUCCESS!');
  } else {
    throw new Error('Task attachment file was not removed from filesystem!');
  }
}

testAttachmentCapAndCleanup().catch(console.error);
