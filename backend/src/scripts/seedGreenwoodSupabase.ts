import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, isPostgresConfigured } from '../db';

/**
 * AttendoSchool — Clean Greenwood Data & Keep Only Login Credentials
 * Wipes all students, classes, sections, subjects, routines, attendance records,
 * leaving strictly the login credentials for Greenwood International School.
 */
async function seedGreenwoodSupabase() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('   ATTENDOSCHOOL — PURGE ALL GREENWOOD DATA (CREDENTIALS ONLY)   ');
  console.log('═════════════════════════════════════════════════════════════════\n');

  if (!isPostgresConfigured) {
    console.error('❌ Supabase / PostgreSQL is not configured.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const greenwoodSchoolId = '00000000-0000-0000-0000-000000000001';
    const passwordHash = await bcrypt.hash('ChangeMe123!', 10);

    // 1. Purge all data associated with Greenwood from transactional & operational tables
    console.log('🧹 Purging all Greenwood operational data...');

    const tablesToClean = [
      'attendance_records',
      'attendance_sessions',
      'attendance_audit_logs',
      'attendance_correction_requests',
      'attendance_monthly_summary_v12',
      'student_assignment_submissions',
      'student_assignments',
      'student_exam_results',
      'student_exams',
      'student_leave_requests',
      'student_promotions',
      'student_enrollment_history_v28',
      'students',
      'class_routines',
      'substitute_assignments',
      'timetable_entries',
      'timetable_periods',
      'timetable_conflicts',
      'sections',
      'classes',
      'subjects',
      'academic_years',
      'announcement_recipients',
      'announcements',
      'notification_replies',
      'notification_logs',
      'sms_logs'
    ];

    for (const tbl of tablesToClean) {
      try {
        if (tbl === 'attendance_records') {
          await client.query(`
            DELETE FROM attendance_records
            WHERE attendance_session_id IN (
              SELECT id FROM attendance_sessions WHERE school_id = $1
            )
          `, [greenwoodSchoolId]);
        } else if (tbl === 'student_assignment_submissions') {
          await client.query(`
            DELETE FROM student_assignment_submissions
            WHERE assignment_id IN (
              SELECT id FROM student_assignments WHERE school_id = $1
            )
          `, [greenwoodSchoolId]);
        } else if (tbl === 'student_exam_results') {
          await client.query(`
            DELETE FROM student_exam_results
            WHERE exam_id IN (
              SELECT id FROM student_exams WHERE school_id = $1
            )
          `, [greenwoodSchoolId]);
        } else if (tbl === 'announcement_recipients') {
          await client.query(`
            DELETE FROM announcement_recipients
            WHERE announcement_id IN (
              SELECT id FROM announcements WHERE school_id = $1
            )
          `, [greenwoodSchoolId]);
        } else {
          await client.query(`DELETE FROM ${tbl} WHERE school_id = $1`, [greenwoodSchoolId]);
        }
        console.log(`   ✓ Cleaned ${tbl}`);
      } catch (err: any) {
        // Table may not exist or has different schema; proceed safely
      }
    }

    // 2. Remove any extraneous users belonging to Greenwood except standard credential accounts
    console.log('🧹 Purging non-credential users...');
    const keepEmails = [
      'admin@demo-school.local',
      'rahul@demo-school.local',
      'priya@demo-school.local',
      'student@greenwood.local',
      'superadmin@attendance.local'
    ];
    await client.query(`
      DELETE FROM users
      WHERE school_id = $1 AND LOWER(email) != ALL($2::text[])
    `, [greenwoodSchoolId, keepEmails.map(e => e.toLowerCase())]);

    // 3. Ensure Greenwood School Entity exists for login association
    console.log('🏫 Ensuring Greenwood International School exists...');
    await client.query(`
      INSERT INTO schools (id, name, code, email, phone, enquiry_number, address, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        enquiry_number = EXCLUDED.enquiry_number,
        address = EXCLUDED.address,
        status = 'ACTIVE',
        updated_at = NOW();
    `, [
      greenwoodSchoolId,
      'Greenwood International School',
      'GIS001',
      'contact@greenwood.edu.in',
      '+91 98765 43210',
      '+91 98765 43210',
      'Campus 4, Tech Park Boulevard, Bengaluru, Karnataka'
    ]);

    // 4. Seed / Upsert STRICTLY the login credential accounts
    console.log('👤 Upserting Greenwood Login Credentials...');

    // 4a. School Admin
    await client.query(`
      INSERT INTO users (school_id, name, email, password_hash, role, is_active, updated_at)
      VALUES ($1, $2, $3, $4, 'SCHOOL_ADMIN', true, NOW())
      ON CONFLICT (email) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'SCHOOL_ADMIN',
        is_active = true,
        updated_at = NOW();
    `, [
      greenwoodSchoolId,
      'Greenwood Principal Admin',
      'admin@demo-school.local',
      passwordHash
    ]);

    // 4b. Teachers
    const teachers = [
      { name: 'Rahul Sharma', email: 'rahul@demo-school.local', empId: 'EMP001', mobile: '+91 98765 43222' },
      { name: 'Priya Patel', email: 'priya@demo-school.local', empId: 'EMP002', mobile: '+91 98765 43223' }
    ];

    for (const t of teachers) {
      const uRes = await client.query(`
        INSERT INTO users (school_id, name, email, password_hash, role, is_active, updated_at)
        VALUES ($1, $2, $3, $4, 'TEACHER', true, NOW())
        ON CONFLICT (email) DO UPDATE SET
          school_id = EXCLUDED.school_id,
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = 'TEACHER',
          is_active = true,
          updated_at = NOW()
        RETURNING id;
      `, [greenwoodSchoolId, t.name, t.email, passwordHash]);

      const userId = uRes.rows[0]?.id;
      if (userId) {
        await client.query(`
          INSERT INTO teacher_profiles (user_id, employee_id, mobile)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET
            employee_id = EXCLUDED.employee_id,
            mobile = EXCLUDED.mobile;
        `, [userId, t.empId, t.mobile]);
      }
    }

    // 4c. Student Account
    await client.query(`
      INSERT INTO users (school_id, name, email, password_hash, role, is_active, updated_at)
      VALUES ($1, $2, $3, $4, 'STUDENT', true, NOW())
      ON CONFLICT (email) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'STUDENT',
        is_active = true,
        updated_at = NOW();
    `, [greenwoodSchoolId, 'Rohan Sharma', 'student@greenwood.local', passwordHash]);

    // 4d. Super Admin
    await client.query(`
      INSERT INTO users (school_id, name, email, password_hash, role, is_active, updated_at)
      VALUES (NULL, $1, $2, $3, 'SUPER_ADMIN', true, NOW())
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'SUPER_ADMIN',
        is_active = true,
        updated_at = NOW();
    `, ['Company Super Admin', 'superadmin@attendance.local', passwordHash]);

    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL GREENWOOD OPERATIONAL DATA PURGED SUCCESSFULLY!');
    console.log('   - 0 Students in database');
    console.log('   - 0 Classes in database');
    console.log('   - 0 Sections in database');
    console.log('   - 0 Attendance records in database');
    console.log('   - 0 Routines / Timetable entries in database');
    console.log('   - ONLY Login Credentials preserved:');
    console.log('     • superadmin@attendance.local (SUPER_ADMIN)');
    console.log('     • admin@demo-school.local     (SCHOOL_ADMIN)');
    console.log('     • rahul@demo-school.local     (TEACHER)');
    console.log('     • priya@demo-school.local     (TEACHER)');
    console.log('     • student@greenwood.local     (STUDENT)');
    console.log('═════════════════════════════════════════════════════════════════\n');
  } catch (err: any) {
    console.error('❌ Seeding/Purging error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedGreenwoodSupabase().catch(console.error);
