import React, { useState } from 'react';
import { api } from '../../api';

export default function Security() {
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    try {
      const r = await api.post('/security/validate-password', { password });
      setResult(r.data);
      setMsg('');
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Unable to check password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="feature-page max-w-4xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Security Center</h1>
      <p className="muted text-sm text-slate-500 dark:text-slate-400 mb-6">Production security policies, header configurations, and defense mechanisms.</p>

      <div className="panel max-w-[600px] bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Password Policy Validator</h3>
        <p className="muted text-sm text-slate-500 dark:text-slate-400 mb-4">Test passwords against the SaaS strength rules (length, uppercase, lowercase, numbers, symbols).</p>
        <div className="form-inline flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Type a password to test…"
            className="flex-1 min-w-[200px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          <button
            onClick={check}
            disabled={busy || !password}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-xs shrink-0"
          >
            {busy ? 'Validating…' : 'Check Strength'}
          </button>
        </div>
        {result && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-sm">
            Valid:
            <span
              className={`badge inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ml-2 ${
                result.valid
                  ? 'active bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'expired bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              {result.valid ? 'PASSED' : 'FAILED'}
            </span>
            <div className="muted mt-2 text-[13px] text-slate-500 dark:text-slate-400">
              {result.requirements?.join(' · ')}
            </div>
          </div>
        )}
        {msg && (
          <div className="error mt-2.5 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-sm">
            {msg}
          </div>
        )}
      </div>

      <div className="panel max-w-[600px] bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Active Security Hardening</h3>
        <div className="list divide-y divide-slate-100 dark:divide-slate-800">
          <div className="list-row flex justify-between items-center py-2.5 text-sm">
            <b className="font-semibold text-slate-800 dark:text-slate-200">Rate Limiting</b>
            <span className="text-slate-500 dark:text-slate-400 text-right">120 requests/minute per client IP/user</span>
          </div>
          <div className="list-row flex justify-between items-center py-2.5 text-sm">
            <b className="font-semibold text-slate-800 dark:text-slate-200">Security Headers</b>
            <span className="text-slate-500 dark:text-slate-400 text-right">nosniff, DENY frame options, referrer policy</span>
          </div>
          <div className="list-row flex justify-between items-center py-2.5 text-sm">
            <b className="font-semibold text-slate-800 dark:text-slate-200">Brute Force Protection</b>
            <span className="text-slate-500 dark:text-slate-400 text-right">Account lockout & failed login monitoring</span>
          </div>
          <div className="list-row flex justify-between items-center py-2.5 text-sm">
            <b className="font-semibold text-slate-800 dark:text-slate-200">Audit Trail</b>
            <span className="text-slate-500 dark:text-slate-400 text-right">Comprehensive user and school action logging</span>
          </div>
          <div className="list-row flex justify-between items-center py-2.5 text-sm">
            <b className="font-semibold text-slate-800 dark:text-slate-200">Idempotency</b>
            <span className="text-slate-500 dark:text-slate-400 text-right">Webhook & payment transaction deduplication</span>
          </div>
        </div>
      </div>
    </div>
  );
}
