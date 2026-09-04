import assert from 'assert';

const BASE = 'http://localhost:5000/api';

async function req(path: string, options: any = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING NEW FEATURES: BULK IMPORT, SMTP SETTINGS & ANALYTICS');
  console.log('========================================================================\n');

  // 1. Authenticate as School Admin
  console.log('🔑 1. School Admin Authentication:');
  const loginRes = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@demo-school.local', password: 'ChangeMe123!' })
  });
  assert.strictEqual(loginRes.status, 200, 'School Admin login status 200');
  const token = loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('  ✔ School Admin authenticated successfully');

  // 2. Student Bulk Import
  console.log('\n📚 2. Student Bulk Import & Bulk Deletion:');
  const studentImportRes = await req('/students/bulk-import', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      students: [
        { name: 'Bulk Student 1', rollNumber: '901', classNumber: 8, sectionName: 'A', parentName: 'P1', parentSmsNumber: '9900000001', parentEmail: 'p1@test.com' },
        { name: 'Bulk Student 2', rollNumber: '902', classNumber: 8, sectionName: 'A', parentName: 'P2', parentSmsNumber: '9900000002', parentEmail: 'p2@test.com' },
        { name: 'Bulk Student 3', rollNumber: '903', classNumber: 9, sectionName: 'B', parentName: 'P3', parentSmsNumber: '9900000003', parentEmail: 'p3@test.com' }
      ]
    })
  });
  assert.strictEqual(studentImportRes.status, 201, 'Student bulk import returns 201');
  assert.strictEqual(studentImportRes.data.count, 3, 'Imported 3 students');
  const createdStudentIds = studentImportRes.data.items.map((x: any) => x.id);
  console.log(`  ✔ Successfully imported ${studentImportRes.data.count} students via bulk API`);

  // Verify students in list
  const studentListRes = await req('/students', { headers: authHeaders });
  assert.strictEqual(studentListRes.status, 200, 'Student list returns 200');
  console.log(`  ✔ Total student count in directory: ${studentListRes.data.length}`);

  // Bulk Delete Students
  const studentDeleteRes = await req('/students/bulk-delete', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ids: createdStudentIds })
  });
  assert.strictEqual(studentDeleteRes.status, 200, 'Student bulk delete returns 200');
  console.log(`  ✔ Successfully deleted ${createdStudentIds.length} students via bulk delete API`);

  // 3. Teacher Bulk Import & Deletion
  console.log('\n👨‍🏫 3. Teacher Bulk Import & Bulk Deletion:');
  const teacherImportRes = await req('/teachers/bulk-import', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      teachers: [
        { name: 'Bulk Faculty 1', email: 'faculty1@demo-school.local', employeeId: 'EMP901', mobile: '9911000001', password: 'ChangeMe123!' },
        { name: 'Bulk Faculty 2', email: 'faculty2@demo-school.local', employeeId: 'EMP902', mobile: '9911000002', password: 'ChangeMe123!' }
      ]
    })
  });
  assert.strictEqual(teacherImportRes.status, 201, 'Teacher bulk import returns 201');
  assert.strictEqual(teacherImportRes.data.count, 2, 'Imported 2 teachers');
  const createdTeacherIds = teacherImportRes.data.items.map((x: any) => x.id);
  console.log(`  ✔ Successfully imported ${teacherImportRes.data.count} teachers via bulk API`);

  // Bulk Delete Teachers
  const teacherDeleteRes = await req('/teachers/bulk-delete', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ids: createdTeacherIds })
  });
  assert.strictEqual(teacherDeleteRes.status, 200, 'Teacher bulk delete returns 200');
  console.log(`  ✔ Successfully deleted ${createdTeacherIds.length} teachers via bulk delete API`);

  // 4. SMTP Email Configuration & Verification
  console.log('\n📧 4. SMTP Email Server Configuration & Live Verification:');
  const smtpGetRes = await req('/notifications-v11/smtp', { headers: authHeaders });
  assert.strictEqual(smtpGetRes.status, 200, 'Get SMTP settings returns 200');
  console.log(`  ✔ Fetched existing SMTP config: Host=${smtpGetRes.data.host}, Port=${smtpGetRes.data.port}`);

  // Update SMTP configuration
  const smtpUpdateRes = await req('/notifications-v11/smtp', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      host: 'smtp.gmail.com',
      port: 587,
      encryption: 'STARTTLS',
      username: 'attendance.office@demo-school.edu',
      password: 'app-password-demo',
      senderEmail: 'attendance@demo-school.edu',
      senderName: 'Demo High School Attendance Office',
      isEnabled: true
    })
  });
  assert.strictEqual(smtpUpdateRes.status, 200, 'Update SMTP settings returns 200');
  assert.strictEqual(smtpUpdateRes.data.config.senderEmail, 'attendance@demo-school.edu', 'Updated sender email matched');
  console.log('  ✔ Saved school SMTP credentials and sender details');

  // Test SMTP connection and email trigger
  const smtpTestRes = await req('/notifications-v11/smtp/test', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      recipientEmail: 'parent.test@example.com',
      host: 'smtp.gmail.com',
      port: 587,
      encryption: 'STARTTLS',
      username: 'attendance.office@demo-school.edu',
      password: 'app-password-demo',
      senderEmail: 'attendance@demo-school.edu',
      senderName: 'Demo High School Attendance Office'
    })
  });
  assert.strictEqual(smtpTestRes.status, 200, 'SMTP test returns 200');
  assert.strictEqual(smtpTestRes.data.success, true, 'SMTP test succeeded');
  console.log(`  ✔ SMTP Test Result: ${smtpTestRes.data.message}`);

  // 5. Enriched Analytics Dashboard
  console.log('\n📊 5. School Analytics Endpoint Verification:');
  const analyticsRes = await req('/analytics-v24/school', { headers: authHeaders });
  assert.strictEqual(analyticsRes.status, 200, 'School analytics returns 200');
  assert(Array.isArray(analyticsRes.data.daily), 'Daily trend array returned');
  assert(Array.isArray(analyticsRes.data.classBreakdown), 'Class breakdown array returned');
  assert(Array.isArray(analyticsRes.data.lowAttendanceStudents), 'Low attendance students array returned');
  console.log(`  ✔ Attendance Rate: ${analyticsRes.data.attendancePercentage}%`);
  console.log(`  ✔ Daily Trend Points: ${analyticsRes.data.daily.length} days recorded`);
  console.log(`  ✔ Classes Evaluated: ${analyticsRes.data.classBreakdown.length} grade levels`);
  console.log(`  ✔ At-Risk Watchlist Students: ${analyticsRes.data.lowAttendanceStudents.length}`);

  console.log('\n========================================================================');
  console.log('🎉 ALL NEW FEATURE TESTS PASSED SUCCESSFULLY! (100% PASS)');
  console.log('========================================================================\n');
}

run().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
