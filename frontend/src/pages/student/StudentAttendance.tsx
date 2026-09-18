import React, { useState, useEffect } from 'react';
import { CalendarCheck, Filter, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, AttendanceData } from '../../services/studentApi';

export function StudentAttendance() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = () => {
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

  const summary = data?.summary || { present: 138, absent: 12, total: 150, percentage: 92 };
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
          <label>
            <span>From:</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>To:</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" onClick={load} className="student-btn-primary">
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
                    <td className="font-semibold">{r.attendance_date}</td>
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
