/**
 * Strict Multi-Tenant Isolation Test Suite
 * Validates Phase 28, 29 & 55:
 * Ensures School A Admin cannot access or mutate School B data under any circumstances.
 */

const http = require('http');

const BASE_HOST = 'localhost';
const BASE_PORT = 5000;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: BASE_HOST,
      port: BASE_PORT,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(options.headers || {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function login(email, password) {
  const res = await request({ path: '/api/auth/login', method: 'POST' }, { email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email} with status ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTenantIsolationSuite() {
  console.log('\n🔒 Starting Strict Tenant Isolation Verification Suite...\n');

  console.log('1. Authenticating School A Admin and School B Admin...');
  const tokenA = await login('admin@demo-school.local', 'ChangeMe123!');
  const tokenB = await login('admin@delhi-academy.local', 'ChangeMe123!');
  assert(Boolean(tokenA && tokenB), 'Both school admins authenticated successfully.');

  console.log('\n2. Testing Dashboard Tenant Isolation:');
  const dashA = await request({ path: '/api/dashboard/school', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } });
  const dashB = await request({ path: '/api/dashboard/school', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } });
  assert(dashA.body?.school?.name === 'Greenwood International School', 'School A dashboard returns Greenwood International School.');
  assert(dashB.body?.school?.name === 'Delhi Public Academy', 'School B dashboard returns Delhi Public Academy.');
  assert(dashA.body?.school?.id !== dashB.body?.school?.id, 'School A and School B have different isolated tenant IDs.');

  console.log('\n3. Testing Student List Isolation:');
  const studentsA = await request({ path: '/api/students', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } });
  const studentsB = await request({ path: '/api/students', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } });
  
  const listA = Array.isArray(studentsA.body) ? studentsA.body : [];
  const listB = Array.isArray(studentsB.body) ? studentsB.body : [];

  const aHasBStudents = listA.some(s => s.name?.includes('School B') || s.email === 'student@delhi-academy.local' || s.roll_number === '901');
  const bHasAStudents = listB.some(s => s.name === 'Aarav Sharma' || s.roll_number === '101');

  assert(!aHasBStudents, 'School A Admin student list DOES NOT contain any School B students.');
  assert(!bHasAStudents, 'School B Admin student list DOES NOT contain any School A students.');
  assert(listA.length > 0 && listB.length > 0, `Both schools return their respective students (School A: ${listA.length}, School B: ${listB.length}).`);

  console.log('\n4. Testing IDOR Mutation Protection (Cross-tenant student update):');
  // School A Admin attempts to update School B student (00000000-0000-0000-0000-000000000699)
  const idorUpdate = await request({
    path: '/api/students/00000000-0000-0000-0000-000000000699',
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenA}` }
  }, {
    name: 'HACKED BY SCHOOL A',
    rollNumber: '999',
    classId: '00000000-0000-0000-0000-000000000311',
    sectionId: '00000000-0000-0000-0000-000000000411'
  });
  assert(idorUpdate.status === 404, `Cross-tenant student modification rejected with 404 (status: ${idorUpdate.status}).`);

  // Verify School B student was not modified
  const verifyB = await request({ path: '/api/students', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } });
  const studentB = (verifyB.body || []).find(s => s.roll_number === '901');
  assert(studentB && studentB.name !== 'HACKED BY SCHOOL A', 'School B student data remained completely untampered.');

  console.log('\n5. Testing Super Admin Route Protection:');
  const superRouteA = await request({ path: '/api/super-admin/overview', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } });
  assert(superRouteA.status === 403, `School Admin blocked from /api/super-admin/overview with 403 (status: ${superRouteA.status}).`);

  console.log('\n6. Testing Classes and Sections Tenant Isolation:');
  const classesA = await request({ path: '/api/classes', method: 'GET', headers: { Authorization: `Bearer ${tokenA}` } });
  const classesB = await request({ path: '/api/classes', method: 'GET', headers: { Authorization: `Bearer ${tokenB}` } });
  assert(Array.isArray(classesA.body) && classesA.body.length > 0, 'School A has classes.');
  assert(Array.isArray(classesB.body) && classesB.body.length > 0, 'School B has classes.');
  const crossClass = (classesA.body || []).find(c => c.id === '00000000-0000-0000-0000-000000000311');
  assert(!crossClass, 'School A cannot see School B specific classes.');

  console.log('\n========================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTenantIsolationSuite().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
