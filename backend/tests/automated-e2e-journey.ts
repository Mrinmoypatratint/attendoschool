/**
 * Automated E2E Website & API Journey Test Suite
 * Tests all personas (School Admin, Teacher, Super Admin) across all navigation paths & endpoints.
 */

const BASE_URL = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:5173';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    console.error(`  ✖ [FAIL] ${message}`);
  }
}

async function request(path, token = null, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function runE2ETests() {
  console.log('\n======================================================');
  console.log('🌐 RUNNING END-TO-END WEBSITE & API WORKFLOW TEST');
  console.log('======================================================\n');

  // --- 1. Frontend Asset & Accessibility Verification ---
  console.log('📱 1. Frontend Web App Assets & HTML:');
  const feRes = await fetch(`${FRONTEND_URL}/`);
  assert(feRes.status === 200, 'Frontend root / returns HTTP 200 OK');
  const html = await feRes.text();
  assert(html.includes('id="root"'), 'Frontend serves single-page app root element');
  assert(html.includes('src/main.tsx'), 'Frontend points to modern React entrypoint');

  // Verify CSS bundle loads
  const cssRes = await fetch(`${FRONTEND_URL}/src/styles.css`);
  assert(cssRes.status === 200, 'Design system styles.css is accessible');
  const css = await cssRes.text();
  assert(css.includes('--primary-600'), 'Design tokens and color palettes defined');
  assert(css.includes('data-theme'), 'Dark mode styling rules present');
  assert(css.includes('.toast'), 'Toast notification system classes present');

  // --- 2. School Admin Persona Workflow ---
  console.log('\n🏫 2. School Admin Persona Workflow:');
  const adminLogin = await request('/auth/login', null, 'POST', {
    email: 'admin@demo-school.local',
    password: 'ChangeMe123!'
  });
  assert(adminLogin.status === 200, 'School Admin authentication successful');
  assert(adminLogin.data?.user?.role === 'SCHOOL_ADMIN', 'Correct role assigned (SCHOOL_ADMIN)');
  const adminToken = adminLogin.data?.token;

  // Profile verify
  const me = await request('/auth/me', adminToken);
  assert(me.status === 200 && me.data?.user?.email === 'admin@demo-school.local', 'Token verification via /api/auth/me');

  // School overview
  const adminDash = await request('/dashboard/school', adminToken);
  assert(adminDash.status === 200 && adminDash.data?.school?.name, 'School dashboard overview loaded');

  // Students list & add
  const students = await request('/students', adminToken);
  assert(students.status === 200 && Array.isArray(students.data), 'Students table records loaded');

  // Teachers list
  const teachers = await request('/teachers', adminToken);
  assert(teachers.status === 200 && Array.isArray(teachers.data), 'Teachers list loaded');

  // Classes & Sections
  const classes = await request('/classes', adminToken);
  assert(classes.status === 200 && Array.isArray(classes.data), 'Classes list loaded');
  const sections = await request('/sections', adminToken);
  assert(sections.status === 200 && Array.isArray(sections.data), 'Sections list loaded');

  // Subjects
  const subjects = await request('/subjects', adminToken);
  assert(subjects.status === 200 && Array.isArray(subjects.data), 'Subjects list loaded');

  // Routines
  const routines = await request('/routines', adminToken);
  assert(routines.status === 200 && Array.isArray(routines.data), 'Class routines schedule loaded');

  // Attendance Reports (V12)
  const repSummary = await request('/attendance-reports-v12/summary', adminToken);
  assert(repSummary.status === 200, 'Attendance Reports summary endpoint loaded');

  // Attendance Corrections (V13)
  const corrections = await request('/attendance-corrections-v13?status=PENDING', adminToken);
  assert(corrections.status === 200 && Array.isArray(corrections.data), 'Attendance Corrections list loaded');

  // Academic Years (V15)
  const years = await request('/academic-years-v15', adminToken);
  assert(years.status === 200 && Array.isArray(years.data), 'Academic Years list loaded');

  // Timetable (V22)
  const periods = await request('/timetable-v22/periods', adminToken);
  assert(periods.status === 200 && Array.isArray(periods.data), 'Timetable periods loaded');

  // Notifications (V11)
  const notifChannels = await request('/notifications-v11/channels', adminToken);
  assert(notifChannels.status === 200, 'Notification channels loaded');

  // Announcements / Communication (V25)
  const announcements = await request('/communication-v25/announcements', adminToken);
  assert(announcements.status === 200 && Array.isArray(announcements.data), 'Announcements list loaded');

  // Subscription status (V19)
  const subStatus = await request('/subscriptions-v19/status', adminToken);
  assert(subStatus.status === 200, 'Subscription enforcement status loaded');

  // Backups (V21)
  const backups = await request('/backups-v21/jobs', adminToken);
  assert(backups.status === 200 && Array.isArray(backups.data), 'Backup jobs history loaded');

  // --- 3. Teacher Persona Workflow ---
  console.log('\n👨‍🏫 3. Teacher Persona Workflow:');
  const teacherLogin = await request('/auth/login', null, 'POST', {
    email: 'rahul@demo-school.local',
    password: 'ChangeMe123!'
  });
  assert(teacherLogin.status === 200, 'Teacher authentication successful');
  assert(teacherLogin.data?.user?.role === 'TEACHER', 'Correct role assigned (TEACHER)');
  const teacherToken = teacherLogin.data?.token;

  // Teacher today's routine
  const todayRoutine = await request('/teacher/routine/today', teacherToken);
  assert(todayRoutine.status === 200 && Array.isArray(todayRoutine.data), "Today's assigned teaching routine loaded");

  // Teacher attendance submission
  const submitAtt = await request('/teacher/attendance', teacherToken, 'POST', {
    classId: 'cls-8',
    sectionId: 'sec-a',
    subjectId: 'sub-1',
    startTime: '09:00',
    endTime: '09:45',
    attendanceDate: new Date().toISOString().slice(0, 10),
    presentStudentIds: ['st-01', 'st-02', 'st-03']
  });
  assert([200, 201, 409].includes(submitAtt.status), 'Attendance session submission handled successfully');

  // Teacher attendance history
  const attHistory = await request('/teacher/attendance/history', teacherToken);
  assert(attHistory.status === 200 && Array.isArray(attHistory.data), 'Teacher attendance history loaded');

  // Teacher access control check (ensure Teacher cannot access Super Admin endpoints)
  const unauthorizedCheck = await request('/super-admin/overview', teacherToken);
  assert(unauthorizedCheck.status === 403, 'RBAC correctly blocks Teacher from Super Admin routes (403 Forbidden)');

  // --- 4. Super Admin Persona Workflow ---
  console.log('\n👑 4. Company Super Admin Persona Workflow:');
  const superLogin = await request('/auth/login', null, 'POST', {
    email: 'superadmin@attendance.local',
    password: 'ChangeMe123!'
  });
  assert(superLogin.status === 200, 'Super Admin authentication successful');
  assert(superLogin.data?.user?.role === 'SUPER_ADMIN', 'Correct role assigned (SUPER_ADMIN)');
  const superToken = superLogin.data?.token;

  // Overview metrics
  const superOverview = await request('/super-admin/overview', superToken);
  assert(superOverview.status === 200 && superOverview.data?.total_schools !== undefined, 'Super Admin SaaS overview metrics loaded');

  // Schools list
  const schools = await request('/super-admin/schools', superToken);
  assert(schools.status === 200 && Array.isArray(schools.data), 'Schools directory loaded');

  // SaaS Plans
  const plans = await request('/super-admin/plans', superToken);
  assert(plans.status === 200 && Array.isArray(plans.data), 'Subscription plans loaded');

  // SaaS Monitoring
  const monitor = await request('/super-admin/monitor', superToken);
  assert(monitor.status === 200 && monitor.data?.metrics !== undefined, 'Live SaaS monitoring metrics loaded');

  // Payments & Invoices
  const payments = await request('/super-admin/payments', superToken);
  assert(payments.status === 200 && Array.isArray(payments.data), 'SaaS payment records loaded');
  const invoices = await request('/super-admin/invoices', superToken);
  assert(invoices.status === 200 && Array.isArray(invoices.data), 'Invoices and receipts loaded');

  // Platform Analytics (V24)
  const analyticsPlatform = await request('/analytics-v24/platform', superToken);
  assert(analyticsPlatform.status === 200, 'Platform analytics metrics loaded');
  const rankings = await request('/analytics-v24/rankings', superToken);
  assert(rankings.status === 200 && Array.isArray(rankings.data), 'School attendance rankings loaded');

  // Permissions & Roles (V18)
  const roles = await request('/permissions-v18/roles', superToken);
  assert(roles.status === 200 && Array.isArray(roles.data), 'Admin roles loaded');

  // Password Policy Check (V20)
  const pwdCheck = await request('/security-v20/validate-password', superToken, 'POST', {
    password: 'StrongPassword123!'
  });
  assert(pwdCheck.status === 200 && pwdCheck.data?.valid === true, 'Password policy validation endpoint verified');

  console.log('\n======================================================');
  console.log(`📊 E2E WORKFLOW SUMMARY: ${passedTests} / ${totalTests} PASSED`);
  console.log('======================================================\n');
}

runE2ETests().catch(err => console.error('E2E Test Failure:', err));
