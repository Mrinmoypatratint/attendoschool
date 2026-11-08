'use strict';
const fs = require('node:fs/promises');
const sync = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { command, hash, ID, TAG, log } = require('./core.cjs');
process.umask(0o077);
const CONTENTS = ['database.dump', 'config.tar', 'uploads.tar', 'README.txt', 'coverage.json', 'SHA256SUMS'];
async function extractVerified(tar, dest, env) {
  const listing = String(await command('tar', ['-tf', tar], env)).trim().split(/\r?\n/);
  const verbose = String(await command('tar', ['-tvf', tar], env)).trim().split(/\r?\n/);
  const seen = new Set();
  for (const name of listing) {
    if (name === './' || name === '.') continue;
    const clean = name.replace(/^\.\//, '');
    if (!CONTENTS.includes(clean) || seen.has(clean)) throw Error('Unsafe or duplicate archive member');
    seen.add(clean);
  }
  if (verbose.some(line => !['-', 'd'].includes(line[0]))) throw Error('Archive links/special files are forbidden');
  if (CONTENTS.filter(n => n !== 'uploads.tar').some(n => !seen.has(n))) throw Error('Backup is missing required files');
  await command('tar', ['-xf', tar, '-C', dest], env);
  const checks = (await fs.readFile(path.join(dest, 'SHA256SUMS'), 'utf8')).trim().split('\n');
  const checked = new Set();
  for (const line of checks) {
    const m = line.match(/^([a-f0-9]{64})  ([A-Za-z0-9.]+)$/);
    if (!m || !seen.has(m[2]) || m[2] === 'SHA256SUMS' || checked.has(m[2])) throw Error('Invalid SHA256SUMS');
    if (await hash(path.join(dest, m[2])) !== m[1]) throw Error(`Checksum failed: ${m[2]}`);
    checked.add(m[2]);
  }
  if (checked.size !== seen.size - 1) throw Error('Archive has unchecked files');
  const dump = await fs.open(path.join(dest, 'database.dump'), 'r');
  const magic = Buffer.alloc(5); try { await dump.read(magic, 0, 5, 0); } finally { await dump.close(); }
  if (!magic.equals(Buffer.from('PGDMP'))) throw Error('Invalid PostgreSQL dump');
}
async function restore(args, env = process.env, run = command) {
  const local = args[0] === '--file';
  if ((local && args.length !== 3) || (!local && (args.length < 2 || args.length > 3))) throw Error('Usage: restore.sh owner/backups-repo age-key-file [tag] OR restore.sh --file backup.tar.age age-key-file');
  const key = path.resolve(local ? args[2] : args[1]);
  const keyStat = await fs.lstat(key); if (!keyStat.isFile() || keyStat.isSymbolicLink()) throw Error('Invalid private key file');
  const dir = await fs.mkdtemp(path.join(process.cwd(), 'attendoschool-restore-')); await fs.chmod(dir, 0o700);
  const download = path.join(dir, 'download'); await fs.mkdir(download);
  try {
    let encrypted;
    if (local) encrypted = path.resolve(args[1]);
    else {
      const repo = args[0]; if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || repo.toLowerCase() === 'mrinmoypatratint/attendoschool') throw Error('Use the separate private backup repository');
      const ghEnv = { ...env, GH_TOKEN: env.BACKUP_GH_TOKEN || env.GH_TOKEN };
      const meta = JSON.parse(String(await run('gh', ['api', `repos/${repo}`], ghEnv))); if (meta.private !== true) throw Error('Backup repository must be private');
      const tag = args[2]; if (tag && !TAG.test(tag)) throw Error('Invalid backup release tag');
      await run('gh', ['release', 'download', ...(tag ? [tag] : []), '--repo', repo, '--dir', download], ghEnv);
      const names = (await fs.readdir(download)).sort();
      if (!names.length) throw Error('Release has no backup files');
      const full = names.filter(n => n.endsWith('.tar.age') && ID.test(n.slice(0, -8)));
      if (full.length === 1 && names.length === 1) encrypted = path.join(download, full[0]);
      else {
        const m = names[0].match(/^(attendoschool-backup-\d{8}-\d{6}-[a-f0-9]{8}\.tar\.age)\.part-00000$/);
        if (!m || names.some((name, i) => name !== `${m[1]}.part-${String(i).padStart(5, '0')}`)) throw Error('Missing, mixed or unordered encrypted backup parts');
        encrypted = path.join(dir, m[1]);
        for (const name of names) await pipeline(sync.createReadStream(path.join(download, name)), sync.createWriteStream(encrypted, { flags: 'a', mode: 0o600 }));
      }
    }
    const tar = path.join(dir, 'decrypted.tar');
    await command('age', ['-d', '-i', key, '-o', tar, encrypted], env);
    const extracted = path.join(dir, 'extracted'); await fs.mkdir(extracted);
    await extractVerified(tar, extracted, env);
    await fs.rm(tar); await fs.rm(download, { recursive: true, force: true });
    log(`Checksums OK. Extracted to ${extracted}`);
    console.log(`No database was changed.\ncd '${extracted.replace(/'/g, "'\\''")}'\npg_restore --list database.dump\ncreatedb attendoschool_restore\npg_restore --exit-on-error --no-owner --no-privileges -d attendoschool_restore database.dump\nmkdir -m 700 config files\ntar -xf config.tar -C config\n# If uploads.tar exists: tar -xf uploads.tar -C files\n# Read README.txt and docs/backup.md before restoring configuration or starting the app.\n# In your code checkout: npm --prefix backend ci && npm --prefix backend run build\n# Build frontend, review restored backend/.env, then: pm2 start ecosystem.config.cjs --env production`);
    return extracted;
  } catch (e) { await fs.rm(dir, { recursive: true, force: true }); throw e; }
}
if (require.main === module) restore(process.argv.slice(2)).catch(e => { log(`ERROR: ${e.message}`); process.exitCode = 1; });
module.exports = { restore, extractVerified };
