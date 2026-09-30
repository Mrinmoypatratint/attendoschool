import { pool } from '../db';
import crypto from 'crypto';

async function testStudentCrud() {
  console.log('=== TESTING SUPABASE STUDENT CRUD OPERATIONS ===');
  const schoolId = '00000000-0000-0000-0000-000000000001';

  // 1. Check or resolve Class and Section
  const clsQ = await pool.query(
    'SELECT id, class_number FROM classes WHERE school_id=$1 AND class_number=10 LIMIT 1',
    [schoolId]
  );
  if (!clsQ.rowCount) throw new Error('Class 10 not found for school');
  const classId = clsQ.rows[0].id;

  const secQ = await pool.query(
    'SELECT id, name FROM sections WHERE school_id=$1 AND class_id=$2 AND name=\'A\' LIMIT 1',
    [schoolId, classId]
  );
  if (!secQ.rowCount) throw new Error('Section A not found for class 10');
  const sectionId = secQ.rows[0].id;

  const ayQ = await pool.query(
    'SELECT id, name FROM academic_years WHERE school_id=$1 AND is_active=true LIMIT 1',
    [schoolId]
  );
  const academicYearId = ayQ.rows[0]?.id || null;

  // 2. CREATE student
  const testStudentId = crypto.randomUUID();
  const testRoll = 'TEST-' + Math.floor(1000 + Math.random() * 9000);
  const testAdmission = 'ADM-TEST-' + Math.floor(1000 + Math.random() * 9000);

  console.log(`1. Inserting test student (ID: ${testStudentId}, Roll: ${testRoll})...`);
  const insertRes = await pool.query(
    `INSERT INTO students (
       id, school_id, academic_year_id, class_id, section_id, roll_number,
       admission_number, name, parent_name, parent_sms_number, email, parent_email,
       date_of_birth, gender, address, is_active
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
     RETURNING *`,
    [
      testStudentId, schoolId, academicYearId, classId, sectionId, testRoll,
      testAdmission, 'Aarav Patel', 'Rajesh Patel', '+91 98765 00001',
      'aarav.test@example.com', 'rajesh.patel@example.com',
      '2010-05-15', 'Male', '123 Test Park, Sector 4'
    ]
  );
  console.log('✓ Student inserted successfully:', insertRes.rows[0].name);

  // 3. READ student with JOINs
  console.log('2. Querying student with JOIN to classes, sections, academic_years...');
  const readRes = await pool.query(
    `SELECT st.id, st.name, st.roll_number, st.admission_number, st.parent_name, st.parent_sms_number,
            c.class_number, sec.name AS section_name, ay.name AS session_name
     FROM students st
     JOIN classes c ON c.id = st.class_id
     JOIN sections sec ON sec.id = st.section_id
     LEFT JOIN academic_years ay ON ay.id = st.academic_year_id
     WHERE st.id = $1 AND st.school_id = $2`,
    [testStudentId, schoolId]
  );
  if (!readRes.rowCount) throw new Error('Failed to read student');
  console.log('✓ Student read successfully:', readRes.rows[0]);

  // 4. UPDATE student
  console.log('3. Updating student information...');
  const updateRes = await pool.query(
    `UPDATE students
     SET name = $1, parent_name = $2, updated_at = NOW()
     WHERE id = $3 AND school_id = $4
     RETURNING id, name, parent_name`,
    ['Aarav R. Patel', 'Rajesh K. Patel', testStudentId, schoolId]
  );
  console.log('✓ Student updated successfully:', updateRes.rows[0]);

  // 5. TEST ON CONFLICT UPSERT (Re-enrolling student)
  console.log('4. Testing ON CONFLICT upsert...');
  const upsertRes = await pool.query(
    `INSERT INTO students (
       school_id, academic_year_id, class_id, section_id, roll_number,
       admission_number, name, parent_name, parent_sms_number, is_active
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
     ON CONFLICT (class_id, section_id, roll_number) DO UPDATE SET
       name = EXCLUDED.name,
       parent_name = EXCLUDED.parent_name,
       is_active = true,
       updated_at = NOW()
     RETURNING id, name, is_active`,
    [
      schoolId, academicYearId, classId, sectionId, testRoll,
      testAdmission, 'Aarav R. Patel (Re-enrolled)', 'Rajesh K. Patel', '+91 98765 00001'
    ]
  );
  console.log('✓ Upsert succeeded without collision:', upsertRes.rows[0]);

  // 6. DELETE / CLEANUP
  console.log('5. Cleaning up test student...');
  await pool.query('DELETE FROM students WHERE id = $1', [testStudentId]);
  console.log('✓ Test student cleaned up successfully.');

  console.log('\n=== ALL SUPABASE STUDENT CRUD OPERATIONS PASSED 100% ===');
  await pool.end();
}

testStudentCrud().catch(err => {
  console.error('Student CRUD test failed:', err);
  process.exit(1);
});
