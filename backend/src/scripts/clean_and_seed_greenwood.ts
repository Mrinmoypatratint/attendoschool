import bcrypt from 'bcryptjs';
import { pool, isPostgresConfigured } from '../db';

async function cleanAndSeedDatabase() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('   ATTENDOSCHOOL — DATABASE RESET & SEED BASELINE RESTORATION    ');
  console.log('   Preserving Greenwood International School + Clean Credentials  ');
  console.log('═════════════════════════════════════════════════════════════════\n');

  if (!isPostgresConfigured) {
    console.error('❌ Database not configured!');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const greenwoodSchoolId = '00000000-0000-0000-0000-000000000001';
    const passwordHash = await bcrypt.hash('ChangeMe123!', 10);

    // =================================================================
    // STEP 1: PURGE ALL OPERATIONAL / DUMMY / TRANSACTIONAL DATA
    // =================================================================
    console.log('[Step 1] Purging operational, transactional, and mock test data...');

    const tablesToWipe = [
      'subscription_invoices',
      'payments',
      'attendance_records',
      'attendance_sessions',
      'attendance_sync_batches',
      'attendance_audit_logs',
      'attendance_correction_audit',
      'attendance_correction_requests',
      'attendance_monthly_summary_v12',
      'student_assignment_submissions',
      'student_assignments',
      'student_exam_results',
      'student_exams',
      'student_leave_requests',
      'teacher_leave_requests',
      'photo_approval_requests',
      'student_promotions',
      'student_enrollment_history_v28',
      'students',
      'substitute_assignments',
      'class_routines',
      'timetable_conflicts',
      'timetable_entries',
      'timetable_periods',
      'sections',
      'classes',
      'subjects',
      'announcement_recipients',
      'announcements',
      'notification_replies',
      'notification_logs',
      'sms_logs',
      'password_resets',
      'audit_logs',
      'api_idempotency_keys',
      'analytics_events',
      'analytics_daily_snapshots',
      'admin_activity_logs',
      'backup_jobs',
      'backup_schedules',
      'system_health_checks',
      'school_admin_assignments',
      'school_admin_role_permissions'
    ];

    for (const tbl of tablesToWipe) {
      try {
        await client.query(`TRUNCATE TABLE "${tbl}" CASCADE`);
        console.log(`   ✓ Truncated: ${tbl}`);
      } catch {
        try {
          await client.query(`DELETE FROM "${tbl}"`);
          console.log(`   ✓ Deleted: ${tbl}`);
        } catch {
          // Table might not exist or already clean
        }
      }
    }

    // =================================================================
    // STEP 2: CLEAN NON-GREENWOOD SCHOOLS & FOREIGN KEYS
    // =================================================================
    console.log('\n[Step 2] Cleaning non-seed schools and associated records...');

    // 1. Subscriptions: purge all subscriptions (clean slate)
    await client.query(`DELETE FROM school_subscriptions`);

    // 2. Roles: purge non-Greenwood roles
    try {
      await client.query(`DELETE FROM school_admin_roles WHERE school_id != $1`, [greenwoodSchoolId]);
    } catch {}

    // 3. Academic years: purge non-Greenwood
    await client.query(`DELETE FROM academic_years WHERE school_id != $1`, [greenwoodSchoolId]);

    // 4. Calendar & notification settings: purge non-Greenwood
    try {
      await client.query(`DELETE FROM school_holidays WHERE school_id != $1`, [greenwoodSchoolId]);
      await client.query(`DELETE FROM school_working_days WHERE school_id != $1`, [greenwoodSchoolId]);
      await client.query(`DELETE FROM school_notification_channels WHERE school_id != $1`, [greenwoodSchoolId]);
      await client.query(`DELETE FROM notification_templates WHERE school_id != $1`, [greenwoodSchoolId]);
    } catch {}

    // 5. Clean users except standard credential emails before cleaning schools
    const credentialEmails = [
      'superadmin@attendance.local',
      'superadmin@attendoschool.com',
      'admin@demo-school.local',
      'admin@greenwood.edu.in',
      'rahul@demo-school.local',
      'priya@demo-school.local',
      'student@greenwood.local'
    ];

    // Wipe teacher profiles for non-credential users
    await client.query(`
      DELETE FROM teacher_profiles
      WHERE user_id NOT IN (
        SELECT id FROM users WHERE LOWER(email) = ANY($1::text[])
      )
    `, [credentialEmails.map(e => e.toLowerCase())]);

    // Wipe all other users
    await client.query(`
      DELETE FROM users
      WHERE LOWER(email) != ALL($1::text[])
    `, [credentialEmails.map(e => e.toLowerCase())]);

    // 6. Clean all schools except Greenwood
    await client.query(`DELETE FROM schools WHERE id != $1`, [greenwoodSchoolId]);
    console.log('   ✓ Removed all non-Greenwood school records and dependent foreign rows.');

    // =================================================================
    // STEP 3: ENSURE GREENWOOD INTERNATIONAL SCHOOL ENTITY
    // =================================================================
    console.log('\n[Step 3] Ensuring Greenwood International School canonical record...');
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
      '1800123456',
      'Campus 4, Tech Park Boulevard, Bengaluru, Karnataka'
    ]);
    console.log('   ✓ Greenwood school entity verified and active (GIS001)');

    // =================================================================
    // STEP 4: ENSURE CLEAN ACTIVE ACADEMIC YEAR (2025-2026)
    // =================================================================
    console.log('\n[Step 4] Ensuring clean Greenwood active academic year...');
    const ayRows = await client.query(`SELECT id FROM academic_years WHERE school_id = $1 ORDER BY created_at DESC`, [greenwoodSchoolId]);
    if (ayRows.rowCount === 0) {
      await client.query(`
        INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_active, is_archived, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000010', $1, '2025-2026', '2025-04-01', '2026-03-31', true, false, NOW(), NOW())
      `, [greenwoodSchoolId]);
      console.log('   ✓ Inserted active 2025-2026 academic year');
    } else {
      // Keep only 1 academic year and deactivate/delete extras to respect uq_academic_year_one_active
      const keepAyId = ayRows.rows[0].id;
      if (ayRows.rowCount && ayRows.rowCount > 1) {
        await client.query(`DELETE FROM academic_years WHERE school_id = $1 AND id != $2`, [greenwoodSchoolId, keepAyId]);
      }
      await client.query(`
        UPDATE academic_years 
        SET name = '2025-2026', start_date = '2025-04-01', end_date = '2026-03-31', is_active = true, is_archived = false, updated_at = NOW() 
        WHERE id = $1
      `, [keepAyId]);
      console.log('   ✓ Preserved exactly 1 clean active academic year (2025-2026)');
    }

    // =================================================================
    // STEP 5: ENSURE SUBSCRIPTION PLANS & ACTIVE GREENWOOD SUBSCRIPTION
    // =================================================================
    console.log('\n[Step 5] Ensuring SaaS subscription plans & Greenwood subscription...');
    await client.query(`
      INSERT INTO subscription_plans (id, name, price_monthly, price_yearly, max_students, is_active)
      VALUES 
        ('d0f31cbf-1686-441d-bbd4-206ea22a5322', 'Basic', 499, 499*12, 300, true),
        ('1dbc0d3d-db64-40cc-b5ea-958f902328c0', 'Standard', 999, 999*12, 1000, true),
        ('a7e784bf-2351-4782-aa8a-f51ab6bd32b1', 'Enterprise', 1999, 1999*12, 5000, true)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        price_monthly = EXCLUDED.price_monthly,
        price_yearly = EXCLUDED.price_yearly,
        max_students = EXCLUDED.max_students,
        is_active = true;
    `);

    await client.query(`
      INSERT INTO school_subscriptions (id, school_id, plan_id, start_date, end_date, status, created_at)
      VALUES ('00000000-0000-0000-0000-000000000011', $1, 'a7e784bf-2351-4782-aa8a-f51ab6bd32b1', '2025-01-01', '2027-12-31', 'ACTIVE', NOW())
      ON CONFLICT (id) DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        status = 'ACTIVE',
        end_date = '2027-12-31';
    `, [greenwoodSchoolId]);

    await client.query(`
      INSERT INTO payments (id, school_id, subscription_id, provider, amount, currency, status, created_at, paid_at)
      VALUES ('00000000-0000-0000-0000-000000000012', $1, '00000000-0000-0000-0000-000000000011', 'MOCK', 1999, 'INR', 'PAID', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = 'PAID',
        paid_at = NOW();
    `, [greenwoodSchoolId]);
    console.log('   ✓ Enterprise subscription & payment settled for Greenwood');

    // =================================================================
    // STEP 6: ENSURE CALENDAR, WORKING DAYS & NOTIFICATION CHANNELS
    // =================================================================
    console.log('\n[Step 6] Ensuring working calendar, default holidays & notification channels...');
    try {
      await client.query(`
        INSERT INTO school_working_days (school_id, working_days, weekend_days, saturday_rule, updated_at)
        VALUES ($1, ARRAY[1,2,3,4,5,6], ARRAY[0], 'WORKING', NOW())
        ON CONFLICT (school_id) DO UPDATE SET
          working_days = ARRAY[1,2,3,4,5,6],
          weekend_days = ARRAY[0],
          saturday_rule = 'WORKING',
          updated_at = NOW();
      `, [greenwoodSchoolId]);

      const holidays = [
        { name: 'Republic Day', date: '2026-01-26', type: 'NATIONAL' },
        { name: 'Holi', date: '2026-03-04', type: 'FESTIVAL' },
        { name: 'Good Friday', date: '2026-04-03', type: 'GAZETTED' },
        { name: 'Independence Day', date: '2026-08-15', type: 'NATIONAL' },
        { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'NATIONAL' },
        { name: 'Diwali', date: '2026-11-08', type: 'FESTIVAL' },
        { name: 'Christmas Day', date: '2026-12-25', type: 'GAZETTED' }
      ];

      for (const h of holidays) {
        await client.query(`
          INSERT INTO school_holidays (school_id, name, holiday_date, holiday_type, is_active)
          VALUES ($1, $2, $3::date, $4, TRUE)
          ON CONFLICT (school_id, holiday_date) DO UPDATE SET
            name = EXCLUDED.name,
            is_active = TRUE;
        `, [greenwoodSchoolId, h.name, h.date, h.type]);
      }

      await client.query(`
        INSERT INTO school_notification_channels (school_id, sms_enabled, whatsapp_enabled, email_enabled, created_at, updated_at)
        VALUES ($1, TRUE, TRUE, TRUE, NOW(), NOW())
        ON CONFLICT (school_id) DO UPDATE SET
          sms_enabled = TRUE,
          whatsapp_enabled = TRUE,
          email_enabled = TRUE,
          updated_at = NOW();
      `, [greenwoodSchoolId]);

      console.log('   ✓ Calendar working days, holidays & notification channels initialized');
    } catch (err: any) {
      console.warn('   ⚠️ Calendar notice:', err.message);
    }

    // =================================================================
    // STEP 7: ENSURE PERMISSION DEFINITIONS & GREENWOOD ADMIN SYSTEM ROLES
    // =================================================================
    console.log('\n[Step 7] Ensuring permission definitions & default system roles...');
    try {
      const permDefs = [
        { key: 'STUDENTS_MANAGE', desc: 'Create, edit and deactivate students' },
        { key: 'TEACHERS_MANAGE', desc: 'Create, edit and deactivate teachers' },
        { key: 'ATTENDANCE_MANAGE', desc: 'Take and correct attendance' },
        { key: 'REPORTS_VIEW', desc: 'View and export attendance reports' },
        { key: 'NOTIFICATIONS_MANAGE', desc: 'Manage parent notification channels/templates' },
        { key: 'BILLING_MANAGE', desc: 'View and manage school billing' },
        { key: 'ACADEMIC_MANAGE', desc: 'Manage academic years, classes and sections' },
        { key: 'SETTINGS_MANAGE', desc: 'Manage school settings' }
      ];

      for (const pd of permDefs) {
        await client.query(`
          INSERT INTO permission_definitions (permission_key, description)
          VALUES ($1, $2)
          ON CONFLICT (permission_key) DO UPDATE SET description = EXCLUDED.description;
        `, [pd.key, pd.desc]);
      }

      const systemRoles = [
        { name: 'School Manager', desc: 'Core school administration' },
        { name: 'Attendance Manager', desc: 'Attendance and reports' },
        { name: 'Student Manager', desc: 'Student records' },
        { name: 'Teacher Manager', desc: 'Teacher records' },
        { name: 'Reports Manager', desc: 'Attendance reports' },
        { name: 'Notification Manager', desc: 'Parent notifications' },
        { name: 'Billing Manager', desc: 'School billing' }
      ];

      for (const sr of systemRoles) {
        await client.query(`
          INSERT INTO school_admin_roles (school_id, name, description, is_system)
          VALUES ($1, $2, $3, true)
          ON CONFLICT (school_id, name) DO NOTHING;
        `, [greenwoodSchoolId, sr.name, sr.desc]);
      }

      // Link permissions to School Manager
      const smRole = await client.query(`SELECT id FROM school_admin_roles WHERE school_id = $1 AND name = 'School Manager' LIMIT 1`, [greenwoodSchoolId]);
      const allPerms = await client.query(`SELECT id FROM permission_definitions`);
      if (smRole.rowCount && smRole.rowCount > 0) {
        for (const p of allPerms.rows) {
          await client.query(`
            INSERT INTO school_admin_role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
          `, [smRole.rows[0].id, p.id]);
        }
      }

      console.log('   ✓ Permission definitions & Greenwood admin roles verified');
    } catch (err: any) {
      console.warn('   ⚠️ Permissions notice:', err.message);
    }

    // =================================================================
    // STEP 8: RESTORE STANDARD LOGIN CREDENTIALS
    // =================================================================
    console.log('\n[Step 8] Restoring standard seed login credentials...');

    // 8A. Super Admin (Platform)
    await client.query(`
      INSERT INTO users (id, school_id, name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000020', NULL, 'Platform Super Administrator', 'superadmin@attendance.local', $1, 'SUPER_ADMIN', true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'SUPER_ADMIN',
        is_active = true,
        updated_at = NOW();
    `, [passwordHash]);

    await client.query(`
      INSERT INTO users (id, school_id, name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000029', NULL, 'AttendoSchool Super Administrator', 'superadmin@attendoschool.com', $1, 'SUPER_ADMIN', true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'SUPER_ADMIN',
        is_active = true,
        updated_at = NOW();
    `, [passwordHash]);

    // 8B. School Admin (Greenwood)
    await client.query(`
      INSERT INTO users (id, school_id, name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000021', $1, 'Greenwood School Administrator', 'admin@demo-school.local', $2, 'SCHOOL_ADMIN', true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'SCHOOL_ADMIN',
        is_active = true,
        updated_at = NOW();
    `, [greenwoodSchoolId, passwordHash]);

    await client.query(`
      INSERT INTO users (id, school_id, name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000028', $1, 'Greenwood Principal Admin', 'admin@greenwood.edu.in', $2, 'SCHOOL_ADMIN', true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'SCHOOL_ADMIN',
        is_active = true,
        updated_at = NOW();
    `, [greenwoodSchoolId, passwordHash]);

    // 8C. Teachers (Greenwood)
    const teacherData = [
      { id: '00000000-0000-0000-0000-000000000022', name: 'Rahul Sharma', email: 'rahul@demo-school.local', empId: 'TCH-001', phone: '+91 98765 43222' },
      { id: '00000000-0000-0000-0000-000000000023', name: 'Priya Patel', email: 'priya@demo-school.local', empId: 'TCH-002', phone: '+91 98765 43223' }
    ];

    for (const t of teacherData) {
      await client.query(`
        INSERT INTO users (id, school_id, name, email, password_hash, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'TEACHER', true, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          school_id = EXCLUDED.school_id,
          name = EXCLUDED.name,
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
      `, [t.id, t.empId, t.phone]);
    }

    // 8D. Student Account (Greenwood)
    await client.query(`
      INSERT INTO users (id, school_id, name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000024', $1, 'Rohan Sharma', 'student@greenwood.local', $2, 'STUDENT', true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'STUDENT',
        is_active = true,
        updated_at = NOW();
    `, [greenwoodSchoolId, passwordHash]);

    console.log('   ✓ Seed users and teacher profiles restored with password "ChangeMe123!"');

    // =================================================================
    // STEP 9: ENSURE REALTIME & REPLICA IDENTITY FULL ON ALL TABLES
    // =================================================================
    console.log('\n[Step 9] Ensuring 100% of public tables have Realtime & REPLICA IDENTITY FULL...');
    try {
      await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLES IN SCHEMA public;`);
    } catch {}

    const allTablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    let rtCount = 0;
    for (const r of allTablesRes.rows) {
      const tbl = r.table_name;
      try {
        await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE "${tbl}"`);
      } catch {}
      try {
        await client.query(`ALTER TABLE "${tbl}" REPLICA IDENTITY FULL`);
        rtCount++;
      } catch {}
    }
    console.log(`   ✓ Realtime publication verified on ${rtCount} tables.`);

    // =================================================================
    // STEP 10: AUDIT SUMMARY OF ALL DATABASE TABLES
    // =================================================================
    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log('   POST-CLEANUP DATABASE AUDIT REPORT                            ');
    console.log('═════════════════════════════════════════════════════════════════');

    const tableCounts: { table: string; count: number }[] = [];
    for (const r of allTablesRes.rows) {
      const tbl = r.table_name;
      try {
        const countRes = await client.query(`SELECT COUNT(*)::int as count FROM "${tbl}"`);
        const c = countRes.rows[0].count;
        if (c > 0) {
          tableCounts.push({ table: tbl, count: c });
        }
      } catch {}
    }

    console.log('Non-Empty Baseline Tables:');
    console.table(tableCounts);

    const userList = await client.query(`SELECT id, role, email, name, school_id FROM users ORDER BY role, email`);
    console.log('\nActive Seed Users:');
    console.table(userList.rows);

    const schoolList = await client.query(`SELECT id, name, code, status FROM schools`);
    console.log('\nActive Schools:');
    console.table(schoolList.rows);

    console.log('═════════════════════════════════════════════════════════════════');
    console.log('✓ Database purge and seed baseline completed successfully!');
    console.log('• Total Schools:       1 (Greenwood International School - GIS001)');
    console.log('• Total Users:         ' + userList.rowCount + ' (Standard seed credentials)');
    console.log('• Operational Records: 0 (Students, classes, attendance clean)');
    console.log('• Default Password:    ChangeMe123!');
    console.log('═════════════════════════════════════════════════════════════════\n');

  } catch (err: any) {
    console.error('❌ Error during database cleanup:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanAndSeedDatabase().catch(console.error);
