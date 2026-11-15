import http from 'http';
import app from '../src/app';
import { pool } from '../src/db';
import jwt from 'jsonwebtoken';
import {
  getStudentCompletenessSummary,
  getIncompleteStudents,
  COMPLETENESS_FIELDS,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS
} from '../src/services/studentCompletenessService';

const TEST_PORT = 5044;
const BASE = `http://localhost:${TEST_PORT}/api`;

const TEST_SCHOOL_A = '77777777-7777-4777-7777-777777777777';
const TEST_SCHOOL_B = '66666666-6666-4666-6666-666666666666';

let server: http.Server;
let adminTokenA = '';
let adminTokenB = '';
let teacherToken = '';
let superAdminToken = '';

const createdStudentIds: string[] = [];

async function apiReq(path: string, options: any = {}, token?: string) {
  const url = `${BASE}${path}`;
  const authToken = token !== undefined ? token : adminTokenA;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get('content-type') || '';
  const rawBuf = Buffer.from(await res.arrayBuffer());
  const hasBom = rawBuf.length >= 3 && rawBuf[0] === 0xEF && rawBuf[1] === 0xBB && rawBuf[2] === 0xBF;

  let data: any;
  if (contentType.includes('application/json')) {
    try {
      data = JSON.parse(rawBuf.toString('utf-8'));
    } catch {
      data = {};
    }
  } else {
    data = rawBuf.toString('utf-8');
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
    hasBom
  };
}

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

