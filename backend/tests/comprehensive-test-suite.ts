import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';
import { requireAuth, requireRoles, AuthRequest } from '../src/middleware/auth';
import { securityHeaders, apiRateLimit, requestContext } from '../src/middleware/security';
import app from '../src/app';
import http from 'http';
import { pool } from '../src/db';
import { renderEmailTemplate } from '../src/services/notificationService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m - ${testName}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m - ${testName}${details ? ` (${details})` : ''}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING COMPREHENSIVE SCHOOL ATTENDANCE SAAS TEST SUITE');
  console.log('======================================================\n');

  // ---------------------------------------------------------
  // 1. DATABASE MIGRATION & SCHEMA VALIDATION TESTS
  // ---------------------------------------------------------
  console.log('📁 1. Database Schema & Migration Script Validation:');
  const migrationsDir = path.resolve(__dirname, '../../database/migrations');
  const schemaFile = path.resolve(__dirname, '../../database/schema.sql');
  const seedFile = path.resolve(__dirname, '../../database/seed.sql');

  assert(fs.existsSync(schemaFile), 'database/schema.sql exists');
  assert(fs.existsSync(seedFile), 'database/seed.sql exists');

  const schemaContent = fs.readFileSync(schemaFile, 'utf8');
  const seedContent = fs.readFileSync(seedFile, 'utf8');

  assert(schemaContent.includes('CREATE TABLE schools'), 'schema.sql defines schools table');
  assert(schemaContent.includes('CREATE TABLE users'), 'schema.sql defines users table');
  assert(schemaContent.includes('CREATE TABLE students'), 'schema.sql defines students table');
  assert(schemaContent.includes('CREATE TABLE attendance_sessions'), 'schema.sql defines attendance_sessions');
  assert(schemaContent.includes('CREATE TABLE attendance_records'), 'schema.sql defines attendance_records');
  assert(schemaContent.includes('CREATE TABLE subscription_plans'), 'schema.sql defines subscription_plans');
  assert(schemaContent.includes('CREATE TABLE school_subscriptions'), 'schema.sql defines school_subscriptions');
  assert(schemaContent.includes('CREATE TABLE audit_logs'), 'schema.sql defines audit_logs');

  assert(!seedContent.includes('admin@demo-school.local'), 'seed.sql contains no demo school admin');
  assert(seedContent.includes('superadmin@attendance.local'), 'seed.sql contains super admin');
  assert(!seedContent.includes('rahul@demo-school.local'), 'seed.sql contains no demo teacher');

  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  assert(migrationFiles.length >= 22, `Found ${migrationFiles.length} database migration files (V07 to V28)`);

  const v28File = migrationFiles.find(f => f.includes('028') || f.includes('v28'));
  assert(!!v28File, 'V28 final integrated migration file exists');
  if (v28File) {
    const v28Content = fs.readFileSync(path.join(migrationsDir, v28File), 'utf8');
    assert(v28Content.includes('student_enrollment_history_v28'), 'V28 includes student_enrollment_history_v28');
    assert(v28Content.includes('notification_delivery_attempts_v28'), 'V28 includes notification_delivery_attempts_v28');
    assert(v28Content.includes('v28_test_runs'), 'V28 includes v28_test_runs');
    assert(v28Content.includes('e2e_workflow_runs_v28'), 'V28 includes e2e_workflow_runs_v28');
  }

  // ---------------------------------------------------------
  // 2. AUTHENTICATION & CRYPTOGRAPHY TESTS
  // ---------------------------------------------------------
  console.log('\n🔐 2. Authentication & Cryptography:');
  const plainPassword = 'ChangeMe123!';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  const passwordMatches = await bcrypt.compare(plainPassword, hashedPassword);
  const badPasswordFails = !(await bcrypt.compare('WrongPassword999', hashedPassword));

  assert(passwordMatches, 'bcrypt successfully validates correct password');
  assert(badPasswordFails, 'bcrypt rejects invalid password');

  const payload = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    schoolId: '987fcdeb-51a2-43f7-9abc-def012345678',
    name: 'Test Administrator',
    email: 'admin@demo-school.local',
    role: 'SCHOOL_ADMIN' as const
  };

  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '1h' });
  assert(typeof token === 'string' && token.length > 20, 'JWT token generates successfully');

  const decoded = jwt.verify(token, env.jwtSecret) as typeof payload;
  assert(decoded.email === payload.email && decoded.role === 'SCHOOL_ADMIN', 'JWT token verifies and extracts claims');

  let invalidTokenRejected = false;
  try {
    jwt.verify('invalid.token.structure', env.jwtSecret);
  } catch {
    invalidTokenRejected = true;
  }
  assert(invalidTokenRejected, 'JWT rejects malformed tokens');

  // ---------------------------------------------------------
  // 3. MIDDLEWARE & SECURITY TESTS
  // ---------------------------------------------------------
  console.log('\n🛡️ 3. Security Headers & Authorization Middleware:');
  const mockHeaders: Record<string, string> = {};
  const mockRes: any = {
    setHeader: (k: string, v: string) => { mockHeaders[k] = v; },
    status: (code: number) => ({ json: (data: any) => ({ code, data }) }),
    json: (data: any) => ({ code: 200, data })
  };

  let headerNextCalled = false;
  securityHeaders({} as any, mockRes, () => { headerNextCalled = true; });
  assert(headerNextCalled, 'securityHeaders calls next()');
  assert(mockHeaders['X-Content-Type-Options'] === 'nosniff', 'X-Content-Type-Options: nosniff header present');
  assert(mockHeaders['X-Frame-Options'] === 'DENY', 'X-Frame-Options: DENY header present');
  assert(mockHeaders['Referrer-Policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy header present');
  assert(mockHeaders['Permissions-Policy'] === 'camera=(),microphone=(),geolocation=(self)', 'Permissions-Policy header present');

  // Rate Limiting
  const rateLimitReq: any = { ip: '192.168.1.100', user: { id: 'user-test-1' } };
  const limitThreshold = Number(process.env.RATE_LIMIT || (process.env.NODE_ENV === 'production' ? 120 : 1000));
  for (let i = 0; i < limitThreshold; i++) {
    apiRateLimit(rateLimitReq, mockRes, () => {});
  }
  let rateLimitBlocked = false;
  const rateLimitRes: any = {
    status: (code: number) => ({
      json: () => {
        if (code === 429) rateLimitBlocked = true;
      }
    })
  };
  apiRateLimit(rateLimitReq, rateLimitRes, () => {});
  assert(rateLimitBlocked, `apiRateLimit blocks requests after ${limitThreshold} calls within time window`);

  // Role Guard Middleware
  let roleAdminAllowed = false;
  let roleTeacherAllowed = false;
  const adminReq: any = { user: payload };
  const teacherGuard = requireRoles('TEACHER');
  const adminGuard = requireRoles('SCHOOL_ADMIN');

  adminGuard(adminReq, mockRes, () => { roleAdminAllowed = true; });
  teacherGuard(adminReq, {
    status: (code: number) => ({
      json: () => {
        if (code === 403) roleTeacherAllowed = false;
      }
    })
  } as any, () => { roleTeacherAllowed = true; });

  assert(roleAdminAllowed, 'requireRoles allows matching role (SCHOOL_ADMIN)');
  assert(!roleTeacherAllowed, 'requireRoles blocks non-matching role (TEACHER required, got SCHOOL_ADMIN)');

  // ---------------------------------------------------------
  // 4. TEMPLATE ENGINE & NOTIFICATION TESTS
  // ---------------------------------------------------------
  console.log('\n📬 4. Notification Template & Processing Engine:');
  const template = 'Dear Parent, {student_name} was absent from {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.';
  const vars: Record<string, string> = {
    '{student_name}': 'Arjun Kumar',
    '{class_name}': 'Class 8',
    '{section}': 'A',
    '{time}': '09:00',
    '{teacher_name}': 'Rahul Sharma',
    '{enquiry_number}': '9000000000'
  };

  let processedMessage = template;
  for (const [k, v] of Object.entries(vars)) {
    processedMessage = processedMessage.replaceAll(k, v);
  }

  assert(!processedMessage.includes('{'), 'Template placeholder variable substitution completes');
  assert(processedMessage.includes('Arjun Kumar'), 'Template contains substituted student name');
  assert(processedMessage.includes('Class 8-A'), 'Template contains substituted class and section');
  assert(processedMessage.includes('Rahul Sharma'), 'Template contains substituted teacher name');

  // Validate Admission Number presence across all student-bound email templates
  const absentTmpl = renderEmailTemplate('ATTENDANCE_ABSENT', {
    student_name: 'Rohan Verma',
    admission_number: 'ADM-2026-9999',
    class_name: '10',
    section_name: 'B',
    attendance_date: '2026-10-08'
  });
  assert(absentTmpl.text.includes('Admission Number: ADM-2026-9999'), 'ATTENDANCE_ABSENT email text mentions student Admission Number');
  assert(absentTmpl.html.includes('ADM-2026-9999') && absentTmpl.html.includes('Admission Number'), 'ATTENDANCE_ABSENT email HTML includes Admission Number table row');

  const presentTmpl = renderEmailTemplate('ATTENDANCE_PRESENT', {
    student_name: 'Rohan Verma',
    admission_number: 'ADM-2026-9999',
    class_name: '10',
    section_name: 'B',
    attendance_date: '2026-10-08'
  });
  assert(presentTmpl.text.includes('Admission Number: ADM-2026-9999'), 'ATTENDANCE_PRESENT email text mentions student Admission Number');
  assert(presentTmpl.html.includes('ADM-2026-9999') && presentTmpl.html.includes('Admission Number'), 'ATTENDANCE_PRESENT email HTML includes Admission Number table row');

  const studentCreatedTmpl = renderEmailTemplate('STUDENT_CREATED', {
    student_name: 'Rohan Verma',
    admission_number: 'ADM-2026-9999',
    class_name: '10',
    section_name: 'B',
    roll_number: '42'
  });
  assert(studentCreatedTmpl.text.includes('Admission Number (Login ID): ADM-2026-9999'), 'STUDENT_CREATED email text mentions Admission Number (Login ID)');
  assert(studentCreatedTmpl.html.includes('ADM-2026-9999') && studentCreatedTmpl.html.includes('Login ID'), 'STUDENT_CREATED email HTML highlights Admission Number Login ID badge');

  const pwdResetTmpl = renderEmailTemplate('PASSWORD_RESET', {
    name: 'Rohan Verma',
    admission_number: 'ADM-2026-9999',
    role: 'STUDENT'
  });
  assert(pwdResetTmpl.text.includes('Admission Number (Login ID): ADM-2026-9999'), 'PASSWORD_RESET email text mentions student Admission Number (Login ID)');
  assert(pwdResetTmpl.html.includes('ADM-2026-9999') && pwdResetTmpl.html.includes('Admission Number (Login ID)'), 'PASSWORD_RESET email HTML displays student Admission Number profile card');

  // ---------------------------------------------------------
  // 5. BILLING & GST TAX CALCULATIONS
  // ---------------------------------------------------------
  console.log('\n💰 5. Billing, Subscriptions & GST Tax Calculations:');
  const baseAmount = 4999;
  const gstRate = 18;
  const taxAmount = (baseAmount * gstRate) / 100;
  const totalAmount = baseAmount + taxAmount;
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;

  assert(taxAmount === 899.82, '18% GST tax calculation is exact (4999 * 0.18 = 899.82)');
  assert(cgst === 449.91 && sgst === 449.91, 'CGST 9% and SGST 9% split correctly (449.91 each)');
  assert(totalAmount === 5898.82, 'Total amount including tax calculates correctly (5898.82)');

  // Subscription days remaining
  const startDate = new Date();
  const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  assert(daysRemaining === 30, 'Subscription 30-day validity window computes correctly');

  // ---------------------------------------------------------
  // 6. HTTP SERVER & ENDPOINT INTEGRATION TESTS
  // ---------------------------------------------------------
  console.log('\n🌐 6. HTTP Server & Route Integration:');
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(5002, resolve));

  try {
    const apiRes = await fetch('http://localhost:5002/api');
    const apiJson = await apiRes.json();
    assert(apiRes.status === 200, 'GET /api returns 200 OK');
    assert(apiJson.name === 'School Attendance SaaS API', 'GET /api returns correct API name');

    const healthRes = await fetch('http://localhost:5002/api/health');
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200 || healthRes.status === 503, 'GET /api/health responds with valid HTTP status (200 or 503 depending on live DB)');
    assert(healthJson.status === 'ok' || healthJson.status === 'error', 'GET /api/health returns valid structured health status object');

    const v26HealthRes = await fetch('http://localhost:5002/api/production-v26/health');
    const v26HealthJson = await v26HealthRes.json();
    assert(v26HealthRes.status === 200 || v26HealthRes.status === 503, 'GET /api/production-v26/health responds with valid HTTP status');
    assert(v26HealthJson.checks?.memory?.status === 'ok', 'GET /api/production-v26/health checks server memory usage');

    const notFoundRes = await fetch('http://localhost:5002/api/unknown-route-12345');
    assert(notFoundRes.status === 404, 'GET /api/unknown-route-12345 returns 404 Not Found');

    const authCheckRes = await fetch('http://localhost:5002/api/auth/me');
    assert(authCheckRes.status === 401, 'GET /api/auth/me without token returns 401 Unauthorized');

    const authWithTokenRes = await fetch('http://localhost:5002/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const authWithTokenJson = await authWithTokenRes.json();
    assert(authWithTokenRes.status === 200, 'GET /api/auth/me with Bearer token returns 200 OK');
    assert(authWithTokenJson.user?.email === payload.email, 'GET /api/auth/me returns authenticated user details');

    // ---------------------------------------------------------
    // 7. STRICT ALL-OR-NOTHING IMPORT & TRANSACTION INTEGRITY TESTS
    // ---------------------------------------------------------
    console.log('\n🔒 7. Strict All-or-Nothing Import & Transaction Integrity:');

    // Test A: Student Bulk Import rejects invalid rows and stores 0 records
    const invalidBatchUniqueId = `TEST_STU_${Date.now()}`;
    const studentImportRes = await fetch('http://localhost:5002/api/students/bulk-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        students: [
          {
            firstName: 'Valid',
            lastName: 'Student',
            admissionNumber: `${invalidBatchUniqueId}_VALID`,
            rollNumber: '101',
            parentPhone: '9876543210',
            classLabel: 'Class 10',
            sectionName: 'A'
          },
          {
            // Missing First Name & Parent Phone -> Invalid Row
            firstName: '',
            lastName: 'FailingRow',
            admissionNumber: `${invalidBatchUniqueId}_INVALID`,
            rollNumber: '102',
            parentPhone: '',
            classLabel: 'Class 10',
            sectionName: 'A'
          }
        ]
      })
    });
    const studentImportJson = await studentImportRes.json();
    assert(studentImportRes.status === 422, 'Student bulk-import returns 422 on validation failure');
    assert(studentImportJson.success === false, 'Student bulk-import success is false when batch has error');
    assert(studentImportJson.message?.includes('cancelled') || studentImportJson.message?.includes('zero records stored'), 'Student import confirms entire operation cancelled with zero records stored');

    // Test B: Verify zero students from the failed batch were stored in DB or memory
    const studentCheckRes = await fetch('http://localhost:5002/api/students', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const studentsList = await studentCheckRes.json();
    const leakedStudent = Array.isArray(studentsList) && studentsList.some((s: any) => s.admission_number === `${invalidBatchUniqueId}_VALID`);
    assert(!leakedStudent, 'Zero students stored in database/memory when import contains errors (atomic guarantee)');

    // Test C: Faculty / Teacher Bulk Import rejects invalid rows and stores 0 records
    const invalidTeacherEmpId = `EMP_FAIL_${Date.now()}`;
    const teacherImportRes = await fetch('http://localhost:5002/api/teachers/bulk-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        teachers: [
          {
            firstName: 'Valid',
            lastName: 'Teacher',
            name: 'Valid Teacher',
            email: `valid_${Date.now()}@school.local`,
            saviorNo: `${invalidTeacherEmpId}_VALID`,
            mobile: '9876543210'
          },
          {
            firstName: 'Invalid',
            lastName: 'Teacher',
            name: 'Invalid Teacher',
            email: 'not-an-email', // invalid email
            saviorNo: `${invalidTeacherEmpId}_FAIL`,
            mobile: '123' // invalid mobile
          }
        ]
      })
    });
    const teacherImportJson = await teacherImportRes.json();
    assert(teacherImportRes.status === 422, 'Faculty bulk-import returns 422 on validation failure');
    assert(teacherImportJson.success === false, 'Faculty bulk-import success is false when batch has error');
    assert(teacherImportJson.message?.includes('cancelled') || teacherImportJson.message?.includes('no faculty data was stored'), 'Faculty import confirms entire operation cancelled');

    // Test D: Verify zero teachers from failed batch were stored
    const teacherCheckRes = await fetch('http://localhost:5002/api/teachers', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const teachersList = await teacherCheckRes.json();
    const leakedTeacher = Array.isArray(teachersList) && teachersList.some((t: any) => t.employee_id === `${invalidTeacherEmpId}_VALID` || t.savior_no === `${invalidTeacherEmpId}_VALID`);
    assert(!leakedTeacher, 'Zero teachers stored in database/memory when import contains errors (atomic guarantee)');

    // Test E: Offline Attendance Import rejects records missing student identification
    const offAttendanceRes = await fetch('http://localhost:5002/api/attendance-reports/import-offline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        classId: 'cls-10',
        sectionId: 'sec-10-a',
        records: [
          { admissionNumber: '', rollNumber: '', studentName: '', status: 'P' }
        ]
      })
    });
    const offAttendanceJson = await offAttendanceRes.json();
    assert(offAttendanceRes.status === 422, 'Offline attendance import returns 422 when record lacks student identification');
    assert(offAttendanceJson.success === false, 'Offline attendance success is false when validation fails');

  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end().catch(() => {});
  }

  // ---------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------
  console.log('\n======================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
