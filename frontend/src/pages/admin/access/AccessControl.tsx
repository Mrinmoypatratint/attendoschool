import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Users, History, Search, RotateCcw, Loader2, RefreshCw, Crown, UserX, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api } from '../../../api';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/Toast';
import { notifyAccessChanged } from '../../../rbac/AccessProvider';
import { ToggleSwitch, TriState, SourceBadge, StatusBanner, useConfirmChange, apiErrorMessage } from '../../../rbac/components';
import type { TriValue } from '../../../rbac/components';

const ROLES = ['SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] as const;
type Role = typeof ROLES[number];
const ROLE_LABEL: Record<Role, string> = { SCHOOL_ADMIN: 'School Admin', TEACHER: 'Teacher', STUDENT: 'Student', PARENT: 'Parent' };
const ROLE_PLURAL: Record<Role, string> = { SCHOOL_ADMIN: 'school admins', TEACHER: 'teachers', STUDENT: 'students', PARENT: 'parents' };

type Lock = { locked: boolean; reason?: string };
type CatalogPerm = { key: string; feature: string; label: string; description: string; ceilingRoles: Role[]; dangerous?: boolean; knownIssue?: string; roleLocks: Record<Role, Lock>; principalLocks: Record<Role, Lock> };
type CatalogFeature = { key: string; label: string; core: boolean };
type Catalog = { mode: string; store: string; features: CatalogFeature[]; permissions: CatalogPerm[] };
type Cell = { inCeiling: boolean; allowed: boolean; source: string; locked: boolean; lockReason: string | null };
type RolesResp = { version: number; counts: Record<Role, number | null>; features: { key: string; enabled: boolean; source: string; blockedBy?: string }[]; matrix: { key: string; feature: string; roles: Record<Role, Cell> }[] };

function useSchoolScope() {
  const { user } = useAuth();
  const isSA = user?.role === 'SUPER_ADMIN';
  const [schoolId, setSchoolId] = useState('');
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!isSA) return;
    api.get('/super-admin/schools').then((r) => {
      const list = (Array.isArray(r.data) ? r.data : r.data?.schools || []).map((s: any) => ({ id: String(s.id), name: s.name }));
      setSchools(list);
      if (list[0]) setSchoolId((cur) => cur || list[0].id);
    }).catch(() => undefined);
  }, [isSA]);
  const params: Record<string, string> = isSA ? { schoolId } : {};
  return { isSA, schoolId, setSchoolId, schools, params, ready: !isSA || Boolean(schoolId) };
}

export default function AccessControl() {
  const [tab, setTab] = useState<'roles' | 'people' | 'audit'>('roles');
  const scope = useSchoolScope();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  useEffect(() => {
    api.get('/access/catalog').then((r) => {
      if (!Array.isArray(r.data?.permissions) || !Array.isArray(r.data?.features)) throw new Error('Unexpected response from the server');
      setCatalog(r.data);
    }).catch((e) => setCatalogError(apiErrorMessage(e, 'Unable to load access catalog')));
  }, []);

  const tabs = [
    { id: 'roles' as const, label: 'Roles', icon: ShieldCheck },
    { id: 'people' as const, label: 'People', icon: Users },
    { id: 'audit' as const, label: 'Audit', icon: History },
  ];
  return (
    <div className="w-full max-w-none m-0 pb-10 space-y-4" style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '24px 24px 40px', boxSizing: 'border-box' }} data-testid="access-control">
      <Link
        to="/dashboard"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          color: '#e11d48',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 12
        }}
      >
        <ArrowLeft size={16} /> <span>Dashboard</span>
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl md:text-2xl font-extrabold text-slate-900 dark:text-slate-100">Permissions &amp; Access</h1>
          <p className="m-0 mt-1 text-sm text-slate-500">Turn features off per role or per person, and control who can sign in. Changes apply within a minute.</p>
        </div>
        {scope.isSA && (
          <select value={scope.schoolId} onChange={(e) => scope.setSchoolId(e.target.value)} aria-label="School"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
            {scope.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      <StatusBanner mode={catalog?.mode} store={catalog?.store} />
      <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} type="button"
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>
      {catalogError && <ErrorBox message={catalogError} />}
      {!catalog && !catalogError && <LoadingBox />}
      {catalog && scope.ready && tab === 'roles' && <RolesTab catalog={catalog} params={scope.params} />}
      {catalog && scope.ready && tab === 'people' && <PeopleTab catalog={catalog} params={scope.params} />}
      {catalog && scope.ready && tab === 'audit' && <AuditTab params={scope.params} />}
    </div>
  );
}

