import { Router, Response } from 'express';
import { AuthRequest, requireRoles } from '../middleware/auth';
import { isSameSchool } from '../utils/tenant';
import {
  BASE_ROLES, FEATURES, PERMISSIONS, featureDependents, isBaseRole, normalizeRole,
  principalToggleLock, roleToggleLock,
} from '../rbac/catalog';
import {
  AccessError, Actor, applyPrincipalChanges, applyRoleChanges, canonicalSchool, evaluatePermission,
  getAccessSnapshot, getEnforcementMode, loadSchoolContext, resetPrincipal, resolveAccess, resolveFeature,
  resolvePrincipalTarget, setPrincipalLogin,
} from '../rbac/accessService';
import { AccessStoreUnavailableError, AccessUnavailableError, getAccessStore } from '../rbac/accessStore';
import { getPrincipalDirectory } from '../rbac/principalDirectory';

/**
 * /api/access — school-scoped access control (mounted with requireAuth in app.ts).
 * Scope = caller's canonical school; SUPER_ADMIN must pass ?schoolId= (validated).
 * Reads require access.manage, login changes require access.login.manage (SUPER_ADMIN always allowed).
 * These checks are ALWAYS enforced (new API, no legacy behaviour to preserve).
 */
const router = Router();

export function sendAccessError(res: Response, err: any) {
  if (err instanceof AccessError) return res.status(err.status).json({ message: err.message, code: err.code, ...(err.details || {}) });
  if (err instanceof AccessStoreUnavailableError) return res.status(503).json({ message: err.message, code: 'ACCESS_STORE_UNAVAILABLE' });
  if (err instanceof AccessUnavailableError) return res.status(503).json({ message: err.message, code: 'ACCESS_UNAVAILABLE' });
  console.error('[RBAC] access API error:', err?.message || err);
  return res.status(500).json({ message: 'Unable to process access control request', code: 'ACCESS_ERROR' });
}

export function actorOf(req: AuthRequest): Actor {
  const u = req.user!;
  return { id: String(u.id), role: normalizeRole(u.role) as any, schoolId: canonicalSchool(u.schoolId), ip: (req.ip || '').slice(0, 64) || null };
}

async function resolveScope(req: AuthRequest): Promise<string> {
  const u = req.user!;
  const role = normalizeRole(u.role);
  const requested = typeof req.query.schoolId === 'string' ? req.query.schoolId.trim() : '';
  if (role === 'SUPER_ADMIN') {
    if (!requested) throw new AccessError(400, 'SCHOOL_REQUIRED', 'schoolId query parameter is required for Super Admin.');
    const sid = canonicalSchool(requested)!;
    if (!(await getPrincipalDirectory().schoolExists(sid))) throw new AccessError(404, 'SCHOOL_NOT_FOUND', 'School not found.');
    return sid;
  }
  const own = canonicalSchool(u.schoolId);
  if (!own) throw new AccessError(403, 'SCHOOL_REQUIRED', 'School context required.');
  if (requested && !isSameSchool(canonicalSchool(requested), own)) throw new AccessError(403, 'CROSS_TENANT', 'You can only manage your own school.');
  return own;
}

async function authorize(req: AuthRequest, permission: string) {
  const u = req.user!;
  if (normalizeRole(u.role) === 'SUPER_ADMIN') return;
  const d = await evaluatePermission(u, permission);
  if (!d.allowed) throw new AccessError(403, 'PERMISSION_DENIED', 'You do not have permission to manage access.', { permission });
}

const adminOnly = requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN');
const page = (v: any) => Math.max(1, Math.min(10_000, parseInt(String(v || '1'), 10) || 1));

// ---------------------------------------------------------------------------
router.get('/me', async (req: AuthRequest, res) => {
  try { res.json(await getAccessSnapshot(req.user!)); } catch (err) { sendAccessError(res, err); }
});

