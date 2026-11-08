/**
 * Dependency-free access gate context (no import of useAuth → no circular imports).
 * AccessProvider supplies the checker; RoleGuard/Guard consume it.
 * Frontend gating is UX only — the backend is authoritative.
 */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';

export type AccessVerdict = { allowed: boolean; reason?: string; permission?: string | null; feature?: string | null };
export type AccessCheck = (q: { permission?: string; feature?: string; path?: string }) => AccessVerdict;

const allowAll: AccessCheck = () => ({ allowed: true });
export const AccessGateContext = createContext<AccessCheck>(allowAll);
export const useAccessCheck = () => useContext(AccessGateContext);

const REASON_TEXT: Record<string, string> = {
  FEATURE_DISABLED: 'This feature is not enabled for your school.',
  ROLE_DENY: 'Your school administrator has turned this off for your role.',
  USER_DENY: 'Your school administrator has restricted this for your account.',
  DEFAULT_DENY: 'Your role does not include this permission.',
  ACCOUNT_DISABLED: 'Your account has been disabled.',
};

export function accessReasonText(reason?: string) {
  return (reason && REASON_TEXT[reason]) || 'You do not have access to this page.';
}

export function AccessRestricted({ verdict, children }: { verdict: AccessVerdict; children?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4" data-testid="access-restricted">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-8 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <ShieldOff size={28} />
        </div>
        <h2 className="m-0 text-xl font-extrabold text-slate-900 dark:text-slate-100">Access restricted</h2>
        <p className="mt-2 mb-6 text-sm text-slate-600 dark:text-slate-400">{accessReasonText(verdict.reason)}</p>
        {children}
        <button
          type="button"
          onClick={() => nav('/dashboard', { replace: true })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </button>
      </div>
    </div>
  );
}
