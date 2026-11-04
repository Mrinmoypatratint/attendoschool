import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { getQueue, syncOffline } from '../../services/offlineAttendanceQueue';

export default function OfflineAttendance() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(getQueue().length);
  const [msg, setMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      syncOffline(api).then(r => {
        setQueued(getQueue().length);
        if (r.synced) setMsg(`${r.synced} offline batch(es) synchronized.`);
      });
    };
    const off = () => setOnline(false);

    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  async function sync() {
    setSyncing(true);
    try {
      const r = await syncOffline(api);
      setQueued(getQueue().length);
      setMsg(r.offline ? 'You are offline.' : 'Synchronization completed.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="feature-page max-w-4xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Offline Attendance</h1>
      <p className="muted text-sm text-slate-500 dark:text-slate-400 mb-6">
        Record attendance without internet. Records queue locally in IndexedDB/localStorage and sync automatically when connection restores.
      </p>

      <div className="summary-grid grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="summary-card bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-2 font-semibold">Connection Status</b>
          <div>
            <span
              className={`badge inline-block px-3 py-1 rounded-full text-xs font-bold ${
                online
                  ? 'active bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'expired bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
        <div className="summary-card bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-2 font-semibold">Queued Batches</b>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white">{queued}</div>
        </div>
      </div>

      <div className="panel bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs mt-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Manual Synchronization</h3>
        <p className="muted text-sm text-slate-500 dark:text-slate-400 mb-4">Click below to push pending offline attendance records to the server.</p>
        <button
          onClick={sync}
          disabled={!online || syncing}
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-xs"
        >
          {syncing ? 'Syncing…' : 'Synchronize Now'}
        </button>
        {msg && (
          <div className="success mt-3.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 text-sm font-medium">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
