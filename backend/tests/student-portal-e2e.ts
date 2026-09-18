import http from 'http';
import app from '../src/app';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m - ${testName}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m - ${testName}${details ? ` (${details})` : ''}`);
    failed++;
  }
}

function request(
  server: http.Server,
  method: string,
  path: string,
  token?: string,
  body?: any
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any).port;
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode || 500, body: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runStudentTests() {
  console.log('\n======================================================');
  console.log('🎓 RUNNING ATTENDOSCHOOL STUDENT PORTAL & RBAC TESTS');
  console.log('======================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    // ---------------------------------------------------------
    // 1. INSTITUTES ENDPOINT & SELECTOR TESTS
    // ---------------------------------------------------------
    console.log('🏫 1. Multi-Tenant Institute Discovery:');
    const institutesRes = await request(server, 'GET', '/api/auth/institutes');
    assert(institutesRes.status === 200, 'GET /api/auth/institutes returns 200 OK');
    assert(Array.isArray(institutesRes.body) && institutesRes.body.length > 0, 'Returns list of active institutes');
    const greenwood = institutesRes.body.find((i: any) => i.name.includes('Greenwood') || i.id === '00000000-0000-0000-0000-000000000001');
    assert(!!greenwood, 'Greenwood International School is available for selection');

    const validSchoolId = greenwood ? greenwood.id : '00000000-0000-0000-0000-000000000001';

    // ---------------------------------------------------------
    // 2. STUDENT AUTHENTICATION & MULTI-TENANT VERIFICATION
    // ---------------------------------------------------------
    console.log('\n🔐 2. Student Authentication & Security:');

    // Bad password
    const badPassRes = await request(server, 'POST', '/api/auth/login', undefined, {
      instituteId: validSchoolId,
      email: 'student@greenwood.local',
      password: 'WrongPassword999'
    });
    assert(badPassRes.status === 401, 'Rejects invalid password with 401');

    // Inactive / non-existent institute
    const badInstRes = await request(server, 'POST', '/api/auth/login', undefined, {
      instituteId: '99999999-9999-9999-9999-999999999999',
      email: 'student@greenwood.local',
      password: 'ChangeMe123!'
    });
    assert(badInstRes.status === 401, 'Rejects non-existent or mismatching institute with 401');

    // Valid login using email
    const loginRes = await request(server, 'POST', '/api/auth/login', undefined, {
      instituteId: validSchoolId,
      email: 'student@greenwood.local',
      password: 'ChangeMe123!'
    });
    assert(loginRes.status === 200, 'Student logs in successfully with valid credentials');
    assert(!!loginRes.body.token, 'Issues valid JWT Bearer token');
    assert(loginRes.body.user?.role === 'STUDENT', 'User payload role is STUDENT');
    assert(loginRes.body.user?.name === 'Rohan Sharma', 'Student name is Rohan Sharma');
    assert(loginRes.body.user?.rollNumber === '25', 'Student roll number is 25');

    const studentToken = loginRes.body.token;

    // Login using student ID / roll number
    const loginByIdRes = await request(server, 'POST', '/api/auth/login', undefined, {
      instituteId: validSchoolId,
      studentId: '25',
      password: 'ChangeMe123!'
    });
    assert(loginByIdRes.status === 200, 'Student logs in successfully with Roll Number/Student ID');

    // Teacher login for role boundary testing
    const teacherLogin = await request(server, 'POST', '/api/auth/login', undefined, {
      email: 'rahul@demo-school.local',
      password: 'ChangeMe123!'
    });
    const teacherToken = teacherLogin.body.token;

    // ---------------------------------------------------------
    // 3. RBAC & PRIVILEGE ESCALATION GUARDS
    // ---------------------------------------------------------
    console.log('\n🛡️ 3. RBAC & Privilege Boundary Enforcement:');

    // Unauthenticated student dashboard access
    const unauthRes = await request(server, 'GET', '/api/student/dashboard');
    assert(unauthRes.status === 401, 'Rejects unauthenticated /api/student/dashboard with 401');

    // Teacher attempting to access student dashboard
    const teacherCrossRes = await request(server, 'GET', '/api/student/dashboard', teacherToken);
    assert(teacherCrossRes.status === 403, 'Teacher token denied access to /api/student/dashboard (403)');

    // Student attempting to access teacher routine
    const studentTeacherRes = await request(server, 'GET', '/api/teacher/routine/today', studentToken);
    assert(studentTeacherRes.status === 403, 'Student denied access to /api/teacher/routine/today (403)');

    // Student attempting to access super admin overview
    const studentSuperRes = await request(server, 'GET', '/api/super-admin/overview', studentToken);
    assert(studentSuperRes.status === 403, 'Student denied access to /api/super-admin/overview (403)');

    // Student attempting to access school admin classes
    const studentAdminRes = await request(server, 'GET', '/api/classes', studentToken);
    assert(studentAdminRes.status === 403, 'Student denied access to /api/classes (403)');

    // ---------------------------------------------------------
    // 4. STUDENT PORTAL DATA ENDPOINTS
    // ---------------------------------------------------------
    console.log('\n📊 4. Student Portal Endpoints & Real Data:');

    // Profile
    const profileRes = await request(server, 'GET', '/api/student/me', studentToken);
    assert(profileRes.status === 200, 'GET /api/student/me returns 200 OK');
    assert(profileRes.body.name === 'Rohan Sharma', 'Profile contains student name');
    assert(profileRes.body.rollNumber === '25', 'Profile contains student roll number');
    assert(profileRes.body.className?.includes('10'), 'Profile contains student class');

    // Dashboard
    const dashRes = await request(server, 'GET', '/api/student/dashboard', studentToken);
    assert(dashRes.status === 200, 'GET /api/student/dashboard returns 200 OK');
    assert(dashRes.body.kpis?.attendancePercentage >= 0, 'Dashboard contains attendance percentage KPI');
    assert(Array.isArray(dashRes.body.todayTimetable), 'Dashboard contains today timetable array');
    assert(Array.isArray(dashRes.body.recentAttendance), 'Dashboard contains recent attendance array');
    assert(Array.isArray(dashRes.body.announcements), 'Dashboard contains announcements array');
    assert(Array.isArray(dashRes.body.pendingAssignments), 'Dashboard contains pending assignments array');

    // Attendance (read-only)
    const attRes = await request(server, 'GET', '/api/student/attendance', studentToken);
    assert(attRes.status === 200, 'GET /api/student/attendance returns 200 OK');
    assert(Array.isArray(attRes.body.records), 'Returns array of historical attendance records');
    assert(attRes.body.summary?.percentage >= 0, 'Returns attendance summary metrics');

    // Timetable
    const ttRes = await request(server, 'GET', '/api/student/timetable', studentToken);
    assert(ttRes.status === 200, 'GET /api/student/timetable returns 200 OK');
    assert(Array.isArray(ttRes.body) && ttRes.body.length > 0, 'Returns weekly timetable periods');

    // Announcements
    const annRes = await request(server, 'GET', '/api/student/announcements', studentToken);
    assert(annRes.status === 200, 'GET /api/student/announcements returns 200 OK');
    assert(Array.isArray(annRes.body) && annRes.body.length > 0, 'Returns published announcements');

    // Assignments
    const asgRes = await request(server, 'GET', '/api/student/assignments', studentToken);
    assert(asgRes.status === 200, 'GET /api/student/assignments returns 200 OK');
    assert(Array.isArray(asgRes.body), 'Returns student assignments array');

    // Submit Assignment
    const subRes = await request(server, 'POST', '/api/student/assignments/asg-1/submit', studentToken, {
      submissionText: 'Completed quadratic equations solutions with step-by-step proofs.'
    });
    assert(subRes.status === 200 && subRes.body.success, 'POST /api/student/assignments/:id/submit succeeds');

    // Exams
    const examRes = await request(server, 'GET', '/api/student/exams', studentToken);
    assert(examRes.status === 200, 'GET /api/student/exams returns 200 OK');
    assert(Array.isArray(examRes.body), 'Returns student exams and result cards');

    // Leave Requests
    const createLeave = await request(server, 'POST', '/api/student/leave-requests', studentToken, {
      startDate: '2025-10-01',
      endDate: '2025-10-02',
      reason: 'Attending National Science Olympiad competition'
    });
    assert(createLeave.status === 201 && createLeave.body.success, 'POST /api/student/leave-requests creates leave request');

    const getLeave = await request(server, 'GET', '/api/student/leave-requests', studentToken);
    assert(getLeave.status === 200 && Array.isArray(getLeave.body), 'GET /api/student/leave-requests returns submitted requests');

    // Change Password
    const pwRes = await request(server, 'PUT', '/api/student/change-password', studentToken, {
      currentPassword: 'ChangeMe123!',
      newPassword: 'StudentNewPass2025!'
    });
    assert(pwRes.status === 200 && pwRes.body.success, 'PUT /api/student/change-password updates student password');

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n======================================================');
  console.log(`📊 STUDENT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStudentTests();
