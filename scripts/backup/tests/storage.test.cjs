const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fixture } = require('./fake-tools.cjs');
const { storageExport } = require('../core.cjs');
test('Supabase export paginates, walks folders, streams files, enforces cap and rejects traversal', async t => {
  const { env, dir } = await fixture(t); let mode = 'normal', pages = 0;
  const server = http.createServer(async (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer fixture-key');
    const body = []; for await (const chunk of req) body.push(chunk);
    res.setHeader('content-type', 'application/json');
    if (req.url === '/storage/v1/bucket') return res.end('[{"id":"assignment-submissions"}]');
    if (req.url.includes('/object/list/')) {
      const data = JSON.parse(Buffer.concat(body).toString()); pages++;
      if (mode === 'unsafe') return res.end('[{"id":"evil","name":"../escape"}]');
      if (data.prefix === 'folder') return res.end('[{"id":"pdf-id","name":"file.pdf"}]');
      if (data.offset === 0) return res.end(JSON.stringify([{ name: 'folder', id: null }, ...Array.from({ length: 99 }, (_, i) => ({ id: `id-${i}`, name: `image-${i}.png` }))]));
      return res.end('[]');
    }
    if (req.url.includes('/object/authenticated/')) return res.end('fixture-file');
    res.statusCode = 404; res.end();
  }).listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`; env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-key';
  const dest = path.join(dir, 'storage'); const result = await storageExport(env, dest, 100000);
  assert.equal(result.bytes, 100 * 'fixture-file'.length); assert.ok(pages >= 3);
  assert.equal(await fs.readFile(path.join(dest, 'objects/assignment-submissions/folder/file.pdf'), 'utf8'), 'fixture-file');
  await assert.rejects(storageExport(env, path.join(dir, 'over-limit'), 1), /UPLOAD_LIMIT/);
  mode = 'unsafe'; await assert.rejects(storageExport(env, path.join(dir, 'unsafe'), 1000), /Unsafe/);
});
