'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('../core.cjs');
async function fake(tool, args, env) {
  if (['psql', 'pg_dump', 'pg_restore'].includes(tool)) {
    if (args.some(a => a.includes('fixture-db-password'))) throw Error('Password leaked into argv');
    if (env.BACKUP_TEST_ARGV) await fs.appendFile(env.BACKUP_TEST_ARGV, JSON.stringify({ tool, args }) + '\n');
    if (env.BACKUP_TEST_DUMP_FAIL === 'true') throw Error('Synthetic database tool failure');
    if (tool === 'psql') return args.includes('SHOW server_version_num') ? '160005\n' : '1000\n';
    if (tool === 'pg_restore') return '1; 1259 1 TABLE public students\n';
    if (args.includes('--version')) return `pg_dump (PostgreSQL) ${env.BACKUP_TEST_CLIENT_MAJOR || '16'}.5\n`;
    const file = args[args.indexOf('--file') + 1];
    await fs.writeFile(file, env.BACKUP_TEST_INVALID_DUMP ? 'invalid' : Buffer.concat([Buffer.from('PGDMP'), Buffer.alloc(2048, 42)])); return '';
  }
  if (tool !== 'gh') return core.command(tool, args, env);
  const dir = env.BACKUP_TEST_RELEASES; if (!dir) throw Error('Fake GitHub requires private fixture folder');
  await fs.mkdir(dir, { recursive: true });
  if (args[0] === 'api') {
    if (args.includes('--paginate')) return (await fs.readdir(dir)).filter(n => n.startsWith('backup-')).join('\n');
    if (args.includes('PATCH')) return '{}';
    if (args.some(a => a.includes('/releases/tags/'))) return '{"id":1}';
    return JSON.stringify({ private: env.BACKUP_TEST_PUBLIC !== 'true' });
  }
  const op = args[1];
  if (op === 'create') { await fs.mkdir(path.join(dir, args[2])); return ''; }
  if (op === 'upload') { const data = await fs.readFile(args[3]); if (!args[3].includes('.age')) throw Error('Plaintext upload'); await fs.writeFile(path.join(dir, args[2], path.basename(args[3])), data); return ''; }
  if (op === 'delete') { await fs.rm(path.join(dir, args[2]), { recursive: true }); return ''; }
  if (op === 'download') {
    const tag = args[2] && !args[2].startsWith('--') ? args[2] : (await fs.readdir(dir)).filter(n => n.startsWith('backup-')).sort().at(-1);
    const dest = args[args.indexOf('--dir') + 1];
    for (const name of await fs.readdir(path.join(dir, tag))) await fs.copyFile(path.join(dir, tag, name), path.join(dest, name)); return '';
  }
  throw Error(`Unexpected fake gh operation ${op}`);
}
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'attendo-backup-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'test', DB_DRIVER: 'postgres', DB_PASSWORD: 'fixture-db-password', BACKUP_FIREBASE_CONFIRMED_UNUSED: 'true', BACKUP_DIR: path.join(dir, 'private'), BACKUP_STORAGE_DISABLED: 'true', BACKUP_UPLOAD_MAX_BYTES: '65536', BACKUP_MIN_FREE_BYTES: '1', BACKUP_TEST_RELEASES: path.join(dir, 'releases'), BACKUP_GITHUB_REPO: 'fixture/private-backups', BACKUP_GH_TOKEN: 'fixture-token', JWT_SECRET: 'known-secret-marker-98f2', BACKUP_SPLIT_BYTES: '1024' };
  // Node ignores undefined env entries, unlike JSON fixtures.
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  return { dir, env, manager: new core.BackupManager(env, fake) };
}
if (require.main === module) {
  const tool = path.basename(process.argv[2]); fake(tool, process.argv.slice(3), process.env).then(out => process.stdout.write(out || '')).catch(e => { console.error(e.message); process.exitCode = 1; });
}
module.exports = { fake, fixture };
