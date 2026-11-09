/**
 * RBAC enforcement middleware.
 *
 * Modes (env RBAC_ENFORCEMENT, read per request): off | shadow (default) | enforce
 *   off     → nothing is computed; legacy behaviour.
 *   shadow  → decision computed; any would-be denial is logged as one structured line; never blocks.
 *   enforce → denials return 403 { code: FEATURE_DISABLED | PERMISSION_DENIED } / 401 ACCOUNT_DISABLED;
 *             store errors fail closed with 503 ACCESS_UNAVAILABLE.
 *
 * Defence in depth (R3): RBAC only ever REMOVES access. Existing requireAuth / requireRoles / inline
 * role and tenant checks are untouched and still run. A role outside a permission's ceiling is a
 * CEILING decision — RBAC does not manage that role for that permission, so the request is passed on
 * unchanged and the existing guards decide exactly as before (this is what keeps R1 exact).
 */
import type { Request, Response, NextFunction } from 'express';
import { findRouteBinding, getPermission } from './catalog';
import { Decision, EnforcementMode, checkLogin, evaluateFeature, evaluatePermission, getEnforcementMode } from './accessService';

type AnyUser = { id: string; role: any; schoolId?: string | null };

const loggedUnbound = new Set<string>();

export function logShadow(kind: string, data: Record<string, unknown>) {
  try { console.warn(`[RBAC_${kind}] ${JSON.stringify(data)}`); } catch { /* ignore */ }
}

function deny(res: Response, d: Decision, permission: string | null, feature: string | null) {
  if (d.reason === 'ACCOUNT_DISABLED') {
    return res.status(401).json({ message: 'Your account has been disabled by your school administrator.', code: 'ACCOUNT_DISABLED' });
  }
  if (d.reason === 'FEATURE_DISABLED') {
    return res.status(403).json({
      message: 'This feature is not enabled for your school.', code: 'FEATURE_DISABLED',
      feature: d.blockedByFeature || feature, permission,
    });
  }
  return res.status(403).json({ message: 'You do not have permission to perform this action.', code: 'PERMISSION_DENIED', feature, permission });
}

/** Shared decision handler for gate / requirePermission / requireFeature. */
async function decide(
  req: Request, res: Response, next: NextFunction, user: AnyUser | null | undefined,
  run: () => Promise<Decision>, permission: string | null, feature: string | null, mode: EnforcementMode,
) {
  if (mode === 'off' || !user) return next();
  let d: Decision;
  try {
    d = await run();
  } catch (err: any) {
    if (mode === 'enforce') {
      return res.status(503).json({ message: 'Access control is temporarily unavailable. Please retry.', code: 'ACCESS_UNAVAILABLE' });
    }
    logShadow('SHADOW_ERROR', { path: req.originalUrl.split('?')[0], method: req.method, permission, error: err?.code || 'error' });
    return next();
  }
  if (d.allowed || d.reason === 'CEILING' || d.reason === 'SUPER_ADMIN') return next();
  if (d.reason === 'UNKNOWN_PERMISSION') {
    logShadow('CONFIG', { problem: 'unknown_permission', permission });
    return next();
  }
  if (mode === 'shadow') {
    logShadow('SHADOW', {
      wouldDeny: true, reason: d.reason, permission, feature: d.blockedByFeature || feature,
      method: req.method, path: req.originalUrl.split('?')[0], uid: String(user.id), role: String(user.role), school: user.schoolId || null,
    });
    return next();
  }
  return deny(res, d, permission, feature);
}

/**
 * Global gate mounted once in app.ts BEFORE the route mounts. It maps method+path to the catalog
 * binding and evaluates it. It only needs a VERIFIED identity: if req.user is not populated yet it
 * verifies the bearer token itself (without populating req.user, so legacy semantics are untouched);
 * unauthenticated / invalid-token requests pass through and the existing guards answer 401 as today.
 */
