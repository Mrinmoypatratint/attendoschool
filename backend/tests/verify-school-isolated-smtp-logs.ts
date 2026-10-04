import { pool } from '../src/db';
import app from '../src/app';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';
import crypto from 'crypto';
import http from 'http';

export async function runSchoolIsolatedSmtpLogsTest() {
  console.log('\n======================================================');
  console.log('🧪 VERIFYING SCHOOL-ISOLATED SMTP LOGS FEATURE');
  console.log('======================================================\n');

  let server: http.Server | null = null;

  try {
    const schoolA = '08c4960d-75d6-4a92-989b-48309500632e'; // ABC Public School
    const schoolB = '00000000-0000-0000-0000-000000000001'; // Greenwood International School

    // 1. Fetch real student from School A
    const stARes = await pool.query(
      `SELECT id, admission_number, name, email FROM students WHERE school_id=$1 AND admission_number IS NOT NULL LIMIT 1`,
      [schoolA]
    );
    const studentA = stARes.rows[0];
    if (!studentA) throw new Error('No test student found in School A');

    // 2. Fetch real student from School B
    const stBRes = await pool.query(
      `SELECT id, admission_number, name, email FROM students WHERE school_id=$1 AND admission_number IS NOT NULL LIMIT 1`,
      [schoolB]
    );
    const studentB = stBRes.rows[0];
    if (!studentB) throw new Error('No test student found in School B');

    console.log(`✓ Resolved School A student: ${studentA.name} | Adm: ${studentA.admission_number} | Mail: ${studentA.email}`);
    console.log(`✓ Resolved School B student: ${studentB.name} | Adm: ${studentB.admission_number} | Mail: ${studentB.email}`);

    // 3. Ensure test records exist for School A with multiple statuses
    const testCasesA = [
      { status: 'SENT', template: 'ATTENDANCE_ABSENT', subject: 'Absent Alert: Student absent' },
      { status: 'FAILED', template: 'STUDENT_CREATED', subject: 'Student Onboarding Welcome', error: 'SMTP 550 Mailbox unavailable' },
      { status: 'QUEUED', template: 'ATTENDANCE_PRESENT', subject: 'Attendance Confirmation' },
      { status: 'RETRYING', template: 'PASSWORD_RESET', subject: 'Password Reset Notification', error: 'Connection timeout' }
    ];

    let failedLogIdForRetry = '';
    for (const tc of testCasesA) {
      const id = crypto.randomUUID();
      if (tc.status === 'FAILED') failedLogIdForRetry = id;
      await pool.query(
        `INSERT INTO notification_logs(
          id, school_id, attendance_session_id, student_id, channel, recipient,
          recipient_type, template_key, subject, message, html_body, status,
          attempts, max_attempts, scheduled_at, last_error, idempotency_key, created_at
        ) VALUES($1, $2, NULL, $3, 'EMAIL', $4, 'STUDENT', $5, $6, 'Test msg', '<p>Test</p>', $7, 1, 4, NOW(), $8, $9, NOW())
        ON CONFLICT(idempotency_key) DO NOTHING`,
        [id, schoolA, studentA.id, studentA.email, tc.template, tc.subject, tc.status, tc.error || null, `e2e-http-${id}`]
      );
    }

    // Insert 1 log without student_id (faculty invitation) for School A
    const nullLogId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO notification_logs(
        id, school_id, attendance_session_id, student_id, channel, recipient,
        recipient_type, template_key, subject, message, html_body, status,
        attempts, max_attempts, scheduled_at, last_error, idempotency_key, created_at
      ) VALUES($1, $2, NULL, NULL, 'EMAIL', $3, 'TEACHER', 'TEACHER_CREATED', 'Faculty Portal Activation', 'Welcome', '<p>Welcome</p>', 'SENT', 1, 4, NOW(), NULL, $4, NOW())
      ON CONFLICT(idempotency_key) DO NOTHING`,
      [nullLogId, schoolA, 'teacher.testing@school.edu', `e2e-http-${nullLogId}`]
    );

    // Insert 1 record for School B
    const schoolBLogId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO notification_logs(
        id, school_id, attendance_session_id, student_id, channel, recipient,
        recipient_type, template_key, subject, message, html_body, status,
        attempts, max_attempts, scheduled_at, last_error, idempotency_key, created_at
      ) VALUES($1, $2, NULL, $3, 'EMAIL', $4, 'STUDENT', 'ATTENDANCE_ABSENT', 'School B Absent Alert', 'Test', '<p>Test</p>', 'SENT', 1, 4, NOW(), NULL, $5, NOW())
      ON CONFLICT(idempotency_key) DO NOTHING`,
      [schoolBLogId, schoolB, studentB.id, studentB.email, `e2e-http-${schoolBLogId}`]
    );

    // 4. Start ephemeral test server
    const port = await new Promise<number>((resolve) => {
      server = app.listen(0, () => {
        const addr = server!.address() as any;
        resolve(addr.port);
      });
    });

    const baseUrl = `http://127.0.0.1:${port}/api/notifications-v11`;

    // 5. Generate Auth Tokens
    const tokenSchoolA = jwt.sign(
      { id: 'usr-admin-a', email: 'admin@school-a.edu', role: 'SCHOOL_ADMIN', schoolId: schoolA },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
    const tokenSchoolB = jwt.sign(
      { id: 'usr-admin-b', email: 'admin@school-b.edu', role: 'SCHOOL_ADMIN', schoolId: schoolB },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
    const tokenStudent = jwt.sign(
      { id: 'usr-student', email: 'student@school-a.edu', role: 'STUDENT', schoolId: schoolA },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    // ── TEST 1: Unauthenticated request should fail with 401 ──
    const resNoAuth = await fetch(`${baseUrl}/logs`);
    if (resNoAuth.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated request, got ${resNoAuth.status}`);
    }
    console.log('✓ PASS: Unauthenticated access rejected (HTTP 401)');

    // ── TEST 2: Student role access should fail with 403 ──
    const resStudent = await fetch(`${baseUrl}/logs`, {
      headers: { Authorization: `Bearer ${tokenStudent}` }
    });
    if (resStudent.status !== 403) {
      throw new Error(`Expected 403 for student role, got ${resStudent.status}`);
    }
    console.log('✓ PASS: Unauthorized role access rejected (HTTP 403)');

    // ── TEST 3: School A Admin gets School A logs with accurate field mappings ──
    const resSchoolA = await fetch(`${baseUrl}/logs?paginate=true`, {
      headers: { Authorization: `Bearer ${tokenSchoolA}` }
    });
    if (resSchoolA.status !== 200) {
      throw new Error(`School A request failed with status ${resSchoolA.status}`);
    }
    const dataA = await resSchoolA.json();
    const logsA: any[] = dataA.logs || dataA.data || [];

    if (logsA.length === 0) {
      throw new Error('School A returned 0 logs via HTTP endpoint');
    }

    // Verify student logs display Admission No, Name, Mail ID, Status
    const studentALogs = logsA.filter((l: any) => l.student_id === studentA.id);
    for (const log of studentALogs) {
      if (!log.admission_number || log.admission_number !== studentA.admission_number) {
        throw new Error(`Expected admission_number ${studentA.admission_number}, got: "${log.admission_number}"`);
      }
      if (!log.recipient_name || log.recipient_name !== studentA.name) {
        throw new Error(`Expected recipient_name ${studentA.name}, got: "${log.recipient_name}"`);
      }
      if (!log.recipient || log.recipient !== studentA.email) {
        throw new Error(`Expected recipient ${studentA.email}, got: "${log.recipient}"`);
      }
      if (!['SENT', 'FAILED', 'QUEUED', 'PROCESSING', 'RETRYING'].includes(log.status)) {
        throw new Error(`Unexpected status: ${log.status}`);
      }
    }
    console.log(`✓ PASS: HTTP API accurately delivers Admission No. ("${studentA.admission_number}"), Name ("${studentA.name}"), Mail ID ("${studentA.email}"), and Status`);

    // ── TEST 4: Null student handling in HTTP API ──
    const nullLog = logsA.find((l: any) => l.id === nullLogId);
    if (!nullLog) throw new Error('Non-student log not found in School A results');
    if (nullLog.admission_number !== '') {
      throw new Error(`Expected empty string for missing student admission_number, got: "${nullLog.admission_number}"`);
    }
    console.log('✓ PASS: Missing student details handled gracefully in HTTP response');

    // ── TEST 5: School B Admin gets ONLY School B logs (Tenant Isolation) ──
    const resSchoolB = await fetch(`${baseUrl}/logs?paginate=true`, {
      headers: { Authorization: `Bearer ${tokenSchoolB}` }
    });
    if (resSchoolB.status !== 200) {
      throw new Error(`School B request failed with status ${resSchoolB.status}`);
    }
    const dataB = await resSchoolB.json();
    const logsB: any[] = dataB.logs || dataB.data || [];

    const leakedInB = logsB.filter((l: any) => l.school_id === schoolA);
    if (leakedInB.length > 0) {
      throw new Error(`FATAL: School B leaked ${leakedInB.length} records belonging to School A!`);
    }

    const leakedInA = logsA.filter((l: any) => l.school_id === schoolB);
    if (leakedInA.length > 0) {
      throw new Error(`FATAL: School A leaked ${leakedInA.length} records belonging to School B!`);
    }
    console.log('✓ PASS: Zero cross-school leakage verified across both tenants (HTTP 200 OK)');

    // ── TEST 6: School Admin cannot bypass isolation via query parameters ──
    const resBypassAttempt = await fetch(`${baseUrl}/logs?schoolId=${schoolB}`, {
      headers: { Authorization: `Bearer ${tokenSchoolA}` }
    });
    const bypassData = await resBypassAttempt.json();
    const bypassLogs: any[] = Array.isArray(bypassData) ? bypassData : (bypassData.logs || bypassData.data || []);
    const anyBInAttempt = bypassLogs.filter((l: any) => l.school_id === schoolB);
    if (anyBInAttempt.length > 0) {
      throw new Error('SECURITY VULNERABILITY: School Admin bypassed tenant isolation via ?schoolId parameter!');
    }
    console.log('✓ PASS: Security check passed: Tenant isolation cannot be bypassed by query parameters');

    // ── TEST 7: Filtering and Search ──
    const resSearch = await fetch(`${baseUrl}/logs?search=${encodeURIComponent(studentA.admission_number)}`, {
      headers: { Authorization: `Bearer ${tokenSchoolA}` }
    });
    const searchData = await resSearch.json();
    const searchLogs: any[] = Array.isArray(searchData) ? searchData : (searchData.logs || searchData.data || []);
    for (const l of searchLogs) {
      if (l.admission_number !== studentA.admission_number) {
        throw new Error(`Search filter failed: expected ${studentA.admission_number}, got ${l.admission_number}`);
      }
    }
    console.log(`✓ PASS: Search by Admission No. ("${studentA.admission_number}") returns strictly matched records`);

    // ── TEST 8: Retry Failed Notification ──
    if (failedLogIdForRetry) {
      const resRetry = await fetch(`${baseUrl}/logs/${failedLogIdForRetry}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenSchoolA}` }
      });
      if (resRetry.status !== 200) {
        throw new Error(`Retry request failed with status ${resRetry.status}`);
      }
      const retryResult = await resRetry.json();
      if (!retryResult.success || retryResult.log.status !== 'QUEUED') {
        throw new Error(`Retry did not transition status to QUEUED: ${JSON.stringify(retryResult)}`);
      }
      console.log('✓ PASS: Retrying failed email resets status to QUEUED for immediate dispatch');
    }

    console.log('\n🎉 ALL END-TO-END SMTP LOG FEATURE CHECKS PASSED PERFECTLY!\n');
    return true;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
  }
}

if (require.main === module) {
  runSchoolIsolatedSmtpLogsTest()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
