import fs from 'fs';
import path from 'path';
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

function uploadMultipart(options, filePath, fileName, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const fileContent = fs.readFileSync(filePath);

    let body = `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="attachment"; filename="${fileName}"\r\n`;
    body += `Content-Type: text/plain\r\n\r\n`;

    const bodyHead = Buffer.from(body, 'utf-8');
    const bodyTail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const fullBody = Buffer.concat([bodyHead, fileContent, bodyTail]);

    const req = http.request({
      ...options,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
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
    req.write(fullBody);
    req.end();
  });
}

async function testTaskDeleteStoragePurge() {
  console.log('--- Testing Physical Attachment Storage Purge on Task Delete ---');

  // 1. Admin Login
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@company.com', password: 'password123', role: 'Admin' });

  const adminToken = adminLogin.body.token;

  // 2. Create a test task
  const todayStr = new Date().toISOString().split('T')[0];
  const createTaskRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Purge Storage API Test Task',
    description: 'Testing that files on disk are unlinked upon task deletion',
    assigned_to: 1,
    project_id: 1,
    department_id: 1,
    start_date: todayStr,
    due_date: todayStr,
    priority: 'Low'
  });

  const taskId = createTaskRes.body.task?.id;
  console.log('1. Created Task ID:', taskId);

  // 3. Create a temp file to upload
  const uploadDir = path.join(process.cwd(), 'uploads');
  const tempTestFile = path.join(process.cwd(), 'temp_test_file.txt');
  fs.writeFileSync(tempTestFile, 'This is a test file for attachment deletion.');

  const uploadRes = await uploadMultipart({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}/attachments`,
    method: 'POST'
  }, tempTestFile, 'sample_attachment.txt', adminToken);

  fs.unlinkSync(tempTestFile);

  const uploadedAtt = uploadRes.body.attachments?.[0];
  console.log('2. Uploaded Attachment to Server:', uploadedAtt.file_name, 'Stored as:', uploadedAtt.file_path);

  const serverStoragePath = path.join(uploadDir, uploadedAtt.file_path);
  console.log('3. Stored physical file exists before delete:', fs.existsSync(serverStoragePath));

  // 4. Delete the task
  const deleteRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/tasks/${taskId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('4. Task deleted via API. Status:', deleteRes.status);

  // 5. Verify physical file is purged from disk!
  const fileExistsAfterDelete = fs.existsSync(serverStoragePath);
  console.log('5. File exists on disk after task delete:', fileExistsAfterDelete, `(Expected: false)`);

  if (!fileExistsAfterDelete) {
    console.log('\n✅ TASK ATTACHMENTS STORAGE PURGE VERIFIED 100%!');
  } else {
    try { fs.unlinkSync(serverStoragePath); } catch (e) {}
    throw new Error('Physical file was NOT removed from storage on task deletion!');
  }
}

testTaskDeleteStoragePurge().catch(console.error);
