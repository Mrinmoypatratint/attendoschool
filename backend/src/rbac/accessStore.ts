/**
 * RBAC persistence. All school ids passed here are CANONICAL (utils/tenant.ts canonicalSchoolId).
 *
 * Behaviour contract (R7, R8):
 *  - SQL not configured (DisabledPool)  → status DISABLED; reads return empty (legacy defaults);
 *                                         writes throw AccessStoreUnavailableError (HTTP 503).
 *  - RBAC tables missing (42P01)       → status NOT_INSTALLED; console.warn once; reads return empty;
 *                                         writes throw AccessStoreUnavailableError.
 *  - any other DB error                → AccessUnavailableError (callers fail closed in enforce mode).
 */
import { pool, isPostgresConfigured } from '../db';

export type StoreStatus = 'READY' | 'NOT_INSTALLED' | 'DISABLED' | 'UNKNOWN';
export type Effect = 'ALLOW' | 'DENY';
export type SchoolOverride = { mode: 'ON' | 'OFF'; reason: string | null; expiresAt: string | null; updatedBy?: string | null; updatedAt?: string | null };

export type SchoolContext = {
  version: number;
  globalFeatures: Record<string, boolean>;
  schoolOverrides: Record<string, SchoolOverride>;
  /** role → permission → allowed */
  rolePermissions: Record<string, Record<string, boolean>>;
};
export type PrincipalContext = {
  overrides: Record<string, { effect: Effect; reason: string | null; updatedBy?: string | null; updatedAt?: string | null }>;
  login: { enabled: boolean; reason: string | null; updatedBy?: string | null; updatedAt?: string | null } | null;
};
export type AuditEntry = {
  schoolId: string | null; actorId: string; actorRole: string; action: string;
  targetType: string; targetId: string | null; before: any; after: any; ip: string | null;
};
export type AuditRow = AuditEntry & { id: string; createdAt: string };

export class AccessStoreUnavailableError extends Error {
  code = 'ACCESS_STORE_UNAVAILABLE';
  constructor(message = 'Access control storage is not available (SQL not configured or RBAC tables not installed).') { super(message); }
}
export class AccessUnavailableError extends Error {
  code = 'ACCESS_UNAVAILABLE';
  constructor(message = 'Access control check failed. Please retry.') { super(message); }
}

/** Operations available inside one write transaction. */
export interface AccessTx {
  lockSchool(schoolId: string | null): Promise<void>;
  getRolePermission(schoolId: string, role: string, key: string): Promise<boolean | null>;
  setRolePermission(schoolId: string, role: string, key: string, allowed: boolean | null, actor: string): Promise<void>;
  getUserOverride(schoolId: string, role: string, id: string, key: string): Promise<{ effect: Effect; reason: string | null } | null>;
  listUserOverrides(schoolId: string, role: string, id: string): Promise<Record<string, Effect>>;
  setUserOverride(schoolId: string, role: string, id: string, key: string, effect: Effect | null, reason: string | null, actor: string): Promise<void>;
  getLogin(schoolId: string, role: string, id: string): Promise<{ enabled: boolean; reason: string | null } | null>;
  setLogin(schoolId: string, role: string, id: string, enabled: boolean | null, reason: string | null, actor: string): Promise<void>;
  /** user overrides for one permission across all principals of a role in a school (lock-out checks) */
  listOverridesForPermission(schoolId: string, role: string, key: string): Promise<Record<string, Effect>>;
  listDisabledLogins(schoolId: string, role: string): Promise<string[]>;
  getPlanFeature(planKey: string, feature: string): Promise<boolean | null>;
  setPlanFeature(planKey: string, feature: string, enabled: boolean, actor: string): Promise<void>;
  getSchoolOverride(schoolId: string, feature: string): Promise<SchoolOverride | null>;
  setSchoolOverride(schoolId: string, feature: string, value: SchoolOverride | null, actor: string): Promise<void>;
  getGlobalFeatures(): Promise<Record<string, boolean>>;
  setGlobalFeatures(value: Record<string, boolean>, actor: string): Promise<void>;
  bumpVersion(schoolId: string): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}

