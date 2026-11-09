/**
 * P6 regression tests for the three authorization holes (test group 16).
 * Each test FAILS on the pre-fix code and PASSES after the fix (verified by running against
 * `git stash` of the fixed files — see docs/rbac/ROLLOUT.md).
 *
 * Real handlers run; SQL is a fake in-process pool (disposable fixtures). No network, no mail.
 * Run: npx tsx tests/rbac-security-fixes.test.ts
 */
import { setProbeEnabled, SCHOOL_A, SCHOOL_B } from './helpers/rbacProbeHarness';
import assert from 'assert';
import http from 'http';
import { AddressInfo } from 'net';

let passed = 0; let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  [PASS] ${name}`); }
  catch (e: any) { failed++; console.error(`  [FAIL] ${name}\n         ${e?.message}`); }
}

// --- Fake SQL fixtures ---------------------------------------------------
const USERS = [
  { id: 'p-a', email: 'pa@t', name: 'Parent A', role: 'PARENT', school_id: SCHOOL_A },
  { id: 'p-b', email: 'pb@t', name: 'Parent B', role: 'PARENT', school_id: SCHOOL_B },
];
const STUDENTS = [{ id: 's-a', school_id: SCHOOL_A }, { id: 's-b', school_id: SCHOOL_B }];
const LINKS: any[] = [];
async function fakeQuery(text: string, params: any[] = []) {
  const sql = String(text).replace(/\s+/g, ' ');
  if (/FROM users u LEFT JOIN parent_student_links/.test(sql)) {
    const rows = USERS.filter((u) => u.role === 'PARENT' && (!/school_id::text=\$1/.test(sql) || u.school_id === params[0]));
    return { rows: rows.map((u) => ({ ...u, children: 0 })), rowCount: rows.length };
  }
  if (/SELECT 1 FROM users WHERE id::text=\$1 AND role='PARENT' AND school_id::text=\$2/.test(sql)) {
    const n = USERS.filter((u) => u.id === params[0] && u.role === 'PARENT' && u.school_id === params[1]).length;
    return { rows: n ? [{ '?column?': 1 }] : [], rowCount: n };
  }
  if (/SELECT 1 FROM students WHERE id::text=\$1 AND school_id::text=\$2/.test(sql)) {
    const n = STUDENTS.filter((s) => s.id === params[0] && s.school_id === params[1]).length;
    return { rows: n ? [{ '?column?': 1 }] : [], rowCount: n };
  }
  if (/INSERT INTO parent_student_links/.test(sql)) {
    const row = { parent_user_id: params[0], student_id: params[1], relationship: params[2], school_id: params[3] ?? null };
    LINKS.push(row);
    return { rows: [row], rowCount: 1 };
  }
  if (/FROM job_runs/.test(sql)) return { rows: [{ id: 'job-1', job: 'backup', status: 'OK' }], rowCount: 1 };
  return { rows: [], rowCount: 0 };
}

async function main() {
  setProbeEnabled(false); // real handlers everywhere
  const db = await import('../src/db');
  (db.pool as any).query = fakeQuery;
  (db.pool as any).connect = async () => ({ query: fakeQuery, release: () => undefined });
  const jwt = (await import('jsonwebtoken')).default;
  const app = (await import('../src/app')).default;
  const secret = process.env.JWT_SECRET as string;
  const U = {
    SA: { id: 'sa-1', schoolId: null, name: 'SA', email: 'sa@t', role: 'SUPER_ADMIN' },
    ADM_A: { id: 'adm-a', schoolId: SCHOOL_A, name: 'A', email: 'a@t', role: 'SCHOOL_ADMIN' },
    TCH_A: { id: 'tch-a', schoolId: SCHOOL_A, name: 'T', email: 't@t', role: 'TEACHER' },
    STU_A: { id: 'stu-a', schoolId: SCHOOL_A, name: 'S', email: 's@t', role: 'STUDENT' },
    PAR_A: { id: 'par-a', schoolId: SCHOOL_A, name: 'P', email: 'p@t', role: 'PARENT' },
  };
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  const call = async (method: string, p: string, user: any | null, body?: any) => {
    const res = await fetch(`http://127.0.0.1:${port}${p}`, {
      method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign(user, secret)}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: any = text; try { parsed = JSON.parse(text); } catch { /* text */ }
    return { status: res.status, body: parsed };
  };

  console.log('\n== Bug 1: teacher-leave approve/reject had no admin role check ==');
  await test('TEACHER / STUDENT / PARENT get 403 on teacher-leave approve and reject', async () => {
    for (const u of [U.TCH_A, U.STU_A, U.PAR_A]) for (const action of ['approve', 'reject']) {
      const r = await call('PUT', `/api/reviews/teacher-leaves/leave-x/${action}`, u, { notes: 'x' });
      assert.strictEqual(r.status, 403, `${u.role} ${action} → ${r.status}`);
    }
  });
  await test('SCHOOL_ADMIN still reaches the handler (404 for an unknown leave, not 403)', async () => {
    const r = await call('PUT', '/api/reviews/teacher-leaves/leave-x/approve', U.ADM_A, { notes: 'x' });
    assert.strictEqual(r.status, 404);
  });

  console.log('\n== Bug 2: parent onboarding list/link had no school scoping ==');
  await test('school admin lists only parents of their own school', async () => {
    const r = await call('GET', '/api/parent-onboarding', U.ADM_A);
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.map((x: any) => x.id), ['p-a']);
  });
  await test('cannot link a parent of another school, or a student of another school', async () => {
    const a = await call('POST', '/api/parent-onboarding/p-b/link', U.ADM_A, { studentId: 's-a' });
    assert.strictEqual(a.status, 404, `foreign parent → ${a.status}`);
    const b = await call('POST', '/api/parent-onboarding/p-a/link', U.ADM_A, { studentId: 's-b' });
    assert.strictEqual(b.status, 404, `foreign student → ${b.status}`);
    assert.strictEqual(LINKS.length, 0, 'no link row written');
  });
  await test('same-school link still works and records the school', async () => {
    const r = await call('POST', '/api/parent-onboarding/p-a/link', U.ADM_A, { studentId: 's-a' });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(LINKS.at(-1).school_id, SCHOOL_A);
  });

  console.log('\n== Bug 3: /api/production/jobs never authenticated ==');
  await test('anonymous → 401, non-super-admin → 403, SUPER_ADMIN → 200', async () => {
    assert.strictEqual((await call('GET', '/api/production/jobs', null)).status, 401);
    assert.strictEqual((await call('GET', '/api/production/jobs', U.ADM_A)).status, 403);
    const ok = await call('GET', '/api/production/jobs', U.SA);
    assert.strictEqual(ok.status, 200, `SUPER_ADMIN → ${ok.status}`);
    assert.strictEqual((await call('GET', '/api/production-v26/jobs', U.SA)).status, 200);
  });

  server.close();
  console.log(`\n[rbac-security-fixes] ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('[rbac-security-fixes] crashed:', e?.stack || e); process.exit(1); });
