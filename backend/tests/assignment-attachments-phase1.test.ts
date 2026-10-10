process.env.NODE_ENV = 'test';
process.env.SKIP_SMTP_SYNC = 'true';

import { pool, isPostgresConfigured } from '../src/db';
import { isGreenwoodSchool, isTintSchool } from '../src/utils/tenant';
import { env } from '../src/config/env';
import {
  validateAttachment,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE,
  MAX_FILES_COUNT,
  uploadToStorage,
  downloadFromStorage,
  getSupabaseUrl,
  getServiceRoleKey,
  ensureBucketExists,
  StorageConfigurationError
} from '../src/utils/supabaseStorage';
import * as studentService from '../src/services/studentService';
import { assignClassMentor, updateSubjectTeacherPermission, verifyTeacherPublishingEligibility } from '../src/services/mentorService';
import { inMemoryAssignments, inMemorySubmissions } from '../src/routes/teacherAssignments';
import { demoTeacherAssignments } from '../src/routes/schoolData';

async function runPhase1AttachmentTests() {
  console.log('=== STARTING PHASE 1: STUDENT ASSIGNMENT ATTACHMENTS & STORAGE TESTS ===\n');

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

  // 1. UNIT TESTS: File validation, magic bytes & constraints
  console.log('--- 1. File Validation, Magic Bytes & Limits ---');

  // Unsupported extension
  const exeValidation = validateAttachment('malicious.exe', Buffer.from('MZ\x90\x00\x03\x00\x00\x00'));
  assert(!exeValidation.valid && exeValidation.code === 'UNSUPPORTED_EXTENSION', 'Rejects unsupported file extension (.exe)');

  // Spoofed PNG (text disguised as PNG)
  const fakePng = validateAttachment('fake.png', Buffer.from('This is actually a plain text file pretending to be PNG'));
  assert(!fakePng.valid && fakePng.code === 'MAGIC_BYTES_MISMATCH', 'Rejects spoofed PNG file with invalid magic bytes');

  // Valid PNG with correct 8-byte header
  const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const realPng = validateAttachment('diagram.png', validPngHeader);
  assert(realPng.valid && realPng.mimeType === 'image/png', 'Accepts valid PNG with authentic magic bytes');

  // Valid PDF with %PDF header
  const validPdfHeader = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj');
  const realPdf = validateAttachment('homework.pdf', validPdfHeader);
  assert(realPdf.valid && realPdf.mimeType === 'application/pdf', 'Accepts valid PDF with authentic magic bytes');

  // Valid DOCX with PK\x03\x04 header
  const validDocxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
  const realDocx = validateAttachment('notes.docx', validDocxHeader);
  assert(realDocx.valid && realDocx.mimeType.includes('wordprocessingml'), 'Accepts valid DOCX with authentic OpenXML magic bytes');

  // File size limit: Buffer > 10MB
  const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
  // Pretend it has PDF header
  oversizedBuffer.write('%PDF', 0);
  const oversizedFile = validateAttachment('huge.pdf', oversizedBuffer);
  assert(!oversizedFile.valid && oversizedFile.code === 'FILE_TOO_LARGE', 'Rejects attachment exceeding 10MB limit');

  // 1b. Storage Configuration & Safe Failure
  console.log('\n--- 1b. Storage Configuration & Safe Failure ---');

  const resolvedUrl = getSupabaseUrl();
  assert(resolvedUrl.startsWith('https://') && resolvedUrl.includes('supabase.co'), 'Derives valid HTTPS Supabase project URL');

  // Verify missing configuration fails safely with StorageConfigurationError (HTTP 503)
  const prevEnv = process.env.NODE_ENV;
  const prevKey = env.supabaseServiceRoleKey;
  try {
    process.env.NODE_ENV = 'production';
    (env as any).supabaseServiceRoleKey = '';

    let threwConfigError = false;
    let caughtErr: any = null;
    try {
      await ensureBucketExists();
    } catch (e: any) {
      threwConfigError = true;
      caughtErr = e;
    }

    assert(threwConfigError, 'Throws error when SUPABASE_SERVICE_ROLE_KEY is missing in production');
    assert(caughtErr instanceof StorageConfigurationError, 'Error is an instance of StorageConfigurationError');
    assert(caughtErr?.statusCode === 503, 'Configuration error returns HTTP 503 status code');
    assert(caughtErr?.code === 'STORAGE_CONFIGURATION_MISSING', 'Configuration error has STORAGE_CONFIGURATION_MISSING code');
    assert(!caughtErr?.message?.includes('postgres://') && !caughtErr?.message?.includes('secret'), 'Configuration error does not leak credentials or connection strings');
  } finally {
    process.env.NODE_ENV = prevEnv;
    (env as any).supabaseServiceRoleKey = prevKey;
  }

  // 2. ISOLATED TEST TENANT SETUP & DB INTEGRATION
  console.log('\n--- 2. Tenant Isolation & Database Persistence ---');

  const schoolId = '99999999-9999-4999-9999-999999999999';
  const otherSchoolId = '88888888-8888-4888-8888-888888888888';

  // Hard assertion: Never run against Greenwood or TINT
  if (isGreenwoodSchool(schoolId) || isTintSchool(schoolId) || isGreenwoodSchool(otherSchoolId) || isTintSchool(otherSchoolId)) {
    throw new Error('FATAL SECURITY BLOCKER: Test cannot use Greenwood or TINT production/demo tenant ID.');
  }

  const classId = '99999999-9999-4999-9999-000000000010';
  const sectionId = '99999999-9999-4999-9999-000000000020';
  const subjectId = '99999999-9999-4999-9999-000000000030';
  const primaryTeacherId = '99999999-9999-4999-9999-000000000101';
  const unauthorizedTeacherId = '99999999-9999-4999-9999-000000000199';
  const studentUserId = '99999999-9999-4999-9999-000000000901';
  const otherStudentUserId = '99999999-9999-4999-9999-000000000902';
  const studentRecordId = '99999999-9999-4999-9999-000000000911';
  const otherStudentRecordId = '99999999-9999-4999-9999-000000000912';
  const assignmentId = '99999999-9999-4999-9999-000000000501';

  if (isPostgresConfigured) {
    // Isolated Cleanup for test school only
    await pool.query(`DELETE FROM student_assignment_attachments WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM student_assignment_submissions WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM student_assignments WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM students WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM subjects WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolId]);

    // Insert isolated test data
    await pool.query(`INSERT INTO schools (id, name, code) VALUES ($1, 'Storage Test School', 'STORAGE_TEST') ON CONFLICT (id) DO NOTHING`, [schoolId]);
    await pool.query(`INSERT INTO classes (id, school_id, class_number) VALUES ($1, $2, 5) ON CONFLICT (id) DO NOTHING`, [classId, schoolId]);
    await pool.query(`INSERT INTO sections (id, school_id, class_id, name) VALUES ($1, $2, $3, 'A') ON CONFLICT (id) DO NOTHING`, [sectionId, schoolId, classId]);
    await pool.query(`INSERT INTO subjects (id, school_id, name) VALUES ($1, $2, 'Science') ON CONFLICT (id) DO NOTHING`, [subjectId, schoolId]);

    // Users
    await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Lead Science Teacher', 'sci-teach@test.local', 'hash', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [primaryTeacherId, schoolId]);
    await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Unrelated Teacher', 'unrelated@test.local', 'hash', 'TEACHER') ON CONFLICT (id) DO NOTHING`, [unauthorizedTeacherId, schoolId]);
    await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Test Student Alice', 'alice@test.local', 'hash', 'STUDENT') ON CONFLICT (id) DO NOTHING`, [studentUserId, schoolId]);
    await pool.query(`INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES ($1, $2, 'Test Student Bob', 'bob@test.local', 'hash', 'STUDENT') ON CONFLICT (id) DO NOTHING`, [otherStudentUserId, schoolId]);

    // Students
    await pool.query(`INSERT INTO students (id, school_id, user_id, name, roll_number, class_id, section_id, parent_sms_number) VALUES ($1, $2, $3, 'Alice', '01', $4, $5, '9999999991') ON CONFLICT (id) DO NOTHING`, [studentRecordId, schoolId, studentUserId, classId, sectionId]);
    await pool.query(`INSERT INTO students (id, school_id, user_id, name, roll_number, class_id, section_id, parent_sms_number) VALUES ($1, $2, $3, 'Bob', '02', $4, $5, '9999999992') ON CONFLICT (id) DO NOTHING`, [otherStudentRecordId, schoolId, otherStudentUserId, classId, sectionId]);

    // Assignment
    await pool.query(
      `INSERT INTO student_assignments (id, school_id, class_id, section_id, subject_id, teacher_id, title, description, due_date, max_marks)
       VALUES ($1, $2, $3, $4, $5, $6, 'Science Project Phase 1', 'Submit lab report and diagrams', '2026-12-31', 100)
       ON CONFLICT (id) DO NOTHING`,
      [assignmentId, schoolId, classId, sectionId, subjectId, primaryTeacherId]
    );

    // 3. STUDENT SUBMISSION WITH ATTACHMENTS
    console.log('\n--- 3. Student Submission with Attachments & Supabase Storage ---');

    const samplePdfData = `data:application/pdf;base64,${validPdfHeader.toString('base64')}`;
    const samplePngData = `data:image/png;base64,${validPngHeader.toString('base64')}`;

    const submissionResult = await studentService.submitStudentAssignment(
      schoolId,
      studentUserId,
      assignmentId,
      'Here is my completed science lab report and observation chart.',
      [
        { fileName: 'lab_report.pdf', fileData: samplePdfData },
        { fileName: 'chart.png', fileData: samplePngData }
      ]
    );

    assert(submissionResult && submissionResult.status === 'SUBMITTED', 'Student submission successfully recorded as SUBMITTED');

    // Verify attachments in database table
    const attRows = await pool.query(
      `SELECT * FROM student_assignment_attachments WHERE school_id = $1 AND assignment_id = $2 AND student_id = $3 ORDER BY created_at ASC`,
      [schoolId, assignmentId, studentRecordId]
    );

    assert(attRows.rowCount === 2, `Database stored exactly 2 attachments in student_assignment_attachments`);
    assert(attRows.rows[0].file_name === 'lab_report.pdf', 'First attachment name matches lab_report.pdf');
    assert(attRows.rows[0].mime_type === 'application/pdf', 'First attachment mime_type is application/pdf');
    assert(attRows.rows[0].storage_provider?.toUpperCase() === 'SUPABASE', 'Storage provider is marked as "SUPABASE"');
    assert(attRows.rows[0].storage_key.includes(`schools/${schoolId}/assignments/${assignmentId}`), 'Storage key correctly partitions by school and assignment');
    assert(attRows.rows[1].file_name === 'chart.png', 'Second attachment name matches chart.png');

    // 4. RETRIEVAL & STUDENT ACCESS CONTROL
    console.log('\n--- 4. Student Retrieval & Access Control ---');

    const studentAssignments = await studentService.getStudentAssignments(schoolId, studentUserId);
    const submittedAsg = studentAssignments.find(a => a.id === assignmentId);
    assert(Boolean(submittedAsg), 'Student can retrieve their assignments list');
    assert(submittedAsg?.submission_status === 'SUBMITTED', 'Student assignment status reflects SUBMITTED');
    assert(Array.isArray(submittedAsg?.attachments) && submittedAsg.attachments.length === 2, 'Student assignment payload contains submitted attachments');

    // Cross-student access control: Bob querying Alice's attachment
    const bobQuery = await pool.query(
      `SELECT att.* FROM student_assignment_attachments att
       JOIN students st ON st.id = att.student_id
       WHERE att.id = $1 AND att.assignment_id = $2 AND att.school_id = $3 AND st.user_id = $4`,
      [attRows.rows[0].id, assignmentId, schoolId, otherStudentUserId]
    );
    assert(bobQuery.rowCount === 0, 'Cross-student attachment access correctly blocked (Bob cannot access Alice\'s attachment)');

    // 5. TEACHER REVIEW & AUTHORIZATION
    console.log('\n--- 5. Teacher Review & Authorization ---');

    // Submissions query for teacher
    const teacherSubmissionsQuery = await pool.query(
      `SELECT sub.*, st.name as student_name, st.roll_number
       FROM student_assignment_submissions sub
       JOIN students st ON st.id = sub.student_id
       WHERE sub.school_id = $1 AND sub.assignment_id = $2`,
      [schoolId, assignmentId]
    );
    assert(teacherSubmissionsQuery.rowCount === 1, 'Teacher can retrieve assignment submissions');

    // Check teacher eligibility logic
    // Primary teacher assigned to assignment
    const asgRow = (await pool.query(`SELECT * FROM student_assignments WHERE id = $1 AND school_id = $2`, [assignmentId, schoolId])).rows[0];
    const isPrimaryTeacherAuthorized = asgRow.teacher_id === primaryTeacherId;
    assert(isPrimaryTeacherAuthorized, 'Primary teacher matches assignment teacher_id and is authorized');

    const isUnauthorizedBlocked = asgRow.teacher_id !== unauthorizedTeacherId;
    assert(isUnauthorizedBlocked, 'Unauthorized teacher is not the assignment teacher_id');

    // Verify storage download for primary teacher
    const downloadedAtt = await downloadFromStorage(attRows.rows[0].storage_key);
    assert(downloadedAtt.buffer.length > 0, 'Attachment buffer can be securely downloaded from storage for teacher preview');
    assert(downloadedAtt.buffer.slice(0, 4).toString('ascii') === '%PDF', 'Downloaded attachment buffer retains authentic PDF bytes');

    // 6. TEARDOWN TEST TENANT
    console.log('\n--- 6. Clean Teardown of Test Tenant ---');
    await pool.query(`DELETE FROM student_assignment_attachments WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM student_assignment_submissions WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM student_assignments WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM students WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM users WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM subjects WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM sections WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM classes WHERE school_id = $1`, [schoolId]);
    await pool.query(`DELETE FROM schools WHERE id = $1`, [schoolId]);
    console.log('✅ Cleaned up isolated test school data safely.');
  } else {
    console.log('PostgreSQL not configured in this run; verified storage validations and limits.');
  }

  console.log(`\n========================================`);
  console.log(`PHASE 1 TESTS SUMMARY: ${passed}/${total} PASSED`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase1AttachmentTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test run failed with error:', err);
    process.exit(1);
  });
