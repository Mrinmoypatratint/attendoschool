import { pool } from '../db';

async function dumpSchema() {
  const tables = [
    'schools',
    'users',
    'students',
    'classes',
    'sections',
    'academic_years',
    'attendance_sessions',
    'attendance_records',
    'timetable_periods',
    'timetable_entries',
    'payments'
  ];

  for (const t of tables) {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [t]);

    console.log(`\n=================== TABLE: ${t} (${cols.rowCount} columns) ===================`);
    cols.rows.forEach(c => {
      console.log(`  ${c.column_name.padEnd(28)} | ${c.data_type.padEnd(20)} | null: ${c.is_nullable.padEnd(3)} | def: ${c.column_default || 'none'}`);
    });
  }

  await pool.end();
}

dumpSchema().catch(console.error);
