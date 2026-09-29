import React, { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import {
  Download,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  Filter,
  FileSpreadsheet
} from 'lucide-react';

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

export default function AttendanceReports() {
  const { user } = useAuth();
  if (user?.role === 'SUPER_ADMIN') {
    return <Navigate to="/super-admin/reports" replace />;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const startOfMonth = todayStr.slice(0, 8) + '01';

  const [from, setFrom] = useState(startOfMonth);
  const [toDate, setTo] = useState(todayStr);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [s, r] = await Promise.all([
        api.get('/attendance-reports/summary', { params: { from, to: toDate } }),
        api.get('/attendance-reports/students', { params: { from, to: toDate } })
      ]);
      setSummary(s.data);
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Unable to load attendance reports.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [from, toDate]);

  // Quick Preset Handlers
  const handleQuickPreset = (preset: 'today' | 'this_week' | 'this_month' | 'last_30') => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (preset === 'today') {
      setFrom(today);
      setTo(today);
    } else if (preset === 'this_week') {
      const first = new Date(now.setDate(now.getDate() - now.getDay()));
      setFrom(first.toISOString().slice(0, 10));
      setTo(new Date().toISOString().slice(0, 10));
    } else if (preset === 'this_month') {
      setFrom(today.slice(0, 8) + '01');
      setTo(today);
    } else if (preset === 'last_30') {
      const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setFrom(past.toISOString().slice(0, 10));
      setTo(today);
    }
  };

  // Distinct classes for dropdown
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      if (r.class_name) set.add(r.class_name);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (selectedClass !== 'ALL' && r.class_name !== selectedClass) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        r.student_name.toLowerCase().includes(q) ||
        String(r.roll).toLowerCase().includes(q) ||
        (r.class_name && r.class_name.toLowerCase().includes(q)) ||
        (r.section_name && r.section_name.toLowerCase().includes(q))
      );
    });
  }, [rows, searchQuery, selectedClass]);

  function downloadCsv() {
    const header = ['Student Name', 'Roll Number', 'Class', 'Section', 'Present Days', 'Absent Days', 'Total Marked Sessions', 'Attendance Rate (%)'];
    const body = filteredRows.map(r => [
      r.student_name,
      r.roll,
      r.class_name || '—',
      r.section_name || '—',
      r.present_days,
      r.absent_days,
      r.marked_days,
      `${r.attendance_percentage}%`
    ]);
    const csv = [header, ...body].map(line => line.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${from}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const avgRate = summary?.percentage ?? (rows.length > 0
    ? Number((rows.reduce((acc, cur) => acc + cur.attendance_percentage, 0) / rows.length).toFixed(1))
    : 0);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ─── Top Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0f172a)', margin: 0, letterSpacing: '-0.02em' }}>
            Attendance Reports
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: 'var(--text-muted, #64748b)' }}>
            Institutional student attendance analytics and verified presence logs from Firestore.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={downloadCsv}
            disabled={!filteredRows.length}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: filteredRows.length ? 'pointer' : 'not-allowed',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--bg-card, #ffffff)',
              color: filteredRows.length ? 'var(--text, #1e293b)' : 'var(--text-muted, #94a3b8)',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', marginBottom: 20, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      {/* ─── 4 Summary KPI Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Attendance Rate */}
        <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 14, padding: 18, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: avgRate >= 85 ? '#dcfce7' : avgRate >= 75 ? '#fef3c7' : '#fee2e2', color: avgRate >= 85 ? '#15803d' : avgRate >= 75 ? '#b45309' : '#b91c1c' }}>
              {avgRate >= 85 ? 'Exemplary' : avgRate >= 75 ? 'Moderate' : 'Needs Review'}
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Average Attendance
          </span>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0f172a)', margin: '4px 0 2px' }}>
            {loading ? '…' : `${avgRate}%`}
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>
            Calculated across marked student logs
          </span>
        </div>

        {/* Present Days */}
        <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 14, padding: 18, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a' }}>
              Verified Present
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Present Attendance
          </span>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', margin: '4px 0 2px' }}>
            {loading ? '…' : (summary?.present ?? 0).toLocaleString()}
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>
            Total confirmed attendances
          </span>
        </div>

        {/* Absent Days */}
        <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 14, padding: 18, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#fee2e2', color: '#dc2626' }}>
              Flagged Absences
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Absent Days
          </span>
          <div style={{ fontSize: 26, fontWeight: 800, color: (summary?.absent ?? 0) > 0 ? '#ef4444' : 'var(--text, #0f172a)', margin: '4px 0 2px' }}>
            {loading ? '…' : (summary?.absent ?? 0).toLocaleString()}
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>
            Parent notification telemetry
          </span>
        </div>

        {/* Marked Sessions */}
        <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 14, padding: 18, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#faf5ff', color: '#9333ea' }}>
              Period Logs
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Marked Sessions
          </span>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0f172a)', margin: '4px 0 2px' }}>
            {loading ? '…' : (summary?.marked ?? 0).toLocaleString()}
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>
            Recorded from {from} to {toDate}
          </span>
        </div>
      </div>

      {/* ─── Filter & Search Bar ─── */}
      <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 14, padding: '16px 20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          {/* Left: Search & Class Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search student or roll number…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text, #0f172a)',
                  fontSize: 13
                }}
              />
            </div>

            {classOptions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={15} style={{ color: '#64748b' }} />
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #cbd5e1)',
                    background: 'var(--bg, #f8fafc)',
                    color: 'var(--text, #0f172a)',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                >
                  <option value="ALL">All Classes ({rows.length})</option>
                  {classOptions.map(c => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right: Date Range & Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>From</label>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text, #0f172a)',
                  fontSize: 13
                }}
              />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>to</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setTo(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text, #0f172a)',
                  fontSize: 13
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => handleQuickPreset('today')}
                style={{ padding: '6px 10px', fontSize: 11.5, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg, #f8fafc)', color: 'var(--text, #334155)', cursor: 'pointer' }}
              >
                Today
              </button>
              <button
                onClick={() => handleQuickPreset('this_week')}
                style={{ padding: '6px 10px', fontSize: 11.5, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg, #f8fafc)', color: 'var(--text, #334155)', cursor: 'pointer' }}
              >
                This Week
              </button>
              <button
                onClick={() => handleQuickPreset('this_month')}
                style={{ padding: '6px 10px', fontSize: 11.5, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg, #f8fafc)', color: 'var(--text, #334155)', cursor: 'pointer' }}
              >
                This Month
              </button>
              <button
                onClick={() => handleQuickPreset('last_30')}
                style={{ padding: '6px 10px', fontSize: 11.5, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg, #f8fafc)', color: 'var(--text, #334155)', cursor: 'pointer' }}
              >
                Last 30D
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Attendance Table Card ─── */}
      <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSpreadsheet size={18} style={{ color: '#2563eb' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
              Verified Student Attendance Log
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginLeft: 6 }}>
              ({filteredRows.length} {filteredRows.length === 1 ? 'record' : 'records'})
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                <th style={{ padding: '12px 18px', width: 44, color: 'var(--text-muted, #64748b)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>#</th>
                <th style={{ padding: '12px 18px', color: 'var(--text-muted, #64748b)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Student</th>
                <th style={{ padding: '12px 18px', color: 'var(--text-muted, #64748b)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Roll</th>
                <th style={{ padding: '12px 18px', color: 'var(--text-muted, #64748b)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Class & Section</th>
                <th style={{ padding: '12px 18px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Present</th>
                <th style={{ padding: '12px 18px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Absent</th>
                <th style={{ padding: '12px 18px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Marked</th>
                <th style={{ padding: '12px 18px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Attendance Rate</th>
                <th style={{ padding: '12px 18px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted, #64748b)' }}>
                    <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 10px', display: 'block', color: '#2563eb' }} />
                    Retrieving attendance records from Firestore…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-muted, #64748b)' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <Calendar size={24} />
                    </div>
                    <strong style={{ fontSize: 15, color: 'var(--text, #0f172a)', display: 'block', marginBottom: 4 }}>
                      No attendance records found
                    </strong>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #64748b)', maxWidth: 440, marginInline: 'auto' }}>
                      No attendance sessions were marked for the selected date range ({from} to {toDate}). Select a different date range or record attendance from the Take Attendance panel.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => {
                  const pct = r.attendance_percentage;
                  const isHigh = pct >= 85;
                  const isMed = pct >= 75 && pct < 85;
                  const statusLabel = isHigh ? 'EXEMPLARY' : isMed ? 'REGULAR' : 'AT RISK';
                  const statusBg = isHigh ? '#dcfce7' : isMed ? '#fef3c7' : '#fee2e2';
                  const statusColor = isHigh ? '#15803d' : isMed ? '#b45309' : '#b91c1c';

                  return (
                    <tr
                      key={r.student_id || idx}
                      style={{ borderBottom: '1px solid var(--border, #f1f5f9)', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg, #f8fafc)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              flexShrink: 0
                            }}
                          >
                            {r.student_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ fontSize: 13.5, color: 'var(--text, #0f172a)', display: 'block' }}>
                              {r.student_name}
                            </strong>
                            <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                              ID: {r.student_id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text, #1e293b)' }}>
                        {r.roll}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, background: 'var(--bg, #f1f5f9)', fontSize: 12, fontWeight: 600, color: 'var(--text, #334155)' }}>
                          Class {r.class_name || '—'} - {r.section_name || 'A'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>
                        {r.present_days}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 700, color: r.absent_days > 0 ? '#ef4444' : 'var(--text-muted, #94a3b8)' }}>
                        {r.absent_days}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                        {r.marked_days}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <div style={{ width: 64, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, pct))}%`,
                                height: '100%',
                                background: isHigh ? '#16a34a' : isMed ? '#f59e0b' : '#ef4444',
                                borderRadius: 4
                              }}
                            />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text, #0f172a)' }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: statusBg, color: statusColor, letterSpacing: '0.04em' }}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
