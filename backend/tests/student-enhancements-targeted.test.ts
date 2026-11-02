process.env.NODE_ENV = 'test';
process.env.SKIP_SMTP_SYNC = 'true';

import assert from 'assert';
import { pool, isPostgresConfigured } from '../src/db';
import { getStudentAssignments, submitStudentAssignment } from '../src/services/studentService';

async function runStudentEnhancementsTest() {
  console.log('=== STARTING STUDENT ASSIGNMENTS TARGETED TEST SUITE ===\n');

  // Test 1: Frontend Sorting logic simulation
  console.log('--- 1. Verification of Date Sorting Logic ---');
  interface MockAssignment {
    id: string;
    title: string;
    assigned_date?: string;
    created_at?: string;
    due_date?: string;
  }

  const getAssignmentTimestamp = (a: MockAssignment): number => {
    const dateStr = a.assigned_date || a.created_at;
    if (!dateStr) return 0;
    const ts = new Date(dateStr).getTime();
    return isNaN(ts) ? 0 : ts;
  };

  const sortAssignmentsMostRecentFirst = (list: MockAssignment[]): MockAssignment[] => {
    return [...list].sort((a, b) => {
      const tsA = getAssignmentTimestamp(a);
      const tsB = getAssignmentTimestamp(b);
      if (tsB !== tsA) return tsB - tsA;
      const cA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (cB !== cA) return cB - cA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  };

  const mockList: MockAssignment[] = [
    { id: '1', title: 'Old Assignment with far due date', assigned_date: '2026-01-10', due_date: '2026-12-31' },
    { id: '2', title: 'Brand New Assignment with near due date', assigned_date: '2026-11-01', due_date: '2026-11-05' },
    { id: '3', title: 'Mid Assignment with created_at fallback', created_at: '2026-06-15T10:00:00Z', due_date: '2026-06-20' },
  ];

  const sorted = sortAssignmentsMostRecentFirst(mockList);
  assert.strictEqual(sorted[0].id, '2', 'Newest assignment (assigned 2026-11-01) must be first');
  assert.strictEqual(sorted[1].id, '3', 'Mid assignment (created 2026-06-15) must be second');
  assert.strictEqual(sorted[2].id, '1', 'Old assignment (assigned 2026-01-10) must be last, regardless of due date 2026-12-31');
  console.log('✅ PASS: Frontend sorting logic correctly places most recent assigned assignment first, ignoring due dates');

  // Test 2: Database integration test for student assignments
  console.log('\n--- 2. Database Integration: Backend Sorting & Grade Preservation ---');
  if (!isPostgresConfigured) {
    console.log('Skipping DB-dependent tests because Postgres is not configured.');
    return;
  }

  const schoolTest = '88888888-8888-4888-8888-000000000888';
  const classTest = '88888888-8888-4888-8888-000000000810';
  const secTest = '88888888-8888-4888-8888-000000000811';
  const teacherTest = '88888888-8888-4888-8888-000000000801';
  const studentUserTest = '88888888-8888-4888-8888-000000000802';
  const studentTest = '88888888-8888-4888-8888-000000000803';
  const asgId1 = '88888888-8888-4888-8888-000000000891';
  const asgId2 = '88888888-8888-4888-8888-000000000892';

  try {
    // Clean fixtures
    await pool.query(`DELETE FROM student_assignment_attachments WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM student_assignment_submissions WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM student_assignments WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM students WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolTest]);

    // Seed
    await pool.query(`INSERT INTO schools (id, name, code) VALUES ($1, 'Sort Test School', 'SCH_SORT')`, [schoolTest]);
    await pool.query(`INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 6)`, [classTest, schoolTest]);
    await pool.query(`INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, 'A')`, [secTest, schoolTest, classTest]);

    await pool.query(`INSERT INTO users (id, school_id, name, email, role, password_hash) VALUES ($1, $2, 'Teacher Test', 't_sort@sch.edu', 'TEACHER', 'hash')`, [teacherTest, schoolTest]);
    await pool.query(`INSERT INTO users (id, school_id, name, email, role, password_hash) VALUES ($1, $2, 'Student Test', 's_sort@sch.edu', 'STUDENT', 'hash')`, [studentUserTest, schoolTest]);
    await pool.query(`INSERT INTO students (id, school_id, user_id, class_id, section_id, name, roll_number, parent_sms_number) VALUES ($1, $2, $3, $4, $5, 'Student Test', '01', '+919876543210')`, [studentTest, schoolTest, studentUserTest, classTest, secTest]);

    // Insert 2 assignments: 
    // asg1: Older assigned date (2026-02-01), far due date (2026-12-31)
    // asg2: Newer assigned date (2026-11-01), near due date (2026-11-05)
    await pool.query(
      `INSERT INTO student_assignments (id, school_id, teacher_id, class_id, section_id, title, description, created_at, due_date, max_marks)
       VALUES ($1, $2, $3, $4, $5, 'Assignment Older Assigned', 'Desc', '2026-02-01 10:00:00Z', '2026-12-31', 100)`,
      [asgId1, schoolTest, teacherTest, classTest, secTest]
    );

    await pool.query(
      `INSERT INTO student_assignments (id, school_id, teacher_id, class_id, section_id, title, description, created_at, due_date, max_marks)
       VALUES ($1, $2, $3, $4, $5, 'Assignment Newer Assigned', 'Desc', '2026-11-01 10:00:00Z', '2026-11-05', 100)`,
      [asgId2, schoolTest, teacherTest, classTest, secTest]
    );

    // Query via getStudentAssignments
    const studentAsgs = await getStudentAssignments(schoolTest, studentUserTest);
    const myAsgs = studentAsgs.filter(a => a.id === asgId1 || a.id === asgId2);

    assert.strictEqual(myAsgs.length, 2, 'Should return both assignments');
    assert.strictEqual(myAsgs[0].id, asgId2, 'Backend query must return Newer Assigned assignment first!');
    assert.strictEqual(myAsgs[1].id, asgId1, 'Backend query must return Older Assigned assignment second!');
    console.log('✅ PASS: getStudentAssignments query returns most recent assignment first (ORDER BY assigned_date DESC)');

    // Test 3: Grade & feedback preservation during resubmission
    console.log('\n--- 3. Grade & Feedback Preservation on Resubmission ---');
    // First submit work
    await submitStudentAssignment(
      schoolTest,
      studentUserTest,
      asgId2,
      'Initial submission answer'
    );

    // Simulate Teacher grading the assignment
    await pool.query(
      `UPDATE student_assignment_submissions
       SET status = 'GRADED', marks_obtained = 95.0, feedback = 'Great analysis of historical contexts'
       WHERE assignment_id = $1 AND student_id = $2`,
      [asgId2, studentTest]
    );

    // Student edits submission
    await submitStudentAssignment(
      schoolTest,
      studentUserTest,
      asgId2,
      'Updated submission answer with extra details'
    );

    // Verify marks and feedback were not erased!
    const verifiedQ = await pool.query(
      `SELECT status, marks_obtained, feedback, submission_text
       FROM student_assignment_submissions
       WHERE assignment_id = $1 AND student_id = $2`,
      [asgId2, studentTest]
    );
    const subRecord = verifiedQ.rows[0];

    assert.strictEqual(Number(subRecord.marks_obtained), 95.0, 'Marks obtained must remain 95.0');
    assert.strictEqual(subRecord.feedback, 'Great analysis of historical contexts', 'Teacher feedback must be preserved');
    assert.strictEqual(subRecord.submission_text, 'Updated submission answer with extra details', 'Submission text updated');
    assert.ok(subRecord.status === 'RESUBMITTED' || subRecord.status === 'SUBMITTED', 'Status updated to RESUBMITTED/SUBMITTED');
    console.log(`✅ PASS: Graded submission edit preserved marks (95.0) and feedback ("${subRecord.feedback}")! Status: ${subRecord.status}`);

    // Clean up test school
    await pool.query(`DELETE FROM student_assignment_attachments WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM student_assignment_submissions WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM student_assignments WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM students WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolTest]);
    await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolTest]);
    console.log('✅ Clean teardown: Test tenant removed safely.');

  } catch (err) {
    // attempt cleanup
    try {
      await pool.query(`DELETE FROM student_assignment_attachments WHERE school_id = $1`, [schoolTest]);
      await pool.query(`DELETE FROM student_assignment_submissions WHERE school_id = $1`, [schoolTest]);
      await pool.query(`DELETE FROM student_assignments WHERE school_id = $1`, [schoolTest]);
      await pool.query(`DELETE FROM students WHERE school_id = $1`, [schoolTest]);
      await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolTest]);
      await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolTest]);
      await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolTest]);
      await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolTest]);
    } catch (_e) {}
    throw err;
  }

  console.log('\n========================================');
  console.log('ALL STUDENT ENHANCEMENT TESTS PASSED!');
  console.log('========================================');
}

runStudentEnhancementsTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
