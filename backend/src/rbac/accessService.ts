/**
 * RBAC access service.
 *
 *  - resolveFeature / resolveAccess: PURE decision functions (unit-tested layer by layer).
 *  - getAccessSnapshot / evaluatePermission / checkLogin: cached reads (utils/cache.ts).
 *  - apply*Changes: validated, idempotent, transactional writes (row + version bump + audit in ONE tx),
 *    cache invalidation after COMMIT.
 *
 * Decision order (first decisive match wins; DENY beats ALLOW):
 *  0 SUPER_ADMIN → allow · 1 unknown key → UNKNOWN_PERMISSION · 2 role ∉ ceiling → CEILING ·
 *  3 login disabled → ACCOUNT_DISABLED · 4 global kill switch · 5 school override (expired ignored) ·
 *  6 plan (no plan → defaultEnabled; core → always on) · 7 user override · 8 role toggle · 9 catalog default.
 *  Layers 4–6 are evaluated for the permission's feature AND every feature it depends on.
 *
 * Staleness: snapshot TTL 60 s, login TTL 30 s. Writes invalidate this process immediately and Redis
 * (if configured). Other processes keep their in-memory L1 copy until TTL: worst case 60 s for
 * permissions/features and 30 s for login disable (see docs/rbac/ROLLOUT.md).
 */
import { fastCache } from '../utils/cache';
import { canonicalSchoolId } from '../utils/tenant';
import {
  BASE_ROLES, BaseRole, FEATURES, PERMISSIONS, PermissionDef, Role, featureChain, featureDependents,
  getFeature, getPermission, isBaseRole, normalizeRole, principalToggleLock, roleToggleLock,
} from './catalog';
import {
  AccessStoreUnavailableError, AccessTx, Effect, PrincipalContext, SchoolContext, SchoolOverride, getAccessStore,
} from './accessStore';
import { getPrincipalDirectory } from './principalDirectory';

// ---------------------------------------------------------------------------
// Enforcement mode
// ---------------------------------------------------------------------------
export type EnforcementMode = 'off' | 'shadow' | 'enforce';
export function getEnforcementMode(): EnforcementMode {
  const v = String(process.env.RBAC_ENFORCEMENT || 'shadow').trim().toLowerCase();
  return v === 'off' || v === 'enforce' ? v : 'shadow';
}

// ---------------------------------------------------------------------------
// Pure resolver
// ---------------------------------------------------------------------------
export type DecisionReason =
  | 'SUPER_ADMIN' | 'UNKNOWN_PERMISSION' | 'CEILING' | 'ACCOUNT_DISABLED' | 'FEATURE_DISABLED'
  | 'USER_DENY' | 'USER_ALLOW' | 'ROLE_DENY' | 'ROLE_ALLOW' | 'DEFAULT_ALLOW' | 'DEFAULT_DENY';
export type DecisionSource =
  | 'super_admin' | 'catalog' | 'ceiling' | 'login' | 'global' | 'school_override' | 'plan' | 'feature_default'
  | 'user_override' | 'role' | 'default';
export type Decision = { allowed: boolean; reason: DecisionReason; source: DecisionSource; feature?: string; blockedByFeature?: string };

export type FeatureInput = {
  now: number;
  globalFeatures: Record<string, boolean>;
  schoolOverrides: Record<string, SchoolOverride>;
  /** null = no plan / no subscription known */
  planFeatures: Record<string, boolean> | null;
};
export type FeatureDecision = { enabled: boolean; source: DecisionSource; blockedBy?: string };

export function isOverrideActive(o: SchoolOverride | undefined, now: number): boolean {
  if (!o) return false;
  if (!o.expiresAt) return true;
  const t = Date.parse(o.expiresAt);
  return Number.isFinite(t) && t > now;
}

