import { useState } from 'react';
import type { ReactNode } from 'react';
import { Lock, Loader2, AlertTriangle, X } from 'lucide-react';
import { useToast } from '../components/Toast';

export function apiErrorMessage(err: any, fallback = 'Change could not be saved.'): string {
  return err?.response?.data?.message || err?.message || fallback;
}

/**
 * Accessible toggle: <button role="switch" aria-checked>. Space/Enter toggle (native button).
 * Optimistic: flips immediately, rolls back + toast if onChange rejects. No double-submit while pending.
 * onChange may return false to cancel (e.g. a confirm dialog was dismissed) without an error toast.
 */
export function ToggleSwitch({
  checked, onChange, disabled, lockReason, label, size = 'md', testId,
}: {
  checked: boolean; onChange: (next: boolean) => Promise<boolean | void>; disabled?: boolean; lockReason?: string | null;
  label: string; size?: 'sm' | 'md'; testId?: string;
}) {
  const { addToast } = useToast();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const value = optimistic ?? checked;
  const locked = Boolean(lockReason);
  const isDisabled = disabled || locked || pending;
  const click = async () => {
    if (isDisabled) return;
    const next = !value;
    setOptimistic(next); setPending(true);
    try {
      const r = await onChange(next);
      if (r === false) setOptimistic(null);
    } catch (err) {
      setOptimistic(null);
      addToast(apiErrorMessage(err), 'error');
    } finally {
      setPending(false);
      setOptimistic(null);
    }
  };
  const w = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const knob = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const shift = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <span className="inline-flex items-center gap-1.5" title={locked ? lockReason! : label}>
      <button
        type="button" role="switch" aria-checked={value} aria-label={label} aria-busy={pending}
        aria-disabled={isDisabled} disabled={isDisabled} onClick={click} data-testid={testId}
        className={`relative inline-flex shrink-0 ${w} rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
          value ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'} ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`absolute top-0.5 left-0.5 ${knob} rounded-full bg-white shadow transition-transform flex items-center justify-center ${value ? shift : ''}`}>
          {pending && <Loader2 size={11} className="animate-spin text-slate-500" />}
        </span>
      </button>
      {locked && <Lock size={12} className="text-slate-400" aria-hidden />}
    </span>
  );
}

export type TriValue = 'INHERIT' | 'ALLOW' | 'DENY';
/** Segmented Inherit / Allow / Deny control with the same optimistic + rollback semantics. */
export function TriState({
  value, onChange, lockReason, label, allowDisabled, testId, labels,
}: {
  value: TriValue; onChange: (next: TriValue) => Promise<boolean | void>; lockReason?: string | null; label: string;
  allowDisabled?: boolean; testId?: string; labels?: Partial<Record<TriValue, string>>;
}) {
  const { addToast } = useToast();
  const [optimistic, setOptimistic] = useState<TriValue | null>(null);
  const [pending, setPending] = useState(false);
  const current = optimistic ?? value;
  const set = async (next: TriValue) => {
    if (pending || lockReason || next === current) return;
    setOptimistic(next); setPending(true);
    try { const r = await onChange(next); if (r === false) setOptimistic(null); }
    catch (err) { setOptimistic(null); addToast(apiErrorMessage(err), 'error'); }
    finally { setPending(false); setOptimistic(null); }
  };
  const opts: { v: TriValue; text: string; cls: string }[] = [
    { v: 'INHERIT', text: labels?.INHERIT || 'Inherit', cls: 'bg-slate-600 text-white' },
    { v: 'ALLOW', text: labels?.ALLOW || 'Allow', cls: 'bg-emerald-600 text-white' },
    { v: 'DENY', text: labels?.DENY || 'Deny', cls: 'bg-rose-600 text-white' },
  ];
  return (
    <div role="radiogroup" aria-label={label} title={lockReason || label} data-testid={testId}
      className={`inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-semibold ${lockReason ? 'opacity-60' : ''}`}>
      {opts.map((o) => {
        const active = current === o.v;
        const dis = Boolean(lockReason) || pending || (o.v === 'ALLOW' && allowDisabled);
        return (
          <button key={o.v} type="button" role="radio" aria-checked={active} disabled={dis} onClick={() => set(o.v)}
            className={`px-2.5 py-1 transition-colors ${active ? o.cls : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'} ${dis ? 'cursor-not-allowed' : ''}`}>
            {pending && active ? <Loader2 size={11} className="inline animate-spin" /> : o.text}
          </button>
        );
      })}
      {lockReason && <span className="px-1.5 flex items-center text-slate-400"><Lock size={11} aria-hidden /></span>}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  default: 'Default', school: 'School', role: 'Role', user_override: 'Personal', global: 'Global', plan: 'Plan',
  school_override: 'School override', feature_default: 'Default', catalog: 'Core', ceiling: 'N/A', super_admin: 'Super Admin',
};
export function SourceBadge({ source }: { source: string }) {
  const tone = source === 'user_override' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
    : source === 'school' || source === 'role' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
      : source === 'school_override' || source === 'global' || source === 'plan' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${tone}`}>{SOURCE_LABEL[source] || source}</span>;
}

export type ConfirmRequest = {
  title: string; body: ReactNode; impact?: string | null; confirmText: string; tone?: 'danger' | 'neutral';
  requireReason?: boolean; withExpiry?: boolean;
};
/** Confirmation with optional reason + expiry (used for login disable, feature OFF, global switch, dangerous permissions). */
export function ConfirmChangeModal({ req, onCancel, onConfirm }: {
  req: ConfirmRequest | null; onCancel: () => void; onConfirm: (reason: string, expiresAt: string | null) => void;
}) {
  const [reason, setReason] = useState('');
  const [expires, setExpires] = useState('');
  if (!req) return null;
  const danger = req.tone !== 'neutral';
  const reasonOk = !req.requireReason || reason.trim().length >= 3;
  const close = () => { setReason(''); setExpires(''); onCancel(); };
  const confirm = () => {
    if (!reasonOk) return;
    const r = reason.trim(); const e = expires ? new Date(expires).toISOString() : null;
    setReason(''); setExpires('');
    onConfirm(r, e);
  };
  return (
    <div className="fixed inset-0 z-[10060] bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={req.title}>
      <div className={`w-[min(480px,95vw)] rounded-2xl bg-white dark:bg-slate-900 border shadow-2xl ${danger ? 'border-rose-200 dark:border-rose-900/50' : 'border-slate-200 dark:border-slate-700'}`}>
        <div className={`px-5 py-4 border-b flex items-center justify-between ${danger ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/40' : 'border-slate-100 dark:border-slate-800'}`}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={20} className={danger ? 'text-rose-600' : 'text-amber-500'} />
            <h3 className="m-0 text-base font-extrabold text-slate-900 dark:text-slate-100">{req.title}</h3>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <div>{req.body}</div>
          {req.impact && <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-3 py-2 text-xs font-semibold">{req.impact}</div>}
          {req.requireReason && (
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase">Reason (required, shown in the audit log)</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} autoFocus
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
            </label>
          )}
          {req.withExpiry && (
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase">Expires (optional)</span>
              <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
            </label>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button type="button" onClick={close} className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">Cancel</button>
          <button type="button" onClick={confirm} disabled={!reasonOk} data-testid="confirm-change"
            className={`px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {req.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Promise-based confirm hook: const ok = await confirm({...}) → { reason, expiresAt } | null */
export function useConfirmChange() {
  const [state, setState] = useState<{ req: ConfirmRequest; resolve: (v: { reason: string; expiresAt: string | null } | null) => void } | null>(null);
  const confirm = (req: ConfirmRequest) => new Promise<{ reason: string; expiresAt: string | null } | null>((resolve) => setState({ req, resolve }));
  const modal = (
    <ConfirmChangeModal
      req={state?.req || null}
      onCancel={() => { state?.resolve(null); setState(null); }}
      onConfirm={(reason, expiresAt) => { state?.resolve({ reason, expiresAt }); setState(null); }}
    />
  );
  return { confirm, modal };
}

export function StatusBanner({ mode, store }: { mode?: string; store?: string }) {
  if (store && store !== 'READY') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900/50 px-4 py-3 text-sm text-rose-800 dark:text-rose-200" role="status">
        Access-control storage is <b>{store === 'NOT_INSTALLED' ? 'not installed' : 'unavailable'}</b>. Everyone has their default access; changes cannot be saved until the database migration is applied.
      </div>
    );
  }
  if (mode && mode !== 'enforce') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-200" role="status">
        Enforcement mode is <b>{mode}</b>: changes are saved and audited, {mode === 'shadow' ? 'and would-be denials are logged, ' : ''}but they are <b>not yet enforced</b>.
      </div>
    );
  }
  return null;
}
