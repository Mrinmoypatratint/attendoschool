/**
 * RBAC P1 unit tests — pure resolver, catalog integrity, route-binding coverage.
 * Run: npx tsx tests/rbac-resolver.test.ts   (no DB, no network)
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  BASE_ROLES, FEATURES, PERMISSIONS, featureChain, featureDependents, findRouteBinding, getPermission,
  normalizeRole, principalToggleLock, roleToggleLock, validateCatalog, canonicalPath,
} from '../src/rbac/catalog';
import { AccessInput, isOverrideActive, resolveAccess, resolveFeature } from '../src/rbac/accessService';

let passed = 0; let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  [PASS] ${name}`); }
  catch (e: any) { failed++; console.error(`  [FAIL] ${name}\n         ${e?.message}`); }
}
const NOW = Date.parse('2026-11-08T10:00:00Z');
const base = (over: Partial<AccessInput> = {}): AccessInput => ({
  now: NOW, globalFeatures: {}, schoolOverrides: {}, planFeatures: null,
  role: 'TEACHER', permissionKey: 'attendance.take', loginEnabled: true, rolePermissions: {}, userOverrides: {}, ...over,
});

console.log('\n== Catalog integrity ==');
test('catalog validates (no duplicates, known features, defaults ⊆ ceiling, bindings valid)', () => assert.deepStrictEqual(validateCatalog(), []));
test('v1 restrict-only: defaultRoles === ceilingRoles for every permission', () => {
  for (const p of PERMISSIONS) assert.deepStrictEqual([...p.defaultRoles].sort(), [...p.ceilingRoles].sort(), p.key);
});
test('access.manage and billing.* are locked for SCHOOL_ADMIN role (R10)', () => {
  for (const k of ['access.manage', 'billing.view', 'billing.pay']) assert.strictEqual(roleToggleLock(getPermission(k)!, 'SCHOOL_ADMIN').locked, true, k);
});
test('core permissions (dashboard/profile) are locked for every role and per person (R11)', () => {
  for (const k of ['dashboard.view', 'profile.self', 'profile.school.manage']) {
    for (const r of BASE_ROLES) {
      assert.strictEqual(roleToggleLock(getPermission(k)!, r).locked, true, `${k}/${r} role`);
      assert.strictEqual(principalToggleLock(getPermission(k)!, r).locked, true, `${k}/${r} person`);
    }
  }
});
test('non-core permission is toggleable within ceiling and locked outside it', () => {
  assert.strictEqual(roleToggleLock(getPermission('attendance.take')!, 'TEACHER').locked, false);
  assert.strictEqual(roleToggleLock(getPermission('attendance.take')!, 'STUDENT').locked, true);
});
test('feature dependencies: attendance OFF disables corrections/reports/offline', () => {
  assert.deepStrictEqual(featureDependents('attendance').sort(), ['attendance_corrections', 'attendance_reports', 'offline_attendance']);
  assert.deepStrictEqual(featureChain('attendance_reports'), ['attendance_reports', 'attendance']);
});
test('core features are exactly access_control, billing, dashboard, profile', () => {
  assert.deepStrictEqual(FEATURES.filter((f) => f.core).map((f) => f.key).sort(), ['access_control', 'billing', 'dashboard', 'profile']);
});

console.log('\n== Route bindings ==');
const snap = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/rbac-baseline.snapshot.json'), 'utf8')).results as Record<string, Record<string, string>>;
const approved = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/rbac-baseline.approved-changes.json'), 'utf8'));
const all: Record<string, Record<string, string>> = { ...snap };
for (const [k, v] of Object.entries<any>(approved.changes)) all[k] = { ...all[k], ...v.principals };
for (const [k, v] of Object.entries<any>(approved.additions)) all[k] = v.principals;
test('every route in the baseline has a catalog binding (gated or UNGATED)', () => {
  const missing = Object.keys(all).filter((k) => { const [m, p] = k.split(' '); return !findRouteBinding(m, p); });
  assert.deepStrictEqual(missing, []);
});
test('R4: every permission ceiling ⊆ roles that reach at least one bound route today', () => {
  const reach: Record<string, Set<string>> = {};
  for (const [k, r] of Object.entries(all)) {
    const [m, p] = k.split(' ');
    const b = findRouteBinding(m, p);
    if (!b?.permission) continue;
    const s = (reach[b.permission] ||= new Set());
    // MW_* = a data-dependent middleware (e.g. requireAttendanceTeacher with no SQL data) answered;
    // with real data an authorised user of that role passes, so the role does reach the route.
    for (const role of BASE_ROLES) if (r[role] === 'ALLOW' || String(r[role]).startsWith('MW_')) s.add(role);
  }
  const problems: string[] = [];
  for (const p of PERMISSIONS) {
    if (p.key === 'access.login.manage') continue; // new capability, enforced only by /api/access
    for (const role of p.ceilingRoles) if (!reach[p.key]?.has(role)) problems.push(`${p.key}:${role}`);
  }
  assert.deepStrictEqual(problems, [], problems.join(', '));
});
test('never-gate list is UNGATED (health, auth, webhooks, super-admin, demo, payment, access)', () => {
  for (const [m, p] of [['POST', '/api/auth/login'], ['GET', '/api/health'], ['POST', '/api/webhooks/razorpay/webhook'], ['GET', '/api/super-admin/schools'],
    ['POST', '/api/demo-request'], ['POST', '/demo-request'], ['POST', '/api/school-payment/razorpay/order'], ['GET', '/api/access/me'], ['GET', '/']]) {
    const b = findRouteBinding(m, p);
    assert.ok(b && b.permission === null, `${m} ${p}`);
  }
});
test('aliases resolve like canonical paths (v-suffix, /api/attendance, /designations)', () => {
  assert.strictEqual(canonicalPath('/api/communication-v25/announcements'), '/api/communication/announcements');
  assert.strictEqual(canonicalPath('/api/notifications-v11/logs'), '/api/notification-channels/logs');
  assert.strictEqual(findRouteBinding('POST', '/api/attendance/attendance')?.permission, 'attendance.take');
  assert.strictEqual(findRouteBinding('PUT', '/designations/abc')?.permission, 'designations.manage');
  assert.strictEqual(findRouteBinding('GET', '/API/Students//')?.permission, 'students.view');
});
test('concrete ids bind correctly', () => {
  assert.strictEqual(findRouteBinding('PUT', '/api/teacher/attendance/0f6c/student/aa1')?.permission, 'attendance.edit');
  assert.strictEqual(findRouteBinding('POST', '/api/teacher/attendance/0f6c/reattendance')?.permission, 'attendance.edit_past');
  assert.strictEqual(findRouteBinding('GET', '/api/teacher/assignments/x1/submissions')?.permission, 'assignments.grade');
  assert.strictEqual(findRouteBinding('GET', '/api/teacher/mentor/my-classes')?.permission, 'mentors.workspace');
  assert.strictEqual(findRouteBinding('POST', '/api/students/bulk-delete')?.permission, 'students.delete');
});

console.log('\n== Resolver layers ==');
test('0 SUPER_ADMIN always allowed (even unknown key / feature off)', () => {
  assert.strictEqual(resolveAccess(base({ role: 'SUPER_ADMIN', permissionKey: 'nope' })).allowed, true);
  assert.strictEqual(resolveAccess(base({ role: 'SUPER_ADMIN', globalFeatures: { attendance: false } })).reason, 'SUPER_ADMIN');
});
test('compat roles: ADMIN/ADMINISTRATOR → SUPER_ADMIN, PRINCIPAL → SCHOOL_ADMIN, lower-case ok', () => {
  assert.strictEqual(normalizeRole('ADMIN'), 'SUPER_ADMIN');
  assert.strictEqual(normalizeRole('administrator'), 'SUPER_ADMIN');
  assert.strictEqual(normalizeRole('PRINCIPAL'), 'SCHOOL_ADMIN');
  assert.strictEqual(normalizeRole('teacher'), 'TEACHER');
  assert.strictEqual(normalizeRole('HACKER'), null);
  assert.strictEqual(resolveAccess(base({ role: 'ADMIN' })).reason, 'SUPER_ADMIN');
  assert.strictEqual(resolveAccess(base({ role: 'PRINCIPAL' })).reason, 'DEFAULT_ALLOW');
});
test('1 unknown permission → UNKNOWN_PERMISSION', () => assert.strictEqual(resolveAccess(base({ permissionKey: 'x.y' })).reason, 'UNKNOWN_PERMISSION'));
test('2 role outside ceiling → CEILING (user ALLOW cannot exceed it)', () => {
  const d = resolveAccess(base({ role: 'STUDENT', userOverrides: { 'attendance.take': 'ALLOW' } }));
  assert.strictEqual(d.reason, 'CEILING'); assert.strictEqual(d.allowed, false);
  assert.strictEqual(resolveAccess(base({ role: 'GHOST' })).reason, 'CEILING');
});
test('3 login disabled → ACCOUNT_DISABLED (before feature/user/role)', () => {
  assert.strictEqual(resolveAccess(base({ loginEnabled: false, userOverrides: { 'attendance.take': 'ALLOW' } })).reason, 'ACCOUNT_DISABLED');
});
test('4 global kill switch beats school override ON', () => {
  const d = resolveAccess(base({ globalFeatures: { attendance: false }, schoolOverrides: { attendance: { mode: 'ON', reason: 'x', expiresAt: null } } }));
  assert.strictEqual(d.reason, 'FEATURE_DISABLED'); assert.strictEqual(d.source, 'global');
});
test('5 school override ON beats plan OFF', () => {
  const d = resolveAccess(base({ planFeatures: { attendance: false }, schoolOverrides: { attendance: { mode: 'ON', reason: 'trial', expiresAt: null } } }));
  assert.strictEqual(d.allowed, true);
});
test('5 school override OFF beats plan ON', () => {
  const d = resolveAccess(base({ planFeatures: { attendance: true }, schoolOverrides: { attendance: { mode: 'OFF', reason: 'x', expiresAt: null } } }));
  assert.strictEqual(d.reason, 'FEATURE_DISABLED'); assert.strictEqual(d.source, 'school_override');
});
test('5 expired school override is ignored (falls back to plan)', () => {
  const o = { mode: 'ON' as const, reason: 'trial', expiresAt: '2026-11-01T00:00:00Z' };
  assert.strictEqual(isOverrideActive(o, NOW), false);
  const d = resolveAccess(base({ planFeatures: { attendance: false }, schoolOverrides: { attendance: o } }));
  assert.strictEqual(d.reason, 'FEATURE_DISABLED'); assert.strictEqual(d.source, 'plan');
  assert.strictEqual(isOverrideActive({ ...o, expiresAt: '2026-12-01T00:00:00Z' }, NOW), true);
});
test('6 plan OFF disables; no plan → defaultEnabled; missing plan row → default', () => {
  assert.strictEqual(resolveAccess(base({ planFeatures: { attendance: false } })).reason, 'FEATURE_DISABLED');
  assert.strictEqual(resolveAccess(base({ planFeatures: null })).allowed, true);
  assert.strictEqual(resolveAccess(base({ planFeatures: { students: false } })).allowed, true);
});
test('6 core features are always on (plan/global cannot disable)', () => {
  const d = resolveAccess(base({ role: 'SCHOOL_ADMIN', permissionKey: 'billing.pay', planFeatures: { billing: false }, globalFeatures: { billing: false } }));
  assert.strictEqual(d.allowed, true);
});
test('dependencies: attendance OFF ⇒ attendance.reports.view disabled (blockedBy attendance)', () => {
  const d = resolveAccess(base({ role: 'SCHOOL_ADMIN', permissionKey: 'attendance.reports.view', planFeatures: { attendance: false } }));
  assert.strictEqual(d.reason, 'FEATURE_DISABLED'); assert.strictEqual(d.blockedByFeature, 'attendance');
  const f = resolveFeature('offline_attendance', { now: NOW, globalFeatures: { attendance: false }, schoolOverrides: {}, planFeatures: null });
  assert.strictEqual(f.enabled, false); assert.strictEqual(f.blockedBy, 'attendance');
});
test('7 user DENY beats role ALLOW', () => {
  const d = resolveAccess(base({ rolePermissions: { 'attendance.take': true }, userOverrides: { 'attendance.take': 'DENY' } }));
  assert.strictEqual(d.reason, 'USER_DENY');
});
test('7 user ALLOW beats role DENY (within ceiling)', () => {
  const d = resolveAccess(base({ rolePermissions: { 'attendance.take': false }, userOverrides: { 'attendance.take': 'ALLOW' } }));
  assert.strictEqual(d.reason, 'USER_ALLOW'); assert.strictEqual(d.allowed, true);
});
test('7 user ALLOW does not bypass a disabled feature', () => {
  const d = resolveAccess(base({ planFeatures: { attendance: false }, userOverrides: { 'attendance.take': 'ALLOW' } }));
  assert.strictEqual(d.reason, 'FEATURE_DISABLED');
});
test('8 role toggle OFF denies; 9 default allows when no rows', () => {
  assert.strictEqual(resolveAccess(base({ rolePermissions: { 'attendance.take': false } })).reason, 'ROLE_DENY');
  assert.strictEqual(resolveAccess(base()).reason, 'DEFAULT_ALLOW');
});
test('R1: empty tables ⇒ every in-ceiling role allowed for every permission', () => {
  for (const p of PERMISSIONS) for (const r of p.ceilingRoles) {
    assert.strictEqual(resolveAccess(base({ role: r, permissionKey: p.key })).allowed, true, `${p.key}/${r}`);
  }
});

console.log(`\n[rbac-resolver] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
