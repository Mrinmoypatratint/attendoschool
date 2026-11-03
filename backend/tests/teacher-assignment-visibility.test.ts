process.env.NODE_ENV = 'test';
process.env.SKIP_SMTP_SYNC = 'true';

import assert from 'assert';
import { pool, isPostgresConfigured } from '../src/db';
import {
  canTeacherAccessAssignment,
  fetchTeacherAssignmentsList,
  inMemoryAssignments
} from '../src/routes/teacherAssignments';
import { inMemoryClassMentors } from '../src/services/mentorService';

async function runTeacherAssignmentVisibilityTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   TEACHER ASSIGNMENT VISIBILITY & TWO-SECTION DASHBOARD TESTS  ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Test UUIDs
  const schoolA = '88888888-8888-4888-8888-000000000001';
  const schoolB = '88888888-8888-4888-8888-000000000002'; // Cross-school

  // Classes & Sections in School A
  const class5Id = '88888888-8888-4888-8888-000000000015';
  const sec5AId = '88888888-8888-4888-8888-000000000016';
  const class6Id = '88888888-8888-4888-8888-000000000017';
  const sec6AId = '88888888-8888-4888-8888-000000000018';
  const class8Id = '88888888-8888-4888-8888-000000000019';
  const sec8BId = '88888888-8888-4888-8888-000000000020';

  // Users in School A
  const teacher1Id = '88888888-8888-4888-8888-000000000101'; // Mentor for Class 5A
  const teacher2Id = '88888888-8888-4888-8888-000000000102'; // Other teacher
  const teacher3Id = '88888888-8888-4888-8888-000000000103'; // Teacher with NO mentor mapping
  const adminId = '88888888-8888-4888-8888-000000000104';

  // Cross-school in School B
  const teacherSchoolBId = '88888888-8888-4888-8888-000000000201';
  const classBId = '88888888-8888-4888-8888-000000000210';

  // Assignment IDs
  const asgAId = '88888888-8888-4888-8888-000000000501'; // Teacher 1 in Class 5A
  const asgBId = '88888888-8888-4888-8888-000000000502'; // Teacher 1 in Class 6A
  const asgCId = '88888888-8888-4888-8888-000000000503'; // Teacher 2 in Class 5A (Mentored by Teacher 1)
  const asgDId = '88888888-8888-4888-8888-000000000504'; // Teacher 2 in Class 8B (NOT mentored by Teacher 1)
  const asgEId = '88888888-8888-4888-8888-000000000505'; // School B assignment

  if (isPostgresConfigured) {
    console.log('Setting up PostgreSQL test fixtures...');
    // Clean fixtures
    await pool.query('DELETE FROM student_assignment_submissions WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM student_assignments WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM class_mentors WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM users WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM sections WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM classes WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM schools WHERE id IN ($1, $2)', [schoolA, schoolB]);

    const codeA = `VIS_A_${Date.now().toString().slice(-6)}`;
    const codeB = `VIS_B_${Date.now().toString().slice(-6)}`;

    // Insert schools
    await pool.query('INSERT INTO schools (id, name, code) VALUES ($1, $2, $3)', [schoolA, 'School Alpha', codeA]);
    await pool.query('INSERT INTO schools (id, name, code) VALUES ($1, $2, $3)', [schoolB, 'School Beta', codeB]);

    // Insert classes & sections
    await pool.query('INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 5)', [class5Id, schoolA]);
    await pool.query('INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, $4)', [sec5AId, schoolA, class5Id, 'A']);

    await pool.query('INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 6)', [class6Id, schoolA]);
    await pool.query('INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, $4)', [sec6AId, schoolA, class6Id, 'A']);

    await pool.query('INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 8)', [class8Id, schoolA]);
    await pool.query('INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, $4)', [sec8BId, schoolA, class8Id, 'B']);

    await pool.query('INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 10)', [classBId, schoolB]);

    // Insert users
    await pool.query('INSERT INTO users (id, school_id, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)', [
      teacher1Id, schoolA, 'Teacher One', 't1@alpha.edu', 'TEACHER', 'test_hash'
    ]);
    await pool.query('INSERT INTO users (id, school_id, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)', [
      teacher2Id, schoolA, 'Teacher Two', 't2@alpha.edu', 'TEACHER', 'test_hash'
    ]);
    await pool.query('INSERT INTO users (id, school_id, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)', [
      teacher3Id, schoolA, 'Teacher Three (No Mentor)', 't3@alpha.edu', 'TEACHER', 'test_hash'
    ]);
    await pool.query('INSERT INTO users (id, school_id, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)', [
      adminId, schoolA, 'Admin Alpha', 'admin@alpha.edu', 'SCHOOL_ADMIN', 'test_hash'
    ]);
    await pool.query('INSERT INTO users (id, school_id, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)', [
      teacherSchoolBId, schoolB, 'Teacher Beta', 'tb@beta.edu', 'TEACHER', 'test_hash'
    ]);

    // Mentor mapping: Teacher 1 is class mentor for Class 5 Section A
    await pool.query(
      `INSERT INTO class_mentors (school_id, class_id, section_id, teacher_id, assigned_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [schoolA, class5Id, sec5AId, teacher1Id]
    );

    // Insert assignments
    // A: Teacher 1 in Class 5A
    await pool.query(
      `INSERT INTO student_assignments (id, school_id, class_id, section_id, teacher_id, title, description, max_marks, due_date, created_at)
       VALUES ($1, $2, $3, $4, $5, 'Assignment A (T1 -> 5A)', 'Math fractions', 100, '2026-12-01', NOW() - INTERVAL '3 hours')`,
      [asgAId, schoolA, class5Id, sec5AId, teacher1Id]
    );
    // B: Teacher 1 in Class 6A
    await pool.query(
      `INSERT INTO student_assignments (id, school_id, class_id, section_id, teacher_id, title, description, max_marks, due_date, created_at)
       VALUES ($1, $2, $3, $4, $5, 'Assignment B (T1 -> 6A)', 'Science forces', 50, '2026-12-01', NOW() - INTERVAL '2 hours')`,
      [asgBId, schoolA, class6Id, sec6AId, teacher1Id]
    );
    // C: Teacher 2 in Class 5A (Mentored by T1)
    await pool.query(
      `INSERT INTO student_assignments (id, school_id, class_id, section_id, teacher_id, title, description, max_marks, due_date, created_at)
       VALUES ($1, $2, $3, $4, $5, 'Assignment C (T2 -> 5A)', 'English essay', 100, '2026-12-01', NOW() - INTERVAL '1 hour')`,
      [asgCId, schoolA, class5Id, sec5AId, teacher2Id]
    );
    // D: Teacher 2 in Class 8B (NOT mentored by T1)
    await pool.query(
      `INSERT INTO student_assignments (id, school_id, class_id, section_id, teacher_id, title, description, max_marks, due_date, created_at)
       VALUES ($1, $2, $3, $4, $5, 'Assignment D (T2 -> 8B)', 'History revolt', 80, '2026-12-01', NOW())`,
      [asgDId, schoolA, class8Id, sec8BId, teacher2Id]
    );
    // E: School B Assignment
    await pool.query(
      `INSERT INTO student_assignments (id, school_id, class_id, teacher_id, title, description, max_marks, due_date, created_at)
       VALUES ($1, $2, $3, $4, 'Assignment E (School B)', 'Beta assignment', 100, '2026-12-01', NOW())`,
      [asgEId, schoolB, classBId, teacherSchoolBId]
    );
  } else {
    console.log('Setting up in-memory test fixtures...');
    inMemoryAssignments.length = 0;
    inMemoryClassMentors.length = 0;

    inMemoryClassMentors.push({
      school_id: schoolA,
      class_id: class5Id,
      section_id: sec5AId,
      teacher_id: teacher1Id
    });

    inMemoryAssignments.push(
      {
        id: asgAId,
        school_id: schoolA,
        class_id: class5Id,
        section_id: sec5AId,
        teacher_id: teacher1Id,
        title: 'Assignment A (T1 -> 5A)',
        description: 'Math fractions',
        max_marks: 100,
        due_date: '2026-12-01',
        created_at: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        id: asgBId,
        school_id: schoolA,
        class_id: class6Id,
        section_id: sec6AId,
        teacher_id: teacher1Id,
        title: 'Assignment B (T1 -> 6A)',
        description: 'Science forces',
        max_marks: 50,
        due_date: '2026-12-01',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: asgCId,
        school_id: schoolA,
        class_id: class5Id,
        section_id: sec5AId,
        teacher_id: teacher2Id,
        title: 'Assignment C (T2 -> 5A)',
        description: 'English essay',
        max_marks: 100,
        due_date: '2026-12-01',
        created_at: new Date(Date.now() - 3600000 * 1).toISOString()
      },
      {
        id: asgDId,
        school_id: schoolA,
        class_id: class8Id,
        section_id: sec8BId,
        teacher_id: teacher2Id,
        title: 'Assignment D (T2 -> 8B)',
        description: 'History revolt',
        max_marks: 80,
        due_date: '2026-12-01',
        created_at: new Date().toISOString()
      },
      {
        id: asgEId,
        school_id: schoolB,
        class_id: classBId,
        section_id: null,
        teacher_id: teacherSchoolBId,
        title: 'Assignment E (School B)',
        description: 'Beta assignment',
        max_marks: 100,
        due_date: '2026-12-01',
        created_at: new Date().toISOString()
      }
    );
  }

  // Helper request builder
  function mockReq(user: { id: string; schoolId: string; role: string }, query: any = {}): any {
    return {
      user,
      query
    };
  }

  console.log('Executing test suite:\n');

  // TEST 1: Teacher sees own assignments across different classes in Published by Me
  console.log('1. Testing Published by Me view for Teacher 1...');
  const t1PubReq = mockReq({ id: teacher1Id, schoolId: schoolA, role: 'TEACHER' }, { view: 'published_by_me' });
  const t1Published = await fetchTeacherAssignmentsList(t1PubReq);
  const t1PubIds = t1Published.map((a: any) => a.id);
  assert(t1PubIds.includes(asgAId), 'Teacher 1 should see Assignment A in Published by Me');
  assert(t1PubIds.includes(asgBId), 'Teacher 1 should see Assignment B (Class 6A) in Published by Me');
  assert(!t1PubIds.includes(asgCId), 'Teacher 1 should NOT see Assignment C (created by Teacher 2) in Published by Me');
  assert(!t1PubIds.includes(asgDId), 'Teacher 1 should NOT see Assignment D (created by Teacher 2) in Published by Me');
  console.log('   ✔ PASS: Teacher 1 sees all their published assignments across different classes, excluding other teachers.');

  // TEST 2: Teacher sees assignments from other teachers in My Mentored Class
  console.log('2. Testing My Mentored Class view for Teacher 1 (mentor for Class 5A)...');
  const t1MentReq = mockReq({ id: teacher1Id, schoolId: schoolA, role: 'TEACHER' }, { view: 'my_mentored' });
  const t1Mentored = await fetchTeacherAssignmentsList(t1MentReq);
  const t1MentIds = t1Mentored.map((a: any) => a.id);
  assert(t1MentIds.includes(asgCId), 'Teacher 1 should see Assignment C (by Teacher 2) in My Mentored Class');
  const asgCRow = t1Mentored.find((a: any) => a.id === asgCId);
  assert.strictEqual(asgCRow.is_owner, false, 'Assignment C should have is_owner = false for Teacher 1');
  console.log('   ✔ PASS: Teacher 1 sees Assignment C published by Teacher 2 in their mentored class with is_owner = false.');

  // TEST 3: Teacher cannot see other classes\' assignments from other teachers
  console.log('3. Verifying isolation from other classes\' assignments from other teachers...');
  assert(!t1MentIds.includes(asgDId), 'Teacher 1 should NOT see Assignment D (Class 8B) in My Mentored Class');
  assert(!t1PubIds.includes(asgDId), 'Teacher 1 should NOT see Assignment D in Published by Me');
  console.log('   ✔ PASS: Assignment D (Class 8B) is excluded from both Published by Me and My Mentored Class.');

  // TEST 4: Cross-school isolation rejected
  console.log('4. Verifying tenant isolation across schools...');
  assert(!t1MentIds.includes(asgEId), 'School B assignment must never appear in School A mentored list');
  assert(!t1PubIds.includes(asgEId), 'School B assignment must never appear in School A published list');
  const crossAccess = await canTeacherAccessAssignment(schoolA, teacher1Id, {
    class_id: classBId,
    section_id: null,
    teacher_id: teacherSchoolBId
  });
  assert.strictEqual(crossAccess.allowed, false, 'Cross-school assignment access must be denied');
  console.log('   ✔ PASS: Complete cross-school isolation verified.');

  // TEST 5: Teacher with no mentor mapping sees empty mentored section
  console.log('5. Testing teacher with no mentor assignment (Teacher 3)...');
  const t3MentReq = mockReq({ id: teacher3Id, schoolId: schoolA, role: 'TEACHER' }, { view: 'my_mentored' });
  const t3Mentored = await fetchTeacherAssignmentsList(t3MentReq);
  assert.strictEqual(t3Mentored.length, 0, 'Teacher with no mentor mapping must receive empty list in My Mentored Class');
  console.log('   ✔ PASS: Teacher without mentor mapping receives empty mentored list, zero leakage.');

  // TEST 6: Mentor cannot edit or delete another teacher\'s assignment
  console.log('6. Verifying read-only permissions for non-author mentor...');
  const accessToC = await canTeacherAccessAssignment(schoolA, teacher1Id, {
    class_id: class5Id,
    section_id: sec5AId,
    teacher_id: teacher2Id
  });
  assert.strictEqual(accessToC.allowed, true, 'Mentor should be allowed read access to mentored class assignment');
  assert.strictEqual(accessToC.isOwner, false, 'Mentor is NOT owner of another teacher\'s assignment');
  console.log('   ✔ PASS: Mentor has read access (allowed=true) but no author mutation permission (isOwner=false).');

  // TEST 7: Own assignment targeting mentored class appears in both views correctly
  console.log('7. Verifying own assignment targeting mentored class (Assignment A)...');
  assert(t1PubIds.includes(asgAId), 'Assignment A must be in Published by Me');
  assert(t1MentIds.includes(asgAId), 'Assignment A must be in My Mentored Class');
  const asgARow = t1Mentored.find((a: any) => a.id === asgAId);
  assert.strictEqual(asgARow.is_owner, true, 'Assignment A must have is_owner = true in My Mentored Class');
  console.log('   ✔ PASS: Own assignment appears in both views and retains owner permissions.');

  // TEST 8: Teacher 1 can access assignment details for A, B, and C, but NOT D
  console.log('8. Verifying granular assignment access check...');
  const accessA = await canTeacherAccessAssignment(schoolA, teacher1Id, { class_id: class5Id, section_id: sec5AId, teacher_id: teacher1Id });
  const accessB = await canTeacherAccessAssignment(schoolA, teacher1Id, { class_id: class6Id, section_id: sec6AId, teacher_id: teacher1Id });
  const accessC = await canTeacherAccessAssignment(schoolA, teacher1Id, { class_id: class5Id, section_id: sec5AId, teacher_id: teacher2Id });
  const accessD = await canTeacherAccessAssignment(schoolA, teacher1Id, { class_id: class8Id, section_id: sec8BId, teacher_id: teacher2Id });
  assert.strictEqual(accessA.allowed, true, 'T1 can access own assignment A');
  assert.strictEqual(accessB.allowed, true, 'T1 can access own assignment B');
  assert.strictEqual(accessC.allowed, true, 'T1 can access mentored assignment C');
  assert.strictEqual(accessD.allowed, false, 'T1 CANNOT access un-mentored other teacher assignment D');
  console.log('   ✔ PASS: Access correctly granted for own and mentored tasks, denied for unrelated tasks.');

  // TEST 9: Admin functionality remains intact
  console.log('9. Verifying admin view functionality...');
  const adminReq = mockReq({ id: adminId, schoolId: schoolA, role: 'SCHOOL_ADMIN' }, { view: 'all' });
  const adminList = await fetchTeacherAssignmentsList(adminReq);
  const adminIds = adminList.map((a: any) => a.id);
  assert(adminIds.includes(asgAId), 'Admin should see Assignment A');
  assert(adminIds.includes(asgBId), 'Admin should see Assignment B');
  assert(adminIds.includes(asgCId), 'Admin should see Assignment C');
  assert(adminIds.includes(asgDId), 'Admin should see Assignment D');
  assert(!adminIds.includes(asgEId), 'Admin should NOT see School B Assignment');
  console.log('   ✔ PASS: School admin can view all assignments across their school, preserving tenant isolation.');

  // Clean fixtures
  if (isPostgresConfigured) {
    await pool.query('DELETE FROM student_assignments WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM class_mentors WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM users WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM sections WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM classes WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await pool.query('DELETE FROM schools WHERE id IN ($1, $2)', [schoolA, schoolB]);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   ALL 9 TEACHER ASSIGNMENT VISIBILITY TESTS PASSED (100%)    ');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

runTeacherAssignmentVisibilityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
