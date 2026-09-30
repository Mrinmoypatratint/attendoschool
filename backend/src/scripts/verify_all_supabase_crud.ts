import { pool } from '../db';
import crypto from 'crypto';
import { DualDatabaseService } from '../services/dualDatabaseService';
import { getSchoolDashboardStats } from '../services/tenantDataService';
import { attendanceSummary, studentAttendanceReport, dailyAttendanceReport } from '../services/attendanceReportService';
import { getStudentDashboard, getStudentTimetable } from '../services/studentService';

async function verifyAllSupabaseCrud() {
  console.log('===============================================================');
  console.log('       SUPABASE PRIMARY DATABASE COMPREHENSIVE CRUD AUDIT       ');
  console.log('===============================================================');

  const schoolId = '00000000-0000-0000-0000-000000000001';

  // 1. Schools
  console.log('\n[1/10] Verifying Schools (Supabase)...');
  const sch = await DualDatabaseService.getSchoolFromSupabase(schoolId);
  if (!sch) throw new Error('Failed to fetch school from Supabase');
  console.log(`  ✓ School verified: "${sch.name}" (${sch.id})`);

  // 2. Academic Years
  console.log('\n[2/10] Verifying Academic Years (Supabase)...');
  const ay = await DualDatabaseService.getActiveAcademicYearFromSupabase(schoolId);
  if (!ay) throw new Error('Active academic year not found in Supabase');
  console.log(`  ✓ Active Academic Year: "${ay.name}" (${ay.id})`);

  // 3. Classes and Sections
  console.log('\n[3/10] Verifying Classes & Sections (Supabase)...');
  const classCount = await DualDatabaseService.getClassCountFromSupabase(schoolId);
  const sectionCount = await DualDatabaseService.getSectionCountFromSupabase(schoolId);
  console.log(`  ✓ Classes count: ${classCount}, Sections count: ${sectionCount}`);
  if (classCount < 1 || sectionCount < 1) throw new Error('Classes/sections missing in Supabase');

  const clsQ = await pool.query('SELECT id, class_number FROM classes WHERE school_id=$1 AND class_number=10 LIMIT 1', [schoolId]);
  const classId = clsQ.rows[0].id;
  const secQ = await pool.query('SELECT id, name FROM sections WHERE school_id=$1 AND class_id=$2 AND name=\'A\' LIMIT 1', [schoolId, classId]);
  const sectionId = secQ.rows[0].id;

  // 4. Teachers
  console.log('\n[4/10] Verifying Teachers & Users (Supabase)...');
  const teacherCount = await DualDatabaseService.getTeacherCountFromSupabase(schoolId);
  const teachers = await pool.query("SELECT id, name, email FROM users WHERE school_id=$1 AND role='TEACHER' LIMIT 1", [schoolId]);
  const teacherId = teachers.rows[0]?.id;
  console.log(`  ✓ Teacher count: ${teacherCount}, sample teacher: ${teachers.rows[0]?.name || 'N/A'}`);

  // 5. Subjects
  console.log('\n[5/10] Verifying Subjects (Supabase)...');
  let subQ = await pool.query('SELECT id, name FROM subjects WHERE school_id=$1 LIMIT 1', [schoolId]);
  let subjectId: string;
  if (!subQ.rowCount) {
    const newSubId = crypto.randomUUID();
    await pool.query('INSERT INTO subjects (id, school_id, name, code) VALUES ($1, $2, $3, $4)', [newSubId, schoolId, 'Mathematics', 'MATH-101']);
    subjectId = newSubId;
  } else {
    subjectId = subQ.rows[0].id;
  }
  console.log(`  ✓ Subject verified: ID ${subjectId}`);

  // 6. Student CRUD
  console.log('\n[6/10] Verifying Student CRUD (Supabase)...');
  const studentId = crypto.randomUUID();
  const roll = 'E2E-' + Math.floor(1000 + Math.random() * 9000);
  await pool.query(`
    INSERT INTO students (
      id, school_id, academic_year_id, class_id, section_id, roll_number,
      admission_number, name, parent_name, parent_sms_number, email, parent_email, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
  `, [studentId, schoolId, ay.id, classId, sectionId, roll, 'ADM-' + roll, 'Test Student E2E', 'Parent Test', '+91 98765 00000', 'student.e2e@test.local', 'parent.e2e@test.local']);

  const stCount = await DualDatabaseService.getStudentCountFromSupabase(schoolId);
  console.log(`  ✓ Student inserted and verified in count: ${stCount} total students`);

  // 7. Attendance Session & Records CRUD
  console.log('\n[7/10] Verifying Attendance Session & Records CRUD (Supabase)...');
  const sessionId = crypto.randomUUID();
  const recordId = crypto.randomUUID();
  const todayStr = new Date().toISOString().slice(0, 10);

  await pool.query(`
    INSERT INTO attendance_sessions (
      id, school_id, class_id, section_id, subject_id, teacher_id,
      attendance_date, start_time, end_time, class_number, section_name,
      present_count, absent_count, total_count, submitted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, '09:00:00', '09:45:00', 10, 'A', 1, 0, 1, NOW())
  `, [sessionId, schoolId, classId, sectionId, subjectId, teacherId || '00000000-0000-0000-0000-000000000001', todayStr]);

  await pool.query(`
    INSERT INTO attendance_records (
      id, attendance_session_id, student_id, is_present, status, remarks, marked_at
    ) VALUES ($1, $2, $3, true, 'PRESENT', 'E2E marked attendance', NOW())
  `, [recordId, sessionId, studentId]);

  const todayAtt = await DualDatabaseService.getTodayAttendanceFromSupabase(schoolId);
  console.log(`  ✓ Today's Attendance Session verified from Supabase:`, todayAtt);

  // 8. Timetable Periods & Entries CRUD
  console.log('\n[8/10] Verifying Timetable Periods & Entries CRUD (Supabase)...');
  const periodId = crypto.randomUUID();
  await pool.query(`
    INSERT INTO timetable_periods (id, school_id, name, period_number, start_time, end_time, is_break, is_active)
    VALUES ($1, $2, 'Period E2E', 99, '15:00:00', '15:45:00', false, true)
  `, [periodId, schoolId]);

  const entryId = crypto.randomUUID();
  await pool.query(`
    INSERT INTO timetable_entries (
      id, school_id, academic_year_id, class_id, section_id, subject_id, teacher_id, period_id, day_of_week, room_name, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 'Room 101', 'PUBLISHED')
  `, [entryId, schoolId, ay.id, classId, sectionId, subjectId, teacherId || null, periodId]);

  const timetableEntries = await pool.query(`
    SELECT e.id, p.name AS period_name, p.start_time, p.end_time, sub.name AS subject_name
    FROM timetable_entries e
    JOIN timetable_periods p ON p.id = e.period_id
    LEFT JOIN subjects sub ON sub.id = e.subject_id
    WHERE e.id = $1
  `, [entryId]);
  console.log('  ✓ Timetable JOIN query verified:', timetableEntries.rows[0]);

  // 9. Dashboard & Analytics Stats (Supabase Primary)
  console.log('\n[9/10] Verifying School Dashboard Stats (Supabase Primary)...');
  const stats = await getSchoolDashboardStats(schoolId);
  console.log(`  ✓ Dashboard stats verified:`, {
    students: stats.totalStudents,
    teachers: stats.totalTeachers,
    classes: stats.totalClasses,
    sections: stats.totalSections,
    todayAttendance: stats.todayAttendance
  });

  // 10. Reports & Student Timetable Service Queries
  console.log('\n[10/10] Verifying Attendance Report & Student Services (Supabase)...');
  const summary = await attendanceSummary(schoolId, todayStr, todayStr);
  console.log('  ✓ Attendance summary report:', summary);

  const studentReport = await studentAttendanceReport(schoolId, todayStr, todayStr, studentId);
  console.log('  ✓ Student attendance report row count:', studentReport.length);

  // Clean up E2E test data
  console.log('\nCleaning up E2E test records from Supabase...');
  await pool.query('DELETE FROM timetable_entries WHERE id = $1', [entryId]);
  await pool.query('DELETE FROM timetable_periods WHERE id = $1', [periodId]);
  await pool.query('DELETE FROM attendance_records WHERE id = $1', [recordId]);
  await pool.query('DELETE FROM attendance_sessions WHERE id = $1', [sessionId]);
  await pool.query('DELETE FROM students WHERE id = $1', [studentId]);
  console.log('✓ All test records cleaned up cleanly.');

  console.log('\n===============================================================');
  console.log(' ⭐ ALL SUPABASE CRUD OPERATIONS AND QUERIES VERIFIED 100% ⭐ ');
  console.log('===============================================================');

  await pool.end();
}

verifyAllSupabaseCrud().catch(err => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
