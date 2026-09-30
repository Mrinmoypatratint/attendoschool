import { pool } from '../db';

async function checkRealtime() {
  try {
    const pubRes = await pool.query(`SELECT pubname FROM pg_publication`);
    console.log('Existing publications:', pubRes.rows.map(r => r.pubname));

    const pubTables = await pool.query(
      `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`
    );
    console.log('Tables currently in supabase_realtime:', pubTables.rows.map(r => r.tablename));
  } catch (err: any) {
    console.error('Error checking realtime:', err.message);
  } finally {
    await pool.end();
  }
}

checkRealtime();
