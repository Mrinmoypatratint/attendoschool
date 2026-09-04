import React, { useEffect, useState } from 'react';
import {api} from './api';

type Row = {
  student_id: string;
  student_name: string;
  roll: string | number;
  class_name?: string;
  section_name?: string;
  present_days: number;
  absent_days: number;
  marked_days: number;
  attendance_percentage: number;
};

export default function AttendanceReportsV12() {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(1);
  const [from, setFrom] = useState(fromDate.toISOString().slice(0, 10));
  const [toDate, setTo] = useState(to);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [s, r] = await Promise.all([
        api.get('/attendance-reports-v12/summary', { params: { from, to: toDate } }),
        api.get('/attendance-reports-v12/students', { params: { from, to: toDate } })
      ]);
      setSummary(s.data); setRows(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Unable to load report');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function downloadCsv() {
    const header = ['Student','Roll','Class','Section','Present','Absent','Marked','Attendance %'];
    const body = rows.map(r => [
      r.student_name, r.roll, r.class_name || '', r.section_name || '',
      r.present_days, r.absent_days, r.marked_days, r.attendance_percentage
    ]);
    const csv = [header, ...body].map(line => line.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance-report-${from}-to-${toDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="feature-page">
      <div className="feature-header">
        <div>
          <h1>Attendance Reports</h1>
          <p className="muted">Student-wise attendance for the selected period.</p>
        </div>
        <button onClick={downloadCsv} disabled={!rows.length}>Export CSV</button>
      </div>

      <div className="filter-row">
        <label>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={toDate} onChange={e => setTo(e.target.value)} /></label>
        <button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Apply'}</button>
      </div>

      {error && <div className="error">{error}</div>}

      {summary && (
        <div className="summary-grid">
          <div className="summary-card"><b>Present</b><div>{summary.present}</div></div>
          <div className="summary-card"><b>Absent</b><div>{summary.absent}</div></div>
          <div className="summary-card"><b>Marked</b><div>{summary.marked}</div></div>
          <div className="summary-card"><b>Attendance</b><div>{summary.percentage}%</div></div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>{['Student','Roll','Class','Section','Present','Absent','Marked','Attendance %'].map(h =>
              <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(r => <tr key={r.student_id}>
              <td>{r.student_name}</td>
              <td>{r.roll}</td>
              <td>{r.class_name || '-'}</td>
              <td>{r.section_name || '-'}</td>
              <td>{r.present_days}</td>
              <td>{r.absent_days}</td>
              <td>{r.marked_days}</td>
              <td><b>{r.attendance_percentage}%</b></td>
            </tr>)}
            {!rows.length && !loading && <tr><td colSpan={8}>No attendance records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