export function rbacGate(decodeToken: (req: Request) => AnyUser | null) {
  return (req: Request, res: Response, next: NextFunction) => {
    const mode = getEnforcementMode();
    if (mode === 'off' || req.method === 'OPTIONS' || req.method === 'HEAD') return next();
    const path = req.path || '/';
    const binding = findRouteBinding(req.method, path);
    if (!binding) {
      if (/^\/api(\/|$)/i.test(path)) {
        const key = `${req.method} ${path}`;
        if (!loggedUnbound.has(key) && loggedUnbound.size < 500) { loggedUnbound.add(key); logShadow('UNBOUND', { method: req.method, path }); }
      }
      return next();
    }
    if (!binding.permission) return next();
    const user = ((req as any).user as AnyUser | undefined) || decodeToken(req);
    const permission = binding.permission;
    return decide(req, res, next, user, () => evaluatePermission(user!, permission), permission, binding.feature, mode);
  };
}

/** Explicit per-route guard. Must run AFTER requireAuth/requireRoles. */
export function requirePermission(permissionKey: string) {
  if (!getPermission(permissionKey)) throw new Error(`[RBAC] requirePermission: unknown permission ${permissionKey}`);
  const feature = getPermission(permissionKey)!.feature;
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AnyUser | undefined;
    return decide(req, res, next, user, () => evaluatePermission(user!, permissionKey), permissionKey, feature, getEnforcementMode());
  };
}

/** Explicit per-route feature guard. Must run AFTER requireAuth/requireRoles. */
export function requireFeature(featureKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AnyUser | undefined;
    return decide(req, res, next, user, async () => {
      const f = await evaluateFeature(user!, featureKey);
      return f.enabled
        ? { allowed: true, reason: 'DEFAULT_ALLOW', source: f.source, feature: featureKey }
        : { allowed: false, reason: 'FEATURE_DISABLED', source: f.source, feature: featureKey, blockedByFeature: f.blockedBy };
    }, null, featureKey, getEnforcementMode());
  };
}

/**
 * Account status check called by requireAuth after a token verifies (cached 30 s per user).
 * Smallest blast radius: one call site inside requireAuth covers every authenticated route, including
 * routers that authenticate per-route; it is a no-op for SUPER_ADMIN, users without a school, and when
 * mode is off. Runs at most once per request.
 */
export function enforceAccountStatus(req: Request, res: Response, next: NextFunction) {
  const mode = getEnforcementMode();
  const user = (req as any).user as AnyUser | undefined;
  if (mode === 'off' || !user || (req as any).__rbacAccountChecked) return next();
  (req as any).__rbacAccountChecked = true;
  checkLogin(user).then((l) => {
    if (l.enabled) return next();
    if (mode === 'shadow') {
      logShadow('SHADOW', { wouldDeny: true, reason: 'ACCOUNT_DISABLED', method: req.method, path: req.originalUrl.split('?')[0], uid: String(user.id), role: String(user.role), school: user.schoolId || null });
      return next();
    }
    return res.status(401).json({ message: 'Your account has been disabled by your school administrator.', code: 'ACCOUNT_DISABLED' });
  }).catch((err: any) => {
    if (mode === 'enforce') return res.status(503).json({ message: 'Access control is temporarily unavailable. Please retry.', code: 'ACCESS_UNAVAILABLE' });
    logShadow('SHADOW_ERROR', { where: 'account_status', error: err?.code || 'error' });
    return next();
  });
}

/**
 * POST /api/auth/login gate: intercepts the successful { token, user } response and refuses it when the
 * account's login is disabled (enforce mode). Never touches the credential logic.
 */
export function loginAccountGate(_req: Request, res: Response, next: NextFunction) {
  const mode = getEnforcementMode();
  if (mode === 'off') return next();
  const original = res.json.bind(res);
  (res as any).json = (body: any) => {
    if (!body || !body.token || !body.user || res.statusCode >= 300) return original(body);
    const u = body.user as AnyUser;
    checkLogin(u).then((l) => {
      if (l.enabled) return original(body);
      if (mode === 'shadow') {
        logShadow('SHADOW', { wouldDeny: true, reason: 'ACCOUNT_DISABLED', where: 'login', uid: String(u.id), role: String(u.role), school: u.schoolId || null });
        return original(body);
      }
      res.status(401);
      return original({ message: 'Your account has been disabled by your school administrator. Please contact them.', code: 'ACCOUNT_DISABLED' });
    }).catch(() => {
      if (mode === 'enforce') { res.status(503); return original({ message: 'Access control is temporarily unavailable. Please retry.', code: 'ACCESS_UNAVAILABLE' }); }
      return original(body);
    });
    return res;
  };
  next();
}
