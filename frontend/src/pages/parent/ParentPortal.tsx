import React, { useEffect, useState } from 'react';
import { api } from '../../api';

export default function ParentPortal() {
  const [children, setChildren] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  async function loadChildren() {
    try {
      const r = await api.get('/parent-portal/children');
      setChildren(r.data);
      if (r.data[0]) setSelected(r.data[0]);
    } catch (e: any) {
      setMessage(e?.response?.data?.message || 'Unable to load children');
    }
  }

  async function loadAttendance() {
    if (!selected) return;
    try {
      const r = await api.get(`/parent-portal/children/${selected.id}/attendance`, { params: { from, to } });
      setData(r.data);
    } catch (e: any) {
      setMessage(e?.response?.data?.message || 'Unable to load attendance');
    }
  }

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [selected, from, to]);

  return (
    <div className="feature-page max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Parent Portal</h1>
      <p className="muted text-sm text-slate-500 dark:text-slate-400 mb-6">View your linked child's attendance and attendance percentage.</p>
      
      {message && <div className="error mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-sm">{message}</div>}
      
      <div className="action-row flex items-center gap-2 mb-4.5 flex-wrap">
        {children.map(c => (
          <button
            key={c.id}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              selected?.id === c.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'secondary bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            onClick={() => setSelected(c)}
          >
            {c.name} · {c.class_name || ''}
          </button>
        ))}
      </div>

      {selected && (
        <div className="space-y-4">
          <div className="panel bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{selected.name}</h3>
            <p className="muted text-sm text-slate-500 dark:text-slate-400 mb-4">Class {selected.class_name || '-'} / {selected.section_name || '-'} · Roll {selected.roll}</p>
            <div className="filter-row flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
                From: <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-2.5 py-1 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
                To: <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-2.5 py-1 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
              </label>
            </div>
          </div>

          {data && (
            <div className="summary-grid grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="summary-card bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-1">Present</b>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.summary.present}</div>
              </div>
              <div className="summary-card bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-1">Absent</b>
                <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{data.summary.absent}</div>
              </div>
              <div className="summary-card bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-1">Marked</b>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{data.summary.marked}</div>
              </div>
              <div className="summary-card bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <b className="text-xs uppercase text-slate-500 dark:text-slate-400 block mb-1">Attendance</b>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.summary.percentage}%</div>
              </div>
            </div>
          )}

          <div className="table-wrap bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs mt-4">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Date</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Time</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Teacher</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.records || []).map((r: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 px-4 text-slate-800 dark:text-slate-200">{String(r.attendance_date).slice(0, 10)}</td>
                    <td className="p-3 px-4 text-slate-800 dark:text-slate-200">{r.start_time || '-'}{r.end_time ? ` - ${r.end_time}` : ''}</td>
                    <td className="p-3 px-4 text-slate-800 dark:text-slate-200">{r.teacher_name || '-'}</td>
                    <td className="p-3 px-4">
                      <span className={`badge inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        r.status === 'PRESENT'
                          ? 'sent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'failed bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!children.length && (
        <div className="panel bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="muted text-slate-500 dark:text-slate-400">No student is linked to this parent account yet.</p>
        </div>
      )}
    </div>
  );
}
