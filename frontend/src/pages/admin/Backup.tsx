import React, { useEffect, useState } from 'react';
import { api } from '../../api';

export default function Backup() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setJobs((await api.get('/backups/jobs')).data);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Unable to load backups');
    }
  }

  async function create() {
    setBusy(true);
    setMsg('Creating database backup…');
    try {
      await api.post('/backups/create');
      setMsg('Backup completed successfully.');
      load();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Backup failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="feature-page max-w-6xl mx-auto p-4 sm:p-6">
      <div className="feature-header flex justify-between items-start gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Backup & Disaster Recovery</h1>
          <p className="muted text-sm text-slate-500 dark:text-slate-400">Database backups, checksum tracking and restore-test records.</p>
        </div>
        <button
          onClick={create}
          disabled={busy}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-xs"
        >
          {busy ? 'Creating…' : 'Create Backup Now'}
        </button>
      </div>

      {msg && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm border ${
            msg.includes('failed')
              ? 'error bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/40'
              : 'success bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40'
          }`}
        >
          {msg}
        </div>
      )}

      <div className="table-wrap bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Status</th>
              <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Started</th>
              <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">File</th>
              <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Size</th>
              <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="p-3 px-4">
                  <span
                    className={`badge inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      j.status === 'COMPLETED'
                        ? 'active bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'queued bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    }`}
                  >
                    {j.status}
                  </span>
                </td>
                <td className="p-3 px-4 text-slate-800 dark:text-slate-200">{new Date(j.started_at).toLocaleString()}</td>
                <td className="p-3 px-4 text-slate-800 dark:text-slate-200">{j.file_name || '—'}</td>
                <td className="p-3 px-4 text-slate-800 dark:text-slate-200">{j.size_bytes ? `${Math.round(j.size_bytes / 1024)} KB` : '—'}</td>
                <td className="p-3 px-4">
                  <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    {j.checksum_sha256 ? j.checksum_sha256.slice(0, 16) + '…' : '—'}
                  </code>
                </td>
              </tr>
            ))}
            {!jobs.length && (
              <tr>
                <td colSpan={5} className="muted p-5 text-center text-slate-500 dark:text-slate-400">
                  No backup jobs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
