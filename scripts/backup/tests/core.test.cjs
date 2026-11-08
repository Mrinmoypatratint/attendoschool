'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const core = require('../core.cjs');
const { restore, extractVerified } = require('../restore.cjs');
const { fake, fixture } = require('./fake-tools.cjs');
const id = 'attendoschool-backup-20261108-020000-1234abcd';
test('restored environment round-trips quotes, multiline values and backslashes safely', async t => {
  const { env, dir } = await fixture(t);
  env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ private_key: 'test\\key\nsecond line', project: 'fixture' });
  env.SMTP_PASS = `quotes ' and " and backticks \``;
  const file = path.join(dir, 'runtime.env'); await core.writeEnvironment(file, env);
  const { readEnvironment } = require('../load-env.cjs'); const parsed = await readEnvironment(file);
  assert.equal(parsed.FIREBASE_SERVICE_ACCOUNT, env.FIREBASE_SERVICE_ACCOUNT); assert.equal(parsed.SMTP_PASS, env.SMTP_PASS);
  const output = await core.command(process.execPath, [path.join(__dirname, '../load-env.cjs'), file, process.execPath, '-e', 'process.stdout.write(process.env.SMTP_PASS)'], env);
  assert.equal(output, env.SMTP_PASS);
  await fs.writeFile(file, 'GH_TOKEN="forbidden"'); await assert.rejects(readEnvironment(file), /Invalid/);
});
test('only SUPER_ADMIN is allowed, regardless of every permission granted', () => {
  for (const role of ['SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', undefined]) assert.throws(() => core.requireOwner({ role, permissions: ['*'], isOwner: true }), e => e.status === 403);
  core.requireOwner({ role: 'SUPER_ADMIN' });
});
test('password and URL credentials stay out of dump argv', () => {
  const e = core.databaseEnv({ BACKUP_DATABASE_URL: 'postgresql://user:fixture-db-password@localhost:5432/demo?sslmode=disable' });
  assert.equal(e.PGPASSWORD, 'fixture-db-password'); assert.equal(e.PGDATABASE, 'demo');
  assert.throws(() => core.databaseEnv({ DATABASE_URL: 'postgresql://u:p@x.pooler.supabase.com:6543/db' }), /session/);
});
test('atomic reservation rejects concurrent requests with 409', async t => {
  const { manager } = await fixture(t);
  const rows = await Promise.allSettled([manager.enqueue({ id: 'owner' }), manager.enqueue({ id: 'owner' })]);
  assert.equal(rows.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(rows.find(r => r.status === 'rejected').reason.status, 409);
});
test('web and worker must use the same public encryption recipient', async t => {
  const { env } = await fixture(t); env.BACKUP_AGE_RECIPIENT = 'public-recipient-A';
  const web = new core.BackupManager(env, fake); const row = await web.enqueue({ id: 'owner' });
  const worker = new core.BackupManager({ ...env, BACKUP_AGE_RECIPIENT: 'public-recipient-B' }, fake);
  const result = await worker.run(row); assert.equal(result.status, 'failed'); assert.match(result.error, /same public recipient/);
});
test('vanished jobs fail and release their reservation', async t => {
  const { manager } = await fixture(t); const row = await manager.enqueue({ id: 'owner' });
  await core.atomic(path.join(manager.dir, 'active.lock'), { id: row.id, pid: 2147483647, host: 'fixture', startedAt: row.startedAt });
  assert.equal((await manager.list())[0].status, 'failed');
  await manager.enqueue({ id: 'owner' });
});
test('old unclaimed jobs fail even if their web process is alive', async t => {
  const { manager } = await fixture(t); const row = await manager.enqueue({ id: 'owner' });
  await core.atomic(path.join(manager.dir, 'active.lock'), { id: row.id, pid: process.pid, startedAt: '2020-01-01T00:00:00Z' });
  assert.equal((await manager.list())[0].status, 'failed');
});
test('expired live jobs become failed while retaining the no-overlap reservation', async t => {
  const { manager } = await fixture(t); const row = await manager.enqueue({ id: 'owner' });
  await manager.control('claim', { id: row.id, pid: process.pid });
  await core.atomic(path.join(manager.dir, 'active.lock'), { id: row.id, pid: process.pid, startedAt: '2020-01-01T00:00:00Z' });
  assert.equal((await manager.list())[0].status, 'failed');
  await assert.rejects(manager.enqueue({ id: 'owner' }), e => e.status === 409);
  await manager.release(row.id); await manager.enqueue({ id: 'owner' });
});
test('Linux recovery and reservation serialize across separate control processes', { skip: process.platform === 'win32' }, async t => {
  const { manager } = await fixture(t); const row = await manager.enqueue({ id: 'owner' });
  await core.atomic(path.join(manager.dir, 'active.lock'), { id: row.id, pid: 2147483647, startedAt: row.startedAt });
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => manager.enqueue({ id: 'owner' })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.status === 409));
});
test('download rejects traversal, unfinished, tampered and missing files', async t => {
  const { manager } = await fixture(t); const row = await manager.enqueue({ id: 'owner' });
  await assert.rejects(manager.download('../outside'), /Invalid backup id/);
  await assert.rejects(manager.download(row.id), /not ready/);
  const fileName = `${row.id}.tar`; await fs.writeFile(path.join(manager.dir, fileName), 'abc');
  Object.assign(row, { status: 'ready', fileName, size: 3, sha256: await core.hash(path.join(manager.dir, fileName)) });
  await core.atomic(path.join(manager.dir, `${row.id}.json`), row); await manager.download(row.id);
  await core.atomic(path.join(manager.dir, `${row.id}.json`), { ...row, fileName: '../outside' });
  await assert.rejects(manager.download(row.id), /Invalid backup filename/);
  await core.atomic(path.join(manager.dir, `${row.id}.json`), row); await fs.writeFile(path.join(manager.dir, fileName), 'xyz');
  await assert.rejects(manager.download(row.id), /changed/);
  await fs.rm(path.join(manager.dir, fileName)); await assert.rejects(manager.download(row.id), /ENOENT/);
});
test('invalid dump fails, records failure and removes plaintext temp files', async t => {
  const { env, dir } = await fixture(t); env.BACKUP_TEST_INVALID_DUMP = 'true';
  const manager = new core.BackupManager(env, fake); const row = await manager.enqueue({ id: 'owner' });
  assert.equal((await manager.run(row)).status, 'failed');
  assert.match((await manager.read(row.id)).error, /invalid/);
  assert.ok(!(await fs.readdir(manager.dir)).some(n => n.startsWith('.work-') || n.endsWith('.tar')));
  assert.match(await fs.readFile(path.join(manager.dir, 'audit.jsonl'), 'utf8'), /BACKUP_FAILED/);
});
test('disk-space preflight fails before creating a dump', async t => {
  const { env } = await fixture(t); env.BACKUP_MIN_FREE_BYTES = String(Number.MAX_SAFE_INTEGER);
  const manager = new core.BackupManager(env, fake); const row = await manager.enqueue({ id: 'owner' });
  const result = await manager.run(row); assert.equal(result.status, 'failed'); assert.match(result.error, /free disk space/);
});
test('mismatched PostgreSQL client major is rejected', async t => {
  const { env } = await fixture(t); env.BACKUP_TEST_CLIENT_MAJOR = '17';
  const manager = new core.BackupManager(env, fake); const row = await manager.enqueue({ id: 'owner' });
  const result = await manager.run(row); assert.equal(result.status, 'failed'); assert.match(result.error, /major version/);
});
test('oversized uploads are explicitly excluded, with coverage and warning', async t => {
  const { env, dir } = await fixture(t); env.BACKUP_UPLOAD_MAX_BYTES = '1'; env.BACKUP_UPLOAD_DIR = path.join(dir, 'uploads');
  await fs.mkdir(env.BACKUP_UPLOAD_DIR); await fs.writeFile(path.join(env.BACKUP_UPLOAD_DIR, 'example'), 'larger-than-one-byte');
  const manager = new core.BackupManager(env, fake); const row = await manager.enqueue({ id: 'owner' }); const result = await manager.run(row);
  assert.equal(result.status, 'ready', result.error); assert.ok(result.warnings.some(w => w.includes('Uploads skipped')));
  const out = path.join(dir, 'restored'); await fs.mkdir(out); await extractVerified(path.join(manager.dir, result.fileName), out, env);
  assert.equal(JSON.parse(await fs.readFile(path.join(out, 'coverage.json'), 'utf8')).uploads, false);
});
test('restore refuses unknown archive members before extraction', async t => {
  const { env, dir } = await fixture(t); const source = path.join(dir, 'payload'); await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'unapproved.txt'), 'fixture');
  const archive = path.join(dir, 'unsafe.tar'); await core.command('tar', ['-cf', archive, '-C', source, '.'], env);
  const out = path.join(dir, 'out'); await fs.mkdir(out);
  await assert.rejects(extractVerified(archive, out, env), /Unsafe/); assert.deepEqual(await fs.readdir(out), []);
});
test('unencrypted archive has no runtime secrets or excluded paths', async t => {
  const { manager, dir, env } = await fixture(t);
  const row = await manager.enqueue({ id: 'owner' }); const result = await manager.run(row);
  assert.equal(result.status, 'ready', result.error); assert.equal(result.encrypted, false);
  const dest = path.join(dir, 'out'); await fs.mkdir(dest); await extractVerified(path.join(manager.dir, result.fileName), dest, env);
  const names = String(await core.command('tar', ['-tf', path.join(dest, 'config.tar')], env));
  assert.ok(!names.includes('runtime.env') && !names.includes('node_modules') && !names.includes('backup.env'));
  assert.ok(!(await fs.readFile(path.join(manager.dir, result.fileName))).includes(Buffer.from(env.JWT_SECRET)));
});
test('every application production-template key is included, runtime/container/backup tokens excluded', async t => {
  const { env, dir } = await fixture(t), keys = await core.environmentKeys();
  const prod = await fs.readFile(path.join(core.ROOT, '.env.production.example'), 'utf8');
  for (const m of prod.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)) if (!m[1].startsWith('BACKUP_')) assert.ok(keys.includes(m[1]), m[1]);
  for (const key of keys) env[key] = `value-${key}`;
  Object.assign(env, { HOME: 'container-home', HOSTNAME: 'container-host', PGDATA: '/var/lib/postgresql/data', PG_VERSION: '16.1', GH_TOKEN: 'secret-github-token', BACKUP_GH_TOKEN: 'secret-backup-token' });
  const file = path.join(dir, 'runtime.env'); await core.writeEnvironment(file, env); const text = await fs.readFile(file, 'utf8');
  for (const key of keys) assert.ok(text.includes(`${key}=`), key);
  for (const forbidden of ['HOME=', 'HOSTNAME=', 'PGDATA=', 'PG_VERSION=', 'GH_TOKEN=', 'BACKUP_GH_TOKEN=']) assert.ok(!text.includes(forbidden));
});
test('local retention keeps newest N only and removes expired failed records', async t => {
  const { manager } = await fixture(t); await manager.init();
  for (let i = 1; i <= 5; i++) {
    const bid = id.replace('1234abcd', `1234abc${i}`); await fs.writeFile(path.join(manager.dir, `${bid}.tar`), 'fixture');
    await core.atomic(path.join(manager.dir, `${bid}.json`), { id: bid, status: i === 1 ? 'failed' : 'ready', encrypted: false, startedAt: `2020-01-0${i}T00:00:00Z`, fileName: `${bid}.tar` });
  }
  await manager.cleanup(); assert.equal((await manager.list()).length, 3);
});
test('refuses unencrypted upload, code repo and public backup repo', async t => {
  const { dir, env } = await fixture(t); const f = path.join(dir, 'backup.tar'); await fs.writeFile(f, 'fake');
  await assert.rejects(core.publishBackup(env, f, dir, fake), /unencrypted/);
  env.BACKUP_AGE_RECIPIENT = 'fixture'; env.BACKUP_GITHUB_REPO = 'Mrinmoypatratint/attendoschool';
  await assert.rejects(core.publishBackup(env, `${f}.age`, dir, fake), /separate/);
  env.BACKUP_GITHUB_REPO = 'fixture/private'; env.BACKUP_TEST_PUBLIC = 'true';
  await assert.rejects(core.publishBackup(env, `${f}.age`, dir, fake), /private/);
});
test('unknown Firebase configuration fails rather than claiming full coverage', async t => {
  const { env, dir } = await fixture(t); env.FIREBASE_CLIENT_EMAIL = 'fixture@example.com'; delete env.BACKUP_FIREBASE_CONFIRMED_UNUSED;
  await assert.rejects(core.buildArchive(env, dir, id, fake), /Firebase credentials detected/);
});
test('real age encrypted split-release round trip and checksums (synthetic dump/GitHub)', async t => {
  try { await core.command('age', ['--version'], process.env); } catch (e) { if (process.env.BACKUP_REQUIRE_AGE) throw e; t.skip('age not installed; CI requires it'); return; }
  const { dir, env } = await fixture(t); const key = path.join(dir, 'throwaway.agekey');
  await core.command('age-keygen', ['-o', key], env);
  const publicKey = String(await core.command('age-keygen', ['-y', key], env)).trim(); env.BACKUP_AGE_RECIPIENT = publicKey;
  env.BACKUP_TEST_ARGV = path.join(dir, 'argv.jsonl');
  const today = new Date(), yesterday = new Date(+today - 86400000), recent = `backup-${yesterday.toISOString().slice(0,10)}-0200`;
  const monthly = `backup-${today.getUTCFullYear()}-${String(today.getUTCMonth() || 12).padStart(2,'0')}-01-0200`;
  await fs.mkdir(path.join(env.BACKUP_TEST_RELEASES, 'backup-2020-06-15-0200'), { recursive: true });
  await fs.mkdir(path.join(env.BACKUP_TEST_RELEASES, recent)); await fs.mkdir(path.join(env.BACKUP_TEST_RELEASES, monthly));
  const manager = new core.BackupManager(env, fake), row = await manager.enqueue({ id: 'fixture-owner' }, true), result = await manager.run(row);
  assert.equal(result.status, 'ready', result.error);
  const released = await fs.readdir(path.join(env.BACKUP_TEST_RELEASES, result.releaseTag)); assert.ok(released.length > 1); assert.ok(released.every(n => n.includes('.age.part-')));
  for (const name of released) { const bytes = await fs.readFile(path.join(env.BACKUP_TEST_RELEASES, result.releaseTag, name)); assert.ok(!bytes.includes(Buffer.from('PGDMP')) && !bytes.includes(Buffer.from(env.JWT_SECRET))); }
  assert.deepEqual((await fs.readdir(env.BACKUP_TEST_RELEASES)).sort(), [recent, monthly, result.releaseTag].sort());
  const originalCwd = process.cwd(); process.chdir(dir);
  try {
    const restored = await restore(['fixture/private-backups', key, result.releaseTag], env, fake);
    assert.equal((await fs.readFile(path.join(restored, 'database.dump'))).subarray(0, 5).toString(), 'PGDMP');
    const config = path.join(dir, 'config'); await fs.mkdir(config); await core.command('tar', ['-xf', path.join(restored, 'config.tar'), '-C', config], env);
    assert.ok((await fs.readFile(path.join(config, 'runtime.env'), 'utf8')).includes(env.JWT_SECRET));
    assert.ok(!(await fs.readFile(env.BACKUP_TEST_ARGV, 'utf8')).includes('fixture-db-password'));
  } finally { process.chdir(originalCwd); }
});
