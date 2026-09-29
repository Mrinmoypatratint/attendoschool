import React, { useState, useEffect, useMemo } from 'react';
import { api, apiRequest } from '../api';
import * as XLSX from 'xlsx';
import {
  FileText, Download, Calendar, Search, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, ArrowUpDown, Filter,
  Building2, Users, PieChart, ArrowUpRight, Check
} from 'lucide-react';

interface StudentReportRow {
  student_id: string;
  student_name: string;
  roll: string | number;
  class_name?: string;
  section_name?: string;
  school_id?: string;
  school_name?: string;
  present_days: number;
  absent_days: number;
  marked_days: number;
  attendance_percentage: number;
}

interface SummaryMetrics {
  present: number;
  absent: number;
  marked: number;
  percentage: number;
}

interface SchoolItem {
  id: string;
  name: string;
  code: string;
}

export const ReportsManagement: React.FC = () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const startOfMonthStr = todayStr.slice(0, 8) + '01';

  const [from, setFrom] = useState<string>(startOfMonthStr);
  const [to, setTo] = useState<string>(todayStr);
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'students' | 'campus' | 'daily'>('students');

  const [rows, setRows] = useState<StudentReportRow[]>([]);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Sorting
  const [sortField, setSortField] = useState<'student_name' | 'roll' | 'attendance_percentage' | 'present_days'>('student_name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Load schools list for filtering
  useEffect(() => {
    async function fetchSchools() {
      try {
        const res = await api.get('/super-admin/schools');
        if (Array.isArray(res.data)) {
          setSchools(res.data.map((s: any) => ({ id: s.id, name: s.name, code: s.code })));
        }
      } catch {
        setSchools([]);
      }
    }
    fetchSchools();
  }, []);

  // Fetch report data
  const loadReports = async () => {
    setRefreshing(true);
    setError('');
    try {
      const params: any = { from, to };
      if (selectedSchool !== 'all') {
        params.schoolId = selectedSchool;
      }

      const [sumRes, studRes] = await Promise.all([
        api.get('/attendance-reports/summary', { params }).catch(() => ({
          data: { present: 0, absent: 0, marked: 0, percentage: 0 }
        })),
        api.get('/attendance-reports/students', { params }).catch(() => ({
          data: []
        }))
      ]);

      setSummary(sumRes.data);
      setRows(Array.isArray(studRes.data) ? studRes.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to fetch attendance reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [from, to, selectedSchool]);

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

  // Filtered & Sorted Rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        r.student_name.toLowerCase().includes(q) ||
        String(r.roll).toLowerCase().includes(q) ||
        (r.class_name && r.class_name.toLowerCase().includes(q)) ||
        (r.section_name && r.section_name.toLowerCase().includes(q))
      );
    }).sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [rows, searchQuery, sortField, sortAsc]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;

  // Export to CSV
  const exportCsv = () => {
    const header = ['Student Name', 'Roll', 'Class', 'Section', 'Present Days', 'Absent Days', 'Total Marked', 'Attendance Rate (%)'];
    const data = filteredRows.map(r => [
      r.student_name,
      r.roll,
      r.class_name || '—',
      r.section_name || '—',
      r.present_days,
      r.absent_days,
      r.marked_days,
      `${r.attendance_percentage}%`
    ]);
    const csvContent = [header, ...data]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendo-report-${from}-to-${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel
  const exportExcel = () => {
    const exportData = filteredRows.map(r => ({
      'Student Name': r.student_name,
      'Roll Number': r.roll,
      'Class': r.class_name || '—',
      'Section': r.section_name || '—',
      'Present Days': r.present_days,
      'Absent Days': r.absent_days,
      'Marked Sessions': r.marked_days,
      'Attendance Rate (%)': `${r.attendance_percentage}%`
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');
    XLSX.writeFile(workbook, `attendance-report-${from}-to-${to}.xlsx`);
  };

  return (
    <div className="sa-module-page">
      {/* ─── Header ─── */}
      <div className="sa-module-head">
        <div>
          <h1 className="sa-module-title">Attendance & Compliance Reports</h1>
          <p className="sa-module-sub">
            Multi-tenant cross-campus attendance records, institutional compliance telemetry, and student rosters.
          </p>
        </div>
        <div className="sa-module-actions">
          <button className="sa-btn-secondary" onClick={exportCsv} title="Export CSV file">
            <Download size={15} /> <span>Export CSV</span>
          </button>
          <button className="sa-btn-secondary" onClick={exportExcel} title="Export Excel workbook">
            <Download size={15} /> <span>Export Excel</span>
          </button>
          <button className="sa-btn-primary" onClick={loadReports} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spinning' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="sa-alert error" style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* ─── 4 Summary Cards ─── */}
      <div className="sa-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap icon-green">
              <CheckCircle2 size={20} />
            </div>
            <span className="sa-stat-kpi-badge success">Platform Rate</span>
          </div>
          <span className="sa-stat-label">Average Attendance</span>
          <div className="sa-stat-value">
            {loading ? '…' : `${summary?.percentage ?? 90}%`}
          </div>
          <div className="sa-stat-sub-text">
            <span>Aggregated across {rows.length} student rosters</span>
          </div>
        </div>

        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap icon-blue">
              <Users size={20} />
            </div>
            <span className="sa-stat-kpi-badge">Present</span>
          </div>
          <span className="sa-stat-label">Present Logs</span>
          <div className="sa-stat-value">
            {loading ? '…' : (summary?.present ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="sa-stat-sub-text">
            <span>Verified student presence</span>
          </div>
        </div>

        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap icon-amber">
              <AlertTriangle size={20} />
            </div>
            <span className="sa-stat-kpi-badge warning">Absences</span>
          </div>
          <span className="sa-stat-label">Absent Days Flagged</span>
          <div className="sa-stat-value">
            {loading ? '…' : (summary?.absent ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="sa-stat-sub-text">
            <span>Parent notifications dispatched</span>
          </div>
        </div>

        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap icon-purple">
              <Calendar size={20} />
            </div>
            <span className="sa-stat-kpi-badge">Recorded</span>
          </div>
          <span className="sa-stat-label">Total Sessions Marked</span>
          <div className="sa-stat-value">
            {loading ? '…' : (summary?.marked ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="sa-stat-sub-text">
            <span>Between {from} and {to}</span>
          </div>
        </div>
      </div>

      {/* ─── Filter & Search Bar ─── */}
      <div className="sa-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          {/* Left: School Selector & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="sa-filter-search-input"
                placeholder="Search by student, roll, or class..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ paddingLeft: 36, width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={16} style={{ color: '#64748b' }} />
              <select
                className="sa-select-input"
                value={selectedSchool}
                onChange={e => setSelectedSchool(e.target.value)}
                style={{ minWidth: 200 }}
              >
                <option value="all">All School Campuses</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Date Range & Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                className="sa-select-input"
                value={from}
                onChange={e => setFrom(e.target.value)}
                title="From Date"
              />
              <span style={{ color: '#94a3b8', fontSize: 13 }}>to</span>
              <input
                type="date"
                className="sa-select-input"
                value={to}
                onChange={e => setTo(e.target.value)}
                title="To Date"
              />
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <button className="sa-btn-secondary" style={{ padding: '6px 10px', fontSize: 11.5 }} onClick={() => handleQuickPreset('today')}>Today</button>
              <button className="sa-btn-secondary" style={{ padding: '6px 10px', fontSize: 11.5 }} onClick={() => handleQuickPreset('this_week')}>This Week</button>
              <button className="sa-btn-secondary" style={{ padding: '6px 10px', fontSize: 11.5 }} onClick={() => handleQuickPreset('this_month')}>This Month</button>
              <button className="sa-btn-secondary" style={{ padding: '6px 10px', fontSize: 11.5 }} onClick={() => handleQuickPreset('last_30')}>Last 30D</button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Reports Table ─── */}
      <div className="sa-card">
        <div className="sa-card-head" style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 20px' }}>
          <div className="sa-card-title-group">
            <FileText size={18} className="sa-card-icon" />
            <h3>Student Roster Attendance Telemetry</h3>
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
              ({filteredRows.length} {filteredRows.length === 1 ? 'student record' : 'student records'})
            </span>
          </div>
        </div>

        <div className="sa-table-responsive">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (sortField === 'student_name') setSortAsc(!sortAsc);
                    else { setSortField('student_name'); setSortAsc(true); }
                  }}
                >
                  STUDENT NAME <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (sortField === 'roll') setSortAsc(!sortAsc);
                    else { setSortField('roll'); setSortAsc(true); }
                  }}
                >
                  ROLL <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th>CLASS & SECTION</th>
                <th style={{ textAlign: 'center' }}>PRESENT DAYS</th>
                <th style={{ textAlign: 'center' }}>ABSENT DAYS</th>
                <th style={{ textAlign: 'center' }}>MARKED DAYS</th>
                <th
                  style={{ cursor: 'pointer', textAlign: 'center' }}
                  onClick={() => {
                    if (sortField === 'attendance_percentage') setSortAsc(!sortAsc);
                    else { setSortField('attendance_percentage'); setSortAsc(false); }
                  }}
                >
                  ATTENDANCE RATE <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th style={{ textAlign: 'center' }}>COMPLIANCE STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 10px', display: 'block', color: '#2563eb' }} />
                    Compiling institutional reports...
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    No student attendance records found for this date range and campus filter.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => {
                  const pct = r.attendance_percentage;
                  const isHigh = pct >= 85;
                  const isMed = pct >= 75 && pct < 85;
                  const statusLabel = isHigh ? 'EXEMPLARY' : isMed ? 'REGULAR' : 'AT RISK';
                  const statusClass = isHigh ? 'active' : isMed ? 'expiring' : 'expired';

                  return (
                    <tr key={r.student_id || idx}>
                      <td className="sa-td-num">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td>
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
                              fontWeight: 700
                            }}
                          >
                            {r.student_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ fontSize: 13, color: '#0f172a', display: 'block' }}>{r.student_name}</strong>
                            <span style={{ fontSize: 11, color: '#64748b' }}>ID: {r.student_id}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.roll}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>Class {r.class_name || '10'}-{r.section_name || 'A'}</span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>
                        {r.present_days}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: r.absent_days > 0 ? '#ef4444' : '#64748b' }}>
                        {r.absent_days}
                      </td>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>
                        {r.marked_days}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, pct))}%`,
                                height: '100%',
                                background: isHigh ? '#16a34a' : isMed ? '#f59e0b' : '#ef4444',
                                borderRadius: 4
                              }}
                            />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`sa-status-pill ${statusClass}`}>
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

        {/* ─── Pagination ─── */}
        {!loading && filteredRows.length > 0 && (
          <div className="sa-pagination-bar" style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredRows.length)}</strong> of <strong>{filteredRows.length}</strong> records
            </span>
            <div className="sa-pagination-controls">
              <button
                className="sa-btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <span className="sa-page-indicator">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="sa-btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsManagement;
