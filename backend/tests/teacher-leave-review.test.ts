import assert from 'assert';
import http from 'http';
import app from '../src/app';

const TEST_PORT = 5022;
const BASE = `http://localhost:${TEST_PORT}/api`;

let server: http.Server;

async function apiReq(path: string, options: any = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get('content-type') || '';
  const data = await res.json().catch(() => ({}));
  return {
    status: res.status,
    contentType,
    data
  };
}

async function runTestSuite() {
  console.log('\n========================================================================');
  console.log('  TEACHER LEAVE REVIEW & OFFLINE MODE REMOVAL COMPREHENSIVE TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function report(name: string, ok: boolean, details?: string) {
    if (ok) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      if (details) console.error(`         Detail: ${details}`);
      failed++;
    }
  }

  let teacherToken = '';
  let tintTeacherToken = '';
  let studentToken = '';

  // -------------------------------------------------------------------------
  // Test 1: Teacher Login (Rahul Sharma)
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rahul@demo-school.local',
        password: 'ChangeMe123!'
      })
    });

    const ok = res.status === 200 && res.data.token && res.data.user.role === 'TEACHER';
    if (ok) teacherToken = res.data.token;
    report('1. Teacher (Rahul Sharma) successfully logs in and receives JWT token', ok);
  } catch (err: any) {
    report('1. Teacher login error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 2: TINT Teacher Login (TINT Faculty)
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'teacher@tint.edu.in',
        password: 'ChangeMe123!'
      })
    });

    const ok = res.status === 200 && res.data.token && res.data.user.role === 'TEACHER';
    if (ok) tintTeacherToken = res.data.token;
    report('2. TINT Teacher successfully logs in and receives JWT token', ok);
  } catch (err: any) {
    report('2. TINT Teacher login error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 3: Student Login (Rohan Sharma)
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        admissionNumber: 'ADM-2026-001',
        password: 'ChangeMe123!'
      })
    });

    const ok = res.status === 200 && res.data.token && res.data.user.role === 'STUDENT';
    if (ok) studentToken = res.data.token;
    report('3. Student (Rohan Sharma) logs in via Admission No.', ok);
  } catch (err: any) {
    report('3. Student login error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 4: Teacher accesses GET /api/reviews/leaves
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/reviews/leaves', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });

    const ok = res.status === 200 && res.data.success === true && Array.isArray(res.data.data) && res.data.counts !== undefined;
    report('4. Teacher accesses GET /api/reviews/leaves and receives structured review list & counts', ok);
  } catch (err: any) {
    report('4. Teacher review access error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 5: Student submits a leave application
  // -------------------------------------------------------------------------
  let createdLeaveId = '';
  try {
    const res = await apiReq('/reviews/leaves', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        reason: 'Attending regional mathematics competition'
      })
    });

    const ok = res.status === 201 && res.data.success === true && res.data.data?.id;
    if (ok) createdLeaveId = res.data.data.id;
    report('5. Student submits a leave request successfully', ok);
  } catch (err: any) {
    report('5. Student submit leave error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 6: Teacher views the submitted leave application in pending list
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/reviews/leaves?status=PENDING', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });

    const found = res.data.data?.some((l: any) => l.id === createdLeaveId && l.status === 'PENDING');
    report('6. Teacher views the pending leave application in their Leave Review queue', Boolean(found));
  } catch (err: any) {
    report('6. Teacher view pending error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 7: Teacher approves the leave application with teacher contextual note
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq(`/reviews/leaves/${createdLeaveId}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({})
    });

    const ok = res.status === 200 && res.data.success === true &&
      res.data.data?.status === 'APPROVED' &&
      res.data.data?.review_notes?.includes('Class Teacher');
    report('7. Teacher approves leave request with "Approved by Class Teacher" audit note', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('7. Teacher approve leave error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 8: Student submits a second leave request
  // -------------------------------------------------------------------------
  let secondLeaveId = '';
  try {
    const res = await apiReq('/reviews/leaves', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        reason: 'Personal family travel'
      })
    });

    const ok = res.status === 201 && res.data.success === true && res.data.data?.id;
    if (ok) secondLeaveId = res.data.data.id;
    report('8. Student submits a second leave request for rejection verification', ok);
  } catch (err: any) {
    report('8. Second leave request error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 9: Teacher declines the leave application
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq(`/reviews/leaves/${secondLeaveId}/reject`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        reason: 'Exam period scheduled on those dates. Leave cannot be granted.'
      })
    });

    const ok = res.status === 200 && res.data.success === true &&
      res.data.data?.status === 'REJECTED' &&
      res.data.data?.review_notes?.includes('Exam period');
    report('9. Teacher declines leave request with custom rejection reason', ok);
  } catch (err: any) {
    report('9. Teacher reject leave error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 10: Multi-tenant Isolation - TINT Teacher cannot view Greenwood leaves
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/reviews/leaves', {
      headers: { Authorization: `Bearer ${tintTeacherToken}` }
    });

    const hasGreenwood = res.data.data?.some((l: any) => l.id === createdLeaveId || l.id === secondLeaveId);
    report('10. Multi-tenant isolation: TINT Teacher CANNOT see Greenwood leave requests', !hasGreenwood && res.status === 200);
  } catch (err: any) {
    report('10. Isolation check error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 11: Multi-tenant Isolation - TINT Teacher cannot approve Greenwood leave
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq(`/reviews/leaves/${secondLeaveId}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tintTeacherToken}` },
      body: JSON.stringify({})
    });

    const blocked = res.status === 404 || res.data?.success === false;
    report('11. Multi-tenant isolation: Cross-school leave approval is strictly blocked (404 Not Found)', blocked);
  } catch (err: any) {
    report('11. Cross-school approval test error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 12: Notification Endpoint reflects pending review counts for Teacher
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/reviews/notifications', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });

    const ok = res.status === 200 && res.data.success === true && res.data.pendingPhotosCount === 0;
    report('12. Review notifications endpoint (/api/reviews/notifications) serves Teacher portal without admin photos', ok);
  } catch (err: any) {
    report('12. Review notifications error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 13: Student submits leave and Teacher Bell notification shows Leave Request
  // -------------------------------------------------------------------------
  try {
    // Submit a fresh leave request
    const postRes = await apiReq('/reviews/leaves', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        startDate: '2026-10-15',
        endDate: '2026-10-18',
        reason: 'National Science Olympiad competition'
      })
    });

    const notifRes = await apiReq('/reviews/notifications', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });

    const leaveNotif = notifRes.data.notifications?.find((n: any) => n.type === 'LEAVE_REQUEST');
    const ok = notifRes.status === 200 &&
      notifRes.data.pendingLeavesCount > 0 &&
      leaveNotif &&
      leaveNotif.link === '/leave-applications' &&
      leaveNotif.message?.includes('leave application');

    report('13. Student leave application appears in Teacher Bell notification with link to /leave-applications', Boolean(ok));
  } catch (err: any) {
    report('13. Teacher bell notification error', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 14: School Admin does NOT receive leave notifications in their Bell icon
  // -------------------------------------------------------------------------
  try {
    const adminLoginRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@demo-school.local',
        password: 'ChangeMe123!'
      })
    });
    const adminToken = adminLoginRes.data.token;

    const adminNotifRes = await apiReq('/reviews/notifications', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const hasLeaveNotifs = adminNotifRes.data.notifications?.some((n: any) => n.type === 'LEAVE_REQUEST');
    const ok = adminNotifRes.status === 200 &&
      adminNotifRes.data.pendingLeavesCount === 0 &&
      !hasLeaveNotifs;

    report('14. Leave applications are REMOVED from School Admin bell icon (pendingLeavesCount = 0, no leave notifications)', Boolean(ok));
  } catch (err: any) {
    report('14. Admin leave exclusion check error', false, err.message);
  }

  // 15. Student submits leave request & Teacher clicks "View", marking it as SEEN
  let seenLeaveId = '';
  try {
    const studentSubmit = await apiReq('/student/leave-requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        reason: 'Attending Science Exhibition Competition'
      })
    });
    seenLeaveId = studentSubmit.data?.data?.id || studentSubmit.data?.id;

    const teacherSeenRes = await apiReq(`/reviews/leaves/${seenLeaveId}/seen`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` }
    });

    const isSeenOk = teacherSeenRes.status === 200 &&
      teacherSeenRes.data?.success === true &&
      teacherSeenRes.data?.data?.status === 'SEEN';

    report('15. Teacher clicks "View", successfully marking leave status as SEEN', Boolean(isSeenOk));
  } catch (err: any) {
    report('15. Teacher view mark seen check error', false, err.message);
  }

  // 16. Student portal retrieves leave request showing status as SEEN, and reviews list includes seen count
  try {
    const studentLeavesRes = await apiReq('/student/leave-requests', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });

    const seenItem = studentLeavesRes.data?.find((l: any) => l.id === seenLeaveId);
    const isStudentSeen = seenItem && seenItem.status === 'SEEN';

    const teacherLeavesRes = await apiReq('/reviews/leaves', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    const hasSeenCount = typeof teacherLeavesRes.data?.counts?.seen === 'number' && teacherLeavesRes.data.counts.seen >= 1;

    report('16. Student portal leave request status is SEEN and Teacher review counts include seen count', Boolean(isStudentSeen && hasSeenCount));
  } catch (err: any) {
    report('16. Student seen status verification error', false, err.message);
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('------------------------------------------------------------------------\n');

  return failed === 0;
}

async function main() {
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(TEST_PORT, () => resolve()));
  console.log(`[Test Server] Running on http://localhost:${TEST_PORT}`);

  try {
    const success = await runTestSuite();
    server.close();
    process.exit(success ? 0 : 1);
  } catch (e) {
    console.error('Fatal test runner error:', e);
    server.close();
    process.exit(1);
  }
}

main();
