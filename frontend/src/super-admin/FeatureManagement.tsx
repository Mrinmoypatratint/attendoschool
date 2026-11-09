import { useCallback, useEffect, useState } from 'react';
import { Layers, School, Globe, History, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { notifyAccessChanged } from '../rbac/AccessProvider';
import { ToggleSwitch, TriState, SourceBadge, StatusBanner, useConfirmChange, apiErrorMessage } from '../rbac/components';
import type { TriValue } from '../rbac/components';
import { AuditList } from '../pages/admin/access/AccessControl';

/** Super Admin feature control: per plan, per school (force ON/OFF with reason + expiry), global kill switches. */
type Feat = { key: string; label: string; dependsOn: string[]; dependents: string[] };

function Loading() { return <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center"><Loader2 className="animate-spin" size={18} /> Loading…</div>; }
function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between">
      <span>{message}</span><button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold"><RefreshCw size={14} /> Retry</button>
    </div>
  );
}
const dependentsText = (f: Feat, labels: Record<string, string>) => (f.dependents.length ? ` Also turns off: ${f.dependents.map((d) => labels[d] || d).join(', ')}.` : '');

export function FeatureManagement() {
  const [tab, setTab] = useState<'plans' | 'schools' | 'global' | 'audit'>('plans');
  const [meta, setMeta] = useState<{ mode: string; store: string } | null>(null);
  useEffect(() => { api.get('/super-admin/features/catalog').then((r) => setMeta(r.data)).catch(() => undefined); }, []);
  const tabs = [
    { id: 'plans' as const, label: 'Plans', icon: Layers },
    { id: 'schools' as const, label: 'Schools', icon: School },
    { id: 'global' as const, label: 'Global', icon: Globe },
    { id: 'audit' as const, label: 'Audit', icon: History },
  ];
  return (
    <div className="space-y-4" data-testid="feature-management">
      <div>
        <h2 className="m-0 text-xl font-extrabold text-slate-900 dark:text-slate-100">Feature Control</h2>
        <p className="m-0 mt-1 text-sm text-slate-500">Turn features on or off per subscription plan, per school, or platform-wide. Turning a feature off hides it — no data is deleted. Core features (login, profile, dashboard, billing, access control) are always on.</p>
      </div>
      <StatusBanner mode={meta?.mode} store={meta?.store} />
      <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'plans' && <PlansTab />}
      {tab === 'schools' && <SchoolsTab />}
      {tab === 'global' && <GlobalTab />}
      {tab === 'audit' && <AuditList url="/super-admin/features/audit" params={{}} />}
    </div>
  );
}

