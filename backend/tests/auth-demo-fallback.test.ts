/**
 * Regression test: demo login fallback must not mint tokens for arbitrary passwords in production.
 * Fails on the pre-fix code (any password >= 4 chars was accepted, accounts were synthesised).
 * Real handlers; SQL disabled; Firestore stubbed off. No network, no mail.
 * Run: npx tsx tests/auth-demo-fallback.test.ts
 */
import { setProbeEnabled } from './helpers/rbacProbeHarness';
import assert from 'assert';
import http from 'http';
import { AddressInfo } from 'net';

let passed = 0; let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  [PASS] ${name}`); }
  catch (e: any) { failed++; console.error(`  [FAIL] ${name}\n         ${e?.message}`); }
}

async function main() {
  setProbeEnabled(false);
  const firebase = await import('../src/firebase');
  (firebase as any).isFirebaseConfigured = () => false; // never query live Firestore
  const app = (await import('../src/app')).default;
  const { getAllDemoUsers } = await import('../src/store/demoUsers');
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  const login = async (body: any) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(body),
    });
    const data: any = await res.json().catch(() => ({}));
    return { status: res.status, token: data.token as string | undefined, role: data.user?.role };
  };
  const sa = getAllDemoUsers().find((u: any) => u.role === 'SUPER_ADMIN')!;
  const withEnv = async (envName: string, fn: () => Promise<void>) => {
    const prev = process.env.NODE_ENV; process.env.NODE_ENV = envName;
    try { await fn(); } finally { process.env.NODE_ENV = prev; }
  };

  console.log('\n== production ==');
  await withEnv('production', async () => {
    await test('demo SUPER_ADMIN with a wrong password is rejected', async () => {
      const r = await login({ email: sa.email, password: 'wrong-pass-123' });
      assert.strictEqual(r.status, 401); assert.ok(!r.token);
    });
    await test('demo SUPER_ADMIN with its exact password still signs in', async () => {
      const r = await login({ email: sa.email, password: sa.password });
      assert.strictEqual(r.status, 200); assert.strictEqual(r.role, 'SUPER_ADMIN');
    });
    await test('unknown e-mail as SCHOOL_ADMIN is not synthesised', async () => {
      const r = await login({ email: 'nobody@example.org', password: 'whatever1', role: 'SCHOOL_ADMIN' });
      assert.strictEqual(r.status, 401); assert.ok(!r.token);
    });
    await test('unknown TEACHER / STUDENT identifiers are not synthesised', async () => {
      assert.strictEqual((await login({ email: 'ghost-teacher@example.org', password: 'whatever1', role: 'TEACHER' })).status, 401);
      assert.strictEqual((await login({ admissionNumber: 'ADM-NOPE-1', password: 'whatever1', role: 'STUDENT', instituteId: '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3' })).status, 401);
    });
    await test('common demo passwords are not accepted for a demo account with a different password', async () => {
      const r = await login({ email: sa.email, password: 'password' });
      assert.strictEqual(r.status, 401);
    });
  });

  console.log('\n== development (demo conveniences kept) ==');
  await withEnv('development', async () => {
    await test('development still synthesises demo accounts', async () => {
      const r = await login({ email: 'dev-admin@example.org', password: 'whatever1', role: 'SCHOOL_ADMIN' });
      assert.strictEqual(r.status, 200);
    });
  });

  server.close();
  console.log(`\n[auth-demo-fallback] ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