router.get('/catalog', adminOnly, async (req: AuthRequest, res) => {
  try {
    await authorize(req, 'access.manage');
    res.json({
      mode: getEnforcementMode(),
      store: await getAccessStore().status(),
      roles: BASE_ROLES,
      features: FEATURES.map((f) => ({ ...f, dependents: featureDependents(f.key) })),
      permissions: PERMISSIONS.map((p) => ({
        ...p,
        roleLocks: Object.fromEntries(BASE_ROLES.map((r) => [r, roleToggleLock(p, r)])),
        principalLocks: Object.fromEntries(BASE_ROLES.map((r) => [r, principalToggleLock(p, r)])),
      })),
    });
  } catch (err) { sendAccessError(res, err); }
});

router.get('/roles', adminOnly, async (req: AuthRequest, res) => {
  try {
    const schoolId = await resolveScope(req);
    await authorize(req, 'access.manage');
    const ctx = await loadSchoolContext(schoolId);
    const store = getAccessStore();
    const planKey = await store.getPlanKey(schoolId);
    const planFeatures = planKey ? await store.loadPlanFeatures(planKey) : null;
    const fin = { now: Date.now(), globalFeatures: ctx.globalFeatures, schoolOverrides: ctx.schoolOverrides, planFeatures };
    const counts: Record<string, number | null> = {};
    for (const r of BASE_ROLES) counts[r] = await getPrincipalDirectory().countByRole(schoolId, r).catch(() => null);
    res.json({
      schoolId, version: ctx.version, mode: getEnforcementMode(), counts,
      features: FEATURES.map((f) => ({ key: f.key, ...resolveFeature(f.key, fin) })),
      matrix: PERMISSIONS.map((p) => ({
        key: p.key, feature: p.feature,
        roles: Object.fromEntries(BASE_ROLES.map((r) => {
          const stored = ctx.rolePermissions[r]?.[p.key];
          const lock = roleToggleLock(p, r);
          return [r, {
            inCeiling: p.ceilingRoles.includes(r),
            allowed: p.ceilingRoles.includes(r) ? (stored === undefined ? p.defaultRoles.includes(r) : stored) : false,
            source: stored === undefined ? 'default' : 'school',
            locked: lock.locked, lockReason: lock.reason || null,
          }];
        })),
      })),
    });
  } catch (err) { sendAccessError(res, err); }
});

router.put('/roles/:role/permissions', adminOnly, async (req: AuthRequest, res) => {
  try {
    const schoolId = await resolveScope(req);
    await authorize(req, 'access.manage');
    const out = await applyRoleChanges(actorOf(req), schoolId, String(req.params.role), req.body?.changes);
    res.json({ ok: true, ...out });
  } catch (err) { sendAccessError(res, err); }
});

router.get('/principals', adminOnly, async (req: AuthRequest, res) => {
  try {
    const schoolId = await resolveScope(req);
    await authorize(req, 'access.manage');
    const role = String(req.query.role || 'TEACHER').toUpperCase();
    if (!isBaseRole(role)) throw new AccessError(400, 'INVALID_ROLE', `Role must be one of ${BASE_ROLES.join(', ')}.`);
    const pageSize = Math.max(1, Math.min(100, parseInt(String(req.query.pageSize || '25'), 10) || 25));
    const dir = getPrincipalDirectory();
    const [list, summaries, ownerId] = await Promise.all([
      dir.listPrincipals(schoolId, role, String(req.query.search || '').trim().slice(0, 100), page(req.query.page), pageSize),
      getAccessStore().listPrincipalSummaries(schoolId, role),
      role === 'SCHOOL_ADMIN' ? dir.getOwnerAdminId(schoolId) : Promise.resolve(null),
    ]);
    res.json({
      total: list.total, page: page(req.query.page), pageSize,
      items: list.items.map((p) => ({
        ...p, isOwner: ownerId === p.id, isSelf: p.id === String(req.user!.id),
        overrides: summaries[p.id]?.overrides || 0, loginEnabled: summaries[p.id] ? summaries[p.id].loginEnabled : true,
      })),
    });
  } catch (err) { sendAccessError(res, err); }
});