function PlansTab() {
  const { addToast } = useToast();
  const { confirm, modal } = useConfirmChange();
  const [data, setData] = useState<{ plans: { planKey: string; name: string; schoolCount: number }[]; features: Feat[]; matrix: Record<string, Record<string, boolean>> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { setError(null); api.get('/super-admin/features/plans').then((r) => setData(r.data)).catch((e) => setError(apiErrorMessage(e, 'Unable to load plans'))); }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Loading />;
  const labels = Object.fromEntries(data.features.map((f) => [f.key, f.label]));
  const toggle = async (planKey: string, f: Feat, enabled: boolean) => {
    const plan = data.plans.find((p) => p.planKey === planKey)!;
    if (!enabled) {
      const ok = await confirm({ title: `Turn off ${f.label} on the ${plan.name} plan?`, body: `Schools on this plan lose ${f.label} unless they have a school override.${dependentsText(f, labels)}`, impact: `Affects ${plan.schoolCount} school(s).`, confirmText: 'Turn off' });
      if (!ok) return false;
    }
    await api.put(`/super-admin/features/plans/${encodeURIComponent(planKey)}`, { changes: [{ feature: f.key, enabled }] });
    addToast(`${f.label} ${enabled ? 'enabled' : 'disabled'} on ${plan.name}`, 'success');
    notifyAccessChanged(); load();
  };
  if (!data.plans.length) return <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-slate-500">No subscription plans found.</div>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {modal}
      <table className="w-full text-sm min-w-[560px]">
        <thead><tr className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800/60">
          <th className="px-4 py-3">Feature</th>
          {data.plans.map((p) => <th key={p.planKey} className="px-3 py-3 text-center">{p.name}<div className="text-[10px] normal-case font-normal">{p.schoolCount} school(s)</div></th>)}
        </tr></thead>
        <tbody>
          {data.features.map((f) => (
            <tr key={f.key} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-4 py-2.5"><div className="font-semibold">{f.label}</div>{f.dependsOn.length > 0 && <div className="text-[11px] text-slate-400">Requires {f.dependsOn.map((d) => labels[d] || d).join(', ')}</div>}</td>
              {data.plans.map((p) => (
                <td key={p.planKey} className="px-3 py-2.5 text-center">
                  <ToggleSwitch checked={data.matrix[p.planKey]?.[f.key] !== false} label={`${f.label} on ${p.name}`} size="sm"
                    onChange={(v) => toggle(p.planKey, f, v)} testId={`plan-toggle-${p.planKey}-${f.key}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SchoolFeature = { key: string; label: string; core: boolean; override: { mode: 'ON' | 'OFF'; reason: string | null; expiresAt: string | null; active: boolean } | null; inherited: { enabled: boolean; source: string }; effective: { enabled: boolean; source: string; blockedBy?: string } };
function SchoolsTab() {
  const { addToast } = useToast();
  const { confirm, modal } = useConfirmChange();
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [data, setData] = useState<{ planKey: string | null; features: SchoolFeature[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get('/super-admin/schools').then((r) => {
      const list = (Array.isArray(r.data) ? r.data : r.data?.schools || []).map((s: any) => ({ id: String(s.id), name: s.name }));
      setSchools(list); if (list[0]) setSchoolId(list[0].id);
    }).catch((e) => setError(apiErrorMessage(e, 'Unable to load schools')));
  }, []);
  const load = useCallback(() => {
    if (!schoolId) return;
    setError(null); setData(null);
    api.get(`/super-admin/features/schools/${encodeURIComponent(schoolId)}`).then((r) => setData(r.data)).catch((e) => setError(apiErrorMessage(e, 'Unable to load school features')));
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);
  const school = schools.find((s) => s.id === schoolId);
  const set = async (f: SchoolFeature, v: TriValue) => {
    const mode = v === 'ALLOW' ? 'ON' : v === 'DENY' ? 'OFF' : 'INHERIT';
    let reason: string | undefined; let expiresAt: string | null = null;
    if (mode !== 'INHERIT') {
      const ok = await confirm({ title: `Force ${f.label} ${mode} for ${school?.name}?`, body: mode === 'OFF' ? 'The school loses this feature regardless of its plan. No data is deleted.' : 'The school gets this feature regardless of its plan.', confirmText: `Force ${mode}`, requireReason: true, withExpiry: true, tone: mode === 'OFF' ? 'danger' : 'neutral' });
      if (!ok) return false;
      reason = ok.reason; expiresAt = ok.expiresAt;
    }
    await api.put(`/super-admin/features/schools/${encodeURIComponent(schoolId)}`, { changes: [{ feature: f.key, mode, reason, expiresAt }] });
    addToast(`${f.label}: ${mode === 'INHERIT' ? 'follows plan' : `forced ${mode}`}`, 'success');
    notifyAccessChanged(); load();
  };
  return (
    <div className="space-y-3">
      {modal}
      <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} aria-label="School"
        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-w-[240px]">
        {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          {data.features.filter((f) => !f.core).map((f) => (
            <div key={f.key} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm">{f.label}</div>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px]">
                  <span className={f.effective.enabled ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{f.effective.enabled ? 'On' : 'Off'}</span>
                  <SourceBadge source={f.effective.source} />
                  {f.effective.blockedBy && f.effective.blockedBy !== f.key && <span className="text-slate-400">needs {f.effective.blockedBy}</span>}
                  <span className="text-slate-400">plan: {f.inherited.enabled ? 'on' : 'off'}</span>
                  {f.override && <span className="text-slate-500" title={f.override.reason || ''}>override “{f.override.reason}”{f.override.expiresAt ? ` until ${new Date(f.override.expiresAt).toLocaleString()}` : ''}{!f.override.active ? ' (expired)' : ''}</span>}
                </div>
              </div>
              <TriState value={f.override?.active ? (f.override.mode === 'ON' ? 'ALLOW' : 'DENY') : 'INHERIT'} label={`${f.label} override`} labels={{ INHERIT: 'Plan', ALLOW: 'On', DENY: 'Off' }}
                onChange={(v) => set(f, v)} testId={`school-feature-${f.key}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GlobalTab() {
  const { addToast } = useToast();
  const { confirm, modal } = useConfirmChange();
  const [data, setData] = useState<{ features: (Feat & { enabled: boolean })[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { setError(null); api.get('/super-admin/features/global').then((r) => setData(r.data)).catch((e) => setError(apiErrorMessage(e, 'Unable to load kill switches'))); }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Loading />;
  const labels = Object.fromEntries(data.features.map((f) => [f.key, f.label]));
  const toggle = async (f: Feat, enabled: boolean) => {
    const ok = await confirm({
      title: enabled ? `Re-enable ${f.label} platform-wide?` : `KILL SWITCH: turn off ${f.label} for EVERY school?`,
      body: enabled ? 'Schools get the feature back according to their plan and overrides.' : `This overrides every plan and school override.${dependentsText(f, labels)}`,
      impact: enabled ? null : 'Affects all schools on the platform.', confirmText: enabled ? 'Re-enable' : 'Turn off everywhere', requireReason: true, tone: enabled ? 'neutral' : 'danger',
    });
    if (!ok) return false;
    await api.put('/super-admin/features/global', { changes: [{ feature: f.key, enabled }], reason: ok.reason, confirm: true });
    addToast(`${f.label} ${enabled ? 're-enabled' : 'disabled'} platform-wide`, enabled ? 'success' : 'warning');
    notifyAccessChanged(); load();
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
      {modal}
      {data.features.map((f) => (
        <div key={f.key} className="px-4 py-3 flex items-center justify-between gap-3">
          <div><div className="font-semibold text-sm">{f.label}</div>{f.dependents.length > 0 && <div className="text-[11px] text-slate-400">Also controls: {f.dependents.map((d) => labels[d] || d).join(', ')}</div>}</div>
          <ToggleSwitch checked={f.enabled} label={`${f.label} platform-wide`} onChange={(v) => toggle(f, v)} testId={`global-toggle-${f.key}`} />
        </div>
      ))}
    </div>
  );
}

export default FeatureManagement;
