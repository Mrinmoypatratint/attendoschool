import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PoolClient } from 'pg';
import { pool, isPostgresConfigured } from '../db';

interface MigrationRecord {
  filename: string;
  checksum: string;
  applied_at: Date;
  execution_time_ms: number;
}

function computeChecksum(content: string): string {
  // Normalize CRLF to LF to avoid cross-platform hash differences
  const normalized = content.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Checks whether an established database already contains the schema artifacts
 * of a given migration. This allows safe adoption/baselining of historical migrations
 * without destructive re-execution.
 */
async function checkMigrationSignature(client: PoolClient, filename: string): Promise<boolean> {
  try {
    switch (filename) {
      case '047_daily_class_teacher_attendance.sql': {
        const res = await client.query(
          "SELECT 1 FROM pg_constraint WHERE conname = 'uq_attendance_sessions_daily'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '046_temporary_class_assignments.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'temporary_class_assignments'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '045_add_name_parts_to_teacher_profiles.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'teacher_profiles' AND column_name = 'first_name'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '044_add_middle_name_to_students.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'middle_name'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '043_add_date_of_birth_and_joining_date_to_teacher_profiles.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'teacher_profiles' AND column_name = 'date_of_birth'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '042_assignment_teacher_documents.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_assignments' AND column_name = 'document_url'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '042_add_website_to_schools.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'website'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '041_student_assignment_attachments.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_assignment_attachments'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '040_notification_log_identity_snapshots.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_logs' AND column_name = 'admission_number'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '040_class_mentors_and_assignment_permissions.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_mentors'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '039_platform_settings_and_mail_toggle.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_settings'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '038_auth_login_indexes.sql': {
        const res = await client.query(
          "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_email_lower'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '037_performance_indexes.sql': {
        const res = await client.query(
          "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_attendance_sessions_school_date'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '036_school_admin_photo.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'admin_photo_url'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '035_add_gender_to_teacher_profiles.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'teacher_profiles' AND column_name = 'gender'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '034_notification_replies.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_replies'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '033_reattendance_and_cross_teacher_visibility.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_audit_logs'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '032_email_notifications_hardening.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_logs' AND column_name = 'max_attempts'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '031_fix_attendance_schema.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attendance_records' AND column_name = 'roll_number'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '030_admission_number_indexing.sql': {
        const res = await client.query(
          "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_students_admission_number'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '029_student_role_and_portal.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_assignments'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '028_final_integrated.sql':
      case '027_final_integration.sql':
      case '026_production.sql':
      case '025_communication.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '024_advanced_analytics.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analytics_daily_snapshots'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '023_offline_attendance.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_sync_batches'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '022_advanced_timetable.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timetable_periods'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '021_backup_disaster_recovery.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'backup_jobs'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '020_security_hardening.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_events'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '019_subscription_enforcement.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_events'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '018_permissions.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '017_parent_portal.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parent_student_mappings'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '016_student_promotion.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_promotions'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '015_academic_years.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_years'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '014_people_management.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'admission_number'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '013_attendance_corrections.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_correction_requests'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '012_attendance_reporting.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'attendance_monthly_summary_v12'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '011_notifications.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '010_invoice_email.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscription_invoices' AND column_name = 'email_status'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '009_gst_reconciliation.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'gst_rate'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '008_school_billing.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'initiated_by_user_id'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      case '007_payment_invoices.sql': {
        const res = await client.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_invoices'"
        );
        return (res.rowCount ?? 0) > 0;
      }
      default:
        return false;
    }
  } catch (err) {
    return false;
  }
}

async function runMigrations() {
  console.log('Starting automated database migration for AttendoSchool...');

  if (!isPostgresConfigured) {
    console.error('ERROR: PostgreSQL / Supabase connection is not configured or uses placeholder credentials.');
    console.error('Please configure SUPABASE_DATABASE_URL or DATABASE_URL before running migrations.');
    process.exit(1);
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    const candidates = [
      path.resolve(__dirname, '../../../database'),
      path.resolve(__dirname, '../../database'),
      path.resolve(process.cwd(), '../database'),
      path.resolve(process.cwd(), 'database'),
    ];
    const dbDir = candidates.find((dir) => fs.existsSync(dir));
    if (!dbDir) {
      throw new Error(`Database directory not found in candidate paths: ${candidates.join(', ')}`);
    }
    console.log(`Using database directory: ${dbDir}`);

    // Ensure schema_migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Fetch all previously applied migrations
    const appliedRes = await client.query<MigrationRecord>(
      'SELECT filename, checksum, applied_at, execution_time_ms FROM schema_migrations'
    );
    const appliedMap = new Map<string, MigrationRecord>();
    for (const row of appliedRes.rows) {
      appliedMap.set(row.filename, row);
    }
    console.log(`Tracking table schema_migrations loaded with ${appliedMap.size} recorded migrations.`);

    // Check if base schema already exists (established database check)
    const tableCheck = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schools'"
    );
    const hasBaseSchema = (tableCheck.rowCount ?? 0) > 0;

    if (!hasBaseSchema) {
      const schemaFile = path.join(dbDir, 'schema.sql');
      if (fs.existsSync(schemaFile)) {
        const schemaSql = fs.readFileSync(schemaFile, 'utf8').trim();
        if (schemaSql && !schemaSql.startsWith('--')) {
          console.log('Applying base schema.sql...');
          await client.query(schemaSql);
          console.log('Base schema.sql applied successfully.');
        }
      }
    } else {
      console.log('Established database detected (schools table exists). Checking incremental migrations...');
    }

    const migrationsDir = path.join(dbDir, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log(`No migrations directory found at ${migrationsDir}`);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration scripts in ${migrationsDir}`);

    let appliedCount = 0;
    let adoptedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const rawSql = fs.readFileSync(filePath, 'utf8');
      const checksum = computeChecksum(rawSql);

      // Check if already recorded in schema_migrations
      const recorded = appliedMap.get(file);
      if (recorded) {
        if (recorded.checksum !== checksum) {
          throw new Error(
            `Migration checksum mismatch for ${file}!\n` +
            `  Recorded in DB: ${recorded.checksum}\n` +
            `  Computed on disk: ${checksum}\n` +
            `Applied migrations must not be modified.`
          );
        }
        skippedCount++;
        continue;
      }

      // If the database is established, check if this migration's objects already exist (Baseline Adoption)
      if (hasBaseSchema) {
        const signatureFound = await checkMigrationSignature(client, file);
        if (signatureFound) {
          // Special safeguard for 047: Never re-run duplicate deletion statements if constraint exists
          if (file === '047_daily_class_teacher_attendance.sql') {
            console.log(`  [Adopted] ${file} (Daily attendance unique constraint uq_attendance_sessions_daily already present; skipping SQL to protect data)`);
          } else {
            console.log(`  [Adopted] ${file} (Schema objects already present; baseline adopted into tracking table)`);
          }

          await client.query(
            `INSERT INTO schema_migrations (filename, checksum, applied_at, execution_time_ms)
             VALUES ($1, $2, NOW(), 0)
             ON CONFLICT (filename) DO NOTHING`,
            [file, checksum]
          );
          adoptedCount++;
          continue;
        }
      }

      // If migration 047 is not yet adopted, double check constraint uq_attendance_sessions_daily specifically
      if (file === '047_daily_class_teacher_attendance.sql') {
        const uqCheck = await client.query(
          "SELECT 1 FROM pg_constraint WHERE conname = 'uq_attendance_sessions_daily'"
        );
        if ((uqCheck.rowCount ?? 0) > 0) {
          console.log(`  [Adopted] ${file} (uq_attendance_sessions_daily constraint detected; safely recording without re-running SQL)`);
          await client.query(
            `INSERT INTO schema_migrations (filename, checksum, applied_at, execution_time_ms)
             VALUES ($1, $2, NOW(), 0)
             ON CONFLICT (filename) DO NOTHING`,
            [file, checksum]
          );
          adoptedCount++;
          continue;
        }
      }

      // Migration must be executed in an individual transaction
      console.log(`  [Applying] ${file}...`);
      const startTime = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(rawSql);
        const executionTimeMs = Date.now() - startTime;
        await client.query(
          `INSERT INTO schema_migrations (filename, checksum, applied_at, execution_time_ms)
           VALUES ($1, $2, NOW(), $3)`,
          [file, checksum, executionTimeMs]
        );
        await client.query('COMMIT');
        console.log(`  [Applied] ${file} (${executionTimeMs}ms)`);
        appliedCount++;
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`ERROR: Failed executing migration ${file} inside transaction:`, err.message);
        throw err;
      }
    }

    console.log(
      `Migration summary: ${appliedCount} applied, ${adoptedCount} adopted, ${skippedCount} previously recorded.`
    );

    // Seed is decoupled and only executed if explicitly requested via --seed flag
    const shouldSeed = process.argv.includes('--seed');
    if (shouldSeed) {
      const seedFile = path.join(dbDir, 'seed.sql');
      if (fs.existsSync(seedFile)) {
        console.log('Applying seed.sql (--seed flag provided)...');
        const seedSql = fs.readFileSync(seedFile, 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(seedSql);
          await client.query('COMMIT');
          console.log('seed.sql applied successfully.');
        } catch (seedErr: any) {
          await client.query('ROLLBACK');
          console.error('Failed executing seed.sql:', seedErr.message);
          throw seedErr;
        }
      }
    }

    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Migration execution halted due to error:', error);
    process.exitCode = 1;
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runMigrations().catch(() => {
  process.exit(1);
});
