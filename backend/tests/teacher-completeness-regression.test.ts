import http from 'http';
import app from '../src/app';
import { pool } from '../src/db';
import jwt from 'jsonwebtoken';
import {
  getTeacherCompletenessSummary,
  getIncompleteTeachers,
  TEACHER_COMPLETENESS_FIELDS,
  REQUIRED_TEACHER_FIELDS,
  OPTIONAL_TEACHER_FIELDS
} from '../src/services/teacherCompletenessService';
import {
  getStudentCompletenessSummary
} from '../src/services/studentCompletenessService';

const TEST_PORT = 5046;
const BASE = `http://localhost:${TEST_PORT}/api`;

const TEST_SCHOOL_A = '77777777-7777-4777-7777-777777777777';
const TEST_SCHOOL_B = '66666666-6666-4666-6666-666666666666';

let server: http.Server;
let adminTokenA = '';
let adminTokenB = '';
let teacherToken = '';
let superAdminToken = '';

const createdTeacherUserIds: string[] = [];

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

async function runTeacherRegressionSuite() {
  console.log('\n========================================================================');
  console.log('  TEACHER DATA COMPLETENESS COMPREHENSIVE REGRESSION & INTEGRATION SUITE');
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

    // Setup: Ensure test schools exist
    await pool.query(
      `INSERT INTO schools (id, name, code)
       VALUES ($1, 'Teacher Completeness School A', 'TC_A'),
              ($2, 'Teacher Completeness School B', 'TC_B')
       ON CONFLICT (id) DO NOTHING`,
      [TEST_SCHOOL_A, TEST_SCHOOL_B]
    );

    // Clean up any old test teachers from test schools
    await pool.query('DELETE FROM users WHERE school_id IN ($1, $2)', [TEST_SCHOOL_A, TEST_SCHOOL_B]);

    // Insert 1 Complete Teacher in School A
    const u1 = await pool.query(
      `INSERT INTO users (school_id, name, first_name, last_name, email, password_hash, role, is_active)
       VALUES ($1, 'ANITA DESHMUKH', 'ANITA', 'DESHMUKH', 'anita.d@schoola.local', 'hash123', 'TEACHER', true)
       RETURNING id`,
      [TEST_SCHOOL_A]
    );
    createdTeacherUserIds.push(u1.rows[0].id);

    await pool.query(
      `INSERT INTO teacher_profiles (user_id, employee_id, first_name, last_name, mobile, phone, designation, joining_date, gender)
       VALUES ($1, 'EMP-TC-001', 'ANITA', 'DESHMUKH', '9876543210', '9876543210', 'TGT Science', '2022-06-15', 'Female')`,
      [u1.rows[0].id]
    );

    // Insert 1 Incomplete Teacher in School A (missing mobile and joining_date)
    const u2 = await pool.query(
      `INSERT INTO users (school_id, name, first_name, last_name, email, password_hash, role, is_active)
       VALUES ($1, 'VIKRAM CHOUDHURY', 'VIKRAM', 'CHOUDHURY', 'vikram.c@schoola.local', 'hash123', 'TEACHER', true)
       RETURNING id`,
      [TEST_SCHOOL_A]
    );
    createdTeacherUserIds.push(u2.rows[0].id);

    await pool.query(
      `INSERT INTO teacher_profiles (user_id, employee_id, first_name, last_name, designation, gender)
       VALUES ($1, 'EMP-TC-002', 'VIKRAM', 'CHOUDHURY', 'PRT Mathematics', 'Male')`,
      [u2.rows[0].id]
    );

    // Insert 1 Teacher in School B (Complete)
    const u3 = await pool.query(
      `INSERT INTO users (school_id, name, first_name, last_name, email, password_hash, role, is_active)
       VALUES ($1, 'RAKESH SHARMA', 'RAKESH', 'SHARMA', 'rakesh.s@schoolb.local', 'hash123', 'TEACHER', true)
       RETURNING id`,
      [TEST_SCHOOL_B]
    );
    createdTeacherUserIds.push(u3.rows[0].id);

    await pool.query(
      `INSERT INTO teacher_profiles (user_id, employee_id, first_name, last_name, mobile, designation, joining_date, gender)
       VALUES ($1, 'EMP-TC-003', 'RAKESH', 'SHARMA', '9811223344', 'PGT Physics', '2021-04-10', 'Male')`,
      [u3.rows[0].id]
    );

    report('Setup: Test fixtures created (School A: 1 complete, 1 incomplete; School B: 1 complete)', true);

    // =========================================================================
    // TEST 1: Teacher receives HTTP 403
    // =========================================================================
    const teacherRes = await apiReq('/teachers/completeness/summary', {}, teacherToken);
    report(
      'Test 1: Teacher receives HTTP 403 (completeness access restricted from teachers)',
      teacherRes.status === 403,
      `Status: ${teacherRes.status}, Message: ${JSON.stringify(teacherRes.data)}`
    );

    // =========================================================================
    // TEST 2: School Admin cannot override school ID
    // =========================================================================
    const overrideRes = await apiReq(
      `/teachers/completeness/summary?schoolId=${TEST_SCHOOL_B}`,
      { headers: { 'x-school-id': TEST_SCHOOL_B } },
      adminTokenA
    );
    report(
      'Test 2: School Admin cannot override school ID via query parameters or headers',
      overrideRes.status === 200 && overrideRes.data?.summary?.totalTeachers === 2,
      `Returned totalTeachers: ${overrideRes.data?.summary?.totalTeachers} (expected 2 for School A)`
    );

    // =========================================================================
    // TEST 3: Super Admin without schoolId receives HTTP 400
    // =========================================================================
    const saNoSchoolRes = await apiReq('/teachers/completeness/summary', {}, superAdminToken);
    report(
      'Test 3: Super Admin without schoolId receives HTTP 400',
      saNoSchoolRes.status === 400,
      `Status: ${saNoSchoolRes.status}, Message: ${JSON.stringify(saNoSchoolRes.data)}`
    );

    // =========================================================================
    // TEST 4: Super Admin with invalid UUID receives HTTP 400
    // =========================================================================
    const saInvalidUuidRes = await apiReq('/teachers/completeness/summary?schoolId=not-a-valid-uuid', {}, superAdminToken);
    report(
      'Test 4: Super Admin with invalid UUID receives HTTP 400',
      saInvalidUuidRes.status === 400,
      `Status: ${saInvalidUuidRes.status}`
    );

    // =========================================================================
    // TEST 5: Super Admin with non-existent school UUID receives HTTP 404
    // =========================================================================
    const saNotFoundRes = await apiReq('/teachers/completeness/summary?schoolId=00000000-0000-0000-0000-000000000000', {}, superAdminToken);
    report(
      'Test 5: Super Admin with non-existent school UUID receives HTTP 404',
      saNotFoundRes.status === 404,
      `Status: ${saNotFoundRes.status}`
    );

    // =========================================================================
    // TEST 6: Super Admin with valid schoolId receives correctly scoped results
    // =========================================================================
    const saSchoolBRes = await apiReq(`/teachers/completeness/summary?schoolId=${TEST_SCHOOL_B}`, {}, superAdminToken);
    report(
      'Test 6: Super Admin with valid schoolId receives School B results',
      saSchoolBRes.status === 200 && saSchoolBRes.data?.summary?.totalTeachers === 1,
      `Returned totalTeachers: ${saSchoolBRes.data?.summary?.totalTeachers}`
    );

    // =========================================================================
    // TEST 7: Summary Metrics Calculation Correctness
    // =========================================================================
    const summaryA = await apiReq('/teachers/completeness/summary', {}, adminTokenA);
    const sumData = summaryA.data?.summary;
    report(
      'Test 7: Summary Metrics for School A: totalTeachers=2, complete=1, incomplete=1, score=50%',
      sumData?.totalTeachers === 2 &&
      sumData?.completeProfiles === 1 &&
      sumData?.incompleteProfiles === 1 &&
      sumData?.completenessScore === 50,
      `Got: ${JSON.stringify(sumData)}`
    );

    // =========================================================================
    // TEST 8: Missing Teachers Listing Endpoint
    // =========================================================================
    const missingRes = await apiReq('/teachers/completeness/missing-teachers', {}, adminTokenA);
    const teachersList = missingRes.data?.teachers || [];
    const pagination = missingRes.data?.pagination;
    report(
      'Test 8: Missing teachers endpoint returns exactly 1 incomplete teacher for School A',
      teachersList.length === 1 &&
      pagination?.total === 1 &&
      teachersList[0]?.employee_id === 'EMP-TC-002',
      `Found: ${teachersList.map((t: any) => t.employee_id).join(', ')}`
    );

    const vikram = teachersList[0];
    const missingKeys = vikram?.missingFields?.map((f: any) => f.key) || [];
    report(
      'Test 8b: Vikram is correctly identified as missing "mobile" and "joining_date"',
      missingKeys.includes('mobile') && missingKeys.includes('joining_date'),
      `Missing keys: ${missingKeys.join(', ')}`
    );

    // =========================================================================
    // TEST 9: Missing Field Filter
    // =========================================================================
    const filterMobileRes = await apiReq('/teachers/completeness/missing-teachers?missingField=mobile', {}, adminTokenA);
    report(
      'Test 9: Filter by missingField=mobile returns Vikram',
      filterMobileRes.data?.teachers?.length === 1 && filterMobileRes.data?.teachers[0]?.employee_id === 'EMP-TC-002',
      `Count: ${filterMobileRes.data?.teachers?.length}`
    );

    const filterEmailRes = await apiReq('/teachers/completeness/missing-teachers?missingField=email', {}, adminTokenA);
    report(
      'Test 9b: Filter by missingField=email returns 0 (both have valid emails)',
      filterEmailRes.data?.teachers?.length === 0,
      `Count: ${filterEmailRes.data?.teachers?.length}`
    );

    // =========================================================================
    // TEST 10: Search Filter
    // =========================================================================
    const searchRes = await apiReq('/teachers/completeness/missing-teachers?search=vikram', {}, adminTokenA);
    report(
      'Test 10: Search by name "vikram" returns Vikram',
      searchRes.data?.teachers?.length === 1 && searchRes.data?.teachers[0]?.employee_id === 'EMP-TC-002',
      `Count: ${searchRes.data?.teachers?.length}`
    );

    // =========================================================================
    // TEST 11: Field Metadata Endpoint
    // =========================================================================
    const fieldsRes = await apiReq('/teachers/completeness/fields', {}, adminTokenA);
    const allFields = fieldsRes.data?.fields || [];
    const reqFields = fieldsRes.data?.requiredFields || [];
    const optFields = fieldsRes.data?.optionalFields || [];
    report(
      'Test 11: Fields endpoint returns 14 total fields (8 required, 6 optional)',
      allFields.length === 14 && reqFields.length === 8 && optFields.length === 6,
      `All: ${allFields.length}, Req: ${reqFields.length}, Opt: ${optFields.length}`
    );

    // =========================================================================
    // TEST 12: CSV Export Endpoint
    // =========================================================================
    const exportRes = await apiReq('/teachers/completeness/export', {}, adminTokenA);
    const csvContent = String(exportRes.data);
    const hasCsvHeaders = csvContent.includes('Teacher Name') &&
                          csvContent.includes('Employee / Savior ID') &&
                          csvContent.includes('Missing Information');
    const includesVikram = csvContent.includes('VIKRAM CHOUDHURY') || csvContent.includes('EMP-TC-002');
    report(
      'Test 12: CSV export returns UTF-8 BOM, headers, and contains incomplete teacher row',
      exportRes.status === 200 && exportRes.hasBom && hasCsvHeaders && includesVikram,
      `Status: ${exportRes.status}, BOM: ${exportRes.hasBom}, Has Headers: ${hasCsvHeaders}, Has Row: ${includesVikram}`
    );

    // =========================================================================
    // TEST 13: Security - No password_hash exposed
    // =========================================================================
    report(
      'Test 13: Security check: password_hash and password are NOT exposed',
      (vikram as any).password_hash === undefined &&
      (vikram as any).password === undefined &&
      !csvContent.includes('hash123'),
      'Verified clean payload'
    );

    // =========================================================================
    // TEST 14: Regression Check - Student Completeness Endpoint
    // =========================================================================
    const stuSummaryRes = await apiReq('/students/completeness/summary', {}, adminTokenA);
    report(
      'Test 14: Regression check: Student completeness summary endpoint remains operational',
      stuSummaryRes.status === 200 && typeof stuSummaryRes.data?.summary?.totalStudents === 'number',
      `Status: ${stuSummaryRes.status}`
    );

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Cleanup test records
    try {
      if (createdTeacherUserIds.length > 0) {
        await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdTeacherUserIds]);
      }
      await pool.query('DELETE FROM schools WHERE id IN ($1, $2)', [TEST_SCHOOL_A, TEST_SCHOOL_B]);
    } catch (cleanErr) {
      console.warn('Cleanup error:', cleanErr);
    }

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  console.log(`\n========================================================================`);
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTeacherRegressionSuite().catch(err => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
