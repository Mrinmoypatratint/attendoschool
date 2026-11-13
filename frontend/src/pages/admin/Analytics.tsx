import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../../api';
import { PersonProfileLink } from '../../components/PersonProfileLink';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  RefreshCw,
  Filter,
  X,
  FileSpreadsheet,
  ArrowLeft
} from 'lucide-react';

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(dateStr);
}

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [platform, setPlatform] = useState<any>(null);
  const [rank, setRank] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'watchlist'>('overview');
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Graph area Class & Section Filters
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterSection, setFilterSection] = useState<string>('');
  const [classList, setClassList] = useState<any[]>([]);
  const [sectionList, setSectionList] = useState<any[]>([]);

  async function load(cls = filterClass, sec = filterSection) {
    setRefreshing(true);
    try {
      const me = JSON.parse(localStorage.getItem('attendance_user') || '{}');
      if (me.role === 'SUPER_ADMIN') {
        const [p, r] = await Promise.all([api.get('/analytics/platform'), api.get('/analytics/rankings')]);
        setPlatform(p.data);
        setRank(r.data);
      } else {
        const activeSession = localStorage.getItem('attendo_academic_session') || localStorage.getItem('attendo_active_academic_year') || '';
        const params: any = {};
        if (cls) params.classId = cls;
        if (sec) params.sectionId = sec;
        if (activeSession) params.session = activeSession;

        const [res, classesRes, sectionsRes] = await Promise.all([
          api.get('/analytics/school', { params }),
          api.get('/classes').catch(() => ({ data: [] })),
          api.get('/sections').catch(() => ({ data: [] }))
        ]);
        setData(res.data);

        // Populate available classes
        const combinedClasses = (res.data?.classes?.length ? res.data.classes : classesRes.data) || [];
        if (combinedClasses.length > 0) {
          setClassList(combinedClasses);
        } else if (res.data?.classBreakdown?.length > 0) {
          setClassList(res.data.classBreakdown.map((cb: any) => ({
            id: cb.classId || cb.classNumber,
            class_number: cb.classNumber,
            name: `Class ${cb.classNumber}`
          })));
        }

        // Populate available sections
        const combinedSections = (res.data?.sections?.length ? res.data.sections : sectionsRes.data) || [];
        if (combinedSections.length > 0) {
          setSectionList(combinedSections);
        }

        if (res.data?.daily?.length > 0) {
          setSelectedDay((prev: any) => {
            if (prev) {
              const match = res.data.daily.find((d: any) => d.snapshot_date === prev.snapshot_date);
              if (match) return match;
            }
            // Prefer the latest day with attendance taken, or default to the last day (today)
            const latestWithData = [...res.data.daily].reverse().find((d: any) => d.has_attendance);
            return latestWithData || res.data.daily[res.data.daily.length - 1];
          });
        } else {
          setSelectedDay(null);
        }
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Unable to load analytics');
    } finally {
      setRefreshing(false);
    }
  }

  // Filter sections by selected class when a specific class is selected
  const availableSections = React.useMemo(() => {
    if (!filterClass) return sectionList;
    const targetCls = classList.find(c => String(c.id) === String(filterClass) || String(c.class_number) === String(filterClass));
    const targetNum = targetCls && targetCls.class_number !== undefined ? Number(targetCls.class_number) : null;
    const matching = sectionList.filter(s => {
      const cid = String(s.class_id || s.classId || '');
      const cNum = s.class_number !== undefined ? Number(s.class_number) : (s.classNumber !== undefined ? Number(s.classNumber) : null);
      if (cid === String(filterClass)) return true;
      if (targetCls && cid === String(targetCls.id)) return true;
      if (targetNum !== null && cNum !== null && targetNum === cNum) return true;
      return !cid;
    });
    return matching.length > 0 ? matching : sectionList;
  }, [filterClass, sectionList, classList]);

  // Unique sections list for dropdown
  const uniqueSections = React.useMemo(() => {
    const seen = new Set<string>();
    const res: any[] = [];
    for (const s of availableSections) {
      const name = String(s.name || s.section_name || s.sectionName || '').trim();
      if (name && !seen.has(name.toUpperCase())) {
        seen.add(name.toUpperCase());
        res.push(s);
      }
    }
    return res;
  }, [availableSections]);

  useEffect(() => {
    load();
    const handleSessionChange = () => {
      load();
    };
    window.addEventListener('sessionChanged', handleSessionChange);
    window.addEventListener('storage', handleSessionChange);
    return () => {
      window.removeEventListener('sessionChanged', handleSessionChange);
      window.removeEventListener('storage', handleSessionChange);
    };
  }, []);

  const formatClassOptionLabel = (c: any): string => {
    const num = c.class_number !== undefined ? Number(c.class_number) : (c.classNumber !== undefined ? Number(c.classNumber) : Number(c.id));
    if (num === -1) return 'Class L KG';
    if (num === 0) return 'Class U KG';
    if (!isNaN(num)) return `Class ${num}`;
    const s = String(c.label || c.name || c.id || '');
    if (/^class\s*-1$/i.test(s) || /l.?kg/i.test(s)) return 'Class L KG';
    if (/^class\s*0$/i.test(s) || /u.?kg/i.test(s)) return 'Class U KG';
    return s.startsWith('Class') ? s : `Class ${s}`;
  };

  const sortedClassList = React.useMemo(() => {
    return [...classList].sort((a: any, b: any) => {
      const aNum = a.class_number !== undefined ? Number(a.class_number) : Number(a.id);
      const bNum = b.class_number !== undefined ? Number(b.class_number) : Number(b.id);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return 0;
    });
  }, [classList]);

  const displayedBreakdown = React.useMemo(() => {
    if (!data?.classBreakdown) return [];
    if (!filterClass) return data.classBreakdown;
    const targetCls = classList.find(c => String(c.id) === String(filterClass) || String(c.class_number) === String(filterClass));
    const targetNum = targetCls && targetCls.class_number !== undefined ? Number(targetCls.class_number) : Number(filterClass);
    return data.classBreakdown.filter((cb: any) => {
      if (!isNaN(targetNum) && Number(cb.classNumber) === targetNum) return true;
      if (String(cb.classNumber) === String(filterClass)) return true;
      if (String(cb.classId) === String(filterClass)) return true;
      return false;
    });
  }, [data?.classBreakdown, filterClass, classList]);

  const hasAnyDailyAttendance = Boolean(data?.daily && data.daily.some((d: any) => d.has_attendance));

  async function handleExportExcel() {
    setExporting(true);
    try {
      const selectedClsObj = classList.find((c: any) => String(c.id || c.class_number) === String(filterClass));
      const classLabel = selectedClsObj 
        ? formatClassOptionLabel(selectedClsObj).replace(/\s+/g, '_')
        : (filterClass ? `Class_${filterClass}` : 'All_Classes');
      const secLabel = filterSection ? `_Sec_${filterSection}` : '';
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `At_Risk_Watchlist_${classLabel}${secLabel}_${dateStr}.xlsx`;

      // Export ONLY the students who are in the At-Risk Watchlist table (< 75% attendance)
      // This strictly matches the current table view and selected class/section filter with no extra students.
      const atRiskList: any[] = data?.lowAttendanceStudents || [];

      const rows = atRiskList.map((s: any, idx: number) => ({
        'Sl. No.': idx + 1,
        'Roll No.': s.roll_number || '—',
        'Student Name': s.name,
        'Class': s.class_name,
        'Section': s.section_name,
        'Attendance Rate (%)': `${s.attendance_rate}%`,
        'Days Absent': `${s.absent_days ?? s.absent_count ?? 0} sessions`,
        'Total Sessions': s.total_sessions || 0,
        'Status': 'At-Risk (< 75%)',
        'Parent / Guardian Name': s.parent_name || 'Parent/Guardian',
        'Parent Phone': s.parent_phone || '—',
        'Parent Email': s.parent_email || '—'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(
        rows.length > 0
          ? rows
          : [{ Note: `No students found on At-Risk Watchlist for ${classLabel.replace(/_/g, ' ')}${secLabel ? ` Section ${filterSection}` : ''}` }]
      );
      ws['!cols'] = [
        { wch: 8 },  // Sl. No
        { wch: 12 }, // Roll No
        { wch: 24 }, // Student Name
        { wch: 14 }, // Class
        { wch: 10 }, // Section
        { wch: 18 }, // Attendance Rate
        { wch: 16 }, // Days Absent
        { wch: 15 }, // Total Sessions
        { wch: 18 }, // Status
        { wch: 24 }, // Parent Name
        { wch: 16 }, // Parent Phone
        { wch: 26 }  // Parent Email
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'At-Risk Watchlist');
      XLSX.writeFile(wb, filename);
    } catch (e: any) {
      console.error('Export error:', e);
      setMsg('Failed to export At-Risk Watchlist to Excel');
    } finally {
      setExporting(false);
    }
  }

  const renderClassSectionFilter = (idPrefix = 'filter', showExport = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-50)', padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary-600)', fontSize: 12.5, fontWeight: 600 }}>
          <Filter size={14} />
          <span>Class & Section:</span>
        </div>

        {/* Class Selector */}
        <select
          id={`${idPrefix}-class`}
          value={filterClass}
          onChange={(e) => {
            const val = e.target.value;
            setFilterClass(val);
            setFilterSection('');
            load(val, '');
          }}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--text)',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="">All Classes</option>
          {sortedClassList.map((c: any) => {
            const cVal = String(c.id || c.class_number);
            const label = formatClassOptionLabel(c);
            return (
              <option key={cVal} value={cVal}>
                {label}
              </option>
            );
          })}
        </select>

        {/* Section Selector */}
        <select
          id={`${idPrefix}-section`}
          value={filterSection}
          onChange={(e) => {
            const val = e.target.value;
            setFilterSection(val);
            load(filterClass, val);
          }}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--text)',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="">All Sections</option>
          {uniqueSections.map((s: any) => {
            const sVal = String(s.name || s.section_name || s.id);
            return (
              <option key={sVal} value={sVal}>
                Section {sVal}
              </option>
            );
          })}
        </select>

        {/* Reset Button */}
        {(filterClass || filterSection) && (
          <button
            onClick={() => {
              setFilterClass('');
              setFilterSection('');
              load('', '');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: "var(--destructive)",
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 4px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600
            }}
            title="Reset filter"
          >
            <X size={13} style={{ marginRight: 2 }} /> Reset
          </button>
        )}
      </div>

      {/* Export Excel Button beside all class & section filter (only on Watchlist) */}
      {showExport && (
        <button
          type="button"
          id={`${idPrefix}-export-excel`}
          onClick={handleExportExcel}
          disabled={exporting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 13px',
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--secondary)",
            color: "var(--success)",
            fontWeight: 600,
            fontSize: 12.5,
            cursor: exporting ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'none'
          }}
          title={`Export ${filterClass ? (filterSection ? `Class ${filterClass} - Section ${filterSection}` : `Class ${filterClass}`) : 'All Classes'} At-Risk Watchlist to Excel (.xlsx)`}
        >
          <FileSpreadsheet size={15} style={{ color: "var(--success)" }} />
          <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="feature-page w-full max-w-none m-0 pb-10" style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '24px 24px 40px', boxSizing: 'border-box' }}>
      <Link
        to="/dashboard"
        style={{ background: 'transparent', border: 'none', padding: 0, color: '#e11d48', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}
      >
        <ArrowLeft size={16} /> <span>Dashboard</span>
      </Link>
      <div className="page-head flex justify-between items-center mb-5 flex-wrap gap-4">
        <div>
          <p className="eyebrow text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">INSTITUTIONAL INSIGHTS & RADAR</p>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 dark:text-white m-0">
            <BarChart3 size={28} className="text-blue-600 dark:text-blue-400" />
            Academic & Attendance Analytics
          </h1>
          <p className="muted text-xs text-slate-500 dark:text-slate-400 mt-1">Accurate real-time metrics, class distribution, daily trends, and at-risk student monitoring.</p>
        </div>
        <button
          onClick={() => load()}
          disabled={refreshing}
          className="btn-secondary inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-xs"
          title="Refresh real-time attendance data"
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Updating...' : 'Live Refresh'}
        </button>
      </div>

      {msg && <div className="error mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">{msg}</div>}

      {/* SUPER ADMIN VIEW */}
      {platform && (
        <>
          <div className="stats grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
            <div className="stat bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Onboarded Schools</span>
              <strong className="text-2xl font-extrabold text-slate-900 dark:text-white block mt-1">{platform.totalSchools}</strong>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                <TrendingUp size={13} /> Active network
              </div>
            </div>
            <div className="stat bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Platform Students</span>
              <strong className="text-2xl font-extrabold text-slate-900 dark:text-white block mt-1">{platform.totalStudents}</strong>
              <div className="text-[11px] text-slate-400 mt-1">Across all schools</div>
            </div>
            <div className="stat bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Subscriptions</span>
              <strong className="text-2xl font-extrabold text-slate-900 dark:text-white block mt-1">{platform.activeSubscriptions}</strong>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Paid & Verified</div>
            </div>
            <div className="stat bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SaaS Total Revenue</span>
              <strong className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">₹{platform.totalRevenue?.toLocaleString('en-IN')}</strong>
              <div className="text-[11px] text-slate-400 mt-1">GST Invoiced</div>
            </div>
          </div>

          <div className="panel p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs">
            <h3 className="m-0 mb-4 text-base font-bold text-slate-900 dark:text-white">🏆 School Attendance League Table</h3>
            <div className="table-wrap overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                    <th className="py-2.5 px-3">School Institution</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Students</th>
                    <th className="py-2.5 px-3">Faculty</th>
                    <th className="py-2.5 px-3">30-Day Attendance</th>
                    <th className="py-2.5 px-3">Performance Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {rank.map((x, idx) => {
                    const rate = Number(x.attendance_percentage || 85);
                    const isHigh = rate >= 90;
                    return (
                      <tr key={x.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-750/50 transition-colors">
                        <td className="py-3 px-3">
                          <PersonProfileLink kind="student" id={x.id || x.student_id} name={x.name} person={x as any}><b>{idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : ''}{x.name}</b></PersonProfileLink>
                        </td>
                        <td className="py-3 px-3"><code className="text-xs bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400">{x.code}</code></td>
                        <td className="py-3 px-3 text-sm">{x.students}</td>
                        <td className="py-3 px-3 text-sm">{x.teachers}</td>
                        <td className="py-3 px-3">
                          <b className={`text-sm ${isHigh ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>{rate}%</b>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isHigh ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                          }`}>
                            {isHigh ? 'EXEMPLARY' : 'GOOD STANDING'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SCHOOL ADMIN VIEW */}
      {data && (
        <>
          {/* Key KPI Metric Cards */}
          <div className="stats grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
            <div className="stat bg-white dark:bg-slate-800 border-l-4 border-l-blue-600 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Average Attendance</span>
              <strong className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 block mt-1">{data.attendancePercentage ?? 0}%</strong>
              <div className={`text-xs flex items-center gap-1 mt-1 font-medium ${
                (data.attendancePercentage ?? 0) >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {(data.attendancePercentage ?? 0) >= 75 ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {data.attendanceSessions > 0 ? `${data.attendanceSessions} sessions recorded` : 'No sessions recorded'}
              </div>
            </div>
            <div className="stat bg-white dark:bg-slate-800 border-l-4 border-l-emerald-600 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Present Today</span>
              <strong className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">{data.todayPresent ?? 0}</strong>
              <div className="text-xs text-slate-400 mt-1">
                {(data.todayPresent ?? 0) + (data.todayAbsent ?? 0) + (data.todayLeftEarly ?? 0) > 0 ? 'Recorded present today' : 'No attendance marked today'}
              </div>
            </div>
            <div className="stat bg-white dark:bg-slate-800 border-l-4 border-l-rose-600 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Absent Today</span>
              <strong className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 block mt-1">{data.todayAbsent ?? 0}</strong>
              <div className="text-xs text-slate-400 mt-1">
                {(data.todayPresent ?? 0) + (data.todayAbsent ?? 0) + (data.todayLeftEarly ?? 0) > 0 ? 'Marked absent today' : 'No attendance marked today'}
              </div>
            </div>
            <div className="stat bg-white dark:bg-slate-800 border-l-4 border-l-amber-500 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Left Early Today</span>
              <strong className="text-2xl font-extrabold text-amber-500 dark:text-amber-400 block mt-1">{data.todayLeftEarly ?? 0}</strong>
              <div className="text-xs text-slate-400 mt-1">
                {(data.todayLeftEarly ?? 0) > 0 ? 'Departed campus early today' : 'No early departures today'}
              </div>
            </div>
            <div className="stat bg-white dark:bg-slate-800 border-l-4 border-l-purple-600 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Low Attendance Risk</span>
              <strong className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 block mt-1">{data.lowAttendanceCount ?? 0}</strong>
              <div className={`text-xs flex items-center gap-1 mt-1 font-medium ${
                (data.lowAttendanceCount ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {(data.lowAttendanceCount ?? 0) > 0 ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                {(data.lowAttendanceCount ?? 0) > 0 ? '< 75% threshold' : 'All students ≥ 75%'}
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="tabs flex gap-2 border-b border-slate-200 dark:border-slate-700 mb-5 overflow-x-auto pb-1">
            <button
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-xs tab-active'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              onClick={() => setActiveTab('overview')}
            >
              📊 Daily Attendance Trend
            </button>
            <button
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'classes'
                  ? 'bg-blue-600 text-white shadow-xs tab-active'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              onClick={() => setActiveTab('classes')}
            >
              🏫 Class-Wise Performance
            </button>
            <button
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'watchlist'
                  ? 'bg-blue-600 text-white shadow-xs tab-active'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              onClick={() => setActiveTab('watchlist')}
            >
              ⚠️ At-Risk Watchlist ({data.lowAttendanceCount ?? 0})
            </button>
          </div>

          {/* TAB 1: DAILY ATTENDANCE BAR CHART */}
          {activeTab === 'overview' && (
            <div className="analytics-chart-box">
              <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>14-Day Attendance Rhythm</h3>
                  <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>Click on any date to inspect session details</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  {renderClassSectionFilter('rhythm')}

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 10, height: 10, background: "var(--primary)", borderRadius: 2 }}></div> Present %
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 10, height: 10, background: "var(--destructive)", borderRadius: 2 }}></div> Target (75%)
                    </div>
                  </div>
                </div>
              </div>

              {/* Responsive SVG / HTML Bar Chart */}
              {!hasAnyDailyAttendance ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Calendar size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 10px', display: 'block' }} />
                  <h4 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--text)' }}>
                    {filterClass || filterSection ? 'No Records for Selected Filter' : 'No Daily Attendance Records Yet'}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    {filterClass || filterSection
                      ? 'No attendance sessions were found for this class/section in the last 14 days.'
                      : 'Daily trends will display here in real time once faculty take attendance across classes.'}
                  </p>
                  {(filterClass || filterSection) && (
                    <button
                      onClick={() => {
                        setFilterClass('');
                        setFilterSection('');
                        load('', '');
                      }}
                      className="btn-secondary"
                      style={{ marginTop: 12, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Reset to All Classes
                    </button>
                  )}
                </div>
              ) : (
                <div className="chart-bars-wrap">
                  {data.daily.map((d: any) => {
                    const rate = Number(d.attendance_percentage || 0);
                    const isSelected = selectedDay?.snapshot_date === d.snapshot_date;
                    const dateObj = parseLocalDate(d.snapshot_date);
                    const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                    const tooltipText = `${dateLabel} (${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}): ${
                      d.has_attendance ? `${rate}% (${d.present_records} Present, ${d.absent_records} Absent)` : 'No attendance recorded (0%)'
                    }`;

                    return (
                      <div 
                        key={d.snapshot_date} 
                        className="chart-column" 
                        onClick={() => setSelectedDay(d)}
                        title={tooltipText}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="bar-track" style={{ border: isSelected ? '2px solid var(--primary-600)' : 'none', position: 'relative' }}>
                          <div 
                            className="bar-fill" 
                            style={{ 
                              height: `${rate}%`,
                              background: rate >= 90 
                                ? "var(--success)" 
                                : rate >= 80 
                                  ? "var(--primary)"
                                  : "var(--warning)"
                            }}
                          >
                            {rate > 0 && <div className="bar-value-tooltip">{rate}%</div>}
                          </div>
                        </div>
                        <div className="bar-label" style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--primary-600)' : 'var(--text-muted)' }}>
                          {dateLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected Day Inspector */}
              {selectedDay && (
                <div style={{ marginTop: 20, padding: 14, background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Calendar size={18} style={{ color: 'var(--primary-600)' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      Date: {parseLocalDate(selectedDay.snapshot_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    {(filterClass || filterSection) && (
                      <span style={{ fontSize: 12, background: 'var(--primary-50)', color: 'var(--primary-700)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                        {filterClass ? (() => {
                          const clsObj = classList.find((c: any) => String(c.id || c.class_number) === String(filterClass));
                          return formatClassOptionLabel(clsObj || { id: filterClass });
                        })() : ''}
                        {filterClass && filterSection ? ' - ' : ''}
                        {filterSection ? `Section ${filterSection}` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 20, fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>Present: <strong style={{ color: selectedDay.present_records > 0 ? "var(--success)" : 'var(--text-muted)' }}>{selectedDay.present_records}</strong></div>
                    <div>Absent: <strong style={{ color: selectedDay.absent_records > 0 ? "var(--destructive)" : 'var(--text-muted)' }}>{selectedDay.absent_records}</strong></div>
                    <div>Left Early: <strong style={{ color: (selectedDay.left_early_records || 0) > 0 ? "var(--warning)" : 'var(--text-muted)' }}>{selectedDay.left_early_records || 0}</strong></div>
                    <div>Attendance Rate: <strong style={{ color: selectedDay.has_attendance ? 'var(--text)' : 'var(--text-muted)' }}>{selectedDay.attendance_percentage}%</strong></div>
                    {!selectedDay.has_attendance && (
                      <span style={{ fontSize: 11.5, background: 'var(--gray-200)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                        No attendance recorded
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLASS-WISE BREAKDOWN */}
          {activeTab === 'classes' && (
            <div className="panel" style={{ padding: 22, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Class Attendance Distribution</h3>
                  <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>Comparative attendance rates across academic grade levels based on real sessions</p>
                </div>
                {renderClassSectionFilter('classes')}
              </div>

              {displayedBreakdown.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--text)' }}>
                    {filterClass || filterSection ? 'No Breakdown for Selected Filter' : 'No Class Breakdown Available Yet'}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    {filterClass || filterSection
                      ? 'No attendance records were found for this class/section in the selected session.'
                      : 'Class-wise distribution will automatically appear once teachers take attendance for their classes.'}
                  </p>
                  {(filterClass || filterSection) && (
                    <button
                      onClick={() => {
                        setFilterClass('');
                        setFilterSection('');
                        load('', '');
                      }}
                      className="btn-secondary"
                      style={{ marginTop: 12, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Reset to All Classes
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                  {displayedBreakdown.map((c: any) => {
                    const rate = Number(c.percentage || 0);
                    const colorClass = rate >= 90 ? 'progress-green' : rate >= 80 ? 'progress-blue' : rate >= 75 ? 'progress-amber' : 'progress-red';
                    return (
                      <div key={c.classNumber} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{c.className}</span>
                          <strong style={{ fontSize: 15, color: rate >= 90 ? "var(--success)" : rate >= 75 ? "var(--primary)" : "var(--destructive)" }}>{rate}%</strong>
                        </div>
                        <div className="class-progress-bar">
                          <div className={`class-progress-fill ${colorClass}`} style={{ width: `${Math.min(100, rate)}%` }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                          <span>Present: {c.present}</span>
                          <span>Absent: {c.absent}</span>
                          <span style={{ color: (c.leftEarly || c.left_early || 0) > 0 ? "var(--warning)" : undefined, fontWeight: (c.leftEarly || c.left_early || 0) > 0 ? 600 : undefined }}>
                            Left Early: {c.leftEarly ?? c.left_early ?? 0}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AT-RISK LOW ATTENDANCE WATCHLIST */}
          {activeTab === 'watchlist' && (
            <div className="panel" style={{ padding: 22, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertTriangle size={20} style={{ color: "var(--destructive)" }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Chronic Absenteeism Watchlist (&lt; 75%)</h3>
                    <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>
                      Students needing immediate parental intervention and administrative follow-up (14-Day Rhythm)
                    </p>
                  </div>
                </div>

                {renderClassSectionFilter('watchlist', true)}
              </div>

              {(!data.lowAttendanceStudents || data.lowAttendanceStudents.length === 0) ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={36} style={{ color: "var(--success)", margin: '0 auto 10px', display: 'block' }} />
                  <h4 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--text)' }}>
                    {filterClass || filterSection ? 'No At-Risk Students for Selected Filter' : 'No At-Risk Students'}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    {filterClass || filterSection
                      ? 'All students in this class/section currently maintain an attendance rate of 75% or higher in the 14-day window.'
                      : 'All students with recorded attendance currently maintain an attendance rate of 75% or higher.'}
                  </p>
                  {(filterClass || filterSection) && (
                    <button
                      onClick={() => {
                        setFilterClass('');
                        setFilterSection('');
                        load('', '');
                      }}
                      className="btn-secondary"
                      style={{ marginTop: 12, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Reset to All Classes
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Roll</th>
                        <th>Student Name</th>
                        <th>Class & Section</th>
                        <th>Attendance Rate</th>
                        <th>Days Absent</th>
                        <th>Parent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lowAttendanceStudents.map((st: any) => (
                        <tr key={st.id}>
                          <td><span className="roll">{st.roll_number}</span></td>
                          <td><PersonProfileLink kind="student" id={st.id || st.student_id} name={st.name} person={st as any}><b>{st.name}</b></PersonProfileLink></td>
                          <td>{st.class_name} - {st.section_name}</td>
                          <td>
                            <span style={{ color: "var(--destructive)", fontWeight: 700, fontSize: 14, background: "var(--secondary)", border: "1px solid var(--border)", padding: '3px 8px', borderRadius: 4 }}>
                              {st.attendance_rate}%
                            </span>
                          </td>
                          <td><b style={{ color: "var(--warning)" }}>{st.absent_days} sessions</b></td>
                          <td>
                            <div>{st.parent_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{st.parent_phone}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