export interface AccessStore {
  status(): Promise<StoreStatus>;
  loadSchoolContext(schoolId: string): Promise<SchoolContext>;
  loadPrincipal(schoolId: string, role: string, id: string): Promise<PrincipalContext>;
  loadLogin(schoolId: string, role: string, id: string): Promise<PrincipalContext['login']>;
  getPlanKey(schoolId: string): Promise<string | null>;
  loadPlanFeatures(planKey: string): Promise<Record<string, boolean>>;
  listPlans(): Promise<{ planKey: string; name: string; isActive: boolean; schoolCount: number }[]>;
  listAllPlanFeatures(): Promise<Record<string, Record<string, boolean>>>;
  listPrincipalSummaries(schoolId: string, role: string): Promise<Record<string, { overrides: number; loginEnabled: boolean }>>;
  listAudit(schoolId: string | null, page: number, pageSize: number, target?: string): Promise<{ items: AuditRow[]; total: number }>;
  transaction<T>(fn: (tx: AccessTx) => Promise<T>): Promise<T>;
}

// ---------------------------------------------------------------------------
// SQL implementation
// ---------------------------------------------------------------------------
const GLOBAL_KEY = 'features.global';
let warnedMissing = false;
let installedCache: { at: number; status: StoreStatus } | null = null;

function isMissingTable(err: any) { return err && (err.code === '42P01' || err.code === '42703'); }
function markMissing(err: any) {
  installedCache = { at: Date.now(), status: 'NOT_INSTALLED' };
  if (!warnedMissing) {
    warnedMissing = true;
    console.warn(`[RBAC] RBAC tables are not installed (${err?.code}). Using legacy defaults; writes return 503. Run migration 051_rbac_feature_control.sql.`);
  }
}

async function readQuery<T = any>(text: string, params: any[] = []): Promise<T[] | null> {
  if (!isPostgresConfigured) return null;
  try {
    const r = await pool.query(text, params);
    return r.rows as T[];
  } catch (err: any) {
    if (isMissingTable(err)) { markMissing(err); return null; }
    throw new AccessUnavailableError(`Access control check failed (${err?.code || 'db_error'}).`);
  }
}

