'use strict';
// Called only through flock. stdin is unused; payload contains actor/ID, no secrets.
const { BackupManager } = require('./core.cjs');
async function main(action, encoded, env = process.env) {
  if (!['enqueue', 'recover', 'claim', 'release'].includes(action)) throw Error('Invalid backup control action');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
  return new BackupManager(env)[`_${action}`](payload);
}
if (require.main === module) main(process.argv[2], process.argv[3]).then(value => {
  process.stdout.write(JSON.stringify({ value: value ?? null }));
}).catch(e => { process.stdout.write(JSON.stringify({ error: e.message, status: e.status, code: e.code })); });
module.exports = { main };
