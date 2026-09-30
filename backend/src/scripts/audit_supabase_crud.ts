import { pool } from '../db';
import crypto from 'crypto';

async function auditSupabaseCrud() {
  console.log('=== STARTING SUPABASE CRUD AUDIT ===\n');

  // 1. Schools
  console.log('1. Checking Schools...');
  const schools = await pool.query('SELECT id, name, code, status FROM schools');
  console.log(`Found ${schools.rowCount} schools:`, schools.rows);
  const schoolId = schools.rows[0]?.id || '00000000-0000-0000-0000-000000000001';

  // 2. Academic Years
  console.log('\n2. Checking Academic Years...');
  const years = await pool.query('SELECT id, name, start_date, end_date, is_active FROM academic_years WHERE school_id = $1', [schoolId]);
  console.log(`Found ${years.rowCount} academic years:`, years.rows);

  // 3. Classes and Sections
  console.log('\n3. Checking Classes & Sections...');
  const classes = await pool.query('SELECT id, class_number FROM classes WHERE school_id = $1 ORDER BY class_number', [schoolId]);
  console.log(`Found ${classes.rowCount} classes.`);
  const sections = await pool.query('SELECT id, class_id, name FROM sections WHERE school_id = $1 ORDER BY name', [schoolId]);
  console.log(`Found ${sections.rowCount} sections.`);

  const testClass = classes.rows[0];
  const testSection = sections.rows.find(s => s.class_id === testClass?.id) || sections.rows[0];
  console.log('Using test class:', testClass?.class_number, testClass?.id);
  console.log('Using test section:', testSection?.name, testSection?.id);

  // 4. Subjects
  console.log('\n4. Checking Subjects...');
  let subject = (await pool.query('SELECT id, name FROM subjects WHERE school_id = $1 LIMIT 1', [schoolId])).rows[0];
  if (!subject) {
    const newSub = await pool.query('INSERT INTO subjects (school_id, name) VALUES ($1, $2) RETURNING id, name', [schoolId, 'Mathematics']);
    subject = newSub.rows[0];
    console.log('Created sample subject:', subject);
  } else {
    console.log('Found existing subject:', subject);
  }

  // 5. Users / Teachers
  console.log('\n5. Checking Users / Teachers...');
  const teachers = await pool.query(`
    SELECT u.id, u.email, u.name, u.role, tp.employee_id, tp.phone
    FROM users u
    LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
    WHERE u.school_id = $1 AND u.role = 'TEACHER'
  `, [schoolId]);
  console.log(`Found ${teachers.rowCount} teachers:`, teachers.rows.map(t => ({ id: t.id, name: t.name, email: t.email })));
  const teacherId = teachers.rows[0]?.id || users_first(schoolId);

  // 6. Test Student CRUD
  console.log('\n6. Testing Student CRUD in Supabase...');
  const studentId = crypto.randomUUID();
  const rollNum = 'TEST-' + Math.floor(1000 + Math.random() * 9000);
  
  // INSERT
  console.log('  Testing Student INSERT...');
  await pool.query(`
    INSERT INTO students (
      id, school_id, class_id, section_id, roll_number, admission_number,
      name, parent_name, parent_sms_number, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
  `, [studentId, schoolId, testClass.id, testSection.id, rollNum, 'ADM-' + rollNum, 'Audit Test Student', 'Audit Parent', '+919876543210']);
  console.log('  Student INSERT successful.');

  // SELECT
  console.log('  Testing Student SELECT...');
  const selStudent = await pool.query('SELECT * FROM students WHERE id = $1', [studentId]);
  console.log('  Student SELECT returned:', selStudent.rows[0]?.name, selStudent.rows[0]?.roll_number);

  // UPDATE
  console.log('  Testing Student UPDATE...');
  await pool.query('UPDATE students SET name = $1, updated_at = NOW() WHERE id = $2', ['Updated Audit Student', studentId]);
  const updStudent = await pool.query('SELECT name FROM students WHERE id = $1', [studentId]);
  console.log('  Student UPDATE verified:', updStudent.rows[0]?.name);

  // 7. Test Attendance Session & Records CRUD
  console.log('\n7. Testing Attendance Sessions & Records in Supabase...');
  const sessionId = crypto.randomUUID();
  const todayStr = new Date().toISOString().slice(0, 10);

  // INSERT Attendance Session
  console.log('  Testing Attendance Session INSERT...');
  await pool.query(`
    INSERT INTO attendance_sessions (
      id, school_id, class_id, section_id, subject_id, teacher_id,
      attendance_date, start_time, end_time, class_number, section_name,
      present_count, absent_count, total_count, submitted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
  `, [
    sessionId, schoolId, testClass.id, testSection.id, subject.id, teachers.rows[0]?.id || null,
    todayStr, '09:00:00', '09:45:00', testClass.class_number, testSection.name,
    1, 0, 1
  ]);
  console.log('  Attendance Session INSERT successful.');

  // INSERT Attendance Record
  console.log('  Testing Attendance Record INSERT...');
  const recordId = crypto.randomUUID();
  await pool.query(`
    INSERT INTO attendance_records (
      id, attendance_session_id, student_id, is_present, status, remarks, marked_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
  `, [recordId, sessionId, studentId, true, 'PRESENT', 'Audit attendance test']);
  console.log('  Attendance Record INSERT successful.');

  // SELECT Attendance Session & Record
  console.log('  Testing Attendance JOIN SELECT...');
  const attRes = await pool.query(`
    SELECT s.id as session_id, s.attendance_date, s.present_count, s.absent_count,
           r.id as record_id, r.student_id, r.status, st.name as student_name
    FROM attendance_sessions s
    JOIN attendance_records r ON r.attendance_session_id = s.id
    JOIN students st ON st.id = r.student_id
    WHERE s.id = $1
  `, [sessionId]);
  console.log('  Attendance JOIN SELECT verified:', attRes.rows);

  // 8. Timetable periods & entries
  console.log('\n8. Checking Timetable schema in Supabase...');
  const periodCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'timetable_periods'");
  console.log('  timetable_periods columns:', periodCols.rows.map(c => c.column_name).join(', '));
  const entryCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'timetable_entries'");
  console.log('  timetable_entries columns:', entryCols.rows.map(c => c.column_name).join(', '));

  // 9. Clean up test records
  console.log('\n9. Cleaning up test data...');
  await pool.query('DELETE FROM attendance_records WHERE id = $1', [recordId]);
  await pool.query('DELETE FROM attendance_sessions WHERE id = $1', [sessionId]);
  await pool.query('DELETE FROM students WHERE id = $1', [studentId]);
  console.log('  Cleanup successful.');

  console.log('\n=== SUPABASE CRUD AUDIT COMPLETED SUCCESSFULLY ===');
  await pool.end();
}

function users_first(schoolId: string) {
  return null;
}

auditSupabaseCrud().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
