import { pool } from '../db';

async function inspectAll() {
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`Total public tables: ${tables.rows.length}`);
  
  for (const row of tables.rows) {
    const t = row.table_name;
    try {
      const countRes = await pool.query(`SELECT COUNT(*)::int as count FROM "${t}"`);
      if (countRes.rows[0].count > 0) {
        console.log(`- ${t}: ${countRes.rows[0].count} rows`);
      }
    } catch (e: any) {
      console.log(`- ${t}: ERROR reading count: ${e.message}`);
    }
  }

  await pool.end();
}

inspectAll().catch(console.error);
