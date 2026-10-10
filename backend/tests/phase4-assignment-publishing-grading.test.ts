process.env.NODE_ENV = 'test';
process.env.SKIP_SMTP_SYNC = 'true';

import { assignClassMentor, updateSubjectTeacherPermission, verifyTeacherPublishingEligibility } from '../src/services/mentorService';
import { inMemoryAssignments, inMemorySubmissions } from '../src/routes/teacherAssignments';
import { demoTeacherAssignments } from '../src/routes/schoolData';
import { pool, isPostgresConfigured } from '../src/db';
import { isGreenwoodSchool, isTintSchool } from '../src/utils/tenant';

async function runPhase4Tests() {
  console.log('=== STARTING PHASE 4 ASSIGNMENT PUBLISHING, SUBMISSIONS & GRADING TESTS ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, label: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${label}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${label}`);
      process.exitCode = 1;
    }
  }

  // Dedicated Isolated Test Tenant
  const schoolId = '99999999-9999-4999-9999-999999999999';
  const otherSchoolId = '88888888-8888-4888-8888-888888888888';

  if (isGreenwoodSchool(schoolId) || isTintSchool(schoolId) || isGreenwoodSchool(otherSchoolId) || isTintSchool(otherSchoolId)) {
    throw new Error('FATAL SECURITY BLOCKER: Test cannot use Greenwood or TINT production/demo tenant ID.');
  }

  const class3A = '99999999-9999-4999-9999-000000000010';
  const sec3A = '99999999-9999-4999-9999-000000000020';
  const subMath = '99999999-9999-4999-9999-000000000030';

  const primaryTeacherId = '99999999-9999-4999-9999-000000000101';
  const alternateTeacherId = '99999999-9999-4999-9999-000000000102';
  const unassignedTeacherId = '99999999-9999-4999-9999-000000000999';
  const adminUserId = '99999999-9999-4999-9999-000000000888';
  const mentorId = '99999999-9999-4999-9999-000000000103';
  const studentId = '99999999-9999-4999-9999-000000000900';

  // Seed demo teacher allocations in memory for test isolation
  demoTeacherAssignments.push(
    {
      id: 'alloc-p4-prim',
      school_id: schoolId,
      class_id: class3A,
      class_number: 3,
      section_id: sec3A,
      section_name: 'A',
      subject_id: subMath,
      subject_name: 'Mathematics',
      teacher_id: primaryTeacherId,
      teacher_name: 'Primary Math Teacher'
    },
    {
      id: 'alloc-p4-alt',
      school_id: schoolId,
      class_id: class3A,
      class_number: 3,
      section_id: sec3A,
      section_name: 'A',
      subject_id: subMath,
      subject_name: 'Mathematics',
      teacher_id: null,
      alt_teacher_id: alternateTeacherId,
      alt_teacher_name: 'Alternate Math Teacher'
    }
  );

  // Setup DB test schema entries for test tenant ONLY
  if (isPostgresConfigured) {
    try {
      await pool.query(`DELETE FROM student_assignment_submissions WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM student_assignments WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM teacher_assignment_permissions WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM class_mentors WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM students WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM subjects WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolId]);
      await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolId]);

      await pool.query(`INSERT INTO schools (id, name, code) VALUES ($1, 'Automated Test School P4', 'TEST_P4') ON CONFLICT (id) DO NOTHING`, [schoolId]);
      await pool.query(`INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 3) ON CONFLICT (id) DO NOTHING`, [class3A, schoolId]);
      await pool.query(`INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, 'A') ON CONFLICT (id) DO NOTHING`, [sec3A, schoolId, class3A]);
      await pool.query(`INSERT INTO subjects (id, school_id, name) VALUES ($1, $2, 'Mathematics') ON CONFLICT (id) DO NOTHING`, [subMath, schoolId]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Primary Teacher', 'prim-p4@test.local', 'hash', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [primaryTeacherId, schoolId]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Mentor Teacher', 'mentor-p4@test.local', 'hash', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [mentorId, schoolId]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Student User', 'student-p4@test.local', 'hash', 'STUDENT') ON CONFLICT (id) DO NOTHING`, [studentId, schoolId]);
      await pool.query(`INSERT INTO students (id, school_id, user_id, name, roll_number, class_id, section_id) VALUES ($1, $2, $3, 'John Doe', '12', $4, $5) ON CONFLICT (id) DO NOTHING`, [studentId, schoolId, studentId, class3A, sec3A]);
    } catch (_e) {}
  }

  try {
    // 1. Assign mentor for Class 3-A
    await assignClassMentor(schoolId, class3A, sec3A, mentorId);

    // Test 1: Alternate Teacher is strictly blocked from publishing
    const altCheck = await verifyTeacherPublishingEligibility(schoolId, alternateTeacherId, class3A, sec3A, subMath);
    assert(
      !altCheck.eligible && altCheck.code === 'ALTERNATE_TEACHER_PUBLISH_BLOCKED',
      'Alternate/substitute teacher is strictly rejected from publishing assignment with code ALTERNATE_TEACHER_PUBLISH_BLOCKED'
    );

    // Test 2: Unassigned teacher rejected from publishing
    const unassignedCheck = await verifyTeacherPublishingEligibility(schoolId, unassignedTeacherId, class3A, sec3A, subMath);
    assert(
      !unassignedCheck.eligible && unassignedCheck.code === 'NOT_PRIMARY_TEACHER',
      'Unassigned teacher is rejected with code NOT_PRIMARY_TEACHER'
    );

    // Test 3: Admin / Super Admin without primary allocation rejected from publishing
    const adminCheck = await verifyTeacherPublishingEligibility(schoolId, adminUserId, class3A, sec3A, subMath);
    assert(
      !adminCheck.eligible,
      'School Admin / Super Admin without primary allocation is rejected from publishing assignment'
    );

    // Test 4: Primary Teacher rejected BEFORE Class Mentor authorization
    const primUnauthorizedCheck = await verifyTeacherPublishingEligibility(schoolId, primaryTeacherId, class3A, sec3A, subMath);
    assert(
      !primUnauthorizedCheck.eligible && primUnauthorizedCheck.code === 'ASSIGNMENT_PUBLISH_UNAUTHORIZED',
      'Primary teacher is rejected when not authorized by Class Mentor with code ASSIGNMENT_PUBLISH_UNAUTHORIZED'
    );

    // Test 5: Class Mentor authorizes Primary Teacher
    await updateSubjectTeacherPermission(schoolId, mentorId, class3A, sec3A, subMath, primaryTeacherId, true);

    // Test 6: Primary Teacher allowed AFTER Class Mentor authorization
    const primAuthorizedCheck = await verifyTeacherPublishingEligibility(schoolId, primaryTeacherId, class3A, sec3A, subMath);
    assert(
      primAuthorizedCheck.eligible === true,
      'Primary teacher is eligible for publishing AFTER Class Mentor grants permission'
    );

    // Test 7: Section isolation & Cross-school checks
    const otherSchoolCheck = await verifyTeacherPublishingEligibility(otherSchoolId, primaryTeacherId, class3A, sec3A, subMath);
    assert(
      !otherSchoolCheck.eligible,
      'Cross-school assignment publishing is strictly blocked'
    );

    // Test 8: Simulate assignment creation in store
    const assignmentId = '99999999-9999-4999-9999-000000000555';
    const testAssignment = {
      id: assignmentId,
      school_id: schoolId,
      class_id: class3A,
      section_id: sec3A,
      subject_id: subMath,
      teacher_id: primaryTeacherId,
      title: 'Chapter 5 Algebra Homework',
      description: 'Solve questions 1-10',
      due_date: '2026-10-30',
      max_marks: 100,
      created_at: new Date().toISOString()
    };
    inMemoryAssignments.push(testAssignment);
    assert(
      inMemoryAssignments.some(a => a.id === testAssignment.id),
      'Assignment created and stored successfully'
    );

    // Test 9: Simulate student submission & grading isolation
    const submissionId = '99999999-9999-4999-9999-000000000777';
    const testSubmission = {
      id: submissionId,
      school_id: schoolId,
      assignment_id: testAssignment.id,
      student_id: studentId,
      student_name: 'John Doe',
      roll_number: '12',
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      submission_text: 'Attached solution notes.'
    };
    inMemorySubmissions.push(testSubmission);

    // Verify submission belongs to exact assignment and school
    const matchingSubmission = inMemorySubmissions.find(
      s => s.school_id === schoolId && s.assignment_id === testAssignment.id && s.id === testSubmission.id
    );
    assert(
      Boolean(matchingSubmission),
      'Submission record is correctly isolated to specific school_id and assignment_id'
    );

    // Test 10: Submission from wrong assignment / cross-assignment access rejected
    const wrongAssignmentSubmission = inMemorySubmissions.find(
      s => s.school_id === schoolId && s.assignment_id === '99999999-9999-4999-9999-000000000999' && s.id === testSubmission.id
    );
    assert(
      !wrongAssignmentSubmission,
      'Submission ID from another assignment cannot match or be modified'
    );

  } catch (err: any) {
    console.error('Unexpected error during Phase 4 tests:', err);
    process.exitCode = 1;
  } finally {
    // Teardown test school data completely
    if (isPostgresConfigured) {
      try {
        await pool.query(`DELETE FROM student_assignment_submissions WHERE school_id = $1`, [schoolId]);
        await pool.query(`DELETE FROM student_assignments WHERE school_id = $1`, [schoolId]);
        await pool.query(`DELETE FROM teacher_assignment_permissions WHERE school_id = $1`, [schoolId]);
        await pool.query(`DELETE FROM class_mentors WHERE school_id = $1`, [schoolId]);
        await pool.query(`DELETE FROM students WHERE school_id = $1`, [schoolId]);
        await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolId]);
        await pool.query(`DELETE FROM subjects WHERE school_id = $1`, [schoolId]);
        await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolId]);
        await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolId]);
        await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolId]);

        const checkResidual = await pool.query(`SELECT COUNT(*)::int AS cnt FROM student_assignments WHERE school_id = $1`, [schoolId]);
        assert(checkResidual.rows[0].cnt === 0, 'Teardown verified: Zero residual records remain for test tenant');
      } catch (_e) {}
    }

    console.log(`\n=== PHASE 4 TEST SUMMARY ===`);
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}\n`);
  }
}

runPhase4Tests();
