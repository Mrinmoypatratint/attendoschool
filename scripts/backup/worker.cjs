'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ROOT, BackupManager, atomic, json, log, databaseEnv } = require('./core.cjs');
const dotenv = require(path.join(ROOT, 'backend/node_modules/dotenv'));
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
  dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });
}
process.umask(0o077);
async function mirrorCompletion(manager, row) {
  if (manager.env.NODE_ENV === 'test') return;
  const { Client } = require(path.join(ROOT, 'backend/node_modules/pg'));
  const pg = databaseEnv(manager.env);
  const client = new Client({ host: pg.PGHOST, port: Number(pg.PGPORT), database: pg.PGDATABASE, user: pg.PGUSER, password: pg.PGPASSWORD, connectionTimeoutMillis: 5000, statement_timeout: 5000,
    ssl: pg.PGSSLMODE === 'disable' || !pg.PGSSLMODE ? false : { rejectUnauthorized: true } });
  try {
    await client.connect();
    const actor = row.requestedBy?.id;
    await client.query(`INSERT INTO audit_logs(id,user_id,action,entity_type,metadata,created_at) VALUES(gen_random_uuid(),$1,$2,'BACKUP',$3,NOW())`, [
      /^[a-f0-9-]{36}$/i.test(actor || '') ? actor : null,
      row.status === 'ready' ? 'BACKUP_READY' : 'BACKUP_FAILED',
      JSON.stringify({ backupId: row.id, size: row.size || 0, encrypted: row.encrypted, requestedBy: row.requestedBy, error: row.error })
    ]);
  } catch { log('WARNING: database audit mirror unavailable; durable backup audit.jsonl contains the event'); }
  finally { await client.end().catch(() => {}); }
}
async function workOne(manager, row) {
  // The worker has its own queue and child process; never runs on the notification queue.
  const child = spawn(process.execPath, [path.join(__dirname, 'runner.cjs'), 'job', row.id], { env: manager.env, detached: process.platform !== 'win32', stdio: 'inherit' });
  const killGroup = () => { try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL'); } catch {} };
  const timer = setTimeout(killGroup, Math.min(manager.staleMs - 1000, 3 * 3600000));
  const stop = () => { killGroup(); process.exit(1); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  const code = await new Promise(resolve => { child.once('error', () => resolve(1)); child.once('close', resolve); });
  clearTimeout(timer); process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
  const current = await manager.read(row.id);
  if (current.status !== 'ready' && current.status !== 'failed') {
    current.status = 'failed'; current.error = 'Worker stopped or exceeded time limit; retry';
    await atomic(path.join(manager.dir, `${row.id}.json`), current); await manager.audit('BACKUP_FAILED', current);
  }
  await mirrorCompletion(manager, current);
  // The child and all of its tools have exited, so no other backup can still be writing.
  await manager.release(row.id);
  for (const name of await fs.readdir(manager.dir)) if (name.startsWith('.work-')) await fs.rm(path.join(manager.dir, name), { recursive: true, force: true });
  if (code) log(`Backup ${row.id} failed; see its status record`);
}
async function main() {
  const manager = new BackupManager(); await manager.init();
  // OS flock below guarantees exactly one worker, including across PM2 reloads/containers.
  for (;;) {
    try {
      const rows = await manager.list(); const row = rows.find(r => r.status === 'queued');
      if (row) await workOne(manager, row);
      await manager.cleanup();
    } catch (e) { log(`ERROR: ${e.message}`); }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
if (require.main === module) main().catch(e => { log(`ERROR: ${e.message}`); process.exitCode = 1; });
module.exports = { workOne, main };
