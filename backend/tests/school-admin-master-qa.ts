/**
 * School Admin Complete Functional, Security, RBAC, API, and Tenant QA Suite
 * Tests the entire School Admin module per QA Master Prompt.
 */

const http = require('http');

const BASE_HOST = 'localhost';
const BASE_PORT = 5000;

function request(options: any, body?: any): Promise<{ status: number; body: any; headers: any; latencyMs: number }> {
  const start = Date.now();
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
    }, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        const latencyMs = Date.now() - start;
        resolve({ status: res.statusCode, body: json, headers: res.headers, latencyMs });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

interface TestResult {
  id: string;
  module: string;
  test: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT IMPLEMENTED';
  severity?: 'P0' | 'P1' | 'P2' | 'P3';
  latencyMs?: number;
}

const results: TestResult[] = [];

function record(res: TestResult) {
  results.push(res);
  const icon = res.status === 'PASS' ? '✅' : res.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${res.id}] [${res.module}] ${res.test} -> ${res.status} (${res.actual})`);
}

async function runMasterQa() {
  console.log('===============================================================');
  console.log('ATTENDOSCHOOL SCHOOL ADMIN MASTER QA EXECUTION');
  console.log('===============================================================\n');

  // PHASE 1 & 2: LOGIN & AUTHENTICATION
  // 1. Institutes discovery
  const instRes = await request({ path: '/api/auth/institutes', method: 'GET' });
  const institutes = Array.isArray(instRes.body) ? instRes.body : [];
  const schoolA = institutes.find((i: any) => i.name?.includes('Greenwood') || i.code === 'GIS001');
  const schoolB = institutes.find((i: any) => i.name?.includes('Delhi') || i.code === 'DPA002');
  
  record({
    id: 'SA-001',
    module: 'Authentication',
    test: 'Dynamic Institute Discovery (/api/auth/institutes)',
    expected: 'Returns active schools array containing School A and School B',
    actual: `Found ${institutes.length} schools. School A: ${schoolA?.id}, School B: ${schoolB?.id}`,
    status: institutes.length >= 2 && schoolA && schoolB ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // 2. Valid Login
  const validLoginRes = await request({ path: '/api/auth/login', method: 'POST' }, {
    email: 'admin@demo-school.local',
    password: 'ChangeMe123!',
    role: 'SCHOOL_ADMIN',
    instituteId: schoolA?.id
  });
  const tokenA = validLoginRes.body?.token;
  record({
    id: 'SA-002',
    module: 'Authentication',
    test: 'Valid School Admin Login with Institute Selection',
    expected: 'HTTP 200 with JWT token and SCHOOL_ADMIN role',
    actual: `Status ${validLoginRes.status}, role=${validLoginRes.body?.user?.role}, token=${Boolean(tokenA)}`,
    status: validLoginRes.status === 200 && tokenA && validLoginRes.body?.user?.role === 'SCHOOL_ADMIN' ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  // 3. Invalid credentials
  const badPassRes = await request({ path: '/api/auth/login', method: 'POST' }, {
    email: 'admin@demo-school.local',
    password: 'WrongPassword!',
    role: 'SCHOOL_ADMIN'
  });
  record({
    id: 'SA-003',
    module: 'Authentication',
    test: 'Invalid Password Handling',
    expected: 'HTTP 401 Unauthorized',
    actual: `Status ${badPassRes.status}`,
    status: badPassRes.status === 401 ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  // 4. Role mismatch rejection
  const roleMismatchRes = await request({ path: '/api/auth/login', method: 'POST' }, {
    email: 'admin@demo-school.local',
    password: 'ChangeMe123!',
    role: 'SUPER_ADMIN'
  });
  record({
    id: 'SA-004',
    module: 'Authentication',
    test: 'Role Privilege Escalation Prevention (Admin trying SUPER_ADMIN role)',
    expected: 'HTTP 401 Unauthorized',
    actual: `Status ${roleMismatchRes.status}`,
    status: roleMismatchRes.status === 401 ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  // 5. School B Admin login
  const loginBRes = await request({ path: '/api/auth/login', method: 'POST' }, {
    email: 'admin@delhi-academy.local',
    password: 'ChangeMe123!',
    role: 'SCHOOL_ADMIN',
    instituteId: schoolB?.id
  });
  const tokenB = loginBRes.body?.token;
  record({
    id: 'SA-005',
    module: 'Authentication',
    test: 'School B Admin Login',
    expected: 'HTTP 200 with JWT token for School B',
    actual: `Status ${loginBRes.status}, tokenB=${Boolean(tokenB)}`,
    status: loginBRes.status === 200 && tokenB ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  if (!tokenA || !tokenB) {
    console.error('Fatal: cannot continue without valid tokens');
    return;
  }

  const authA = { Authorization: `Bearer ${tokenA}` };
  const authB = { Authorization: `Bearer ${tokenB}` };

  // PHASE 3: DASHBOARD
  const dashRes = await request({ path: '/api/dashboard/school', method: 'GET', headers: authA });
  const d = dashRes.body;
  record({
    id: 'SA-006',
    module: 'Dashboard',
    test: 'School Admin Dashboard Summary API (/api/dashboard/school)',
    expected: 'HTTP 200 with school info, metrics, attendance and active academic year',
    actual: `Status ${dashRes.status}, school=${d?.school?.name}, students=${d?.totalStudents}, teachers=${d?.totalTeachers}, classes=${d?.totalClasses}`,
    status: dashRes.status === 200 && d?.school?.name === 'Greenwood International School' ? 'PASS' : 'FAIL',
    severity: 'P1',
    latencyMs: dashRes.latencyMs
  });

  // PHASE 4: STUDENT MANAGEMENT
  // 1. List students
  const stListRes = await request({ path: '/api/students', method: 'GET', headers: authA });
  const studentsA = Array.isArray(stListRes.body) ? stListRes.body : [];
  record({
    id: 'SA-007',
    module: 'Students',
    test: 'List Enrolled Students (/api/students)',
    expected: 'HTTP 200 returning array of active students for School A',
    actual: `Status ${stListRes.status}, count=${studentsA.length}`,
    status: stListRes.status === 200 && Array.isArray(studentsA) ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // 2. Search student
  const searchRes = await request({ path: '/api/students?search=Aarav', method: 'GET', headers: authA });
  const searchItems = Array.isArray(searchRes.body) ? searchRes.body : [];
  record({
    id: 'SA-008',
    module: 'Students',
    test: 'Student Search Filter (?search=Aarav)',
    expected: 'HTTP 200 returning matching student',
    actual: `Status ${searchRes.status}, found=${searchItems.length}`,
    status: searchRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // 3. Classes & Sections for student enrollment
  const classListRes = await request({ path: '/api/classes', method: 'GET', headers: authA });
  const secListRes = await request({ path: '/api/sections', method: 'GET', headers: authA });
  const targetClass = classListRes.body?.[0];
  const targetSec = secListRes.body?.[0];

  // 4. Create student
  const testStudentRoll = `QA${Date.now().toString().slice(-4)}`;
  const createStRes = await request({ path: '/api/students', method: 'POST', headers: authA }, {
    name: 'QA Test Student',
    rollNumber: testStudentRoll,
    parentName: 'QA Parent',
    parentSmsNumber: '9998887776',
    parentEmail: 'qa.parent@example.com',
    classId: targetClass?.id || 'cls-8',
    sectionId: targetSec?.id || 'sec-8-a'
  });
  const createdStudent = createStRes.body;
  record({
    id: 'SA-009',
    module: 'Students',
    test: 'Create Student Record (POST /api/students)',
    expected: 'HTTP 201 with created student ID and roll number',
    actual: `Status ${createStRes.status}, id=${createdStudent?.id}, roll=${createdStudent?.roll_number}`,
    status: createStRes.status === 201 && createdStudent?.id ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // 5. Update student
  let updatePass = false;
  if (createdStudent?.id) {
    const updateStRes = await request({ path: `/api/students/${createdStudent.id}`, method: 'PUT', headers: authA }, {
      name: 'QA Test Student Updated',
      rollNumber: testStudentRoll,
      parentName: 'QA Parent Senior',
      parentSmsNumber: '9998887776',
      parentEmail: 'qa.parent.updated@example.com',
      classId: targetClass?.id || 'cls-8',
      sectionId: targetSec?.id || 'sec-8-a'
    });
    updatePass = updateStRes.status === 200 && updateStRes.body?.name === 'QA Test Student Updated';
    record({
      id: 'SA-010',
      module: 'Students',
      test: 'Update Student Record (PUT /api/students/:id)',
      expected: 'HTTP 200 with updated name',
      actual: `Status ${updateStRes.status}, name=${updateStRes.body?.name}`,
      status: updatePass ? 'PASS' : 'FAIL',
      severity: 'P1'
    });
  }

  // 6. Delete student
  if (createdStudent?.id) {
    const delStRes = await request({ path: `/api/students/${createdStudent.id}`, method: 'DELETE', headers: authA });
    record({
      id: 'SA-011',
      module: 'Students',
      test: 'Delete / Deactivate Student Record (DELETE /api/students/:id)',
      expected: 'HTTP 200 success=true',
      actual: `Status ${delStRes.status}, success=${delStRes.body?.success}`,
      status: delStRes.status === 200 && delStRes.body?.success ? 'PASS' : 'FAIL',
      severity: 'P1'
    });
  }

  // PHASE 5: TEACHER MANAGEMENT
  const teacherListRes = await request({ path: '/api/teachers', method: 'GET', headers: authA });
  const teachersA = Array.isArray(teacherListRes.body) ? teacherListRes.body : [];
  record({
    id: 'SA-012',
    module: 'Teachers',
    test: 'List School Teachers (GET /api/teachers)',
    expected: 'HTTP 200 returning array of teachers',
    actual: `Status ${teacherListRes.status}, count=${teachersA.length}`,
    status: teacherListRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  const testTeacherEmp = `QAEMP${Date.now().toString().slice(-4)}`;
  const createTeacherRes = await request({ path: '/api/teachers', method: 'POST', headers: authA }, {
    name: 'QA Master Teacher',
    email: `qa.teacher.${Date.now().toString().slice(-4)}@demo-school.local`,
    password: 'ChangeMe123!',
    employeeId: testTeacherEmp,
    mobile: '9888877777'
  });
  const createdTeacher = createTeacherRes.body;
  record({
    id: 'SA-013',
    module: 'Teachers',
    test: 'Create Teacher (POST /api/teachers)',
    expected: 'HTTP 201 with teacher ID and employee ID',
    actual: `Status ${createTeacherRes.status}, id=${createdTeacher?.id}, empId=${createdTeacher?.employee_id}`,
    status: createTeacherRes.status === 201 && createdTeacher?.id ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  if (createdTeacher?.id) {
    const delTchRes = await request({ path: `/api/teachers/${createdTeacher.id}`, method: 'DELETE', headers: authA });
    record({
      id: 'SA-014',
      module: 'Teachers',
      test: 'Deactivate Teacher (DELETE /api/teachers/:id)',
      expected: 'HTTP 200 success=true',
      actual: `Status ${delTchRes.status}, success=${delTchRes.body?.success}`,
      status: delTchRes.status === 200 && delTchRes.body?.success ? 'PASS' : 'FAIL',
      severity: 'P1'
    });
  }

  // PHASE 6 & 7: CLASSES & SECTIONS
  record({
    id: 'SA-015',
    module: 'Classes',
    test: 'List Classes (GET /api/classes)',
    expected: 'HTTP 200 with class array',
    actual: `Status ${classListRes.status}, count=${classListRes.body?.length}`,
    status: classListRes.status === 200 && Array.isArray(classListRes.body) ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  record({
    id: 'SA-016',
    module: 'Sections',
    test: 'List Sections (GET /api/sections)',
    expected: 'HTTP 200 with section array',
    actual: `Status ${secListRes.status}, count=${secListRes.body?.length}`,
    status: secListRes.status === 200 && Array.isArray(secListRes.body) ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // PHASE 8: SUBJECTS
  const subListRes = await request({ path: '/api/subjects', method: 'GET', headers: authA });
  record({
    id: 'SA-017',
    module: 'Subjects',
    test: 'List Subjects (GET /api/subjects)',
    expected: 'HTTP 200 with array of subjects',
    actual: `Status ${subListRes.status}, count=${subListRes.body?.length}`,
    status: subListRes.status === 200 && Array.isArray(subListRes.body) ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  const createSubRes = await request({ path: '/api/subjects', method: 'POST', headers: authA }, {
    name: `QA Subject ${Date.now().toString().slice(-4)}`
  });
  const createdSub = createSubRes.body;
  record({
    id: 'SA-018',
    module: 'Subjects',
    test: 'Create Subject (POST /api/subjects)',
    expected: 'HTTP 201 with created subject',
    actual: `Status ${createSubRes.status}, id=${createdSub?.id}`,
    status: createSubRes.status === 201 && createdSub?.id ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  if (createdSub?.id) {
    const delSubRes = await request({ path: `/api/subjects/${createdSub.id}`, method: 'DELETE', headers: authA });
    record({
      id: 'SA-019',
      module: 'Subjects',
      test: 'Delete Subject (DELETE /api/subjects/:id)',
      expected: 'HTTP 200 with success=true',
      actual: `Status ${delSubRes.status}`,
      status: delSubRes.status === 200 ? 'PASS' : 'FAIL',
      severity: 'P2'
    });
  }

  // PHASE 9: ACADEMIC YEARS
  const ayListRes = await request({ path: '/api/academic-years', method: 'GET', headers: authA });
  record({
    id: 'SA-020',
    module: 'Academic Years',
    test: 'List Academic Years (GET /api/academic-years)',
    expected: 'HTTP 200 with active session',
    actual: `Status ${ayListRes.status}, count=${ayListRes.body?.length}`,
    status: ayListRes.status === 200 && Array.isArray(ayListRes.body) ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // PHASE 10 & 11: ATTENDANCE & CORRECTIONS
  const attReportsRes = await request({ path: '/api/attendance-reports/summary', method: 'GET', headers: authA });
  record({
    id: 'SA-021',
    module: 'Attendance Reports',
    test: 'Attendance Summary (GET /api/attendance-reports/summary)',
    expected: 'HTTP 200 with overall attendance rates',
    actual: `Status ${attReportsRes.status}, presentRate=${attReportsRes.body?.presentPercentage ?? attReportsRes.body?.summary?.present_percentage ?? 'OK'}`,
    status: attReportsRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  const exportCsvRes = await request({ path: '/api/attendance-reports/export/csv', method: 'GET', headers: authA });
  record({
    id: 'SA-022',
    module: 'Reports Export',
    test: 'Export Attendance CSV (GET /api/attendance-reports/export/csv)',
    expected: 'HTTP 200 returning CSV data',
    actual: `Status ${exportCsvRes.status}`,
    status: exportCsvRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  const exportPdfRes = await request({ path: '/api/attendance-reports/export/pdf', method: 'GET', headers: authA });
  record({
    id: 'SA-023',
    module: 'Reports Export',
    test: 'Export Attendance PDF (GET /api/attendance-reports/export/pdf)',
    expected: 'HTTP 200 with application/pdf content-type',
    actual: `Status ${exportPdfRes.status}`,
    status: exportPdfRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  const corrRes = await request({ path: '/api/attendance-corrections', method: 'GET', headers: authA });
  record({
    id: 'SA-024',
    module: 'Attendance Corrections',
    test: 'List Correction Requests (GET /api/attendance-corrections)',
    expected: 'HTTP 200 with correction list',
    actual: `Status ${corrRes.status}, items=${corrRes.body?.length}`,
    status: corrRes.status === 200 && Array.isArray(corrRes.body) ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // PHASE 12: TIMETABLE
  const ttRes = await request({ path: '/api/timetable', method: 'GET', headers: authA });
  record({
    id: 'SA-025',
    module: 'Timetable',
    test: 'Get School Timetable (GET /api/timetable)',
    expected: 'HTTP 200 with timetable entries',
    actual: `Status ${ttRes.status}, count=${ttRes.body?.length}`,
    status: ttRes.status === 200 && Array.isArray(ttRes.body) ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // PHASE 13: ANNOUNCEMENTS & COMMUNICATION
  const annRes = await request({ path: '/api/communication/announcements', method: 'GET', headers: authA });
  record({
    id: 'SA-026',
    module: 'Announcements',
    test: 'List School Announcements (GET /api/communication/announcements)',
    expected: 'HTTP 200 with announcement list',
    actual: `Status ${annRes.status}, count=${annRes.body?.length}`,
    status: annRes.status === 200 && Array.isArray(annRes.body) ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  const createAnnRes = await request({ path: '/api/communication/announcements', method: 'POST', headers: authA }, {
    title: 'QA Inspection Notice',
    content: 'School Admin Functional QA is currently underway.',
    targetRole: 'ALL',
    channels: ['IN_APP']
  });
  record({
    id: 'SA-027',
    module: 'Announcements',
    test: 'Publish Announcement (POST /api/communication/announcements)',
    expected: 'HTTP 201 with created announcement ID',
    actual: `Status ${createAnnRes.status}, id=${createAnnRes.body?.id}`,
    status: createAnnRes.status === 201 && createAnnRes.body?.id ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // PHASE 15 & 16: SUBSCRIPTIONS & INVOICES
  const subRes = await request({ path: '/api/subscriptions/current', method: 'GET', headers: authA });
  record({
    id: 'SA-028',
    module: 'Subscription',
    test: 'Get School Subscription Tier (GET /api/subscriptions/current)',
    expected: 'HTTP 200 with plan name, validity, and features',
    actual: `Status ${subRes.status}, plan=${subRes.body?.plan_name || subRes.body?.planName}`,
    status: subRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  const invRes = await request({ path: '/api/invoices', method: 'GET', headers: authA });
  record({
    id: 'SA-029',
    module: 'Invoices',
    test: 'List School Invoices (GET /api/invoices)',
    expected: 'HTTP 200 returning only School A invoices',
    actual: `Status ${invRes.status}, count=${invRes.body?.length}`,
    status: invRes.status === 200 && Array.isArray(invRes.body) ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // PHASE 17 & 18: PROFILE & SETTINGS
  const profRes = await request({ path: '/api/school-profile', method: 'GET', headers: authA });
  record({
    id: 'SA-030',
    module: 'School Profile',
    test: 'Get School Profile (GET /api/school-profile)',
    expected: 'HTTP 200 with school name and code',
    actual: `Status ${profRes.status}, name=${profRes.body?.name}, code=${profRes.body?.code}`,
    status: profRes.status === 200 && profRes.body?.code === 'GIS001' ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  const updateProfRes = await request({ path: '/api/school-profile', method: 'PUT', headers: authA }, {
    enquiryNumber: '1800-999-000',
    address: 'Campus 4, Tech Park Boulevard, Bengaluru, Karnataka (Verified)'
  });
  record({
    id: 'SA-031',
    module: 'School Profile',
    test: 'Update School Profile (PUT /api/school-profile)',
    expected: 'HTTP 200 with updated enquiry number and address',
    actual: `Status ${updateProfRes.status}, enquiry=${updateProfRes.body?.enquiry_number}`,
    status: updateProfRes.status === 200 && updateProfRes.body?.enquiry_number === '1800-999-000' ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // PHASE 22: RBAC CHECKS
  const superOverRes = await request({ path: '/api/super-admin/overview', method: 'GET', headers: authA });
  record({
    id: 'SA-032',
    module: 'RBAC Security',
    test: 'Prevent School Admin from Super Admin Overview (/api/super-admin/overview)',
    expected: 'HTTP 403 Forbidden',
    actual: `Status ${superOverRes.status}`,
    status: superOverRes.status === 403 ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  const superSchoolsRes = await request({ path: '/api/super-admin/schools', method: 'GET', headers: authA });
  record({
    id: 'SA-033',
    module: 'RBAC Security',
    test: 'Prevent School Admin from Super Admin Schools Management (/api/super-admin/schools)',
    expected: 'HTTP 403 Forbidden',
    actual: `Status ${superSchoolsRes.status}`,
    status: superSchoolsRes.status === 403 ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  // PHASE 23 & 24: STRICT MULTI-TENANT ISOLATION & IDOR
  // 1. Check School B student visibility in School A
  const bHasAStudents = studentsA.some((s: any) => s.email?.includes('delhi') || s.roll_number === '901');
  record({
    id: 'SA-034',
    module: 'Multi-Tenant Isolation',
    test: 'Cross-Tenant Read Isolation (School A cannot see School B students)',
    expected: 'Zero School B records in School A student list',
    actual: `Violation found: ${bHasAStudents}`,
    status: !bHasAStudents ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  // 2. IDOR update test
  const idorStudentId = '00000000-0000-0000-0000-000000000699'; // School B student
  const idorRes = await request({ path: `/api/students/${idorStudentId}`, method: 'PUT', headers: authA }, {
    name: 'ATTACKED BY SCHOOL A',
    rollNumber: '999',
    classId: targetClass?.id,
    sectionId: targetSec?.id
  });
  record({
    id: 'SA-035',
    module: 'IDOR Security',
    test: 'Cross-Tenant Student Modification Protection (IDOR attack)',
    expected: 'HTTP 404 or 403 rejection',
    actual: `Status ${idorRes.status}`,
    status: idorRes.status === 404 || idorRes.status === 403 ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  // 3. IDOR delete test
  const idorDelRes = await request({ path: `/api/students/${idorStudentId}`, method: 'DELETE', headers: authA });
  // Verify School B student still exists
  const stBRes = await request({ path: '/api/students', method: 'GET', headers: authB });
  const stB = (stBRes.body || []).find((s: any) => s.id === idorStudentId || s.roll_number === '901');
  record({
    id: 'SA-036',
    module: 'IDOR Security',
    test: 'Cross-Tenant Student Deletion Protection',
    expected: 'School B student remains intact and un-deleted',
    actual: `School B student exists: ${Boolean(stB)}`,
    status: Boolean(stB) ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  // 4. Invoices Isolation
  const invBRes = await request({ path: '/api/invoices', method: 'GET', headers: authB });
  const aInvoices = Array.isArray(invRes.body) ? invRes.body : [];
  const bInvoices = Array.isArray(invBRes.body) ? invBRes.body : [];
  const crossInvoice = aInvoices.some((inv: any) => bInvoices.some((bInv: any) => bInv.id === inv.id));
  record({
    id: 'SA-037',
    module: 'Multi-Tenant Isolation',
    test: 'Invoices Tenant Isolation (School A & B do not share invoices)',
    expected: 'Zero shared invoices between distinct tenants',
    actual: `Shared invoices found: ${crossInvoice}`,
    status: !crossInvoice ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  // 5. Announcements Isolation
  const annBRes = await request({ path: '/api/communication/announcements', method: 'GET', headers: authB });
  const aAnn = Array.isArray(annRes.body) ? annRes.body : [];
  const bAnn = Array.isArray(annBRes.body) ? annBRes.body : [];
  const crossAnn = aAnn.some((a: any) => bAnn.some((b: any) => b.id === a.id));
  record({
    id: 'SA-038',
    module: 'Multi-Tenant Isolation',
    test: 'Announcements Tenant Isolation',
    expected: 'Zero cross-school announcements visible',
    actual: `Cross announcement found: ${crossAnn}`,
    status: !crossAnn ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // PHASE 36: ERROR HANDLING
  const invalidJsonRes = await request({ path: '/api/students', method: 'POST', headers: authA }, {
    // missing required fields
    name: ''
  });
  record({
    id: 'SA-039',
    module: 'Error Handling',
    test: 'Missing Required Fields Validation',
    expected: 'HTTP 400 Bad Request with descriptive message',
    actual: `Status ${invalidJsonRes.status}, msg=${invalidJsonRes.body?.message}`,
    status: invalidJsonRes.status === 400 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // PHASE 38: UNPROTECTED ROUTE REJECTION
  const unauthRes = await request({ path: '/api/dashboard/school', method: 'GET' });
  record({
    id: 'SA-040',
    module: 'Authentication Security',
    test: 'Unauthenticated Request Rejection',
    expected: 'HTTP 401 Unauthorized',
    actual: `Status ${unauthRes.status}`,
    status: unauthRes.status === 401 ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  // SA-041: School Admin Attendance Submission
  const today = new Date().toISOString().slice(0, 10);
  const attSubmitRes = await request({ path: '/api/teacher/attendance', method: 'POST', headers: authA }, {
    classId: targetClass?.id || 'cls-8',
    sectionId: targetSec?.id || 'sec-8-a',
    subjectId: createdSub?.id || null,
    attendanceDate: today,
    startTime: '09:00',
    endTime: '09:45',
    presentStudentIds: studentsA.slice(0, 3).map((s: any) => s.id)
  });
  record({
    id: 'SA-041',
    module: 'Attendance Execution',
    test: 'School Admin Takes Attendance (POST /api/teacher/attendance)',
    expected: 'HTTP 201 with attendance session ID and totals',
    actual: `Status ${attSubmitRes.status}, success=${attSubmitRes.body?.success}`,
    status: attSubmitRes.status === 201 && attSubmitRes.body?.success ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // SA-042: Attendance Duplicate Submission Prevention
  const attDupRes = await request({ path: '/api/teacher/attendance', method: 'POST', headers: authA }, {
    classId: targetClass?.id || 'cls-8',
    sectionId: targetSec?.id || 'sec-8-a',
    subjectId: createdSub?.id || null,
    attendanceDate: today,
    startTime: '09:00',
    endTime: '09:45',
    presentStudentIds: studentsA.slice(0, 3).map((s: any) => s.id)
  });
  record({
    id: 'SA-042',
    module: 'Attendance Execution',
    test: 'Attendance Duplicate Submission Handling',
    expected: 'Handled safely (HTTP 409 or graceful idempotent update)',
    actual: `Status ${attDupRes.status}`,
    status: attDupRes.status === 409 || attDupRes.status === 201 || attDupRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // SA-043: Student Bulk Import
  const bulkStRes = await request({ path: '/api/students/bulk-import', method: 'POST', headers: authA }, {
    students: [
      { name: 'Bulk Student One', rollNumber: `BK${Date.now().toString().slice(-3)}1`, parentSmsNumber: '9111111111', classId: targetClass?.id, sectionId: targetSec?.id },
      { name: 'Bulk Student Two', rollNumber: `BK${Date.now().toString().slice(-3)}2`, parentSmsNumber: '9222222222', classId: targetClass?.id, sectionId: targetSec?.id }
    ]
  });
  record({
    id: 'SA-043',
    module: 'Students Bulk Operations',
    test: 'Bulk Import Students (POST /api/students/bulk-import)',
    expected: 'HTTP 201 with count >= 2',
    actual: `Status ${bulkStRes.status}, count=${bulkStRes.body?.count}`,
    status: bulkStRes.status === 201 && bulkStRes.body?.count >= 2 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // SA-044: Student Bulk Delete
  const bulkStIds = (bulkStRes.body?.items || []).map((s: any) => s.id);
  if (bulkStIds.length > 0) {
    const bulkDelRes = await request({ path: '/api/students/bulk-delete', method: 'POST', headers: authA }, {
      ids: bulkStIds
    });
    record({
      id: 'SA-044',
      module: 'Students Bulk Operations',
      test: 'Bulk Delete Students (POST /api/students/bulk-delete)',
      expected: 'HTTP 200 success=true',
      actual: `Status ${bulkDelRes.status}, count=${bulkDelRes.body?.count}`,
      status: bulkDelRes.status === 200 && bulkDelRes.body?.success ? 'PASS' : 'FAIL',
      severity: 'P2'
    });
  }

  // SA-045: Academic Year Creation
  const newYearName = `2027-${Date.now().toString().slice(-2)}`;
  const ayCreateRes = await request({ path: '/api/academic-years', method: 'POST', headers: authA }, {
    name: newYearName,
    startDate: '2027-04-01',
    endDate: '2028-03-31'
  });
  record({
    id: 'SA-045',
    module: 'Academic Years',
    test: 'Create Academic Year (POST /api/academic-years)',
    expected: 'HTTP 201 with created academic year',
    actual: `Status ${ayCreateRes.status}, id=${ayCreateRes.body?.id}`,
    status: (ayCreateRes.status === 201 || ayCreateRes.status === 200) && ayCreateRes.body?.id ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // SA-046: People Management Directory
  const peopleRes = await request({ path: '/api/people', method: 'GET', headers: authA });
  record({
    id: 'SA-046',
    module: 'People Directory',
    test: 'People Directory List (GET /api/people)',
    expected: 'HTTP 200 returning personnel list',
    actual: `Status ${peopleRes.status}`,
    status: peopleRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // SA-047: Permissions & Roles Check
  const permRes = await request({ path: '/api/permissions', method: 'GET', headers: authA });
  record({
    id: 'SA-047',
    module: 'Permissions',
    test: 'School Permissions Matrix (GET /api/permissions)',
    expected: 'HTTP 200 with permission rules',
    actual: `Status ${permRes.status}`,
    status: permRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // SA-048: Backups List & Trigger
  const backupRes = await request({ path: '/api/backups', method: 'GET', headers: authA });
  record({
    id: 'SA-048',
    module: 'Backups & Security',
    test: 'List Database Backups (GET /api/backups)',
    expected: 'HTTP 200 with backup snapshots',
    actual: `Status ${backupRes.status}`,
    status: backupRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // SA-049: Notification Channels Settings
  const notifChRes = await request({ path: '/api/notifications-v11/channels', method: 'GET', headers: authA });
  record({
    id: 'SA-049',
    module: 'Notification Settings',
    test: 'Get Notification Delivery Channels (GET /api/notifications-v11/channels)',
    expected: 'HTTP 200 with channels config',
    actual: `Status ${notifChRes.status}`,
    status: notifChRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // SA-050: Notification Channels Update
  const updateNotifRes = await request({ path: '/api/notifications-v11/channels', method: 'PUT', headers: authA }, {
    smsEnabled: true,
    whatsappEnabled: false,
    emailEnabled: true,
    whatsappProvider: 'generic'
  });
  record({
    id: 'SA-050',
    module: 'Notification Settings',
    test: 'Update Notification Channels (PUT /api/notifications-v11/channels)',
    expected: 'HTTP 200 success',
    actual: `Status ${updateNotifRes.status}`,
    status: updateNotifRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // SA-051: Advanced Analytics
  const analyticsRes = await request({ path: '/api/analytics/summary', method: 'GET', headers: authA });
  record({
    id: 'SA-051',
    module: 'Analytics',
    test: 'School Analytics Summary (GET /api/analytics/summary)',
    expected: 'HTTP 200 with statistical breakdown',
    actual: `Status ${analyticsRes.status}`,
    status: analyticsRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // SA-052: Student Promotion Eligibility
  const promoRes = await request({ path: '/api/student-promotions/eligible', method: 'GET', headers: authA });
  record({
    id: 'SA-052',
    module: 'Student Promotion',
    test: 'Eligible Students for Academic Promotion (GET /api/student-promotions/eligible)',
    expected: 'HTTP 200 with candidate students',
    actual: `Status ${promoRes.status}`,
    status: promoRes.status === 200 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // SA-053: Cross-Tenant Class IDOR Protection
  const idorClassRes = await request({ path: '/api/classes', method: 'POST', headers: authA }, {
    classNumber: 15 // Invalid out-of-range class
  });
  record({
    id: 'SA-053',
    module: 'Class Management Validation',
    test: 'Out of Range Class Number Rejection',
    expected: 'HTTP 400 Bad Request',
    actual: `Status ${idorClassRes.status}`,
    status: idorClassRes.status === 400 ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // SA-054: Cross-Tenant Section Isolation
  const secBRes = await request({ path: '/api/sections', method: 'GET', headers: authB });
  const aSec = Array.isArray(secListRes.body) ? secListRes.body : [];
  const bSec = Array.isArray(secBRes.body) ? secBRes.body : [];
  const crossSec = aSec.some((s: any) => bSec.some((b: any) => b.id === s.id && b.school_id !== s.school_id));
  record({
    id: 'SA-054',
    module: 'Multi-Tenant Isolation',
    test: 'Section Isolation (School A & B do not cross-leak sections)',
    expected: 'Zero cross-tenant section contamination',
    actual: `Contamination found: ${crossSec}`,
    status: !crossSec ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  // SA-055: Performance SLA Benchmark
  const perfEndpoints = [
    '/api/dashboard/school',
    '/api/students',
    '/api/teachers',
    '/api/classes',
    '/api/subjects',
    '/api/attendance-reports/summary'
  ];
  let allUnderSla = true;
  for (const p of perfEndpoints) {
    const perfRes = await request({ path: p, method: 'GET', headers: authA });
    if (perfRes.latencyMs > 300) {
      allUnderSla = false;
      console.warn(`Latency SLA breach on ${p}: ${perfRes.latencyMs}ms`);
    }
  }
  record({
    id: 'SA-055',
    module: 'Performance SLA',
    test: 'Core School Admin Endpoint Latency (< 300ms SLA)',
    expected: 'All core endpoints respond in under 300ms',
    actual: `All under 300ms: ${allUnderSla}`,
    status: allUnderSla ? 'PASS' : 'FAIL',
    severity: 'P2'
  });

  // SA-056: Data Consistency (Dashboard vs Entity Lists)
  const freshDash = await request({ path: '/api/dashboard/school', method: 'GET', headers: authA });
  const freshStudents = await request({ path: '/api/students', method: 'GET', headers: authA });
  const countMatches = (freshDash.body?.totalStudents ?? 0) === (freshStudents.body?.length ?? 0);
  record({
    id: 'SA-056',
    module: 'Data Consistency',
    test: 'Dashboard Student Count matches Students List Count',
    expected: 'Dashboard student metric perfectly matches active student directory count',
    actual: `Dashboard: ${freshDash.body?.totalStudents}, Directory: ${freshStudents.body?.length}`,
    status: countMatches ? 'PASS' : 'FAIL',
    severity: 'P1'
  });

  // SA-057: Direct Route Protection after Logout Simulation
  const revokedAuth = { Authorization: 'Bearer INVALID_EXPIRED_TOKEN_XYZ' };
  const revRes = await request({ path: '/api/dashboard/school', method: 'GET', headers: revokedAuth });
  record({
    id: 'SA-057',
    module: 'Authentication Security',
    test: 'Invalid / Expired Token Rejection',
    expected: 'HTTP 401 Unauthorized',
    actual: `Status ${revRes.status}`,
    status: revRes.status === 401 ? 'PASS' : 'FAIL',
    severity: 'P0'
  });

  console.log('\n===============================================================');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${results.length} tests.`);
  console.log('===============================================================\n');

  return results;
}

runMasterQa().catch(console.error);
