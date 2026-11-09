'use strict';
const fs = require('node:fs/promises');
const sync = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Readable, Transform } = require('node:stream');
const ROOT = path.resolve(__dirname, '../..');
const ID = /^attendoschool-backup-\d{8}-\d{6}-[a-f0-9]{8}$/;
const TAG = /^backup-\d{4}-\d{2}-\d{2}-\d{4}$/;
const CONFIG = ['docker-compose.yml', 'docker-compose.production.yml', 'ecosystem.config.cjs', 'deploy/nginx/nginx.conf'];
const TEMPLATES = ['.env.example', '.env.production.example', 'backend/.env.example', 'frontend/.env.example', 'frontend/.env.production.example'];
const fail = (message, status = 500) => Object.assign(new Error(message), { status });
const log = message => console.log(`${new Date().toISOString()} ${message}`);
function positive(value, fallback) { const n = Number(value ?? fallback); if (!Number.isSafeInteger(n) || n < 1) throw fail('Invalid numeric backup setting'); return n; }
function requireOwner(user) { if (!user || user.role !== 'SUPER_ADMIN') throw fail('Super Admin access required for backups', 403); }
async function atomic(file, data) {
  const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try { await fs.writeFile(tmp, JSON.stringify(data), { mode: 0o600, flag: 'wx' }); await fs.rename(tmp, file); }
  finally { await fs.rm(tmp, { force: true }); }
}
async function json(file) {
  const s = await fs.lstat(file);
  if (!s.isFile() || s.isSymbolicLink() || s.size > 256 * 1024) throw fail('Invalid backup status file');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
// Stream large outputs directly to disk. Never expose stderr (may contain credentials).
async function command(tool, args, env, output) {
  const fd = output ? await fs.open(output, 'wx', 0o600) : null;
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(tool, args, { env, stdio: ['ignore', fd ? fd.fd : 'pipe', 'ignore'], windowsHide: true });
      let result = '', overflow = false;
      if (!fd) child.stdout.on('data', b => { if (result.length + b.length > 4 * 1024 * 1024) { overflow = true; child.kill(); } else result += b; });
      child.once('error', () => reject(fail(`Required tool unavailable: ${path.basename(tool)}`)));
      child.once('close', code => code === 0 && !overflow ? resolve(result) : reject(fail(`${path.basename(tool)} failed; check credentials, connectivity, tool version and disk space`)));
    });
  } finally { if (fd) await fd.close(); }
}
function databaseEnv(env) {
  const result = { ...env };
  const raw = env.BACKUP_DATABASE_URL || env.SUPABASE_DATABASE_URL || env.DATABASE_URL;
  if (raw) {
    let url; try { url = new URL(raw); } catch { throw fail('Invalid BACKUP_DATABASE_URL'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw fail('Only PostgreSQL backups are supported');
    if (url.hostname.endsWith('pooler.supabase.com') && url.port === '6543') throw fail('Use a direct or session-mode database URL for backups, not transaction port 6543');
    Object.assign(result, { PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGSSLMODE: url.searchParams.get('sslmode') || env.PGSSLMODE || 'require' });
  } else Object.assign(result, { PGHOST: env.DB_HOST || 'localhost', PGPORT: env.DB_PORT || '5432', PGUSER: env.DB_USER || 'postgres', PGPASSWORD: env.DB_PASSWORD || env.PGPASSWORD || '', PGDATABASE: env.DB_NAME || 'attendance' });
  return result;
}
async function hash(file) {
  const h = crypto.createHash('sha256');
  for await (const data of sync.createReadStream(file)) h.update(data);
  return h.digest('hex');
}
async function treeSize(dir) {
  let size = 0;
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isSymbolicLink()) throw fail('Symlinks are not allowed in uploaded files');
    if (item.isDirectory()) size += await treeSize(full);
    else if (item.isFile()) size += (await fs.stat(full)).size;
    else throw fail('Special files are not allowed in uploaded files');
  }
  return size;
}
async function environmentKeys() {
  const keys = new Set();
  for (const name of TEMPLATES) {
    const text = await fs.readFile(path.join(ROOT, name), 'utf8');
    for (const match of text.matchAll(/^\s*(?:#\s*)?([A-Z][A-Z0-9_]*)=/gm)) keys.add(match[1]);
  }
  return [...keys].filter(k => !k.startsWith('BACKUP_') && !['GH_TOKEN', 'GITHUB_TOKEN'].includes(k));
}
async function writeEnvironment(file, env) {
  const keys = new Set(await environmentKeys());
  for (const key of ['SENDINBLUE_API_KEY', 'GOOGLE_SCRIPT_URL', 'GOOGLE_APPLICATION_CREDENTIALS', 'GCLOUD_PROJECT', 'GCS_BUCKET', 'KEEP_ALIVE_URL', 'APP_BASE_URL']) keys.add(key);
  for (const key of Object.keys(env)) if (/^(FIREBASE_|SMTP_|BREVO_|RESEND_|RAZORPAY_|SUPABASE_|DB_|REDIS_|SMS_|WHATSAPP_|COMPANY_|EMAIL_|JWT_|VITE_)/.test(key) || /^PG(HOST|PORT|DATABASE|USER|PASSWORD|SSLMODE|SSLROOTCERT|CONNECT_TIMEOUT|POOL_MAX)$/.test(key)) keys.add(key);
  const text = [...keys].sort().filter(k => env[k] !== undefined).map(k => `${k}=${JSON.stringify(env[k])}`).join('\n') + '\n';
  await fs.writeFile(file, text, { mode: 0o600 });
}
async function archive(dir, out, env) { await command('tar', ['-cf', out, '-C', dir, '.'], env); }
async function encryptedArchive(dir, out, recipient, env) {
  const tar = spawn('tar', ['-cf', '-', '-C', dir, '.'], { env, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  const age = spawn('age', ['-r', recipient, '-o', out], { env, stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
  const completed = child => new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(Error('Archive pipeline failed')));
  });
  try { await Promise.all([completed(tar), completed(age), pipeline(tar.stdout, age.stdin)]); await fs.chmod(out, 0o600); }
  catch { tar.kill(); age.kill(); throw fail('tar | age failed; check public recipient, tools and free disk space'); }
}
async function storageExport(env, dest, max) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    if (env.BACKUP_STORAGE_DISABLED === 'true') return { bytes: 0, warning: 'Supabase Storage explicitly excluded by owner configuration' };
    throw fail('Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or explicitly set BACKUP_STORAGE_DISABLED=true if no remote uploads exist');
  }
  const base = new URL(env.SUPABASE_URL); if (base.protocol !== 'https:' && env.NODE_ENV !== 'test') throw fail('Supabase Storage requires HTTPS');
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  async function request(endpoint, body) {
    const res = await fetch(new URL(`/storage/v1/${endpoint}`, base), { method: body ? 'POST' : 'GET', headers, body: body && JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw fail(`Supabase Storage export failed (HTTP ${res.status})`);
    return res;
  }
  let bytes = 0;
  const buckets = await (await request('bucket')).json();
  if (!Array.isArray(buckets)) throw fail('Invalid storage bucket response');
  await fs.mkdir(dest, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(dest, 'buckets.json'), JSON.stringify(buckets));
  for (const bucket of buckets) {
    if (!/^[a-zA-Z0-9_-]+$/.test(bucket.id)) throw fail('Unsafe storage bucket name');
    const target = path.join(dest, 'objects', bucket.id); await fs.mkdir(target, { recursive: true });
    async function list(prefix) {
      for (let offset = 0; ; offset += 100) {
        const rows = await (await request(`object/list/${encodeURIComponent(bucket.id)}`, { prefix, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })).json();
        if (!Array.isArray(rows)) throw fail('Invalid storage object response');
        for (const row of rows) {
          if (typeof row.name !== 'string' || !row.name || /[\\/\x00]/.test(row.name) || ['.', '..'].includes(row.name)) throw fail('Unsafe storage object name');
          const name = prefix ? `${prefix}/${row.name}` : row.name;
          if (!row.id) { await list(name); continue; }
          const file = path.join(target, ...name.split('/')); await fs.mkdir(path.dirname(file), { recursive: true });
          const res = await request(`object/authenticated/${encodeURIComponent(bucket.id)}/${name.split('/').map(encodeURIComponent).join('/')}`);
          const limit = new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; callback(bytes > max ? fail('UPLOAD_LIMIT') : null, chunk); } });
          await pipeline(Readable.fromWeb(res.body), limit, sync.createWriteStream(file, { flags: 'wx', mode: 0o600 }));
        }
        if (rows.length < 100) break;
      }
    }
    await list('');
  }
  return { bytes };
}
const README = `AttendoSchool backup format v1\n\nRead docs/backup.md from the code checkout for the emergency manual.\nNo command in restore.sh changes a database. Use a NEW side database first.\nVerify SHA256SUMS before restoring.\nDatabase: pg_restore --list database.dump\nThen: createdb attendoschool_restore\nThen: pg_restore --exit-on-error --no-owner --no-privileges -d attendoschool_restore database.dump\nSupabase-managed schemas/extensions may require a compatible Supabase target.\nConfig: tar -xf config.tar -C NEW_PRIVATE_DIRECTORY\nRead runtime.env; copy values into backend/.env (do not shell-source JSON values).\nUploads: tar -xf uploads.tar -C NEW_PRIVATE_DIRECTORY\nSupabase files: remote/objects/<bucket>/<key>; recreate buckets from remote/buckets.json then upload via Storage API. Local files: local/.\nNever copy files into PostgreSQL's data directory. Stop writes during the final move.\nDatabase and uploads are not transactionally synchronized; pause writes for a strict snapshot.\n`;
class BackupManager {
  constructor(env = process.env, runCommand = command) {
    this.command = runCommand;
    this.env = { ...env }; this.dir = path.resolve(env.BACKUP_DIR || path.join(ROOT, 'backups/private'));
    this.staleMs = positive(env.BACKUP_STALE_SECONDS, 14400) * 1000;
  }
  async init() {
    await fs.mkdir(this.dir, { recursive: true, mode: 0o700 });
    const st = await fs.lstat(this.dir); if (!st.isDirectory() || st.isSymbolicLink()) throw fail('Backup directory must be a private real directory');
    const real = await fs.realpath(this.dir);
    for (const publicDir of ['frontend/public', 'frontend/dist', 'backend/assets']) {
      const rel = path.relative(path.join(ROOT, publicDir), real); if (!rel.startsWith('..') && !path.isAbsolute(rel)) throw fail('Backup directory must not be publicly served');
    }
    await fs.chmod(this.dir, 0o700);
  }
  async read(id) {
    if (!ID.test(id)) throw fail('Invalid backup id', 400);
    const row = await json(path.join(this.dir, `${id}.json`));
    if (row.id !== id || !['queued', 'running', 'ready', 'failed'].includes(row.status) || !Number.isFinite(Date.parse(row.startedAt)) || typeof row.encrypted !== 'boolean') throw fail('Invalid backup status file');
    if (row.fileName && row.fileName !== `${id}.tar${row.encrypted ? '.age' : ''}`) throw fail('Invalid backup filename');
    return row;
  }
  async audit(action, row, who = row.requestedBy) {
    const entry = { at: new Date().toISOString(), action, backupId: row.id, size: row.size || 0, who, encrypted: row.encrypted };
    await fs.appendFile(path.join(this.dir, 'audit.jsonl'), JSON.stringify(entry) + '\n', { mode: 0o600 });
  }
  async control(action, payload = {}) {
    // OS lock serializes recovery + reservation across all PM2 web processes.
    // The worker's separate flock serializes actual jobs. Lock files contain no secrets.
    if (process.platform === 'win32') return this[`_${action}`](payload);
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const localFlock = path.resolve(this.dir, '../tools/prefix/usr/bin/flock');
    const result = JSON.parse(String(await command(sync.existsSync(localFlock) ? localFlock : 'flock', ['-x', '-w', '10', path.join(this.dir, 'control.flock'), process.execPath, path.join(__dirname, 'control.cjs'), action, encoded], this.env)));
    if (result.error) throw Object.assign(fail(result.error, result.status || 500), { code: result.code });
    return result.value;
  }
  async recover() {
    return this.control('recover');
  }
  async _recover() {
    let lock; try { lock = await json(path.join(this.dir, 'active.lock')); } catch (e) { if (e.code === 'ENOENT') return; throw fail('Invalid backup lock; inspect it before removing it'); }
    if (!ID.test(lock.id) || !Number.isInteger(lock.pid) || lock.pid < 1) throw fail('Backup lock owner cannot be verified');
    const age = Date.now() - Date.parse(lock.startedAt);
    if (!Number.isFinite(age)) throw fail('Invalid backup lock timestamp');
    const saved = await this.read(lock.id);
    if (saved.status === 'ready' || (saved.status === 'failed' && !saved.stopping)) {
      await fs.rm(path.join(this.dir, 'active.lock'), { force: true }); return;
    }
    if (!alive(lock.pid)) {
      const row = await this.read(lock.id);
      if (!['ready', 'failed'].includes(row.status)) { row.status = 'failed'; row.error = 'Backup job disappeared; retry after checking the worker'; await atomic(path.join(this.dir, `${row.id}.json`), row); await this.audit('BACKUP_FAILED', row); }
      await fs.rm(path.join(this.dir, 'active.lock'));
    } else if (age > this.staleMs) {
      const row = await this.read(lock.id);
      if (row.status === 'queued') {
        row.status = 'failed'; row.error = 'Backup worker did not pick up this job; start the dedicated worker and retry';
        await atomic(path.join(this.dir, `${row.id}.json`), row); await this.audit('BACKUP_FAILED', row);
        await fs.rm(path.join(this.dir, 'active.lock'));
      } else {
        if (row.status !== 'failed') {
          row.status = 'failed'; row.stopping = true; row.error = 'Backup exceeded its time limit; its worker is stopping. Check the dedicated worker before retrying';
          await atomic(path.join(this.dir, `${row.id}.json`), row); await this.audit('BACKUP_FAILED', row);
        }
        // Never overlap a still-live dump. The dedicated worker kills its process group
        // at three hours, earlier than this four-hour stale limit, and releases safely.
      }
    }
  }
  async list() {
    await this.init(); await this.recover(); const rows = [];
    for (const name of await fs.readdir(this.dir)) if (name.endsWith('.json') && ID.test(name.slice(0, -5))) rows.push(await this.read(name.slice(0, -5)));
    return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async enqueue(who, publish = false) {
    await this.init(); return this.control('enqueue', { who, publish, pid: process.pid });
  }
  async _enqueue({ who, publish = false, pid }) {
    if (!Number.isInteger(pid) || pid < 1) throw fail('Invalid backup requester process');
    await this._recover();
    const id = `attendoschool-backup-${new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}-${crypto.randomBytes(4).toString('hex')}`;
    const row = { id, status: 'queued', startedAt: new Date().toISOString(), requestedBy: who, encrypted: Boolean(this.env.BACKUP_AGE_RECIPIENT), recipientFingerprint: crypto.createHash('sha256').update(this.env.BACKUP_AGE_RECIPIENT || '').digest('hex'), publish };
    try { await fs.writeFile(path.join(this.dir, 'active.lock'), JSON.stringify({ id, pid, host: os.hostname(), startedAt: row.startedAt }), { flag: 'wx', mode: 0o600 }); }
    catch (e) { if (e.code === 'EEXIST') throw fail('A backup is already queued or running', 409); throw e; }
    try { await atomic(path.join(this.dir, `${id}.json`), row); await this.audit('BACKUP_REQUESTED', row); }
    catch (e) { await fs.rm(path.join(this.dir, 'active.lock'), { force: true }); throw e; }
    return row;
  }
  async _claim({ id, pid }) {
    const lock = await json(path.join(this.dir, 'active.lock'));
    if (lock.id !== id || !Number.isInteger(pid) || pid < 1) throw fail('Backup queue reservation changed');
    const row = await this.read(id);
    if (row.status !== 'queued') throw fail('Backup is no longer queued');
    if (row.recipientFingerprint !== crypto.createHash('sha256').update(this.env.BACKUP_AGE_RECIPIENT || '').digest('hex')) throw fail('Web and worker encryption settings differ; configure the same public recipient');
    await atomic(path.join(this.dir, 'active.lock'), { id, pid, host: os.hostname(), startedAt: row.startedAt });
    row.status = 'running'; await atomic(path.join(this.dir, `${id}.json`), row); return row;
  }
  async _release({ id }) {
    const lock = await json(path.join(this.dir, 'active.lock')).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (lock?.id === id) await fs.rm(path.join(this.dir, 'active.lock'), { force: true });
  }
  async release(id) { return this.control('release', { id }); }
  async download(id) {
    const row = await this.read(id);
    if (row.status !== 'ready') throw fail('Backup is not ready', 409);
    const expected = `${id}.tar${row.encrypted ? '.age' : ''}`;
    if (row.fileName !== expected) throw fail('Invalid backup filename');
    const file = path.join(this.dir, expected), stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== row.size || stat.size < 1 || !/^[a-f0-9]{64}$/.test(row.sha256 || '') || await hash(file) !== row.sha256) throw fail('Backup file is missing or has changed');
    return { row, file };
  }
  async run(row) {
    let work;
    try {
      row = await this.control('claim', { id: row.id, pid: process.pid });
      work = await fs.mkdtemp(path.join(this.dir, '.work-')); await fs.chmod(work, 0o700);
      const built = await buildArchive(this.env, work, row.id, this.command);
      const fileName = path.basename(built.file); await fs.rename(built.file, path.join(this.dir, fileName));
      Object.assign(row, { status: 'ready', fileName, size: (await fs.stat(path.join(this.dir, fileName))).size, sha256: await hash(path.join(this.dir, fileName)), warnings: built.warnings, completedAt: new Date().toISOString() });
      if (row.publish) {
        row.releaseTag = await publishBackup(this.env, path.join(this.dir, fileName), work, this.command);
        await atomic(path.join(this.dir, 'last-published.json'), { id: row.id, tag: row.releaseTag, at: new Date().toISOString(), size: row.size, encrypted: row.encrypted, warnings: row.warnings });
      }
      await this.audit('BACKUP_READY', row);
      await atomic(path.join(this.dir, `${row.id}.json`), row);
      await this.cleanup();
      if (this.env.BACKUP_HEARTBEAT_URL && row.publish) {
        try { const res = await fetch(this.env.BACKUP_HEARTBEAT_URL, { signal: AbortSignal.timeout(15000) }); if (!res.ok) throw Error(); }
        catch { log('WARNING: backup saved but heartbeat failed; check alert service'); }
      }
    } catch (e) {
      row.status = 'failed'; row.error = e.message; row.completedAt = new Date().toISOString();
      await atomic(path.join(this.dir, `${row.id}.json`), row); await this.audit('BACKUP_FAILED', row);
      if (row.fileName) await fs.rm(path.join(this.dir, row.fileName), { force: true });
    } finally {
      if (work) await fs.rm(work, { recursive: true, force: true });
      await this.release(row.id);
    }
    return row;
  }
  async cleanup() {
    const keep = positive(this.env.BACKUP_LOCAL_KEEP, 3), failedDays = positive(this.env.BACKUP_FAILED_DAYS, 7), rows = [];
    for (const name of await fs.readdir(this.dir)) if (ID.test(name.slice(0, -5)) && name.endsWith('.json')) rows.push(await this.read(name.slice(0, -5)));
    const ready = rows.filter(r => r.status === 'ready').sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    for (const row of [...ready.slice(keep), ...rows.filter(r => r.status === 'failed' && Date.now() - Date.parse(r.startedAt) > failedDays * 86400000)]) {
      for (const suffix of ['.tar', '.tar.age', '.json']) await fs.rm(path.join(this.dir, row.id + suffix), { force: true });
    }
  }
}
async function buildArchive(env, work, id, run = command) {
  if (!ID.test(id)) throw fail('Invalid backup id');
  if (env.DB_DRIVER !== 'postgres' || env.ENABLE_DUAL_DB_SYNC === 'true' || (env.SECONDARY_DB && env.SECONDARY_DB !== 'none')) throw fail('Confirm PostgreSQL-only data storage before enabling this backup; legacy Firestore is not covered');
  if (env.FIREBASE_STORAGE_BUCKET || env.GCS_BUCKET) throw fail('Firebase Storage is configured; migrate/export it before using this PostgreSQL backup');
  if ((env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_KEY || env.FIREBASE_SERVICE_ACCOUNT_PATH || env.GOOGLE_APPLICATION_CREDENTIALS || sync.existsSync(path.join(ROOT, 'backend/serviceAccountKey.json')) || sync.existsSync(path.join(ROOT, 'serviceAccountKey.json'))) && env.BACKUP_FIREBASE_CONFIRMED_UNUSED !== 'true') throw fail('Firebase credentials detected. Verify no unique live data remains there, then set BACKUP_FIREBASE_CONFIRMED_UNUSED=true; otherwise export/migrate Firebase first');
  const encrypted = Boolean(env.BACKUP_AGE_RECIPIENT), pg = databaseEnv(env);
  const version = String(await run('psql', ['-XAt', '-v', 'ON_ERROR_STOP=1', '-c', 'SHOW server_version_num'], pg)).trim();
  const client = String(await run('pg_dump', ['--version'], pg)).match(/(\d+)\./)?.[1];
  if (!/^\d+$/.test(version) || Number(client) !== Math.floor(Number(version) / 10000)) throw fail('pg_dump major version must match the PostgreSQL server');
  const dbSize = Number(String(await run('psql', ['-XAt', '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT pg_database_size(current_database())'], pg)).trim());
  if (!Number.isSafeInteger(dbSize) || dbSize < 1) throw fail('Unable to estimate database size');
  const uploadLimit = positive(env.BACKUP_UPLOAD_MAX_BYTES, 1500000000);
  const disk = await fs.statfs(work), needed = Math.max(positive(env.BACKUP_MIN_FREE_BYTES, 1073741824), dbSize * 3 + uploadLimit * 2);
  if (disk.bavail * disk.bsize < needed) throw fail('Not enough free disk space for a backup; free space or move BACKUP_DIR');
  const payload = path.join(work, 'payload'); await fs.mkdir(payload, { mode: 0o700 });
  const dump = path.join(payload, 'database.dump');
  await run('pg_dump', ['-Fc', '--no-password', '--file', dump], pg);
  const magic = await fs.open(dump, 'r'); const head = Buffer.alloc(5); try { await magic.read(head, 0, 5, 0); } finally { await magic.close(); }
  if (head.toString() !== 'PGDMP' || (await fs.stat(dump)).size <= 5) throw fail('Database dump is empty or invalid');
  await run('pg_restore', ['--list', dump], pg);
  const config = path.join(work, 'config'); await fs.mkdir(config);
  for (const name of CONFIG) {
    const src = path.join(ROOT, name); if (!sync.existsSync(src)) continue;
    await fs.mkdir(path.dirname(path.join(config, name)), { recursive: true }); await fs.copyFile(src, path.join(config, name));
  }
  if (encrypted) await writeEnvironment(path.join(config, 'runtime.env'), env);
  await archive(config, path.join(payload, 'config.tar'), env);
  await fs.rm(config, { recursive: true, force: true });
  const warnings = encrypted ? [] : ['Encryption is OFF. Secrets are excluded. The database still contains private personal data; keep this file offline.'];
  const uploads = path.join(work, 'uploads'); await fs.mkdir(uploads);
  try {
    let localSize = 0;
    if (env.BACKUP_UPLOAD_DIR) {
      const local = path.resolve(env.BACKUP_UPLOAD_DIR);
      const st = await fs.lstat(local); if (!st.isDirectory() || st.isSymbolicLink()) throw fail('Local uploads must be a real directory, not a symlink');
      const relative = path.relative(await fs.realpath(local), await fs.realpath(work));
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) throw fail('Uploaded files directory must not contain the backup directory');
      localSize = await treeSize(local); if (localSize > uploadLimit) throw fail('UPLOAD_LIMIT');
      await fs.cp(local, path.join(uploads, 'local'), { recursive: true, dereference: false });
      await treeSize(path.join(uploads, 'local'));
    }
    const remote = await storageExport(env, path.join(uploads, 'remote'), uploadLimit - localSize);
    if (remote.warning) warnings.push(remote.warning);
    await archive(uploads, path.join(payload, 'uploads.tar'), env);
  } catch (e) {
    if (e.message !== 'UPLOAD_LIMIT') throw e;
    warnings.push('Uploads skipped: above BACKUP_UPLOAD_MAX_BYTES (default 1.5 GB). Keep a separate object-storage copy before relying on this backup.');
  }
  await fs.rm(uploads, { recursive: true, force: true });
  await fs.writeFile(path.join(payload, 'README.txt'), README);
  await fs.writeFile(path.join(payload, 'coverage.json'), JSON.stringify({ format: 1, encrypted, warnings, database: 'PostgreSQL custom dump', secrets: encrypted, uploads: sync.existsSync(path.join(payload, 'uploads.tar')) }, null, 2));
  const names = (await fs.readdir(payload)).sort();
  await fs.writeFile(path.join(payload, 'SHA256SUMS'), (await Promise.all(names.map(async name => `${await hash(path.join(payload, name))}  ${name}\n`))).join(''));
  const file = path.join(work, `${id}.tar${encrypted ? '.age' : ''}`);
  if (encrypted) await encryptedArchive(payload, file, env.BACKUP_AGE_RECIPIENT, env);
  else await archive(payload, file, env);
  for (const warning of warnings) log(`WARNING: ${warning}`);
  return { file, warnings };
}
function retention(tags, current, days, months, now = new Date()) {
  const dailyCutoff = now.getTime() - positive(days, 14) * 86400000;
  const monthCutoff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - positive(months, 12) + 1, 1);
  return tags.filter(tag => {
    if (!TAG.test(tag) || tag === current) return false;
    const date = new Date(`${tag.slice(7, 17)}T${tag.slice(18, 20)}:${tag.slice(20, 22)}:00Z`);
    if (!Number.isFinite(+date) || +date >= dailyCutoff) return false;
    return !(date.getUTCDate() === 1 && +date >= monthCutoff);
  });
}
async function publishBackup(env, file, work, run = command) {
  if (!file.endsWith('.age') || !env.BACKUP_AGE_RECIPIENT) throw fail('Refusing to upload an unencrypted backup');
  const repo = env.BACKUP_GITHUB_REPO;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || repo.toLowerCase() === 'mrinmoypatratint/attendoschool') throw fail('Choose a separate private BACKUP_GITHUB_REPO, never the code repository');
  const ghEnv = { ...env, GH_TOKEN: env.BACKUP_GH_TOKEN || env.GH_TOKEN };
  const meta = JSON.parse(String(await run('gh', ['api', `repos/${repo}`], ghEnv)));
  if (meta.private !== true) throw fail('Backup repository must be private');
  const encryptedFile = await fs.open(file, 'r'); const header = Buffer.alloc(22);
  try { await encryptedFile.read(header, 0, 22, 0); } finally { await encryptedFile.close(); }
  if (!header.toString().startsWith('age-encryption.org/v1\n')) throw fail('Refusing upload: missing age encryption header');
  const tag = `backup-${new Date().toISOString().slice(0, 16).replace('T', '-').replace(/:(\d{2})$/, '$1')}`;
  const partBytes = positive(env.BACKUP_SPLIT_BYTES, 1900000000); if (partBytes > 1900000000) throw fail('Split size must not exceed 1.9 GB');
  const parts = [], total = (await fs.stat(file)).size;
  if (total <= partBytes) parts.push(file);
  else {
    if (Math.ceil(total / partBytes) > 1000) throw fail('Backup would exceed GitHub release asset count; increase split size up to 1.9 GB');
    for (let offset = 0, i = 0; offset < total; offset += partBytes, i++) {
      const part = path.join(work, `${path.basename(file)}.part-${String(i).padStart(5, '0')}`);
      await pipeline(sync.createReadStream(file, { start: offset, end: Math.min(total, offset + partBytes) - 1 }), sync.createWriteStream(part, { mode: 0o600, flags: 'wx' })); parts.push(part);
    }
  }
  await run('gh', ['release', 'create', tag, '--repo', repo, '--draft', '--title', tag, '--notes', 'Encrypted AttendoSchool backup. See docs/backup.md.'], ghEnv);
  for (const part of parts) await run('gh', ['release', 'upload', tag, part, '--repo', repo], ghEnv);
  const release = JSON.parse(String(await run('gh', ['api', `repos/${repo}/releases/tags/${tag}`], ghEnv)));
  if (!Number.isSafeInteger(release.id)) throw fail('Invalid release id');
  await run('gh', ['api', '--method', 'PATCH', `repos/${repo}/releases/${release.id}`, '-F', 'draft=false', '-f', 'make_latest=true'], ghEnv);
  const tags = String(await run('gh', ['api', '--paginate', `repos/${repo}/releases?per_page=100`, '--jq', '.[] | select(.draft == false) | .tag_name'], ghEnv)).trim().split('\n');
  const old = retention(tags, tag, env.BACKUP_RETENTION_DAYS || 14, env.BACKUP_MONTHLY_KEEP || 12);
  for (const expired of old) await run('gh', ['release', 'delete', expired, '--repo', repo, '--yes', '--cleanup-tag'], ghEnv);
  log(`Published encrypted release ${tag}`); return tag;
}
module.exports = { ROOT, ID, TAG, CONFIG, TEMPLATES, BackupManager, requireOwner, databaseEnv, command, hash, buildArchive, publishBackup, retention, environmentKeys, writeEnvironment, storageExport, atomic, json, log };
