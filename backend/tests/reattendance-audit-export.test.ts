import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
import app from '../src/app';
import { env } from '../src/config/env';
import {
  memAttendanceSessions,
  memAttendanceRecords,
  memAttendanceAuditLogs,
  MemAttendanceSession,
  MemAttendanceRecord,
  MemAttendanceAuditLog
} from '../src/routes/teacher';

const TEST_PORT = 5012;
const BASE = `http://localhost:${TEST_PORT}/api`;

let server: http.Server;

function generateToken(user: { id: string; email: string; role: string; schoolId: string; name: string }) {
  return jwt.sign(user, env.jwtSecret || 'development-only-secret', { expiresIn: '1h' });
}

async function apiReq(path: string, options: any = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get('content-type') || '';
  const contentDisposition = res.headers.get('content-disposition') || '';

  if (contentType.includes('text/csv') || contentType.includes('application/octet-stream') || contentType.includes('spreadsheetml')) {
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = buffer.toString('utf8');
    return {
      status: res.status,
      contentType,
      contentDisposition,
      buffer,
      text
    };
  }

  const data = await res.json().catch(() => ({}));
  return {
    status: res.status,
    contentType,
    contentDisposition,
    data
  };
}

async function runTestSuite() {
  console.log('\n========================================================================');
  console.log('🧪 COMPREHENSIVE AUTOMATED TEST SUITE: SESSION RE-ATTENDANCE AUDIT EXPORT');
  console.log('========================================================================\n');

  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(TEST_PORT, resolve));

  let passedTests = 0;
  let totalTests = 0;

  function recordPass(testName: string) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  }

  function recordFail(testName: string, err: any) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(err);
    throw err;
  }

  try {
    // Schools setup
    const schoolA = 'sch-alpha-institution-001';
    const schoolB = 'sch-beta-academy-002';

    // Users setup
    const teacherUser = {
      id: 'teacher-auth-001',
      email: 'teacher.alpha@attendo.org',
      name: 'Prof. Vikram Sen',
      role: 'TEACHER',
      schoolId: schoolA
    };
    const adminUser = {
      id: 'admin-auth-001',
      email: 'principal@alpha.attendo.org',
      name: 'Dr. Sunita Rao',
      role: 'SCHOOL_ADMIN',
      schoolId: schoolA
    };
    const superAdminUser = {
      id: 'super-admin-001',
      email: 'root@attendo.org',
      name: 'System Super Admin',
      role: 'SUPER_ADMIN',
      schoolId: 'system'
    };
    const studentUser = {
      id: 'student-auth-001',
      email: 'student@alpha.attendo.org',
      name: 'Rahul Bose',
      role: 'STUDENT',
      schoolId: schoolA
    };
    const parentUser = {
      id: 'parent-auth-001',
      email: 'parent@home.local',
      name: 'Mrs. Bose',
      role: 'PARENT',
      schoolId: schoolA
    };
    const schoolBTeacher = {
      id: 'teacher-beta-002',
      email: 'faculty@beta.academy',
      name: 'Dr. Beta Faculty',
      role: 'TEACHER',
      schoolId: schoolB
    };

    const teacherToken = generateToken(teacherUser);
    const adminToken = generateToken(adminUser);
    const superAdminToken = generateToken(superAdminUser);
    const studentToken = generateToken(studentUser);
    const parentToken = generateToken(parentUser);
    const schoolBTeacherToken = generateToken(schoolBTeacher);

    const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    const superAdminHeaders = { Authorization: `Bearer ${superAdminToken}` };
    const studentHeaders = { Authorization: `Bearer ${studentToken}` };
    const parentHeaders = { Authorization: `Bearer ${parentToken}` };
    const schoolBHeaders = { Authorization: `Bearer ${schoolBTeacherToken}` };

    // Seed test sessions in memory
    const sessionIdA = 'sess-test-alpha-101';
    const sessionIdB = 'sess-test-beta-202';
    const today = new Date().toISOString().slice(0, 10);

    const testSessionA: MemAttendanceSession = {
      id: sessionIdA,
      school_id: schoolA,
      schoolId: schoolA,
      class_id: 'cls-10-uuid',
      classId: 'cls-10-uuid',
      class_number: 10,
      classNumber: 10,
      section_id: 'sec-10a-uuid',
      sectionId: 'sec-10a-uuid',
      section_name: 'A',
      sectionName: 'A',
      subject_id: 'sub-physics-uuid',
      subjectId: 'sub-physics-uuid',
      subject_name: 'Physics',
      subjectName: 'Physics',
      attendance_date: today,
      attendanceDate: today,
      start_time: '09:00:00',
      startTime: '09:00:00',
      end_time: '09:45:00',
      endTime: '09:45:00',
      teacher_id: teacherUser.id,
      teacherId: teacherUser.id,
      takenBy: teacherUser.id,
      teacher_name: teacherUser.name,
      teacherName: teacherUser.name,
      total_count: 30,
      present_count: 28,
      absent_count: 2,
      left_early_count: 1,
      late_count: 1,
      is_reattendance: true,
      reattendance_count: 2,
      last_modified_by: teacherUser.id,
      last_modified_name: teacherUser.name,
      last_modified_at: new Date().toISOString()
    };
    memAttendanceSessions.push(testSessionA);

    const testSessionB: MemAttendanceSession = {
      id: sessionIdB,
      school_id: schoolB,
      schoolId: schoolB,
      class_id: 'cls-9-beta',
      classId: 'cls-9-beta',
      class_number: 9,
      classNumber: 9,
      section_id: 'sec-9b-beta',
      sectionId: 'sec-9b-beta',
      section_name: 'B',
      sectionName: 'B',
      subject_id: null,
      subjectId: null,
      subject_name: 'General',
      subjectName: 'General',
      attendance_date: today,
      attendanceDate: today,
      start_time: '10:00:00',
      startTime: '10:00:00',
      end_time: '10:45:00',
      endTime: '10:45:00',
      teacher_id: schoolBTeacher.id,
      teacherId: schoolBTeacher.id,
      takenBy: schoolBTeacher.id,
      teacher_name: schoolBTeacher.name,
      teacherName: schoolBTeacher.name,
      total_count: 25,
      present_count: 25,
      absent_count: 0
    };
    memAttendanceSessions.push(testSessionB);

    // Seed test audit records
    const auditRecord1: MemAttendanceAuditLog = {
      id: 'audit-alpha-001',
      schoolId: schoolA,
      school_id: schoolA,
      sessionId: sessionIdA,
      session_id: sessionIdA,
      studentId: 'stud-alpha-001',
      student_id: 'stud-alpha-001',
      studentName: 'Aarav Patel',
      student_name: 'Aarav Patel',
      rollNumber: '101',
      roll_number: '101',
      action: 'LEFT_EARLY',
      previousStatus: 'PRESENT',
      previous_status: 'PRESENT',
      newStatus: 'LEFT_EARLY',
      new_status: 'LEFT_EARLY',
      departurePeriod: 'After 2nd Period',
      departure_period: 'After 2nd Period',
      departureTime: '10:30 AM',
      departure_time: '10:30 AM',
      reason: 'Doctor Appointment, parent signed gate pass',
      changedBy: teacherUser.id,
      changed_by: teacherUser.id,
      changedByName: teacherUser.name,
      changed_by_name: teacherUser.name,
      modified_by_name: teacherUser.name,
      notificationSent: true,
      notification_sent: true,
      createdAt: new Date(Date.now() - 3600000).toISOString()
    };

    const auditRecord2: MemAttendanceAuditLog = {
      id: 'audit-alpha-002',
      schoolId: schoolA,
      school_id: schoolA,
      sessionId: sessionIdA,
      session_id: sessionIdA,
      studentId: 'stud-alpha-002',
      student_id: 'stud-alpha-002',
      studentName: 'Priya "Special, Quotes" Sharma',
      student_name: 'Priya "Special, Quotes" Sharma',
      rollNumber: '102',
      roll_number: '102',
      action: 'LATE_ARRIVAL',
      previousStatus: 'ABSENT',
      previous_status: 'ABSENT',
      newStatus: 'LATE',
      new_status: 'LATE',
      arrivalPeriod: 'Period 3',
      arrival_period: 'Period 3',
      arrivalTime: '11:15 AM',
      arrival_time: '11:15 AM',
      reason: 'School bus mechanical breakdown\nLine 2 remarks with "embedded quotes"',
      changedBy: adminUser.id,
      changed_by: adminUser.id,
      changedByName: adminUser.name,
      changed_by_name: adminUser.name,
      modified_by_name: adminUser.name,
      notificationSent: true,
      notification_sent: true,
      createdAt: new Date(Date.now() - 1800000).toISOString()
    };

    const auditRecord3: MemAttendanceAuditLog = {
      id: 'audit-alpha-003',
      schoolId: schoolA,
      school_id: schoolA,
      sessionId: sessionIdA,
      session_id: sessionIdA,
      studentId: 'stud-alpha-003',
      student_id: 'stud-alpha-003',
      studentName: 'Vikram Malhotra',
      student_name: 'Vikram Malhotra',
      rollNumber: '103',
      roll_number: '103',
      action: 'STATUS_UPDATE',
      previousStatus: 'ABSENT',
      previous_status: 'ABSENT',
      newStatus: 'PRESENT',
      new_status: 'PRESENT',
      reason: 'Marked absent erroneously during initial roll call',
      changedBy: teacherUser.id,
      changed_by: teacherUser.id,
      changedByName: teacherUser.name,
      changed_by_name: teacherUser.name,
      modified_by_name: teacherUser.name,
      notificationSent: false,
      notification_sent: false,
      createdAt: new Date().toISOString()
    };

    // Beta school audit log for isolation test
    const auditRecordBeta: MemAttendanceAuditLog = {
      id: 'audit-beta-001',
      schoolId: schoolB,
      school_id: schoolB,
      sessionId: sessionIdB,
      session_id: sessionIdB,
      studentId: 'stud-beta-999',
      student_name: 'Confidential Beta Student',
      rollNumber: '999',
      action: 'LEFT_EARLY',
      previousStatus: 'PRESENT',
      newStatus: 'LEFT_EARLY',
      reason: 'Secret school B data',
      changedBy: schoolBTeacher.id,
      changedByName: schoolBTeacher.name,
      createdAt: new Date().toISOString()
    };

    memAttendanceAuditLogs.push(auditRecord1, auditRecord2, auditRecord3, auditRecordBeta);

    // =========================================================================
    // TEST 1: Unauthenticated request must be rejected (401)
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export`);
      assert.strictEqual(res.status, 401, 'Unauthenticated request should return 401');
      recordPass('1. Unauthenticated request rejected with 401');
    } catch (e) {
      recordFail('1. Unauthenticated request rejected with 401', e);
    }

    // =========================================================================
    // TEST 2: Unauthorized Student role must be rejected (403)
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export`, { headers: studentHeaders });
      assert.strictEqual(res.status, 403, 'Student role should be rejected with 403 Forbidden');
      recordPass('2. Student role blocked from export with 403 Forbidden');
    } catch (e) {
      recordFail('2. Student role blocked from export with 403 Forbidden', e);
    }

    // =========================================================================
    // TEST 3: Unauthorized Parent role must be rejected (403)
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export`, { headers: parentHeaders });
      assert.strictEqual(res.status, 403, 'Parent role should be rejected with 403 Forbidden');
      recordPass('3. Parent role blocked from export with 403 Forbidden');
    } catch (e) {
      recordFail('3. Parent role blocked from export with 403 Forbidden', e);
    }

    // =========================================================================
    // TEST 4: Authorized Teacher can export CSV successfully (200)
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export?format=csv`, { headers: teacherHeaders });
      assert.strictEqual(res.status, 200, 'Teacher should export CSV with 200');
      assert.ok(res.contentType.includes('text/csv'), `Content-Type should be text/csv, got ${res.contentType}`);
      assert.ok(res.contentDisposition.includes('attachment;'), 'Should have attachment disposition');
      assert.ok(res.contentDisposition.includes('.csv'), 'Should have .csv extension in filename');
      
      // Check UTF-8 BOM
      assert.ok(res.text.startsWith('\uFEFF'), 'CSV should start with UTF-8 BOM for Excel compatibility');
      
      // Check headers
      assert.ok(res.text.includes('Timestamp,Event ID,Session ID,Date,Class,Section,Subject,Student Name'), 'CSV should contain standard headers');
      assert.ok(res.text.includes('Admission No.,Roll No.,Event Type,Previous Status,New Status'), 'CSV should contain status and identifiers');
      assert.ok(res.text.includes('Departure Period,Departure Time,Arrival Period,Arrival Time,Performed By,Parent Alert Sent,Reason / Details'), 'CSV should contain departure/arrival/reason headers');

      // Check authoritative student records are present
      assert.ok(res.text.includes('Aarav Patel'), 'Should contain Aarav Patel');
      assert.ok(res.text.includes('LEFT_EARLY'), 'Should contain LEFT_EARLY status');
      assert.ok(res.text.includes('Doctor Appointment, parent signed gate pass'), 'Should contain reason');

      recordPass('4. Authorized Teacher CSV export with correct headers, BOM, and authoritative data');
    } catch (e) {
      recordFail('4. Authorized Teacher CSV export with correct headers, BOM, and authoritative data', e);
    }

    // =========================================================================
    // TEST 5: Authorized Teacher can export XLSX workbook successfully (200)
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export?format=xlsx`, { headers: teacherHeaders });
      assert.strictEqual(res.status, 200, 'Teacher should export XLSX with 200');
      assert.ok(res.contentType.includes('spreadsheetml') || res.contentType.includes('octet-stream'), 'Content-Type should be XLSX');
      assert.ok(res.contentDisposition.includes('.xlsx'), 'Filename should end with .xlsx');

      // Parse XLSX workbook directly
      const wb = XLSX.read(res.buffer, { type: 'buffer' });
      assert.ok(wb.SheetNames.includes('Audit Trail'), 'Workbook should have "Audit Trail" sheet');
      const ws = wb.Sheets['Audit Trail'];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      assert.strictEqual(rows.length, 3, `Should have 3 audit records in XLSX sheet, got ${rows.length}`);
      assert.strictEqual(rows[0]['Student Name'], 'Aarav Patel');
      assert.strictEqual(rows[0]['Event Type'], 'LEFT_EARLY');
      assert.strictEqual(rows[0]['Departure Period'], 'After 2nd Period');
      assert.strictEqual(rows[0]['Departure Time'], '10:30 AM');
      assert.strictEqual(rows[0]['Parent Alert Sent'], 'Yes');

      recordPass('5. Authorized Teacher XLSX workbook export with sheet structure and valid cells');
    } catch (e) {
      recordFail('5. Authorized Teacher XLSX workbook export with sheet structure and valid cells', e);
    }

    // =========================================================================
    // TEST 6: School Admin can export audit trail
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export?format=csv`, { headers: adminHeaders });
      assert.strictEqual(res.status, 200, 'School Admin should export CSV with 200');
      assert.ok(res.text.includes('Aarav Patel'), 'Admin export should contain records');
      recordPass('6. School Admin export access verified');
    } catch (e) {
      recordFail('6. School Admin export access verified', e);
    }

    // =========================================================================
    // TEST 7: Strict Tenant Isolation - Teacher from School B CANNOT export School A session
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export`, { headers: schoolBHeaders });
      assert.strictEqual(res.status, 403, 'Cross-school export attempt must be blocked with 403 Forbidden');
      recordPass('7. Strict Tenant Isolation: Cross-school session export blocked with 403');
    } catch (e) {
      recordFail('7. Strict Tenant Isolation: Cross-school session export blocked with 403', e);
    }

    // =========================================================================
    // TEST 8: Strict Tenant Isolation - General export never leaks School B records
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/audit-trail/export?format=csv`, { headers: teacherHeaders });
      assert.strictEqual(res.status, 200, 'General export should succeed for school A');
      assert.ok(!res.text.includes('Confidential Beta Student'), 'Must never leak School B audit records');
      assert.ok(!res.text.includes('Secret school B data'), 'Must never leak School B details');
      assert.ok(res.text.includes('Aarav Patel'), 'Must include School A student');
      recordPass('8. Strict Tenant Isolation: General export query scoped 100% to caller school');
    } catch (e) {
      recordFail('8. Strict Tenant Isolation: General export query scoped 100% to caller school', e);
    }

    // =========================================================================
    // TEST 9: Filtered export by Status (LEFT_EARLY only)
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export?format=csv&status=LEFT_EARLY`, { headers: teacherHeaders });
      assert.strictEqual(res.status, 200);
      assert.ok(res.text.includes('Aarav Patel'), 'Should contain LEFT_EARLY record');
      assert.ok(!res.text.includes('Priya'), 'Should not contain LATE record');
      assert.ok(!res.text.includes('Vikram Malhotra'), 'Should not contain PRESENT status update');
      recordPass('9. Filtered export by Status (LEFT_EARLY) isolates exact matching subset');
    } catch (e) {
      recordFail('9. Filtered export by Status (LEFT_EARLY) isolates exact matching subset', e);
    }

    // =========================================================================
    // TEST 10: Filtered export by Search query (student name or reason)
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export?format=csv&search=breakdown`, { headers: teacherHeaders });
      assert.strictEqual(res.status, 200);
      assert.ok(res.text.includes('Priya'), 'Should find Priya by reason match "breakdown"');
      assert.ok(!res.text.includes('Aarav Patel'), 'Should exclude Aarav Patel');
      recordPass('10. Filtered export by Search query matches on reason and student');
    } catch (e) {
      recordFail('10. Filtered export by Search query matches on reason and student', e);
    }

    // =========================================================================
    // TEST 11: Special Characters and RFC 4180 Escaping (quotes, commas, newlines)
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export?format=csv`, { headers: teacherHeaders });
      assert.strictEqual(res.status, 200);
      
      // Ensure quotes are escaped as "" and wrapped in ""
      assert.ok(res.text.includes('"Priya ""Special, Quotes"" Sharma"'), 'Student name with commas and quotes correctly escaped');
      assert.ok(res.text.includes('""embedded quotes""'), 'Multiline remarks with inner quotes correctly doubled');
      recordPass('11. Special characters, multiline reasons, and embedded quotes correctly escaped');
    } catch (e) {
      recordFail('11. Special characters, multiline reasons, and embedded quotes correctly escaped', e);
    }

    // =========================================================================
    // TEST 12: Empty results export handling
    // =========================================================================
    totalTests++;
    try {
      const res = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export?format=csv&search=NONEXISTENT_STUDENT_XYZ`, { headers: teacherHeaders });
      assert.strictEqual(res.status, 200);
      const lines = res.text.replace(/\uFEFF/, '').trim().split('\r\n');
      assert.strictEqual(lines.length, 1, 'Should output exactly 1 line (the header row) for 0 matches');
      assert.ok(lines[0].startsWith('Timestamp,Event ID'), 'Header row should be intact');

      // Also check XLSX for 0 matches
      const resXlsx = await apiReq(`/teacher/attendance/${sessionIdA}/audit-trail/export?format=xlsx&search=NONEXISTENT_STUDENT_XYZ`, { headers: teacherHeaders });
      assert.strictEqual(resXlsx.status, 200);
      const wb = XLSX.read(resXlsx.buffer, { type: 'buffer' });
      assert.ok(wb.SheetNames.includes('Audit Trail'), 'Empty XLSX should still have valid sheet');
      recordPass('12. Empty search/filter results handled gracefully in both CSV and XLSX');
    } catch (e) {
      recordFail('12. Empty search/filter results handled gracefully in both CSV and XLSX', e);
    }

    // =========================================================================
    // TEST 13: Regression test on existing audit endpoints
    // =========================================================================
    totalTests++;
    try {
      const recordsRes = await apiReq(`/teacher/attendance/${sessionIdA}/records`, { headers: teacherHeaders });
      assert.strictEqual(recordsRes.status, 200);
      assert.ok(Array.isArray(recordsRes.data.auditLogs), 'Session records response must still include auditLogs array');
      assert.strictEqual(recordsRes.data.auditLogs.length, 3, 'Audit logs length should match 3');

      const todayRes = await apiReq(`/teacher/attendance/today-status?date=${today}&class=10&section=A`, { headers: teacherHeaders });
      assert.strictEqual(todayRes.status, 200);
      assert.strictEqual(todayRes.data.hasAttendance, true);
      assert.ok(Array.isArray(todayRes.data.auditLogs), 'Today-status response must still include auditLogs array');
      recordPass('13. Regression test: existing audit viewing endpoints continue functioning 100%');
    } catch (e) {
      recordFail('13. Regression test: existing audit viewing endpoints continue functioning 100%', e);
    }

    console.log('\n========================================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} AUTOMATED TESTS COMPLETED WITH 100% PASS STATUS!`);
    console.log('========================================================================\n');
  } finally {
    server.close();
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
