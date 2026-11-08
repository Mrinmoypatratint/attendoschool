'use strict';
// Run on the VPS by GitHub Actions. Reports contain metadata only, never env values.
const fs = require('node:fs/promises');
const path = require('node:path');
const { ROOT } = require('./core.cjs');
const REPO = 'Mrinmoypatratint/attendoschool-private-backups';
const quote = value => `'${String(value).replace(/'/g, "'\\''")}'`;
async function replacePrivate(file, text) {
  let previous; try { previous = await fs.stat(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tmp, text, { flag: 'wx', mode: 0o600 });
    if (previous) await fs.chown(tmp, previous.uid, previous.gid).catch(e => { if (e.code !== 'EPERM') throw e; });
    await fs.rename(tmp, file); await fs.chmod(file, 0o600);
  } finally { await fs.rm(tmp, { force: true }); }
}
function setEnv(text, key, value) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, 'gm');
  return pattern.test(text) ? text.replace(pattern, () => line) : `${text.trimEnd()}\n${line}\n`;
}
function cronText(existing, root, config, state) {
  const marker = '# attendoschool-backup-managed';
  const retained = existing.split('\n').filter(line => !line.endsWith(marker)).join('\n').trimEnd();
  const line = `17 2 * * * BACKUP_CONFIG_FILE=${quote(config)} /bin/bash ${quote(path.join(root, 'scripts/backup/scheduled.sh'))} >> ${quote(path.join(state, 'cron.log'))} 2>&1 ${marker}`;
  return `${retained}${retained ? '\n' : ''}${line}\n`;
}
async function inspect(env, root = ROOT, clientFactory) {
  const exists = async file => fs.access(file).then(() => true, () => false);
  const report = {
    driver: env.DB_DRIVER || 'firebase',
    postgresConfigured: Boolean(env.SUPABASE_DATABASE_URL || env.DATABASE_URL || env.DB_HOST),
    supabaseDatabase: /supabase\.(co|com)/.test(env.SUPABASE_DATABASE_URL || env.DATABASE_URL || ''),
    firebaseCredentialsPresent: Boolean(env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_KEY || env.FIREBASE_SERVICE_ACCOUNT_PATH || env.GOOGLE_APPLICATION_CREDENTIALS || await exists(path.join(root, 'backend/serviceAccountKey.json')) || await exists(path.join(root, 'serviceAccountKey.json'))),
    firebaseStorageConfigured: Boolean(env.FIREBASE_STORAGE_BUCKET || env.GCS_BUCKET),
    supabaseStorageConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    publicRecipientConfigured: Boolean(env.BACKUP_AGE_RECIPIENT),
    scopedTokenConfigured: Boolean(env.BACKUP_GH_TOKEN),
    checkedAt: new Date().toISOString()
  };
  if (report.postgresConfigured) {
    const raw = env.SUPABASE_DATABASE_URL || env.DATABASE_URL;
    const config = raw ? { connectionString: raw, ssl: /supabase\.(co|com)/.test(raw) ? { rejectUnauthorized: false } : undefined } : { host: env.DB_HOST, port: Number(env.DB_PORT || 5432), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME };
    const create = clientFactory || (options => new (require(path.join(root, 'backend/node_modules/pg')).Client)(options));
    const client = create({ ...config, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
    try {
      await client.connect();
      const version = await client.query('SHOW server_version_num');
      report.postgresMajor = Math.floor(Number(version.rows[0].server_version_num) / 10000);
      report.postgresReachable = true;
      const storage = await client.query("SELECT to_regclass('public.attachment_blobs') IS NOT NULL AS present");
      report.databaseAttachmentTablePresent = storage.rows[0].present;
    } catch { report.postgresReachable = false; report.databaseCheck = 'Unable to connect; credentials and endpoints were not logged'; }
    finally { await client.end().catch(() => {}); }
  }
  report.externalCoverage = report.firebaseCredentialsPresent || report.firebaseStorageConfigured ? 'Legacy Firebase requires confirmation or a separately verified export; PostgreSQL alone is not full coverage' : 'No configured legacy Firebase credentials found';
  return report;
}
async function prepare({ root = ROOT, base = '/home/attendoschool', env = process.env, parse, clientFactory }) {
  const state = path.join(base, '.attendoschool-backup-state'), dir = path.join(state, 'private');
  const configDir = state, config = path.join(configDir, 'backup.env');
  await fs.mkdir(dir, { recursive: true, mode: 0o700 }); await fs.chmod(state, 0o700); await fs.chmod(dir, 0o700);
  await fs.mkdir(configDir, { recursive: true, mode: 0o700 });
  let saved = {};
  try {
    const stat = await fs.lstat(config); if (!stat.isFile() || stat.isSymbolicLink() || (process.platform !== 'win32' && (stat.mode & 0o777) !== 0o600)) throw Error('Existing backup config must be a real mode-600 file');
    saved = parse(await fs.readFile(config));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    const lines = { BACKUP_DIR: dir, BACKUP_GITHUB_REPO: REPO, BACKUP_AGE_RECIPIENT: env.BACKUP_AGE_RECIPIENT || '', BACKUP_GH_TOKEN: '', BACKUP_RETENTION_DAYS: '14', BACKUP_MONTHLY_KEEP: '12', BACKUP_LOCAL_KEEP: '3', BACKUP_STORAGE_DISABLED: 'false', BACKUP_FIREBASE_CONFIRMED_UNUSED: 'false' };
    let raw = env.SUPABASE_DATABASE_URL || env.DATABASE_URL;
    if (raw) { try { const u = new URL(raw); if (u.hostname.endsWith('pooler.supabase.com') && u.port === '6543') u.port = '5432'; raw = u.toString(); } catch { raw = ''; } }
    if (raw) lines.BACKUP_DATABASE_URL = raw;
    await replacePrivate(config, '# Managed backup setup. Public recipient and repo-only token may be added later.\n' + Object.entries(lines).map(([k,v]) => `${k}=${quote(v)}`).join('\n') + '\n');
    saved = lines;
  }
  if (saved.BACKUP_DIR !== dir) throw Error('Existing backup directory differs; preserve it and review migration rather than overwriting settings');
  const runtime = path.join(state, 'tools/runtime.env');
  if (await fs.access(runtime).then(() => true, () => false)) {
    const content = await fs.readFile(config, 'utf8');
    const line = `source ${quote(runtime)}`;
    if (!content.split('\n').includes(line)) await replacePrivate(config, `${content.trimEnd()}\n${line}\n`);
  }
  for (const key of ['BACKUP_AGE_RECIPIENT', 'BACKUP_GH_TOKEN']) {
    if (!env[key]) continue; // Empty workflow secrets never erase a previously configured value.
    const current = await fs.readFile(config, 'utf8'), replacement = `${key}=${quote(env[key])}`;
    const pattern = new RegExp(`^${key}=.*$`, 'gm');
    const next = pattern.test(current) ? current.replace(pattern, () => replacement) : `${current.trimEnd()}\n${replacement}\n`;
    await replacePrivate(config, next); saved[key] = env[key];
  }
  const facts = await inspect({ ...env, ...saved }, root, clientFactory);
  if (facts.postgresMajor && await fs.access(`/usr/lib/postgresql/${facts.postgresMajor}/bin/pg_dump`).then(() => true, () => false)) {
    const current = await fs.readFile(config, 'utf8');
    const pgPath = `export PATH=${quote(`/usr/lib/postgresql/${facts.postgresMajor}/bin`)}:"$PATH"`;
    const cleaned = current.split('\n').filter(line => !/^export PATH=.*\/usr\/lib\/postgresql\//.test(line)).join('\n').trimEnd();
    await replacePrivate(config, `${cleaned}\n${pgPath}\n`);
  }
  const envFile = path.join(root, 'backend/.env');
  const original = await fs.readFile(envFile, 'utf8').catch(e => { if (e.code === 'ENOENT') return ''; throw e; });
  const updated = setEnv(setEnv(original, 'BACKUP_DIR', dir), 'BACKUP_AGE_RECIPIENT', saved.BACKUP_AGE_RECIPIENT || '');
  await replacePrivate(envFile, updated);
  const report = facts;
  report.backupRepository = REPO; report.state = report.publicRecipientConfigured && report.scopedTokenConfigured ? 'credentials_present_coverage_and_restore_still_require_verification' : 'paused_waiting_for_public_recipient_and_scoped_repo_token';
  report.privateKeyCreatedOnServer = false;
  await replacePrivate(path.join(state, 'setup-report.json'), JSON.stringify(report, null, 2) + '\n');
  return { report, config, state, cron: existing => cronText(existing, root, config, state) };
}
async function main(args) {
  const dotenv = require(path.join(ROOT, 'backend/node_modules/dotenv'));
  const env = { ...process.env };
  for (const file of env.NODE_ENV === 'test' ? [] : ['backend/.env', '.env']) {
    const content = await fs.readFile(path.join(ROOT, file)).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (content) for (const [k,v] of Object.entries(dotenv.parse(content))) if (env[k] === undefined) env[k] = v;
  }
  if (args[0] === 'inspect') console.log(JSON.stringify(await inspect(env), null, 2));
  else if (args[0] === 'prepare') {
    const result = await prepare({ env, parse: dotenv.parse });
    const { spawnSync } = require('node:child_process');
    const old = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
    if (!old.error) {
      const applied = spawnSync('crontab', ['-'], { input: result.cron(old.stdout || ''), encoding: 'utf8' });
      result.report.cronInstalled = applied.status === 0;
    } else result.report.cronInstalled = false;
    result.report.schedule = result.report.cronInstalled ? 'Daily user cron; GitHub Actions checks missed runs' : 'Daily GitHub Actions SSH schedule (host cron unavailable)';
    await replacePrivate(path.join(result.state, 'setup-report.json'), JSON.stringify(result.report, null, 2) + '\n');
    console.log(JSON.stringify(result.report, null, 2));
  } else if (args[0] === 'monitor') {
    const config = '/home/attendoschool/.attendoschool-backup-state/backup.env';
    const stat = await fs.lstat(config); if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600) throw Error('Unsafe backup config');
    const settings = { ...env, ...dotenv.parse(await fs.readFile(config)) };
    const outcome = await monitor(settings); console.log(JSON.stringify(outcome, null, 2));
    if (outcome.state === 'failed') process.exitCode = 1;
  } else throw Error('Usage: provision.cjs inspect | prepare | monitor');
}
async function monitor(env, now = Date.now()) {
  if (!env.BACKUP_AGE_RECIPIENT || !env.BACKUP_GH_TOKEN) return { state: 'paused', message: 'Encrypted off-server backups are waiting for the public recipient and scoped repo token; this is not active protection' };
  const { json } = require('./core.cjs');
  try {
    const last = await json(path.join(env.BACKUP_DIR, 'last-published.json'));
    const age = now - Date.parse(last.at);
    if (last.encrypted !== true || !Number.isFinite(age) || age < -300000 || age > 36 * 3600000 || last.warnings?.some(w => w.includes('Uploads skipped'))) throw Error();
    return { state: 'healthy', lastEncryptedReleaseAt: last.at };
  } catch { return { state: 'failed', message: 'No complete encrypted release recorded in the last 36 hours. Check backup cron, worker, disk, database and token expiry.' }; }
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { const code = /^[A-Z0-9_]+$/.test(e.code || '') ? e.code : 'SETUP_ERROR'; console.error(`Backup provisioning failed (${code}); no secrets were printed. Inspect private server configuration and permissions.`); process.exitCode = 1; });
module.exports = { inspect, prepare, cronText, setEnv, monitor };