function resolveSingleFeature(key: string, input: FeatureInput): FeatureDecision {
  const def = getFeature(key);
  if (!def) return { enabled: false, source: 'catalog' };
  if (def.core) return { enabled: true, source: 'catalog' };
  if (input.globalFeatures[key] === false) return { enabled: false, source: 'global' };
  const o = input.schoolOverrides[key];
  if (isOverrideActive(o, input.now)) return { enabled: o!.mode === 'ON', source: 'school_override' };
  if (input.planFeatures && key in input.planFeatures) return { enabled: input.planFeatures[key] !== false, source: 'plan' };
  return { enabled: def.defaultEnabled, source: 'feature_default' };
}

/** A feature is enabled only if it AND every feature it depends on is enabled. */
export function resolveFeature(key: string, input: FeatureInput): FeatureDecision {
  let own: FeatureDecision | null = null;
  for (const k of featureChain(key)) {
    const d = resolveSingleFeature(k, input);
    if (k === key) own = d;
    if (!d.enabled) return { enabled: false, source: d.source, blockedBy: k };
  }
  return own || { enabled: false, source: 'catalog' };
}

export type AccessInput = FeatureInput & {
  role: unknown;
  permissionKey: string;
  loginEnabled: boolean;
  /** permission → allowed, for THIS role in THIS school */
  rolePermissions: Record<string, boolean>;
  /** permission → effect, for THIS principal */
  userOverrides: Record<string, Effect>;
};

export function resolveAccess(input: AccessInput): Decision {
  const role = normalizeRole(input.role);
  if (role === 'SUPER_ADMIN') return { allowed: true, reason: 'SUPER_ADMIN', source: 'super_admin' };
  const perm = getPermission(input.permissionKey);
  if (!perm) return { allowed: false, reason: 'UNKNOWN_PERMISSION', source: 'catalog' };
  const feature = perm.feature;
  if (!role || !isBaseRole(role) || !perm.ceilingRoles.includes(role)) return { allowed: false, reason: 'CEILING', source: 'ceiling', feature };
  if (!input.loginEnabled) return { allowed: false, reason: 'ACCOUNT_DISABLED', source: 'login', feature };
  const f = resolveFeature(feature, input);
  if (!f.enabled) return { allowed: false, reason: 'FEATURE_DISABLED', source: f.source, feature, blockedByFeature: f.blockedBy };
  const uo = input.userOverrides[perm.key];
  if (uo === 'DENY') return { allowed: false, reason: 'USER_DENY', source: 'user_override', feature };
  if (uo === 'ALLOW') return { allowed: true, reason: 'USER_ALLOW', source: 'user_override', feature };
  if (perm.key in input.rolePermissions) {
    return input.rolePermissions[perm.key]
      ? { allowed: true, reason: 'ROLE_ALLOW', source: 'role', feature }
      : { allowed: false, reason: 'ROLE_DENY', source: 'role', feature };
  }
  return perm.defaultRoles.includes(role)
    ? { allowed: true, reason: 'DEFAULT_ALLOW', source: 'default', feature }
    : { allowed: false, reason: 'DEFAULT_DENY', source: 'default', feature };
}

// ---------------------------------------------------------------------------
// Errors surfaced by routes
// ---------------------------------------------------------------------------
export class AccessError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) { super(message); }
}

// ---------------------------------------------------------------------------
// Cached reads
// ---------------------------------------------------------------------------
const SNAPSHOT_TTL = 60;
const LOGIN_TTL = 30;
export type MinimalUser = { id: string; role: unknown; schoolId?: string | null };

const k = {
  school: (s: string) => `access:${s}:__school__`,
  plan: (s: string) => `access:${s}:__plan__`,
  principal: (s: string, r: string, id: string) => `access:${s}:${r}:${id}`,
  login: (s: string, r: string, id: string) => `access-login:${s}:${r}:${id}`,
  planFeatures: (p: string) => `access-planfeatures:${p}`,
};

export function canonicalSchool(id?: string | null): string | null {
  const c = canonicalSchoolId(id ? String(id).trim() : null);
  return c || null;
}

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = await fastCache.getAsync<T>(key);
  if (hit !== null && hit !== undefined) return hit;
  const v = await load();
  fastCache.set(key, v, ttl);
  return v;
}

