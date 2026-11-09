/**
 * RBAC BASELINE (P0) — R1 backward-compatibility guard.
 *
 * For every route registered in app.ts (including alias mounts) and every principal
 * (anonymous, each base role, and a second-school admin), records whether the existing
 * middleware chain ALLOWs the request or denies it (401/403/other).
 *
 * The snapshot in tests/fixtures/rbac-baseline.snapshot.json is the contract: it was
 * captured before any RBAC change and MUST stay identical after every later phase while
 * RBAC tables are empty / enforcement is off.
 *
 * Run:    npx tsx tests/rbac-baseline.test.ts
 * Update: npx tsx tests/rbac-baseline.test.ts --update   (only with owner approval)
 *
 * Side-effect free: see tests/helpers/rbacProbeHarness.ts.
 */
import {
  PROBE_HEADER, PRINCIPALS, collectRoutes, concretePath, classify
} from './helpers/rbacProbeHarness';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { AddressInfo } from 'net';

// Keep-alive agent: thousands of sequential requests must not exhaust client ports (EADDRINUSE on Windows).
const agent = new http.Agent({ keepAlive: true, maxSockets: 4 });
function request(url: string, method: string, headers: Record<string, string>, body?: string): Promise<{ status: number; probe: string | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const h = body ? { ...headers, 'Content-Length': String(Buffer.byteLength(body)) } : headers;
    const req = http.request(url, { method, headers: h, agent, timeout: 15000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 0, probe: res.headers[PROBE_HEADER] as string | undefined, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const SNAPSHOT = path.resolve(__dirname, 'fixtures/rbac-baseline.snapshot.json');
/** Reviewed, intentional deviations from the frozen P0 snapshot (P6 security fixes only). */
const APPROVED = path.resolve(__dirname, 'fixtures/rbac-baseline.approved-changes.json');
const UPDATE = process.argv.includes('--update');
const MODE = (process.argv.find((a) => a.startsWith('--mode=')) || '--mode=shadow').slice(7);
process.env.RBAC_ENFORCEMENT = MODE;

async function main() {
  // Loaded only after the harness has isolated env and patched Route.
  const jwt = (await import('jsonwebtoken')).default;
  const app = (await import('../src/app')).default;
  const secret = process.env.JWT_SECRET as string;

  const tokens: Record<string, string | null> = {};
  for (const p of PRINCIPALS) tokens[p.key] = p.user ? jwt.sign(p.user, secret, { expiresIn: '1h' }) : null;

  const routes = collectRoutes();
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;

  const results: Record<string, Record<string, string>> = {};
  const seen = new Set<string>();
  for (const rt of routes) {
    const key = `${rt.method} ${rt.fullPath}`;
    if (seen.has(key)) continue; // first registration wins in Express; duplicates are shadowed
    seen.add(key);
    const url = `http://127.0.0.1:${port}${concretePath(rt.fullPath)}`;
    const row: Record<string, string> = {};
    for (const p of PRINCIPALS) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokens[p.key]) headers.Authorization = `Bearer ${tokens[p.key]}`;
      let outcome = 'ERROR';
      try {
        const send = () => request(url, rt.method, headers, ['GET', 'HEAD'].includes(rt.method) ? undefined : '{}');
        // Handlers are stubbed (no side effects), so retrying a keep-alive socket reset is safe.
        const res = await send().catch((e: any) => (e?.code === 'ECONNRESET' ? send() : Promise.reject(e)));
        outcome = classify(res.status, res.probe === 'HANDLER_REACHED');
        if (outcome === 'ALLOW') {
          // Make sure the probe that answered belongs to THIS route (not a shadowing one).
          let body: any = {};
          try { body = JSON.parse(res.body); } catch { /* ignore */ }
          if (body?.route && body.route !== rt.routeKey) outcome = `SHADOWED_BY ${body.route}`;
        }
      } catch (e: any) {
        outcome = `ERROR ${e?.name || 'unknown'}`;
        if (process.env.RBAC_BASELINE_DEBUG) console.error('[debug]', key, p.key, e?.cause?.code || e?.cause?.message || e?.message);
      }
      row[p.key] = outcome;
    }
    results[key] = row;
  }
  agent.destroy();
  server.close();

  const sorted = Object.fromEntries(Object.keys(results).sort().map((k) => [k, results[k]]));
  const summary = { routes: Object.keys(sorted).length, principals: PRINCIPALS.map((p) => p.key) };

  if (UPDATE || !fs.existsSync(SNAPSHOT)) {
    fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
    fs.writeFileSync(SNAPSHOT, JSON.stringify({ summary, results: sorted }, null, 2) + '\n');
    console.log(`[rbac-baseline] Snapshot written: ${summary.routes} route keys x ${PRINCIPALS.length} principals`);
    process.exit(0);
  }

  if (process.env.RBAC_BASELINE_DUMP) fs.writeFileSync(process.env.RBAC_BASELINE_DUMP, JSON.stringify(sorted, null, 2));
  const expected = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')).results as Record<string, Record<string, string>>;
  if (fs.existsSync(APPROVED)) {
    const file = JSON.parse(fs.readFileSync(APPROVED, 'utf8'));
    const changes = file.changes as Record<string, { reason: string; principals: Record<string, string> }>;
    for (const [k, v] of Object.entries(changes)) {
      if (!expected[k]) throw new Error(`approved change for unknown route ${k}`);
      expected[k] = { ...expected[k], ...v.principals };
    }
    const additions = file.additions as Record<string, { reason: string; principals: Record<string, string> }>;
    for (const [k, v] of Object.entries(additions || {})) {
      if (expected[k]) throw new Error(`approved addition already in baseline ${k}`);
      expected[k] = v.principals;
    }
  }
  let passed = 0;
  const failures: string[] = [];
  const allKeys = new Set([...Object.keys(expected), ...Object.keys(sorted)]);
  for (const k of [...allKeys].sort()) {
    const exp = expected[k];
    const got = sorted[k];
    if (!exp) { failures.push(`NEW ROUTE (not in baseline): ${k} -> ${JSON.stringify(got)}`); continue; }
    if (!got) { failures.push(`ROUTE REMOVED: ${k}`); continue; }
    for (const p of PRINCIPALS) {
      if (exp[p.key] === got[p.key]) passed++;
      else failures.push(`${k} [${p.key}] expected ${exp[p.key]} got ${got[p.key]}`);
    }
  }
  console.log(`[rbac-baseline mode=${MODE}] ${passed} checks passed, ${failures.length} failed (${allKeys.size} route keys)`);
  for (const f of failures.slice(0, 200)) console.error('  [FAIL] ' + f);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error('[rbac-baseline] crashed:', e?.message || e); process.exit(1); });
