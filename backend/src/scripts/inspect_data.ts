import { pool } from '../db';

async function inspectData() {
  const sc = await pool.query('SELECT * FROM schools');
  console.log('Schools in Supabase:');
  console.table(sc.rows);

  const u = await pool.query('SELECT id, school_id, name, email, role, is_active FROM users');
  console.log('Users in Supabase:');
  console.table(u.rows);

  const sub = await pool.query('SELECT * FROM subjects');
  console.log('Subjects in Supabase:');
  console.table(sub.rows);

  await pool.end();
}

inspectData().catch(console.error);
