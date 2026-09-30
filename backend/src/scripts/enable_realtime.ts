import { pool } from '../db';

/**
 * Script to enable Supabase Realtime for core AttendoSchool tables
 */
async function enableRealtime() {
  const targetTables = [
    'schools',
    'students',
    'attendance_records',
    'attendance_sessions',
    'academic_years',
    'classes',
    'sections',
    'announcements',
    'payments',
    'school_subscriptions',
    'teacher_profiles',
    'audit_logs'
  ];

  console.log('Enabling Supabase Realtime on key tables...\n');

  for (const table of targetTables) {
    try {
      // 1. Add table to supabase_realtime publication
      await pool.query(`ALTER PUBLICATION supabase_realtime ADD TABLE "${table}"`);
      // 2. Set replica identity full so UPDATE / DELETE events contain the full row data
      await pool.query(`ALTER TABLE "${table}" REPLICA IDENTITY FULL`);
      console.log(`✓ Realtime enabled for: ${table}`);
    } catch (err: any) {
      if (err.message.includes('already in publication')) {
        console.log(`ℹ Already in publication: ${table}`);
      } else {
        console.warn(`⚠ Could not enable realtime on "${table}": ${err.message}`);
      }
    }
  }

  // Verify
  const pubTables = await pool.query(
    `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename`
  );
  console.log('\n========================================');
  console.log(`Realtime is now ACTIVE for ${pubTables.rowCount} tables:`);
  pubTables.rows.forEach(r => console.log(`  • ${r.tablename}`));
  console.log('========================================\n');

  await pool.end();
}

enableRealtime().catch(console.error);
