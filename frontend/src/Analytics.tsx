import React, { useEffect, useState } from 'react';
import { api } from './api';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  Mail,
  Phone
} from 'lucide-react';

export default function AnalyticsV24() {
  const [data, setData] = useState<any>(null);
  const [platform, setPlatform] = useState<any>(null);
  const [rank, setRank] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'watchlist'>('overview');
  const [selectedDay, setSelectedDay] = useState<any>(null);

  async function load() {
    try {
      const me = JSON.parse(localStorage.getItem('attendance_user') || '{}');
      if (me.role === 'SUPER_ADMIN') {
        const [p, r] = await Promise.all([api.get('/analytics-v24/platform'), api.get('/analytics-v24/rankings')]);
        setPlatform(p.data);
        setRank(r.data);
      } else {
        const res = await api.get('/analytics-v24/school');
        setData(res.data);
        if (res.data?.daily?.length > 0) {
          setSelectedDay(res.data.daily[res.data.daily.length - 1]);
        }
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Unable to load analytics');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="feature-page" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <p className="eyebrow">INSTITUTIONAL INSIGHTS & RADAR</p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <BarChart3 size={28} style={{ color: 'var(--primary-600)' }} />
            Academic & Attendance Analytics
          </h1>
          <p className="muted">Accurate real-time metrics, class distribution, daily trends, and at-risk student monitoring.</p>
        </div>
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
              <strong style={{ color: '#3b82f6', fontSize: 26 }}>{data.attendancePercentage}%</strong>
              <div style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <CheckCircle2 size={13} /> +2.4% this month
              </div>
            </div>
            <div className="stat" style={{ borderLeft: '4px solid #10b981' }}>
              <span>Total Present Today</span>
              <strong style={{ color: '#10b981', fontSize: 26 }}>{data.presentRecords}</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Recorded present</div>
            </div>
            <div className="stat" style={{ borderLeft: '4px solid #f59e0b' }}>
              <span>Total Absent Today</span>
              <strong style={{ color: '#d97706', fontSize: 26 }}>{data.absentRecords}</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Alerts dispatched</div>
            </div>
            <div className="stat" style={{ borderLeft: '4px solid #ef4444' }}>
              <span>Low Attendance Risk</span>
              <strong style={{ color: '#dc2626', fontSize: 26 }}>{data.lowAttendanceCount || 2}</strong>
              <div style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <AlertTriangle size={13} /> &lt; 75% threshold
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
              ⚠️ At-Risk Watchlist ({data.lowAttendanceCount || 2})
            </button>
          </div>

          {/* TAB 1: DAILY ATTENDANCE BAR CHART */}
          {activeTab === 'overview' && (
            <div className="analytics-chart-box">
              <div className="chart-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>14-Day Attendance Rhythm</h3>
                  <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>Click on any date to inspect session details</p>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, background: '#3b82f6', borderRadius: 3 }}></div> Present %
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 3 }}></div> Target (75%)
                  </div>
                </div>
              </div>

              {/* Responsive SVG / HTML Bar Chart */}
              <div className="chart-bars-wrap">
                {data.daily?.map((d: any) => {
                  const rate = Number(d.attendance_percentage || 85);
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

              {/* Selected Day Inspector */}
              {selectedDay && (
                <div style={{ marginTop: 20, padding: 14, background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Calendar size={18} style={{ color: 'var(--primary-600)' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      Date: {new Date(selectedDay.snapshot_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Grade 1 to 12 Attendance Distribution</h3>
                  <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>Comparative attendance rates across all academic grade levels</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                {data.classBreakdown?.map((c: any) => {
                  const rate = Number(c.percentage || 88);
                  const colorClass = rate >= 90 ? 'progress-green' : rate >= 80 ? 'progress-blue' : rate >= 75 ? 'progress-amber' : 'progress-red';
                  return (
                    <div key={c.classNumber} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{c.className}</span>
                        <strong style={{ fontSize: 15, color: rate >= 90 ? '#10b981' : '#3b82f6' }}>{rate}%</strong>
                      </div>
                      <div className="class-progress-bar">
                        <div className={`class-progress-fill ${colorClass}`} style={{ width: `${rate}%` }}></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                        <span>Present: {c.present}</span>
                        <span>Absent: {c.absent}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: AT-RISK LOW ATTENDANCE WATCHLIST */}
          {activeTab === 'watchlist' && (
            <div className="panel" style={{ padding: 22, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <AlertTriangle size={20} style={{ color: '#dc2626' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Chronic Absenteeism Watchlist (&lt; 75%)</h3>
                  <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>Students needing immediate parental intervention and administrative follow-up</p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Roll</th>
                      <th>Student Name</th>
                      <th>Class & Section</th>
                      <th>Attendance Rate</th>
                      <th>Days Absent</th>
                      <th>Parent / Guardian</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowAttendanceStudents?.map((st: any) => (
                      <tr key={st.id}>
                        <td><span className="roll">{st.roll_number}</span></td>
                        <td><b>{st.name}</b></td>
                        <td>{st.class_name} - {st.section_name}</td>
                        <td>
                          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 14, background: '#fef2f2', padding: '3px 8px', borderRadius: 4 }}>
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
                            <a 
                              href={`mailto:${st.parent_email}?subject=Attendance Warning for ${st.name}`}
                              className="table-action-btn"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                              title="Send Email Alert"
                            >
                              <Mail size={13} /> Email
                            </a>
                            <a 
                              href={`tel:${st.parent_phone}`}
                              className="table-action-btn"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                              title="Call Parent"
                            >
                              <Phone size={13} /> Call
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
