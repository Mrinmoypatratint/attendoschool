import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  School, Users, Clock, BarChart3, FileText,
  TrendingUp, TrendingDown, Layers, ChevronRight, MoreHorizontal,
  Plus, CreditCard, AlertTriangle, UserCheck, Server, Database,
  RefreshCw, ShieldAlert, GraduationCap, CheckCircle2, XCircle, Search
} from 'lucide-react';
import { OverviewMetrics, SchoolRecord, SubscriptionPlan, AuditLogRecord } from './types';

interface SuperAdminOverviewProps {
  onOpenCreateSchool?: () => void;
  onNavigate?: (path: string) => void;
}

export function SuperAdminOverview({ onOpenCreateSchool, onNavigate }: SuperAdminOverviewProps) {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [recentAudits, setRecentAudits] = useState<AuditLogRecord[]>([]);
  const [systemHealth, setSystemHealth] = useState<{ status: string; db: string; firestore: string }>({
    status: 'checking',
    db: 'unknown',
    firestore: 'unknown'
  });

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<SchoolRecord | null>(null);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewDays, setRenewDays] = useState(30);
  const [renewAmount, setRenewAmount] = useState(999);
  const [renewBusy, setRenewBusy] = useState(false);

  const [tableSearch, setTableSearch] = useState('');
  const [tableStatus, setTableStatus] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'SUSPENDED'>('ALL');

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.hash = path;
      try { nav(path); } catch (e) {}
    }
  };

  async function loadData() {
    setLoading(true);
    try {
      const [overviewRes, schoolsRes, plansRes, auditsRes, healthRes] = await Promise.allSettled([
        api.get('/super-admin/overview'),
        api.get('/super-admin/schools'),
        api.get('/super-admin/plans'),
        api.get('/super-admin/audit-logs?limit=5'),
        api.get('/api/health')
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.data) {
        setMetrics(overviewRes.value.data);
      }
      if (schoolsRes.status === 'fulfilled' && Array.isArray(schoolsRes.value.data)) {
        setSchools(schoolsRes.value.data);
      }
      if (plansRes.status === 'fulfilled' && Array.isArray(plansRes.value.data)) {
        setPlans(plansRes.value.data);
      }
      if (auditsRes.status === 'fulfilled' && auditsRes.value.data?.logs) {
        setRecentAudits(auditsRes.value.data.logs);
      }
      if (healthRes.status === 'fulfilled') {
        const d = healthRes.value.data;
        setSystemHealth({
          status: d.status === 'ok' ? 'Operational' : 'Degraded',
          db: d.database?.postgres || 'unknown',
          firestore: d.database?.firestore || 'connected'
        });
      }
    } catch (e) {
      console.error('SuperAdminOverview loadData failed:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.closest('.sa-action-dropdown') || target.closest('.sa-more-btn'))) {
        return;
      }
      setActiveMenuId(null);
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  async function handleToggleStatus(schoolId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'ACTIVE' || currentStatus === 'Active' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/super-admin/schools/${schoolId}/status`, { status: nextStatus });
      setActiveMenuId(null);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Status update failed');
    }
  }

  async function handleRenewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSchool) return;
    setRenewBusy(true);
    try {
      await api.post(`/super-admin/schools/${selectedSchool.id}/renew`, {
        days: renewDays,
        amount: renewAmount
      });
      setRenewModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Subscription renewal failed');
    } finally {
      setRenewBusy(false);
    }
  }

  const activeRatio = metrics?.totalSchools
    ? Math.round(((metrics.activeSchools || 0) / metrics.totalSchools) * 100)
    : 0;
  const expiredRatio = metrics?.totalSchools
    ? Math.round(((metrics.expiredSchools || 0) / metrics.totalSchools) * 100)
    : 0;

  const filteredSchools = schools.filter(s => {
    const matchesSearch = !tableSearch || 
      s.name.toLowerCase().includes(tableSearch.toLowerCase()) || 
      (s.code && s.code.toLowerCase().includes(tableSearch.toLowerCase())) ||
      (s.admin_email && s.admin_email.toLowerCase().includes(tableSearch.toLowerCase()));
    const rawStatus = (s.status || '').toUpperCase();
    const matchesStatus = 
      tableStatus === 'ALL' ||
      (tableStatus === 'ACTIVE' && rawStatus === 'ACTIVE') ||
      (tableStatus === 'SUSPENDED' && rawStatus === 'SUSPENDED') ||
      (tableStatus === 'EXPIRING' && (rawStatus.includes('EXPIR') || rawStatus === 'EXPIRING'));
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="sa-overview-view">
      {/* ─── Hero Welcome Row ─── */}
      <div className="sa-hero-card">
        <div className="sa-hero-content">
          <span className="sa-hero-eyebrow">ENTERPRISE CLOUD SIS</span>
          <h1 className="sa-hero-title">Platform Administration Overview</h1>
          <p className="sa-hero-sub">
            Unified telemetry, institutional lifecycle control, and real-time subscription management across all campuses.
          </p>
          <div className="sa-hero-actions">
            <button
              className="sa-btn-primary"
              onClick={() => {
                if (onOpenCreateSchool) onOpenCreateSchool();
                else navigateTo('/super-admin/schools?action=create');
              }}
            >
              <Plus size={16} /> <span>Register New School</span>
            </button>
            <button
              className="sa-btn-secondary"
              onClick={() => navigateTo('/super-admin/schools')}
            >
              <span>View All Campuses</span> <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="sa-hero-telemetry-badge">
          <div className="sa-telemetry-pill">
            <span className="sa-telemetry-dot" />
            <span>Platform Status: {systemHealth.status}</span>
          </div>
          <div className="sa-telemetry-meta">
            <span>Primary SIS: <b>Firestore ({systemHealth.firestore === 'connected' ? 'Connected' : 'Active'})</b></span>
            <span>Relational DB: <b>PostgreSQL ({systemHealth.db === 'connected' ? 'Connected' : 'Dual Standby'})</b></span>
            <span>Gateway: <b>Razorpay Sandbox (Ready)</b></span>
          </div>
        </div>
      </div>

      {/* ─── 6 Stat Cards Row (Real Data) ─── */}
      <div className="sa-stats-grid">
        {/* Card 1: Total Schools */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap icon-blue">
              <School size={20} />
            </div>
            <span className="sa-stat-kpi-badge">Institutes</span>
          </div>
          <span className="sa-stat-label">Total Schools</span>
          <div className="sa-stat-value">
            {loading ? '…' : (metrics?.totalSchools ?? schools.length)}
          </div>
          <div className="sa-stat-micro-bar">
            <div className="sa-micro-fill bg-blue" style={{ width: '100%' }} />
          </div>
          <div className="sa-stat-sub-text">
            <span>Enrolled in directory</span>
          </div>
        </div>

        {/* Card 2: Active Schools */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap icon-green">
              <CheckCircle2 size={20} />
            </div>
            <span className="sa-stat-kpi-badge success">{activeRatio}% Active</span>
          </div>
          <span className="sa-stat-label">Active Campuses</span>
          <div className="sa-stat-value">
            {loading ? '…' : (metrics?.activeSchools ?? 0)}
          </div>
          <div className="sa-stat-micro-bar">
            <div className="sa-micro-fill bg-green" style={{ width: `${Math.max(activeRatio, 5)}%` }} />
          </div>
          <div className="sa-stat-sub-text">
            <span>Valid active subscriptions</span>
          </div>
        </div>

        {/* Card 3: Expired / Attention */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap icon-amber">
              <Clock size={20} />
            </div>
            <span className="sa-stat-kpi-badge warning">{expiredRatio}% Expired</span>
          </div>
          <span className="sa-stat-label">Expired / Attention</span>
          <div className="sa-stat-value">
            {loading ? '…' : (metrics?.expiredSchools ?? 0)}
          </div>
          <div className="sa-stat-micro-bar">
            <div className="sa-micro-fill bg-amber" style={{ width: `${Math.max(expiredRatio, 5)}%` }} />
          </div>
          <div className="sa-stat-sub-text">
            <span>Requires license extension</span>
          </div>
        </div>

        {/* Card 4: Total Students */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap icon-purple">
              <GraduationCap size={20} />
            </div>
            <span className="sa-stat-kpi-badge">Enrolled</span>
          </div>
          <span className="sa-stat-label">Total Students</span>
          <div className="sa-stat-value">
            {loading ? '…' : (metrics?.totalStudents ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="sa-stat-micro-bar">
            <div className="sa-micro-fill bg-purple" style={{ width: '85%' }} />
          </div>
          <div className="sa-stat-sub-text">
            <span>Across all institutional rosters</span>
          </div>
        </div>

        {/* Card 5: Platform Revenue */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap icon-amber">
              <span style={{ fontWeight: 800, fontSize: 18 }}>₹</span>
            </div>
            <span className="sa-stat-kpi-badge success">Paid</span>
          </div>
          <span className="sa-stat-label">Settled Revenue</span>
          <div className="sa-stat-value">
            {loading ? '…' : `₹${Number(metrics?.totalRevenue ?? 0).toLocaleString('en-IN')}`}
          </div>
          <div className="sa-stat-micro-bar">
            <div className="sa-micro-fill bg-amber" style={{ width: '90%' }} />
          </div>
          <div className="sa-stat-sub-text">
            <span>Total subscription collections</span>
          </div>
        </div>

        {/* Card 6: Pending Collections */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap icon-slate">
              <CreditCard size={20} />
            </div>
            <span className="sa-stat-kpi-badge">Gateway</span>
          </div>
          <span className="sa-stat-label">Pending Invoices</span>
          <div className="sa-stat-value">
            {loading ? '…' : (metrics?.pendingPayments ?? 0)}
          </div>
          <div className="sa-stat-micro-bar">
            <div className="sa-micro-fill bg-slate" style={{ width: metrics?.pendingPayments ? '40%' : '8%' }} />
          </div>
          <div className="sa-stat-sub-text">
            <span>Invoices awaiting settlement</span>
          </div>
        </div>
      </div>

      {/* ─── Middle Section: School Directory Snapshot + Subscription Breakdown ─── */}
      <div className="sa-overview-grid">
        {/* Recent Schools Table Card */}
        <div className="sa-card sa-overview-table-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <School size={18} className="sa-card-icon" />
              <h3>Registered School Campuses</h3>
            </div>
            <div className="sa-card-head-actions">
              <button
                className="sa-btn-primary-small"
                onClick={() => {
                  if (onOpenCreateSchool) onOpenCreateSchool();
                  else navigateTo('/super-admin/schools?action=create');
                }}
              >
                <Plus size={14} /> <span>New School</span>
              </button>
              <button
                className="sa-link-btn"
                onClick={() => navigateTo('/super-admin/schools')}
              >
                <span>View Full Directory</span> <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Interactive Search & Filter Controls */}
          <div className="sa-table-controls">
            <div className="sa-filter-tabs">
              <button
                className={`sa-filter-tab ${tableStatus === 'ALL' ? 'active' : ''}`}
                onClick={() => setTableStatus('ALL')}
              >
                All ({schools.length})
              </button>
              <button
                className={`sa-filter-tab ${tableStatus === 'ACTIVE' ? 'active' : ''}`}
                onClick={() => setTableStatus('ACTIVE')}
              >
                Active ({schools.filter(s => (s.status || '').toUpperCase() === 'ACTIVE').length})
              </button>
              <button
                className={`sa-filter-tab ${tableStatus === 'EXPIRING' ? 'active' : ''}`}
                onClick={() => setTableStatus('EXPIRING')}
              >
                Expiring
              </button>
              <button
                className={`sa-filter-tab ${tableStatus === 'SUSPENDED' ? 'active' : ''}`}
                onClick={() => setTableStatus('SUSPENDED')}
              >
                Suspended ({schools.filter(s => (s.status || '').toUpperCase() === 'SUSPENDED').length})
              </button>
            </div>
            <div className="sa-inline-search">
              <Search size={14} style={{ color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Filter by name or code..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="sa-table-responsive">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>SCHOOL</th>
                  <th>ADMIN</th>
                  <th>STUDENTS</th>
                  <th>PLAN</th>
                  <th>VALIDITY</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchools.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="sa-td-empty">
                      {schools.length === 0 ? 'No schools registered in the database yet.' : 'No schools matching current filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredSchools.slice(0, 6).map((s, idx) => (
                    <tr key={s.id}>
                      <td className="sa-td-num">{idx + 1}</td>
                      <td>
                        <div className="sa-school-cell">
                          <div className="sa-school-avatar">
                            {s.code ? s.code.slice(0, 2) : s.name.slice(0, 2)}
                          </div>
                          <div className="sa-school-info">
                            <strong className="sa-school-name">{s.name}</strong>
                            <span className="sa-school-code">{s.code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="sa-td-admin">{s.admin_email || s.admin_name || 'Administrator'}</td>
                      <td className="sa-td-num">{(s.student_count || 0).toLocaleString('en-IN')}</td>
                      <td>
                        <span className="sa-plan-tag">{s.plan_name || 'Standard'}</span>
                      </td>
                      <td className="sa-td-validity">
                        {s.end_date ? new Date(s.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Lifetime'}
                      </td>
                      <td>
                        <span
                          className={`sa-status-pill ${
                            (s.status || '').toLowerCase().includes('active')
                              ? 'active'
                              : (s.status || '').toLowerCase().includes('soon')
                              ? 'expiring'
                              : 'expired'
                          }`}
                        >
                          {s.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', position: 'relative' }}>
                        <button
                          className="sa-more-btn"
                          title="Actions"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === s.id ? null : s.id);
                          }}
                        >
                          <MoreHorizontal size={16} />
                        </button>

                        {activeMenuId === s.id && (
                          <div className="sa-action-dropdown">
                            <button
                              onClick={() => {
                                setSelectedSchool(s);
                                setRenewModalOpen(true);
                                setActiveMenuId(null);
                              }}
                            >
                              <RefreshCw size={13} /> <span>Renew License</span>
                            </button>
                            <button onClick={() => handleToggleStatus(s.id, s.status)}>
                              <ShieldAlert size={13} /> <span>{s.status === 'ACTIVE' ? 'Suspend School' : 'Activate School'}</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subscription Tier Plans Card */}
        <div className="sa-card sa-overview-plans-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <Layers size={18} className="sa-card-icon" />
              <h3>Subscription Plans</h3>
            </div>
            <button
              className="sa-link-btn"
              onClick={() => navigateTo('/super-admin/subscriptions')}
            >
              <span>Manage Plans</span> <ChevronRight size={14} />
            </button>
          </div>

          <div className="sa-plans-stack">
            {(plans.length > 0 ? plans : [
              { id: 'plan-basic', name: 'Basic', max_students: 300, price_monthly: 499, description: 'Small preschools & nurseries' },
              { id: 'plan-standard', name: 'Standard', max_students: 1000, price_monthly: 999, description: 'K-12 secondary schools' },
              { id: 'plan-enterprise', name: 'Enterprise', max_students: 5000, price_monthly: 1999, description: 'Multi-campus institutions' }
            ]).map(p => (
              <div
                key={p.id}
                className="sa-plan-row"
                onClick={() => navigateTo('/super-admin/subscriptions')}
              >
                <div className="sa-plan-row-left">
                  <div className="sa-plan-icon-wrap">
                    <Layers size={16} />
                  </div>
                  <div>
                    <h4 className="sa-plan-name">{p.name}</h4>
                    <span className="sa-plan-desc">{p.description || `Up to ${p.max_students} students`}</span>
                  </div>
                </div>
                <div className="sa-plan-row-right">
                  <strong>₹{Number(p.price_monthly).toLocaleString('en-IN')}</strong>
                  <span>/ month</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bottom Section: Real-Time Audit Activity + System Health ─── */}
      <div className="sa-overview-grid-bottom">
        {/* Recent Activity Audit Trail */}
        <div className="sa-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <Database size={18} className="sa-card-icon" />
              <h3>Recent Platform Activities</h3>
            </div>
            <button
              className="sa-link-btn"
              onClick={() => navigateTo('/super-admin/audit-logs')}
            >
              <span>View Full Trail</span> <ChevronRight size={14} />
            </button>
          </div>

          <div className="sa-activity-feed">
            {recentAudits.length === 0 ? (
              <div className="sa-empty-message">No recent platform activities logged.</div>
            ) : (
              recentAudits.map(a => (
                <div key={a.id} className="sa-activity-row">
                  <div className="sa-act-bullet" />
                  <div className="sa-act-content">
                    <div className="sa-act-title-row">
                      <strong className="sa-act-action">{a.action}</strong>
                      <span className="sa-act-timestamp">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="sa-act-meta">
                      Executed by <strong>{a.userName || a.userEmail}</strong> on {a.schoolName || 'Platform Global'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Health Card */}
        <div className="sa-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <Server size={18} className="sa-card-icon" />
              <h3>System & Engine Status</h3>
            </div>
            <button
              className="sa-link-btn"
              onClick={() => navigateTo('/super-admin/monitoring')}
            >
              <span>Platform Health</span> <ChevronRight size={14} />
            </button>
          </div>

          <div className="sa-engine-grid">
            <div className="sa-engine-item">
              <div className="sa-engine-left">
                <div className="sa-engine-icon-wrap">
                  <Server size={18} />
                </div>
                <div className="sa-engine-details">
                  <strong>Backend REST API</strong>
                  <span>Express 4.19 / Node.js</span>
                </div>
              </div>
              <span className="sa-badge-pill success">Operational</span>
            </div>

            <div className="sa-engine-item">
              <div className="sa-engine-left">
                <div className="sa-engine-icon-wrap">
                  <Database size={18} />
                </div>
                <div className="sa-engine-details">
                  <strong>Cloud Firestore Emulator</strong>
                  <span>Port 8080 (Primary SIS Document Store)</span>
                </div>
              </div>
              <span className="sa-badge-pill success">{systemHealth.firestore === 'connected' ? 'Connected' : 'Active'}</span>
            </div>

            <div className="sa-engine-item">
              <div className="sa-engine-left">
                <div className="sa-engine-icon-wrap">
                  <Database size={18} />
                </div>
                <div className="sa-engine-details">
                  <strong>PostgreSQL Relational DB</strong>
                  <span>Port 5432 (Relational Engine)</span>
                </div>
              </div>
              <span className={`sa-badge-pill ${systemHealth.db === 'connected' ? 'success' : 'info'}`}>
                {systemHealth.db === 'connected' ? 'Connected' : 'Dual Standby'}
              </span>
            </div>

            <div className="sa-engine-item">
              <div className="sa-engine-left">
                <div className="sa-engine-icon-wrap">
                  <CreditCard size={18} />
                </div>
                <div className="sa-engine-details">
                  <strong>Payment Processing</strong>
                  <span>Razorpay Mock Sandbox</span>
                </div>
              </div>
              <span className="sa-badge-pill success">Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL: Renew License ─── */}
      {renewModalOpen && selectedSchool && (
        <div className="sa-modal-backdrop" onClick={() => setRenewModalOpen(false)}>
          <div className="sa-modal-box" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>Extend School Subscription</h3>
              <button className="sa-modal-close" onClick={() => setRenewModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleRenewSubmit} className="sa-modal-form">
              <div className="sa-school-summary-chip">
                <strong>{selectedSchool.name}</strong>
                <span>Code: {selectedSchool.code} · Plan: {selectedSchool.plan_name || 'Standard'}</span>
              </div>

              <div className="form-group">
                <label>Renewal Period (Days) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={renewDays}
                  onChange={e => setRenewDays(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Settlement Amount (₹ INR) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={renewAmount}
                  onChange={e => setRenewAmount(Number(e.target.value))}
                />
              </div>

              <div className="sa-modal-actions">
                <button
                  type="button"
                  className="sa-btn-secondary"
                  onClick={() => setRenewModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sa-btn-primary"
                  disabled={renewBusy}
                >
                  {renewBusy ? 'Extending...' : 'Confirm License Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
