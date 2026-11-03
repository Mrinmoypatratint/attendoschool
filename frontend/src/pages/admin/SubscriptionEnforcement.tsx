import React, { useEffect, useState } from 'react';
import { api } from '../../api';

export default function SubscriptionEnforcement() {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      const r = await api.get('/subscriptions/status');
      setData(r.data);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Unable to load subscription');
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (msg) {
    return (
      <div className="feature-page max-w-5xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Subscription Status</h1>
        <div className="error p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-sm">{msg}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="feature-page max-w-5xl mx-auto p-4 sm:p-6">
        <p className="muted text-slate-500 dark:text-slate-400">Loading subscription status…</p>
      </div>
    );
  }

  return (
    <div className="feature-page max-w-5xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Subscription Enforcement</h1>
      <p className="muted text-sm text-slate-500 dark:text-slate-400 mb-6">Plan enforcement, student/teacher tier limits, and automated grace periods.</p>

      <div className="summary-grid grid grid-cols-2 sm:grid-cols-3 gap-3.5 mb-6">
        <div className="summary-card bg-white dark:bg-slate-900 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Plan</b>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{data.plan_name || '—'}</div>
        </div>
        <div className="summary-card bg-white dark:bg-slate-900 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Status</b>
          <div>
            <span
              className={`badge inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                data.effective_status === 'ACTIVE'
                  ? 'active bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : data.effective_status === 'GRACE'
                  ? 'queued bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'expired bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              {data.effective_status}
            </span>
          </div>
        </div>
        <div className="summary-card bg-white dark:bg-slate-900 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Expiry</b>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{data.end_date ? new Date(data.end_date).toLocaleDateString() : '—'}</div>
        </div>
        <div className="summary-card bg-white dark:bg-slate-900 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Students</b>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {data.student_count}
            {data.max_students ? ` / ${data.max_students}` : ''}
          </div>
        </div>
        <div className="summary-card bg-white dark:bg-slate-900 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Teachers</b>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {data.teacher_count}
            {data.max_teachers ? ` / ${data.max_teachers}` : ''}
          </div>
        </div>
        <div className="summary-card bg-white dark:bg-slate-900 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-1 font-semibold">Grace Period</b>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{data.effective_grace_days} days</div>
        </div>
      </div>

      {data.effective_status !== 'ACTIVE' && (
        <div className="panel bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 shadow-xs mt-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Notice</h3>
          <p className="muted text-sm text-slate-600 dark:text-slate-300 m-0 leading-relaxed">
            {data.effective_status === 'GRACE'
              ? 'Your subscription is currently in the grace period. Please renew soon to avoid service interruption.'
              : 'Your subscription has expired. Attendance operations are restricted until renewed.'}
          </p>
        </div>
      )}
    </div>
  );
}