function LoadingBox() {
  return <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center"><Loader2 className="animate-spin" size={18} /> Loading…</div>;
}
function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold"><RefreshCw size={14} /> Retry</button>}
    </div>
  );
}

// ---------------------------------------------------------------------------
function RolesTab({ catalog, params }: { catalog: Catalog; params: Record<string, string> }) {
  const { addToast } = useToast();
  const { confirm, modal } = useConfirmChange();
  const [data, setData] = useState<RolesResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [feature, setFeature] = useState('');
  const [changedOnly, setChangedOnly] = useState(false);
  const load = useCallback(() => {
    setError(null);
    api.get('/access/roles', { params }).then((r) => {
      if (!Array.isArray(r.data?.matrix)) throw new Error('Unexpected response from the server');
      setData(r.data);
    }).catch((e) => setError(apiErrorMessage(e, 'Unable to load role permissions')));
  }, [JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const perms = useMemo(() => new Map(catalog.permissions.map((p) => [p.key, p])), [catalog]);
  const featureState = useMemo(() => new Map((data?.features || []).map((f) => [f.key, f])), [data]);
  const rows = useMemo(() => (data?.matrix || []).filter((row) => {
    const p = perms.get(row.key);
    if (!p) return false;
    if (feature && row.feature !== feature) return false;
    if (search && !`${p.label} ${p.key}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (changedOnly && !ROLES.some((r) => row.roles[r].source === 'school')) return false;
    return true;
  }), [data, perms, feature, search, changedOnly]);

  const save = async (role: Role, changes: { key: string; allowed: boolean | null }[]) => {
    await api.put(`/access/roles/${role}/permissions`, { changes }, { params });
    notifyAccessChanged();
    load();
  };
  const toggle = async (role: Role, key: string, next: boolean) => {
    const p = perms.get(key)!;
    if (!next) {
      const n = data?.counts?.[role];
      const ok = await confirm({
        title: `Turn off “${p.label}” for ${ROLE_LABEL[role]}?`,
        body: <>Every {ROLE_LABEL[role].toLowerCase()} in this school loses this permission (people with a personal “Allow” keep it).</>,
        impact: typeof n === 'number' ? `Affects ${n} ${ROLE_PLURAL[role]}.` : null,
        confirmText: 'Turn off', tone: p.dangerous || role === 'SCHOOL_ADMIN' ? 'danger' : 'neutral',
      });
      if (!ok) return false;
    }
    await save(role, [{ key, allowed: next }]);
    addToast(`${p.label}: ${next ? 'on' : 'off'} for ${ROLE_LABEL[role]}`, 'success');
  };
  const resetRole = async (role: Role) => {
    const changes = (data?.matrix || []).filter((r) => r.roles[role].source === 'school').map((r) => ({ key: r.key, allowed: null }));
    if (!changes.length) return addToast(`${ROLE_LABEL[role]} already uses the defaults`, 'info');
    const ok = await confirm({ title: `Reset ${ROLE_LABEL[role]} to defaults?`, body: `${changes.length} change(s) will be reverted.`, confirmText: 'Reset', tone: 'neutral' });
    if (!ok) return;
    try { await save(role, changes); addToast(`${ROLE_LABEL[role]} reset to defaults`, 'success'); }
    catch (e) { addToast(apiErrorMessage(e), 'error'); }
  };

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <LoadingBox />;
  const featureList = catalog.features.filter((f) => rows.some((r) => r.feature === f.key));
  return (
    <div className="space-y-3">
      {modal}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search permissions" aria-label="Search permissions"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
        </label>
        <select value={feature} onChange={(e) => setFeature(e.target.value)} aria-label="Filter by feature"
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
          <option value="">All features</option>
          {catalog.features.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} /> Changed only
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800/60">
              <th className="px-4 py-3">Permission</th>
              {ROLES.map((r) => (
                <th key={r} className="px-3 py-3 text-center whitespace-nowrap">
                  <div>{ROLE_LABEL[r]}</div>
                  <button type="button" onClick={() => resetRole(r)} className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 normal-case" title={`Reset ${ROLE_LABEL[r]} to defaults`}>
                    <RotateCcw size={10} /> Reset
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureList.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No permissions match the current filters.</td></tr>}
            {featureList.map((f) => {
              const fs = featureState.get(f.key);
              return [
                <tr key={`f-${f.key}`} className="bg-slate-50/70 dark:bg-slate-800/40">
                  <td colSpan={5} className="px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {f.label}
                    {f.core && <span className="ml-2 text-[10px] text-slate-400 normal-case">core</span>}
                    {fs && !fs.enabled && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] normal-case">Feature off ({fs.source.replace('_', ' ')}) — managed by AttendoSchool</span>}
                  </td>
                </tr>,
                ...rows.filter((r) => r.feature === f.key).map((row) => {
                  const p = perms.get(row.key)!;
                  return (
                    <tr key={row.key} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{p.label}{p.dangerous && <span className="ml-1.5 text-[10px] text-rose-600 font-bold">SENSITIVE</span>}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{p.key}</div>
                      </td>
                      {ROLES.map((r) => {
                        const c = row.roles[r];
                        if (!c.inCeiling) return <td key={r} className="px-3 py-2.5 text-center text-slate-300" title="Not available to this role">—</td>;
                        return (
                          <td key={r} className="px-3 py-2.5 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <ToggleSwitch checked={c.allowed} lockReason={c.locked ? c.lockReason : null} label={`${p.label} for ${ROLE_LABEL[r]}`}
                                onChange={(next) => toggle(r, row.key, next)} testId={`role-toggle-${r}-${row.key}`} size="sm" />
                              {c.source === 'school' && <SourceBadge source="school" />}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
type PrincipalRow = { id: string; name: string; email: string | null; isActive: boolean; isOwner: boolean; isSelf: boolean; overrides: number; loginEnabled: boolean; detail?: string | null };
type PrincipalDetail = {
  principal: { id: string; name: string; email: string | null }; isOwner: boolean; isSelf: boolean; editable: boolean; editReason: string | null;
  login: { enabled: boolean; reason: string | null };
  permissions: { key: string; feature: string; allowed: boolean; reason: string; source: string; override: { effect: 'ALLOW' | 'DENY'; reason: string | null } | null; locked: boolean; lockReason: string | null }[];
};

function PeopleTab({ catalog, params }: { catalog: Catalog; params: Record<string, string> }) {
  const [role, setRole] = useState<Role>('TEACHER');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<{ total: number; items: PrincipalRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PrincipalRow | null>(null);
  useEffect(() => { const t = setTimeout(() => { setQuery(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  const load = useCallback(() => {
    setError(null);
    api.get('/access/principals', { params: { ...params, role, search: query, page, pageSize: 25 } })
      .then((r) => setList(r.data)).catch((e) => setError(apiErrorMessage(e, 'Unable to load people')));
  }, [role, query, page, JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const pages = list ? Math.max(1, Math.ceil(list.total / 25)) : 1;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="space-y-3">
        <div className="flex gap-2">
          <select value={role} onChange={(e) => { setRole(e.target.value as Role); setPage(1); setSelected(null); }} aria-label="Role"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <label className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or e-mail" aria-label="Search people"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
          </label>
        </div>
        {error && <ErrorBox message={error} onRetry={load} />}
        {!list && !error && <LoadingBox />}
        {list && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {list.items.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">No {ROLE_PLURAL[role]} found.</div>}
            {list.items.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelected(p)} data-testid={`principal-${p.id}`}
                className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${selected?.id === p.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''}`}>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                    {p.name}{p.isOwner && <Crown size={13} className="text-amber-500" aria-label="Owner admin" />}{p.isSelf && <span className="text-[10px] text-slate-400">(you)</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{p.email || p.detail || p.id}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.overrides > 0 && <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[10px] font-bold">{p.overrides} custom</span>}
                  {!p.loginEnabled && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold inline-flex items-center gap-1"><UserX size={10} /> Login off</span>}
                </div>
              </button>
            ))}
          </div>
        )}
        {list && pages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={15} /> Prev</button>
            <span>Page {page} of {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="inline-flex items-center gap-1 disabled:opacity-40">Next <ChevronRight size={15} /></button>
          </div>
        )}
      </div>
      <div>
        {selected
          ? <PersonDetail key={`${role}-${selected.id}`} role={role} id={selected.id} catalog={catalog} params={params} onChanged={load} onClose={() => setSelected(null)} />
          : <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-16 text-center text-sm text-slate-500">Select a person to view and change their access.</div>}
      </div>
    </div>
  );
}

function PersonDetail({ role, id, catalog, params, onChanged, onClose }: { role: Role; id: string; catalog: Catalog; params: Record<string, string>; onChanged: () => void; onClose: () => void }) {
  const { addToast } = useToast();
  const { confirm, modal } = useConfirmChange();
  const [d, setD] = useState<PrincipalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changedOnly, setChangedOnly] = useState(false);
  const perms = useMemo(() => new Map(catalog.permissions.map((p) => [p.key, p])), [catalog]);
  const load = useCallback(() => {
    api.get(`/access/principals/${role}/${encodeURIComponent(id)}`, { params }).then((r) => setD(r.data)).catch((e) => setError(apiErrorMessage(e, 'Unable to load person')));
  }, [role, id, JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const after = () => { notifyAccessChanged(); load(); onChanged(); };

  const setEffect = async (key: string, effect: TriValue) => {
    const p = perms.get(key);
    let reason: string | undefined;
    if (effect === 'DENY') {
      const ok = await confirm({ title: `Deny “${p?.label || key}” for ${d?.principal.name}?`, body: 'This person loses this permission even if their role has it.', confirmText: 'Deny', requireReason: true });
      if (!ok) return false;
      reason = ok.reason;
    }
    await api.put(`/access/principals/${role}/${encodeURIComponent(id)}/permissions`, { changes: [{ key, effect }], reason }, { params });
    addToast('Saved', 'success'); after();
  };
  const setLogin = async (enabled: boolean) => {
    let reason: string | undefined;
    if (!enabled) {
      const ok = await confirm({ title: `Disable sign-in for ${d?.principal.name}?`, body: 'They are signed out within 30 seconds and cannot sign in again until re-enabled. No data is deleted.', confirmText: 'Disable login', requireReason: true });
      if (!ok) return false;
      reason = ok.reason;
    }
    await api.put(`/access/principals/${role}/${encodeURIComponent(id)}/login`, { enabled, reason }, { params });
    addToast(enabled ? 'Login enabled' : 'Login disabled', 'success'); after();
  };
  const reset = async () => {
    const ok = await confirm({ title: 'Reset personal permissions?', body: 'All personal Allow / Deny overrides are removed; the role defaults apply again.', confirmText: 'Reset', tone: 'neutral' });
    if (!ok) return;
    try { await api.post(`/access/principals/${role}/${encodeURIComponent(id)}/reset`, {}, { params }); addToast('Overrides removed', 'success'); after(); }
    catch (e) { addToast(apiErrorMessage(e), 'error'); }
  };

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!d) return <LoadingBox />;
  const lockAll = d.editable ? null : (d.editReason || 'You cannot change this person.');
  const list = d.permissions.filter((p) => !changedOnly || p.override);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" data-testid="person-detail">
      {modal}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">{d.principal.name}{d.isOwner && <Crown size={14} className="text-amber-500" />}</div>
          <div className="text-xs text-slate-500">{ROLE_LABEL[role]} · {d.principal.email || d.principal.id}</div>
          {lockAll && <div className="mt-1 text-xs text-amber-600">{lockAll}</div>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"><X size={18} /></button>
      </div>
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Can sign in</div>
          {!d.login.enabled && d.login.reason && <div className="text-xs text-rose-600">Disabled: {d.login.reason}</div>}
        </div>
        <ToggleSwitch checked={d.login.enabled} onChange={setLogin} label="Can sign in" testId="login-toggle"
          lockReason={lockAll || (d.isSelf ? 'You cannot disable your own login.' : null)} />
      </div>
      <div className="px-4 py-2 flex items-center justify-between gap-2 text-sm">
        <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} /> Changed only</label>
        <button type="button" onClick={reset} disabled={Boolean(lockAll)} className="inline-flex items-center gap-1 text-indigo-600 font-semibold disabled:opacity-40"><RotateCcw size={14} /> Reset to role defaults</button>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[60vh] overflow-y-auto">
        {list.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-500">No personal changes.</div>}
        {list.map((p) => {
          const def = perms.get(p.key);
          const selfLock = d.isSelf && (p.key === 'access.manage' || p.key === 'access.login.manage') ? 'You cannot remove your own access management.' : null;
          return (
            <div key={p.key} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{def?.label || p.key}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[11px] font-bold ${p.allowed ? 'text-emerald-600' : 'text-rose-600'}`}>{p.allowed ? 'Allowed' : 'Blocked'}</span>
                  <SourceBadge source={p.source} />
                  {p.override?.reason && <span className="text-[11px] text-slate-400 truncate max-w-[200px]" title={p.override.reason}>“{p.override.reason}”</span>}
                </div>
              </div>
              <TriState value={p.override?.effect || 'INHERIT'} label={`${def?.label || p.key} for ${d.principal.name}`} testId={`tri-${p.key}`}
                lockReason={lockAll || (p.locked ? p.lockReason : null)}
                onChange={(v) => (selfLock && v === 'DENY' ? Promise.reject(new Error(selfLock)) : setEffect(p.key, v))} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
type AuditRow = { id: string; actorId: string; actorRole: string; action: string; targetType: string; targetId: string | null; before: any; after: any; createdAt: string };
export function AuditList({ url, params }: { url: string; params: Record<string, string> }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; items: AuditRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    api.get(url, { params: { ...params, page } }).then((r) => setData(r.data)).catch((e) => setError(apiErrorMessage(e, 'Unable to load audit log')));
  }, [url, page, JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <LoadingBox />;
  const pages = Math.max(1, Math.ceil(data.total / 25));
  const fmt = (v: any) => (v == null ? '—' : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : String(x)}`).join(', ') : String(v));
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800/60">
            <th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Who</th><th className="px-4 py-2.5">Change</th><th className="px-4 py-2.5">Before → After</th>
          </tr></thead>
          <tbody>
            {data.items.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No changes recorded yet.</td></tr>}
            {data.items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                <td className="px-4 py-2 whitespace-nowrap text-slate-500">{new Date(a.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2"><div className="font-mono text-xs">{a.actorId}</div><div className="text-[11px] text-slate-400">{a.actorRole}</div></td>
                <td className="px-4 py-2"><div className="font-semibold text-xs">{a.action.replace(/_/g, ' ')}</div><div className="text-[11px] text-slate-500 font-mono break-all">{a.targetType} {a.targetId || ''}</div></td>
                <td className="px-4 py-2 text-xs"><span className="text-rose-600">{fmt(a.before)}</span> → <span className="text-emerald-600">{fmt(a.after)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={15} /> Prev</button>
          <span>Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="inline-flex items-center gap-1 disabled:opacity-40">Next <ChevronRight size={15} /></button>
        </div>
      )}
    </div>
  );
}

function AuditTab({ params }: { params: Record<string, string> }) {
  return <AuditList url="/access/audit" params={params} />;
}
