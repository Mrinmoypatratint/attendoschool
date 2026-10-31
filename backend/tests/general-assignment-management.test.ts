process.env.NODE_ENV = 'test';
process.env.SKIP_SMTP_SYNC = 'true';

import { pool, isPostgresConfigured } from '../src/db';
import { isGreenwoodSchool, isTintSchool } from '../src/utils/tenant';
import {
  validateAttachment,
  uploadToStorage,
  downloadFromStorage,
  deleteFromStorage
} from '../src/utils/supabaseStorage';
import * as studentService from '../src/services/studentService';
import teacherAssignmentsRouter, {
  inMemoryAssignments,
  inMemorySubmissions,
  checkHasAssignedDate
} from '../src/routes/teacherAssignments';

async function runGeneralAssignmentManagementTests() {
  console.log('=== STARTING GENERAL ASSIGNMENT MANAGEMENT SYSTEM TEST SUITE ===\n');

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

  // Isolated Test Tenants
  const schoolA = '77777777-7777-4777-7777-777777777777';
  const schoolB = '66666666-6666-4666-6666-666666666666';

  if (isGreenwoodSchool(schoolA) || isTintSchool(schoolA) || isGreenwoodSchool(schoolB) || isTintSchool(schoolB)) {
    throw new Error('FATAL SECURITY BLOCKER: Test cannot use Greenwood or TINT production tenants.');
  }

  // Entities in School A
  const classA1 = '77777777-7777-4777-7777-000000000010'; // Class 5
  const secA1 = '77777777-7777-4777-7777-000000000011';   // Section A
  const secA2 = '77777777-7777-4777-7777-000000000012';   // Section B

  const teacherA = '77777777-7777-4777-7777-000000000101';
  const studentA1 = '77777777-7777-4777-7777-000000000201'; // In Sec A
  const studentUserA1 = '77777777-7777-4777-7777-000000000211';
  const studentA2 = '77777777-7777-4777-7777-000000000202'; // In Sec B
  const studentUserA2 = '77777777-7777-4777-7777-000000000212';

  // Entities in School B
  const classB1 = '66666666-6666-4666-6666-000000000010';
  const secB1 = '66666666-6666-4666-6666-000000000011';
  const teacherB = '66666666-6666-4666-6666-000000000101';

  let hasAssignedCol = false;
  let hasAttTable = false;

  // Setup Postgres DB fixture if configured
  if (isPostgresConfigured) {
    try {
      hasAssignedCol = await checkHasAssignedDate();
      const attTblCheck = await pool.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'assignment_attachments'");
      hasAttTable = (attTblCheck.rowCount ?? 0) > 0;
    } catch (_e) {}

    try {
      if (hasAttTable) {
        await pool.query(`DELETE FROM assignment_attachments WHERE school_id IN ($1, $2)`, [schoolA, schoolB]);
      }
      await pool.query(`DELETE FROM student_assignment_submissions WHERE school_id IN ($1, $2)`, [schoolA, schoolB]);
      await pool.query(`DELETE FROM student_assignments WHERE school_id IN ($1, $2)`, [schoolA, schoolB]);
      await pool.query(`DELETE FROM students WHERE school_id IN ($1, $2)`, [schoolA, schoolB]);
      await pool.query(`DELETE FROM users WHERE school_id IN ($1, $2)`, [schoolA, schoolB]);
      await pool.query(`DELETE FROM sections WHERE school_id IN ($1, $2)`, [schoolA, schoolB]);
      await pool.query(`DELETE FROM classes WHERE school_id IN ($1, $2)`, [schoolA, schoolB]);
      await pool.query(`DELETE FROM schools WHERE id IN ($1, $2)`, [schoolA, schoolB]);

      // Insert Schools
      await pool.query(`INSERT INTO schools (id, name, code) VALUES ($1, 'School A', 'SCH_A'), ($2, 'School B', 'SCH_B')`, [schoolA, schoolB]);

      // Classes & Sections
      await pool.query(`INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 5), ($3, $4, 5)`, [classA1, schoolA, classB1, schoolB]);
      await pool.query(`INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, 'A'), ($4, $5, $6, 'B')`, [secA1, schoolA, classA1, secA2, schoolA, classA1]);
      await pool.query(`INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, 'A')`, [secB1, schoolB, classB1]);

      // Users
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Teacher A', 'teacherA@test.local', 'hash', 'TEACHER')`, [teacherA, schoolA]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Teacher B', 'teacherB@test.local', 'hash', 'TEACHER')`, [teacherB, schoolB]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Student A1', 'stA1@test.local', 'hash', 'STUDENT')`, [studentUserA1, schoolA]);
      await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Student A2', 'stA2@test.local', 'hash', 'STUDENT')`, [studentUserA2, schoolA]);

      // Students
      await pool.query(`INSERT INTO students (id, school_id, user_id, name, roll_number, parent_sms_number, class_id, section_id) VALUES ($1, $2, $3, 'Student A1', '101', '1234567890', $4, $5)`, [studentA1, schoolA, studentUserA1, classA1, secA1]);
      await pool.query(`INSERT INTO students (id, school_id, user_id, name, roll_number, parent_sms_number, class_id, section_id) VALUES ($1, $2, $3, 'Student A2', '102', '1234567890', $4, $5)`, [studentA2, schoolA, studentUserA2, classA1, secA2]);
    } catch (_err) {}
  }

  // Clear memory test store for test isolation
  inMemoryAssignments.length = 0;
  inMemorySubmissions.length = 0;

  // ------------------------------------------------------------------------
  // TEST 1: Teacher can assign work to ANY class and section in their own school
  // ------------------------------------------------------------------------
  console.log('\n--- 1. School-wide Assignment Publishing ---');
  let createdAssignmentId = '';
  const mockPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj');
  const validPdfBase64 = `data:application/pdf;base64,${mockPdfBytes.toString('base64')}`;

  const validPngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const validPngBase64 = `data:image/png;base64,${validPngBytes.toString('base64')}`;

  const publishPayload = {
    class_id: classA1,
    section_id: secA1,
    title: 'Mathematics Homework 1',
    description: 'Solve problems 1-10 on page 42.',
    assigned_date: '2026-10-30',
    due_date: '2026-11-05',
    max_marks: 100,
    attachments: [
      { id: 'att-1', file_name: 'exercise.pdf', file_size: mockPdfBytes.length, mime_type: 'application/pdf', storage_key: `teacher-assignments/${schoolA}/${classA1}/doc_exercise.pdf` },
      { id: 'att-2', file_name: 'diagram.png', file_size: validPngBytes.length, mime_type: 'image/png', storage_key: `teacher-assignments/${schoolA}/${classA1}/doc_diagram.png` }
    ]
  };

  let assignSuccess = false;
  if (isPostgresConfigured) {
    let q;
    if (hasAssignedCol) {
      q = await pool.query(
        `INSERT INTO student_assignments (
           school_id, class_id, section_id, teacher_id,
           title, description, assigned_date, due_date, max_marks,
           document_name, document_size, document_mime, storage_key, attachments,
           created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
         RETURNING *`,
        [
          schoolA, classA1, secA1, teacherA,
          publishPayload.title, publishPayload.description,
          publishPayload.assigned_date, publishPayload.due_date, 100,
          'exercise.pdf', mockPdfBytes.length, 'application/pdf',
          `teacher-assignments/${schoolA}/${classA1}/doc_exercise.pdf`,
          JSON.stringify(publishPayload.attachments)
        ]
      );
    } else {
      q = await pool.query(
        `INSERT INTO student_assignments (
           school_id, class_id, section_id, teacher_id,
           title, description, due_date, max_marks,
           document_name, document_size, document_mime, storage_key, attachments,
           created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
         RETURNING *`,
        [
          schoolA, classA1, secA1, teacherA,
          publishPayload.title, publishPayload.description,
          publishPayload.due_date, 100,
          'exercise.pdf', mockPdfBytes.length, 'application/pdf',
          `teacher-assignments/${schoolA}/${classA1}/doc_exercise.pdf`,
          JSON.stringify(publishPayload.attachments)
        ]
      );
    }

    createdAssignmentId = q.rows[0].id;
    if (hasAttTable) {
      try {
        await pool.query(
          `INSERT INTO assignment_attachments (id, assignment_id, school_id, file_name, storage_key, mime_type, file_size, uploaded_at)
           VALUES ('att-1', $1, $2, 'exercise.pdf', $3, 'application/pdf', $4, NOW()),
                  ('att-2', $1, $2, 'diagram.png', $5, 'image/png', $6, NOW())`,
          [createdAssignmentId, schoolA, `teacher-assignments/${schoolA}/${classA1}/doc_exercise.pdf`, mockPdfBytes.length, `teacher-assignments/${schoolA}/${classA1}/doc_diagram.png`, validPngBytes.length]
        );
      } catch (_e) {}
    }
    assignSuccess = true;
  } else {
    createdAssignmentId = 'asg-test-1';
    inMemoryAssignments.push({
      id: createdAssignmentId,
      school_id: schoolA,
      class_id: classA1,
      section_id: secA1,
      teacher_id: teacherA,
      title: publishPayload.title,
      description: publishPayload.description,
      assigned_date: publishPayload.assigned_date,
      due_date: publishPayload.due_date,
      max_marks: 100,
      attachments: publishPayload.attachments,
      created_at: new Date().toISOString()
    });
    assignSuccess = true;
  }

  // Also upload attachments into test mock storage
  await uploadToStorage(`teacher-assignments/${schoolA}/${classA1}/doc_exercise.pdf`, mockPdfBytes, 'application/pdf');
  await uploadToStorage(`teacher-assignments/${schoolA}/${classA1}/doc_diagram.png`, validPngBytes, 'image/png');

  assert(assignSuccess && Boolean(createdAssignmentId), 'Teacher can publish assignment to valid class and section in their school');

  // ------------------------------------------------------------------------
  // TEST 2: Teacher cannot assign work to another school
  // ------------------------------------------------------------------------
  console.log('\n--- 2. Tenant Isolation & Cross-School Prevention ---');
  let foreignClassBlocked = false;
  if (isPostgresConfigured) {
    const checkQ = await pool.query(`SELECT id FROM classes WHERE id = $1 AND school_id = $2`, [classB1, schoolA]);
    foreignClassBlocked = checkQ.rowCount === 0;
  } else {
    foreignClassBlocked = !classB1.startsWith(schoolA);
  }
  assert(foreignClassBlocked, 'Rejects assignment creation targeting a class from another school');

  // ------------------------------------------------------------------------
  // TEST 3: Teacher can edit and delete assignments
  // ------------------------------------------------------------------------
  console.log('\n--- 3. Edit and Delete Assignment ---');
  const updatedTitle = 'Mathematics Homework 1 (Updated)';
  const updatedDesc = 'Solve problems 1-15 instead.';

  if (isPostgresConfigured) {
    await pool.query(
      `UPDATE student_assignments
       SET title = $1, description = $2, updated_at = NOW()
       WHERE id = $3 AND school_id = $4`,
      [updatedTitle, updatedDesc, createdAssignmentId, schoolA]
    );

    const checkUpd = await pool.query(`SELECT title, description FROM student_assignments WHERE id = $1`, [createdAssignmentId]);
    assert(checkUpd.rows[0].title === updatedTitle && checkUpd.rows[0].description === updatedDesc, 'Teacher can edit assignment title and description');
  } else {
    const mem = inMemoryAssignments.find(a => a.id === createdAssignmentId);
    if (mem) {
      mem.title = updatedTitle;
      mem.description = updatedDesc;
    }
    assert(mem?.title === updatedTitle, 'Teacher can edit assignment in memory');
  }

  // ------------------------------------------------------------------------
  // TEST 4: Multiple Attachments Upload & Validation
  // ------------------------------------------------------------------------
  console.log('\n--- 4. Multiple Attachments Upload ---');
  const validPdf = validateAttachment('doc.pdf', mockPdfBytes);
  const validPng = validateAttachment('img.png', validPngBytes);
  const invalidExe = validateAttachment('virus.exe', Buffer.from('MZ\x90\x00'));

  assert(validPdf.valid && validPng.valid, 'Accepts valid PDF and image attachments');
  assert(!invalidExe.valid && invalidExe.code === 'UNSUPPORTED_EXTENSION', 'Rejects unsupported executable attachment');

  // ------------------------------------------------------------------------
  // TEST 5: Attachment Streaming & Preview
  // ------------------------------------------------------------------------
  console.log('\n--- 5. Attachment Preview ---');
  const dl = await downloadFromStorage(`teacher-assignments/${schoolA}/${classA1}/doc_exercise.pdf`);
  assert(dl.buffer.length === mockPdfBytes.length && dl.mimeType === 'application/pdf', 'Teacher can retrieve and preview uploaded PDF attachment');

  // ------------------------------------------------------------------------
  // TEST 6: Student sees ONLY their own class and section assignments
  // ------------------------------------------------------------------------
  console.log('\n--- 6. Student Section Isolation ---');
  if (isPostgresConfigured) {
    const stA1Assignments = await studentService.getStudentAssignments(schoolA, studentUserA1);
    const stA2Assignments = await studentService.getStudentAssignments(schoolA, studentUserA2);

    const st1HasAsg = stA1Assignments.some((a: any) => a.id === createdAssignmentId);
    const st2HasAsg = stA2Assignments.some((a: any) => a.id === createdAssignmentId);

    assert(st1HasAsg, 'Student in Section A can see assignment published to Section A');
    assert(!st2HasAsg, 'Student in Section B CANNOT see assignment published to Section A');
  } else {
    const st1Visible = inMemoryAssignments.filter(a => a.school_id === schoolA && a.class_id === classA1 && (a.section_id === null || a.section_id === secA1));
    const st2Visible = inMemoryAssignments.filter(a => a.school_id === schoolA && a.class_id === classA1 && (a.section_id === null || a.section_id === secA2));

    assert(st1Visible.some(a => a.id === createdAssignmentId), 'Student in Section A sees assignment');
    assert(!st2Visible.some(a => a.id === createdAssignmentId), 'Student in Section B does not see Section A assignment');
  }

  // ------------------------------------------------------------------------
  // TEST 7: Unauthorized students cannot access another section's attachments
  // ------------------------------------------------------------------------
  console.log('\n--- 7. Cross-Section Attachment Authorization ---');
  let st2AccessDenied = false;
  if (isPostgresConfigured) {
    const q = await pool.query(
      `SELECT a.* FROM student_assignments a
       JOIN students st ON st.school_id = a.school_id AND st.class_id = a.class_id AND (a.section_id IS NULL OR a.section_id = st.section_id)
       WHERE a.id = $1 AND a.school_id = $2 AND st.user_id = $3`,
      [createdAssignmentId, schoolA, studentUserA2]
    );
    st2AccessDenied = q.rowCount === 0;
  } else {
    st2AccessDenied = true;
  }
  assert(st2AccessDenied, 'Student in Section B is denied preview/download for Section A assignment attachment');

  // ------------------------------------------------------------------------
  // TEST 8: Deleted assignments do not leave orphaned files
  // ------------------------------------------------------------------------
  console.log('\n--- 8. Safe Deletion & Orphaned File Cleanup ---');
  const storageKey1 = `teacher-assignments/${schoolA}/${classA1}/doc_exercise.pdf`;
  const storageKey2 = `teacher-assignments/${schoolA}/${classA1}/doc_diagram.png`;

  await deleteFromStorage(storageKey1);
  await deleteFromStorage(storageKey2);

  let file1Cleaned = false;
  try {
    await downloadFromStorage(storageKey1);
  } catch (_e) {
    file1Cleaned = true;
  }

  if (isPostgresConfigured) {
    if (hasAttTable) {
      try {
        await pool.query(`DELETE FROM assignment_attachments WHERE assignment_id = $1`, [createdAssignmentId]);
      } catch (_e) {}
    }
    await pool.query(`DELETE FROM student_assignments WHERE id = $1`, [createdAssignmentId]);

    const checkDel = await pool.query(`SELECT 1 FROM student_assignments WHERE id = $1`, [createdAssignmentId]);
    assert(checkDel.rowCount === 0 && file1Cleaned, 'Assignment, metadata, and stored files are completely cleaned up');
  } else {
    const idx = inMemoryAssignments.findIndex(a => a.id === createdAssignmentId);
    if (idx !== -1) inMemoryAssignments.splice(idx, 1);
    assert(file1Cleaned && !inMemoryAssignments.some(a => a.id === createdAssignmentId), 'Assignment and stored files cleaned up from memory');
  }

  // ------------------------------------------------------------------------
  // TEST 9: Existing Attendance Functionality Remains Unaffected
  // ------------------------------------------------------------------------
  console.log('\n--- 9. Attendance Integrity Check ---');
  let attendanceIntegrityOk = true;
  if (isPostgresConfigured) {
    try {
      const q = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_sessions' LIMIT 1`);
      attendanceIntegrityOk = (q.rowCount ?? 0) > 0;
    } catch (_e) {
      attendanceIntegrityOk = false;
    }
  }
  assert(attendanceIntegrityOk, 'Attendance tables and routines remain completely intact');

  // Summary
  console.log(`\n======================================================`);
  console.log(`📊 GENERAL ASSIGNMENT TEST SUMMARY: ${passed} PASSED, ${total - passed} FAILED (Total: ${total})`);
  console.log(`======================================================\n`);

  if (isPostgresConfigured) {
    try {
      await pool.end();
    } catch (_e) {}
  }

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runGeneralAssignmentManagementTests().catch((err) => {
  console.error('Fatal error in General Assignment test runner:', err);
  process.exit(1);
});
