process.env.NODE_ENV = 'test';
process.env.SKIP_SMTP_SYNC = 'true';

import { pool, isPostgresConfigured } from '../src/db';
import * as mentorSvc from '../src/services/mentorService';
import { isGreenwoodSchool, isTintSchool } from '../src/utils/tenant';

async function runPhase2Tests() {
  console.log('=== STARTING PHASE 2 SCHOOL ADMIN CLASS MENTOR INTEGRATION TESTS ===\n');
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

  // Dedicated Isolated Test Tenant
  const schoolId = '99999999-9999-4999-9999-999999999999';
  if (isGreenwoodSchool(schoolId) || isTintSchool(schoolId)) {
    throw new Error('FATAL SECURITY BLOCKER: Test cannot use Greenwood or TINT production/demo tenant ID.');
  }

  const classId3 = '99999999-9999-4999-9999-000000000003';
  const sec3AId = '99999999-9999-4999-9999-000000000301';
  const sec3BId = '99999999-9999-4999-9999-000000000302';
  const teacherAId = '99999999-9999-4999-9999-000000000701';
  const teacherBId = '99999999-9999-4999-9999-000000000702';

  // Setup PostgreSQL isolated test tenant data
  if (isPostgresConfigured) {
    try {
      await pool.query(`DELETE FROM teacher_assignment_permissions WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM class_mentors WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolId]);

      await pool.query(`INSERT INTO schools (id, name, code) VALUES ($1, 'Automated Test School P2', 'TEST_P2') ON CONFLICT (id) DO NOTHING`, [schoolId]);
      await pool.query(`INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 3) ON CONFLICT (id) DO NOTHING`, [classId3, schoolId]);
      await pool.query(`INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, 'A') ON CONFLICT (id) DO NOTHING`, [sec3AId, schoolId, classId3]);
      await pool.query(`INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, 'B') ON CONFLICT (id) DO NOTHING`, [sec3BId, schoolId, classId3]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Teacher A', 'teachera-p2@school.local', 'hash', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [teacherAId, schoolId]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Teacher B', 'teacherb-p2@school.local', 'hash', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [teacherBId, schoolId]);
    } catch (_e) {}
  }

  // TEST 1: Load Real Mentors List
  try {
    const list = await mentorSvc.getAllClassMentors(schoolId);
    assert(Array.isArray(list) && list.length >= 2, 'getAllClassMentors fetches real class and section list');
  } catch (err: any) {
    assert(false, `getAllClassMentors failed: ${err.message}`);
  }

  // TEST 2: Assign Mentor to Class 3-A
  try {
    const rec3A = await mentorSvc.assignClassMentor(schoolId, classId3, sec3AId, teacherAId);
    assert(rec3A.teacher_id === teacherAId, 'Teacher A assigned as mentor to Class 3-A successfully');
  } catch (err: any) {
    assert(false, `Assigning mentor to 3-A failed: ${err.message}`);
  }

  // TEST 3: Assign SAME Teacher A to another section (Class 3-B) — Multi-Section Mentorship
  try {
    const rec3B = await mentorSvc.assignClassMentor(schoolId, classId3, sec3BId, teacherAId);
    assert(rec3B.teacher_id === teacherAId, 'Teacher A assigned to Class 3-B as multi-section mentor');

    const teacherAMentored = await mentorSvc.getMentoredClasses(schoolId, teacherAId);
    assert(teacherAMentored.length >= 2, 'getMentoredClasses confirms Teacher A mentors multiple sections (3-A and 3-B)');
  } catch (err: any) {
    assert(false, `Multi-section mentorship assignment failed: ${err.message}`);
  }

  // TEST 4: Change Mentor for Class 3-A to Teacher B (Updates target section ONLY)
  try {
    const recChange = await mentorSvc.assignClassMentor(schoolId, classId3, sec3AId, teacherBId);
    assert(recChange.teacher_id === teacherBId, 'Class 3-A mentor updated to Teacher B');

    const is3AMentorB = await mentorSvc.isClassMentor(schoolId, classId3, sec3AId, teacherBId);
    const is3BMentorA = await mentorSvc.isClassMentor(schoolId, classId3, sec3BId, teacherAId);
    assert(is3AMentorB && is3BMentorA, 'Changing 3-A mentor updated target section 3-A only without affecting 3-B');
  } catch (err: any) {
    assert(false, `Changing mentor failed: ${err.message}`);
  }

  // TEST 5: Remove Mentor from Class 3-A
  try {
    const rmRes = await mentorSvc.removeClassMentor(schoolId, classId3, sec3AId);
    assert(rmRes.success === true, 'Mentor removed from Class 3-A');

    const is3AMentorAfterRm = await mentorSvc.isClassMentor(schoolId, classId3, sec3AId, teacherBId);
    assert(is3AMentorAfterRm === false, 'Class 3-A leaves section available but unassigned');
  } catch (err: any) {
    assert(false, `Removing mentor failed: ${err.message}`);
  }

  // TEST 6: Duplicate Mentor Assignment Safety (ON CONFLICT DO UPDATE handles duplicates safely)
  try {
    await mentorSvc.assignClassMentor(schoolId, classId3, sec3BId, teacherAId);
    await mentorSvc.assignClassMentor(schoolId, classId3, sec3BId, teacherAId);
    const allList = await mentorSvc.getAllClassMentors(schoolId);
    const count3B = allList.filter((m: any) => m.section_id === sec3BId || (m.section_name === 'B' && m.class_number === 3));
    assert(count3B.length === 1, 'Duplicate mentor assignments handled safely without duplicate rows');
  } catch (err: any) {
    assert(false, `Duplicate handling check failed: ${err.message}`);
  }

  // Teardown test tenant
  if (isPostgresConfigured) {
    try {
      await pool.query(`DELETE FROM class_mentors WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolId]);

      const checkResidual = await pool.query(`SELECT COUNT(*)::int AS cnt FROM class_mentors WHERE school_id = $1`, [schoolId]);
      assert(checkResidual.rows[0].cnt === 0, 'Teardown verified: Zero residual records remain for test tenant');
    } catch (_e) {}
  }

  console.log(`\n=== PHASE 2 TEST SUMMARY ===`);
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runPhase2Tests().catch((err) => {
  console.error('Fatal Phase 2 test error:', err);
  process.exit(1);
});
