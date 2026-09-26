import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { env } from '../src/config/env';
import { memAttendanceSessions, memAttendanceRecords, memAttendanceAuditLogs } from '../src/routes/teacher';

const TEST_PORT = 5008;
const BASE = `http://localhost:${TEST_PORT}/api`;

let server: http.Server;

function generateToken(user: { id: string; email: string; role: string; schoolId: string; name: string }) {
  return jwt.sign(user, env.jwtSecret || 'development-only-secret', { expiresIn: '1h' });
}

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

async function runTests() {
  console.log('\n========================================================================');
  console.log('🧪 VERIFYING CROSS-TEACHER ATTENDANCE VISIBILITY & RE-ATTENDANCE SCENARIOS');
  console.log('========================================================================\n');

  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(TEST_PORT, resolve));

  try {
    const schoolId = 'test-school-corp-101';

    // Teacher 1: Physics Faculty (takes 1st period roll call)
    const teacher1 = {
      id: 'teacher-uuid-001',
      email: 'teacher1@school.local',
      name: 'Dr. Ramesh Sharma (Physics)',
      role: 'TEACHER',
      schoolId
    };
    const t1Token = generateToken(teacher1);
    const t1Headers = { Authorization: `Bearer ${t1Token}` };

    // Teacher 2: Mathematics Faculty (takes 2nd period in the same class)
    const teacher2 = {
      id: 'teacher-uuid-002',
      email: 'teacher2@school.local',
      name: 'Prof. Anita Desai (Maths)',
      role: 'TEACHER',
      schoolId
    };
    const t2Token = generateToken(teacher2);
    const t2Headers = { Authorization: `Bearer ${t2Token}` };

    const classId = 'class-10';
    const sectionId = 'sec-10-A';
    const today = new Date().toISOString().slice(0, 10);

    const studentRahul = { id: 'stu-101', name: 'Rahul Sharma', rollNumber: '101' };
    const studentAnanya = { id: 'stu-102', name: 'Ananya Roy', rollNumber: '102' };
    const studentVikram = { id: 'stu-103', name: 'Vikram Patel', rollNumber: '103' };

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: Teacher 1 submits initial daily attendance in Period 1
    // Rahul (101): Present
    // Ananya (102): Present
    // Vikram (103): Absent
    // ──────────────────────────────────────────────────────────────────────────
    console.log('📋 STEP 1: Teacher 1 records initial Class 10-A attendance (Period 1)...');

    const submitRes = await req('/teacher/attendance', {
      method: 'POST',
      headers: t1Headers,
      body: JSON.stringify({
        classId,
        classNumber: 10,
        sectionId,
        sectionName: 'A',
        subjectName: 'Physics',
        attendanceDate: today,
        startTime: '09:00:00',
        endTime: '09:45:00',
        records: [
          { studentId: studentRahul.id, studentName: studentRahul.name, rollNumber: studentRahul.rollNumber, status: 'PRESENT' },
          { studentId: studentAnanya.id, studentName: studentAnanya.name, rollNumber: studentAnanya.rollNumber, status: 'PRESENT' },
          { studentId: studentVikram.id, studentName: studentVikram.name, rollNumber: studentVikram.rollNumber, status: 'ABSENT' }
        ],
        studentIds: [studentRahul.id, studentAnanya.id, studentVikram.id],
        presentStudentIds: [studentRahul.id, studentAnanya.id]
      })
    });

    assert.strictEqual(submitRes.status, 201, 'Attendance submitted successfully with 201');
    assert.strictEqual(submitRes.data.present, 2, '2 students marked present initially');
    assert.strictEqual(submitRes.data.absent, 1, '1 student marked absent initially');
    const sessionId = submitRes.data.sessionId;
    assert.ok(sessionId, 'Valid session ID returned');
    console.log(`  ✔ Session created (${sessionId}): 2 Present, 1 Absent (by ${teacher1.name})`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: Cross-Teacher Visibility: Teacher 2 (Maths) accesses the station
    // Teacher 2 must see today's attendance submitted by Teacher 1!
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n👁️ STEP 2: Verifying Cross-Teacher Visibility (Teacher 2 inspects Class 10-A)...');

    const t2StatusRes = await req(`/teacher/attendance/today-status?classId=${classId}&sectionId=${sectionId}&date=${today}`, {
      headers: t2Headers
    });

    assert.strictEqual(t2StatusRes.status, 200, 'GET today-status returns 200');
    assert.strictEqual(t2StatusRes.data.hasAttendance, true, 'hasAttendance is true for Teacher 2');
    assert.strictEqual(t2StatusRes.data.session.id, sessionId, 'Correct session retrieved by Teacher 2');
    assert.strictEqual(t2StatusRes.data.session.teacher_name, teacher1.name, 'Teacher 2 sees Teacher 1 as original author');
    assert.strictEqual(t2StatusRes.data.records.length, 3, 'All 3 student records returned');

    const rRahul = t2StatusRes.data.records.find((r: any) => r.studentId === studentRahul.id);
    const rAnanya = t2StatusRes.data.records.find((r: any) => r.studentId === studentAnanya.id);
    const rVikram = t2StatusRes.data.records.find((r: any) => r.studentId === studentVikram.id);

    assert.strictEqual(rRahul?.status, 'PRESENT', 'Rahul is seen as PRESENT');
    assert.strictEqual(rAnanya?.status, 'PRESENT', 'Ananya is seen as PRESENT');
    assert.strictEqual(rVikram?.status, 'ABSENT', 'Vikram is seen as ABSENT');
    console.log('  ✔ Teacher 2 successfully sees complete session roster submitted by Teacher 1');

    // Also verify Teacher 2 can see this session in GET /teacher/attendance/history
    const historyRes = await req('/teacher/attendance/history', {
      headers: t2Headers
    });
    assert.strictEqual(historyRes.status, 200, 'History returns 200');
    assert.ok(Array.isArray(historyRes.data), 'History is an array');
    const foundSessionInHistory = historyRes.data.find((s: any) => s.id === sessionId);
    assert.ok(foundSessionInHistory, 'Session submitted by Teacher 1 is visible in Teacher 2 history');
    assert.strictEqual(foundSessionInHistory.teacher_name, teacher1.name, 'Teacher name correctly shown in history');
    console.log('  ✔ Cross-teacher session visible in institutional history table');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: Re-attendance Scenario: Rahul came in 1st period and went after 1st period
    // Teacher 2 records Early Departure after 1st period
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n🚪 STEP 3: Re-attendance: Rahul came in 1st period and left after 1st period...');

    const leftEarlyRes = await req(`/teacher/attendance/${sessionId}/student/${studentRahul.id}`, {
      method: 'PUT',
      headers: t2Headers,
      body: JSON.stringify({
        status: 'LEFT_EARLY',
        departurePeriod: 'After 1st Period',
        departureTime: '10:15 AM',
        reason: 'Parent picked up early - High fever (Sick Bay transfer)',
        notifyParent: true
      })
    });

    assert.strictEqual(leftEarlyRes.status, 200, 'PUT single student returns 200');
    assert.strictEqual(leftEarlyRes.data.success, true, 'Status update succeeded');
    assert.strictEqual(leftEarlyRes.data.record.status, 'LEFT_EARLY', 'Record status updated to LEFT_EARLY');
    assert.strictEqual(leftEarlyRes.data.record.departurePeriod, 'After 1st Period', 'Departure period saved as "After 1st Period"');
    assert.strictEqual(leftEarlyRes.data.record.departureTime, '10:15 AM', 'Departure time saved');
    assert.strictEqual(leftEarlyRes.data.record.updatedByName, teacher2.name, 'Updated by Teacher 2 recorded');

    // Verify session updated counters and reattendance flags
    const updatedSess = leftEarlyRes.data.session;
    assert.strictEqual(updatedSess.left_early_count, 1, 'left_early_count incremented to 1');
    assert.strictEqual(updatedSess.present_count, 1, 'present_count adjusted to 1 (only Ananya is full day present)');
    assert.strictEqual(updatedSess.is_reattendance, true, 'is_reattendance flagged true');
    assert.ok(updatedSess.reattendance_count >= 1, 'reattendance_count incremented');
    assert.strictEqual(updatedSess.last_modified_name, teacher2.name, 'last_modified_name is Teacher 2');
    console.log('  ✔ Rahul successfully updated to LEFT_EARLY (After 1st Period)');
    console.log(`  ✔ Session counters: Present: ${updatedSess.present_count}, Left Early: ${updatedSess.left_early_count}, Absent: ${updatedSess.absent_count}`);
    console.log(`  ✔ Last modified by: ${updatedSess.last_modified_name} (Reattendance Count: ${updatedSess.reattendance_count})`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: Late Arrival Scenario: Vikram arrives during Period 2
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n⏰ STEP 4: Re-attendance: Vikram arrived late in Period 2 (was initially absent)...');

    const lateRes = await req(`/teacher/attendance/${sessionId}/student/${studentVikram.id}`, {
      method: 'PUT',
      headers: t2Headers,
      body: JSON.stringify({
        status: 'LATE',
        arrivalPeriod: 'Period 2',
        arrivalTime: '10:05 AM',
        reason: 'Commute delay - School bus puncture note provided',
        notifyParent: true
      })
    });

    assert.strictEqual(lateRes.status, 200, 'PUT student late returns 200');
    assert.strictEqual(lateRes.data.record.status, 'LATE', 'Record status is LATE');
    assert.strictEqual(lateRes.data.record.arrivalPeriod, 'Period 2', 'Arrival period is Period 2');
    assert.strictEqual(lateRes.data.session.late_count, 1, 'late_count incremented to 1');
    assert.strictEqual(lateRes.data.session.absent_count, 0, 'absent_count decremented to 0');
    console.log('  ✔ Vikram successfully updated to LATE (Period 2)');
    console.log(`  ✔ Session counters: Present: ${lateRes.data.session.present_count}, Late: ${lateRes.data.session.late_count}, Left Early: ${lateRes.data.session.left_early_count}, Absent: ${lateRes.data.session.absent_count}`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: Audit Trail Verification
    // Every re-attendance change must be recorded with who changed it, when, and why!
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📜 STEP 5: Verifying Institutional Audit Trail...');

    const recordsRes = await req(`/teacher/attendance/${sessionId}/records`, {
      headers: t1Headers
    });

    assert.strictEqual(recordsRes.status, 200, 'GET records returns 200');
    assert.strictEqual(recordsRes.data.records.length, 3, '3 records returned');
    assert.ok(recordsRes.data.auditLogs.length >= 2, 'At least 2 audit logs recorded (Rahul early exit + Vikram late entry)');

    const rahulAudit = recordsRes.data.auditLogs.find((a: any) => a.student_id === studentRahul.id || a.studentId === studentRahul.id);
    assert.ok(rahulAudit, 'Audit log exists for Rahul');
    assert.strictEqual(rahulAudit.previous_status, 'PRESENT', 'Rahul previous status was PRESENT');
    assert.strictEqual(rahulAudit.new_status, 'LEFT_EARLY', 'Rahul new status is LEFT_EARLY');
    assert.strictEqual(rahulAudit.departure_period || rahulAudit.departurePeriod, 'After 1st Period', 'Audit log includes departure period "After 1st Period"');
    assert.ok(rahulAudit.reason.includes('fever'), 'Audit log includes reason "fever"');
    console.log(`  ✔ Audit Log 1 verified: [${rahulAudit.created_at}] ${rahulAudit.student_name}: ${rahulAudit.previous_status} -> ${rahulAudit.new_status} (by ${rahulAudit.modified_by_name})`);

    const vikramAudit = recordsRes.data.auditLogs.find((a: any) => a.student_id === studentVikram.id || a.studentId === studentVikram.id);
    assert.ok(vikramAudit, 'Audit log exists for Vikram');
    assert.strictEqual(vikramAudit.previous_status, 'ABSENT', 'Vikram previous status was ABSENT');
    assert.strictEqual(vikramAudit.new_status, 'LATE', 'Vikram new status is LATE');
    console.log(`  ✔ Audit Log 2 verified: [${vikramAudit.created_at}] ${vikramAudit.student_name}: ${vikramAudit.previous_status} -> ${vikramAudit.new_status} (by ${vikramAudit.modified_by_name})`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 6: Whole-Class Re-roll Call Verification (Batch Reattendance)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n🔄 STEP 6: Verifying Whole-Class Re-attendance Verification (Period 4 spot check)...');

    const batchRes = await req(`/teacher/attendance/${sessionId}/reattendance`, {
      method: 'POST',
      headers: t1Headers,
      body: JSON.stringify({
        records: [
          { studentId: studentRahul.id, studentName: studentRahul.name, status: 'LEFT_EARLY', departurePeriod: 'After 1st Period', departureTime: '10:15 AM' },
          { studentId: studentAnanya.id, studentName: studentAnanya.name, status: 'PRESENT' },
          { studentId: studentVikram.id, studentName: studentVikram.name, status: 'LATE', arrivalPeriod: 'Period 2', arrivalTime: '10:05 AM' }
        ],
        reason: 'Period 4 roll verification by Class Faculty',
        notifyParents: false
      })
    });

    assert.strictEqual(batchRes.status, 200, 'Batch re-attendance returns 200');
    assert.strictEqual(batchRes.data.success, true, 'Batch re-attendance succeeded');
    assert.strictEqual(batchRes.data.leftEarly, 1, '1 left early preserved in batch');
    assert.strictEqual(batchRes.data.late, 1, '1 late preserved in batch');
    assert.strictEqual(batchRes.data.present, 2, '2 present in school (1 regular on-time + 1 late arrival)');
    console.log('  ✔ Whole-class batch re-attendance completed and verified');

    console.log('\n========================================================================');
    console.log('🎉 ALL CROSS-TEACHER & RE-ATTENDANCE TEST SCENARIOS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  if (server) server.close();
  process.exit(1);
});
