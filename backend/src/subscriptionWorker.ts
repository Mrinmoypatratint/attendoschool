
import { pool } from './db';

async function run(){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const expired=await client.query(`UPDATE school_subscriptions
      SET status='EXPIRED'
      WHERE status='ACTIVE' AND end_date<CURRENT_DATE
      RETURNING school_id`);
    await client.query(`UPDATE schools s SET status='EXPIRED'
      WHERE s.status='ACTIVE'
      AND NOT EXISTS (SELECT 1 FROM school_subscriptions ss
        WHERE ss.school_id=s.id AND ss.status='ACTIVE' AND ss.end_date>=CURRENT_DATE)`);
    await client.query('COMMIT');
    console.log(`[subscription-worker] expired ${expired.rowCount} subscriptions`);
  }catch(e){await client.query('ROLLBACK');console.error(e)}
  finally{client.release();await pool.end()}
}
run();
