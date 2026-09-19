import { Router } from 'express';
import { checkFirestoreHealth } from '../firebase';

const r = Router();

r.get('/', async (_req, res) => {
  let fsOk = false;
  try {
    const fsHealth = await checkFirestoreHealth();
    fsOk = fsHealth.ok;
  } catch {}

  res.status(200).json({
    status: 'ok',
    database: {
      firestore: fsOk ? 'connected' : 'connecting',
      projectId: 'attendoschool',
      mode: 'cloud_firestore'
    },
    version: 'production',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export default r;
