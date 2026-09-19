import app from './app';
import { env } from './config/env';
import { pool } from './db';
import { rehydrateAllFromFirestore } from './services/firestoreSync';
import {
  demoClasses,
  demoSections,
  demoStudents,
  demoTeachers,
  demoTeacherAssignments,
  demoSubjects
} from './routes/schoolData';
import { memPeriods, memEntries } from './routes/timetable';
import { demoSchools } from './routes/superAdmin';
import { startKeepAliveService } from './services/keepAliveService';

const server = app.listen(env.port, () => {
  console.log(`School Attendance API running on http://localhost:${env.port}`);

  // Rehydrate data from Firebase Cloud Firestore into backend stores
  rehydrateAllFromFirestore({
    demoStudents,
    demoTeachers,
    demoClasses,
    demoSections,
    demoSubjects,
    demoTeacherAssignments,
    memPeriods,
    memEntries,
    demoSchools
  }).then(res => {
    console.log('[Server] Initial Firestore rehydration complete:', res.loaded);
  }).catch(err => {
    console.warn('[Server] Firestore rehydration encountered error:', err.message);
  });

  // Keep-alive auto-pinger (prevents cloud container idle hibernation)
  startKeepAliveService(env.keepAliveUrl, 10);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, starting graceful shutdown...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log('Database pool connections closed.');
    } catch (err) {
      console.error('Error closing database pool:', err);
    }
    console.log('Process gracefully terminated.');
    process.exit(0);
  });

  // Force close after 10s if connections linger
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
