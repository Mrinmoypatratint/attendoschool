import { pool } from '../db';

async function check() {
  const r = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid IN ('classes'::regclass, 'sections'::regclass, 'students'::regclass)
  `);
  console.log('CONSTRAINTS:');
  r.rows.forEach(c => console.log(`  ${c.conname} (${c.contype}): ${c.pg_get_constraintdef}`));
  await pool.end();
}

check().catch(console.error);
