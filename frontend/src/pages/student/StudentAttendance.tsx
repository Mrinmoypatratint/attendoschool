import React, { useState, useEffect } from 'react';
import { CalendarCheck, Filter, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, AttendanceData } from '../../services/studentApi';

function formatDateDDMMYYYY(raw: any): string {
  if (!raw) return '—';
  try {
    const str = String(raw).trim();
    if (str.includes('T') || str.includes(':')) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      }
    }
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    }
    return str;
  } catch {
    return String(raw);
  }
}

export function StudentAttendance() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Date Year Formatter helper (restrict year to max 4 digits)
  function handleDateInput(val: string, setter: (v: string) => void) {
    if (!val) {
      setter('');
      return;
    }
    const parts = val.split('-');
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
      setter(parts.join('-'));
      return;
    }
    setter(val);
  }

  const load = () => {
    // Validate year length <= 4 digits
    const checkValidYear = (val: string) => {
      if (!val) return true;
      const yr = val.split('-')[0];
      return yr.length <= 4 && !isNaN(Number(yr)) && Number(yr) <= 9999;
    };
    if (!checkValidYear(from) || !checkValidYear(to)) {
      return;
    }
    setLoading(true);
    studentApi
      .getAttendance(from, to)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const summary = data?.summary || { present: 0, absent: 0, total: 0, percentage: 0 };
  const records = data?.records || [];

  return (
    <div className="student-subpage">
      <div className="student-subpage-header flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-2">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title text-2xl font-bold text-slate-900 dark:text-white m-0 mb-1">My Attendance Record</h1>
          <p className="student-subpage-desc text-sm text-slate-500 dark:text-slate-400 m-0">
            Official institutional attendance log verified by faculty members.
          </p>
        </div>

        {/* Date Filter */}
        <div className="student-filter-bar flex items-center gap-2.5 flex-wrap bg-white dark:bg-[#1c1c1c] p-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>From:</span>
            <input
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              value={from}
              onChange={(e) => handleDateInput(e.target.value, setFrom)}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>To:</span>
            <input
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              value={to}
              onChange={(e) => handleDateInput(e.target.value, setTo)}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </label>
          <button
            type="button"
            onClick={load}
            className="student-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
          >
            <Filter size={14} /> Filter
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="student-att-kpi-row grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <div className="student-kpi-stat-card bg-white dark:bg-[#1c1c1c] p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="stat-label text-xs uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1.5 tracking-wider">Overall Attendance</span>
          <span className="stat-value text-primary text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 block mb-1">{summary.percentage}%</span>
          <span className="stat-sub text-xs text-slate-400 dark:text-slate-500 block">Minimum requirement: 75%</span>
        </div>
        <div className="student-kpi-stat-card bg-white dark:bg-[#1c1c1c] p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="stat-label text-xs uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1.5 tracking-wider">Days Present</span>
          <span className="stat-value text-success text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 block mb-1">{summary.present}</span>
          <span className="stat-sub text-xs text-slate-400 dark:text-slate-500 block">Marked in classroom</span>
        </div>
        <div className="student-kpi-stat-card bg-white dark:bg-[#1c1c1c] p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="stat-label text-xs uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1.5 tracking-wider">Days Absent</span>
          <span className="stat-value text-danger text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 block mb-1">{summary.absent}</span>
          <span className="stat-sub text-xs text-slate-400 dark:text-slate-500 block">Excused & unexcused</span>
        </div>
        <div className="student-kpi-stat-card bg-white dark:bg-[#1c1c1c] p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="stat-label text-xs uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1.5 tracking-wider">Total Working Days</span>
          <span className="stat-value text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white block mb-1">{summary.total}</span>
          <span className="stat-sub text-xs text-slate-400 dark:text-slate-500 block">Recorded sessions</span>
        </div>
      </div>

      <div className="student-card bg-white dark:bg-[#1c1c1c] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
        <div className="student-card-header flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="student-card-title-wrap flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <CalendarCheck size={18} />
            <h3 className="student-card-title text-base font-bold text-slate-900 dark:text-white m-0">Session-wise Attendance History</h3>
          </div>
          <span className="student-readonly-tag inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <AlertCircle size={14} /> Read-Only Record
          </span>
        </div>

        {loading ? (
          <div className="student-loading-spinner py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading attendance records...</div>
        ) : records.length === 0 ? (
          <div className="student-empty-state py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            <p>No attendance records found for the selected date range.</p>
          </div>
        ) : (
          <div className="student-table-wrap overflow-x-auto">
            <table className="student-table w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">DATE</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">TIMING</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">SUBJECT</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">FACULTY</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 px-4 font-semibold text-slate-900 dark:text-white">{formatDateDDMMYYYY(r.attendance_date)}</td>
                    <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{r.start_time?.slice(0, 5)} - {r.end_time?.slice(0, 5)}</td>
                    <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{r.subject_name || 'Academic Class'}</td>
                    <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{r.teacher_name || 'Class Teacher'}</td>
                    <td className="p-3.5 px-4">
                      <span className={`student-status-badge status-${r.status.toLowerCase()} inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        r.status === 'PRESENT'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}>
                        {r.status === 'PRESENT' ? 'Present' : 'Absent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
