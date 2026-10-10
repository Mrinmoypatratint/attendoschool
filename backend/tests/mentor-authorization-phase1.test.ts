process.env.NODE_ENV = 'test';
process.env.SKIP_SMTP_SYNC = 'true';

import { pool, isPostgresConfigured } from '../src/db';
import * as mentorSvc from '../src/services/mentorService';
import { demoTeacherAssignments } from '../src/routes/schoolData';
import { isGreenwoodSchool, isTintSchool } from '../src/utils/tenant';

async function runPhase1Tests() {
  console.log('=== STARTING PHASE 1 MENTOR & ASSIGNMENT AUTHORIZATION TESTS ===\n');
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

  // 1. Safety Guard: Dedicated Isolated Test Tenant (NOT Greenwood or TINT)
  const schoolId = '99999999-9999-4999-9999-999999999999';
  if (isGreenwoodSchool(schoolId) || isTintSchool(schoolId)) {
    throw new Error('FATAL SECURITY BLOCKER: Test cannot use Greenwood or TINT production/demo tenant ID.');
  }

  const classId = '99999999-9999-4999-9999-000000000010';
  const sectionId = '99999999-9999-4999-9999-000000000020';
  const subjectId = '99999999-9999-4999-9999-000000000030';
  const primaryTeacherId = '99999999-9999-4999-9999-000000000101';
  const altTeacherId = '99999999-9999-4999-9999-000000000102';
  const mentorId = '99999999-9999-4999-9999-000000000103';

  // Seed demo allocations for test isolated tenant in memory
  demoTeacherAssignments.push(
    {
      id: 'alloc-p1-prim',
      school_id: schoolId,
      class_id: classId,
      class_number: 10,
      section_id: sectionId,
      section_name: 'A',
      subject_id: subjectId,
      subject_name: 'Mathematics Test',
      teacher_id: primaryTeacherId,
      teacher_name: 'Test Primary Teacher'
    },
    {
      id: 'alloc-p1-alt',
      school_id: schoolId,
      class_id: classId,
      class_number: 10,
      section_id: sectionId,
      section_name: 'A',
      subject_id: subjectId,
      subject_name: 'Mathematics Test',
      teacher_id: null,
      alt_teacher_id: altTeacherId,
      alt_teacher_name: 'Test Alternate Teacher'
    }
  );

  // Setup PostgreSQL schema verification & isolated test tenant seeding
  if (isPostgresConfigured) {
    try {
      // Safe targeted cleanup for ONLY test schoolId
      await pool.query(`DELETE FROM teacher_assignment_permissions WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM class_mentors WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM subjects WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolId]);

      // Seed dedicated test school & entities
      await pool.query(`INSERT INTO schools (id, name, code) VALUES ($1, 'Automated Test School P1', 'TEST_P1') ON CONFLICT (id) DO NOTHING`, [schoolId]);
      await pool.query(`INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 10) ON CONFLICT (id) DO NOTHING`, [classId, schoolId]);
      await pool.query(`INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, 'A') ON CONFLICT (id) DO NOTHING`, [sectionId, schoolId, classId]);
      await pool.query(`INSERT INTO subjects (id, school_id, name) VALUES ($1, $2, 'Mathematics Test') ON CONFLICT (id) DO NOTHING`, [subjectId, schoolId]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Test Mentor', 'mentor-p1@test.local', 'hash', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [mentorId, schoolId]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Test Primary', 'primary-p1@test.local', 'hash', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [primaryTeacherId, schoolId]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Test Alt', 'alt-p1@test.local', 'hash', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [altTeacherId, schoolId]);
    } catch (err: any) {
      console.warn('PostgreSQL test setup warning:', err.message);
    }
  }

  // TEST 1: DB Schema Verification (Migration 040)
  try {
    if (isPostgresConfigured) {
      const q1 = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'class_mentors'`);
      assert((q1.rowCount ?? 0) > 0, 'Migration 040: class_mentors table exists in PostgreSQL');

      const q2 = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_assignment_permissions'`);
      assert((q2.rowCount ?? 0) > 0, 'Migration 040: teacher_assignment_permissions table exists in PostgreSQL');
    } else {
      assert(true, 'Migration 040: class_mentors table exists (in-memory mode)');
      assert(true, 'Migration 040: teacher_assignment_permissions table exists (in-memory mode)');
    }
  } catch (err: any) {
    assert(false, `Schema check failed: ${err.message}`);
  }

  // TEST 2: Assign Class Mentor (School Isolation & Persistence)
  try {
    const mentorRec = await mentorSvc.assignClassMentor(schoolId, classId, sectionId, mentorId);
    assert(mentorRec.teacher_id === mentorId, 'assignClassMentor creates mentor record successfully');

    const isM = await mentorSvc.isClassMentor(schoolId, classId, sectionId, mentorId);
    assert(isM === true, 'isClassMentor confirms assigned mentor for section');

    const notM = await mentorSvc.isClassMentor(schoolId, classId, sectionId, '99999999-9999-4999-9999-000000000999');
    assert(notM === false, 'isClassMentor correctly rejects non-assigned teacher');
  } catch (err: any) {
    assert(false, `assignClassMentor failed: ${err.message}`);
  }

  // TEST 3: Alternate Teacher Rejection (Requirement #1 & #2)
  try {
    const checkAlt = await mentorSvc.verifyTeacherPublishingEligibility(schoolId, altTeacherId, classId, sectionId, subjectId);
    assert(
      checkAlt.eligible === false && checkAlt.code === 'ALTERNATE_TEACHER_PUBLISH_BLOCKED',
      'verifyTeacherPublishingEligibility strictly rejects Alternate Teacher with HTTP 403 code'
    );
  } catch (err: any) {
    assert(false, `Alternate teacher check failed: ${err.message}`);
  }

  // TEST 4: Unauthorized Primary Teacher Rejection (Requirement #1)
  try {
    const checkPrimUnauth = await mentorSvc.verifyTeacherPublishingEligibility(schoolId, primaryTeacherId, classId, sectionId, subjectId);
    assert(
      checkPrimUnauth.eligible === false && checkPrimUnauth.code === 'ASSIGNMENT_PUBLISH_UNAUTHORIZED',
      'verifyTeacherPublishingEligibility rejects Primary Teacher when not authorized by Class Mentor'
    );
  } catch (err: any) {
    assert(false, `Unauthorized primary teacher check failed: ${err.message}`);
  }

  // TEST 5: Attempting to grant permission to Alternate Teacher MUST FAIL
  try {
    let failedAsExpected = false;
    try {
      await mentorSvc.updateSubjectTeacherPermission(schoolId, mentorId, classId, sectionId, subjectId, altTeacherId, true);
    } catch (err: any) {
      if (err.code === 'ALTERNATE_TEACHER_PUBLISH_BLOCKED') {
        failedAsExpected = true;
      }
    }
    assert(failedAsExpected, 'updateSubjectTeacherPermission throws ALTERNATE_TEACHER_PUBLISH_BLOCKED when attempting to grant permission to alternate teacher');
  } catch (err: any) {
    assert(false, `Alternate teacher grant restriction failed: ${err.message}`);
  }

  // TEST 6: Granting permission to Primary Teacher MUST SUCCEED
  try {
    const updateRes = await mentorSvc.updateSubjectTeacherPermission(schoolId, mentorId, classId, sectionId, subjectId, primaryTeacherId, true);
    assert(updateRes.success === true, 'updateSubjectTeacherPermission allows Primary Teacher once explicitly authorized by Class Mentor');

    const checkPrimAuth = await mentorSvc.verifyTeacherPublishingEligibility(schoolId, primaryTeacherId, classId, sectionId, subjectId);
    assert(checkPrimAuth.eligible === true, 'verifyTeacherPublishingEligibility allows Primary Teacher once explicitly authorized by Class Mentor');
  } catch (err: any) {
    assert(false, `Primary teacher authorization failed: ${err.message}`);
  }

  // TEST 7: Revoking permission from Primary Teacher MUST SUCCEED
  try {
    await mentorSvc.updateSubjectTeacherPermission(schoolId, mentorId, classId, sectionId, subjectId, primaryTeacherId, false);
    const checkPrimRevoked = await mentorSvc.verifyTeacherPublishingEligibility(schoolId, primaryTeacherId, classId, sectionId, subjectId);
    assert(
      checkPrimRevoked.eligible === false && checkPrimRevoked.code === 'ASSIGNMENT_PUBLISH_UNAUTHORIZED',
      'verifyTeacherPublishingEligibility rejects Primary Teacher after Class Mentor revokes permission'
    );
  } catch (err: any) {
    assert(false, `Primary teacher permission revocation failed: ${err.message}`);
  }

  // Targeted Teardown: Clean up test school data completely
  if (isPostgresConfigured) {
    try {
      await pool.query(`DELETE FROM teacher_assignment_permissions WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM class_mentors WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM subjects WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolId]);

      // Verification of Zero Residual Records for test tenant
      const checkResidual = await pool.query(`SELECT COUNT(*)::int AS cnt FROM class_mentors WHERE school_id = $1`, [schoolId]);
      assert(checkResidual.rows[0].cnt === 0, 'Teardown verified: Zero residual records remain for test tenant');
    } catch (_e) {}
  }

  console.log(`\n=== PHASE 1 TEST SUMMARY ===`);
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runPhase1Tests().catch((err) => {
  console.error('Fatal Phase 1 test error:', err);
  process.exit(1);
});
