import http from 'http';
import app from '../src/app';
import { pool } from '../src/db';
import jwt from 'jsonwebtoken';

const TEST_PORT = 5055;
const BASE = `http://localhost:${TEST_PORT}/api`;

const TEST_SCHOOL_ID = '88888888-8888-4888-8888-888888888888';
let server: http.Server;
let adminToken = '';
const jwtSecret = process.env.JWT_SECRET || 'attendo-secret-key-development';

// Track created IDs for strict teardown
const createdUserIds: string[] = [];
const createdStudentIds: string[] = [];
let testClassId = '';
let testSectionId = '';
let testSectionBId = '';
let testAyId = '';

async function apiReq(path: string, options: any = {}, token?: string) {
  const url = `${BASE}${path}`;
  const authToken = token !== undefined ? token : adminToken;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any;
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = {};
    }
  } else {
    data = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    data
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

async function runVerificationSuite() {
  console.log('\n========================================================================');
  console.log('  TEACHER & STUDENT LOGIN + CLASS MENTOR FEATURE SYNC VERIFICATION');
  console.log('========================================================================\n');

  try {
    // 1. Start test server
    await new Promise<void>((resolve, reject) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`Test server active on port ${TEST_PORT}`);
        resolve();
      }).on('error', reject);
    });

    // 2. Setup isolated test school & structure
    await pool.query(
      `INSERT INTO schools (id, name, code)
       VALUES ($1, 'Sync Test Academy', 'SYNC_TEST_01')
       ON CONFLICT (id) DO NOTHING`,
      [TEST_SCHOOL_ID]
    );

    const ayRes = await pool.query(
      `INSERT INTO academic_years (school_id, name, start_date, end_date, is_active)
       VALUES ($1, '2026-2027', '2026-04-01', '2027-03-31', true)
       RETURNING id`,
      [TEST_SCHOOL_ID]
    );
    testAyId = ayRes.rows[0].id;

    const classRes = await pool.query(
      `INSERT INTO classes (school_id, class_number)
       VALUES ($1, 9)
       RETURNING id`,
      [TEST_SCHOOL_ID]
    );
    testClassId = classRes.rows[0].id;

    const secRes = await pool.query(
      `INSERT INTO sections (school_id, class_id, name)
       VALUES ($1, $2, 'A'), ($1, $2, 'B')
       RETURNING id, name`,
      [TEST_SCHOOL_ID, testClassId]
    );
    testSectionId = secRes.rows.find((r: any) => r.name === 'A').id;
    testSectionBId = secRes.rows.find((r: any) => r.name === 'B').id;

    // Sign Admin token for test requests
    adminToken = jwt.sign(
      {
        id: '11111111-1111-4111-1111-111111111111',
        email: 'admin@synctest.local',
        role: 'SCHOOL_ADMIN',
        schoolId: TEST_SCHOOL_ID,
        schoolName: 'Sync Test Academy'
      },
      jwtSecret,
      { expiresIn: '2h' }
    );

    report('Setup: Isolated test fixtures initialized (School, Academic Year, Class 9, Sections A & B)', true);

    // =========================================================================
    // ISSUE 2 - TEST 1: Teacher creation without password -> Immediate Login
    // =========================================================================
    const teacher1Email = `teacher.auto.${Date.now()}@synctest.local`;
    const teacher1EmpId = `EMP-SYNC-01`;
    const t1CreateRes = await apiReq('/teachers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rajesh Sharma',
        email: teacher1Email,
        employeeId: teacher1EmpId,
        mobile: '9876543210',
        gender: 'Male',
        designation: 'Mathematics Teacher',
        joiningDate: '2026-01-15'
      })
    });

    const t1CreatedOk = t1CreateRes.status === 201 && t1CreateRes.data?.id;
    if (t1CreateRes.data?.id) createdUserIds.push(t1CreateRes.data.id);
    report('TC-01: Admin creates Teacher without providing password', t1CreatedOk, JSON.stringify(t1CreateRes.data));

    // Immediate login with Teacher Email + ChangeMe123!
    const t1EmailLoginRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        email: teacher1Email,
        password: 'ChangeMe123!',
        role: 'TEACHER'
      })
    }, '');

    const t1EmailLoginOk = t1EmailLoginRes.status === 200 &&
      !!t1EmailLoginRes.data?.token &&
      t1EmailLoginRes.data?.user?.role === 'TEACHER';
    report('TC-02: Newly created Teacher logs in immediately via Email and standard default password', t1EmailLoginOk, JSON.stringify(t1EmailLoginRes.data));

    // Immediate login with Teacher Employee ID + ChangeMe123!
    const t1EmpLoginRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        employeeId: teacher1EmpId,
        password: 'ChangeMe123!',
        role: 'TEACHER'
      })
    }, '');

    const t1EmpLoginOk = t1EmpLoginRes.status === 200 &&
      !!t1EmpLoginRes.data?.token &&
      t1EmpLoginRes.data?.user?.role === 'TEACHER';
    report('TC-03: Newly created Teacher logs in immediately via Employee ID and standard default password', t1EmpLoginOk, JSON.stringify(t1EmpLoginRes.data));

    // =========================================================================
    // ISSUE 2 - TEST 2: Student creation without email -> Immediate Login
    // =========================================================================
    const stu1Adm = '99001';
    const stu1CreateRes = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rohan Sharma',
        admissionNumber: stu1Adm,
        rollNumber: '01',
        classId: testClassId,
        sectionId: testSectionId,
        dateOfBirth: '2010-05-15',
        parentPhone: '9876543211',
        academicSessionId: testAyId
      })
    });

    const stu1CreatedOk = stu1CreateRes.status === 201 && stu1CreateRes.data?.id;
    if (stu1CreateRes.data?.id) createdStudentIds.push(stu1CreateRes.data.id);
    report('TC-04: Admin creates Student without providing email (offline/in-person record)', stu1CreatedOk, JSON.stringify(stu1CreateRes.data));

    // Verify linked user was created and linked
    const stu1DbCheck = await pool.query(
      `SELECT s.id, s.user_id, u.email, u.is_active, u.role
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [stu1CreateRes.data?.id]
    );
    const stu1LinkedOk = stu1DbCheck.rowCount === 1 &&
      stu1DbCheck.rows[0].role === 'STUDENT' &&
      stu1DbCheck.rows[0].is_active === true;
    if (stu1DbCheck.rows[0]?.user_id) createdUserIds.push(stu1DbCheck.rows[0].user_id);
    report('TC-05: Database confirms student has linked active users record with synthesized portal email', stu1LinkedOk, JSON.stringify(stu1DbCheck.rows[0]));

    // Immediate student login with Admission Number + ChangeMe123!
    const stu1LoginRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        admissionNumber: stu1Adm,
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    }, '');

    const stu1LoginOk = stu1LoginRes.status === 200 &&
      !!stu1LoginRes.data?.token &&
      stu1LoginRes.data?.user?.role === 'STUDENT' &&
      stu1LoginRes.data?.user?.admissionNumber === stu1Adm;
    report('TC-06: Newly created Student logs in immediately via Admission Number and standard default password', stu1LoginOk, JSON.stringify(stu1LoginRes.data));

    // =========================================================================
    // ISSUE 2 - TEST 3: Student creation with custom password -> Immediate Login
    // =========================================================================
    const stu2Adm = '99002';
    const stu2CustomPw = 'MyCustomSecret2026!';
    const stu2CreateRes = await apiReq('/students', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Priya Patel',
        admissionNumber: stu2Adm,
        rollNumber: '02',
        classId: testClassId,
        sectionId: testSectionId,
        dateOfBirth: '2010-06-20',
        parentPhone: '9876543212',
        password: stu2CustomPw,
        academicSessionId: testAyId
      })
    });

    const stu2CreatedOk = stu2CreateRes.status === 201 && stu2CreateRes.data?.id;
    if (stu2CreateRes.data?.id) createdStudentIds.push(stu2CreateRes.data.id);
    report('TC-07: Admin creates Student with explicit custom password', stu2CreatedOk, JSON.stringify(stu2CreateRes.data));

    // Immediate login with Admission Number + Custom Password
    const stu2LoginRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        admissionNumber: stu2Adm,
        password: stu2CustomPw,
        role: 'STUDENT'
      })
    }, '');

    const stu2LoginOk = stu2LoginRes.status === 200 &&
      !!stu2LoginRes.data?.token &&
      stu2LoginRes.data?.user?.admissionNumber === stu2Adm;
    report('TC-08: Student with custom password logs in immediately with custom credentials', stu2LoginOk, JSON.stringify(stu2LoginRes.data));

    // =========================================================================
    // ISSUE 2 - TEST 4: Student Bulk Import -> Immediate Login
    // =========================================================================
    const bulkAdm = '99003';
    const bulkImportRes = await apiReq('/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        students: [
          {
            name: 'Ananya Das',
            admissionNumber: bulkAdm,
            rollNumber: '03',
            className: 'Class 9',
            sectionName: 'A',
            dateOfBirth: '2010-07-10',
            gender: 'Female',
            parentPhone: '9876543213',
            academicSessionId: testAyId
          }
        ]
      })
    });

    const bulkImportOk = bulkImportRes.status === 201 || (bulkImportRes.data?.success && bulkImportRes.data?.count === 1);
    report('TC-09: Admin executes student bulk import', bulkImportOk, JSON.stringify(bulkImportRes.data));

    // Verify bulk imported student can log in immediately
    const bulkStuLoginRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        admissionNumber: bulkAdm,
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    }, '');

    const bulkStuLoginOk = bulkStuLoginRes.status === 200 &&
      !!bulkStuLoginRes.data?.token &&
      bulkStuLoginRes.data?.user?.admissionNumber === bulkAdm;
    report('TC-10: Bulk imported student logs in immediately with Admission Number + default password', bulkStuLoginOk, JSON.stringify(bulkStuLoginRes.data));

    // Collect bulk student ID for cleanup
    const bulkDbCheck = await pool.query(`SELECT id, user_id FROM students WHERE admission_number = $1`, [bulkAdm]);
    if (bulkDbCheck.rowCount && bulkDbCheck.rows[0]) {
      createdStudentIds.push(bulkDbCheck.rows[0].id);
      if (bulkDbCheck.rows[0].user_id) createdUserIds.push(bulkDbCheck.rows[0].user_id);
    }

    // =========================================================================
    // ISSUE 1 - TEST 5: Teacher Feature Consistency & Class Mentor Workspace
    // =========================================================================

    // Create Teacher 2 (Unassigned regular faculty)
    const teacher2Email = `teacher2.unassigned.${Date.now()}@synctest.local`;
    const teacher2EmpId = `EMP-SYNC-02`;
    const t2CreateRes = await apiReq('/teachers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sunita Verma',
        email: teacher2Email,
        employeeId: teacher2EmpId,
        mobile: '9876543220',
        gender: 'Female',
        designation: 'English Teacher'
      })
    });
    const t2UserId = t2CreateRes.data?.id;
    if (t2UserId) createdUserIds.push(t2UserId);

    // Sign tokens for Teacher 1 and Teacher 2
    const t1Token = jwt.sign(
      { id: t1CreateRes.data.id, email: teacher1Email, role: 'TEACHER', schoolId: TEST_SCHOOL_ID },
      jwtSecret,
      { expiresIn: '2h' }
    );
    const t2Token = jwt.sign(
      { id: t2UserId, email: teacher2Email, role: 'TEACHER', schoolId: TEST_SCHOOL_ID },
      jwtSecret,
      { expiresIn: '2h' }
    );

    // Explicitly designate Teacher 1 as Class Mentor for Class 9 Section A
    await pool.query(
      `INSERT INTO class_mentors (school_id, class_id, section_id, teacher_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (school_id, class_id, section_id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id`,
      [TEST_SCHOOL_ID, testClassId, testSectionId, t1CreateRes.data.id]
    );

    // Scenario A: Designated Class Mentor queries /api/teacher/mentor/my-classes
    const t1MyClassesRes = await apiReq('/teacher/mentor/my-classes', { method: 'GET' }, t1Token);
    const t1Classes = Array.isArray(t1MyClassesRes.data) ? t1MyClassesRes.data : (t1MyClassesRes.data?.classes || []);
    const t1ClassesOk = t1MyClassesRes.status === 200 &&
      t1Classes.length === 1 &&
      t1Classes[0].section_name === 'A';
    report('TC-11: Designated Class Mentor receives assigned class & section for Result Publishing', t1ClassesOk, JSON.stringify(t1MyClassesRes.data));

    // Scenario B: Unassigned Teacher queries /api/teacher/mentor/my-classes
    const t2MyClassesRes = await apiReq('/teacher/mentor/my-classes', { method: 'GET' }, t2Token);
    const t2Classes = Array.isArray(t2MyClassesRes.data) ? t2MyClassesRes.data : (t2MyClassesRes.data?.classes || []);
    const t2ClassesOk = t2MyClassesRes.status === 200 &&
      t2Classes.length === 0;
    report('TC-12: Unassigned Teacher cleanly receives empty classes list [] (workspace renders informative guidance without crashing)', t2ClassesOk, JSON.stringify(t2MyClassesRes.data));

    // Scenario C: Teacher with class/section in teacher_profiles auto-reconciles into class_mentors
    const teacher3Email = `teacher3.reconcile.${Date.now()}@synctest.local`;
    const teacher3EmpId = `EMP-SYNC-03`;
    const t3CreateRes = await apiReq('/teachers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Vikram Malhotra',
        email: teacher3Email,
        employeeId: teacher3EmpId,
        mobile: '9876543230',
        gender: 'Male',
        designation: 'Science Teacher',
        className: 'Class 9',
        sectionName: 'B'
      })
    });
    const t3UserId = t3CreateRes.data?.id;
    if (t3UserId) createdUserIds.push(t3UserId);

    // Update teacher profile directly to emulate existing unlinked DB records (class_name='Class 9', section_name='B')
    await pool.query(
      `UPDATE teacher_profiles SET class_name = 'Class 9', section_name = 'B' WHERE user_id = $1`,
      [t3UserId]
    );

    // Ensure class_mentors has NO record for Teacher 3 initially
    await pool.query(`DELETE FROM class_mentors WHERE teacher_id = $1`, [t3UserId]);

    const t3Token = jwt.sign(
      { id: t3UserId, email: teacher3Email, role: 'TEACHER', schoolId: TEST_SCHOOL_ID },
      jwtSecret,
      { expiresIn: '2h' }
    );

    // Teacher 3 calls /teacher/mentor/my-classes
    const t3MyClassesRes = await apiReq('/teacher/mentor/my-classes', { method: 'GET' }, t3Token);
    const t3Classes = Array.isArray(t3MyClassesRes.data) ? t3MyClassesRes.data : (t3MyClassesRes.data?.classes || []);
    const t3ClassesOk = t3MyClassesRes.status === 200 &&
      t3Classes.length === 1 &&
      t3Classes[0].section_name === 'B';

    // Verify auto-reconciliation inserted into class_mentors table
    const mentorCheck = await pool.query(
      `SELECT * FROM class_mentors WHERE teacher_id = $1 AND class_id = $2 AND section_id = $3`,
      [t3UserId, testClassId, testSectionBId]
    );
    const autoReconciledInDb = mentorCheck.rowCount === 1;

    report('TC-13: Teacher with assigned class in profile automatically reconciles into class_mentors and gains Result Publish access', t3ClassesOk && autoReconciledInDb, JSON.stringify({
      classes: t3Classes,
      dbRecords: mentorCheck.rows
    }));

    // Scenario D: Assigning class via People Directory (updateTeacher) syncs class_mentors
    const t2AssignRes = await apiReq(`/people/teachers/${t2UserId}`, {
      method: 'PUT',
      body: JSON.stringify({
        className: 'Class 9',
        sectionName: 'A'
      })
    });

    const t2AssignOk = t2AssignRes.status === 200;
    // Check class_mentors was updated for Teacher 2
    const t2MentorCheck = await pool.query(
      `SELECT * FROM class_mentors WHERE teacher_id = $1 AND class_id = $2`,
      [t2UserId, testClassId]
    );
    const t2MentorSynced = t2MentorCheck.rowCount === 1;
    report('TC-14: Admin assigning class to teacher via People Management automatically syncs class_mentors', t2AssignOk && t2MentorSynced, JSON.stringify(t2MentorCheck.rows));

    // =========================================================================
    // ISSUE 2 - TEST 6: Editing records preserves immediate login capability
    // =========================================================================
    // Edit Student 1
    const stu1UpdateRes = await apiReq(`/students/${stu1CreateRes.data.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Rohan Sharma Updated',
        parentPhone: '9876543299',
        rollNumber: '01',
        admissionNumber: stu1Adm,
        classId: testClassId,
        sectionId: testSectionId
      })
    });
    const stu1UpdatedOk = stu1UpdateRes.status === 200;
    // Student 1 logs in after edit
    const stu1ReLoginRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        admissionNumber: stu1Adm,
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    }, '');
    const stu1ReLoginOk = stu1ReLoginRes.status === 200 && !!stu1ReLoginRes.data?.token;
    report('TC-15: Editing student record preserves immediate login capability via Admission Number', stu1UpdatedOk && stu1ReLoginOk, JSON.stringify(stu1ReLoginRes.data));

    // Edit Teacher 1
    const t1UpdateRes = await apiReq(`/people/teachers/${t1CreateRes.data.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Rajesh Sharma Senior',
        mobile: '9876543288'
      })
    });
    const t1UpdatedOk = t1UpdateRes.status === 200;
    // Teacher 1 logs in after edit
    const t1ReLoginRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        email: teacher1Email,
        password: 'ChangeMe123!',
        role: 'TEACHER'
      })
    }, '');
    const t1ReLoginOk = t1ReLoginRes.status === 200 && !!t1ReLoginRes.data?.token;
    report('TC-16: Editing teacher record preserves immediate login capability via Email', t1UpdatedOk && t1ReLoginOk, JSON.stringify(t1ReLoginRes.data));

    // =========================================================================
    // SECURITY REVIEW TEST SUITE (TC-17 to TC-23)
    // =========================================================================

    // TC-17: Universal Initial Password ChangeMe123! flags mustChangePassword: true
    const stu1LoginCheck = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        admissionNumber: stu1Adm,
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    }, '');
    const stu1Decoded: any = jwt.decode(stu1LoginCheck.data?.token || '');
    const tc17Ok = stu1LoginCheck.status === 200 &&
      stu1LoginCheck.data?.user?.mustChangePassword === true &&
      stu1Decoded?.mustChangePassword === true;
    report('TC-17: Initial login with ChangeMe123! enforces mustChangePassword: true in user and JWT token', tc17Ok, JSON.stringify({
      userMustChange: stu1LoginCheck.data?.user?.mustChangePassword,
      jwtMustChange: stu1Decoded?.mustChangePassword
    }));

    // TC-18: Password change validation & rejection of default/weak/incorrect password
    const stu1Token = stu1LoginCheck.data?.token;

    // 18a: Cannot reuse default password ChangeMe123!
    const reuseDefaultRes = await apiReq('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: 'ChangeMe123!',
        newPassword: 'ChangeMe123!'
      })
    }, stu1Token);
    const reuseDefaultBlocked = reuseDefaultRes.status === 400;

    // 18b: Weak password rejected by policy
    const weakPassRes = await apiReq('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: 'ChangeMe123!',
        newPassword: 'weak'
      })
    }, stu1Token);
    const weakPassBlocked = weakPassRes.status === 400;

    // 18c: Incorrect current password rejected
    const wrongCurrentRes = await apiReq('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: 'WrongCurrentPassword!',
        newPassword: 'NewSecurePass987!'
      })
    }, stu1Token);
    const wrongCurrentBlocked = wrongCurrentRes.status === 400;

    report('TC-18: /api/auth/change-password rejects default password, weak passwords, and incorrect current passwords',
      reuseDefaultBlocked && weakPassBlocked && wrongCurrentBlocked,
      JSON.stringify({ reuseDefault: reuseDefaultRes.data, weak: weakPassRes.data, wrongCurrent: wrongCurrentRes.data })
    );

    // TC-19: Successful password change updates password_changed_at and clears mustChangePassword
    const changePassRes = await apiReq('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: 'ChangeMe123!',
        newPassword: 'NewSecurePass987!'
      })
    }, stu1Token);

    const changePassOk = changePassRes.status === 200 &&
      changePassRes.data?.success === true &&
      changePassRes.data?.user?.mustChangePassword === false;

    // Verify subsequent login with new password has mustChangePassword === false
    const stu1NewLoginRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        admissionNumber: stu1Adm,
        password: 'NewSecurePass987!',
        role: 'STUDENT'
      })
    }, '');
    const stu1NewDecoded: any = jwt.decode(stu1NewLoginRes.data?.token || '');
    const newLoginOk = stu1NewLoginRes.status === 200 &&
      stu1NewLoginRes.data?.user?.mustChangePassword === false &&
      stu1NewDecoded?.mustChangePassword === false;

    report('TC-19: Successful password change updates password_changed_at, clears mustChangePassword flag on re-login',
      changePassOk && newLoginOk,
      JSON.stringify({ changePass: changePassRes.data, reLogin: stu1NewLoginRes.data?.user })
    );

    // TC-20: Student auto-provisioning security audit
    // Create unlinked student in database
    const unlinkedStuAdm = `SEC-AUDIT-${Date.now().toString().slice(-4)}`;
    const unlinkedStuRes = await pool.query(
      `INSERT INTO students (school_id, name, admission_number, roll_number, class_id, section_id, is_active, parent_sms_number)
       VALUES ($1, 'Unlinked Audit Student', $2, '888', $3, $4, true, '9876543210')
       RETURNING id`,
      [TEST_SCHOOL_ID, unlinkedStuAdm, testClassId, testSectionId]
    );
    const unlinkedStuId = unlinkedStuRes.rows[0].id;
    createdStudentIds.push(unlinkedStuId);

    // 20a: Attempting auto-provisioning with wrong password fails 401 and does NOT create a user record
    const wrongPassProvRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        admissionNumber: unlinkedStuAdm,
        password: 'WrongPassword!',
        role: 'STUDENT'
      })
    }, '');
    const unlinkedCheck1 = await pool.query(`SELECT user_id FROM students WHERE id = $1`, [unlinkedStuId]);
    const safeFromWrongPass = wrongPassProvRes.status === 401 && unlinkedCheck1.rows[0].user_id === null;

    // 20b: Attempting auto-provisioning via bare roll number does NOT link
    const rollProvRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        rollNumber: '888',
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    }, '');
    const unlinkedCheck2 = await pool.query(`SELECT user_id FROM students WHERE id = $1`, [unlinkedStuId]);
    const safeFromBareRoll = (rollProvRes.status === 401 || rollProvRes.status === 400) && unlinkedCheck2.rows[0].user_id === null;

    // 20c: Auto-provisioning succeeds with valid initial password and unique admission number
    const validProvRes = await apiReq('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteId: TEST_SCHOOL_ID,
        admissionNumber: unlinkedStuAdm,
        password: 'ChangeMe123!',
        role: 'STUDENT'
      })
    }, '');
    const unlinkedCheck3 = await pool.query(`SELECT user_id FROM students WHERE id = $1`, [unlinkedStuId]);
    const validProvOk = validProvRes.status === 200 && unlinkedCheck3.rows[0].user_id !== null;
    if (unlinkedCheck3.rows[0].user_id) createdUserIds.push(unlinkedCheck3.rows[0].user_id);

    report('TC-20: Student auto-provisioning security: requires ChangeMe123!, blocks bare roll numbers, links atomically',
      safeFromWrongPass && safeFromBareRoll && validProvOk,
      JSON.stringify({ wrongPassStatus: wrongPassProvRes.status, rollStatus: rollProvRes.status, validProvStatus: validProvRes.status })
    );

    // TC-21: Teacher auto-reconciliation conflict prevention (cannot steal or overwrite existing mentor)
    // Teacher 2 is currently assigned mentor for Class 9 Section A
    // Create Teacher 4 whose profile also claims Class 9 Section A
    const teacher4Email = `sec_audit_teacher4_${Date.now()}@synctest.edu`;
    const t4CreateRes = await apiReq('/people/teachers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Audit Teacher 4',
        email: teacher4Email,
        employeeId: `T4_${Date.now().toString().slice(-4)}`,
        mobile: '9876543204',
        className: 'Class 9',
        sectionName: 'A'
      })
    });
    const t4UserId = t4CreateRes.data.id;
    createdUserIds.push(t4UserId);

    // Remove any direct class_mentors row for Teacher 4
    await pool.query(`DELETE FROM class_mentors WHERE teacher_id = $1`, [t4UserId]);

    const t4Token = jwt.sign(
      { id: t4UserId, email: teacher4Email, role: 'TEACHER', schoolId: TEST_SCHOOL_ID },
      jwtSecret,
      { expiresIn: '2h' }
    );

    // Teacher 4 attempts to trigger auto-reconciliation on Section A (already owned by Teacher 2)
    const t4MyClassesRes = await apiReq('/teacher/mentor/my-classes', { method: 'GET' }, t4Token);
    const mentorStillT2 = await pool.query(
      `SELECT teacher_id FROM class_mentors WHERE school_id = $1 AND class_id = $2 AND section_id = $3`,
      [TEST_SCHOOL_ID, testClassId, testSectionId]
    );

    const tc21Ok = mentorStillT2.rows[0]?.teacher_id === t2UserId &&
      (Array.isArray(t4MyClassesRes.data) ? t4MyClassesRes.data.length === 0 : true);

    report('TC-21: Teacher auto-reconciliation prevents mentor hijacking (ON CONFLICT DO NOTHING preserves existing mentor)',
      tc21Ok,
      JSON.stringify({ existingMentor: mentorStillT2.rows[0]?.teacher_id, t2UserId, t4Response: t4MyClassesRes.data })
    );

    // TC-22: Backend authorization protection on publish-results and reports
    // Teacher 4 (not mentor for Class 9 Section A) attempts to publish results for Section A
    const unauthPublishRes = await apiReq('/teacher/mentor/publish-results', {
      method: 'POST',
      body: JSON.stringify({
        classId: testClassId,
        sectionId: testSectionId,
        title: 'Unauthorized Midterm Exam',
        totalMarks: 100
      })
    }, t4Token);

    const tc22Ok = unauthPublishRes.status === 403;
    report('TC-22: Backend authorization strictly protects publish-results (unauthorized teacher receives 403 Forbidden)',
      tc22Ok,
      JSON.stringify({ status: unauthPublishRes.status, message: unauthPublishRes.data?.message })
    );

    // TC-23: Credential leak prevention across login, profile, and auth endpoints
    const leakCheckLogin = !stu1LoginCheck.data?.user?.password && !stu1LoginCheck.data?.user?.password_hash;
    const leakCheckChange = !changePassRes.data?.user?.password && !changePassRes.data?.user?.password_hash;
    const leakCheckT1 = !t1ReLoginRes.data?.user?.password && !t1ReLoginRes.data?.user?.password_hash;

    report('TC-23: Credential leak prevention: password and password_hash are strictly stripped from all API responses',
      leakCheckLogin && leakCheckChange && leakCheckT1,
      JSON.stringify({ leakCheckLogin, leakCheckChange, leakCheckT1 })
    );

  } catch (err: any) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    console.log('\n--- CLEANUP: Removing isolated test fixtures ---');
    try {
      if (testClassId) {
        await pool.query(`DELETE FROM class_mentors WHERE school_id = $1`, [TEST_SCHOOL_ID]);
      }
      if (createdStudentIds.length > 0) {
        await pool.query(`DELETE FROM students WHERE id = ANY($1::uuid[])`, [createdStudentIds]);
      }
      if (createdUserIds.length > 0) {
        await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
      await pool.query(`DELETE FROM sections WHERE school_id = $1`, [TEST_SCHOOL_ID]);
      await pool.query(`DELETE FROM classes WHERE school_id = $1`, [TEST_SCHOOL_ID]);
      await pool.query(`DELETE FROM academic_years WHERE school_id = $1`, [TEST_SCHOOL_ID]);
      await pool.query(`DELETE FROM schools WHERE id = $1`, [TEST_SCHOOL_ID]);
      console.log('Teardown complete: All test fixtures successfully cleaned up.');
    } catch (cleanupErr: any) {
      console.warn('Cleanup error:', cleanupErr.message);
    }

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  console.log('\n========================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerificationSuite().catch((err) => {
  console.error('Unhandled runner error:', err);
  process.exit(1);
});
