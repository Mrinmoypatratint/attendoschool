import assert from 'assert';
import http from 'http';
import app from '../src/app';

const TEST_PORT = 5014;
const BASE = `http://localhost:${TEST_PORT}/api`;

let server: http.Server;

async function apiReq(path: string, options: any = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get('content-type') || '';
  const data = await res.json().catch(() => ({}));
  return {
    status: res.status,
    contentType,
    data
  };
}

const GREENWOOD_ID = '00000000-0000-0000-0000-000000000001';
const TINT_ID = '00000000-0000-0000-0000-000000000002';
const ABC_ID = '08c4960d-75d6-4a92-989b-48309500632e';

async function runTestSuite() {
  console.log('\n========================================================================');
  console.log('  STUDENT LOGIN CREDENTIAL -> ADMISSION NO. COMPREHENSIVE TEST SUITE');
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

  let studentTokenGreenwood = '';
  let studentTokenTint = '';

  // -------------------------------------------------------------------------
  // Test 1: Valid Admission No. Login for Greenwood School
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: GREENWOOD_ID,
        admissionNumber: 'ADM-2026-001',
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    });

    const ok = res.status === 200 &&
               !!res.data.token &&
               res.data.user.role === 'STUDENT' &&
               res.data.user.admissionNumber === 'ADM-2026-001' &&
               (res.data.user.schoolId === GREENWOOD_ID || res.data.user.schoolCode === 'GIS001');

    studentTokenGreenwood = res.data.token;
    report('TC-01: Valid Admission No. login for Greenwood (ADM-2026-001)', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-01: Valid Admission No. login for Greenwood', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 2: Valid Admission No. Login for TINT (ADM-2025-105 -> Sweta Mondal)
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TINT_ID,
        admissionNumber: 'ADM-2025-105',
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    });

    const ok = res.status === 200 &&
               !!res.data.token &&
               res.data.user.role === 'STUDENT' &&
               res.data.user.admissionNumber === 'ADM-2025-105' &&
               res.data.user.name.includes('Sweta');

    studentTokenTint = res.data.token;
    report('TC-02: Valid Admission No. login for TINT (ADM-2025-105 -> Sweta Mondal)', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-02: Valid Admission No. login for TINT', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 3: Whitespace & Case Insensitivity in Admission No.
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: GREENWOOD_ID,
        admissionNumber: '   adm-2026-001   ',
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    });

    const ok = res.status === 200 &&
               !!res.data.token &&
               res.data.user.admissionNumber === 'ADM-2026-001';

    report('TC-03: Whitespace and casing tolerance ("  adm-2026-001  ")', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-03: Whitespace and casing tolerance', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 4: Empty or Whitespace-only Admission No.
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: GREENWOOD_ID,
        admissionNumber: '    ',
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    });

    const ok = res.status === 400;
    report('TC-04: Empty/whitespace-only Admission No. returns 400 Bad Request', ok, `Status: ${res.status}`);
  } catch (err: any) {
    report('TC-04: Empty/whitespace-only Admission No.', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 5: Nonexistent Admission No. (Anti-Enumeration Generic Error)
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: GREENWOOD_ID,
        admissionNumber: 'ADM-FAKE-NONEXISTENT-999',
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    });

    const ok = res.status === 401 && res.data.message === 'Invalid credentials or account not found';
    report('TC-05: Nonexistent Admission No. returns generic 401 (anti-enumeration)', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-05: Nonexistent Admission No. returns generic 401', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 6: Valid Admission No. with Incorrect Password
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: GREENWOOD_ID,
        admissionNumber: 'ADM-2026-001',
        password: 'WrongPassword999!',
        role: 'STUDENT'
      })
    });

    const ok = res.status === 401 && res.data.message === 'Invalid credentials or account not found';
    report('TC-06: Wrong password with valid Admission No. returns generic 401', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-06: Wrong password with valid Admission No.', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 7: Strict Cross-School Tenant Isolation (Greenwood student into TINT)
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TINT_ID,
        admissionNumber: 'ADM-2026-001', // Greenwood student, does NOT exist in TINT
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    });

    // Must be rejected with 401 unauthorized
    const ok = res.status === 401;
    report('TC-07: Cross-school isolation (Greenwood Admission No. into TINT) denied with 401', ok, `Status: ${res.status}`);
  } catch (err: any) {
    report('TC-07: Cross-school isolation', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 8: Strict Cross-School Tenant Isolation (TINT student into Greenwood)
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: GREENWOOD_ID,
        admissionNumber: 'ADM-2025-105', // TINT student, does NOT exist in Greenwood
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    });

    const ok = res.status === 401;
    report('TC-08: Cross-school isolation (TINT Admission No. into Greenwood) denied with 401', ok, `Status: ${res.status}`);
  } catch (err: any) {
    report('TC-08: Cross-school isolation', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 9: Student Login Missing Institute Context
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        admissionNumber: 'ADM-2026-001',
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    });

    const ok = res.status === 400 && res.data.message.includes('select your institute');
    report('TC-09: Student login without instituteId returns 400 requirement', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-09: Student login without instituteId', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 10: Inactive / Deactivated Student Account
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: ABC_ID,
        admissionNumber: 'ADM-TST-001', // Deactivated student in database
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    });

    const ok = res.status === 401;
    report('TC-10: Inactive student account authentication denied with 401', ok, `Status: ${res.status}`);
  } catch (err: any) {
    report('TC-10: Inactive student account authentication denied', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 11: Authenticated Student Profile Loading (/api/student/me)
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/student/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${studentTokenGreenwood}`
      }
    });

    const ok = res.status === 200 &&
               res.data.name === 'Rohan Sharma' &&
               res.data.admissionNumber === 'ADM-2026-001';

    report('TC-11: Authenticated /api/student/me loads student profile & admissionNumber', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-11: Authenticated /api/student/me', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 12: Student Profile Isolation (Student B loads own profile, not Student A)
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/student/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${studentTokenTint}`
      }
    });

    const ok = res.status === 200 &&
               res.data.name.includes('Sweta') &&
               res.data.admissionNumber === 'ADM-2025-105';

    report('TC-12: Data isolation: TINT Student profile loads exclusively own data', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-12: Data isolation', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 13: Token Refresh Preserves Student Identity & Admission No.
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/refresh', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentTokenGreenwood}`
      }
    });

    const ok = res.status === 200 &&
               !!res.data.token &&
               res.data.user.admissionNumber === 'ADM-2026-001' &&
               res.data.user.role === 'STUDENT';

    report('TC-13: Token refresh (/api/auth/refresh) preserves admissionNumber and identity', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-13: Token refresh', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 14: Regression Test - School Admin Email Login
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: GREENWOOD_ID,
        email: 'admin@demo-school.local',
        password: 'ChangeMe123!',
        role: 'SCHOOL_ADMIN'
      })
    });

    const ok = res.status === 200 &&
               !!res.data.token &&
               res.data.user.role === 'SCHOOL_ADMIN';

    report('TC-14: Regression test: School Admin email login operates normally', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-14: Regression test: School Admin email login', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 15: Regression Test - Teacher Email Login
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: GREENWOOD_ID,
        email: 'rahul@demo-school.local',
        password: 'ChangeMe123!',
        role: 'TEACHER'
      })
    });

    const ok = res.status === 200 &&
               !!res.data.token &&
               res.data.user.role === 'TEACHER';

    report('TC-15: Regression test: Teacher email login operates normally', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-15: Regression test: Teacher email login', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Test 16: Password Reset Request by Admission No.
  // -------------------------------------------------------------------------
  try {
    const res = await apiReq('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({
        admissionNumber: 'ADM-2026-001',
        instituteId: GREENWOOD_ID
      })
    });

    const ok = res.status === 200 &&
               res.data.success === true &&
               (!!res.data.resetUrl || res.data.message.includes('password'));

    report('TC-16: Password reset request via Admission No. resolves account and succeeds', ok, JSON.stringify(res.data));
  } catch (err: any) {
    report('TC-16: Password reset request via Admission No.', false, err.message);
  }

  console.log('\n========================================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

server = app.listen(TEST_PORT, async () => {
  console.log(`Test server started on port ${TEST_PORT}`);
  try {
    await runTestSuite();
    server.close(() => {
      console.log('Test server shut down successfully.');
      process.exit(0);
    });
  } catch (err: any) {
    console.error('Fatal test runner error:', err);
    server.close(() => process.exit(1));
  }
});
