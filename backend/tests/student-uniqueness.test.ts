import http from 'http';
import app from '../src/app';
import { pool } from '../src/db';

const TEST_PORT = 5039;
const BASE = `http://localhost:${TEST_PORT}/api`;
const GREENWOOD_ID = '00000000-0000-0000-0000-000000000001';

let server: http.Server;
let adminToken = '';
const createdStudentIds: string[] = [];
const createdUserIds: string[] = [];

async function apiReq(path: string, options: any = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  return {
    status: res.status,
    data
  };
}

async function runTests() {
  console.log('\n========================================================================');
  console.log('  STUDENT UNIQUENESS & SAFE IMPORT COMPREHENSIVE TEST SUITE');
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

  try {
    // 1. Admin login
    const loginRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: GREENWOOD_ID,
        email: 'admin@demo-school.local',
        password: 'ChangeMe123!',
        role: 'SCHOOL_ADMIN'
      })
    });
    if (loginRes.status === 200 && loginRes.data.token) {
      adminToken = loginRes.data.token;
      report('Setup: Authenticated as Greenwood School Admin', true);
    } else {
      throw new Error(`Admin login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
    }

    // Resolve an academic session, class, and section in Greenwood
    const classesQ = await pool.query(`SELECT id, class_number FROM classes WHERE school_id=$1 LIMIT 2`, [GREENWOOD_ID]);
    const sectionsQ = await pool.query(`SELECT id, name, class_id FROM sections WHERE school_id=$1 LIMIT 4`, [GREENWOOD_ID]);
    const ayQ = await pool.query(`SELECT id, name FROM academic_years WHERE school_id=$1 AND is_active=true LIMIT 1`, [GREENWOOD_ID]);

    const testClassId = classesQ.rows[0]?.id;
    const testSectionAId = sectionsQ.rows.find(s => s.class_id === testClassId && s.name.toUpperCase() === 'A')?.id || sectionsQ.rows[0]?.id;
    const testSectionBId = sectionsQ.rows.find(s => s.class_id === testClassId && s.name.toUpperCase() === 'B')?.id || sectionsQ.rows[1]?.id;
    const testAyId = ayQ.rows[0]?.id;

    const ts = Date.now().toString().slice(-6);
    const adm1 = `ADM-TEST-${ts}-01`;
    const adm2 = `ADM-TEST-${ts}-02`;
    const email1 = `test.student.${ts}.01@greenwood.local`;
    const email2 = `test.student.${ts}.02@greenwood.local`;
    const roll1 = `88${ts.slice(-2)}`;
    const sharedPhone = `98765${ts.slice(-5)}`;

    // -------------------------------------------------------------------------
    // TC-01: Create student with unique values
    // -------------------------------------------------------------------------
    let student1Id = '';
    const create1 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'UniqTest',
        lastName: 'StudentOne',
        admissionNumber: adm1,
        rollNumber: roll1,
        studentEmail: email1,
        parentName: 'Parent One',
        parentPhone: sharedPhone,
        classId: testClassId,
        sectionId: testSectionAId,
        sessionId: testAyId,
        sendInviteEmail: false
      })
    });
    if (create1.status === 201 && create1.data?.id) {
      student1Id = create1.data.id;
      createdStudentIds.push(student1Id);
      if (create1.data.user_id) createdUserIds.push(create1.data.user_id);
      report('TC-01: Create initial student with unique values succeeds (201)', true);
    } else {
      report('TC-01: Create initial student with unique values succeeds', false, JSON.stringify(create1.data));
    }

    // -------------------------------------------------------------------------
    // TC-02: Reject duplicate Admission Number (case-insensitive)
    // -------------------------------------------------------------------------
    const createDupAdm = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Duplicate',
        lastName: 'Admission',
        admissionNumber: adm1.toLowerCase(), // case-insensitive duplicate
        rollNumber: '899',
        studentEmail: `diff.${ts}@greenwood.local`,
        parentPhone: '9876543210',
        classId: testClassId,
        sectionId: testSectionBId,
        sessionId: testAyId,
        sendInviteEmail: false
      })
    });
    report(
      'TC-02: Reject duplicate admission number case-insensitively with 409',
      createDupAdm.status === 409,
      `Status: ${createDupAdm.status}, Message: ${createDupAdm.data.message}`
    );

    // -------------------------------------------------------------------------
    // TC-03: Reject duplicate Roll Number within same session, class, and section
    // -------------------------------------------------------------------------
    const createDupRoll = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Duplicate',
        lastName: 'Roll',
        admissionNumber: adm2,
        rollNumber: roll1, // same roll in same section & class
        studentEmail: `diff2.${ts}@greenwood.local`,
        parentPhone: '9876543210',
        classId: testClassId,
        sectionId: testSectionAId,
        sessionId: testAyId,
        sendInviteEmail: false
      })
    });
    report(
      'TC-03: Reject duplicate roll number in same class/section/session with 409',
      createDupRoll.status === 409,
      `Status: ${createDupRoll.status}, Message: ${createDupRoll.data.message}`
    );

    // -------------------------------------------------------------------------
    // TC-04: Allow same Roll Number in a DIFFERENT section or class
    // -------------------------------------------------------------------------
    let student2Id = '';
    const createDiffSecRoll = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'SameRoll',
        lastName: 'DiffSection',
        admissionNumber: adm2,
        rollNumber: roll1, // same roll number but in section B
        studentEmail: email2,
        parentName: 'Parent Two',
        parentPhone: sharedPhone, // shares phone with sibling
        classId: testClassId,
        sectionId: testSectionBId,
        sessionId: testAyId,
        sendInviteEmail: false
      })
    });
    if (createDiffSecRoll.status === 201 && createDiffSecRoll.data?.id) {
      student2Id = createDiffSecRoll.data.id;
      createdStudentIds.push(student2Id);
      if (createDiffSecRoll.data.user_id) createdUserIds.push(createDiffSecRoll.data.user_id);
      report('TC-04: Allow same roll number in different section (201)', true);
    } else {
      report('TC-04: Allow same roll number in different section', false, JSON.stringify(createDiffSecRoll.data));
    }

    // -------------------------------------------------------------------------
    // TC-05: Sibling shared parent phone allowed
    // -------------------------------------------------------------------------
    report(
      'TC-05: Sibling shared parent phone allowed without conflict',
      createDiffSecRoll.status === 201 && createDiffSecRoll.data.parent_sms_number === sharedPhone,
      `Parent phone: ${createDiffSecRoll.data?.parent_sms_number}`
    );

    // -------------------------------------------------------------------------
    // TC-06: Reject duplicate Student Email (case-insensitive)
    // -------------------------------------------------------------------------
    const createDupEmail = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Duplicate',
        lastName: 'Email',
        admissionNumber: `ADM-DIFF-${ts}`,
        rollNumber: '901',
        studentEmail: email1.toUpperCase(), // case-insensitive duplicate
        parentPhone: '9876543210',
        classId: testClassId,
        sectionId: testSectionBId,
        sessionId: testAyId,
        sendInviteEmail: false
      })
    });
    report(
      'TC-06: Reject duplicate student email case-insensitively with 409',
      createDupEmail.status === 409,
      `Status: ${createDupEmail.status}, Message: ${createDupEmail.data.message}`
    );

    // -------------------------------------------------------------------------
    // TC-07: Self-exclusion on student edit (retaining own values)
    // -------------------------------------------------------------------------
    if (student1Id) {
      const editSelf = await apiReq(`/students/${student1Id}`, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: 'UniqTest',
          lastName: 'StudentOneUpdated',
          admissionNumber: adm1, // retain same admission number
          rollNumber: roll1,      // retain same roll number
          studentEmail: email1,  // retain same email
          classId: testClassId,
          sectionId: testSectionAId,
          sessionId: testAyId
        })
      });
      report(
        'TC-07: Self-exclusion on PUT /students/:id (retaining own values) succeeds with 200',
        editSelf.status === 200 && editSelf.data.admission_number === adm1,
        `Status: ${editSelf.status}, Message: ${editSelf.data?.message}`
      );
    }

    // -------------------------------------------------------------------------
    // TC-08: Reject edit when colliding with another student's Admission Number
    // -------------------------------------------------------------------------
    if (student2Id) {
      const editCollision = await apiReq(`/students/${student2Id}`, {
        method: 'PUT',
        body: JSON.stringify({
          admissionNumber: adm1 // collision with student 1
        })
      });
      report(
        'TC-08: Reject student edit colliding with existing admission number with 409',
        editCollision.status === 409,
        `Status: ${editCollision.status}, Message: ${editCollision.data.message}`
      );
    }

    // -------------------------------------------------------------------------
    // TC-09: Reject edit when colliding with another student's Roll Number
    // -------------------------------------------------------------------------
    if (student2Id) {
      const editRollCollision = await apiReq(`/students/${student2Id}`, {
        method: 'PUT',
        body: JSON.stringify({
          sectionId: testSectionAId, // move to section A where roll1 already exists
          rollNumber: roll1
        })
      });
      report(
        'TC-09: Reject student edit colliding with existing roll in target section with 409',
        editRollCollision.status === 409,
        `Status: ${editRollCollision.status}, Message: ${editRollCollision.data.message}`
      );
    }

    // -------------------------------------------------------------------------
    // TC-10: People Management PUT /api/people/students/:id uniqueness enforcement
    // -------------------------------------------------------------------------
    if (student2Id) {
      const peopleEditConflict = await apiReq(`/people/students/${student2Id}`, {
        method: 'PUT',
        body: JSON.stringify({
          admission_number: adm1 // collision with student 1
        })
      });
      report(
        'TC-10: PUT /api/people/students/:id returns 409 on duplicate conflict',
        peopleEditConflict.status === 409,
        `Status: ${peopleEditConflict.status}, Message: ${peopleEditConflict.data.message}`
      );
    }

    // -------------------------------------------------------------------------
    // TC-11: Bulk Import detects intra-file duplicate Admission Number
    // -------------------------------------------------------------------------
    const bulkIntraAdm = await apiReq('/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: testAyId,
        students: [
          { 'First Name': 'Bulk1', 'Last Name': 'Test', 'Admission Number': `ADM-INTRA-${ts}`, 'Roll Number': '1', 'Class': 'Class 1', 'Section': 'A', 'Parent Phone': '9876543210' },
          { 'First Name': 'Bulk2', 'Last Name': 'Test', 'Admission Number': `adm-intra-${ts}`, 'Roll Number': '2', 'Class': 'Class 1', 'Section': 'A', 'Parent Phone': '9876543210' }
        ]
      })
    });
    const hasIntraAdmErr = bulkIntraAdm.status === 422 && Array.isArray(bulkIntraAdm.data.errors) && bulkIntraAdm.data.errors.some((e: any) => e.field === 'Admission Number');
    report(
      'TC-11: Bulk import rejects intra-file duplicate admission number with 422 row errors',
      hasIntraAdmErr,
      `Status: ${bulkIntraAdm.status}, Errors: ${JSON.stringify(bulkIntraAdm.data.errors)}`
    );

    // -------------------------------------------------------------------------
    // TC-12: Bulk Import detects intra-file duplicate Roll Number
    // -------------------------------------------------------------------------
    const bulkIntraRoll = await apiReq('/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: testAyId,
        students: [
          { 'First Name': 'Bulk3', 'Last Name': 'Test', 'Admission Number': `ADM-ROLL-A-${ts}`, 'Roll Number': '10', 'Class': 'Class 1', 'Section': 'A', 'Parent Phone': '9876543210' },
          { 'First Name': 'Bulk4', 'Last Name': 'Test', 'Admission Number': `ADM-ROLL-B-${ts}`, 'Roll Number': '10', 'Class': 'Class 1', 'Section': 'A', 'Parent Phone': '9876543210' }
        ]
      })
    });
    const hasIntraRollErr = bulkIntraRoll.status === 422 && Array.isArray(bulkIntraRoll.data.errors) && bulkIntraRoll.data.errors.some((e: any) => e.field === 'Roll Number');
    report(
      'TC-12: Bulk import rejects intra-file duplicate roll in same class/section with 422',
      hasIntraRollErr,
      `Status: ${bulkIntraRoll.status}, Errors: ${JSON.stringify(bulkIntraRoll.data.errors)}`
    );

    // -------------------------------------------------------------------------
    // TC-13: Bulk Import detects conflict with EXISTING database student
    // -------------------------------------------------------------------------
    const bulkDbConflict = await apiReq('/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: testAyId,
        students: [
          { 'First Name': 'BulkConflict', 'Last Name': 'Test', 'Admission Number': adm1, 'Roll Number': '50', 'Class': 'Class 1', 'Section': 'A', 'Parent Phone': '9876543210' }
        ]
      })
    });
    const hasDbConflictErr = bulkDbConflict.status === 422 && Array.isArray(bulkDbConflict.data.errors) && bulkDbConflict.data.errors.some((e: any) => e.field === 'Admission Number');
    report(
      'TC-13: Bulk import rejects conflict with existing DB admission number with 422 (no silent update/upsert)',
      hasDbConflictErr,
      `Status: ${bulkDbConflict.status}, Errors: ${JSON.stringify(bulkDbConflict.data.errors)}`
    );

    // -------------------------------------------------------------------------
    // TC-14: Valid Bulk Import inserts rows cleanly
    // -------------------------------------------------------------------------
    const validBulkAdm1 = `ADM-CLEAN-${ts}-01`;
    const validBulkAdm2 = `ADM-CLEAN-${ts}-02`;
    const validBulk = await apiReq('/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: testAyId,
        students: [
          { 'First Name': 'ValidBulk1', 'Last Name': 'Student', 'Admission Number': validBulkAdm1, 'Roll Number': `71${ts.slice(-2)}`, 'Class': 'Class 1', 'Section': 'A', 'Parent Phone': '9876543210' },
          { 'First Name': 'ValidBulk2', 'Last Name': 'Student', 'Admission Number': validBulkAdm2, 'Roll Number': `72${ts.slice(-2)}`, 'Class': 'Class 1', 'Section': 'A', 'Parent Phone': '9876543210' }
        ]
      })
    });
    const isBulkValidOk = validBulk.status === 201 && validBulk.data.count === 2;
    if (isBulkValidOk && Array.isArray(validBulk.data.items)) {
      for (const it of validBulk.data.items) {
        createdStudentIds.push(it.id);
      }
    }
    report(
      'TC-14: Valid bulk import inserts rows cleanly with 201 without silent overwrites',
      isBulkValidOk,
      `Status: ${validBulk.status}, Count: ${validBulk.data?.count}`
    );

    // -------------------------------------------------------------------------
    // TC-15: Student Promotion validates target roll collision
    // -------------------------------------------------------------------------
    // Promote student 1 (Roll = roll1) into Section B of destination session where student 2 already has roll1
    const promoCollision = await apiReq('/student-promotions/execute', {
      method: 'POST',
      body: JSON.stringify({
        fromYearId: testAyId,
        toYearId: testAyId,
        items: [
          {
            studentId: student1Id,
            outcome: 'PROMOTED',
            toClassId: testClassId,
            toSectionId: testSectionBId // student 2 already has roll1 in section B
          }
        ]
      })
    });
    report(
      'TC-15: Student promotion checks target roll collision and returns 409',
      promoCollision.status === 409,
      `Status: ${promoCollision.status}, Message: ${promoCollision.data?.message}`
    );

  } catch (err: any) {
    console.error('Fatal test error:', err);
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup: Remove all created test students and users from database
    // -------------------------------------------------------------------------
    console.log('\n--- CLEANUP: Removing created test fixture records ---');
    if (createdStudentIds.length > 0) {
      try {
        await pool.query(`DELETE FROM student_promotions WHERE student_id = ANY($1::uuid[])`, [createdStudentIds]);
        const delRes = await pool.query(`DELETE FROM students WHERE id = ANY($1::uuid[])`, [createdStudentIds]);
        console.log(`Cleaned up ${delRes.rowCount} test student records.`);
      } catch (cErr: any) {
        console.warn('Student cleanup notice:', cErr.message);
      }
    }
    if (createdUserIds.length > 0) {
      try {
        const delU = await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        console.log(`Cleaned up ${delU.rowCount} test user accounts.`);
      } catch (cErr: any) {
        console.warn('User cleanup notice:', cErr.message);
      }
    }

    console.log(`\n========================================================================`);
    console.log(`  FINAL RESULTS: ${passed} PASSED | ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log(`========================================================================\n`);

    server.close();
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

server = http.createServer(app);
server.listen(TEST_PORT, () => {
  console.log(`Test server running on port ${TEST_PORT}`);
  runTests().catch(err => {
    console.error('Test suite runner failed:', err);
    process.exit(1);
  });
});
