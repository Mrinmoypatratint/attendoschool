import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { pool } from '../src/db';
import { env } from '../src/config/env';
import { normalizePhoneNumber, checkRollNumberConflict } from '../src/utils/studentValidation';

const TEST_PORT = 5056;
const BASE = `http://localhost:${TEST_PORT}/api`;
const GREENWOOD_ID = '00000000-0000-0000-0000-000000000001';
const SCHOOL_B_ID = '77777777-7777-4777-7777-777777777777';

let server: http.Server;
let adminTokenA = '';
let adminTokenB = '';

const createdStudentIds: string[] = [];
const createdTeacherUserIds: string[] = [];

async function apiReq(path: string, options: any = {}, token: string = adminTokenA) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  return {
    status: res.status,
    data
  };
}

const isUuid = (val: any): boolean =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

async function runTests() {
  console.log('\n========================================================================');
  console.log('  STUDENT & TEACHER UNIQUENESS COMPREHENSIVE VERIFICATION SUITE (V3)');
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
    // 1. Setup Auth Tokens
    adminTokenA = jwt.sign({
      id: '00000000-0000-0000-0000-000000000021',
      schoolId: GREENWOOD_ID,
      name: 'Greenwood Admin',
      email: 'admin@demo-school.local',
      role: 'SCHOOL_ADMIN'
    }, env.jwtSecret, { algorithm: 'HS256' });

    adminTokenB = jwt.sign({
      id: '77777777-7777-4777-7777-000000000001',
      schoolId: SCHOOL_B_ID,
      name: 'School B Admin',
      email: 'admin@school-b.local',
      role: 'SCHOOL_ADMIN'
    }, env.jwtSecret, { algorithm: 'HS256' });

    report('Setup: Authenticated School A and School B admin tokens generated', true);

    // Resolve test classes, sections, and academic year in Greenwood
    const classesQ = await pool.query(`SELECT id, class_number FROM classes WHERE school_id=$1 LIMIT 2`, [GREENWOOD_ID]);
    const sectionsQ = await pool.query(`SELECT id, name, class_id FROM sections WHERE school_id=$1 LIMIT 4`, [GREENWOOD_ID]);
    const ayQ = await pool.query(`SELECT id, name FROM academic_years WHERE school_id=$1 AND is_active=true LIMIT 1`, [GREENWOOD_ID]);

    if (classesQ.rowCount === 0 || sectionsQ.rowCount === 0) {
      throw new Error('Classes or sections missing in Greenwood test school.');
    }

    const testClass1Id = classesQ.rows[0].id;
    const testClass2Id = classesQ.rows[1]?.id || classesQ.rows[0].id;
    const testSectionAId = sectionsQ.rows.find(s => s.class_id === testClass1Id && s.name.toUpperCase() === 'A')?.id || sectionsQ.rows[0].id;
    const testSectionBId = sectionsQ.rows.find(s => s.class_id === testClass1Id && s.name.toUpperCase() === 'B')?.id || sectionsQ.rows[1]?.id;
    const testAyId = ayQ.rows[0]?.id;

    // Resolve class/section for School B
    const classesBQ = await pool.query(`SELECT id FROM classes WHERE school_id=$1 LIMIT 1`, [SCHOOL_B_ID]);
    const sectionsBQ = await pool.query(`SELECT id FROM sections WHERE school_id=$1 LIMIT 1`, [SCHOOL_B_ID]);
    const testClassBId = classesBQ.rows[0]?.id || testClass1Id;
    const testSectionB_BId = sectionsBQ.rows[0]?.id || testSectionAId;

    const ts = Date.now().toString().slice(-6);
    const phoneSuffix = ts.padStart(5, '0').slice(-5);
    const baseNumeric = ts.replace(/\D/g, '').padStart(6, '0').slice(-6);

    // -------------------------------------------------------------------------
    // SCENARIO 1: Creating two students with the same admission number
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 1: Student Admission Number Uniqueness ---');
    const adm1 = `81${baseNumeric}`;
    const resS1_1 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Amit',
        lastName: 'Verma',
        dob: '2012-05-10',
        admissionNumber: adm1,
        rollNumber: `101`,
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: `98100${phoneSuffix}`,
        email: `amit.v.${ts}@demo.local`
      })
    });
    report('TC-01a: Create first student with unique admission number succeeds (201)', resS1_1.status === 201);
    if (resS1_1.data?.id && isUuid(resS1_1.data.id)) createdStudentIds.push(resS1_1.data.id);

    const resS1_2 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Rohit',
        lastName: 'Verma',
        dob: '2012-06-11',
        admissionNumber: adm1, // DUPLICATE ADMISSION NUMBER
        rollNumber: `102`,
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: `98101${phoneSuffix}`,
        email: `rohit.v.${ts}@demo.local`
      })
    });
    report(
      'TC-01b: Create second student with duplicate admission number fails (409 Conflict)',
      resS1_2.status === 409 && resS1_2.data?.message?.includes('admission number'),
      `Status: ${resS1_2.status}, Message: ${resS1_2.data?.message}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 2: Creating two students with the same email using different letter cases
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 2: Student Email Case-Insensitive Uniqueness ---');
    const emailUpper = `CaseStudent.${ts}@DemoSchool.Local`;
    const emailLower = `casestudent.${ts}@demoschool.local`;
    const resS2_1 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Priya',
        lastName: 'Sharma',
        dob: '2012-07-15',
        admissionNumber: `82${baseNumeric}`,
        rollNumber: `103`,
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: `98102${phoneSuffix}`,
        email: emailUpper
      })
    });
    report('TC-02a: Create student with mixed-case email succeeds (201)', resS2_1.status === 201);
    if (resS2_1.data?.id && isUuid(resS2_1.data.id)) createdStudentIds.push(resS2_1.data.id);

    const resS2_2 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Neha',
        lastName: 'Sharma',
        dob: '2012-08-20',
        admissionNumber: `83${baseNumeric}`,
        rollNumber: `104`,
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: `98103${phoneSuffix}`,
        email: emailLower // DUPLICATE CASE-INSENSITIVE EMAIL
      })
    });
    report(
      'TC-02b: Create student with lower-case duplicate email fails (409 Conflict)',
      resS2_2.status === 409 && resS2_2.data?.message?.includes('email'),
      `Status: ${resS2_2.status}, Message: ${resS2_2.data?.message}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 3: Phone Normalization & Formatting Equivalency
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Phone Normalization Equivalency ---');
    const p1 = normalizePhoneNumber('+91 98104 12345');
    const p2 = normalizePhoneNumber('09810412345');
    const p3 = normalizePhoneNumber('9810412345');
    const p4 = normalizePhoneNumber('98104-12345');
    const pEmpty = normalizePhoneNumber('');
    const pShort = normalizePhoneNumber('12345');
    const pNull = normalizePhoneNumber(null);

    report(
      'TC-03a: Phone normalization maps +91, 0-prefix, hyphens, and spaces to standard 10 digits',
      p1 === '9810412345' && p2 === '9810412345' && p3 === '9810412345' && p4 === '9810412345'
    );
    report(
      'TC-03b: Empty, null, and short incomplete phone numbers return null (never collide)',
      pEmpty === null && pShort === null && pNull === null
    );

    const rawPhoneWithCode = `+91 98104 ${phoneSuffix}`;
    const rawPhoneDigitsOnly = `98104${phoneSuffix}`;
    const resS3_1 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Anil',
        lastName: 'Gupta',
        dob: '2012-09-01',
        admissionNumber: `84${baseNumeric}`,
        rollNumber: `105`,
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: rawPhoneWithCode,
        fatherName: 'Ram Gupta',
        email: `anil.g.${ts}@demo.local`
      })
    });
    report('TC-03c: Create student with phone (+91 formatted) succeeds (201)', resS3_1.status === 201);
    if (resS3_1.data?.id && isUuid(resS3_1.data.id)) createdStudentIds.push(resS3_1.data.id);

    const resS3_2 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Sunil',
        lastName: 'Verma', // Unrelated student (different father)
        fatherName: 'Kishore Verma',
        dob: '2012-10-05',
        admissionNumber: `85${baseNumeric}`,
        rollNumber: `106`,
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: rawPhoneDigitsOnly, // DUPLICATE PHONE FORMAT
        email: `sunil.g.${ts}@demo.local`
      })
    });
    report(
      'TC-03d: Unrelated student with differently-formatted duplicate phone fails (409 Conflict)',
      resS3_2.status === 409 && resS3_2.data?.message?.includes('phone number'),
      `Status: ${resS3_2.status}, Message: ${resS3_2.data?.message}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 4: Sibling Exception Model for Parent Phone
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 4: Sibling Exception Model for Shared Parent Phone ---');
    const resS4_Sibling = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Mukesh',
        lastName: 'Gupta',
        fatherName: 'Ram Gupta', // MATCHES S3_1 (SIBLING)
        dob: '2014-04-12',
        admissionNumber: `89${baseNumeric}`,
        rollNumber: `107`,
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: `98104${phoneSuffix}`, // SAME FAMILY GUARDIAN CONTACT
        email: `mukesh.g.${ts}@demo.local`
      })
    });
    report(
      'TC-04: Sibling sharing parent phone with matching father name is permitted (201 Success)',
      resS4_Sibling.status === 201,
      `Status: ${resS4_Sibling.status}, Message: ${resS4_Sibling.data?.message}`
    );
    if (resS4_Sibling.data?.id && isUuid(resS4_Sibling.data.id)) createdStudentIds.push(resS4_Sibling.data.id);

    // -------------------------------------------------------------------------
    // SCENARIO 5: Duplicate roll number within the same class/section/session scope
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 5: Duplicate Roll Number in Same Class & Section ---');
    const scopedRoll = `250`;
    const resS5_1 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Karan',
        lastName: 'Mehra',
        dob: '2012-11-12',
        admissionNumber: `86${baseNumeric}`,
        rollNumber: scopedRoll,
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: `98105${phoneSuffix}`,
        email: `karan.m.${ts}@demo.local`
      })
    });
    report('TC-05a: Create student with scoped roll number in Class 1 Sec A succeeds (201)', resS5_1.status === 201);
    if (resS5_1.data?.id && isUuid(resS5_1.data.id)) createdStudentIds.push(resS5_1.data.id);

    const resS5_2 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Simran',
        lastName: 'Mehra',
        dob: '2012-12-18',
        admissionNumber: `87${baseNumeric}`,
        rollNumber: scopedRoll, // DUPLICATE ROLL NUMBER IN SAME SECTION
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: `98106${phoneSuffix}`,
        email: `simran.m.${ts}@demo.local`
      })
    });
    report(
      'TC-05b: Create student with duplicate roll number in same class/section fails (409 Conflict)',
      resS5_2.status === 409 && resS5_2.data?.message?.includes('roll number'),
      `Status: ${resS5_2.status}, Message: ${resS5_2.data?.message}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 6: Same roll number in different class/section where permitted
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 6: Same Roll Number in Different Class/Section ---');
    const resS6 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Deepak',
        lastName: 'Mehra',
        dob: '2012-01-25',
        admissionNumber: `88${baseNumeric}`,
        rollNumber: scopedRoll, // SAME ROLL NUMBER BUT IN SECTION B
        classId: testClass1Id,
        sectionId: testSectionBId,
        sessionId: testAyId,
        parentPhone: `98107${phoneSuffix}`,
        email: `deepak.m.${ts}@demo.local`
      })
    });
    report('TC-06: Same roll number in different section succeeds (201)', resS6.status === 201);
    if (resS6.data?.id && isUuid(resS6.data.id)) createdStudentIds.push(resS6.data.id);

    // -------------------------------------------------------------------------
    // SCENARIO 7: Inactive historical student roll number reuse & academic session handling
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 7: Inactive Student Roll Number Reuse & Academic Session Scope ---');
    const inactiveRoll = `299`;
    const resS7_1 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'OldStudent',
        lastName: 'Leaving',
        dob: '2012-02-14',
        admissionNumber: `71${baseNumeric}`,
        rollNumber: inactiveRoll,
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: `98108${phoneSuffix}`,
        email: `old.leaving.${ts}@demo.local`
      })
    });
    report('TC-07a: Create student with roll 299 succeeds (201)', resS7_1.status === 201);
    if (resS7_1.data?.id && isUuid(resS7_1.data.id)) createdStudentIds.push(resS7_1.data.id);

    // Verify active student blocks duplicate roll number in validation
    const preConflict = await checkRollNumberConflict(GREENWOOD_ID, testAyId, testClass1Id, testSectionAId, inactiveRoll);
    report('TC-07b: Active student roll number triggers conflict in validation', preConflict.conflict === true);

    // Deactivate Student 1 (withdrew from school / graduated)
    await pool.query(`UPDATE students SET is_active = false WHERE id = $1`, [resS7_1.data.id]);

    // Validation recognizes that historical inactive student does not block roll number reassignment
    const postDeactivate = await checkRollNumberConflict(GREENWOOD_ID, testAyId, testClass1Id, testSectionAId, inactiveRoll);
    report(
      'TC-07c: Inactive historical student roll number is cleared for reassignment in application validation',
      postDeactivate.conflict === false
    );

    // Roll number reuse across different academic sessions (different academic_year_id)
    const diffAyRoll = await checkRollNumberConflict(
      GREENWOOD_ID,
      '00000000-0000-0000-0000-000000000099', // Future academic session
      testClass1Id,
      testSectionAId,
      inactiveRoll
    );
    report(
      'TC-07d: Roll number can be independently assigned in a different academic session',
      diffAyRoll.conflict === false
    );

    // -------------------------------------------------------------------------
    // SCENARIO 8: Student Self-Exclusion on Edit
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 8: Student Self-Exclusion on Edit ---');
    const s1Id = resS1_1.data.id;
    const resS8 = await apiReq(`/students/${s1Id}`, {
      method: 'PUT',
      body: JSON.stringify({
        firstName: 'Amith', // name changed
        lastName: 'Verma',
        dob: '2012-05-10',
        admissionNumber: adm1, // RETAINS OWN ADMISSION NUMBER
        rollNumber: `101`, // RETAINS OWN ROLL
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: `98100${phoneSuffix}`, // RETAINS OWN PHONE
        email: `amit.v.${ts}@demo.local` // RETAINS OWN EMAIL
      })
    });
    report(
      'TC-08: Student can edit profile keeping existing unique values without triggering false duplicate (200 OK)',
      resS8.status === 200,
      `Status: ${resS8.status}, Message: ${resS8.data?.message}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 9: Empty / Optional Phone Fields do not collide
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 9: Empty Optional Phone Fields ---');
    const resS9_1 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'NoPhoneOne',
        lastName: 'Test',
        dob: '2012-04-01',
        admissionNumber: `73${baseNumeric}`,
        rollNumber: `201`,
        classId: testClass1Id,
        sectionId: testSectionBId,
        sessionId: testAyId,
        parentPhone: '', // EMPTY PHONE
        fatherPhone: '',
        email: `nophone1.${ts}@demo.local`
      })
    });
    report('TC-09a: Student with empty phone field succeeds (201)', resS9_1.status === 201);
    if (resS9_1.data?.id && isUuid(resS9_1.data.id)) createdStudentIds.push(resS9_1.data.id);

    const resS9_2 = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'NoPhoneTwo',
        lastName: 'Test',
        dob: '2012-04-02',
        admissionNumber: `74${baseNumeric}`,
        rollNumber: `202`,
        classId: testClass1Id,
        sectionId: testSectionBId,
        sessionId: testAyId,
        parentPhone: '', // SECOND STUDENT WITH EMPTY PHONE
        fatherPhone: '',
        email: `nophone2.${ts}@demo.local`
      })
    });
    report(
      'TC-09b: Second student with empty phone does not collide with first (201 Success)',
      resS9_2.status === 201,
      `Status: ${resS9_2.status}, Message: ${resS9_2.data?.message}`
    );
    if (resS9_2.data?.id && isUuid(resS9_2.data.id)) createdStudentIds.push(resS9_2.data.id);

    // -------------------------------------------------------------------------
    // SCENARIO 10: Teacher Employee ID / Saviour ID Uniqueness within school
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 10: Teacher Employee ID / Saviour ID Uniqueness ---');
    const empId1 = `EMP${ts}01`;
    const resT10_1 = await apiReq('/teachers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Rajesh',
        lastName: 'Sharma',
        email: `rajesh.s.${ts}@school.local`,
        employeeId: empId1,
        mobile: `98200${phoneSuffix}`,
        designation: 'TGT Science',
        gender: 'Male',
        joiningDate: '01-07-2022'
      })
    });
    report('TC-10a: Create teacher with unique employee ID succeeds (201)', resT10_1.status === 201);
    if (resT10_1.data?.id && isUuid(resT10_1.data.id)) createdTeacherUserIds.push(resT10_1.data.id);

    const resT10_2 = await apiReq('/teachers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Vikram',
        lastName: 'Sharma',
        email: `vikram.s.${ts}@school.local`,
        employeeId: empId1.toLowerCase(), // DUPLICATE EMPLOYEE ID (case-insensitive)
        mobile: `98201${phoneSuffix}`,
        designation: 'PRT Hindi',
        gender: 'Male',
        joiningDate: '01-08-2022'
      })
    });
    report(
      'TC-10b: Create teacher with duplicate Employee ID fails (409 Conflict)',
      resT10_2.status === 409 && resT10_2.data?.message?.includes('Employee/Saviour ID'),
      `Status: ${resT10_2.status}, Message: ${resT10_2.data?.message}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 11: Global Teacher Email Uniqueness
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 11: Global Teacher Email Uniqueness ---');
    const tEmailUpper = `CaseTeacher.${ts}@DemoSchool.Local`;
    const tEmailLower = `caseteacher.${ts}@demoschool.local`;
    const resT11_1 = await apiReq('/teachers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Kavita',
        lastName: 'Patel',
        email: tEmailUpper,
        employeeId: `EMP${ts}02`,
        mobile: `98202${phoneSuffix}`,
        designation: 'Senior Teacher',
        gender: 'Female',
        joiningDate: '01-09-2021'
      })
    }, adminTokenA);
    report('TC-11a: Create teacher in School A with mixed-case email succeeds (201)', resT11_1.status === 201);
    if (resT11_1.data?.id && isUuid(resT11_1.data.id)) createdTeacherUserIds.push(resT11_1.data.id);

    // School B attempts to register a teacher with the same email
    const resT11_2 = await apiReq('/teachers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Sunita',
        lastName: 'Patel',
        email: tEmailLower, // DUPLICATE CASE-INSENSITIVE EMAIL IN SCHOOL B
        employeeId: `EMP${ts}03`,
        mobile: `98203${phoneSuffix}`,
        designation: 'TGT English',
        gender: 'Female',
        joiningDate: '01-10-2021'
      })
    }, adminTokenB);
    report(
      'TC-11b: Create teacher in School B with duplicate email fails across tenants (409 Conflict - Global Email)',
      resT11_2.status === 409 && resT11_2.data?.message?.includes('email'),
      `Status: ${resT11_2.status}, Message: ${resT11_2.data?.message}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 12: Teacher Phone Normalization & Scope
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 12: Teacher Phone Normalization & Scope ---');
    const sharedTeachPhone = `98204${phoneSuffix}`;
    const resT12_1 = await apiReq('/teachers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Manoj',
        lastName: 'Tiwari',
        email: `manoj.t.${ts}@school.local`,
        employeeId: `EMP${ts}04`,
        mobile: `+91 ${sharedTeachPhone}`, // FORMATTED PHONE
        designation: 'PGT Physics',
        gender: 'Male',
        joiningDate: '15-07-2020'
      })
    }, adminTokenA);
    report('TC-12a: Create teacher in School A with phone (+91 formatted) succeeds (201)', resT12_1.status === 201);
    if (resT12_1.data?.id && isUuid(resT12_1.data.id)) createdTeacherUserIds.push(resT12_1.data.id);

    // Duplicate within same school fails
    const resT12_2 = await apiReq('/teachers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Sanjay',
        lastName: 'Tiwari',
        email: `sanjay.t.${ts}@school.local`,
        employeeId: `EMP${ts}05`,
        mobile: sharedTeachPhone, // SAME PHONE IN SCHOOL A
        designation: 'PGT Chemistry',
        gender: 'Male',
        joiningDate: '15-08-2020'
      })
    }, adminTokenA);
    report(
      'TC-12b: Create second teacher in School A with duplicate phone fails (409 Conflict)',
      resT12_2.status === 409 && resT12_2.data?.message?.includes('phone number'),
      `Status: ${resT12_2.status}, Message: ${resT12_2.data?.message}`
    );

    // Separate school B can independently have teacher with the same phone number (school-scoped)
    const resT12_3 = await apiReq('/teachers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'SchoolB',
        lastName: 'Faculty',
        email: `schoolb.fac.${ts}@schoolb.local`,
        employeeId: `EMP-B-${ts}-09`,
        mobile: sharedTeachPhone, // SAME PHONE IN SCHOOL B
        designation: 'Senior Faculty',
        gender: 'Female',
        joiningDate: '01-01-2021'
      })
    }, adminTokenB);
    report(
      'TC-12c: Teacher in School B can use same phone number independently (201 Success - School-Scoped Phone)',
      resT12_3.status === 201,
      `Status: ${resT12_3.status}, Message: ${resT12_3.data?.message}`
    );
    if (resT12_3.data?.id && isUuid(resT12_3.data.id)) createdTeacherUserIds.push(resT12_3.data.id);

    // -------------------------------------------------------------------------
    // SCENARIO 13: Teacher Self-Exclusion on Edit
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 13: Teacher Self-Exclusion on Edit ---');
    const t1Id = resT10_1.data.id;
    const resT13 = await apiReq(`/teachers/${t1Id}`, {
      method: 'PUT',
      body: JSON.stringify({
        firstName: 'Rajesh',
        middleName: 'Kumar',
        lastName: 'Sharma',
        email: `rajesh.s.${ts}@school.local`, // RETAINS OWN EMAIL
        employeeId: empId1, // RETAINS OWN EMPLOYEE ID
        mobile: `98200${phoneSuffix}`, // RETAINS OWN PHONE
        designation: 'Head of Science',
        gender: 'Male',
        joiningDate: '01-07-2022'
      })
    });
    report(
      'TC-13: Teacher can edit profile keeping existing unique values without triggering false duplicate (200 OK)',
      resT13.status === 200,
      `Status: ${resT13.status}, Message: ${resT13.data?.message}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 14: Bulk-Import Intra-File Duplicates Detection
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 14: Bulk-Import Intra-File Duplicates Detection ---');
    // Student Bulk Import intra-file duplicate
    const resS14 = await apiReq('/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        students: [
          {
            firstName: 'BatchOne',
            lastName: 'Student',
            dob: '2013-01-01',
            admissionNumber: `91${baseNumeric}`,
            rollNumber: `301`,
            classId: testClass1Id,
            sectionId: testSectionAId,
            session: '2025-26',
            parentPhone: `98300${phoneSuffix}`,
            studentEmail: `batch.a.${ts}@demo.local`
          },
          {
            firstName: 'BatchTwo',
            lastName: 'Student',
            dob: '2013-01-02',
            admissionNumber: `91${baseNumeric}`, // DUPLICATE WITHIN FILE
            rollNumber: `302`,
            classId: testClass1Id,
            sectionId: testSectionAId,
            session: '2025-26',
            parentPhone: `98301${phoneSuffix}`,
            studentEmail: `batch.b.${ts}@demo.local`
          }
        ]
      })
    });
    report(
      'TC-14a: Student bulk import rejects file containing intra-file duplicate admission numbers (422)',
      resS14.status === 422 && Array.isArray(resS14.data?.errors) && resS14.data.errors.length > 0,
      `Status: ${resS14.status}, Message: ${resS14.data?.message}`
    );

    // Teacher Bulk Import intra-file duplicate
    const resT14 = await apiReq('/teachers/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        teachers: [
          {
            firstName: 'BatchAlpha',
            lastName: 'Teacher',
            saviorNo: `EMP-B-${ts}-01`,
            email: `batch.t1.${ts}@school.local`,
            mobile: `98400${phoneSuffix}`,
            designation: 'Teacher',
            joiningDate: '01-01-2023'
          },
          {
            firstName: 'BatchBeta',
            lastName: 'Teacher',
            saviorNo: `EMP-B-${ts}-01`, // DUPLICATE WITHIN FILE
            email: `batch.t2.${ts}@school.local`,
            mobile: `98401${phoneSuffix}`,
            designation: 'Teacher',
            joiningDate: '01-01-2023'
          }
        ]
      })
    });
    report(
      'TC-14b: Teacher bulk import rejects file containing intra-file duplicate employee IDs (422)',
      resT14.status === 422 && Array.isArray(resT14.data?.errors) && resT14.data.errors.length > 0,
      `Status: ${resT14.status}, Message: ${resT14.data?.message}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 15: Bulk-Import Against Existing Database Records
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 15: Bulk-Import Against Existing Database Records ---');
    const resS15 = await apiReq('/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        students: [
          {
            firstName: 'Incoming',
            lastName: 'Student',
            dob: '2013-02-01',
            admissionNumber: adm1, // COLLIDES WITH S1 IN DATABASE
            rollNumber: `350`,
            classId: testClass1Id,
            sectionId: testSectionAId,
            session: '2025-26',
            parentPhone: `98500${phoneSuffix}`,
            studentEmail: `incoming.${ts}@demo.local`
          }
        ]
      })
    });
    report(
      'TC-15a: Student bulk import rejects file colliding with existing database record (422)',
      resS15.status === 422 && Array.isArray(resS15.data?.errors) && resS15.data.errors.length > 0,
      `Status: ${resS15.status}, Message: ${resS15.data?.message}`
    );

    const resT15 = await apiReq('/teachers/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        teachers: [
          {
            firstName: 'Incoming',
            lastName: 'Teacher',
            saviorNo: empId1, // COLLIDES WITH T1 IN DATABASE
            email: `incoming.t.${ts}@school.local`,
            mobile: `98501${phoneSuffix}`,
            designation: 'Teacher',
            joiningDate: '01-01-2023'
          }
        ]
      })
    });
    report(
      'TC-15b: Teacher bulk import rejects file colliding with existing database record (422)',
      resT15.status === 422 && Array.isArray(resT15.data?.errors) && resT15.data.errors.length > 0,
      `Status: ${resT15.status}, Message: ${resT15.data?.message}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 16: Two schools having independent records with the same school-scoped identifiers
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 16: School-Scoped Isolation for Student Identifiers ---');
    const sharedScopedAdm = `95${baseNumeric}`;
    const sharedScopedRoll = `401`;

    // School A creates student
    const resS16_A = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'SchoolA',
        lastName: 'Student',
        dob: '2012-04-10',
        admissionNumber: sharedScopedAdm,
        rollNumber: sharedScopedRoll,
        classId: testClass1Id,
        sectionId: testSectionAId,
        sessionId: testAyId,
        parentPhone: `98600${phoneSuffix}`,
        email: `schoola.st.${ts}@demo.local`
      })
    }, adminTokenA);
    report('TC-16a: School A creates student with identifier 95xxxx succeeds (201)', resS16_A.status === 201);
    if (resS16_A.data?.id && isUuid(resS16_A.data.id)) createdStudentIds.push(resS16_A.data.id);

    // School B creates student with exact same admission number and roll number
    const resS16_B = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'SchoolB',
        lastName: 'Student',
        dob: '2012-04-10',
        admissionNumber: sharedScopedAdm, // SAME ADMISSION NUMBER IN DIFFERENT TENANT
        rollNumber: sharedScopedRoll, // SAME ROLL NUMBER IN DIFFERENT TENANT
        classId: testClassBId,
        sectionId: testSectionB_BId,
        parentPhone: `98601${phoneSuffix}`,
        email: `schoolb.st.${ts}@demo.local`
      })
    }, adminTokenB);
    report(
      'TC-16b: School B creates student with identical admission number and roll number independently (201 Success)',
      resS16_B.status === 201,
      `Status: ${resS16_B.status}, Message: ${resS16_B.data?.message}`
    );
    if (resS16_B.data?.id && isUuid(resS16_B.data.id)) createdStudentIds.push(resS16_B.data.id);

    // -------------------------------------------------------------------------
    // SCENARIO 17: Concurrency Protection
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 17: Concurrency Protection ---');
    const concAdm = `99${baseNumeric}`;
    const [concResS1, concResS2] = await Promise.all([
      apiReq('/students', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'ConcOne',
          lastName: 'Student',
          dob: '2012-03-01',
          admissionNumber: concAdm,
          rollNumber: `501`,
          classId: testClass1Id,
          sectionId: testSectionAId,
          sessionId: testAyId,
          parentPhone: `98700${phoneSuffix}`,
          email: `conc1.${ts}@demo.local`
        })
      }),
      apiReq('/students', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'ConcTwo',
          lastName: 'Student',
          dob: '2012-03-02',
          admissionNumber: concAdm, // RACING CONCURRENT ADMISSION NUMBER
          rollNumber: `502`,
          classId: testClass1Id,
          sectionId: testSectionAId,
          sessionId: testAyId,
          parentPhone: `98701${phoneSuffix}`,
          email: `conc2.${ts}@demo.local`
        })
      })
    ]);

    if (concResS1.data?.id && isUuid(concResS1.data.id)) createdStudentIds.push(concResS1.data.id);
    if (concResS2.data?.id && isUuid(concResS2.data.id)) createdStudentIds.push(concResS2.data.id);

    const sStatuses = [concResS1.status, concResS2.status].sort();
    report(
      'TC-17a: Simultaneous student creation with conflicting admission number results in exactly 1 Success (201) and 1 Conflict (409)',
      sStatuses[0] === 201 && sStatuses[1] === 409,
      `Received statuses: [${concResS1.status}, ${concResS2.status}]`
    );

    const concEmp = `EMPCONC${ts}`;
    const [concResT1, concResT2] = await Promise.all([
      apiReq('/teachers', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'ConcAlpha',
          lastName: 'Sharma',
          email: `conc.t1.${ts}@school.local`,
          employeeId: concEmp,
          mobile: `98702${phoneSuffix}`,
          designation: 'Teacher',
          gender: 'Male',
          joiningDate: '01-01-2023'
        })
      }),
      apiReq('/teachers', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'ConcBeta',
          lastName: 'Sharma',
          email: `conc.t2.${ts}@school.local`,
          employeeId: concEmp, // RACING CONCURRENT EMPLOYEE ID
          mobile: `98703${phoneSuffix}`,
          designation: 'Teacher',
          gender: 'Male',
          joiningDate: '01-01-2023'
        })
      })
    ]);

    if (concResT1.data?.id && isUuid(concResT1.data.id)) createdTeacherUserIds.push(concResT1.data.id);
    if (concResT2.data?.id && isUuid(concResT2.data.id)) createdTeacherUserIds.push(concResT2.data.id);

    const tStatuses = [concResT1.status, concResT2.status].sort();
    report(
      'TC-17b: Simultaneous teacher creation with conflicting Employee ID results in exactly 1 Success (201) and 1 Conflict (409)',
      tStatuses[0] === 201 && tStatuses[1] === 409,
      `Received statuses: [${concResT1.status}, ${concResT2.status}]`
    );

  } catch (err: any) {
    console.error('Fatal test error:', err);
  } finally {
    console.log('\n--- CLEANUP: Removing created test fixture records ---');
    const validStudentUuids = createdStudentIds.filter(isUuid);
    const validTeacherUuids = createdTeacherUserIds.filter(isUuid);

    if (validStudentUuids.length > 0) {
      try {
        const delRes = await pool.query(`DELETE FROM students WHERE id = ANY($1::uuid[])`, [validStudentUuids]);
        console.log(`Cleaned up ${delRes.rowCount} test student records.`);
      } catch (cErr: any) {
        console.warn('Student cleanup notice:', cErr.message);
      }
    }
    if (validTeacherUuids.length > 0) {
      try {
        await pool.query(`DELETE FROM teacher_profiles WHERE user_id = ANY($1::uuid[])`, [validTeacherUuids]);
        const delU = await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [validTeacherUuids]);
        console.log(`Cleaned up ${delU.rowCount} test teacher user accounts.`);
      } catch (cErr: any) {
        console.warn('Teacher cleanup notice:', cErr.message);
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