export async function loadSchoolContext(schoolId: string): Promise<SchoolContext> {
  return cached(k.school(schoolId), SNAPSHOT_TTL, () => getAccessStore().loadSchoolContext(schoolId));
}
async function loadPlanFeaturesFor(schoolId: string): Promise<{ planKey: string | null; features: Record<string, boolean> | null }> {
  const planKey = await cached(k.plan(schoolId), SNAPSHOT_TTL, async () => ({ v: await getAccessStore().getPlanKey(schoolId) }));
  if (!planKey.v) return { planKey: null, features: null };
  const features = await cached(k.planFeatures(planKey.v), SNAPSHOT_TTL, () => getAccessStore().loadPlanFeatures(planKey.v!));
  return { planKey: planKey.v, features };
}
async function loadPrincipalContext(s: string, r: string, id: string): Promise<PrincipalContext> {
  return cached(k.principal(s, r, id), SNAPSHOT_TTL, () => getAccessStore().loadPrincipal(s, r, id));
}

/** Login status (TTL 30 s). Returns true when no control row exists / store unavailable-but-not-erroring. */
export async function checkLogin(user: MinimalUser): Promise<{ enabled: boolean; reason: string | null }> {
  const role = normalizeRole(user.role);
  const s = canonicalSchool(user.schoolId);
  if (!role || role === 'SUPER_ADMIN' || !s || !user.id) return { enabled: true, reason: null };
  return cached(k.login(s, role, String(user.id)), LOGIN_TTL, async () => {
    const l = await getAccessStore().loadLogin(s, role, String(user.id));
    return { enabled: l ? l.enabled !== false : true, reason: l?.reason || null };
  });
}

export type FeatureState = { key: string; enabled: boolean; source: DecisionSource; blockedBy?: string };
export type PermissionState = { key: string; allowed: boolean; reason: DecisionReason; source: DecisionSource; feature: string };
export type AccessSnapshot = {
  version: number; role: string | null; schoolId: string | null; loginEnabled: boolean; loginReason: string | null;
  mode: EnforcementMode; planKey: string | null; features: FeatureState[]; permissions: PermissionState[];
};

function computeFeatures(input: FeatureInput): FeatureState[] {
  return FEATURES.map((f) => { const d = resolveFeature(f.key, input); return { key: f.key, enabled: d.enabled, source: d.source, blockedBy: d.blockedBy }; });
}

export async function getAccessSnapshot(user: MinimalUser): Promise<AccessSnapshot> {
  const role = normalizeRole(user.role);
  const mode = getEnforcementMode();
  const schoolId = canonicalSchool(user.schoolId);
  if (role === 'SUPER_ADMIN') {
    return {
      version: 0, role, schoolId, loginEnabled: true, loginReason: null, mode, planKey: null,
      features: FEATURES.map((f) => ({ key: f.key, enabled: true, source: 'super_admin' as DecisionSource })),
      permissions: PERMISSIONS.map((p) => ({ key: p.key, allowed: true, reason: 'SUPER_ADMIN' as DecisionReason, source: 'super_admin' as DecisionSource, feature: p.feature })),
    };
  }
  if (!role || !schoolId) {
    return { version: 0, role, schoolId, loginEnabled: true, loginReason: null, mode, planKey: null, features: [], permissions: [] };
  }
  const [ctx, plan, principal, login] = await Promise.all([
    loadSchoolContext(schoolId), loadPlanFeaturesFor(schoolId), loadPrincipalContext(schoolId, role, String(user.id)), checkLogin(user),
  ]);
  const fin: FeatureInput = { now: Date.now(), globalFeatures: ctx.globalFeatures, schoolOverrides: ctx.schoolOverrides, planFeatures: plan.features };
  const userOverrides = Object.fromEntries(Object.entries(principal.overrides).map(([key, v]) => [key, v.effect])) as Record<string, Effect>;
  const rolePermissions = ctx.rolePermissions[role] || {};
  const permissions = PERMISSIONS.map((p) => {
    const d = resolveAccess({ ...fin, role, permissionKey: p.key, loginEnabled: login.enabled, rolePermissions, userOverrides });
    return { key: p.key, allowed: d.allowed, reason: d.reason, source: d.source, feature: p.feature };
  });
  return {
    version: ctx.version, role, schoolId, loginEnabled: login.enabled, loginReason: login.reason, mode,
    planKey: plan.planKey, features: computeFeatures(fin), permissions,
  };
}

