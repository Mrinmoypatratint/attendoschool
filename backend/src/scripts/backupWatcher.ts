import 'dotenv/config';
import { checkFirestoreHealth } from '../firebase';
import { exec } from 'child_process';
import * as path from 'path';

/**
 * Backup Watcher:
 * Continuously polls Firebase with lightweight single-document ping every 5 minutes.
 * The exact second the daily quota resets (at 00:00 Pacific Time), it automatically
 * triggers the full exportFullBackup.ts script to download and archive all data!
 */
async function watchAndBackup() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('   ATTENDOSCHOOL — AUTOMATIC QUOTA-RESET BACKUP WATCHER          ');
  console.log('═════════════════════════════════════════════════════════════════\n');
  console.log('⏳ Polling Firebase until daily read quota resets...');
  console.log('   Once the quota resets, full backup will execute automatically.\n');

  const pollInterval = 5 * 60 * 1000; // 5 minutes

  async function check() {
    const health = await checkFirestoreHealth();
    const timeStr = new Date().toLocaleTimeString();

    if (health.ok) {
      console.log(`[${timeStr}] ✅ Quota is active! Initiating full export now...`);
      const scriptPath = path.resolve(__dirname, 'exportFullBackup.ts');
      exec(`npx ts-node "${scriptPath}"`, (err, stdout, stderr) => {
        if (err) {
          console.error('❌ Export failed:', err.message);
          return;
        }
        console.log(stdout);
        console.log('🎉 Full backup completed successfully! Exiting watcher.');
        process.exit(0);
      });
    } else {
      console.log(`[${timeStr}] ⏸️ Quota still throttled (RESOURCE_EXHAUSTED). Next check in 5 minutes...`);
      setTimeout(check, pollInterval);
    }
  }

  check();
}

watchAndBackup();