class SqlTx implements AccessTx {
  constructor(private c: any) {}
  async lockSchool(schoolId: string | null) { await this.c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`rbac:${schoolId || 'platform'}`]); }
  async getRolePermission(s: string, role: string, key: string) {
    const r = await this.c.query(`SELECT allowed FROM school_role_permissions WHERE school_id=$1 AND role=$2 AND permission_key=$3`, [s, role, key]);
    return r.rows.length ? Boolean(r.rows[0].allowed) : null;
  }
  async setRolePermission(s: string, role: string, key: string, allowed: boolean | null, actor: string) {
    if (allowed === null) await this.c.query(`DELETE FROM school_role_permissions WHERE school_id=$1 AND role=$2 AND permission_key=$3`, [s, role, key]);
    else await this.c.query(
      `INSERT INTO school_role_permissions(school_id,role,permission_key,allowed,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,NOW())
       ON CONFLICT(school_id,role,permission_key) DO UPDATE SET allowed=EXCLUDED.allowed,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [s, role, key, allowed, actor]);
  }
  async getUserOverride(s: string, role: string, id: string, key: string) {
    const r = await this.c.query(`SELECT effect,reason FROM user_permission_overrides WHERE school_id=$1 AND principal_role=$2 AND principal_id=$3 AND permission_key=$4`, [s, role, id, key]);
    return r.rows.length ? { effect: r.rows[0].effect as Effect, reason: r.rows[0].reason } : null;
  }
  async listUserOverrides(s: string, role: string, id: string) {
    const r = await this.c.query(`SELECT permission_key,effect FROM user_permission_overrides WHERE school_id=$1 AND principal_role=$2 AND principal_id=$3`, [s, role, id]);
    return Object.fromEntries(r.rows.map((x: any) => [x.permission_key, x.effect]));
  }
  async setUserOverride(s: string, role: string, id: string, key: string, effect: Effect | null, reason: string | null, actor: string) {
    if (effect === null) await this.c.query(`DELETE FROM user_permission_overrides WHERE school_id=$1 AND principal_role=$2 AND principal_id=$3 AND permission_key=$4`, [s, role, id, key]);
    else await this.c.query(
      `INSERT INTO user_permission_overrides(school_id,principal_role,principal_id,permission_key,effect,reason,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT(school_id,principal_role,principal_id,permission_key) DO UPDATE SET effect=EXCLUDED.effect,reason=EXCLUDED.reason,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [s, role, id, key, effect, reason, actor]);
  }
  async getLogin(s: string, role: string, id: string) {
    const r = await this.c.query(`SELECT login_enabled,reason FROM user_login_controls WHERE school_id=$1 AND principal_role=$2 AND principal_id=$3`, [s, role, id]);
    return r.rows.length ? { enabled: Boolean(r.rows[0].login_enabled), reason: r.rows[0].reason } : null;
  }
  async setLogin(s: string, role: string, id: string, enabled: boolean | null, reason: string | null, actor: string) {
    if (enabled === null) await this.c.query(`DELETE FROM user_login_controls WHERE school_id=$1 AND principal_role=$2 AND principal_id=$3`, [s, role, id]);
    else await this.c.query(
      `INSERT INTO user_login_controls(school_id,principal_role,principal_id,login_enabled,reason,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT(school_id,principal_role,principal_id) DO UPDATE SET login_enabled=EXCLUDED.login_enabled,reason=EXCLUDED.reason,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [s, role, id, enabled, reason, actor]);
  }
  async listOverridesForPermission(s: string, role: string, key: string) {
    const r = await this.c.query(`SELECT principal_id,effect FROM user_permission_overrides WHERE school_id=$1 AND principal_role=$2 AND permission_key=$3`, [s, role, key]);
    return Object.fromEntries(r.rows.map((x: any) => [x.principal_id, x.effect]));
  }
  async listDisabledLogins(s: string, role: string) {
    const r = await this.c.query(`SELECT principal_id FROM user_login_controls WHERE school_id=$1 AND principal_role=$2 AND login_enabled=FALSE`, [s, role]);
    return r.rows.map((x: any) => String(x.principal_id));
  }
  async getPlanFeature(plan: string, f: string) {
    const r = await this.c.query(`SELECT enabled FROM plan_features WHERE plan_key=$1 AND feature_key=$2`, [plan, f]);
    return r.rows.length ? Boolean(r.rows[0].enabled) : null;
  }
  async setPlanFeature(plan: string, f: string, enabled: boolean, actor: string) {
    await this.c.query(
      `INSERT INTO plan_features(plan_key,feature_key,enabled,updated_by,updated_at) VALUES($1,$2,$3,$4,NOW())
       ON CONFLICT(plan_key,feature_key) DO UPDATE SET enabled=EXCLUDED.enabled,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [plan, f, enabled, actor]);
  }
  async getSchoolOverride(s: string, f: string) {
    const r = await this.c.query(`SELECT mode,reason,expires_at FROM school_feature_overrides WHERE school_id=$1 AND feature_key=$2`, [s, f]);
    return r.rows.length ? { mode: r.rows[0].mode, reason: r.rows[0].reason, expiresAt: r.rows[0].expires_at ? new Date(r.rows[0].expires_at).toISOString() : null } : null;
  }
  async setSchoolOverride(s: string, f: string, v: SchoolOverride | null, actor: string) {
    if (!v) await this.c.query(`DELETE FROM school_feature_overrides WHERE school_id=$1 AND feature_key=$2`, [s, f]);
    else await this.c.query(
      `INSERT INTO school_feature_overrides(school_id,feature_key,mode,reason,expires_at,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT(school_id,feature_key) DO UPDATE SET mode=EXCLUDED.mode,reason=EXCLUDED.reason,expires_at=EXCLUDED.expires_at,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [s, f, v.mode, v.reason, v.expiresAt, actor]);
  }
  async getGlobalFeatures() {
    const r = await this.c.query(`SELECT value FROM platform_settings WHERE key=$1`, [GLOBAL_KEY]);
    return (r.rows[0]?.value && typeof r.rows[0].value === 'object') ? r.rows[0].value : {};
  }
  async setGlobalFeatures(value: Record<string, boolean>, actor: string) {
    await this.c.query(
      `INSERT INTO platform_settings(key,value,description,updated_at) VALUES($1,$2::jsonb,$3,NOW())
       ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,
      [GLOBAL_KEY, JSON.stringify(value), `Global feature kill switches (last change by ${actor})`]);
  }
  async bumpVersion(s: string) {
    await this.c.query(`INSERT INTO access_versions(school_id,version) VALUES($1,1) ON CONFLICT(school_id) DO UPDATE SET version=access_versions.version+1`, [s]);
  }
  async audit(e: AuditEntry) {
    await this.c.query(
      `INSERT INTO access_audit_log(school_id,actor_id,actor_role,action,target_type,target_id,before,after,ip) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
      [e.schoolId, e.actorId, e.actorRole, e.action, e.targetType, e.targetId, JSON.stringify(e.before ?? null), JSON.stringify(e.after ?? null), e.ip]);
  }
}

export class SqlAccessStore implements AccessStore {
  async status(): Promise<StoreStatus> {
    if (!isPostgresConfigured) return 'DISABLED';
    if (installedCache && Date.now() - installedCache.at < 60_000) return installedCache.status;
    try {
      const r = await pool.query(`SELECT to_regclass('public.access_audit_log') AS a, to_regclass('public.user_login_controls') AS b`);
      const ok = Boolean(r.rows[0]?.a && r.rows[0]?.b);
      if (!ok) markMissing({ code: '42P01' });
      installedCache = { at: Date.now(), status: ok ? 'READY' : 'NOT_INSTALLED' };
      return installedCache.status;
    } catch {
      return 'UNKNOWN';
    }
  }

  async loadSchoolContext(schoolId: string): Promise<SchoolContext> {
    const rows = await readQuery(`
      SELECT
        (SELECT value FROM platform_settings WHERE key=$2) AS global,
        (SELECT version FROM access_versions WHERE school_id=$1) AS version,
        (SELECT COALESCE(json_agg(json_build_object('f',feature_key,'m',mode,'r',reason,'e',expires_at,'u',updated_by,'t',updated_at)),'[]'::json)
           FROM school_feature_overrides WHERE school_id=$1) AS overrides,
        (SELECT COALESCE(json_agg(json_build_object('r',role,'k',permission_key,'a',allowed)),'[]'::json)
           FROM school_role_permissions WHERE school_id=$1) AS roles`, [schoolId, GLOBAL_KEY]);
    const row: any = rows?.[0] || {};
    const schoolOverrides: Record<string, SchoolOverride> = {};
    for (const o of row.overrides || []) schoolOverrides[o.f] = { mode: o.m, reason: o.r, expiresAt: o.e ? new Date(o.e).toISOString() : null, updatedBy: o.u, updatedAt: o.t };
    const rolePermissions: Record<string, Record<string, boolean>> = {};
    for (const x of row.roles || []) (rolePermissions[x.r] ||= {})[x.k] = Boolean(x.a);
    return {
      version: Number(row.version || 0),
      globalFeatures: row.global && typeof row.global === 'object' ? row.global : {},
      schoolOverrides,
      rolePermissions,
    };
  }

  async loadPrincipal(schoolId: string, role: string, id: string): Promise<PrincipalContext> {
    const rows = await readQuery(`
      SELECT
        (SELECT COALESCE(json_agg(json_build_object('k',permission_key,'e',effect,'r',reason,'u',updated_by,'t',updated_at)),'[]'::json)
           FROM user_permission_overrides WHERE school_id=$1 AND principal_role=$2 AND principal_id=$3) AS overrides,
        (SELECT json_build_object('enabled',login_enabled,'reason',reason,'updatedBy',updated_by,'updatedAt',updated_at)
           FROM user_login_controls WHERE school_id=$1 AND principal_role=$2 AND principal_id=$3) AS login`, [schoolId, role, id]);
    const row: any = rows?.[0] || {};
    const overrides: PrincipalContext['overrides'] = {};
    for (const o of row.overrides || []) overrides[o.k] = { effect: o.e, reason: o.r, updatedBy: o.u, updatedAt: o.t };
    return { overrides, login: row.login || null };
  }

  async loadLogin(schoolId: string, role: string, id: string) {
    const rows = await readQuery(`SELECT login_enabled,reason FROM user_login_controls WHERE school_id=$1 AND principal_role=$2 AND principal_id=$3`, [schoolId, role, id]);
    if (!rows || !rows.length) return null;
    return { enabled: Boolean((rows[0] as any).login_enabled), reason: (rows[0] as any).reason || null };
  }

  /** Delegates to the EXISTING subscription service — no plan/expiry logic re-implemented. */
  async getPlanKey(schoolId: string): Promise<string | null> {
    if (!isPostgresConfigured || !/^[0-9a-f-]{36}$/i.test(schoolId)) return null;
    try {
      const { getSubscription } = await import('../services/subscriptionEnforcementService');
      const s: any = await getSubscription(schoolId);
      return s?.plan_id ? String(s.plan_id) : null;
    } catch (err: any) {
      console.warn('[RBAC] Unable to resolve subscription plan; using feature defaults:', err?.code || err?.message);
      return null;
    }
  }

  async loadPlanFeatures(planKey: string) {
    const rows = await readQuery(`SELECT feature_key,enabled FROM plan_features WHERE plan_key=$1`, [planKey]);
    return Object.fromEntries((rows || []).map((r: any) => [r.feature_key, Boolean(r.enabled)]));
  }

  async listPlans() {
    const rows = await readQuery(`
      SELECT sp.id::text AS plan_key, sp.name, sp.is_active,
             (SELECT COUNT(DISTINCT ss.school_id)::int FROM school_subscriptions ss WHERE ss.plan_id=sp.id) AS school_count
      FROM subscription_plans sp ORDER BY sp.price_monthly NULLS LAST, sp.name`);
    return (rows || []).map((r: any) => ({ planKey: r.plan_key, name: r.name, isActive: r.is_active !== false, schoolCount: Number(r.school_count || 0) }));
  }

  async listAllPlanFeatures() {
    const rows = await readQuery(`SELECT plan_key,feature_key,enabled FROM plan_features`);
    const out: Record<string, Record<string, boolean>> = {};
    for (const r of (rows || []) as any[]) (out[r.plan_key] ||= {})[r.feature_key] = Boolean(r.enabled);
    return out;
  }

  async listPrincipalSummaries(schoolId: string, role: string) {
    const rows = await readQuery(`
      SELECT principal_id, SUM(o)::int AS overrides, BOOL_AND(l) AS login_enabled FROM (
        SELECT principal_id, 1 AS o, TRUE AS l FROM user_permission_overrides WHERE school_id=$1 AND principal_role=$2
        UNION ALL
        SELECT principal_id, 0 AS o, login_enabled AS l FROM user_login_controls WHERE school_id=$1 AND principal_role=$2
      ) x GROUP BY principal_id`, [schoolId, role]);
    const out: Record<string, { overrides: number; loginEnabled: boolean }> = {};
    for (const r of (rows || []) as any[]) out[r.principal_id] = { overrides: Number(r.overrides || 0), loginEnabled: r.login_enabled !== false };
    return out;
  }

  async listAudit(schoolId: string | null, page: number, pageSize: number, target?: string) {
    const params: any[] = [];
    const where: string[] = [];
    if (schoolId) { params.push(schoolId); where.push(`school_id=$${params.length}`); }
    else where.push(`school_id IS NULL`);
    if (target) { params.push(target); where.push(`(target_id=$${params.length} OR target_type=$${params.length})`); }
    const w = `WHERE ${where.join(' AND ')}`;
    const totalRows = await readQuery(`SELECT COUNT(*)::int AS n FROM access_audit_log ${w}`, params);
    params.push(pageSize, (page - 1) * pageSize);
    const rows = await readQuery(
      `SELECT id,school_id,actor_id,actor_role,action,target_type,target_id,before,after,ip,created_at FROM access_audit_log ${w}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return {
      total: Number((totalRows?.[0] as any)?.n || 0),
      items: (rows || []).map((r: any) => ({
        id: r.id, schoolId: r.school_id, actorId: r.actor_id, actorRole: r.actor_role, action: r.action,
        targetType: r.target_type, targetId: r.target_id, before: r.before, after: r.after, ip: r.ip,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    };
  }

  async transaction<T>(fn: (tx: AccessTx) => Promise<T>): Promise<T> {
    if (!isPostgresConfigured) throw new AccessStoreUnavailableError();
    const st = await this.status();
    if (st === 'NOT_INSTALLED') throw new AccessStoreUnavailableError('RBAC tables are not installed. Run migration 051_rbac_feature_control.sql.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(new SqlTx(client));
      await client.query('COMMIT');
      return out;
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (isMissingTable(err)) { markMissing(err); throw new AccessStoreUnavailableError(); }
      throw err;
    } finally {
      client.release();
    }
  }
}

// ---------------------------------------------------------------------------
// Pluggable store (tests swap in an in-memory implementation)
// ---------------------------------------------------------------------------
let current: AccessStore = new SqlAccessStore();
export function getAccessStore(): AccessStore { return current; }
export function setAccessStore(store: AccessStore) { current = store; }