export async function evaluatePermission(user: MinimalUser, permissionKey: string): Promise<Decision> {
  const role = normalizeRole(user.role);
  if (role === 'SUPER_ADMIN') return { allowed: true, reason: 'SUPER_ADMIN', source: 'super_admin' };
  const perm = getPermission(permissionKey);
  if (!perm) return { allowed: false, reason: 'UNKNOWN_PERMISSION', source: 'catalog' };
  if (!role || !isBaseRole(role) || !perm.ceilingRoles.includes(role)) return { allowed: false, reason: 'CEILING', source: 'ceiling', feature: perm.feature };
  const schoolId = canonicalSchool(user.schoolId);
  if (!schoolId) return { allowed: false, reason: 'CEILING', source: 'ceiling', feature: perm.feature };
  const [ctx, plan, principal, login] = await Promise.all([
    loadSchoolContext(schoolId), loadPlanFeaturesFor(schoolId), loadPrincipalContext(schoolId, role, String(user.id)), checkLogin(user),
  ]);
  return resolveAccess({
    now: Date.now(), globalFeatures: ctx.globalFeatures, schoolOverrides: ctx.schoolOverrides, planFeatures: plan.features,
    role, permissionKey, loginEnabled: login.enabled, rolePermissions: ctx.rolePermissions[role] || {},
    userOverrides: Object.fromEntries(Object.entries(principal.overrides).map(([kk, v]) => [kk, v.effect])) as Record<string, Effect>,
  });
}

export async function evaluateFeature(user: MinimalUser, featureKey: string): Promise<FeatureDecision> {
  const role = normalizeRole(user.role);
  if (role === 'SUPER_ADMIN') return { enabled: true, source: 'super_admin' };
  const schoolId = canonicalSchool(user.schoolId);
  if (!schoolId) return { enabled: true, source: 'catalog' };
  const [ctx, plan] = await Promise.all([loadSchoolContext(schoolId), loadPlanFeaturesFor(schoolId)]);
  return resolveFeature(featureKey, { now: Date.now(), globalFeatures: ctx.globalFeatures, schoolOverrides: ctx.schoolOverrides, planFeatures: plan.features });
}