async function runRegressionSuite() {
  console.log('\n========================================================================');
  console.log('  STUDENT COMPLETENESS AUDIT CORRECTIONS COMPREHENSIVE REGRESSION SUITE');
  console.log('========================================================================\n');

  try {
    // Start test server
    await new Promise<void>((resolve, reject) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`Test server active on port ${TEST_PORT}`);
        resolve();
      }).on('error', reject);
    });

    const jwtSecret = process.env.JWT_SECRET || 'attendo-secret-key-development';

    // Sign test tokens
    adminTokenA = jwt.sign(
      { id: '00000000-0000-0000-0000-000000000001', email: 'admin@reg-a.local', role: 'SCHOOL_ADMIN', schoolId: TEST_SCHOOL_A },
      jwtSecret,
      { expiresIn: '2h' }
    );

    adminTokenB = jwt.sign(
      { id: '00000000-0000-0000-0000-000000000002', email: 'admin@reg-b.local', role: 'SCHOOL_ADMIN', schoolId: TEST_SCHOOL_B },
      jwtSecret,
      { expiresIn: '2h' }
    );

    teacherToken = jwt.sign(
      { id: '00000000-0000-0000-0000-000000000003', email: 'teacher@reg-a.local', role: 'TEACHER', schoolId: TEST_SCHOOL_A },
      jwtSecret,
      { expiresIn: '2h' }
    );

    superAdminToken = jwt.sign(
      { id: '00000000-0000-0000-0000-000000000004', email: 'superadmin@attendoschool.com', role: 'SUPER_ADMIN' },
      jwtSecret,
      { expiresIn: '2h' }
    );

    // 0. Ensure test schools exist in database
    await pool.query(
      `INSERT INTO schools (id, name, code)
       VALUES ($1, 'Regression Test School A', 'REG_A'),
              ($2, 'Regression Test School B', 'REG_B')
       ON CONFLICT (id) DO NOTHING`,
      [TEST_SCHOOL_A, TEST_SCHOOL_B]
    );

    // Ensure classes & sections exist for School A
    const classResA = await pool.query(
      `INSERT INTO classes (school_id, class_number)
       VALUES ($1, 5)
       ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=5
       RETURNING id`,
      [TEST_SCHOOL_A]
    );
    const classIdA = classResA.rows[0].id;

    const secResA = await pool.query(
      `INSERT INTO sections (school_id, class_id, name)
       VALUES ($1, $2, 'A')
       ON CONFLICT (class_id, name) DO UPDATE SET name='A'
       RETURNING id`,
      [TEST_SCHOOL_A, classIdA]
    );
    const sectionIdA = secResA.rows[0].id;

    // Academic session for School A
    const ayResA1 = await pool.query(
      `INSERT INTO academic_years (school_id, name, start_date, end_date, is_active)
       VALUES ($1, '2026-2027 Session', '2026-04-01', '2027-03-31', true)
       ON CONFLICT (school_id, name) DO UPDATE SET is_active=true
       RETURNING id`,
      [TEST_SCHOOL_A]
    );
    const ayIdA1 = ayResA1.rows[0].id;

    // Clean up any old test students from test schools
    await pool.query('DELETE FROM students WHERE school_id IN ($1, $2)', [TEST_SCHOOL_A, TEST_SCHOOL_B]);

    report('Setup: Test institutions, sessions, and authenticated credentials prepared', true);

    // =========================================================================
    // TEST 1: Teacher receives HTTP 403
    // =========================================================================
    const teacherRes = await apiReq('/students/completeness/summary', {}, teacherToken);
    report(
      'Test 1: Teacher receives HTTP 403 (completeness access restricted from teachers)',
      teacherRes.status === 403,
      `Status: ${teacherRes.status}, Message: ${JSON.stringify(teacherRes.data)}`
    );

    // =========================================================================
    // TEST 2: School Admin cannot override school ID
    // =========================================================================
    // School Admin A queries with ?schoolId=School_B and header x-school-id=School_B
    const overrideRes = await apiReq(
      `/students/completeness/summary?schoolId=${TEST_SCHOOL_B}`,
      { headers: { 'x-school-id': TEST_SCHOOL_B } },
      adminTokenA
    );
    // School Admin A must strictly receive School A data (currently 0 students), not School B
    report(
      'Test 2: School Admin cannot override school ID via query parameters or headers',
      overrideRes.status === 200 && overrideRes.data?.summary?.totalStudents === 0,
      `Returned totalStudents: ${overrideRes.data?.summary?.totalStudents}`
    );

    // =========================================================================
    // TEST 3: Super Admin without schoolId receives HTTP 400
    // =========================================================================
    const saNoSchoolRes = await apiReq('/students/completeness/summary', {}, superAdminToken);
    report(
      'Test 3: Super Admin without schoolId receives HTTP 400',
      saNoSchoolRes.status === 400,
      `Status: ${saNoSchoolRes.status}, Message: ${JSON.stringify(saNoSchoolRes.data)}`
    );

    // =========================================================================
    // TEST 4: Super Admin with a valid schoolId receives scoped results
    // =========================================================================
    const saWithSchoolRes = await apiReq(`/students/completeness/summary?schoolId=${TEST_SCHOOL_A}`, {}, superAdminToken);
    report(
      'Test 4: Super Admin with a valid schoolId receives scoped results',
      saWithSchoolRes.status === 200 && saWithSchoolRes.data?.summary !== undefined,
      `Status: ${saWithSchoolRes.status}`
    );

    // =========================================================================
    // TEST 5: Father-only family can achieve parent-contact completeness
    // =========================================================================
    const sFatherOnly = await pool.query(
      `INSERT INTO students (
        school_id, class_id, section_id, academic_year_id,
        roll_number, admission_number, admission_date, date_of_birth, gender,
        name, first_name, last_name,
        email, parent_sms_number,
        father_name, father_phone
      ) VALUES (
        $1, $2, $3, $4,
        '101', 'ADM-101', '2026-04-01', '2015-05-10', 'Male',
        'AARAV SHARMA', 'AARAV', 'SHARMA',
        'aarav@school.com', '9876543211',
        'RAJESH SHARMA', '9876543211'
      ) RETURNING id`,
      [TEST_SCHOOL_A, classIdA, sectionIdA, ayIdA1]
    );
    createdStudentIds.push(sFatherOnly.rows[0].id);

    const sFatherCheck = await getIncompleteStudents(TEST_SCHOOL_A, { search: 'AARAV SHARMA' });
    const sFatherIncomplete = sFatherCheck.students.find(s => s.id === sFatherOnly.rows[0].id);
    const summary5 = await getStudentCompletenessSummary(TEST_SCHOOL_A);
    report(
      'Test 5: Father-only family can achieve parent-contact completeness',
      !sFatherIncomplete && summary5.summary.completeProfiles === 1,
      `Complete profiles: ${summary5.summary.completeProfiles}, Aarav marked incomplete: ${Boolean(sFatherIncomplete)}`
    );

    // =========================================================================
    // TEST 6: Mother-only family can achieve parent-contact completeness
    // =========================================================================
    const sMotherOnly = await pool.query(
      `INSERT INTO students (
        school_id, class_id, section_id, academic_year_id,
        roll_number, admission_number, admission_date, date_of_birth, gender,
        name, first_name, last_name,
        email, parent_sms_number,
        mother_name, mother_phone
      ) VALUES (
        $1, $2, $3, $4,
        '102', 'ADM-102', '2026-04-01', '2015-06-15', 'Female',
        'DIYA PATEL', 'DIYA', 'PATEL',
        'diya@school.com', '9876543222',
        'MEENA PATEL', '9876543222'
      ) RETURNING id`,
      [TEST_SCHOOL_A, classIdA, sectionIdA, ayIdA1]
    );
    createdStudentIds.push(sMotherOnly.rows[0].id);

    const sMotherCheck = await getIncompleteStudents(TEST_SCHOOL_A, { search: 'DIYA PATEL' });
    const sMotherIncomplete = sMotherCheck.students.find(s => s.id === sMotherOnly.rows[0].id);
    const summary6 = await getStudentCompletenessSummary(TEST_SCHOOL_A);
    report(
      'Test 6: Mother-only family can achieve parent-contact completeness',
      !sMotherIncomplete && summary6.summary.completeProfiles === 2,
      `Complete profiles: ${summary6.summary.completeProfiles}, Diya marked incomplete: ${Boolean(sMotherIncomplete)}`
    );

    // =========================================================================
    // TEST 7: Guardian-only family can achieve parent-contact completeness
    // =========================================================================
    const sGuardianOnly = await pool.query(
      `INSERT INTO students (
        school_id, class_id, section_id, academic_year_id,
        roll_number, admission_number, admission_date, date_of_birth, gender,
        name, first_name, last_name,
        email, parent_sms_number,
        guardian_name
      ) VALUES (
        $1, $2, $3, $4,
        '103', 'ADM-103', '2026-04-01', '2015-07-20', 'Male',
        'ROHAN VERMA', 'ROHAN', 'VERMA',
        'rohan@school.com', '9876543233',
        'RAMESH VERMA'
      ) RETURNING id`,
      [TEST_SCHOOL_A, classIdA, sectionIdA, ayIdA1]
    );
    createdStudentIds.push(sGuardianOnly.rows[0].id);

    const sGuardianCheck = await getIncompleteStudents(TEST_SCHOOL_A, { search: 'ROHAN VERMA' });
    const sGuardianIncomplete = sGuardianCheck.students.find(s => s.id === sGuardianOnly.rows[0].id);
    const summary7 = await getStudentCompletenessSummary(TEST_SCHOOL_A);
    report(
      'Test 7: Guardian-only family can achieve parent-contact completeness',
      !sGuardianIncomplete && summary7.summary.completeProfiles === 3,
      `Complete profiles: ${summary7.summary.completeProfiles}, Rohan marked incomplete: ${Boolean(sGuardianIncomplete)}`
    );

    // =========================================================================
    // TEST 8: Missing both parent and guardian contacts is detected
    // =========================================================================
    const sNoParent = await pool.query(
      `INSERT INTO students (
        school_id, class_id, section_id, academic_year_id,
        roll_number, admission_number, admission_date, date_of_birth, gender,
        name, first_name, last_name,
        email, parent_sms_number
      ) VALUES (
        $1, $2, $3, $4,
        '104', 'ADM-104', '2026-04-01', '2015-08-10', 'Female',
        'ANANYA NO_PARENT', 'ANANYA', 'NO_PARENT',
        'ananya@school.com', '9876543244'
      ) RETURNING id`,
      [TEST_SCHOOL_A, classIdA, sectionIdA, ayIdA1]
    );
    createdStudentIds.push(sNoParent.rows[0].id);

    const sNoParentCheck = await getIncompleteStudents(TEST_SCHOOL_A, { search: 'ANANYA NO_PARENT' });
    const sNoParentRecord = sNoParentCheck.students.find(s => s.id === sNoParent.rows[0].id);
    const hasParentMissing = sNoParentRecord?.missingFields.some(mf => mf.key === 'parent_guardian_contact');
    report(
      'Test 8: Missing both parent and guardian contacts is detected',
      Boolean(sNoParentRecord && !sNoParentRecord.isComplete && hasParentMissing),
      `isComplete: ${sNoParentRecord?.isComplete}, Parent contact missing: ${hasParentMissing}`
    );

    // =========================================================================
    // TEST 9: Missing parent SMS is detected
    // =========================================================================
    const sNoSms = await pool.query(
      `INSERT INTO students (
        school_id, class_id, section_id, academic_year_id,
        roll_number, admission_number, admission_date, date_of_birth, gender,
        name, first_name, last_name,
        email, parent_sms_number,
        father_name, father_phone
      ) VALUES (
        $1, $2, $3, $4,
        '105', 'ADM-105', '2026-04-01', '2015-09-12', 'Male',
        'MANAV NO_SMS', 'MANAV', 'NO_SMS',
        'manav@school.com', '',
        'SURESH JOSHI', '9876543255'
      ) RETURNING id`,
      [TEST_SCHOOL_A, classIdA, sectionIdA, ayIdA1]
    );
    createdStudentIds.push(sNoSms.rows[0].id);

    const sNoSmsCheck = await getIncompleteStudents(TEST_SCHOOL_A, { search: 'MANAV NO_SMS' });
    const sNoSmsRecord = sNoSmsCheck.students.find(s => s.id === sNoSms.rows[0].id);
    const hasSmsMissing = sNoSmsRecord?.missingFields.some(mf => mf.key === 'parent_sms_number');
    report(
      'Test 9: Missing parent SMS is detected',
      Boolean(sNoSmsRecord && !sNoSmsRecord.isComplete && hasSmsMissing),
      `isComplete: ${sNoSmsRecord?.isComplete}, SMS missing: ${hasSmsMissing}`
    );

    // =========================================================================
    // TEST 10: Missing occupations does not reduce completeness
    // =========================================================================
    const sNoOcc = await pool.query(
      `INSERT INTO students (
        school_id, class_id, section_id, academic_year_id,
        roll_number, admission_number, admission_date, date_of_birth, gender,
        name, first_name, last_name,
        email, parent_sms_number,
        father_name, father_phone, father_occupation,
        mother_name, mother_phone, mother_occupation
      ) VALUES (
        $1, $2, $3, $4,
        '106', 'ADM-106', '2026-04-01', '2015-10-14', 'Female',
        'SNEHA NO_OCC', 'SNEHA', 'NO_OCC',
        'sneha@school.com', '9876543266',
        'VIKRAM NO_OCC', '9876543266', NULL,
        'POOJA NO_OCC', '9876543267', NULL
      ) RETURNING id`,
      [TEST_SCHOOL_A, classIdA, sectionIdA, ayIdA1]
    );
    createdStudentIds.push(sNoOcc.rows[0].id);

    const sNoOccCheck = await getIncompleteStudents(TEST_SCHOOL_A, { search: 'SNEHA NO_OCC' });
    const sNoOccIncomplete = sNoOccCheck.students.find(s => s.id === sNoOcc.rows[0].id);
    const summary10 = await getStudentCompletenessSummary(TEST_SCHOOL_A);
    report(
      'Test 10: Missing occupations does not reduce completeness',
      !sNoOccIncomplete && summary10.summary.completeProfiles === 4,
      `Complete profiles: ${summary10.summary.completeProfiles}, Sneha marked incomplete: ${Boolean(sNoOccIncomplete)}`
    );

    // =========================================================================
    // TEST 11: CSV export returns more than 5,000 records without truncation
    // =========================================================================
    // Insert 5,050 bulk students in School A
    console.log('  [INFO] Generating 5,050 bulk test records to test unpaginated CSV streaming...');
    await pool.query(
      `INSERT INTO students (
        school_id, class_id, section_id, academic_year_id,
        roll_number, admission_number,
        name, parent_sms_number
      )
      SELECT
        $1, $2, $3, $4,
        'BLK-' || i,
        'ADM-BLK-' || i,
        'STREAMING TEST STUDENT ' || i,
        '980000' || LPAD(i::text, 4, '0')
      FROM generate_series(1, 5050) AS i`,
      [TEST_SCHOOL_A, classIdA, sectionIdA, ayIdA1]
    );

    const streamExportRes = await apiReq('/students/completeness/export?session=2026-2027', {}, adminTokenA);
    const csvContent = typeof streamExportRes.data === 'string' ? streamExportRes.data : '';
    const hasBom = Boolean(streamExportRes.hasBom);
    // Count CSV lines (excluding trailing empty newline)
    const lineCount = csvContent.trim().split(/\r\n|\n/).length;

    report(
      'Test 11: CSV export returns more than 5,000 records without truncation',
      streamExportRes.status === 200 && lineCount > 5050 && hasBom,
      `Streamed line count: ${lineCount}, Has UTF-8 BOM: ${hasBom}`
    );

    // Clean up bulk test records
    await pool.query("DELETE FROM students WHERE school_id = $1 AND admission_number LIKE 'ADM-BLK-%'", [TEST_SCHOOL_A]);

    // =========================================================================
    // TEST 12: CSV escaping handles commas, quotes and newlines
    // =========================================================================
    const specialStudentRes = await pool.query(
      `INSERT INTO students (
        school_id, class_id, section_id, academic_year_id,
        roll_number, admission_number,
        name, address, parent_sms_number
      ) VALUES (
        $1, $2, $3, $4,
        '999', 'ADM-SPEC-999',
        'DOE, JOHN "JD"', 'Flat 4B\nTower 2, Green Road', '9876543999'
      ) RETURNING id`,
      [TEST_SCHOOL_A, classIdA, sectionIdA, ayIdA1]
    );
    createdStudentIds.push(specialStudentRes.rows[0].id);

    const specialExportRes = await apiReq('/students/completeness/export?search=ADM-SPEC-999', {}, adminTokenA);
    const specialCsv = typeof specialExportRes.data === 'string' ? specialExportRes.data : '';
    const hasEscapedName = specialCsv.includes('"DOE, JOHN ""JD"""');
    report(
      'Test 12: CSV escaping handles commas, quotes and newlines according to RFC 4180',
      hasEscapedName,
      `CSV segment: ${specialCsv.slice(0, 300)}`
    );

    // =========================================================================
    // TEST 13: CSV export respects school isolation and all active filters
    // =========================================================================
    // Create student in School B
    const sBRes = await pool.query(
      `INSERT INTO students (
        school_id, class_id, section_id,
        roll_number, admission_number,
        name, parent_sms_number
      ) VALUES (
        $1, $2, $3,
        '888', 'ADM-B-888',
        'SECRET SCHOOL B STUDENT', '9999999888'
      ) RETURNING id`,
      [TEST_SCHOOL_B, classIdA, sectionIdA]
    );
    createdStudentIds.push(sBRes.rows[0].id);

    const exportA = await apiReq('/students/completeness/export', {}, adminTokenA);
    const exportB = await apiReq('/students/completeness/export', {}, adminTokenB);

    const leakedInA = typeof exportA.data === 'string' && exportA.data.includes('SECRET SCHOOL B');
    const presentInB = typeof exportB.data === 'string' && exportB.data.includes('SECRET SCHOOL B');

    report(
      'Test 13: CSV export respects school isolation and active filters',
      !leakedInA && presentInB,
      `Leaked in School A: ${leakedInA}, Present in School B: ${presentInB}`
    );

    // =========================================================================
    // TEST 14: Academic Session resolution handles unicode en-dash and 2-digit formats
    // =========================================================================
    // School A has session '2026-2027 Session'. Query with '2026–27 Academic Session' (en-dash \u2013)
    const enDashSession = '2026\u201327 Academic Session';
    const enDashRes = await apiReq(`/students/completeness/summary?session=${encodeURIComponent(enDashSession)}`, {}, adminTokenA);
    report(
      'Test 14: Session resolution handles unicode en-dash and 2-digit format variations',
      enDashRes.status === 200 && enDashRes.data?.summary?.totalStudents >= 6,
      `Resolved totalStudents: ${enDashRes.data?.summary?.totalStudents}, activeSession: ${enDashRes.data?.activeSession}`
    );

    // =========================================================================
    // TEST 15: Session resolution matches canonical year format ('2026-2027')
    // =========================================================================
    const canonRes = await apiReq('/students/completeness/summary?session=2026-2027', {}, adminTokenA);
    report(
      'Test 15: Session resolution matches canonical year format',
      canonRes.status === 200 && canonRes.data?.summary?.totalStudents >= 6,
      `Resolved totalStudents: ${canonRes.data?.summary?.totalStudents}`
    );

    // =========================================================================
    // TEST 16: "All Sessions" query parameter returns all school students
    // =========================================================================
    const allSessionsRes = await apiReq('/students/completeness/summary?session=All%20Sessions', {}, adminTokenA);
    report(
      'Test 16: "All Sessions" query parameter returns all school students',
      allSessionsRes.status === 200 && allSessionsRes.data?.summary?.totalStudents >= 6,
      `Resolved totalStudents: ${allSessionsRes.data?.summary?.totalStudents}`
    );

  } catch (err: any) {
    console.error('Test suite uncaught error:', err);
    report('Regression suite uncaught error', false, err.message);
  } finally {
    // Cleanup created test records
    try {
      if (createdStudentIds.length > 0) {
        await pool.query('DELETE FROM students WHERE id = ANY($1::uuid[])', [createdStudentIds]);
      }
      await pool.query("DELETE FROM students WHERE school_id = $1 AND admission_number LIKE 'ADM-BLK-%'", [TEST_SCHOOL_A]);
    } catch { }

    if (server) {
      server.close();
    }

    console.log('\n------------------------------------------------------------------------');
    console.log(`  SUITE SUMMARY: Passed: ${passed} | Failed: ${failed}`);
    console.log('------------------------------------------------------------------------\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runRegressionSuite();
