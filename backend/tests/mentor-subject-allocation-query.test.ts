process.env.NODE_ENV = 'test';
process.env.SKIP_SMTP_SYNC = 'true';

import { pool, isPostgresConfigured } from '../src/db';
import * as mentorSvc from '../src/services/mentorService';
import { isGreenwoodSchool, isTintSchool } from '../src/utils/tenant';

async function runMentorAllocationTests() {
  console.log('=== STARTING CLASS MENTOR SUBJECT ALLOCATION QUERY TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string) {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title}`);
      failed++;
    }
  }

  // TEST 1: Live Greenwood Class 3-A Read-Only Allocation Verification
  if (isPostgresConfigured) {
    try {
      const greenwoodSchoolId = '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3';
      const debashisMentorId = 'c3737d42-6f11-4f08-9001-8e052722cc54';
      const class3Id = 'cbf6618f-7da2-4620-9b87-03501011ede8';
      const secAId = '379c7e43-1d39-4312-a766-1f1128a70e21';

      const permsList = await mentorSvc.getMentorPermissionsList(
        greenwoodSchoolId,
        debashisMentorId,
        class3Id,
        secAId
      );

      assert(Array.isArray(permsList) && permsList.length > 0, `Class 3-A returns subject allocations (found: ${permsList.length})`);

      // Verify Mathematics Primary Teacher (Arnab Sarkhel)
      const mathPrim = permsList.find(p => p.subject_name.toLowerCase().includes('math') && p.is_primary);
      assert(!!mathPrim && mathPrim.teacher_name.includes('Arnab'), 'Class 3-A Math has primary teacher Arnab Sarkhel');
      assert(mathPrim?.is_alternate === false, 'Math primary teacher has is_alternate = false');
      assert(mathPrim?.is_authorized === false, 'Math primary teacher is initially unauthorized');

      // Verify Mathematics Alternate Teacher (Debashis Das)
      const mathAlt = permsList.find(p => p.subject_name.toLowerCase().includes('math') && p.is_alternate);
      assert(!!mathAlt && mathAlt.teacher_name.includes('Debashis'), 'Class 3-A Math has alternate teacher Debashis Das');
      assert(mathAlt?.is_primary === false, 'Math alternate teacher has is_primary = false');
      assert(mathAlt?.is_authorized === false, 'Math alternate teacher is strictly unauthorized');

      // Verify English Primary Teacher (Debashis Das)
      const engPrim = permsList.find(p => p.subject_name.toLowerCase().includes('eng') && p.is_primary);
      assert(!!engPrim && engPrim.teacher_name.includes('Debashis'), 'Class 3-A English has primary teacher Debashis Das');
      assert(engPrim?.is_alternate === false, 'English primary teacher has is_alternate = false');
      assert(engPrim?.is_authorized === false, 'English primary teacher is initially unauthorized');
    } catch (err: any) {
      assert(false, `Greenwood Class 3-A verification error: ${err.message}`);
    }
  }

  // TEST 2: Dedicated Isolated Test Tenant (Deduplication, Multi-Subject, Permissions Persistence)
  const isoSchoolId = '88888888-8888-4888-8888-888888888888';
  if (isGreenwoodSchool(isoSchoolId) || isTintSchool(isoSchoolId)) {
    throw new Error('FATAL: Test cannot use Greenwood or TINT tenant ID.');
  }

  const isoClassId = '88888888-8888-4888-8888-000000000010';
  const isoSectionId = '88888888-8888-4888-8888-000000000020';
  const subPhysicsId = '88888888-8888-4888-8888-000000000031';
  const subChemistryId = '88888888-8888-4888-8888-000000000032';
  const isoMentorId = '88888888-8888-4888-8888-000000000101';
  const teacherAlphaId = '88888888-8888-4888-8888-000000000102';
  const teacherBetaId = '88888888-8888-4888-8888-000000000103';

  if (isPostgresConfigured) {
    try {
      // Safe targeted cleanup of isolated tenant only
      await pool.query(`DELETE FROM teacher_assignment_permissions WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM timetable_entries WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM timetable_periods WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM class_mentors WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM subjects WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM sections WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM classes WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM users WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM schools WHERE id = $1`, [isoSchoolId]);

      // Seed test tenant entities
      await pool.query(`INSERT INTO schools (id, name, code) VALUES ($1, 'Allocation Query Test School', 'AQ_TEST') ON CONFLICT (id) DO NOTHING`, [isoSchoolId]);
      await pool.query(`INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 8) ON CONFLICT (id) DO NOTHING`, [isoClassId, isoSchoolId]);
      await pool.query(`INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, 'B') ON CONFLICT (id) DO NOTHING`, [isoSectionId, isoSchoolId, isoClassId]);
      await pool.query(`INSERT INTO subjects (id, school_id, name) VALUES ($1, $2, 'Physics') ON CONFLICT (id) DO NOTHING`, [subPhysicsId, isoSchoolId]);
      await pool.query(`INSERT INTO subjects (id, school_id, name) VALUES ($1, $2, 'Chemistry') ON CONFLICT (id) DO NOTHING`, [subChemistryId, isoSchoolId]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Mentor Iso', 'mentor-iso@test.local', 'h', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [isoMentorId, isoSchoolId]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Teacher Alpha', 'alpha@test.local', 'h', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [teacherAlphaId, isoSchoolId]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Teacher Beta', 'beta@test.local', 'h', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [teacherBetaId, isoSchoolId]);

      // Seed period
      const isoPeriodRes = await pool.query(`
        INSERT INTO timetable_periods (school_id, name, period_number, start_time, end_time, is_break)
        VALUES ($1, 'Period 1', 1, '09:00', '10:00', false)
        RETURNING id
      `, [isoSchoolId]);
      const isoPeriodId = isoPeriodRes.rows[0].id;

      // Assign mentor
      await mentorSvc.assignClassMentor(isoSchoolId, isoClassId, isoSectionId, isoMentorId);

      // Seed DUPLICATE timetable entries across multiple periods/days to test deduplication
      // Entry 1: Physics, Monday, Period 1 (Alpha Primary, Beta Substitute)
      await pool.query(`
        INSERT INTO timetable_entries (school_id, class_id, section_id, subject_id, teacher_id, substitute_teacher_id, period_id, day_of_week, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'PUBLISHED')
      `, [isoSchoolId, isoClassId, isoSectionId, subPhysicsId, teacherAlphaId, teacherBetaId, isoPeriodId]);

      // Entry 2: Physics, Wednesday, Period 3 (DUPLICATE allocation slot)
      await pool.query(`
        INSERT INTO timetable_entries (school_id, class_id, section_id, subject_id, teacher_id, substitute_teacher_id, period_id, day_of_week, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 3, 'PUBLISHED')
      `, [isoSchoolId, isoClassId, isoSectionId, subPhysicsId, teacherAlphaId, teacherBetaId, isoPeriodId]);

      // Entry 3: Chemistry, Tuesday, Period 2 (Beta Primary, NO substitute)
      await pool.query(`
        INSERT INTO timetable_entries (school_id, class_id, section_id, subject_id, teacher_id, substitute_teacher_id, period_id, day_of_week, status)
        VALUES ($1, $2, $3, $4, $5, NULL, $6, 2, 'PUBLISHED')
      `, [isoSchoolId, isoClassId, isoSectionId, subChemistryId, teacherBetaId, isoPeriodId]);

      // Entry 4: Cancelled Entry (should NOT appear)
      await pool.query(`
        INSERT INTO timetable_entries (school_id, class_id, section_id, subject_id, teacher_id, substitute_teacher_id, period_id, day_of_week, status)
        VALUES ($1, $2, $3, $4, $5, NULL, $6, 5, 'CANCELLED')
      `, [isoSchoolId, isoClassId, isoSectionId, subChemistryId, teacherAlphaId, isoPeriodId]);

      // Fetch permissions list
      const isoList = await mentorSvc.getMentorPermissionsList(isoSchoolId, isoMentorId, isoClassId, isoSectionId);

      // TEST: Deduplication & Count
      // Expect 3 entries:
      // 1. Physics Primary (Alpha)
      // 2. Physics Alternate (Beta)
      // 3. Chemistry Primary (Beta)
      assert(isoList.length === 3, `Duplicate timetable slots are correctly deduplicated (expected 3, got: ${isoList.length})`);

      const physicsPrim = isoList.filter(p => p.subject_id === subPhysicsId && p.is_primary);
      assert(physicsPrim.length === 1, 'Physics primary teacher appears exactly once despite multiple timetable periods');

      const physicsAlt = isoList.filter(p => p.subject_id === subPhysicsId && p.is_alternate);
      assert(physicsAlt.length === 1, 'Physics alternate teacher appears exactly once');
      assert(physicsAlt[0].is_authorized === false, 'Alternate teacher is strictly blocked (is_authorized = false)');

      // TEST: Alternate teacher cannot be authorized
      let altAuthFailed = false;
      try {
        await mentorSvc.updateSubjectTeacherPermission(isoSchoolId, isoMentorId, isoClassId, isoSectionId, subPhysicsId, teacherBetaId, true);
      } catch (err: any) {
        if (err.code === 'ALTERNATE_TEACHER_PUBLISH_BLOCKED') {
          altAuthFailed = true;
        }
      }
      assert(altAuthFailed, 'Mentor cannot authorize alternate teacher Beta for Physics (throws ALTERNATE_TEACHER_PUBLISH_BLOCKED)');

      // TEST: Authorize Primary Teacher Alpha for Physics
      const authRes = await mentorSvc.updateSubjectTeacherPermission(isoSchoolId, isoMentorId, isoClassId, isoSectionId, subPhysicsId, teacherAlphaId, true);
      assert(authRes.success === true, 'Mentor successfully authorizes primary teacher Alpha for Physics');

      // TEST: Permissions List reflects persistence
      const isoListAfterAuth = await mentorSvc.getMentorPermissionsList(isoSchoolId, isoMentorId, isoClassId, isoSectionId);
      const physicsPrimAfter = isoListAfterAuth.find(p => p.subject_id === subPhysicsId && p.is_primary);
      assert(physicsPrimAfter?.is_authorized === true, 'getMentorPermissionsList reflects persisted authorization (is_authorized = true)');

      // TEST: Revoke Primary Teacher Alpha
      await mentorSvc.updateSubjectTeacherPermission(isoSchoolId, isoMentorId, isoClassId, isoSectionId, subPhysicsId, teacherAlphaId, false);
      const isoListAfterRevoke = await mentorSvc.getMentorPermissionsList(isoSchoolId, isoMentorId, isoClassId, isoSectionId);
      const physicsPrimRevoked = isoListAfterRevoke.find(p => p.subject_id === subPhysicsId && p.is_primary);
      assert(physicsPrimRevoked?.is_authorized === false, 'getMentorPermissionsList reflects revoked permission (is_authorized = false)');

      // Clean up isolated test tenant
      await pool.query(`DELETE FROM teacher_assignment_permissions WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM timetable_entries WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM timetable_periods WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM class_mentors WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM subjects WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM sections WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM classes WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM users WHERE school_id = $1`, [isoSchoolId]);
      await pool.query(`DELETE FROM schools WHERE id = $1`, [isoSchoolId]);
    } catch (err: any) {
      assert(false, `Isolated test tenant verification error: ${err.message}`);
    }
  }

  // TEST 3: Non-Mentor Access Denied
  try {
    let nonMentorBlocked = false;
    try {
      await mentorSvc.getMentorPermissionsList(
        '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3',
        '952ab8b4-51c7-48d5-9cda-43d3c1070fdf', // Arnab Sarkhel is NOT mentor of 3-A
        'cbf6618f-7da2-4620-9b87-03501011ede8',
        '379c7e43-1d39-4312-a766-1f1128a70e21'
      );
    } catch (err: any) {
      if (err.message.includes('not the designated Class Mentor')) {
        nonMentorBlocked = true;
      }
    }
    assert(nonMentorBlocked, 'Non-mentor teacher is rejected with Access Denied');
  } catch (err: any) {
    assert(false, `Non-mentor check error: ${err.message}`);
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runMentorAllocationTests().then(() => {
  pool.end();
}).catch(err => {
  console.error('Test runner fatal error:', err);
  pool.end();
  process.exit(1);
});
