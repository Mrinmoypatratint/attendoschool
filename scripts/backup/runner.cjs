'use strict';
const path = require('node:path');
const { ROOT, BackupManager, log } = require('./core.cjs');
// dotenv is already an application dependency. Only entrypoints load it, never tests/core.
const dotenv = require(path.join(ROOT, 'backend/node_modules/dotenv'));
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
  dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });
}
process.umask(0o077);
async function main() {
  const manager = new BackupManager();
  const mode = process.argv[2];
  if (mode === 'daily') {
    if (!process.env.BACKUP_AGE_RECIPIENT) throw Error('Daily backups require BACKUP_AGE_RECIPIENT');
    const row = await manager.enqueue({ id: 'cron', name: 'Nightly cron' }, true);
    log(`Queued daily encrypted backup ${row.id}`);
    // Dedicated worker processes the queue. Cron waits for success before reporting it.
    for (;;) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const rows = await manager.list(); const current = rows.find(r => r.id === row.id);
      if (!current) throw Error('Daily backup status disappeared');
      if (current.status === 'failed') throw Error(current.error);
      if (current.status === 'ready') { log(`Daily backup ready: ${current.id}`); return; }
    }
  } else if (mode === 'job') {
    const row = await manager.read(process.argv[3]);
    const result = await manager.run(row); if (result.status === 'failed') throw Error(result.error);
  } else throw Error('Usage: runner.cjs daily | job BACKUP_ID');
}
if (require.main === module) main().catch(e => { log(`ERROR: ${e.message}`); process.exitCode = 1; });
module.exports = { main };
