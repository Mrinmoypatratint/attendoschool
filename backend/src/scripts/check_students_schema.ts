import { pool } from '../db';

async function check() {
  const r = await pool.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'students' ORDER BY ordinal_position"
  );
  console.log('STUDENTS TABLE COLUMNS:');
  r.rows.forEach(c => console.log(`  ${c.column_name.padEnd(25)} | ${c.data_type.padEnd(20)} | null: ${c.is_nullable.padEnd(3)} | def: ${c.column_default || 'none'}`));
  await pool.end();
}

check().catch(console.error);
