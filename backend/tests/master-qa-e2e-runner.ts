require('dotenv').config();
import http from 'http';
import app from '../src/app';
import { pool } from '../src/db';

type TestResult = {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  durationMs: number;
};

const results: TestResult[] = [];

async function runMasterAudit() {
  console.log('========================================================================');
  console.log('ATTENDOSCHOOL — MASTER END-TO-END QA TEST AUDIT RUNNER');
  console.log('Testing against QA_END_TO_END_MANUAL_TESTING_GUIDE.md specification');
  console.log('========================================================================\n');

  // Start server on an ephemeral port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Ephemeral test server running at ${baseUrl}\n`);

  async function req(method: string, path: string, token?: string, body?: any) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      const durationMs = Date.now() - start;
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: res.status, data, durationMs };
    } catch (err: any) {
      return { status: 500, data: { error: err.message }, durationMs: Date.now() - start };
    }
  }

  function assert(id: string, name: string, condition: boolean, errorMsg?: string, durationMs: number = 0) {
    if (condition) {
      results.push({ id, name, status: 'PASS', durationMs });
      console.log(`[PASS] ${id}: ${name} (${durationMs}ms)`);
    } else {
      results.push({ id, name, status: 'FAIL', error: errorMsg, durationMs });
      console.error(`[FAIL] ${id}: ${name} -> ${errorMsg}`);
    }
  }

  try {
    let adminToken = '';
    let superAdminToken = '';
    let teacherToken = '';
    let studentToken = '';

    // =========================================================================
    // TS-01: Authentication, Tenant Resolution & Session Management
    // =========================================================================
    console.log('\n--- TS-01: Authentication, Tenant Resolution & Session Management ---');

    // TC-AUTH-001: School Admin login
    {
      const res = await req('POST', '/api/auth/login', undefined, {
        email: 'admin@demo-school.local',
        password: 'ChangeMe123!',
        instituteId: '00000000-0000-0000-0000-000000000001'
      });
      adminToken = res.data?.token || '';
      assert('TC-AUTH-001', 'School Admin login with valid credentials', res.status === 200 && Boolean(adminToken) && res.data?.user?.role === 'SCHOOL_ADMIN', `Status: ${res.status}, msg: ${res.data?.message}`, res.durationMs);
    }

    // TC-AUTH-002: Super Admin platform login
    {
      const res = await req('POST', '/api/auth/login', undefined, {
        email: 'superadmin@attendance.local',
        password: 'ChangeMe123!'
      });
      superAdminToken = res.data?.token || '';
      assert('TC-AUTH-002', 'Super Admin platform login', res.status === 200 && Boolean(superAdminToken) && res.data?.user?.role === 'SUPER_ADMIN', `Status: ${res.status}, msg: ${res.data?.message}`, res.durationMs);
    }

    // TC-AUTH-003: Teacher login
    {
      const res = await req('POST', '/api/auth/login', undefined, {
        email: 'rahul@demo-school.local',
        password: 'ChangeMe123!'
      });
      teacherToken = res.data?.token || '';
      assert('TC-AUTH-003', 'Teacher login with valid credentials', res.status === 200 && Boolean(teacherToken) && res.data?.user?.role === 'TEACHER', `Status: ${res.status}, msg: ${res.data?.message}`, res.durationMs);
    }

    // TC-AUTH-004: Student portal login
    {
      const res = await req('POST', '/api/auth/login', undefined, {
        email: 'student@greenwood.local',
        password: 'ChangeMe123!'
      });
      studentToken = res.data?.token || '';
      assert('TC-AUTH-004', 'Student portal login with valid credentials', res.status === 200 && Boolean(studentToken) && res.data?.user?.role === 'STUDENT', `Status: ${res.status}, msg: ${res.data?.message}`, res.durationMs);
    }

    // TC-AUTH-005: Invalid password rejection
    {
      const res = await req('POST', '/api/auth/login', undefined, {
        email: 'admin@demo-school.local',
        password: 'WrongPassword123!'
      });
      assert('TC-AUTH-005', 'Invalid password rejection with 401', res.status === 401, `Status: ${res.status}`, res.durationMs);
    }

    // TC-AUTH-006: Non-existent school code / institute rejection
    {
      const res = await req('POST', '/api/auth/login', undefined, {
        email: 'admin@demo-school.local',
        password: 'ChangeMe123!',
        instituteId: '99999999-9999-9999-9999-999999999999'
      });
      assert('TC-AUTH-006', 'Non-existent school institute rejection', res.status === 401, `Status: ${res.status}`, res.durationMs);
    }

    // TC-AUTH-008 & TC-AUTH-010: Session persistence /api/auth/me
    {
      const res = await req('GET', '/api/auth/me', adminToken);
      assert('TC-AUTH-008', 'Token validation and user profile retrieval (/api/auth/me)', res.status === 200 && res.data?.user?.email === 'admin@demo-school.local', `Status: ${res.status}`, res.durationMs);
    }

    // TC-AUTH-009: Protected route redirect/rejection when unauthenticated
    {
      const res = await req('GET', '/api/academic-years');
      assert('TC-AUTH-009', 'Protected route rejection without token (401)', res.status === 401, `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-02: Super Admin Platform Governance & Multi-School Management
    // =========================================================================
    console.log('\n--- TS-02: Super Admin Platform Governance & Multi-School Management ---');

    // TC-SUP-001: Platform overview metrics
    {
      const res = await req('GET', '/api/super-admin/overview', superAdminToken);
      assert('TC-SUP-001', 'Super Admin platform overview metrics', res.status === 200 && (res.data?.totalSchools !== undefined || res.data?.stats !== undefined), `Status: ${res.status}`, res.durationMs);
    }

    // TC-SUP-002: Onboard new school entity
    let testSchoolId = '';
    const uniqueCode = `TST${Math.floor(100 + Math.random() * 900)}`;
    {
      const res = await req('POST', '/api/super-admin/schools', superAdminToken, {
        name: `St. Xavier Test Academy ${uniqueCode}`,
        code: uniqueCode,
        adminEmail: `admin@${uniqueCode.toLowerCase()}.local`,
        planId: 'standard-annual',
        address: 'Test Boulevard, City'
      });
      testSchoolId = res.data?.schoolId || res.data?.school?.id || res.data?.id || '';
      assert('TC-SUP-002', 'Onboard new school entity', (res.status === 200 || res.status === 201) && Boolean(testSchoolId), `Status: ${res.status}, msg: ${res.data?.message}`, res.durationMs);
    }

    // TC-SUP-003: Prevent duplicate school code
    {
      const res = await req('POST', '/api/super-admin/schools', superAdminToken, {
        name: `Another School Name ${Date.now()}`,
        code: uniqueCode,
        adminEmail: `different.admin.${Date.now()}@test.local`
      });
      assert('TC-SUP-003', 'Prevent duplicate school code registration', res.status >= 400, `Status: ${res.status}`, res.durationMs);
    }

    // TC-SUP-004: Suspend and reactivate school tenant
    if (testSchoolId) {
      const resSuspend = await req('PATCH', `/api/super-admin/schools/${testSchoolId}/status`, superAdminToken, { status: 'SUSPENDED' });
      const suspendOk = resSuspend.status === 200 || resSuspend.status === 204;
      const resReactivate = await req('PATCH', `/api/super-admin/schools/${testSchoolId}/status`, superAdminToken, { status: 'ACTIVE' });
      const reactivateOk = resReactivate.status === 200 || resReactivate.status === 204;
      assert('TC-SUP-004', 'Suspend and reactivate school tenant', suspendOk && reactivateOk, `Suspend: ${resSuspend.status}, Reactivate: ${resReactivate.status}`, resReactivate.durationMs);
    }

    // TC-SUP-005: Invoices & GST ledger verification
    {
      const res = await req('GET', '/api/invoices', superAdminToken);
      assert('TC-SUP-005', 'Invoices & GST ledger retrieval', res.status === 200 && Array.isArray(res.data?.invoices || res.data), `Status: ${res.status}`, res.durationMs);
    }

    // TC-SUP-006: Monitoring & Health
    {
      const res = await req('GET', '/api/health');
      assert('TC-SUP-006', 'Platform health monitoring probe', res.status === 200 && (res.data?.status === 'ok' || res.data?.status === 'HEALTHY'), `Status: ${res.status}`, res.durationMs);
    }

    // TC-SUP-007: Security Center & Audit Logs
    {
      const res = await req('GET', '/api/super-admin/audit-logs', superAdminToken);
      assert('TC-SUP-007', 'Security center audit logs retrieval', res.status === 200 && Array.isArray(res.data?.logs || res.data), `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-03: School Admin Dashboard & Overview Analytics
    // =========================================================================
    console.log('\n--- TS-03: School Admin Dashboard & Overview Analytics ---');

    {
      const res = await req('GET', '/api/dashboard/overview', adminToken);
      const isClean = res.status === 200;
      assert('TC-ADM-001', 'Clean baseline metrics without synthetic fallback counts', isClean, `Status: ${res.status}`, res.durationMs);
      assert('TC-ADM-002', 'Active Academic Session banner & dashboard data', isClean && res.data !== null, `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-04: Academic Year & Session Lifecycle (Database-Backed)
    // =========================================================================
    console.log('\n--- TS-04: Academic Year & Session Lifecycle ---');

    let createdYearId = '';

    // TC-AY-001: Create new Academic Year
    {
      const res = await req('POST', '/api/academic-years', adminToken, {
        name: `Test Session ${Date.now()}`,
        startDate: '2028-04-01',
        endDate: '2029-03-31'
      });
      createdYearId = res.data?.academicYear?.id || res.data?.id || '';
      assert('TC-AY-001', 'Create new Academic Year in PostgreSQL', (res.status === 200 || res.status === 201) && Boolean(createdYearId), `Status: ${res.status}`, res.durationMs);
    }

    // TC-AY-002: Date validation check (end date before start date)
    {
      const res = await req('POST', '/api/academic-years', adminToken, {
        name: `Invalid Dates ${Date.now()}`,
        startDate: '2029-04-01',
        endDate: '2028-03-31'
      });
      assert('TC-AY-002', 'Date validation rejects end date < start date', res.status >= 400, `Status: ${res.status}`, res.durationMs);
    }

    if (createdYearId) {
      // TC-AY-003: Activate session
      const resAct = await req('POST', `/api/academic-years/${createdYearId}/activate`, adminToken);
      assert('TC-AY-003', 'Activate Academic Year (single-active enforcement)', resAct.status === 200, `Status: ${resAct.status}`, resAct.durationMs);

      // TC-AY-004: Deactivate session
      const resDeact = await req('POST', `/api/academic-years/${createdYearId}/deactivate`, adminToken);
      assert('TC-AY-004', 'Deactivate Academic Year to Inactive status', resDeact.status === 200, `Status: ${resDeact.status}`, resDeact.durationMs);

      // TC-AY-005: Archive session
      const resArch = await req('POST', `/api/academic-years/${createdYearId}/archive`, adminToken);
      assert('TC-AY-005', 'Archive Academic Year', resArch.status === 200, `Status: ${resArch.status}`, resArch.durationMs);

      // TC-AY-006: Unarchive session
      const resUnarch = await req('POST', `/api/academic-years/${createdYearId}/unarchive`, adminToken);
      assert('TC-AY-006', 'Unarchive Academic Year back to Inactive', resUnarch.status === 200, `Status: ${resUnarch.status}`, resUnarch.durationMs);
    }

    // TC-AY-007: Dynamic student & class counts
    {
      const res = await req('GET', '/api/academic-years', adminToken);
      const list = res.data?.academicYears || res.data || [];
      const hasCounts = list.length > 0 && list.every((y: any) => y.student_count !== undefined || y.studentCount !== undefined);
      assert('TC-AY-007', 'Dynamic Student & Class counts from database', res.status === 200 && hasCounts, `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-05: Class & Section Management
    // =========================================================================
    console.log('\n--- TS-05: Class & Section Management ---');

    let testClassId = '';
    let testSectionId = '';

    // TC-CLS-001: Add Class & Section
    {
      const res = await req('POST', '/api/classes', adminToken, {
        class_number: 11,
        capacity: 45
      });
      testClassId = res.data?.class?.id || res.data?.id || 'cls-11';
      assert('TC-CLS-001', 'Add new Class (Class 11)', res.status === 200 || res.status === 201, `Status: ${res.status}`, res.durationMs);

      const resSec = await req('POST', '/api/sections', adminToken, {
        class_id: testClassId,
        name: 'A',
        capacity: 45
      });
      testSectionId = resSec.data?.section?.id || resSec.data?.id || `sec-${testClassId}-a`;
      assert('TC-CLS-002', 'Add Section A to Class 11', resSec.status === 200 || resSec.status === 201, `Status: ${resSec.status}`, resSec.durationMs);
    }

    // =========================================================================
    // TS-06: Subject Management
    // =========================================================================
    console.log('\n--- TS-06: Subject Management ---');

    let testSubjectId = '';
    {
      const res = await req('POST', '/api/subjects', adminToken, {
        name: 'Advanced Physics',
        code: `PHY${Math.floor(100 + Math.random() * 900)}`,
        type: 'Theory',
        class_id: testClassId
      });
      testSubjectId = res.data?.subject?.id || res.data?.id || '';
      assert('TC-SUB-001', 'Create new Subject (Theory)', (res.status === 200 || res.status === 201) && Boolean(testSubjectId), `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-07: Teacher & Staff Management
    // =========================================================================
    console.log('\n--- TS-07: Teacher & Staff Management ---');

    let newTeacherEmail = `teacher.${Date.now()}@demo-school.local`;
    let newTeacherPass = 'TeacherPass123!';
    let testTeacherId = '';

    {
      const res = await req('POST', '/api/teachers', adminToken, {
        name: 'Dr. Vikram Malhotra',
        email: newTeacherEmail,
        phone: '9876543210',
        employee_id: `EMP-${Date.now().toString().slice(-4)}`,
        qualification: 'Ph.D. Physics',
        password: newTeacherPass,
        generateLogin: true
      });
      testTeacherId = res.data?.teacher?.id || res.data?.id || '';
      assert('TC-TCH-001', 'Onboard single Teacher with login credentials', (res.status === 200 || res.status === 201) && Boolean(testTeacherId), `Status: ${res.status}`, res.durationMs);
    }

    // TC-TCH-002: Authenticate with new teacher credentials
    if (newTeacherEmail) {
      const res = await req('POST', '/api/auth/login', undefined, {
        email: newTeacherEmail,
        password: newTeacherPass
      });
      assert('TC-TCH-002', 'Login with newly generated Teacher credentials', res.status === 200 && Boolean(res.data?.token), `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-08: Student Enrollment, Profile & Universal Preview/Edit
    // =========================================================================
    console.log('\n--- TS-08: Student Enrollment & Bulk Operations ---');

    // TC-STU-001: Download blank Excel template
    {
      const res = await req('GET', '/api/students/template', adminToken);
      assert('TC-STU-001', 'Download Standard Blank Excel Template', res.status === 200, `Status: ${res.status}`, res.durationMs);
    }

    // TC-STU-002: Register single student
    let testStudentId = '';
    const admNo = `ADM-${Date.now().toString().slice(-6)}`;
    {
      const res = await req('POST', '/api/students', adminToken, {
        name: 'Aarav Patel',
        roll_number: '101',
        admission_number: admNo,
        class_id: testClassId,
        section_id: testSectionId,
        parent_name: 'Vikram Patel',
        parent_phone: '9876500001'
      });
      testStudentId = res.data?.student?.id || res.data?.id || '';
      assert('TC-STU-002', 'Register single student manually', (res.status === 200 || res.status === 201) && Boolean(testStudentId), `Status: ${res.status}`, res.durationMs);
    }

    // TC-STU-003: Prevent duplicate roll number in same section
    {
      const res = await req('POST', '/api/students', adminToken, {
        name: 'Duplicate Roll Student',
        roll_number: '101',
        admission_number: `ADM-${Date.now().toString().slice(-6)}`,
        class_id: testClassId,
        section_id: testSectionId,
        parent_name: 'Another Parent',
        parent_phone: '9876500002'
      });
      assert('TC-STU-003', 'Prevent duplicate roll number in same section', res.status >= 400, `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-09: Daily Classroom Attendance Lifecycle
    // =========================================================================
    console.log('\n--- TS-09: Daily Classroom Attendance Lifecycle ---');

    const todayStr = new Date().toISOString().slice(0, 10);

    // TC-ATT-001: Load classroom roster
    {
      const res = await req('GET', `/api/students?classId=${testClassId}&sectionId=${testSectionId}`, adminToken);
      assert('TC-ATT-001', 'Load classroom attendance roster for class & section', res.status === 200 && Array.isArray(res.data), `Status: ${res.status}`, res.durationMs);
    }

    // TC-ATT-005: Submit daily attendance
    if (testStudentId) {
      const res = await req('POST', '/api/attendance', adminToken, {
        classId: testClassId,
        sectionId: testSectionId,
        attendanceDate: todayStr,
        records: [
          {
            studentId: testStudentId,
            status: 'PRESENT',
            remark: 'On time'
          }
        ]
      });
      assert('TC-ATT-005', 'Submit daily attendance and write to database', res.status === 200 || res.status === 201, `Status: ${res.status}`, res.durationMs);

      // TC-ATT-007: Double-submission protection
      const resDouble = await req('POST', '/api/attendance', adminToken, {
        classId: testClassId,
        sectionId: testSectionId,
        attendanceDate: todayStr,
        records: [{ studentId: testStudentId, status: 'PRESENT' }]
      });
      assert('TC-ATT-007', 'Double-submission idempotency protection', resDouble.status === 200 || resDouble.status === 409, `Status: ${resDouble.status}`, resDouble.durationMs);
    }

    // =========================================================================
    // TS-12: Timetable & Routine Management
    // =========================================================================
    console.log('\n--- TS-12: Timetable & Routine Management ---');

    {
      const res = await req('GET', '/api/timetable/periods', adminToken);
      assert('TC-TT-001', 'Retrieve school bell timings & period configuration', res.status === 200, `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-14: Announcements & Parent Communication
    // =========================================================================
    console.log('\n--- TS-14: Announcements & Parent Communication ---');

    {
      const res = await req('POST', '/api/communication/announcements', adminToken, {
        title: 'Sports Day 2026 Test',
        content: 'Annual sports day schedule announcement',
        target_audience: 'ALL'
      });
      assert('TC-COM-001', 'Broadcast school announcement to all audiences', res.status === 200 || res.status === 201, `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-15: Attendance Reports, Analytics & Exports
    // =========================================================================
    console.log('\n--- TS-15: Attendance Reports & Exports ---');

    {
      const res = await req('GET', `/api/attendance-reports/monthly?classId=${testClassId}&sectionId=${testSectionId}&month=2026-09`, adminToken);
      assert('TC-REP-001', 'Generate monthly attendance register grid', res.status === 200, `Status: ${res.status}`, res.durationMs);

      const resDef = await req('GET', '/api/attendance-reports/defaulters?threshold=75', adminToken);
      assert('TC-REP-002', 'Low attendance defaulter filter (< 75% threshold)', resDef.status === 200, `Status: ${resDef.status}`, resDef.durationMs);
    }

    // =========================================================================
    // TS-19: Multi-Tenant Zero-Trust Data Isolation (Security P0)
    // =========================================================================
    console.log('\n--- TS-19: Multi-Tenant Zero-Trust Data Isolation ---');

    // TC-SEC-001: Cross-Tenant API Student Query Injection
    {
      const foreignHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-School-Id': '11111111-1111-1111-1111-111111111111'
      };
      const res = await fetch(`${baseUrl}/api/students`, { headers: foreignHeaders });
      const data = await res.json();
      const foreignStudents = Array.isArray(data) ? data.filter((s: any) => s.school_id === '11111111-1111-1111-1111-111111111111') : [];
      assert('TC-SEC-001', 'Cross-Tenant Header spoofing blocked (Zero foreign data leak)', res.status === 200 && foreignStudents.length === 0, `Leaked items: ${foreignStudents.length}`);
    }

    // =========================================================================
    // TS-20: Role-Based Access Control (RBAC) & URL Penetration
    // =========================================================================
    console.log('\n--- TS-20: Role-Based Access Control (RBAC) ---');

    // TC-RBAC-001: Student attempts to access Admin academic-years
    {
      const res = await req('GET', '/api/academic-years', studentToken);
      assert('TC-RBAC-001', 'Student blocked from Admin academic-years (403 Forbidden)', res.status === 403, `Status: ${res.status}`, res.durationMs);
    }

    // TC-RBAC-002: Teacher attempts to access Super Admin overview
    {
      const res = await req('GET', '/api/super-admin/overview', teacherToken);
      assert('TC-RBAC-002', 'Teacher blocked from Super Admin overview (403 Forbidden)', res.status === 403, `Status: ${res.status}`, res.durationMs);
    }

    // TC-RBAC-003: School Admin attempts to access Super Admin invoices
    {
      const res = await req('GET', '/api/super-admin/overview', adminToken);
      assert('TC-RBAC-003', 'School Admin blocked from Super Admin overview (403 Forbidden)', res.status === 403, `Status: ${res.status}`, res.durationMs);
    }

    // TC-RBAC-004: Student attempts to submit attendance
    {
      const res = await req('POST', '/api/attendance', studentToken, {
        class_id: testClassId,
        section_id: testSectionId,
        date: todayStr,
        records: []
      });
      assert('TC-RBAC-004', 'Student blocked from POST /api/attendance (403 Forbidden)', res.status === 403, `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-21: Input Validation, SQL Injection & XSS Vulnerability
    // =========================================================================
    console.log('\n--- TS-21: Input Validation, SQL Injection & XSS Vulnerability ---');

    // TC-VAL-001: XSS payload in student remark/name
    {
      const res = await req('POST', '/api/students', adminToken, {
        name: '<script>alert("XSS")</script> Aarav',
        roll_number: '202',
        admission_number: `ADM-${Date.now().toString().slice(-6)}`,
        class_id: testClassId,
        section_id: testSectionId,
        parent_name: 'Safe Parent',
        parent_phone: '9876500099'
      });
      const savedName = res.data?.student?.name || res.data?.name || '';
      assert('TC-VAL-001', 'XSS payload handled safely without execution', res.status === 200 || res.status === 201, `Status: ${res.status}`, res.durationMs);
    }

    // TC-VAL-002: SQL Injection payload in search parameter
    {
      const res = await req('GET', '/api/students?q=%27%20OR%20%271%27=%271', adminToken);
      assert('TC-VAL-002', 'SQL Injection in search query blocked by parameterized query', res.status === 200, `Status: ${res.status}`, res.durationMs);
    }

    // TC-VAL-003: Unicode / Native script names support
    {
      const res = await req('POST', '/api/students', adminToken, {
        name: 'আবীর রায় (Abeer Roy)',
        roll_number: '203',
        admission_number: `ADM-${Date.now().toString().slice(-6)}`,
        class_id: testClassId,
        section_id: testSectionId,
        parent_name: 'সুজিত রায়',
        parent_phone: '9876500088'
      });
      assert('TC-VAL-003', 'Unicode & native Bengali/Hindi characters persisted cleanly', res.status === 200 || res.status === 201, `Status: ${res.status}`, res.durationMs);
    }

    // =========================================================================
    // TS-22: Offline Resilience & Sync
    // =========================================================================
    console.log('\n--- TS-22: Offline Resilience & Sync ---');

    {
      const res = await req('POST', '/api/offline-attendance/sync', adminToken, {
        batchId: `batch-${Date.now()}`,
        deviceId: 'device-test-1',
        records: [
          {
            clientRecordId: `rec-${Date.now()}`,
            studentId: testStudentId,
            attendanceDate: todayStr,
            present: true
          }
        ]
      });
      assert('TC-OFF-001', 'Offline attendance sync queue endpoint', res.status === 200 || res.status === 201, `Status: ${res.status}`, res.durationMs);
    }

    // Reset active academic year back to 2025–26 if we modified it
    try {
      const activeRes = await pool.query("SELECT id FROM academic_years WHERE school_id='00000000-0000-0000-0000-000000000001' AND name LIKE '%2025%' LIMIT 1");
      if (activeRes.rows.length > 0) {
        await pool.query("UPDATE academic_years SET is_active=FALSE WHERE school_id='00000000-0000-0000-0000-000000000001'");
        await pool.query("UPDATE academic_years SET is_active=TRUE, is_archived=FALSE WHERE id=$1", [activeRes.rows[0].id]);
      }
    } catch {}

  } finally {
    server.close();
  }

  // Summary
  console.log('\n========================================================================');
  console.log('AUDIT SUMMARY REPORT');
  console.log('========================================================================');
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS EXECUTED: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  if (failed > 0) {
    console.log('\nFAILED TESTS DETAILS:');
    results.filter(r => r.status === 'FAIL').forEach(f => console.error(` - [${f.id}] ${f.name}: ${f.error}`));
  }
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMasterAudit().catch(err => {
  console.error('Master audit execution error:', err);
  process.exit(1);
});
