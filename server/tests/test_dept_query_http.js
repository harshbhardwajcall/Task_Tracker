import http from 'http';

function makeRequest(options) {
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
    req.end();
  });
}

async function testHttpDeptCounts() {
  console.log('--- Checking HTTP API GET /api/departments ---');
  const res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'GET'
  });

  console.log('API Status:', res.status);
  console.table(res.body.departments.map(d => ({ id: d.id, name: d.name, total_users: d.total_users })));
}

testHttpDeptCounts().catch(console.error);
