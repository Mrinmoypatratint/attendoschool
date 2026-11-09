'use strict';
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
async function readEnvironment(file) {
  const result = {};
  for (const line of (await fs.readFile(file, 'utf8')).split('\n').filter(Boolean)) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!m || m[1].startsWith('BACKUP_') || ['GH_TOKEN', 'GITHUB_TOKEN'].includes(m[1])) throw Error('Invalid runtime.env entry');
    const value = JSON.parse(m[2]); if (typeof value !== 'string') throw Error('Invalid environment value'); result[m[1]] = value;
  }
  return result;
}
async function main(args) {
  if (args.length < 2) throw Error('Usage: load-env.cjs restored/runtime.env COMMAND [ARG...]');
  const env = { ...process.env, ...await readEnvironment(args[0]) };
  const child = spawn(args[1], args.slice(2), { env, stdio: 'inherit', windowsHide: true });
  return new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => { process.exitCode = code ?? 1; resolve(); }); });
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { readEnvironment, main };
