import { pool } from '../db';

async function check() {
  const sess = await pool.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'attendance_sessions' ORDER BY ordinal_position");
  console.log('attendance_sessions:');
  console.table(sess.rows);

  const rec = await pool.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'attendance_records' ORDER BY ordinal_position");
  console.log('attendance_records:');
  console.table(rec.rows);

  const con = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid) as def, t.relname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname IN ('attendance_sessions', 'attendance_records')
  `);
  console.log('constraints:');
  console.table(con.rows);

  await pool.end();
}

check().catch(console.error);
