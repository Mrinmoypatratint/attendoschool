import { Router } from 'express';
import { pool } from '../db';
import { checkFirestoreHealth } from '../firebase';
const r=Router();
r.get('/',async(_req,res)=>{
  let pgOk = false;
  try { await pool.query('SELECT 1'); pgOk = true; } catch {}
  const fsHealth = await checkFirestoreHealth();

  const isHealthy = pgOk || fsHealth.ok;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'error',
    database: {
      postgres: pgOk ? 'connected' : 'unavailable',
      firestore: fsHealth.ok ? 'connected' : 'unavailable'
    },
    version: 'production',
    uptime: process.uptime()
  });
});
export default r;
