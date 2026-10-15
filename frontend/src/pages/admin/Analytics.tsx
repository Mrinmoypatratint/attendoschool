import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  Mail,
  Phone,
  RefreshCw,
  Filter,
  X
} from 'lucide-react';

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [platform, setPlatform] = useState<any>(null);
  const [rank, setRank] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'watchlist'>('overview');
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

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
        const params: any = {};
        if (cls) params.classId = cls;
        if (sec) params.sectionId = sec;
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
            id: cb.classNumber,
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
          setSelectedDay(res.data.daily[res.data.daily.length - 1]);
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
    const matching = sectionList.filter(s => {
      const cid = String(s.class_id || s.classId || '');
      return cid === String(filterClass) || !cid;
    });
    return matching.length > 0 ? matching : sectionList;
  }, [filterClass, sectionList]);

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

  useEffect(() => { load(); }, []);

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

  const renderClassSectionFilter = (idPrefix = 'filter') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-50)', padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
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
          borderRadius: 6,
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
          borderRadius: 6,
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
            color: '#dc2626',
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
  );

  return (
    <div className="feature-page" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="eyebrow">INSTITUTIONAL INSIGHTS & RADAR</p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <BarChart3 size={28} style={{ color: 'var(--primary-600)' }} />
            Academic & Attendance Analytics
          </h1>
          <p className="muted">Accurate real-time metrics, class distribution, daily trends, and at-risk student monitoring.</p>
        </div>
        <button
          onClick={() => load()}
          disabled={refreshing}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            padding: '8px 14px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--text)'
          }}
          title="Refresh real-time attendance data"
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Updating...' : 'Live Refresh'}
        </button>
      </div>

      {msg && <div className="error" style={{ marginBottom: 16 }}>{msg}</div>}

      {/* SUPER ADMIN VIEW */}
      {platform && (
        <>
          <div className="stats" style={{ marginBottom: 24 }}>
            <div className="stat">
              <span>Onboarded Schools</span>
              <strong>{platform.totalSchools}</strong>
              <div style={{ fontSize: 11.5, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <TrendingUp size={13} /> Active network
              </div>
            </div>
            <div className="stat">
              <span>Platform Students</span>
              <strong>{platform.totalStudents}</strong>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Across all schools</div>
            </div>
            <div className="stat">
              <span>Active Subscriptions</span>
              <strong>{platform.activeSubscriptions}</strong>
              <div style={{ fontSize: 11.5, color: '#10b981', marginTop: 4 }}>Paid & Verified</div>
            </div>
            <div className="stat">
              <span>SaaS Total Revenue</span>
              <strong style={{ color: '#10b981' }}>₹{platform.totalRevenue?.toLocaleString('en-IN')}</strong>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>GST Invoiced</div>
            </div>
          </div>

          <div className="panel" style={{ padding: 22, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>🏆 School Attendance League Table</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>School Institution</th>
                    <th>Code</th>
                    <th>Students</th>
                    <th>Faculty</th>
                    <th>30-Day Attendance</th>
                    <th>Performance Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {rank.map((x, idx) => {
                    const rate = Number(x.attendance_percentage || 85);
                    const isHigh = rate >= 90;
                    return (
                      <tr key={x.id}>
                        <td>
                          <b>{idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : ''}{x.name}</b>
                        </td>
                        <td><code>{x.code}</code></td>
                        <td>{x.students}</td>
                        <td>{x.teachers}</td>
                        <td>
                          <b style={{ color: isHigh ? '#10b981' : '#3b82f6', fontSize: 14 }}>{rate}%</b>
                        </td>
                        <td>
                          <span className={`badge ${isHigh ? 'active' : 'processing'}`}>
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
          <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <div className="stat" style={{ borderLeft: '4px solid #3b82f6' }}>
              <span>Average Attendance</span>
              <strong style={{ color: '#3b82f6', fontSize: 26 }}>{data.attendancePercentage ?? 0}%</strong>
              <div style={{ fontSize: 12, color: (data.attendancePercentage ?? 0) >= 75 ? '#10b981' : '#dc2626', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                {(data.attendancePercentage ?? 0) >= 75 ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {data.attendanceSessions > 0 ? `${data.attendanceSessions} sessions recorded` : 'No sessions recorded'}
              </div>
            </div>
            <div className="stat" style={{ borderLeft: '4px solid #10b981' }}>
              <span>Total Present Today</span>
              <strong style={{ color: '#10b981', fontSize: 26 }}>{data.todayPresent ?? 0}</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {(data.todayPresent ?? 0) + (data.todayAbsent ?? 0) > 0 ? 'Recorded present today' : 'No attendance marked today'}
              </div>
            </div>
            <div className="stat" style={{ borderLeft: '4px solid #f59e0b' }}>
              <span>Total Absent Today</span>
              <strong style={{ color: '#d97706', fontSize: 26 }}>{data.todayAbsent ?? 0}</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {(data.todayPresent ?? 0) + (data.todayAbsent ?? 0) > 0 ? 'Marked absent today' : 'No attendance marked today'}
              </div>
            </div>
            <div className="stat" style={{ borderLeft: '4px solid #ef4444' }}>
              <span>Low Attendance Risk</span>
              <strong style={{ color: '#dc2626', fontSize: 26 }}>{data.lowAttendanceCount ?? 0}</strong>
              <div style={{ fontSize: 12, color: (data.lowAttendanceCount ?? 0) > 0 ? '#dc2626' : '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                {(data.lowAttendanceCount ?? 0) > 0 ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                {(data.lowAttendanceCount ?? 0) > 0 ? '< 75% threshold' : 'All students ≥ 75%'}
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="tabs" style={{ marginBottom: 20 }}>
            <button className={activeTab === 'overview' ? 'tab-active' : ''} onClick={() => setActiveTab('overview')}>
              📊 Daily Attendance Trend
            </button>
            <button className={activeTab === 'classes' ? 'tab-active' : ''} onClick={() => setActiveTab('classes')}>
              🏫 Class-Wise Performance
            </button>
            <button className={activeTab === 'watchlist' ? 'tab-active' : ''} onClick={() => setActiveTab('watchlist')}>
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
                      <div style={{ width: 10, height: 10, background: '#3b82f6', borderRadius: 2 }}></div> Present %
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }}></div> Target (75%)
                    </div>
                  </div>
                </div>
              </div>

              {/* Responsive SVG / HTML Bar Chart */}
              {(!data.daily || data.daily.length === 0) ? (
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
                    const dateLabel = new Date(d.snapshot_date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                    return (
                      <div 
                        key={d.snapshot_date} 
                        className="chart-column" 
                        onClick={() => setSelectedDay(d)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="bar-track" style={{ border: isSelected ? '2px solid var(--primary-600)' : 'none' }}>
                          <div 
                            className="bar-fill" 
                            style={{ 
                              height: `${rate}%`,
                              background: rate >= 90 
                                ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)' 
                                : rate >= 80 
                                  ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)'
                                  : 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'
                            }}
                          >
                            <div className="bar-value-tooltip">{rate}%</div>
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
                      Date: {new Date(selectedDay.snapshot_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
                  <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                    <div>Present: <strong style={{ color: '#10b981' }}>{selectedDay.present_records}</strong></div>
                    <div>Absent: <strong style={{ color: '#ef4444' }}>{selectedDay.absent_records}</strong></div>
                    <div>Attendance Rate: <strong>{selectedDay.attendance_percentage}%</strong></div>
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

              {(!data.classBreakdown || data.classBreakdown.length === 0) ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--text)' }}>No Class Breakdown Available Yet</h4>
                  <p style={{ margin: 0, fontSize: 13 }}>Class-wise distribution will automatically appear once teachers take attendance for their classes.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                  {data.classBreakdown.map((c: any) => {
                    const rate = Number(c.percentage || 0);
                    const colorClass = rate >= 90 ? 'progress-green' : rate >= 80 ? 'progress-blue' : rate >= 75 ? 'progress-amber' : 'progress-red';
                    return (
                      <div key={c.classNumber} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{c.className}</span>
                          <strong style={{ fontSize: 15, color: rate >= 90 ? '#10b981' : rate >= 75 ? '#3b82f6' : '#dc2626' }}>{rate}%</strong>
                        </div>
                        <div className="class-progress-bar">
                          <div className={`class-progress-fill ${colorClass}`} style={{ width: `${Math.min(100, rate)}%` }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                          <span>Present: {c.present}</span>
                          <span>Absent: {c.absent}</span>
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
                  <AlertTriangle size={20} style={{ color: '#dc2626' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Chronic Absenteeism Watchlist (&lt; 75%)</h3>
                    <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>
                      Students needing immediate parental intervention and administrative follow-up (14-Day Rhythm)
                    </p>
                  </div>
                </div>

                {renderClassSectionFilter('watchlist')}
              </div>

              {(!data.lowAttendanceStudents || data.lowAttendanceStudents.length === 0) ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={36} style={{ color: '#10b981', margin: '0 auto 10px', display: 'block' }} />
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
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lowAttendanceStudents.map((st: any) => (
                        <tr key={st.id}>
                          <td><span className="roll">{st.roll_number}</span></td>
                          <td><b>{st.name}</b></td>
                          <td>{st.class_name} - {st.section_name}</td>
                          <td>
                            <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 14, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '3px 8px', borderRadius: 4 }}>
                              {st.attendance_rate}%
                            </span>
                          </td>
                          <td><b style={{ color: '#d97706' }}>{st.absent_days} sessions</b></td>
                          <td>
                            <div>{st.parent_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{st.parent_phone}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {st.parent_email && (
                                <a 
                                  href={`mailto:${st.parent_email}?subject=Attendance Warning for ${st.name}`}
                                  className="table-action-btn"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                  title="Send Email Alert"
                                >
                                  <Mail size={13} /> Email
                                </a>
                              )}
                              {st.parent_phone && st.parent_phone !== '—' && (
                                <a 
                                  href={`tel:${st.parent_phone}`}
                                  className="table-action-btn"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                  title="Call Parent"
                                >
                                  <Phone size={13} /> Call
                                </a>
                              )}
                            </div>
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
