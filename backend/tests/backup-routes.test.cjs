const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createBackupRouter } = require('../dist/routes/backups');
const { BackupManager, atomic, hash } = require('../../scripts/backup/core.cjs');
test('HTTP owner guard, 202 queue, 409 conflict, validated download, headers and audit', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-http-'));
  const manager = new BackupManager({ BACKUP_DIR: dir });
  const audit = [], app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'fixture-user', name: 'Fixture Owner', role: req.headers['x-test-role'], permissions: ['*'], isOwner: true }; next(); });
  app.use('/api/backups', createBackupRouter(() => manager, async (...args) => { audit.push(args); }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(async () => { await new Promise(r => server.close(r)); await fs.rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}/api/backups`;
  const request = (url, method = 'GET', role = 'SUPER_ADMIN') => fetch(base + url, { method, headers: { 'x-test-role': role } });
  for (const role of ['SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']) {
    for (const [url, method] of [['/jobs', 'GET'], ['/create', 'POST'], ['/trigger', 'POST'], ['/abc/download', 'GET']]) assert.equal((await request(url, method, role)).status, 403);
  }
  const queued = await request('/create', 'POST'); assert.equal(queued.status, 202); const row = await queued.json();
  assert.equal((await request('/create', 'POST')).status, 409);
  assert.equal((await request(`/${row.id}/download`)).status, 409);
  assert.equal((await request('/..%2Fsecret/download')).status, 400);
  const file = path.join(dir, `${row.id}.tar`); await fs.writeFile(file, 'safe-fixture-archive');
  Object.assign(row, { status: 'ready', encrypted: false, fileName: path.basename(file), size: (await fs.stat(file)).size, sha256: await hash(file) });
  await atomic(path.join(dir, `${row.id}.json`), row);
  const downloaded = await request(`/${row.id}/download`);
  assert.equal(downloaded.status, 200); assert.equal(downloaded.headers.get('cache-control'), 'no-store');
  assert.match(downloaded.headers.get('content-disposition') || '', /^attachment; filename="attendoschool-backup-/);
  assert.equal(await downloaded.text(), 'safe-fixture-archive');
  assert.ok(audit.some(a => a[1] === 'BACKUP_DOWNLOAD' && a[4].size === row.size));
  assert.match(await fs.readFile(path.join(dir, 'audit.jsonl'), 'utf8'), /BACKUP_DOWNLOAD/);
  await atomic(path.join(dir, `${row.id}.json`), { ...row, fileName: '../secret' });
  assert.equal((await request(`/${row.id}/download`)).status, 500);
});
