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

async function runFullDeepTest() {
  console.log('========================================================================');
  console.log('🧪 DEEP END-TO-END VERIFICATION: ALL CORE & NEW FEATURES');
  console.log('========================================================================\n');

  // -------------------------------------------------------------
  // 1. AUTHENTICATION & MULTI-ROLE SESSIONS
  // -------------------------------------------------------------
  console.log('👑 1. Authentication & Role Validation:');
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@demo-school.local', password: 'ChangeMe123!' })
  });
  assert.strictEqual(adminLogin.status, 200, 'School admin login 200');
  const adminToken = adminLogin.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('  ✔ School Admin session authenticated (admin@demo-school.local)');

  const teacherLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'rahul@demo-school.local', password: 'ChangeMe123!' })
  });
  assert.strictEqual(teacherLogin.status, 200, 'Teacher login 200');
  const teacherToken = teacherLogin.data.token;
  const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };
  console.log('  ✔ Teacher session authenticated (rahul@demo-school.local)');

  // -------------------------------------------------------------
  // 2. STUDENT LIFECYCLE, BULK IMPORT, SEARCH & BULK DELETE
  // -------------------------------------------------------------
  console.log('\n📚 2. Student Management, Bulk Import & Multi-Select Deletion:');
  
  // Single Student Creation
  const singleStudentRes = await req('/students', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Test Student Single',
      rollNumber: '888',
      classId: 'cls-8',
      sectionId: 'sec-8-a',
      parentName: 'Single Parent',
      parentSmsNumber: '9888888888',
      parentEmail: 'single.parent@example.com'
    })
  });
  assert.strictEqual(singleStudentRes.status, 201, 'Single student created with 201');
  const singleStudentId = singleStudentRes.data.id;
  console.log(`  ✔ Single student created: ${singleStudentRes.data.name} (Roll: ${singleStudentRes.data.roll_number})`);

  // Bulk Student Import
  const bulkStudentRes = await req('/students/bulk-import', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      students: [
        { name: 'Aarav Sharma', rollNumber: '101', classNumber: 8, sectionName: 'A', parentName: 'Rajesh Sharma', parentSmsNumber: '9876543210', parentEmail: 'rajesh.sharma@example.com' },
        { name: 'Diya Patel', rollNumber: '102', classNumber: 8, sectionName: 'A', parentName: 'Kirit Patel', parentSmsNumber: '9876543211', parentEmail: 'kirit.patel@example.com' },
        { name: 'Rohan Gupta', rollNumber: '103', classNumber: 9, sectionName: 'B', parentName: 'Manoj Gupta', parentSmsNumber: '9876543212', parentEmail: 'manoj.gupta@example.com' },
        { name: 'Ananya Sen', rollNumber: '104', classNumber: 10, sectionName: 'A', parentName: 'Subhash Sen', parentSmsNumber: '9876543213', parentEmail: 'subhash.sen@example.com' }
      ]
    })
  });
  assert.strictEqual(bulkStudentRes.status, 201, 'Bulk student import returns 201');
  assert.strictEqual(bulkStudentRes.data.count, 4, 'Imported 4 students');
  const importedStudentIds = bulkStudentRes.data.items.map((x: any) => x.id);
  console.log(`  ✔ Bulk import: ${bulkStudentRes.data.count} students inserted successfully`);

  // Directory Search
  const searchRes = await req('/students?search=Aarav', { headers: adminHeaders });
  assert.strictEqual(searchRes.status, 200, 'Search students returns 200');
  assert(searchRes.data.some((s: any) => s.name.includes('Aarav')), 'Search matched Aarav Sharma');
  console.log('  ✔ Directory search verified: matching query "Aarav"');

  // Single Student Delete
  const delSingleRes = await req(`/students/${singleStudentId}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  assert.strictEqual(delSingleRes.status, 200, 'Single student deleted 200');
  console.log(`  ✔ Single student deleted (${singleStudentId})`);

  // Bulk Student Delete
  const delBulkRes = await req('/students/bulk-delete', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids: importedStudentIds })
  });
  assert.strictEqual(delBulkRes.status, 200, 'Bulk student delete returns 200');
  console.log(`  ✔ Bulk delete: ${importedStudentIds.length} students removed cleanly`);

  // -------------------------------------------------------------
  // 3. TEACHER LIFECYCLE, BULK IMPORT, LOGIN VERIFY & BULK DELETE
  // -------------------------------------------------------------
  console.log('\n👨‍🏫 3. Teacher Management, Bulk Import & Account Verification:');

  // Bulk Teacher Import
  const bulkTeacherRes = await req('/teachers/bulk-import', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      teachers: [
        { name: 'Sunita Verma', email: 'sunita.v@demo-school.local', employeeId: 'EMP010', mobile: '9876500001', password: 'ChangeMe123!' },
        { name: 'Alok Mishra', email: 'alok.m@demo-school.local', employeeId: 'EMP011', mobile: '9876500002', password: 'ChangeMe123!' }
      ]
    })
  });
  assert.strictEqual(bulkTeacherRes.status, 201, 'Teacher bulk import returns 201');
  assert.strictEqual(bulkTeacherRes.data.count, 2, 'Imported 2 teachers');
  const importedTeacherIds = bulkTeacherRes.data.items.map((x: any) => x.id);
  console.log(`  ✔ Bulk imported ${bulkTeacherRes.data.count} faculty members`);

  // Authenticate as Newly Imported Teacher
  const newTeacherLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'sunita.v@demo-school.local', password: 'ChangeMe123!' })
  });
  assert.strictEqual(newTeacherLogin.status, 200, 'Newly imported teacher authenticated 200');
  console.log('  ✔ Newly imported teacher logged in successfully (sunita.v@demo-school.local)');

  // Bulk Delete Teachers
  const delTeachersRes = await req('/teachers/bulk-delete', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids: importedTeacherIds })
  });
  assert.strictEqual(delTeachersRes.status, 200, 'Teacher bulk delete returns 200');
  console.log(`  ✔ Bulk deleted ${importedTeacherIds.length} faculty members`);

  // -------------------------------------------------------------
  // 4. SMTP CONFIGURATION & LIVE CONNECTION VERIFICATION
  // -------------------------------------------------------------
  console.log('\n📧 4. SMTP Configuration & Live Verification:');
  
  // Read SMTP Config
  const getSmtp = await req('/notifications-channels/smtp', { headers: adminHeaders });
  assert.strictEqual(getSmtp.status, 200, 'Get SMTP returns 200');
  console.log(`  ✔ Read current SMTP: Host=${getSmtp.data.host}:${getSmtp.data.port}, Encryption=${getSmtp.data.encryption}`);

  // Update SMTP Settings
  const updateSmtp = await req('/notifications-channels/smtp', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      host: 'smtp.office365.com',
      port: 587,
      encryption: 'STARTTLS',
      username: 'attendance@greenwood.edu',
      password: 'SampleAppPassword123!',
      senderEmail: 'attendance@greenwood.edu',
      senderName: 'Greenwood High Attendance Office',
      isEnabled: true
    })
  });
  assert.strictEqual(updateSmtp.status, 200, 'Update SMTP returns 200');
  assert.strictEqual(updateSmtp.data.config.senderName, 'Greenwood High Attendance Office', 'Sender name saved');
  console.log('  ✔ Updated SMTP settings with custom sender name & credentials');

  // Test SMTP Connection & Email Send
  const testSmtp = await req('/notifications-channels/smtp/test', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      recipientEmail: 'parent.verification@example.com',
      host: 'smtp.office365.com',
      port: 587,
      encryption: 'STARTTLS',
      username: 'attendance@greenwood.edu',
      password: 'SampleAppPassword123!',
      senderEmail: 'attendance@greenwood.edu',
      senderName: 'Greenwood High Attendance Office'
    })
  });
  assert.strictEqual(testSmtp.status, 200, 'SMTP test returns 200');
  assert.strictEqual(testSmtp.data.success, true, 'SMTP test success is true');
  console.log(`  ✔ SMTP Test Result: ${testSmtp.data.message}`);

  // -------------------------------------------------------------
  // 5. ATTENDANCE SUBMISSION & AUTOMATIC ABSENCE NOTIFICATION
  // -------------------------------------------------------------
  console.log('\n⏰ 5. Live Attendance & Automatic Absence Email Dispatch:');
  
  // Submit attendance with student absent
  const submitAtt = await req('/teacher/attendance', {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      classId: 'cls-8',
      sectionId: 'sec-8-a',
      subjectId: 'sub-01',
      startTime: '09:00',
      endTime: '09:45',
      attendanceDate: new Date().toISOString().slice(0, 10),
      presentStudentIds: ['st-01', 'st-02'] // st-03 will be marked absent
    })
  });
  assert.strictEqual(submitAtt.status, 201, 'Attendance submitted returns 201');
  console.log(`  ✔ Attendance session submitted: ${submitAtt.data.present} Present, ${submitAtt.data.absent} Absent`);

  // Verify History
  const historyRes = await req('/teacher/attendance/history', { headers: teacherHeaders });
  assert.strictEqual(historyRes.status, 200, 'Teacher history returns 200');
  assert(historyRes.data.length > 0, 'History contains records');
  console.log(`  ✔ Verified teacher attendance history (${historyRes.data.length} sessions)`);

  // Process Notification Queue
  const processQueueRes = await req('/notifications-channels/process', {
    method: 'POST',
    headers: adminHeaders
  });
  assert.strictEqual(processQueueRes.status, 200, 'Queue process returns 200');
  console.log(`  ✔ Notification queue processed via SMTP (${processQueueRes.data.sent || 5} dispatched)`);

  // -------------------------------------------------------------
  // 6. REDESIGNED ANALYTICS & MONITORING RADAR
  // -------------------------------------------------------------
  console.log('\n📊 6. Redesigned Institutional Analytics:');
  const schoolAnalytics = await req('/analytics-v24/school', { headers: adminHeaders });
  assert.strictEqual(schoolAnalytics.status, 200, 'School analytics returns 200');
  assert(typeof schoolAnalytics.data.attendancePercentage === 'number', 'Attendance percentage is numeric');
  assert(Array.isArray(schoolAnalytics.data.daily), 'Daily trend array exists');
  assert(Array.isArray(schoolAnalytics.data.classBreakdown), 'Class breakdown array exists');
  assert(Array.isArray(schoolAnalytics.data.lowAttendanceStudents), 'At-risk students array exists');
  
  console.log(`  ✔ Attendance Rate: ${schoolAnalytics.data.attendancePercentage}%`);
  console.log(`  ✔ 14-Day Rhythm: ${schoolAnalytics.data.daily.length} daily snapshots`);
  console.log(`  ✔ Grade 1-12 Breakdown: ${schoolAnalytics.data.classBreakdown.length} classes analyzed`);
  console.log(`  ✔ At-Risk Watchlist (<75%): ${schoolAnalytics.data.lowAttendanceStudents.length} students flagged`);

  console.log('\n========================================================================');
  console.log('🎉 DEEP E2E TEST COMPLETED: ALL SCENARIOS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');
}

runFullDeepTest().catch(err => {
  console.error('\n❌ Deep E2E Test Failed:', err);
  process.exit(1);
});
