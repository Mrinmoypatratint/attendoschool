import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, isPostgresConfigured } from '../db';

async function seedGreenwoodSupabase() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('   ATTENDOSCHOOL — SEED GREENWOOD TO SUPABASE POSTGRESQL         ');
  console.log('═════════════════════════════════════════════════════════════════\n');

  if (!isPostgresConfigured) {
    console.error('❌ Supabase / PostgreSQL is not configured.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
    const greenwoodSchoolId = '00000000-0000-0000-0000-000000000001';

    // 1. Remove any other schools if any exist (keep ONLY Greenwood)
    console.log('🧹 Purging non-Greenwood schools from Supabase...');
    await client.query('DELETE FROM schools WHERE id != $1', [greenwoodSchoolId]);

    // 2. Insert or update Greenwood International School
    console.log('🏫 Seeding Greenwood International School...');
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

    // 3. Seed Greenwood School Admin
    console.log('👤 Seeding Greenwood Principal Admin (admin@demo-school.local)...');
    await client.query(`
      INSERT INTO users (id, school_id, name, email, password_hash, role, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'SCHOOL_ADMIN', true, NOW())
      ON CONFLICT (id) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        role = 'SCHOOL_ADMIN',
        is_active = true,
        updated_at = NOW();
    `, [
      '00000000-0000-0000-0000-000000000021',
      greenwoodSchoolId,
      'Greenwood Principal Admin',
      'admin@demo-school.local',
      passwordHash
    ]);

    // 4. Seed Greenwood Teachers
    console.log('👨‍🏫 Seeding Greenwood Teachers (Rahul Sharma, Priya Patel)...');
    const teachers = [
      {
        id: '00000000-0000-0000-0000-000000000022',
        name: 'Rahul Sharma',
        email: 'rahul@demo-school.local',
        empId: 'EMP001',
        mobile: '+91 98765 43222'
      },
      {
        id: '00000000-0000-0000-0000-000000000023',
        name: 'Priya Patel',
        email: 'priya@demo-school.local',
        empId: 'EMP002',
        mobile: '+91 98765 43223'
      }
    ];

    for (const t of teachers) {
      await client.query(`
        INSERT INTO users (id, school_id, name, email, password_hash, role, is_active, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'TEACHER', true, NOW())
        ON CONFLICT (id) DO UPDATE SET
          school_id = EXCLUDED.school_id,
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = 'TEACHER',
          is_active = true,
          updated_at = NOW();
      `, [t.id, greenwoodSchoolId, t.name, t.email, passwordHash]);

      await client.query(`
        INSERT INTO teacher_profiles (user_id, employee_id, mobile)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
          employee_id = EXCLUDED.employee_id,
          mobile = EXCLUDED.mobile;
      `, [t.id, t.empId, t.mobile]);
    }

    // 5. Seed Standard Classes (Class 5 to 12) & Sections (A, B) for Greenwood
    console.log('📚 Seeding Greenwood Classes (Class 5–12) & Sections (A, B)...');
    for (let c = 5; c <= 12; c++) {
      const clsRes = await client.query(`
        INSERT INTO classes (school_id, class_number)
        VALUES ($1, $2)
        ON CONFLICT (school_id, class_number) DO UPDATE SET class_number = EXCLUDED.class_number
        RETURNING id;
      `, [greenwoodSchoolId, c]);

      const classId = clsRes.rows[0]?.id;
      if (classId) {
        for (const secName of ['A', 'B']) {
          await client.query(`
            INSERT INTO sections (school_id, class_id, name)
            VALUES ($1, $2, $3)
            ON CONFLICT (class_id, name) DO NOTHING;
          `, [greenwoodSchoolId, classId, secName]);
        }
      }
    }

    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log('🎉 GREENWOOD SEEDING COMPLETED!');
    console.log('   - Only Greenwood International School exists in the system.');
    console.log('   - All non-Greenwood schools have been purged.');
    console.log('   - Admin: admin@demo-school.local / ChangeMe123!');
    console.log('═════════════════════════════════════════════════════════════════\n');
  } catch (err: any) {
    console.error('❌ Seeding error:', err.message);
  } finally {
    client.release();
  }
}

seedGreenwoodSupabase().catch(console.error);
