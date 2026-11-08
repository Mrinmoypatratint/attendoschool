/**
 * RBAC integration tests (P2–P5): real Express app + real middleware chain + real /api/access and
 * /api/super-admin/features handlers, legacy route handlers stubbed by the probe harness, in-memory
 * RBAC store/directory. No DB, no network, no mail.
 *
 * Run: npx tsx tests/rbac-enforcement.test.ts
 *
 * Covers test groups 1–14 of the RBAC brief (group 15 = Playwright, group 16 = rbac-security-fixes).
 */
import { setProbeEnabled, collectRoutes, concretePath, PROBE_HEADER, SCHOOL_A, SCHOOL_B } from './helpers/rbacProbeHarness';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { AddressInfo } from 'net';
import { MemoryAccessStore, MemoryDirectory } from './helpers/memoryAccessStore';

let passed = 0; let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  [PASS] ${name}`); }
  catch (e: any) { failed++; console.error(`  [FAIL] ${name}\n         ${e?.message}`); }
}

async function main() {
  // Real handlers for the RBAC routers and health; everything else stubbed.
  setProbeEnabled(false);
  const firebase = await import('../src/firebase');
  (firebase as any).checkFirestoreHealth = async () => ({ ok: false }); // never touch Firestore
  await import('../src/routes/access');
  await import('../src/routes/superAdminFeatures');
  await import('../src/routes/health');
  setProbeEnabled(true);
  const jwt = (await import('jsonwebtoken')).default;
  const app = (await import('../src/app')).default;
  const { setAccessStore, SqlAccessStore } = await import('../src/rbac/accessStore');
  const { setPrincipalDirectory } = await import('../src/rbac/principalDirectory');
  const { invalidateAll } = await import('../src/rbac/accessService');
  const { findRouteBinding, getPermission, featureDependents } = await import('../src/rbac/catalog');
  const { loginAccountGate } = await import('../src/rbac/middleware');

  const secret = process.env.JWT_SECRET as string;
  const U = {
    SA: { id: 'sa-1', schoolId: null, name: 'SA', email: 'sa@t', role: 'SUPER_ADMIN' },
    ADM_A: { id: 'adm-a', schoolId: SCHOOL_A, name: 'Owner A', email: 'a@t', role: 'SCHOOL_ADMIN' },
    ADM_A2: { id: 'adm-a2', schoolId: SCHOOL_A, name: 'Admin A2', email: 'a2@t', role: 'SCHOOL_ADMIN' },
    ADM_A3: { id: 'adm-a3', schoolId: SCHOOL_A, name: 'Admin A3', email: 'a3@t', role: 'SCHOOL_ADMIN' },
    TCH_A: { id: 'tch-a', schoolId: SCHOOL_A, name: 'Teacher A', email: 't@t', role: 'TEACHER' },
    TCH_A2: { id: 'tch-a2', schoolId: SCHOOL_A, name: 'Teacher A2', email: 't2@t', role: 'TEACHER' },
    STU_A: { id: 'stu-u-a', schoolId: SCHOOL_A, name: 'Student A', email: 's@t', role: 'STUDENT', studentId: 'stu-a' },
    PAR_A: { id: 'par-a', schoolId: SCHOOL_A, name: 'Parent A', email: 'p@t', role: 'PARENT' },
    ADM_B: { id: 'adm-b', schoolId: SCHOOL_B, name: 'Admin B', email: 'b@t', role: 'SCHOOL_ADMIN' },
    TCH_B: { id: 'tch-b', schoolId: SCHOOL_B, name: 'Teacher B', email: 'tb@t', role: 'TEACHER' },
  };
  const tok = (u: any) => jwt.sign(u, secret, { expiresIn: '1h' });

  let store: MemoryAccessStore;
  const dir = new MemoryDirectory();
  dir.add(SCHOOL_A, 'SCHOOL_ADMIN', 'adm-a', 'Owner A', '2025-01-01T00:00:00Z');
  dir.add(SCHOOL_A, 'SCHOOL_ADMIN', 'adm-a2', 'Admin A2', '2025-02-01T00:00:00Z');
  dir.add(SCHOOL_A, 'SCHOOL_ADMIN', 'adm-a3', 'Admin A3', '2025-03-01T00:00:00Z');
  dir.add(SCHOOL_A, 'TEACHER', 'tch-a'); dir.add(SCHOOL_A, 'TEACHER', 'tch-a2');
  dir.add(SCHOOL_A, 'STUDENT', 'stu-u-a'); dir.add(SCHOOL_A, 'PARENT', 'par-a');
  dir.add(SCHOOL_B, 'SCHOOL_ADMIN', 'adm-b', 'Admin B', '2025-01-01T00:00:00Z'); dir.add(SCHOOL_B, 'TEACHER', 'tch-b');
  setPrincipalDirectory(dir);
  const fresh = () => {
    store = new MemoryAccessStore();
    store.state.plans = [{ planKey: 'plan-basic', name: 'Basic', isActive: true }, { planKey: 'plan-pro', name: 'Pro', isActive: true }];
    store.state.subscriptions = { [SCHOOL_A]: 'plan-basic', [SCHOOL_B]: 'plan-pro' };
    setAccessStore(store);
    invalidateAll();
  };
  const mode = (m: string) => { process.env.RBAC_ENFORCEMENT = m; };

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  const agent = new http.Agent({ keepAlive: true, maxSockets: 4 });
  type Res = { status: number; probe: boolean; body: any };
  const call = (method: string, p: string, user: any | null, body?: any): Promise<Res> => new Promise((resolve, reject) => {
    const payload = body === undefined ? (['GET', 'DELETE'].includes(method) ? undefined : '{}') : JSON.stringify(body);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = `Bearer ${tok(user)}`;
    if (payload) headers['Content-Length'] = String(Buffer.byteLength(payload));
    const send = (retry: boolean) => {
      const req = http.request(`http://127.0.0.1:${port}${p}`, { method, headers, agent }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed: any = text; try { parsed = JSON.parse(text); } catch { /* text */ }
          resolve({ status: res.statusCode || 0, probe: res.headers[PROBE_HEADER] === 'HANDLER_REACHED', body: parsed });
        });
      });
      req.on('error', (e: any) => (retry && e?.code === 'ECONNRESET' ? send(false) : reject(e)));
      if (payload) req.write(payload);
      req.end();
    };
    send(true);
  });
  const allowed = (r: Res) => r.probe && r.status === 200;

  // Expected legacy outcomes (frozen P0 snapshot + reviewed changes)
  const snap = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/rbac-baseline.snapshot.json'), 'utf8')).results;
  const approved = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/rbac-baseline.approved-changes.json'), 'utf8'));
  const expected: Record<string, Record<string, string>> = { ...snap };
  for (const [k, v] of Object.entries<any>(approved.changes)) expected[k] = { ...expected[k], ...v.principals };
  for (const [k, v] of Object.entries<any>(approved.additions)) expected[k] = v.principals;
  const routes = collectRoutes().filter((r, i, a) => a.findIndex((x) => x.method === r.method && x.fullPath === r.fullPath) === i);

  const routesOfFeatures = (features: string[], role: string) => routes.filter((rt) => {
    const b = findRouteBinding(rt.method, rt.fullPath);
    if (!b?.permission || !features.includes(b.feature!)) return false;
    return getPermission(b.permission)!.ceilingRoles.includes(role as any) && expected[`${rt.method} ${rt.fullPath}`]?.[role] === 'ALLOW';
  });

  // =====================================================================
  console.log('\n== 1. R1: empty RBAC tables ⇒ identical to legacy (enforce mode, every route × role) ==');
  fresh(); mode('enforce');
  await test('every route × principal matches the baseline with an empty (READY) store', async () => {
    const P: Record<string, any> = { ANON: null, SUPER_ADMIN: U.SA, SCHOOL_ADMIN: U.ADM_A, TEACHER: U.TCH_A, STUDENT: U.STU_A, PARENT: U.PAR_A, SCHOOL_ADMIN_B: U.ADM_B };
    const diffs: string[] = [];
    for (const rt of routes) {
      if (/^\/api\/(access|super-admin\/features|health)(\/|$)/.test(rt.fullPath)) continue; // real handlers here (health is covered by rbac-baseline)
      const k = `${rt.method} ${rt.fullPath}`;
      for (const [pk, user] of Object.entries(P)) {
        const r = await call(rt.method, concretePath(rt.fullPath), user);
        const got = r.probe ? 'ALLOW' : r.status === 401 ? 'DENY_401' : r.status === 403 ? 'DENY_403' : `MW_${r.status}`;
        if (got !== expected[k][pk]) diffs.push(`${k} ${pk}: ${expected[k][pk]} → ${got}`);
      }
    }
    assert.deepStrictEqual(diffs.slice(0, 10), [], diffs.slice(0, 10).join(' | '));
  });

  // =====================================================================
  console.log('\n== 2/3. Feature switches (global / plan / school) incl. dependents ==');
  const attendanceFamily = ['attendance', ...featureDependents('attendance')];
  await test('global kill switch OFF ⇒ 403 FEATURE_DISABLED on every attendance(+dependent) route for TEACHER and SCHOOL_ADMIN', async () => {
    fresh(); mode('enforce');
    const r = await call('PUT', '/api/super-admin/features/global', U.SA, { changes: [{ feature: 'attendance', enabled: false }], reason: 'incident', confirm: true });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    for (const role of ['TEACHER', 'SCHOOL_ADMIN']) {
      const list = routesOfFeatures(attendanceFamily, role);
      assert.ok(list.length > 5, `routes for ${role}`);
      for (const rt of list) {
        const res = await call(rt.method, concretePath(rt.fullPath), role === 'TEACHER' ? U.TCH_A : U.ADM_A);
        assert.strictEqual(res.status, 403, `${rt.method} ${rt.fullPath} ${role}`);
        assert.strictEqual(res.body.code, 'FEATURE_DISABLED');
      }
    }
    const back = await call('PUT', '/api/super-admin/features/global', U.SA, { changes: [{ feature: 'attendance', enabled: true }], reason: 'resolved', confirm: true });
    assert.strictEqual(back.status, 200);
    for (const rt of routesOfFeatures(attendanceFamily, 'TEACHER')) assert.ok(allowed(await call(rt.method, concretePath(rt.fullPath), U.TCH_A)), `${rt.fullPath} back ON`);
  });
  await test('global switch requires confirm + reason; core features cannot be switched off', async () => {
    fresh();
    assert.strictEqual((await call('PUT', '/api/super-admin/features/global', U.SA, { changes: [{ feature: 'attendance', enabled: false }], reason: 'x y z' })).body.code, 'CONFIRMATION_REQUIRED');
    assert.strictEqual((await call('PUT', '/api/super-admin/features/global', U.SA, { changes: [{ feature: 'attendance', enabled: false }], confirm: true })).body.code, 'REASON_REQUIRED');
    for (const f of ['billing', 'access_control', 'dashboard', 'profile']) {
      assert.strictEqual((await call('PUT', '/api/super-admin/features/global', U.SA, { changes: [{ feature: f, enabled: false }], reason: 'test', confirm: true })).body.code, 'CORE_FEATURE', f);
      assert.strictEqual((await call('PUT', `/api/super-admin/features/schools/${SCHOOL_A}`, U.SA, { changes: [{ feature: f, mode: 'OFF', reason: 'test' }] })).body.code, 'CORE_FEATURE', f);
    }
  });
  await test('plan OFF disables only schools on that plan', async () => {
    fresh(); mode('enforce');
    const r = await call('PUT', '/api/super-admin/features/plans/plan-basic', U.SA, { changes: [{ feature: 'assignments', enabled: false }] });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const a = await call('GET', '/api/teacher/assignments', U.TCH_A);
    assert.strictEqual(a.body.code, 'FEATURE_DISABLED');
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_B)), 'school B (plan-pro) unaffected');
    assert.strictEqual((await call('PUT', '/api/super-admin/features/plans/nope', U.SA, { changes: [{ feature: 'assignments', enabled: false }] })).status, 404);
  });
  await test('school override ON beats plan OFF; INHERIT restores plan; expired override ignored', async () => {
    fresh(); mode('enforce');
    await call('PUT', '/api/super-admin/features/plans/plan-basic', U.SA, { changes: [{ feature: 'assignments', enabled: false }] });
    const on = await call('PUT', `/api/super-admin/features/schools/${SCHOOL_A}`, U.SA, { changes: [{ feature: 'assignments', mode: 'ON', reason: 'pilot', expiresAt: new Date(Date.now() + 86400000).toISOString() }] });
    assert.strictEqual(on.status, 200, JSON.stringify(on.body));
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)), 'override ON');
    const view = await call('GET', `/api/super-admin/features/schools/${SCHOOL_A}`, U.SA);
    const f = view.body.features.find((x: any) => x.key === 'assignments');
    assert.strictEqual(f.effective.enabled, true); assert.strictEqual(f.inherited.enabled, false);
    await call('PUT', `/api/super-admin/features/schools/${SCHOOL_A}`, U.SA, { changes: [{ feature: 'assignments', mode: 'INHERIT' }] });
    assert.strictEqual((await call('GET', '/api/teacher/assignments', U.TCH_A)).body.code, 'FEATURE_DISABLED');
    // expired override (written directly — the API refuses past expiry)
    store.state.schoolOverrides[SCHOOL_A] = { assignments: { mode: 'ON', reason: 'old', expiresAt: '2020-01-01T00:00:00Z' } };
    invalidateAll();
    assert.strictEqual((await call('GET', '/api/teacher/assignments', U.TCH_A)).body.code, 'FEATURE_DISABLED');
    assert.strictEqual((await call('PUT', `/api/super-admin/features/schools/${SCHOOL_A}`, U.SA, { changes: [{ feature: 'assignments', mode: 'ON', reason: 'x y', expiresAt: '2020-01-01' }] })).body.code, 'INVALID_EXPIRY');
    assert.strictEqual((await call('PUT', `/api/super-admin/features/schools/${SCHOOL_A}`, U.SA, { changes: [{ feature: 'assignments', mode: 'OFF' }] })).body.code, 'REASON_REQUIRED');
  });
  await test('feature OFF hides, never deletes: role/user rows survive and re-apply when ON again', async () => {
    fresh(); mode('enforce');
    await call('PUT', '/api/access/principals/TEACHER/tch-a/permissions', U.ADM_A, { changes: [{ key: 'assignments.create', effect: 'DENY' }], reason: 'probation' });
    await call('PUT', '/api/super-admin/features/global', U.SA, { changes: [{ feature: 'assignments', enabled: false }], reason: 'maintenance', confirm: true });
    await call('PUT', '/api/super-admin/features/global', U.SA, { changes: [{ feature: 'assignments', enabled: true }], reason: 'done now', confirm: true });
    assert.strictEqual((await call('POST', '/api/teacher/assignments', U.TCH_A)).body.code, 'PERMISSION_DENIED');
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)));
  });

  // =====================================================================
  console.log('\n== 4/5. Role toggles and per-person overrides ==');
  await test('role toggle OFF ⇒ all teachers of school A denied; admins, other roles and school B unaffected', async () => {
    fresh(); mode('enforce');
    const r = await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', allowed: false }] });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    for (const t of [U.TCH_A, U.TCH_A2]) assert.strictEqual((await call('GET', '/api/teacher/assignments', t)).body.code, 'PERMISSION_DENIED');
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.ADM_A)), 'admin unaffected');
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_B)), 'school B unaffected');
    assert.ok(allowed(await call('POST', '/api/teacher/assignments', U.TCH_A)), 'other permission unaffected');
    const me = await call('GET', '/api/access/me', U.TCH_A);
    assert.strictEqual(me.body.permissions.find((p: any) => p.key === 'assignments.view').allowed, false);
    assert.ok(me.body.version >= 1);
  });
  await test('role toggle validation: unknown key, role outside ceiling, locked/core permissions, invalid role', async () => {
    fresh();
    assert.strictEqual((await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, { changes: [{ key: 'nope.x', allowed: false }] })).body.code, 'UNKNOWN_PERMISSION');
    assert.strictEqual((await call('PUT', '/api/access/roles/STUDENT/permissions', U.ADM_A, { changes: [{ key: 'attendance.take', allowed: true }] })).body.code, 'CEILING');
    assert.strictEqual((await call('PUT', '/api/access/roles/SCHOOL_ADMIN/permissions', U.ADM_A, { changes: [{ key: 'access.manage', allowed: false }] })).body.code, 'LOCKED');
    assert.strictEqual((await call('PUT', '/api/access/roles/SCHOOL_ADMIN/permissions', U.ADM_A, { changes: [{ key: 'billing.pay', allowed: false }] })).body.code, 'LOCKED');
    assert.strictEqual((await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, { changes: [{ key: 'dashboard.view', allowed: false }] })).body.code, 'LOCKED');
    assert.strictEqual((await call('PUT', '/api/access/roles/SUPER_ADMIN/permissions', U.ADM_A, { changes: [{ key: 'students.view', allowed: false }] })).body.code, 'INVALID_ROLE');
    assert.strictEqual((await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, { changes: [] })).body.code, 'INVALID_CHANGES');
  });
  await test('user DENY beats role allow; INHERIT removes it; DENY requires a reason', async () => {
    fresh(); mode('enforce');
    assert.strictEqual((await call('PUT', '/api/access/principals/TEACHER/tch-a/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', effect: 'DENY' }] })).body.code, 'REASON_REQUIRED');
    await call('PUT', '/api/access/principals/TEACHER/tch-a/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', effect: 'DENY' }], reason: 'misuse' });
    assert.strictEqual((await call('GET', '/api/teacher/assignments', U.TCH_A)).body.code, 'PERMISSION_DENIED');
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A2)), 'other teacher unaffected');
    await call('PUT', '/api/access/principals/TEACHER/tch-a/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', effect: 'INHERIT' }] });
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)), 'INHERIT restores');
  });
  await test('user ALLOW beats role deny but cannot exceed the ceiling', async () => {
    fresh(); mode('enforce');
    await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', allowed: false }] });
    await call('PUT', '/api/access/principals/TEACHER/tch-a/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', effect: 'ALLOW' }] });
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)));
    assert.strictEqual((await call('GET', '/api/teacher/assignments', U.TCH_A2)).body.code, 'PERMISSION_DENIED');
    const over = await call('PUT', '/api/access/principals/STUDENT/stu-u-a/permissions', U.ADM_A, { changes: [{ key: 'attendance.take', effect: 'ALLOW' }] });
    assert.strictEqual(over.body.code, 'CEILING');
    const detail = await call('GET', '/api/access/principals/TEACHER/tch-a', U.ADM_A);
    assert.strictEqual(detail.status, 200);
    const p = detail.body.permissions.find((x: any) => x.key === 'assignments.view');
    assert.strictEqual(p.allowed, true); assert.strictEqual(p.source, 'user_override');
  });
  await test('reset removes all overrides of a person', async () => {
    fresh();
    await call('PUT', '/api/access/principals/TEACHER/tch-a/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', effect: 'DENY' }, { key: 'assignments.grade', effect: 'DENY' }], reason: 'audit' });
    const r = await call('POST', '/api/access/principals/TEACHER/tch-a/reset', U.ADM_A);
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.removed.length, 2);
    assert.strictEqual(Object.keys(store.state.userOverrides).length, 0);
  });

  // =====================================================================
  console.log('\n== 6. Login control ==');
  await test('login disabled ⇒ existing token gets 401 ACCOUNT_DISABLED (incl. ungated routes); re-enable works', async () => {
    fresh(); mode('enforce');
    const d = await call('PUT', '/api/access/principals/TEACHER/tch-a/login', U.ADM_A, { enabled: false, reason: 'left school' });
    assert.strictEqual(d.status, 200, JSON.stringify(d.body));
    for (const [m, p] of [['GET', '/api/teacher/assignments'], ['GET', '/api/auth/me'], ['GET', '/api/access/me'], ['GET', '/api/calendar/holidays']]) {
      const r = await call(m, p, U.TCH_A);
      assert.strictEqual(r.status, 401, `${m} ${p}`); assert.strictEqual(r.body.code, 'ACCOUNT_DISABLED');
    }
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A2)), 'other teacher unaffected');
    await call('PUT', '/api/access/principals/TEACHER/tch-a/login', U.ADM_A, { enabled: true });
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)), 're-enabled');
  });
  await test('login disable requires reason and access.login.manage', async () => {
    fresh(); mode('enforce');
    assert.strictEqual((await call('PUT', '/api/access/principals/TEACHER/tch-a/login', U.ADM_A, { enabled: false })).body.code, 'REASON_REQUIRED');
    assert.strictEqual((await call('PUT', '/api/access/principals/TEACHER/tch-a/login', U.ADM_A, { enabled: 'no', reason: 'xx x' })).body.code, 'INVALID_BODY');
    // owner removes access.login.manage from admin A2 → A2 can no longer change logins
    await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a2/permissions', U.ADM_A, { changes: [{ key: 'access.login.manage', effect: 'DENY' }], reason: 'separation of duties' });
    const r = await call('PUT', '/api/access/principals/TEACHER/tch-a/login', U.ADM_A2, { enabled: false, reason: 'test test' });
    assert.strictEqual(r.status, 403); assert.strictEqual(r.body.code, 'PERMISSION_DENIED');
  });
  await test('POST /api/auth/login is refused with ACCOUNT_DISABLED for a disabled account (enforce) and allowed in shadow', async () => {
    fresh();
    store.state.logins[`${SCHOOL_A}|TEACHER|tch-a`] = { enabled: false, reason: 'left' };
    invalidateAll();
    const run = (m: string) => new Promise<{ status: number; body: any }>((resolve) => {
      mode(m);
      const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json(b: any) { resolve({ status: this.statusCode, body: b }); return this; } };
      loginAccountGate({} as any, res, () => res.json({ token: 't', user: U.TCH_A }));
    });
    const e = await run('enforce');
    assert.strictEqual(e.status, 401); assert.strictEqual(e.body.code, 'ACCOUNT_DISABLED'); assert.ok(!e.body.token);
    const s = await run('shadow');
    assert.strictEqual(s.status, 200); assert.ok(s.body.token);
    const ok = await new Promise<any>((resolve) => {
      mode('enforce');
      const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json(b: any) { resolve(b); return this; } };
      loginAccountGate({} as any, res, () => res.json({ token: 't', user: U.TCH_A2 }));
    });
    assert.ok(ok.token, 'enabled user logs in');
  });

  // =====================================================================
  console.log('\n== 7. Cross-tenant isolation ==');
  await test('school A admin cannot read/change school B, super admins or school B users', async () => {
    fresh(); mode('enforce');
    for (const [m, p, b] of [
      ['GET', `/api/access/roles?schoolId=${SCHOOL_B}`], ['GET', `/api/access/principals?role=TEACHER&schoolId=${SCHOOL_B}`],
      ['GET', `/api/access/audit?schoolId=${SCHOOL_B}`], ['PUT', `/api/access/roles/TEACHER/permissions?schoolId=${SCHOOL_B}`, { changes: [{ key: 'assignments.view', allowed: false }] }],
    ] as any[]) {
      const r = await call(m, p, U.ADM_A, b);
      assert.strictEqual(r.status, 403, `${m} ${p}`); assert.strictEqual(r.body.code, 'CROSS_TENANT');
    }
    for (const [m, p, b] of [
      ['GET', '/api/access/principals/TEACHER/tch-b'], ['PUT', '/api/access/principals/TEACHER/tch-b/permissions', { changes: [{ key: 'assignments.view', effect: 'DENY' }], reason: 'x y z' }],
      ['PUT', '/api/access/principals/TEACHER/tch-b/login', { enabled: false, reason: 'x y z' }], ['POST', '/api/access/principals/TEACHER/tch-b/reset'],
      ['PUT', '/api/access/principals/SCHOOL_ADMIN/adm-b/login', { enabled: false, reason: 'x y z' }],
    ] as any[]) {
      const r = await call(m, p, U.ADM_A, b);
      assert.strictEqual(r.status, 404, `${m} ${p}`);
    }
    for (const p of ['/api/access/principals/SUPER_ADMIN/sa-1', '/api/access/principals/SUPER_ADMIN/sa-1/login']) {
      const r = await call(p.endsWith('login') ? 'PUT' : 'GET', p, U.ADM_A, p.endsWith('login') ? { enabled: false, reason: 'x y z' } : undefined);
      assert.strictEqual(r.body.code, 'INVALID_ROLE', p);
    }
    // a change in school B never affects school A
    await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_B, { changes: [{ key: 'assignments.view', allowed: false }] });
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)));
    assert.strictEqual((await call('GET', '/api/teacher/assignments', U.TCH_B)).body.code, 'PERMISSION_DENIED');
  });
  await test('SUPER_ADMIN must pass a valid schoolId; can manage any school (audited)', async () => {
    fresh();
    assert.strictEqual((await call('GET', '/api/access/roles', U.SA)).body.code, 'SCHOOL_REQUIRED');
    assert.strictEqual((await call('GET', '/api/access/roles?schoolId=nope', U.SA)).status, 404);
    const r = await call('PUT', `/api/access/roles/TEACHER/permissions?schoolId=${SCHOOL_B}`, U.SA, { changes: [{ key: 'assignments.view', allowed: false }] });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(store.state.audit.at(-1)!.actorRole, 'SUPER_ADMIN');
    assert.strictEqual(store.state.audit.at(-1)!.schoolId, SCHOOL_B);
  });

  // =====================================================================
  console.log('\n== 8. Lock-out protection ==');
  await test('admins cannot disable their own login or remove their own access management', async () => {
    fresh();
    assert.strictEqual((await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a/login', U.ADM_A, { enabled: false, reason: 'oops oops' })).body.code, 'SELF_LOCKOUT');
    assert.strictEqual((await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a/permissions', U.ADM_A, { changes: [{ key: 'access.manage', effect: 'DENY' }], reason: 'oops oops' })).body.code, 'SELF_LOCKOUT');
    assert.strictEqual((await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a2/login', U.ADM_A2, { enabled: false, reason: 'oops oops' })).body.code, 'SELF_LOCKOUT');
  });
  await test('owner admin cannot be restricted by other admins; non-owners cannot change other admins', async () => {
    fresh();
    assert.strictEqual((await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a/login', U.ADM_A2, { enabled: false, reason: 'coup coup' })).body.code, 'OWNER_PROTECTED');
    assert.strictEqual((await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a/permissions', U.ADM_A2, { changes: [{ key: 'students.view', effect: 'DENY' }], reason: 'coup coup' })).body.code, 'OWNER_PROTECTED');
    assert.strictEqual((await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a3/login', U.ADM_A2, { enabled: false, reason: 'coup coup' })).body.code, 'ADMIN_PROTECTED');
    assert.strictEqual((await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a3/login', U.ADM_A, { enabled: false, reason: 'owner decision' })).status, 200);
    const detail = await call('GET', '/api/access/principals/SCHOOL_ADMIN/adm-a', U.ADM_A2);
    assert.strictEqual(detail.body.isOwner, true); assert.strictEqual(detail.body.editable, false);
  });
  await test('the last active admin with access.manage cannot be removed (409 LOCKOUT_PREVENTED), state rolled back', async () => {
    fresh();
    await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a2/login', U.ADM_A, { enabled: false, reason: 'on leave' });
    await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a3/permissions', U.ADM_A, { changes: [{ key: 'access.manage', effect: 'DENY' }], reason: 'read only' });
    const before = JSON.stringify(store.state);
    const r = await call('PUT', `/api/access/principals/SCHOOL_ADMIN/adm-a/permissions?schoolId=${SCHOOL_A}`, U.SA, { changes: [{ key: 'access.manage', effect: 'DENY' }], reason: 'test lockout' });
    assert.strictEqual(r.status, 409); assert.strictEqual(r.body.code, 'LOCKOUT_PREVENTED');
    assert.strictEqual(JSON.stringify(store.state), before, 'transaction rolled back');
    const l = await call('PUT', `/api/access/principals/SCHOOL_ADMIN/adm-a/login?schoolId=${SCHOOL_A}`, U.SA, { enabled: false, reason: 'test lockout' });
    assert.strictEqual(l.body.code, 'LOCKOUT_PREVENTED');
  });

  // =====================================================================
  console.log('\n== 9. Non-admin roles on every access write endpoint ==');
  await test('TEACHER / STUDENT / PARENT get 403 on every /api/access write + read endpoint; SCHOOL_ADMIN on super-admin feature APIs', async () => {
    fresh(); mode('enforce');
    const eps: [string, string, any][] = [
      ['GET', '/api/access/catalog', undefined], ['GET', '/api/access/roles', undefined], ['GET', '/api/access/principals?role=TEACHER', undefined],
      ['GET', '/api/access/principals/TEACHER/tch-a2', undefined], ['GET', '/api/access/audit', undefined],
      ['PUT', '/api/access/roles/TEACHER/permissions', { changes: [{ key: 'assignments.view', allowed: false }] }],
      ['PUT', '/api/access/principals/TEACHER/tch-a2/permissions', { changes: [{ key: 'assignments.view', effect: 'DENY' }], reason: 'x y z' }],
      ['PUT', '/api/access/principals/TEACHER/tch-a2/login', { enabled: false, reason: 'x y z' }],
      ['POST', '/api/access/principals/TEACHER/tch-a2/reset', {}],
    ];
    for (const u of [U.TCH_A, U.STU_A, U.PAR_A]) for (const [m, p, b] of eps) assert.strictEqual((await call(m, p, u, b)).status, 403, `${u.role} ${m} ${p}`);
    for (const [m, p] of [['GET', '/api/super-admin/features/plans'], ['PUT', '/api/super-admin/features/global'], ['PUT', `/api/super-admin/features/schools/${SCHOOL_A}`], ['PUT', '/api/super-admin/features/plans/plan-basic']]) {
      assert.strictEqual((await call(m, p, U.ADM_A, { changes: [] })).status, 403, `${m} ${p}`);
    }
    for (const [m, p] of eps) assert.strictEqual((await call(m, p, null)).status, 401, `anon ${m} ${p}`);
    assert.strictEqual(store.state.audit.length, 0);
  });
  await test('a SCHOOL_ADMIN denied access.manage loses the access APIs (but still sees /me)', async () => {
    fresh();
    await call('PUT', '/api/access/principals/SCHOOL_ADMIN/adm-a2/permissions', U.ADM_A, { changes: [{ key: 'access.manage', effect: 'DENY' }], reason: 'read only' });
    assert.strictEqual((await call('GET', '/api/access/roles', U.ADM_A2)).status, 403);
    assert.strictEqual((await call('GET', '/api/access/me', U.ADM_A2)).status, 200);
  });

  // =====================================================================
  console.log('\n== 10. Idempotency ==');
  await test('same PUT twice ⇒ same state, exactly one audit entry per real change', async () => {
    fresh();
    const body = { changes: [{ key: 'assignments.view', allowed: false }, { key: 'assignments.grade', allowed: true }] };
    const a = await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, body);
    const b = await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, body);
    assert.strictEqual(a.body.changed.length, 1, 'setting the default (true) is a no-op');
    assert.strictEqual(b.body.changed.length, 0);
    const login = { enabled: false, reason: 'left school' };
    await call('PUT', '/api/access/principals/TEACHER/tch-a/login', U.ADM_A, login);
    const l2 = await call('PUT', '/api/access/principals/TEACHER/tch-a/login', U.ADM_A, login);
    assert.strictEqual(l2.body.changed, false);
    await call('PUT', '/api/super-admin/features/plans/plan-basic', U.SA, { changes: [{ feature: 'analytics', enabled: false }] });
    await call('PUT', '/api/super-admin/features/plans/plan-basic', U.SA, { changes: [{ feature: 'analytics', enabled: false }] });
    assert.strictEqual(store.state.audit.length, 3);
    assert.strictEqual(store.state.versions[SCHOOL_A], 2);
    const audit = await call('GET', '/api/access/audit', U.ADM_A);
    assert.strictEqual(audit.body.total, 2);
    assert.ok(audit.body.items.every((x: any) => x.actorId === 'adm-a' && x.before !== undefined && x.after !== undefined));
  });

  // =====================================================================
  console.log('\n== 11/12. Storage unavailable ==');
  await test('DisabledPool (SQL not configured): writes 503 ACCESS_STORE_UNAVAILABLE, reads fall back to defaults', async () => {
    setAccessStore(new SqlAccessStore()); invalidateAll(); mode('enforce');
    const w = await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', allowed: false }] });
    assert.strictEqual(w.status, 503); assert.strictEqual(w.body.code, 'ACCESS_STORE_UNAVAILABLE');
    assert.strictEqual((await call('PUT', '/api/super-admin/features/global', U.SA, { changes: [{ feature: 'analytics', enabled: false }], reason: 'x y z', confirm: true })).status, 503);
    const me = await call('GET', '/api/access/me', U.TCH_A);
    assert.strictEqual(me.status, 200); assert.ok(me.body.permissions.find((p: any) => p.key === 'assignments.view').allowed);
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)));
  });
  await test('RBAC tables missing: app serves legacy behaviour, /api/health reports rbac NOT_INSTALLED, writes 503', async () => {
    fresh(); store.mode = 'NOT_INSTALLED'; mode('enforce');
    const h = await call('GET', '/api/health', null);
    assert.strictEqual(h.status, 200); assert.strictEqual(h.body.rbac, 'NOT_INSTALLED'); assert.strictEqual(h.body.rbacMode, 'enforce');
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)));
    assert.strictEqual((await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', allowed: false }] })).status, 503);
  });
  await test('any other store error during a permission check fails closed in enforce (503 ACCESS_UNAVAILABLE), never blocks in shadow', async () => {
    fresh(); store.failReads = true; mode('enforce');
    const r = await call('GET', '/api/teacher/assignments', U.TCH_A);
    assert.strictEqual(r.status, 503); assert.strictEqual(r.body.code, 'ACCESS_UNAVAILABLE');
    mode('shadow'); invalidateAll();
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)));
    mode('enforce');
  });

  // =====================================================================
  console.log('\n== 13. Enforcement modes ==');
  await test('shadow never blocks (logs one structured line); enforce blocks; off = legacy with no evaluation', async () => {
    fresh();
    await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', allowed: false }] });
    await call('PUT', '/api/access/principals/TEACHER/tch-a2/login', U.ADM_A, { enabled: false, reason: 'left school' });
    const logs: string[] = [];
    const orig = console.warn; console.warn = (...a: any[]) => { logs.push(a.join(' ')); };
    try {
      mode('shadow');
      assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)), 'shadow allows');
      assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A2)), 'shadow allows disabled login');
      const line = logs.find((l) => l.startsWith('[RBAC_SHADOW]') && l.includes('assignments.view'));
      assert.ok(line, 'shadow log emitted');
      const parsed = JSON.parse(line!.slice('[RBAC_SHADOW] '.length));
      assert.strictEqual(parsed.reason, 'ROLE_DENY'); assert.strictEqual(parsed.uid, 'tch-a');
      assert.ok(!line!.includes('t@t'), 'no e-mail (PII) in log');
      logs.length = 0; mode('off'); const readsBefore = store.reads;
      assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)), 'off allows');
      assert.strictEqual(logs.filter((l) => l.startsWith('[RBAC_')).length, 0);
      assert.strictEqual(store.reads, readsBefore, 'off performs no RBAC reads');
      mode('enforce');
      assert.strictEqual((await call('GET', '/api/teacher/assignments', U.TCH_A)).body.code, 'PERMISSION_DENIED');
      assert.strictEqual((await call('GET', '/api/teacher/assignments', U.TCH_A2)).body.code, 'ACCOUNT_DISABLED');
    } finally { console.warn = orig; }
  });

  // =====================================================================
  console.log('\n== 14. Cache invalidation ==');
  await test('a write through the API applies on the very next request (same process)', async () => {
    fresh(); mode('enforce');
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)));
    await call('PUT', '/api/access/roles/TEACHER/permissions', U.ADM_A, { changes: [{ key: 'assignments.view', allowed: false }] });
    assert.strictEqual((await call('GET', '/api/teacher/assignments', U.TCH_A)).body.code, 'PERMISSION_DENIED');
  });
  await test('a write from ANOTHER process is served from cache until TTL/invalidation (documented staleness)', async () => {
    fresh(); mode('enforce');
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)));
    (store.state.rolePerms[SCHOOL_A] ||= {}).TEACHER = { 'assignments.view': false }; // simulated other process (no invalidation here)
    assert.ok(allowed(await call('GET', '/api/teacher/assignments', U.TCH_A)), 'still cached');
    invalidateAll(); // == TTL expiry (60 s) or Redis invalidation
    assert.strictEqual((await call('GET', '/api/teacher/assignments', U.TCH_A)).body.code, 'PERMISSION_DENIED');
  });

  agent.destroy();
  server.close();
  console.log(`\n[rbac-enforcement] ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('[rbac-enforcement] crashed:', e?.stack || e); process.exit(1); });