export function invalidateSchool(schoolId: string) {
  fastCache.invalidatePattern(`access:${schoolId}:`);
  fastCache.invalidatePattern(`access-login:${schoolId}:`);
}
export function invalidateAll() {
  fastCache.invalidatePattern('access:');
  fastCache.invalidatePattern('access-login:');
  fastCache.invalidatePattern('access-planfeatures:');
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
export type Actor = { id: string; role: Role; schoolId: string | null; ip: string | null };
const reasonRequired = (r: unknown, what: string) => {
  const s = typeof r === 'string' ? r.trim() : '';
  if (s.length < 3) throw new AccessError(400, 'REASON_REQUIRED', `A reason (min 3 characters) is required to ${what}.`);
  return s.slice(0, 500);
};
const assertBaseRole = (role: string): BaseRole => {
  if (!isBaseRole(role)) throw new AccessError(400, 'INVALID_ROLE', `Role must be one of ${BASE_ROLES.join(', ')}.`);
  return role;
};
const assertPermission = (key: string): PermissionDef => {
  const p = getPermission(key);
  if (!p) throw new AccessError(400, 'UNKNOWN_PERMISSION', `Unknown permission: ${key}`);
  return p;
};
const assertChanges = (changes: unknown): any[] => {
  if (!Array.isArray(changes) || changes.length === 0) throw new AccessError(400, 'INVALID_CHANGES', 'changes must be a non-empty array.');
  if (changes.length > 200) throw new AccessError(400, 'INVALID_CHANGES', 'At most 200 changes per request.');
  return changes;
};

/** Lock-out rule R10: at least one active SCHOOL_ADMIN with access.manage must remain. Runs inside the tx. */
async function assertNoLockout(tx: AccessTx, schoolId: string) {
  const admins = await getPrincipalDirectory().listActiveAdmins(schoolId);
  if (admins.length === 0) return; // nothing to protect (no SQL admins known)
  const roleAllowed = await tx.getRolePermission(schoolId, 'SCHOOL_ADMIN', 'access.manage');
  const overrides = await tx.listOverridesForPermission(schoolId, 'SCHOOL_ADMIN', 'access.manage');
  const disabled = new Set(await tx.listDisabledLogins(schoolId, 'SCHOOL_ADMIN'));
  const roleDefault = roleAllowed === null ? true : roleAllowed;
  const remaining = admins.filter((a) => !disabled.has(a.id) && (overrides[a.id] === 'ALLOW' || (overrides[a.id] !== 'DENY' && roleDefault)));
  if (remaining.length === 0) {
    throw new AccessError(409, 'LOCKOUT_PREVENTED', 'This change would leave the school without an active School Admin who can manage access.');
  }
}

export async function applyRoleChanges(actor: Actor, schoolId: string, roleParam: string, rawChanges: unknown) {
  const role = assertBaseRole(roleParam);
  const changes = assertChanges(rawChanges).map((c: any) => {
    const perm = assertPermission(String(c?.key || ''));
    if (!(c.allowed === true || c.allowed === false || c.allowed === null)) throw new AccessError(400, 'INVALID_CHANGES', `allowed must be true, false or null for ${perm.key}.`);
    const lock = roleToggleLock(perm, role);
    if (lock.locked) throw new AccessError(400, perm.ceilingRoles.includes(role) ? 'LOCKED' : 'CEILING', `${perm.key}: ${lock.reason}`);
    // Restrict-only: allowing is only meaningful within the ceiling (already checked above).
    return { perm, allowed: c.allowed as boolean | null };
  });
  const changed = await getAccessStore().transaction(async (tx) => {
    await tx.lockSchool(schoolId);
    const out: { key: string; before: boolean | null; after: boolean | null }[] = [];
    for (const { perm, allowed } of changes) {
      // Normalise: explicitly setting the catalog default is stored as "no override".
      const target = allowed === null ? null : (allowed === perm.defaultRoles.includes(role) ? null : allowed);
      const before = await tx.getRolePermission(schoolId, role, perm.key);
      if (before === target) continue;
      await tx.setRolePermission(schoolId, role, perm.key, target, actor.id);
      await tx.audit({ schoolId, actorId: actor.id, actorRole: actor.role, action: 'ROLE_PERMISSION_SET', targetType: 'ROLE', targetId: `${role}:${perm.key}`, before: { allowed: before }, after: { allowed: target }, ip: actor.ip });
      out.push({ key: perm.key, before, after: target });
    }
    if (out.length) { await assertNoLockout(tx, schoolId); await tx.bumpVersion(schoolId); }
    return out;
  });
  invalidateSchool(schoolId);
  return { changed };
}

type PrincipalTarget = { role: BaseRole; id: string; isOwner: boolean; isSelf: boolean };

export async function resolvePrincipalTarget(actor: Actor, schoolId: string, roleParam: string, id: string, forWrite: boolean): Promise<PrincipalTarget & { principal: any }> {
  const role = assertBaseRole(roleParam);
  const dir = getPrincipalDirectory();
  const principal = await dir.getPrincipal(schoolId, role, String(id));
  if (!principal) throw new AccessError(404, 'PRINCIPAL_NOT_FOUND', 'User not found in this school.');
  const ownerId = role === 'SCHOOL_ADMIN' ? await dir.getOwnerAdminId(schoolId) : null;
  const isOwner = Boolean(ownerId && ownerId === principal.id);
  const isSelf = String(actor.id) === principal.id;
  if (forWrite && role === 'SCHOOL_ADMIN' && actor.role !== 'SUPER_ADMIN') {
    const actorIsOwner = ownerId === String(actor.id);
    if (isOwner && !isSelf) throw new AccessError(403, 'OWNER_PROTECTED', 'The owner admin can only be changed by a Super Admin.');
    if (!isSelf && !actorIsOwner) throw new AccessError(403, 'ADMIN_PROTECTED', 'Only the owner admin can change another School Admin.');
  }
  return { role, id: principal.id, isOwner, isSelf, principal };
}

export async function applyPrincipalChanges(actor: Actor, schoolId: string, roleParam: string, id: string, rawChanges: unknown, reason: unknown) {
  const t = await resolvePrincipalTarget(actor, schoolId, roleParam, id, true);
  const changes = assertChanges(rawChanges).map((c: any) => {
    const perm = assertPermission(String(c?.key || ''));
    const effect = String(c?.effect || '').toUpperCase();
    if (!['ALLOW', 'DENY', 'INHERIT'].includes(effect)) throw new AccessError(400, 'INVALID_CHANGES', `effect must be ALLOW, DENY or INHERIT for ${perm.key}.`);
    const lock = principalToggleLock(perm, t.role);
    if (lock.locked) throw new AccessError(400, perm.ceilingRoles.includes(t.role) ? 'LOCKED' : 'CEILING', `${perm.key}: ${lock.reason}`);
    if (effect === 'DENY' && t.isSelf && (perm.key === 'access.manage' || perm.key === 'access.login.manage')) {
      throw new AccessError(400, 'SELF_LOCKOUT', 'You cannot remove your own access-management permission.');
    }
    return { perm, effect: effect === 'INHERIT' ? null : (effect as Effect) };
  });
  const needsReason = changes.some((c) => c.effect === 'DENY');
  const why = needsReason ? reasonRequired(reason, 'deny a permission') : (typeof reason === 'string' ? reason.trim().slice(0, 500) || null : null);
  const changed = await getAccessStore().transaction(async (tx) => {
    await tx.lockSchool(schoolId);
    const out: any[] = [];
    for (const { perm, effect } of changes) {
      const before = await tx.getUserOverride(schoolId, t.role, t.id, perm.key);
      if ((before?.effect || null) === effect) continue;
      await tx.setUserOverride(schoolId, t.role, t.id, perm.key, effect, effect ? why : null, actor.id);
      await tx.audit({ schoolId, actorId: actor.id, actorRole: actor.role, action: 'USER_OVERRIDE_SET', targetType: `PRINCIPAL:${t.role}`, targetId: t.id, before: { key: perm.key, effect: before?.effect || 'INHERIT' }, after: { key: perm.key, effect: effect || 'INHERIT', reason: why }, ip: actor.ip });
      out.push({ key: perm.key, before: before?.effect || 'INHERIT', after: effect || 'INHERIT' });
    }
    if (out.length) { if (t.role === 'SCHOOL_ADMIN') await assertNoLockout(tx, schoolId); await tx.bumpVersion(schoolId); }
    return out;
  });
  invalidateSchool(schoolId);
  return { changed };
}

export async function setPrincipalLogin(actor: Actor, schoolId: string, roleParam: string, id: string, enabled: unknown, reason: unknown) {
  if (typeof enabled !== 'boolean') throw new AccessError(400, 'INVALID_BODY', 'enabled must be true or false.');
  const t = await resolvePrincipalTarget(actor, schoolId, roleParam, id, true);
  if (!enabled && t.isSelf) throw new AccessError(400, 'SELF_LOCKOUT', 'You cannot disable your own login.');
  const why = enabled ? (typeof reason === 'string' ? reason.trim().slice(0, 500) || null : null) : reasonRequired(reason, 'disable a login');
  const result = await getAccessStore().transaction(async (tx) => {
    await tx.lockSchool(schoolId);
    const before = await tx.getLogin(schoolId, t.role, t.id);
    const beforeEnabled = before ? before.enabled : true;
    if (beforeEnabled === enabled) return { changed: false };
    // enabled=true is the default → remove the row; enabled=false is stored.
    await tx.setLogin(schoolId, t.role, t.id, enabled ? null : false, why, actor.id);
    await tx.audit({ schoolId, actorId: actor.id, actorRole: actor.role, action: 'LOGIN_SET', targetType: `PRINCIPAL:${t.role}`, targetId: t.id, before: { enabled: beforeEnabled }, after: { enabled, reason: why }, ip: actor.ip });
    if (t.role === 'SCHOOL_ADMIN') await assertNoLockout(tx, schoolId);
    await tx.bumpVersion(schoolId);
    return { changed: true };
  });
  invalidateSchool(schoolId);
  return result;
}

export async function resetPrincipal(actor: Actor, schoolId: string, roleParam: string, id: string) {
  const t = await resolvePrincipalTarget(actor, schoolId, roleParam, id, true);
  const removed = await getAccessStore().transaction(async (tx) => {
    await tx.lockSchool(schoolId);
    const existing = await tx.listUserOverrides(schoolId, t.role, t.id);
    const keys = Object.keys(existing);
    if (!keys.length) return [];
    for (const key of keys) await tx.setUserOverride(schoolId, t.role, t.id, key, null, null, actor.id);
    await tx.audit({ schoolId, actorId: actor.id, actorRole: actor.role, action: 'PRINCIPAL_RESET', targetType: `PRINCIPAL:${t.role}`, targetId: t.id, before: existing, after: {}, ip: actor.ip });
    if (t.role === 'SCHOOL_ADMIN') await assertNoLockout(tx, schoolId);
    await tx.bumpVersion(schoolId);
    return keys;
  });
  invalidateSchool(schoolId);
  return { removed };
}

// ---- Super admin: plans / schools / global ----
const assertToggleableFeature = (key: string) => {
  const f = getFeature(key);
  if (!f) throw new AccessError(400, 'UNKNOWN_FEATURE', `Unknown feature: ${key}`);
  if (f.core) throw new AccessError(400, 'CORE_FEATURE', `${key} is a core feature and cannot be turned off.`);
  return f;
};

export async function applyPlanChanges(actor: Actor, planKey: string, rawChanges: unknown) {
  const plans = await getAccessStore().listPlans();
  if (!plans.some((p) => p.planKey === planKey)) throw new AccessError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
  const changes = assertChanges(rawChanges).map((c: any) => {
    assertToggleableFeature(String(c?.feature || ''));
    if (typeof c.enabled !== 'boolean') throw new AccessError(400, 'INVALID_CHANGES', 'enabled must be boolean.');
    return { feature: String(c.feature), enabled: c.enabled as boolean };
  });
  const changed = await getAccessStore().transaction(async (tx) => {
    await tx.lockSchool(null);
    const out: any[] = [];
    for (const c of changes) {
      const before = await tx.getPlanFeature(planKey, c.feature);
      const beforeEff = before === null ? getFeature(c.feature)!.defaultEnabled : before;
      if (before !== null && before === c.enabled) continue;
      if (before === null && beforeEff === c.enabled) { await tx.setPlanFeature(planKey, c.feature, c.enabled, actor.id); continue; }
      await tx.setPlanFeature(planKey, c.feature, c.enabled, actor.id);
      await tx.audit({ schoolId: null, actorId: actor.id, actorRole: actor.role, action: 'PLAN_FEATURE_SET', targetType: 'PLAN', targetId: `${planKey}:${c.feature}`, before: { enabled: beforeEff }, after: { enabled: c.enabled, dependentsAffected: c.enabled ? [] : featureDependents(c.feature) }, ip: actor.ip });
      out.push({ feature: c.feature, before: beforeEff, after: c.enabled });
    }
    return out;
  });
  invalidateAll();
  return { changed };
}

export async function applySchoolFeatureChanges(actor: Actor, schoolId: string, rawChanges: unknown) {
  const changes = assertChanges(rawChanges).map((c: any) => {
    assertToggleableFeature(String(c?.feature || ''));
    const mode = String(c?.mode || '').toUpperCase();
    if (!['INHERIT', 'ON', 'OFF'].includes(mode)) throw new AccessError(400, 'INVALID_CHANGES', 'mode must be INHERIT, ON or OFF.');
    let expiresAt: string | null = null;
    if (c.expiresAt) {
      const t = Date.parse(String(c.expiresAt));
      if (!Number.isFinite(t) || t <= Date.now()) throw new AccessError(400, 'INVALID_EXPIRY', 'expiresAt must be a future date-time.');
      expiresAt = new Date(t).toISOString();
    }
    const reason = mode === 'INHERIT' ? null : reasonRequired(c.reason, 'override a school feature');
    return { feature: String(c.feature), value: mode === 'INHERIT' ? null : ({ mode, reason, expiresAt } as SchoolOverride) };
  });
  const changed = await getAccessStore().transaction(async (tx) => {
    await tx.lockSchool(schoolId);
    const out: any[] = [];
    for (const c of changes) {
      const before = await tx.getSchoolOverride(schoolId, c.feature);
      const same = (!before && !c.value) || (before && c.value && before.mode === c.value.mode && (before.expiresAt || null) === (c.value.expiresAt || null) && (before.reason || null) === (c.value.reason || null));
      if (same) continue;
      await tx.setSchoolOverride(schoolId, c.feature, c.value, actor.id);
      await tx.audit({ schoolId, actorId: actor.id, actorRole: actor.role, action: 'SCHOOL_FEATURE_SET', targetType: 'SCHOOL_FEATURE', targetId: c.feature, before: before || { mode: 'INHERIT' }, after: c.value || { mode: 'INHERIT' }, ip: actor.ip });
      out.push({ feature: c.feature, before: before?.mode || 'INHERIT', after: c.value?.mode || 'INHERIT' });
    }
    if (out.length) await tx.bumpVersion(schoolId);
    return out;
  });
  invalidateSchool(schoolId);
  return { changed };
}

export async function applyGlobalChanges(actor: Actor, rawChanges: unknown, reason: unknown, confirm: unknown) {
  if (confirm !== true) throw new AccessError(400, 'CONFIRMATION_REQUIRED', 'Global kill switches require { confirm: true }.');
  const why = reasonRequired(reason, 'change a global kill switch');
  const changes = assertChanges(rawChanges).map((c: any) => {
    assertToggleableFeature(String(c?.feature || ''));
    if (typeof c.enabled !== 'boolean') throw new AccessError(400, 'INVALID_CHANGES', 'enabled must be boolean.');
    return { feature: String(c.feature), enabled: c.enabled as boolean };
  });
  const changed = await getAccessStore().transaction(async (tx) => {
    await tx.lockSchool(null);
    const current = { ...(await tx.getGlobalFeatures()) };
    const out: any[] = [];
    for (const c of changes) {
      const before = current[c.feature] !== false;
      if (before === c.enabled) continue;
      if (c.enabled) delete current[c.feature]; else current[c.feature] = false;
      await tx.audit({ schoolId: null, actorId: actor.id, actorRole: actor.role, action: 'GLOBAL_FEATURE_SET', targetType: 'GLOBAL_FEATURE', targetId: c.feature, before: { enabled: before }, after: { enabled: c.enabled, reason: why }, ip: actor.ip });
      out.push({ feature: c.feature, before, after: c.enabled });
    }
    if (out.length) await tx.setGlobalFeatures(current, actor.id);
    return out;
  });
  invalidateAll();
  return { changed };
}

export { AccessStoreUnavailableError };