router.get('/principals/:role/:id', adminOnly, async (req: AuthRequest, res) => {
  try {
    const schoolId = await resolveScope(req);
    await authorize(req, 'access.manage');
    const t = await resolvePrincipalTarget(actorOf(req), schoolId, String(req.params.role), String(req.params.id), false);
    let editable = true; let editReason: string | null = null;
    try { await resolvePrincipalTarget(actorOf(req), schoolId, String(req.params.role), String(req.params.id), true); }
    catch (e: any) { editable = false; editReason = e?.message || null; }
    const store = getAccessStore();
    const [ctx, principal, planKey] = await Promise.all([
      loadSchoolContext(schoolId), store.loadPrincipal(schoolId, t.role, t.id), store.getPlanKey(schoolId),
    ]);
    const planFeatures = planKey ? await store.loadPlanFeatures(planKey) : null;
    const loginEnabled = principal.login ? principal.login.enabled !== false : true;
    const userOverrides = Object.fromEntries(Object.entries(principal.overrides).map(([k, v]) => [k, v.effect])) as any;
    const fin = { now: Date.now(), globalFeatures: ctx.globalFeatures, schoolOverrides: ctx.schoolOverrides, planFeatures };
    res.json({
      principal: t.principal, isOwner: t.isOwner, isSelf: t.isSelf, editable, editReason,
      login: { enabled: loginEnabled, reason: principal.login?.reason || null, updatedBy: principal.login?.updatedBy || null, updatedAt: principal.login?.updatedAt || null },
      permissions: PERMISSIONS.filter((p) => p.ceilingRoles.includes(t.role)).map((p) => {
        // Effective permission ignoring login status (login shown separately).
        const d = resolveAccess({ ...fin, role: t.role, permissionKey: p.key, loginEnabled: true, rolePermissions: ctx.rolePermissions[t.role] || {}, userOverrides });
        const lock = principalToggleLock(p, t.role);
        const o = principal.overrides[p.key];
        return {
          key: p.key, feature: p.feature, allowed: d.allowed, reason: d.reason, source: d.source,
          override: o ? { effect: o.effect, reason: o.reason, updatedBy: o.updatedBy || null, updatedAt: o.updatedAt || null } : null,
          locked: lock.locked, lockReason: lock.reason || null,
        };
      }),
    });
  } catch (err) { sendAccessError(res, err); }
});

router.put('/principals/:role/:id/permissions', adminOnly, async (req: AuthRequest, res) => {
  try {
    const schoolId = await resolveScope(req);
    await authorize(req, 'access.manage');
    const out = await applyPrincipalChanges(actorOf(req), schoolId, String(req.params.role), String(req.params.id), req.body?.changes, req.body?.reason);
    res.json({ ok: true, ...out });
  } catch (err) { sendAccessError(res, err); }
});

router.put('/principals/:role/:id/login', adminOnly, async (req: AuthRequest, res) => {
  try {
    const schoolId = await resolveScope(req);
    await authorize(req, 'access.manage');
    await authorize(req, 'access.login.manage');
    const out = await setPrincipalLogin(actorOf(req), schoolId, String(req.params.role), String(req.params.id), req.body?.enabled, req.body?.reason);
    res.json({ ok: true, ...out });
  } catch (err) { sendAccessError(res, err); }
});

router.post('/principals/:role/:id/reset', adminOnly, async (req: AuthRequest, res) => {
  try {
    const schoolId = await resolveScope(req);
    await authorize(req, 'access.manage');
    const out = await resetPrincipal(actorOf(req), schoolId, String(req.params.role), String(req.params.id));
    res.json({ ok: true, ...out });
  } catch (err) { sendAccessError(res, err); }
});

router.get('/audit', adminOnly, async (req: AuthRequest, res) => {
  try {
    const schoolId = await resolveScope(req);
    await authorize(req, 'access.manage');
    const target = typeof req.query.target === 'string' ? req.query.target.slice(0, 200) : undefined;
    res.json(await getAccessStore().listAudit(schoolId, page(req.query.page), 25, target));
  } catch (err) { sendAccessError(res, err); }
});

export default router;
