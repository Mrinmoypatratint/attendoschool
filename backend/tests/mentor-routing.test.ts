import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { pool, isPostgresConfigured } from '../src/db';
import { env } from '../src/config/env';

const TEST_PORT = 5026;
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

function makeToken(user: { id: string; schoolId: string; name: string; email: string; role: string }) {
  return jwt.sign(user, env.jwtSecret, { expiresIn: '2h' });
}

async function runTestSuite() {
  console.log('\n========================================================================');
  console.log('  ATTENDOSCHOOL — CLASS-SECTION MENTOR ROUTING COMPREHENSIVE TEST SUITE');
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

  if (!isPostgresConfigured) {
    console.error('PostgreSQL is required to run mentor routing tests.');
    process.exit(1);
  }

  // Generate unique test IDs for isolation
  const ts = Date.now();
  const school1Id = '00000000-0000-4000-a000-000000000001';
  const school2Id = '00000000-0000-4000-a000-000000000002';

  const classId = '00000000-0000-4000-a000-000000000010';
  const classSch2Id = '00000000-0000-4000-a000-000000000012';
  const secAId = '00000000-0000-4000-a000-000000000021';
  const secBId = '00000000-0000-4000-a000-000000000022';
  const secSch2Id = '00000000-0000-4000-a000-000000000023';

  const teacherAId = '00000000-0000-4000-a000-000000000101'; // Mentor Class 3-A (Debashis)
  const teacherBId = '00000000-0000-4000-a000-000000000102'; // Mentor Class 3-B (Orub)
  const teacherCId = '00000000-0000-4000-a000-000000000103'; // Non-mentor Teacher
  const teacherStaffId = '00000000-0000-4000-a000-000000000104'; // Teacher for staff photo
  const adminId = '00000000-0000-4000-a000-000000000100';    // School Admin

  const studentAId = '00000000-0000-4000-a000-000000000201'; // Student in Class 3-A
  const studentBId = '00000000-0000-4000-a000-000000000202'; // Student in Class 3-B

  const teacherSch2Id = '00000000-0000-4000-a000-000000000301'; // Teacher in School 2
  const studentSch2Id = '00000000-0000-4000-a000-000000000302'; // Student in School 2

  const mentorRecAId = '00000000-0000-4000-a000-000000000401';
  const mentorRecBId = '00000000-0000-4000-a000-000000000402';

  const leaveAId = '00000000-0000-4000-a000-000000000501';
  const leaveBId = '00000000-0000-4000-a000-000000000502';
  const leaveSch2Id = '00000000-0000-4000-a000-000000000503';

  const photoAId = '00000000-0000-4000-a000-000000000601';
  const photoBId = '00000000-0000-4000-a000-000000000602';
  const photoTeacherId = '00000000-0000-4000-a000-000000000603';
  const photoSch2Id = '00000000-0000-4000-a000-000000000604';

  const tokenTeacherA = makeToken({ id: teacherAId, schoolId: school1Id, name: 'Debashis Das', email: 'debashis@test.local', role: 'TEACHER' });
  const tokenTeacherB = makeToken({ id: teacherBId, schoolId: school1Id, name: 'Orub Sarkhel', email: 'orub@test.local', role: 'TEACHER' });
  const tokenTeacherC = makeToken({ id: teacherCId, schoolId: school1Id, name: 'Non Mentor', email: 'nonmentor@test.local', role: 'TEACHER' });
  const tokenAdmin = makeToken({ id: adminId, schoolId: school1Id, name: 'Principal Admin', email: 'admin@test.local', role: 'SCHOOL_ADMIN' });
  const tokenTeacherSch2 = makeToken({ id: teacherSch2Id, schoolId: school2Id, name: 'Other School Teacher', email: 'other@test.local', role: 'TEACHER' });

  async function cleanup() {
    try {
      await pool.query(`DELETE FROM photo_approval_requests WHERE id IN ($1, $2, $3, $4)`, [photoAId, photoBId, photoTeacherId, photoSch2Id]);
      await pool.query(`DELETE FROM student_leave_requests WHERE id IN ($1, $2, $3)`, [leaveAId, leaveBId, leaveSch2Id]);
      await pool.query(`DELETE FROM class_mentors WHERE id IN ($1, $2)`, [mentorRecAId, mentorRecBId]);
      await pool.query(`DELETE FROM students WHERE id IN ($1, $2, $3)`, [studentAId, studentBId, studentSch2Id]);
      await pool.query(`DELETE FROM sections WHERE id IN ($1, $2, $3)`, [secAId, secBId, secSch2Id]);
      await pool.query(`DELETE FROM classes WHERE id IN ($1, $2)`, [classId, classSch2Id]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5, $6)`, [teacherAId, teacherBId, teacherCId, teacherStaffId, adminId, teacherSch2Id]);
      await pool.query(`DELETE FROM schools WHERE id IN ($1, $2)`, [school1Id, school2Id]);
    } catch (e: any) {
      console.warn('Cleanup warning:', e.message);
    }
  }

  try {
    // 1. Initial cleanup in case of previous run
    await cleanup();

    // 2. Insert isolated test fixtures
    await pool.query(`
      INSERT INTO schools (id, name, code)
      VALUES 
        ($1, 'Test Academy Alpha', 'ALPHA'),
        ($2, 'Test Academy Beta', 'BETA')
      ON CONFLICT (id) DO NOTHING
    `, [school1Id, school2Id]);

    await pool.query(`
      INSERT INTO users (id, school_id, name, email, role, password_hash)
      VALUES
        ($1, $7, 'Principal Admin', 'admin@test.local', 'SCHOOL_ADMIN', 'dummy'),
        ($2, $7, 'Debashis Das', 'debashis@test.local', 'TEACHER', 'dummy'),
        ($3, $7, 'Orub Sarkhel', 'orub@test.local', 'TEACHER', 'dummy'),
        ($4, $7, 'Non Mentor', 'nonmentor@test.local', 'TEACHER', 'dummy'),
        ($5, $7, 'Staff Teacher', 'staff@test.local', 'TEACHER', 'dummy'),
        ($6, $8, 'Other School Teacher', 'other@test.local', 'TEACHER', 'dummy')
      ON CONFLICT (id) DO NOTHING
    `, [adminId, teacherAId, teacherBId, teacherCId, teacherStaffId, teacherSch2Id, school1Id, school2Id]);

    await pool.query(`
      INSERT INTO classes (id, school_id, class_number)
      VALUES 
        ($1, $2, 3),
        ($3, $4, 4)
      ON CONFLICT (id) DO NOTHING
    `, [classId, school1Id, classSch2Id, school2Id]);

    await pool.query(`
      INSERT INTO sections (id, school_id, class_id, name)
      VALUES 
        ($1, $3, $4, 'A'),
        ($2, $3, $4, 'B'),
        ($5, $6, $7, 'A')
      ON CONFLICT (id) DO NOTHING
    `, [secAId, secBId, school1Id, classId, secSch2Id, school2Id, classSch2Id]);

    await pool.query(`
      INSERT INTO class_mentors (id, school_id, class_id, section_id, teacher_id)
      VALUES
        ($1, $5, $3, $4, $6),
        ($2, $5, $3, $7, $8)
      ON CONFLICT (id) DO NOTHING
    `, [mentorRecAId, mentorRecBId, classId, secAId, school1Id, teacherAId, secBId, teacherBId]);

    await pool.query(`
      INSERT INTO students (id, school_id, class_id, section_id, name, admission_number, roll_number, parent_sms_number)
      VALUES
        ($1, $3, $4, $5, 'Student Alice (3-A)', 'ADM-3A-01', '1', '+919876543210'),
        ($2, $3, $4, $6, 'Student Bob (3-B)', 'ADM-3B-01', '2', '+919876543211')
      ON CONFLICT (id) DO NOTHING
    `, [studentAId, studentBId, school1Id, classId, secAId, secBId]);

    await pool.query(`
      INSERT INTO students (id, school_id, class_id, section_id, name, admission_number, roll_number, parent_sms_number)
      VALUES ($1, $2, $3, $4, 'Student Beta', 'ADM-BETA-01', '1', '+919876543212')
      ON CONFLICT (id) DO NOTHING
    `, [studentSch2Id, school2Id, classSch2Id, secSch2Id]);

    await pool.query(`
      INSERT INTO student_leave_requests (id, school_id, student_id, start_date, end_date, reason, status)
      VALUES
        ($1, $4, $5, '2026-11-01', '2026-11-03', 'Fever and medical rest', 'PENDING'),
        ($2, $4, $6, '2026-11-04', '2026-11-05', 'Family function', 'PENDING'),
        ($3, $7, $8, '2026-11-01', '2026-11-02', 'Cross-school event', 'PENDING')
      ON CONFLICT (id) DO NOTHING
    `, [leaveAId, leaveBId, leaveSch2Id, school1Id, studentAId, studentBId, school2Id, studentSch2Id]);

    await pool.query(`
      INSERT INTO photo_approval_requests (id, school_id, applicant_type, applicant_id, applicant_name, photo_url, status)
      VALUES
        ($1, $5, 'STUDENT', $6, 'Student Alice (3-A)', 'https://example.com/alice.jpg', 'PENDING'),
        ($2, $5, 'STUDENT', $7, 'Student Bob (3-B)', 'https://example.com/bob.jpg', 'PENDING'),
        ($3, $5, 'TEACHER', $8, 'Staff Teacher', 'https://example.com/staff.jpg', 'PENDING'),
        ($4, $9, 'STUDENT', $10, 'Student Beta', 'https://example.com/beta.jpg', 'PENDING')
      ON CONFLICT (id) DO NOTHING
    `, [photoAId, photoBId, photoTeacherId, photoSch2Id, school1Id, studentAId, studentBId, teacherStaffId, school2Id, studentSch2Id]);

    // Start Test Server
    server = app.listen(TEST_PORT);
    await new Promise(r => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // Test 1: Section A mentor sees Section A leave requests but not Section B
    // -------------------------------------------------------------------------
    try {
      const res = await apiReq('/reviews/leaves', {
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });
      const ids = (res.data.data || []).map((x: any) => x.id);
      const ok = res.status === 200 && ids.includes(leaveAId) && !ids.includes(leaveBId) && res.data.counts?.pending === 1;
      report('1. Section A mentor (Debashis) sees Section A leave requests but NOT Section B requests', ok, JSON.stringify(res.data.counts));
    } catch (err: any) {
      report('1. Section A mentor leave listing', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 2: Section B mentor sees Section B leave requests but not Section A
    // -------------------------------------------------------------------------
    try {
      const res = await apiReq('/reviews/leaves', {
        headers: { Authorization: `Bearer ${tokenTeacherB}` }
      });
      const ids = (res.data.data || []).map((x: any) => x.id);
      const ok = res.status === 200 && ids.includes(leaveBId) && !ids.includes(leaveAId) && res.data.counts?.pending === 1;
      report('2. Section B mentor (Orub) sees Section B leave requests but NOT Section A requests', ok, JSON.stringify(res.data.counts));
    } catch (err: any) {
      report('2. Section B mentor leave listing', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 3: Non-mentor teacher sees no mentor-only leave or photo requests
    // -------------------------------------------------------------------------
    try {
      const resLeaves = await apiReq('/reviews/leaves', {
        headers: { Authorization: `Bearer ${tokenTeacherC}` }
      });
      const resPhotos = await apiReq('/reviews/photos', {
        headers: { Authorization: `Bearer ${tokenTeacherC}` }
      });
      const ok = resLeaves.status === 200 && resLeaves.data.data?.length === 0 && resLeaves.data.counts?.all === 0 &&
                 resPhotos.status === 200 && resPhotos.data.data?.length === 0 && resPhotos.data.counts?.all === 0;
      report('3. Non-mentor teacher sees empty queue and 0 counts for leaves and photos', ok);
    } catch (err: any) {
      report('3. Non-mentor teacher queue', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 4: Mentor CANNOT approve, reject, or mark another section's leave as seen
    // -------------------------------------------------------------------------
    try {
      const resApprove = await apiReq(`/reviews/leaves/${leaveBId}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenTeacherA}` },
        body: JSON.stringify({ notes: 'Attempting cross-mentor approval' })
      });
      const resReject = await apiReq(`/reviews/leaves/${leaveBId}/reject`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenTeacherA}` },
        body: JSON.stringify({ reason: 'Attempting cross-mentor rejection' })
      });
      const resSeen = await apiReq(`/reviews/leaves/${leaveBId}/seen`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });

      const dbCheck = await pool.query('SELECT status FROM student_leave_requests WHERE id = $1', [leaveBId]);
      const statusUnchanged = dbCheck.rows[0]?.status === 'PENDING';

      const ok = resApprove.status === 403 && resReject.status === 403 && resSeen.status === 403 && statusUnchanged;
      report('4. Cross-mentor leave mutations (approve, reject, seen) are strictly blocked with HTTP 403', ok,
        `approve: ${resApprove.status}, reject: ${resReject.status}, seen: ${resSeen.status}, dbStatus: ${dbCheck.rows[0]?.status}`);
    } catch (err: any) {
      report('4. Cross-mentor leave mutations', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 5: mark-all-seen changes only requests in that mentor's sections
    // -------------------------------------------------------------------------
    try {
      const resMark = await apiReq('/reviews/leaves/mark-all-seen', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });

      const checkA = await pool.query('SELECT status, reviewed_by FROM student_leave_requests WHERE id = $1', [leaveAId]);
      const checkB = await pool.query('SELECT status, reviewed_by FROM student_leave_requests WHERE id = $1', [leaveBId]);

      const ok = resMark.status === 200 &&
                 checkA.rows[0]?.status === 'SEEN' && checkA.rows[0]?.reviewed_by === teacherAId &&
                 checkB.rows[0]?.status === 'PENDING' && checkB.rows[0]?.reviewed_by === null;

      report('5. mark-all-seen marks Section A as SEEN while leaving Section B PENDING', ok,
        `Section A status: ${checkA.rows[0]?.status}, Section B status: ${checkB.rows[0]?.status}`);
    } catch (err: any) {
      report('5. mark-all-seen mentor isolation', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 6: Section A mentor sees only Section A student-photo requests
    // -------------------------------------------------------------------------
    try {
      const res = await apiReq('/reviews/photos', {
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });
      const ids = (res.data.data || []).map((x: any) => x.id);
      const ok = res.status === 200 && ids.includes(photoAId) && !ids.includes(photoBId) && !ids.includes(photoTeacherId) && res.data.counts?.all === 1;
      report('6. Section A mentor sees only Section A student photo (no Section B or staff photos)', ok, JSON.stringify(res.data.counts));
    } catch (err: any) {
      report('6. Section A photo query', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 7: Teachers cannot view or mutate teacher profile-photo requests
    // -------------------------------------------------------------------------
    try {
      const resQuery = await apiReq('/reviews/photos?role=TEACHER', {
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });
      const resApprove = await apiReq(`/reviews/photos/${photoTeacherId}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });
      const resReject = await apiReq(`/reviews/photos/${photoTeacherId}/reject`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });

      const dbCheck = await pool.query('SELECT status FROM photo_approval_requests WHERE id = $1', [photoTeacherId]);
      const ok = resQuery.status === 200 && resQuery.data.data?.length === 0 &&
                 resApprove.status === 403 && resReject.status === 403 && dbCheck.rows[0]?.status === 'PENDING';

      report('7. Teachers cannot query or mutate staff profile photo requests (blocked with HTTP 403)', ok);
    } catch (err: any) {
      report('7. Teacher staff photo restriction', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 8: Cross-mentor photo approval/rejection returns 403; authorized mentor succeeds
    // -------------------------------------------------------------------------
    try {
      // Teacher A attempts to approve or reject Section B photo
      const resCrossApprove = await apiReq(`/reviews/photos/${photoBId}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });
      const resCrossReject = await apiReq(`/reviews/photos/${photoBId}/reject`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });

      // Authorized Teacher B approves Section B photo
      const resAuthApprove = await apiReq(`/reviews/photos/${photoBId}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenTeacherB}` }
      });

      const dbCheck = await pool.query('SELECT status, reviewed_by FROM photo_approval_requests WHERE id = $1', [photoBId]);
      const ok = resCrossApprove.status === 403 && resCrossReject.status === 403 &&
                 resAuthApprove.status === 200 && dbCheck.rows[0]?.status === 'APPROVED' && dbCheck.rows[0]?.reviewed_by === teacherBId;

      report('8. Cross-mentor photo approval/rejection returns 403; assigned mentor approves with 200', ok);
    } catch (err: any) {
      report('8. Photo approval authorization', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 9: Notification previews and counts match the authenticated mentor's scope
    // -------------------------------------------------------------------------
    try {
      const resA = await apiReq('/reviews/notifications', {
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });
      const notifsA = resA.data.notifications || [];
      const hasPhotoA = notifsA.some((n: any) => n.rawId === photoAId);
      const hasPhotoB = notifsA.some((n: any) => n.rawId === photoBId);
      const hasLeaveB = notifsA.some((n: any) => n.rawId === leaveBId);

      const ok = resA.status === 200 &&
                 resA.data.pendingPhotosCount === 1 &&
                 resA.data.pendingTeacherLeavesCount === 0 &&
                 hasPhotoA && !hasPhotoB && !hasLeaveB;

      report('9. Notification center previews and counts match only Section A for Teacher A', ok,
        `photos: ${resA.data.pendingPhotosCount}, leaves: ${resA.data.pendingLeavesCount}`);
    } catch (err: any) {
      report('9. Notification center scoping', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 10: School administrators retain school-wide supervisory access
    // -------------------------------------------------------------------------
    try {
      const resLeaves = await apiReq('/reviews/leaves', {
        headers: { Authorization: `Bearer ${tokenAdmin}` }
      });
      const resPhotos = await apiReq('/reviews/photos', {
        headers: { Authorization: `Bearer ${tokenAdmin}` }
      });

      const leaveIds = (resLeaves.data.data || []).map((x: any) => x.id);
      const photoIds = (resPhotos.data.data || []).map((x: any) => x.id);

      const seesAllLeaves = leaveIds.includes(leaveAId) && leaveIds.includes(leaveBId);
      const seesAllPhotos = photoIds.includes(photoAId) && photoIds.includes(photoBId) && photoIds.includes(photoTeacherId);

      const ok = resLeaves.status === 200 && resPhotos.status === 200 && seesAllLeaves && seesAllPhotos;
      report('10. School Admin retains complete school-wide supervisory access to all leaves & photos', ok);
    } catch (err: any) {
      report('10. School Admin supervisory access', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 11: Dynamic assignment updates immediately transfer access
    // -------------------------------------------------------------------------
    try {
      // Re-create a fresh pending leave for Student B
      const dynamicLeaveId = '00000000-0000-4000-a000-000000000599';
      await pool.query(`
        INSERT INTO student_leave_requests (id, school_id, student_id, start_date, end_date, reason, status)
        VALUES ($1, $2, $3, '2026-11-10', '2026-11-12', 'Transfer test', 'PENDING')
      `, [dynamicLeaveId, school1Id, studentBId]);

      // Initially, Teacher B sees dynamicLeaveId, Teacher A does not
      const preA = await apiReq('/reviews/leaves', { headers: { Authorization: `Bearer ${tokenTeacherA}` } });
      const preB = await apiReq('/reviews/leaves', { headers: { Authorization: `Bearer ${tokenTeacherB}` } });
      const preOk = !preA.data.data?.some((x: any) => x.id === dynamicLeaveId) &&
                     preB.data.data?.some((x: any) => x.id === dynamicLeaveId);

      // Dynamically transfer Student B from Section B to Section A
      await pool.query('UPDATE students SET section_id = $1 WHERE id = $2', [secAId, studentBId]);

      // Now, Teacher A should see dynamicLeaveId, Teacher B should not
      const postA = await apiReq('/reviews/leaves', { headers: { Authorization: `Bearer ${tokenTeacherA}` } });
      const postB = await apiReq('/reviews/leaves', { headers: { Authorization: `Bearer ${tokenTeacherB}` } });
      const postOk = postA.data.data?.some((x: any) => x.id === dynamicLeaveId) &&
                    !postB.data.data?.some((x: any) => x.id === dynamicLeaveId);

      // Cleanup dynamic record
      await pool.query('DELETE FROM student_leave_requests WHERE id = $1', [dynamicLeaveId]);

      report('11. Dynamic Section transfer immediately transfers pending leave to new Section mentor', preOk && postOk);
    } catch (err: any) {
      report('11. Dynamic assignment transfer', false, err.message);
    }

    // -------------------------------------------------------------------------
    // Test 12: Cross-school requests remain strictly isolated
    // -------------------------------------------------------------------------
    try {
      // Teacher A in School 1 attempts to query or approve School 2 leave
      const resCrossMutate = await apiReq(`/reviews/leaves/${leaveSch2Id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });
      const resCrossList = await apiReq('/reviews/leaves', {
        headers: { Authorization: `Bearer ${tokenTeacherA}` }
      });
      const hasSch2 = resCrossList.data.data?.some((x: any) => x.id === leaveSch2Id);

      const ok = (resCrossMutate.status === 404 || resCrossMutate.status === 403) && !hasSch2;
      report('12. Cross-school isolation: requests from other institutions are strictly inaccessible', ok,
        `status: ${resCrossMutate.status}, visible: ${hasSch2}`);
    } catch (err: any) {
      report('12. Cross-school isolation', false, err.message);
    }

  } catch (err: any) {
    console.error('Fatal test runner error:', err);
  } finally {
    console.log('\nCleaning up test database fixtures...');
    await cleanup();
    if (server) {
      server.close();
    }
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(`  MENTOR ROUTING SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('------------------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Unexpected error in test runner:', err);
  process.exit(1);
});
