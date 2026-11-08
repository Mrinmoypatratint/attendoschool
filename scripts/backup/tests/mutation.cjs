'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
async function main() {
  const tmp = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'backup-mutation-'));
  try {
    const source = await fs.readFile(path.join(__dirname, '../core.cjs'), 'utf8');
    const broken = source.replace("return !(date.getUTCDate() === 1 && +date >= monthCutoff);", 'return true; // deliberately broken monthly retention');
    if (broken === source) throw Error('Mutation did not apply');
    const file = path.join(tmp, 'core.cjs'); await fs.writeFile(file, broken);
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join(__dirname, 'retention.test.cjs')], { env: { ...process.env, BACKUP_CORE_UNDER_TEST: file }, encoding: 'utf8' });
    if (result.status === 0 || !result.stdout.includes('not ok')) throw Error('Broken retention escaped its test');
    console.log('PASS: deliberately broken monthly retention was caught (expected failing test). Original code unchanged.');
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
