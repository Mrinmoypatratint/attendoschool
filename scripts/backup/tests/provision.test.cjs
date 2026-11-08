const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fixture } = require('./fake-tools.cjs');
const { inspect, prepare, cronText, setEnv, monitor } = require('../provision.cjs');
const { atomic } = require('../core.cjs');
const parse = require('../../../backend/node_modules/dotenv').parse;
test('inspection emits metadata without secrets and uses read-only SQL', async t => {
  const { env, dir } = await fixture(t), queries = [];
  env.DATABASE_URL = 'postgresql://fixture:private-password@localhost/example';
  const report = await inspect(env, dir, () => ({ connect: async () => {}, end: async () => {}, query: async sql => { queries.push(sql); return { rows: [sql.startsWith('SHOW') ? { server_version_num: '180001' } : { present: true }] }; } }));
  assert.equal(report.postgresMajor, 18); assert.equal(report.databaseAttachmentTablePresent, true);
  assert.ok(queries.every(sql => /^(SHOW|SELECT) /.test(sql)));
  assert.ok(!JSON.stringify(report).includes('private-password') && !JSON.stringify(report).includes(env.JWT_SECRET));
});
test('prepare creates private paused configuration, preserves app settings, and creates no identity', async t => {
  const { dir } = await fixture(t); const root = path.join(dir, 'app'), base = path.join(dir, 'owner');
  await fs.mkdir(path.join(root, 'backend'), { recursive: true }); await fs.writeFile(path.join(root, 'backend/.env'), 'JWT_SECRET="original-value"\nDB_DRIVER=postgres\n');
  const result = await prepare({ root, base, env: { NODE_ENV: 'test', DB_DRIVER: 'postgres' }, parse });
  assert.equal(result.report.publicRecipientConfigured, false); assert.equal(result.report.privateKeyCreatedOnServer, false);
  assert.ok(result.config.startsWith(path.join(base, '.attendoschool-backup-state')));
  assert.match(result.report.state, /paused/); assert.match(await fs.readFile(path.join(root, 'backend/.env'), 'utf8'), /original-value/);
  assert.equal(parse(await fs.readFile(result.config)).BACKUP_GH_TOKEN, '');
  const saved = await fs.readFile(result.config, 'utf8'); await fs.writeFile(result.config, saved.replace("BACKUP_AGE_RECIPIENT=''", "BACKUP_AGE_RECIPIENT='public-recipient-only'"));
  await fs.chmod(result.config, 0o600);
  const repeated = await prepare({ root, base, env: { NODE_ENV: 'test', DB_DRIVER: 'postgres' }, parse });
  assert.equal(repeated.report.publicRecipientConfigured, true); assert.match(await fs.readFile(path.join(root, 'backend/.env'), 'utf8'), /public-recipient-only/);
  assert.ok(!(await fs.readdir(path.dirname(result.config))).some(n => /agekey|identity|private.key/.test(n)));
  const supplied = await prepare({ root, base, env: { NODE_ENV: 'test', DB_DRIVER: 'postgres', BACKUP_GH_TOKEN: 'fixture-scoped-repo-token' }, parse });
  assert.equal(supplied.report.scopedTokenConfigured, true);
  assert.ok(!JSON.stringify(supplied.report).includes('fixture-scoped-repo-token'));
  await prepare({ root, base, env: { NODE_ENV: 'test', DB_DRIVER: 'postgres', BACKUP_GH_TOKEN: '' }, parse });
  assert.equal(parse(await fs.readFile(result.config)).BACKUP_GH_TOKEN, 'fixture-scoped-repo-token');
});
test('managed cron update preserves other jobs and is idempotent', () => {
  const first = cronText('0 1 * * * unrelated-task\n', '/app', '/private/config', '/private/state');
  assert.match(first, /unrelated-task/); assert.match(first, /scheduled.sh/);
  assert.equal(cronText(first, '/app', '/private/config', '/private/state'), first);
  assert.equal(setEnv('JWT_SECRET="keep"\nBACKUP_DIR=old\n', 'BACKUP_DIR', '/new'), 'JWT_SECRET="keep"\nBACKUP_DIR="/new"\n');
});
test('default state stays under the writable backend directory and out of user home', async t => {
  const { dir } = await fixture(t), root = path.join(dir, 'checkout');
  await fs.mkdir(path.join(root, 'backend'), { recursive: true });
  await fs.writeFile(path.join(root, 'backend/.env'), 'DB_DRIVER=postgres\n');
  const prepared = await prepare({ root, env: { NODE_ENV: 'test', DB_DRIVER: 'postgres' }, parse });
  assert.equal(prepared.state, path.join(root, 'backend/.backup-state'));
  assert.equal(prepared.config, path.join(prepared.state, 'backup.env'));
});
test('monitor distinguishes paused, healthy, expired and incomplete uploaded backups', async t => {
  const { env } = await fixture(t); assert.equal((await monitor(env)).state, 'paused');
  env.BACKUP_AGE_RECIPIENT = 'public'; await fs.mkdir(env.BACKUP_DIR);
  assert.equal((await monitor(env)).state, 'failed');
  const row = { at: new Date().toISOString(), encrypted: true, warnings: [] };
  await atomic(path.join(env.BACKUP_DIR, 'last-published.json'), row); assert.equal((await monitor(env)).state, 'healthy');
  await atomic(path.join(env.BACKUP_DIR, 'last-published.json'), { ...row, at: '2020-01-01T00:00:00Z' }); assert.equal((await monitor(env)).state, 'failed');
  await atomic(path.join(env.BACKUP_DIR, 'last-published.json'), { ...row, warnings: ['Uploads skipped'] }); assert.equal((await monitor(env)).state, 'failed');
});
