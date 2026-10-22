const { pool } = require('../backend/dist/db');

async function inspect() {
  try {
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('=== TABLES IN SUPABASE POSTGRESQL ===');
    for (const row of tables.rows) {
      try {
        const countRes = await pool.query(`SELECT count(*) FROM "${row.table_name}"`);
        console.log(`  - ${row.table_name}: ${countRes.rows[0].count} rows`);
      } catch (err) {
        console.log(`  - ${row.table_name}: error reading count (${err.message})`);
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

inspect();
