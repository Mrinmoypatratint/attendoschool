const http = require('http');

async function testLogin(label, body) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('[' + res.statusCode + '] ' + label + ':', data);
        resolve();
      });
    });
    req.on('error', (err) => {
      console.log('[ERR] ' + label + ':', err.message);
      resolve();
    });
    req.write(postData);
    req.end();
  });
}

async function run() {
  await testLogin('Super Admin (no instituteId)', { email: 'superadmin@attendance.local', password: 'ChangeMe123!' });
  await testLogin('Super Admin (with instituteId)', { instituteId: '00000000-0000-0000-0000-000000000001', email: 'superadmin@attendance.local', password: 'ChangeMe123!' });
  await testLogin('School Admin (no instituteId)', { email: 'admin@demo-school.local', password: 'ChangeMe123!' });
  await testLogin('School Admin (with instituteId 00000000-0000-0000-0000-000000000001)', { instituteId: '00000000-0000-0000-0000-000000000001', email: 'admin@demo-school.local', password: 'ChangeMe123!' });
  await testLogin('School Admin (with instituteId school-greenwood-001)', { instituteId: 'school-greenwood-001', email: 'admin@demo-school.local', password: 'ChangeMe123!' });
  await testLogin('Teacher 1 Rahul (with instituteId 00000000-0000-0000-0000-000000000001)', { instituteId: '00000000-0000-0000-0000-000000000001', email: 'rahul@demo-school.local', password: 'ChangeMe123!' });
  await testLogin('Teacher 1 Rahul (with instituteId school-greenwood-001)', { instituteId: 'school-greenwood-001', email: 'rahul@demo-school.local', password: 'ChangeMe123!' });
  await testLogin('Teacher 2 Priya (with instituteId 00000000-0000-0000-0000-000000000001)', { instituteId: '00000000-0000-0000-0000-000000000001', email: 'priya@demo-school.local', password: 'ChangeMe123!' });
  await testLogin('Student (with instituteId 00000000-0000-0000-0000-000000000001)', { instituteId: '00000000-0000-0000-0000-000000000001', email: 'student@greenwood.local', password: 'ChangeMe123!' });
  await testLogin('Student (with instituteId school-greenwood-001)', { instituteId: 'school-greenwood-001', email: 'student@greenwood.local', password: 'ChangeMe123!' });
}
run();
