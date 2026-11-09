/**
 * In-memory AccessStore + PrincipalDirectory for RBAC tests (disposable fixtures; no DB).
 * Transactions are copy-on-write: a thrown error discards every write (mirrors BEGIN/ROLLBACK).
 */
import {
  AccessStore, AccessTx, AuditEntry, AuditRow, Effect, PrincipalContext, SchoolContext, SchoolOverride, StoreStatus,
  AccessStoreUnavailableError, AccessUnavailableError,
} from '../../src/rbac/accessStore';
import { Principal, PrincipalDirectory } from '../../src/rbac/principalDirectory';

type State = {
  global: Record<string, boolean>;
  plans: { planKey: string; name: string; isActive: boolean }[];
  subscriptions: Record<string, string>; // school → planKey
  planFeatures: Record<string, Record<string, boolean>>;
  schoolOverrides: Record<string, Record<string, SchoolOverride>>;
  rolePerms: Record<string, Record<string, Record<string, boolean>>>; // school → role → key
  userOverrides: Record<string, { effect: Effect; reason: string | null }>; // `${s}|${r}|${id}|${key}`
  logins: Record<string, { enabled: boolean; reason: string | null }>; // `${s}|${r}|${id}`
  versions: Record<string, number>;
  audit: AuditRow[];
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export class MemoryAccessStore implements AccessStore {
  state: State = { global: {}, plans: [], subscriptions: {}, planFeatures: {}, schoolOverrides: {}, rolePerms: {}, userOverrides: {}, logins: {}, versions: {}, audit: [] };
  mode: StoreStatus = 'READY';
  failReads = false;
  reads = 0;

  private guardRead() {
    this.reads++;
    if (this.failReads) throw new AccessUnavailableError('simulated db failure');
    return this.mode === 'READY';
  }
  async status() { return this.mode; }
  async loadSchoolContext(s: string): Promise<SchoolContext> {
    if (!this.guardRead()) return { version: 0, globalFeatures: {}, schoolOverrides: {}, rolePermissions: {} };
    return clone({ version: this.state.versions[s] || 0, globalFeatures: this.state.global, schoolOverrides: this.state.schoolOverrides[s] || {}, rolePermissions: this.state.rolePerms[s] || {} });
  }
  async loadPrincipal(s: string, r: string, id: string): Promise<PrincipalContext> {
    if (!this.guardRead()) return { overrides: {}, login: null };
    const prefix = `${s}|${r}|${id}|`;
    const overrides: PrincipalContext['overrides'] = {};
    for (const [k, v] of Object.entries(this.state.userOverrides)) if (k.startsWith(prefix)) overrides[k.slice(prefix.length)] = { ...v };
    const l = this.state.logins[`${s}|${r}|${id}`];
    return { overrides, login: l ? { ...l } : null };
  }
  async loadLogin(s: string, r: string, id: string) {
    if (!this.guardRead()) return null;
    const l = this.state.logins[`${s}|${r}|${id}`];
    return l ? { ...l } : null;
  }
  async getPlanKey(s: string) { return this.state.subscriptions[s] || null; }
  async loadPlanFeatures(p: string) { this.guardRead(); return clone(this.state.planFeatures[p] || {}); }
  async listPlans() {
    return this.state.plans.map((p) => ({ ...p, schoolCount: Object.values(this.state.subscriptions).filter((x) => x === p.planKey).length }));
  }
  async listAllPlanFeatures() { return clone(this.state.planFeatures); }
  async listPrincipalSummaries(s: string, r: string) {
    const out: Record<string, { overrides: number; loginEnabled: boolean }> = {};
    for (const k of Object.keys(this.state.userOverrides)) {
      const [ss, rr, id] = k.split('|');
      if (ss === s && rr === r) (out[id] ||= { overrides: 0, loginEnabled: true }).overrides++;
    }
    for (const [k, v] of Object.entries(this.state.logins)) {
      const [ss, rr, id] = k.split('|');
      if (ss === s && rr === r) (out[id] ||= { overrides: 0, loginEnabled: true }).loginEnabled = v.enabled;
    }
    return out;
  }
  async listAudit(s: string | null, page: number, pageSize: number, target?: string) {
    const all = this.state.audit.filter((a) => a.schoolId === s && (!target || a.targetId === target || a.targetType === target)).reverse();
    return { total: all.length, items: all.slice((page - 1) * pageSize, page * pageSize) };
  }
  async transaction<T>(fn: (tx: AccessTx) => Promise<T>): Promise<T> {
    if (this.mode !== 'READY') throw new AccessStoreUnavailableError();
    const draft: State = clone(this.state);
    const tx: AccessTx = {
      lockSchool: async () => undefined,
      getRolePermission: async (s, r, k) => draft.rolePerms[s]?.[r]?.[k] ?? null,
      setRolePermission: async (s, r, k, a) => {
        const m = ((draft.rolePerms[s] ||= {})[r] ||= {});
        if (a === null) delete m[k]; else m[k] = a;
      },
      getUserOverride: async (s, r, id, k) => draft.userOverrides[`${s}|${r}|${id}|${k}`] || null,
      listUserOverrides: async (s, r, id) => {
        const prefix = `${s}|${r}|${id}|`; const out: Record<string, Effect> = {};
        for (const [k, v] of Object.entries(draft.userOverrides)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v.effect;
        return out;
      },
      setUserOverride: async (s, r, id, k, e, reason) => {
        const key = `${s}|${r}|${id}|${k}`;
        if (e === null) delete draft.userOverrides[key]; else draft.userOverrides[key] = { effect: e, reason };
      },
      getLogin: async (s, r, id) => draft.logins[`${s}|${r}|${id}`] || null,
      setLogin: async (s, r, id, enabled, reason) => {
        const key = `${s}|${r}|${id}`;
        if (enabled === null) delete draft.logins[key]; else draft.logins[key] = { enabled, reason };
      },
      listOverridesForPermission: async (s, r, k) => {
        const out: Record<string, Effect> = {};
        for (const [key, v] of Object.entries(draft.userOverrides)) {
          const [ss, rr, id, kk] = key.split('|');
          if (ss === s && rr === r && kk === k) out[id] = v.effect;
        }
        return out;
      },
      listDisabledLogins: async (s, r) => Object.entries(draft.logins).filter(([k, v]) => k.startsWith(`${s}|${r}|`) && !v.enabled).map(([k]) => k.split('|')[2]),
      getPlanFeature: async (p, f) => draft.planFeatures[p]?.[f] ?? null,
      setPlanFeature: async (p, f, e) => { (draft.planFeatures[p] ||= {})[f] = e; },
      getSchoolOverride: async (s, f) => draft.schoolOverrides[s]?.[f] || null,
      setSchoolOverride: async (s, f, v) => {
        const m = (draft.schoolOverrides[s] ||= {});
        if (v === null) delete m[f]; else m[f] = v;
      },
      getGlobalFeatures: async () => clone(draft.global),
      setGlobalFeatures: async (v) => { draft.global = clone(v); },
      bumpVersion: async (s) => { draft.versions[s] = (draft.versions[s] || 0) + 1; },
      audit: async (e: AuditEntry) => { draft.audit.push({ ...clone(e), id: String(draft.audit.length + 1), createdAt: new Date().toISOString() }); },
    };
    const out = await fn(tx);
    this.state = draft;
    return out;
  }
}

export class MemoryDirectory implements PrincipalDirectory {
  schools = new Set<string>();
  people: (Principal & { schoolId: string })[] = [];
  available = true;
  private check() { if (!this.available) throw new AccessStoreUnavailableError('User directory requires SQL.'); }
  add(schoolId: string, role: string, id: string, name = id, createdAt = new Date().toISOString(), isActive = true) {
    this.schools.add(schoolId);
    this.people.push({ schoolId, id, name, email: `${id}@test.local`, role, isActive, createdAt });
  }
  async schoolExists(s: string) { this.check(); return this.schools.has(s); }
  async getPrincipal(s: string, r: string, id: string) {
    this.check();
    const p = this.people.find((x) => x.schoolId === s && x.role === r && x.id === id);
    return p ? { ...p } : null;
  }
  async listPrincipals(s: string, r: string, search: string, page: number, pageSize: number) {
    this.check();
    const all = this.people.filter((x) => x.schoolId === s && x.role === r && (!search || x.name.toLowerCase().includes(search.toLowerCase())));
    return { total: all.length, items: all.slice((page - 1) * pageSize, page * pageSize) };
  }
  async listActiveAdmins(s: string) { this.check(); return this.people.filter((x) => x.schoolId === s && x.role === 'SCHOOL_ADMIN' && x.isActive); }
  async getOwnerAdminId(s: string) {
    this.check();
    const admins = this.people.filter((x) => x.schoolId === s && x.role === 'SCHOOL_ADMIN').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return admins[0]?.id || null;
  }
  async countByRole(s: string, r: string) { this.check(); return this.people.filter((x) => x.schoolId === s && x.role === r && x.isActive).length; }
}
