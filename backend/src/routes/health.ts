import { Router } from 'express';
import { checkFirestoreHealth } from '../firebase';

const r = Router();

r.get('/', async (_req, res) => {
  const fsHealth = await checkFirestoreHealth();
  const isHealthy = fsHealth.ok;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'error',
    database: {
      firestore: fsHealth.ok ? 'connected' : 'unavailable',
      mode: 'cloud_firestore'
    },
    version: 'production',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export default r;
