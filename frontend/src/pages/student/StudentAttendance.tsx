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
      <div className="student-subpage-header">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title">My Attendance Record</h1>
          <p className="student-subpage-desc">
            Official institutional attendance log verified by faculty members.
          </p>
        </div>

        {/* Date Filter */}
        <div className="student-filter-bar">
          <label className="student-filter-field">
            <span className="student-filter-label">From:</span>
            <input
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              value={from}
              onChange={(e) => handleDateInput(e.target.value, setFrom)}
            />
          </label>
          <label className="student-filter-field">
            <span className="student-filter-label">To:</span>
            <input
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              value={to}
              onChange={(e) => handleDateInput(e.target.value, setTo)}
            />
          </label>
          <button type="button" onClick={load} className="student-btn-primary student-filter-btn">
            <Filter size={14} /> Filter
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="student-att-kpi-row">
        <div className="student-kpi-stat-card">
          <span className="stat-label">Overall Attendance</span>
          <span className="stat-value text-primary">{summary.percentage}%</span>
          <span className="stat-sub">Minimum requirement: 75%</span>
        </div>
        <div className="student-kpi-stat-card">
          <span className="stat-label">Days Present</span>
          <span className="stat-value text-success">{summary.present}</span>
          <span className="stat-sub">Marked in classroom</span>
        </div>
        <div className="student-kpi-stat-card">
          <span className="stat-label">Days Absent</span>
          <span className="stat-value text-danger">{summary.absent}</span>
          <span className="stat-sub">Excused & unexcused</span>
        </div>
        <div className="student-kpi-stat-card">
          <span className="stat-label">Total Working Days</span>
          <span className="stat-value">{summary.total}</span>
          <span className="stat-sub">Recorded sessions</span>
        </div>
      </div>

      <div className="student-card" style={{ marginTop: 24 }}>
        <div className="student-card-header">
          <div className="student-card-title-wrap">
            <CalendarCheck size={18} />
            <h3 className="student-card-title">Session-wise Attendance History</h3>
          </div>
          <span className="student-readonly-tag">
            <AlertCircle size={14} /> Read-Only Record
          </span>
        </div>

        {loading ? (
          <div className="student-loading-spinner">Loading attendance records...</div>
        ) : records.length === 0 ? (
          <div className="student-empty-state">
            <p>No attendance records found for the selected date range.</p>
          </div>
        ) : (
          <div className="student-table-wrap">
            <table className="student-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>TIMING</th>
                  <th>SUBJECT</th>
                  <th>FACULTY</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td className="font-semibold">{formatDateDDMMYYYY(r.attendance_date)}</td>
                    <td>{r.start_time?.slice(0, 5)} - {r.end_time?.slice(0, 5)}</td>
                    <td>{r.subject_name || 'Academic Class'}</td>
                    <td>{r.teacher_name || 'Class Teacher'}</td>
                    <td>
                      <span className={`student-status-badge status-${r.status.toLowerCase()}`}>
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
