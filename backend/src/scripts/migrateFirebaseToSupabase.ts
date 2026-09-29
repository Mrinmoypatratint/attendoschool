import 'dotenv/config';
import { pool, isPostgresConfigured } from '../db';
import { collections, isFirebaseConfigured, getFirebaseStatus } from '../firebase';

/**
 * AttendoSchool — One-Time Firebase to Supabase Data Migrator
 * Reads all historical documents from Firebase Cloud Firestore
 * and safely upserts them into Supabase PostgreSQL.
 */
async function migrateFirebaseToSupabase() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('   ATTENDOSCHOOL — FIREBASE TO SUPABASE MIGRATION WIZARD         ');
  console.log('═════════════════════════════════════════════════════════════════\n');

  if (!isFirebaseConfigured()) {
    console.error('❌ Firebase is not configured in .env. Aborting.');
    process.exit(1);
  }
  if (!isPostgresConfigured) {
    console.error('❌ Supabase / PostgreSQL is not configured in .env. Aborting.');
    process.exit(1);
  }

  const fbStatus = getFirebaseStatus();
  console.log(`📌 Source: Firebase Project "${fbStatus.projectId}"`);
  console.log(`📌 Target: Supabase PostgreSQL\n`);

  const client = await pool.connect();

  try {
    // 1. Schools
    console.log('🏫 Checking and migrating Schools...');
    try {
      const schoolsSnap = await collections.schools().get();
      console.log(`   Found ${schoolsSnap.size} schools in Firebase.`);
      for (const doc of schoolsSnap.docs) {
        const s = doc.data();
        const schoolId = doc.id;
        const code = s.code || doc.id.slice(0, 10).toUpperCase();
        await client.query(`
          INSERT INTO schools (id, name, code, email, phone, enquiry_number, address, status, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            code = EXCLUDED.code,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            updated_at = NOW();
        `, [
          schoolId,
          s.name || 'Unnamed School',
          code,
          s.email || null,
          s.phone || null,
          s.enquiry_number || s.phone || null,
          s.address || 'Main Campus',
          s.status || 'ACTIVE'
        ]);
      }
    } catch (err: any) {
      console.warn('   ⚠️ Schools migration notice:', err.message);
    }

    // 2. Students
    console.log('\n🎒 Checking and migrating Students...');
    try {
      const studentsSnap = await collections.students().get();
      console.log(`   Found ${studentsSnap.size} students in Firebase.`);
      let syncedCount = 0;
      for (const doc of studentsSnap.docs) {
        const st = doc.data();
        const id = doc.id;
        const schoolId = st.school_id || st.schoolId;
        if (!schoolId) continue;

        await client.query(`
          INSERT INTO students (id, school_id, class_id, section_id, roll_number, admission_number, name, parent_name, parent_sms_number, is_active, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (id) DO UPDATE SET
            roll_number = EXCLUDED.roll_number,
            admission_number = EXCLUDED.admission_number,
            name = EXCLUDED.name,
            parent_name = EXCLUDED.parent_name,
            parent_sms_number = EXCLUDED.parent_sms_number,
            is_active = EXCLUDED.is_active,
            updated_at = NOW();
        `, [
          id,
          schoolId,
          st.class_id || st.classId || null,
          st.section_id || st.sectionId || null,
          String(st.roll_number || st.rollNumber || '0'),
          st.admission_number || st.admissionNumber || `ADM-${id}`,
          st.name || st.fullName || 'Student',
          st.parent_name || st.parentName || '',
          st.parent_phone || st.parent_sms_number || '',
          st.is_active !== false
        ]);
        syncedCount++;
      }
      console.log(`   ✅ Successfully migrated ${syncedCount} students.`);
    } catch (err: any) {
      console.warn('   ⚠️ Students migration notice:', err.message);
    }

    // 3. Attendance Sessions
    console.log('\n📋 Checking and migrating Attendance Sessions...');
    try {
      const sessSnap = await collections.attendanceSessions().get();
      console.log(`   Found ${sessSnap.size} attendance sessions in Firebase.`);
      let sessCount = 0;
      for (const doc of sessSnap.docs) {
        const sess = doc.data();
        const schoolId = sess.school_id || sess.schoolId;
        if (!schoolId) continue;

        await client.query(`
          INSERT INTO attendance_sessions (
            id, school_id, class_id, section_id, subject_id, teacher_id,
            attendance_date, start_time, end_time, class_number, section_name,
            present_count, absent_count, total_count, submitted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          ON CONFLICT (id) DO UPDATE SET
            present_count = EXCLUDED.present_count,
            absent_count = EXCLUDED.absent_count,
            total_count = EXCLUDED.total_count,
            submitted_at = NOW();
        `, [
          doc.id,
          schoolId,
          sess.class_id || sess.classId || null,
          sess.section_id || sess.sectionId || null,
          sess.subject_id || sess.subjectId || null,
          sess.teacher_id || sess.teacherId || null,
          sess.attendance_date || sess.attendanceDate || new Date().toISOString().slice(0, 10),
          sess.start_time || '09:00:00',
          sess.end_time || '10:00:00',
          Number(sess.class_number || sess.classNumber || 10),
          sess.section_name || sess.sectionName || 'A',
          Number(sess.present_count || sess.presentCount || 0),
          Number(sess.absent_count || sess.absentCount || 0),
          Number(sess.total_count || sess.totalCount || 0)
        ]);
        sessCount++;
      }
      console.log(`   ✅ Successfully migrated ${sessCount} attendance sessions.`);
    } catch (err: any) {
      console.warn('   ⚠️ Attendance migration notice:', err.message);
    }

    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log('🎉 FIREBASE TO SUPABASE MIGRATION RUN FINISHED');
    console.log('═════════════════════════════════════════════════════════════════\n');
  } finally {
    client.release();
    await pool.end();
  }
}

migrateFirebaseToSupabase().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
