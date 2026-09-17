import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './hooks/useAuth';
import {
  School, Users, Clock, BarChart3, FileText,
  TrendingUp, TrendingDown, Layers, ChevronRight, MoreHorizontal,
  Plus, CreditCard, AlertTriangle, UserCheck, Server, Database,
  RefreshCw, ShieldAlert, GraduationCap
} from 'lucide-react';

export interface SuperAdminDashboardProps {
  onOpenCreateSchool?: () => void;
}

export function SuperAdminDashboard({ onOpenCreateSchool }: SuperAdminDashboardProps) {
  const { user } = useAuth();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [dbSchools, setDbSchools] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState<string>('Operational');

  // Interactive filters
  const [growthTimeframe, setGrowthTimeframe] = useState('Last 6 Months');
  const [planFilter, setPlanFilter] = useState('All Plans');
  const [revenueTimeframe, setRevenueTimeframe] = useState('Last 6 Months');

  // Modals & Popovers
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [renewDays, setRenewDays] = useState(30);
  const [renewAmount, setRenewAmount] = useState(999);
  const [modalMsg, setModalMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // New School Form state
  const [newSchool, setNewSchool] = useState({
    name: '',
    code: '',
    enquiryNumber: '9000000000',
    adminName: '',
    adminEmail: '',
    adminPassword: 'ChangeMe123!',
    planId: '',
    startDate: new Date().toISOString().slice(0, 10),
    days: 30
  });

  // Default initial mock dataset matching the screenshot exactly
  const initialSchools = [
    {
      id: 'sch-01',
      name: 'Greenwood International',
      code: 'GWI',
      adminName: 'Rohit Sharma',
      studentCount: 1245,
      plan: 'Standard',
      validity: 'Mar 31, 2026',
      status: 'Active',
      color: '#1e3a8a'
    },
    {
      id: 'sch-02',
      name: 'Sunrise Public School',
      code: 'SPS',
      adminName: 'Neha Verma',
      studentCount: 892,
      plan: 'Basic',
      validity: 'Jan 31, 2026',
      status: 'Active',
      color: '#059669'
    },
    {
      id: 'sch-03',
      name: 'Bright Future Academy',
      code: 'BFA',
      adminName: 'Amit Kumar',
      studentCount: 2100,
      plan: 'Enterprise',
      validity: 'Apr 15, 2026',
      status: 'Expiring Soon',
      color: '#0891b2'
    },
    {
      id: 'sch-04',
      name: 'Wisdom High School',
      code: 'WHS',
      adminName: 'Priya Singh',
      studentCount: 680,
      plan: 'Standard',
      validity: 'Oct 10, 2025',
      status: 'Expired',
      color: '#2563eb'
    },
    {
      id: 'sch-05',
      name: 'NexGen Global School',
      code: 'NGS',
      adminName: 'Sahil Mehta',
      studentCount: 3050,
      plan: 'Enterprise',
      validity: 'Jun 30, 2026',
      status: 'Active',
      color: '#4f46e5'
    }
  ];

  async function loadData() {
    setLoading(true);
    try {
      const [overviewRes, schoolsRes, plansRes, healthRes] = await Promise.allSettled([
        api.get('/super-admin/overview'),
        api.get('/super-admin/schools'),
        api.get('/super-admin/plans'),
        api.get('/api/health')
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.data) {
        setData(overviewRes.value.data);
      }
      if (schoolsRes.status === 'fulfilled' && Array.isArray(schoolsRes.value.data)) {
        setDbSchools(schoolsRes.value.data);
      }
      if (plansRes.status === 'fulfilled' && Array.isArray(plansRes.value.data)) {
        setPlans(plansRes.value.data);
        if (plansRes.value.data.length > 0) {
          setNewSchool(prev => ({ ...prev, planId: plansRes.value.data[0].id }));
        }
      }
      if (healthRes.status === 'fulfilled') {
        setSystemStatus('Operational');
      }
    } catch (e) {
      console.error('SuperAdminDashboard load failed:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Format merged schools: show real DB schools if available, merged with screenshot sample
  const displayedSchools = dbSchools.length > 0
    ? dbSchools.map((s, idx) => ({
        id: s.id,
        name: s.name,
        code: s.code || `SCH00${idx + 1}`,
        adminName: s.admin_email?.split('@')[0] || s.admin_name || 'Administrator',
        studentCount: Number(s.student_count || 120),
        plan: s.plan_name || 'Standard',
        validity: s.end_date ? new Date(s.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Mar 31, 2026',
        status: s.status === 'ACTIVE' ? (new Date(s.end_date) < new Date() ? 'Expired' : 'Active') : (s.status === 'SUSPENDED' ? 'Suspended' : 'Expiring Soon'),
        color: ['#1e3a8a', '#059669', '#0891b2', '#2563eb', '#4f46e5'][idx % 5]
      }))
    : initialSchools;

  const filteredSchools = displayedSchools.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.adminName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.plan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Growth Bar Chart Data (Apr - Sep)
  const growthData = [
    { month: 'Apr', value: 8 },
    { month: 'May', value: 12 },
    { month: 'Jun', value: 18 },
    { month: 'Jul', value: 24 },
    { month: 'Aug', value: 28 },
    { month: 'Sep', value: 32 }
  ];

  // Revenue Area Chart Data
  const revenuePoints = [
    { month: 'Apr', label: '₹40K', value: 40000, x: 20, y: 155 },
    { month: 'May', label: '₹68K', value: 68000, x: 75, y: 135 },
    { month: 'Jun', label: '₹1.05L', value: 105000, x: 130, y: 110 },
    { month: 'Jul', label: '₹1.48L', value: 148875, x: 185, y: 85 },
    { month: 'Aug', label: '₹1.80L', value: 180000, x: 240, y: 65 },
    { month: 'Sep', label: '₹2.20L', value: 220000, x: 295, y: 40 }
  ];

  async function handleCreateSchool(e: React.FormEvent) {
    e.preventDefault();
    setModalMsg('');
    try {
      await api.post('/super-admin/schools', newSchool);
      setCreateModalOpen(false);
      setNewSchool({
        name: '',
        code: '',
        enquiryNumber: '9000000000',
        adminName: '',
        adminEmail: '',
        adminPassword: 'ChangeMe123!',
        planId: plans[0]?.id || '',
        startDate: new Date().toISOString().slice(0, 10),
        days: 30
      });
      loadData();
    } catch (err: any) {
      setModalMsg(err?.response?.data?.message || 'Could not create school. Please verify fields.');
    }
  }

  async function handleRenewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSchool) return;
    try {
      await api.post(`/super-admin/schools/${selectedSchool.id}/renew`, {
        days: renewDays,
        amount: renewAmount
      });
      setRenewModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Renewal failed');
    }
  }

  async function handleToggleStatus(schoolId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'Active' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/super-admin/schools/${schoolId}/status`, { status: nextStatus });
      setActiveMenuId(null);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Status update failed');
    }
  }

  return (
    <div className="super-admin-view">
      {/* ─── Hero Welcome Row ─── */}
      <div className="sa-hero-card">
        <div className="sa-hero-content">
          <span className="sa-hero-eyebrow">WELCOME BACK</span>
          <h1 className="sa-hero-title">Company Super Admin</h1>
          <p className="sa-hero-sub">
            Manage schools, subscriptions, payments and SaaS usage across your organization.
          </p>
        </div>

        <div className="sa-hero-graphic">
          <img
            src="/educational_student_campus.jpg"
            alt="Connected Schools"
            className="sa-hero-campus-img"
          />
          <div className="sa-hero-campus-scrim" />
          <div className="sa-hero-tag">
            <span className="sa-hero-tag-main">Connected Schools</span>
            <span className="sa-hero-tag-sub">Stronger Tomorrows</span>
          </div>
        </div>
      </div>

      {/* ─── 5 Stat Cards Row ─── */}
      <div className="sa-stats-row">
        {/* Card 1: Total Schools */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <School size={20} />
            </div>
            <div className="sa-sparkline">
              <span style={{ height: '40%', background: '#bae6fd' }}></span>
              <span style={{ height: '55%', background: '#7dd3fc' }}></span>
              <span style={{ height: '70%', background: '#38bdf8' }}></span>
              <span style={{ height: '85%', background: '#0ea5e9' }}></span>
              <span style={{ height: '100%', background: '#0284c7' }}></span>
            </div>
          </div>
          <span className="sa-stat-label">Total Schools</span>
          <div className="sa-stat-value">
            {data?.totalSchools || displayedSchools.length || 24}
          </div>
          <div className="sa-stat-trend positive">
            <TrendingUp size={14} />
            <span>+20%</span>
            <span className="sa-stat-sub">vs last month</span>
          </div>
        </div>

        {/* Card 2: Active Schools */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <Users size={20} />
            </div>
            <div className="sa-sparkline">
              <span style={{ height: '35%', background: '#bbf7d0' }}></span>
              <span style={{ height: '50%', background: '#86efac' }}></span>
              <span style={{ height: '65%', background: '#4ade80' }}></span>
              <span style={{ height: '80%', background: '#22c55e' }}></span>
              <span style={{ height: '100%', background: '#16a34a' }}></span>
            </div>
          </div>
          <span className="sa-stat-label">Active Schools</span>
          <div className="sa-stat-value">
            {data?.activeSchools || 20}
          </div>
          <div className="sa-stat-trend positive">
            <TrendingUp size={14} />
            <span>+12%</span>
            <span className="sa-stat-sub">83% of total</span>
          </div>
        </div>

        {/* Card 3: Expired Schools */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <Clock size={20} />
            </div>
            <div className="sa-sparkline">
              <span style={{ height: '60%', background: '#fca5a5' }}></span>
              <span style={{ height: '80%', background: '#f87171' }}></span>
              <span style={{ height: '50%', background: '#ef4444' }}></span>
              <span style={{ height: '35%', background: '#dc2626' }}></span>
              <span style={{ height: '20%', background: '#b91c1c' }}></span>
            </div>
          </div>
          <span className="sa-stat-label">Expired Schools</span>
          <div className="sa-stat-value">
            {data?.expiredSchools || 2}
          </div>
          <div className="sa-stat-trend negative">
            <TrendingDown size={14} />
            <span>-33%</span>
            <span className="sa-stat-sub">Need attention</span>
          </div>
        </div>

        {/* Card 4: Total Students */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap" style={{ background: '#f3e8ff', color: '#9333ea' }}>
              <GraduationCap size={20} />
            </div>
            <div className="sa-sparkline">
              <span style={{ height: '40%', background: '#e9d5ff' }}></span>
              <span style={{ height: '55%', background: '#d8b4fe' }}></span>
              <span style={{ height: '70%', background: '#c084fc' }}></span>
              <span style={{ height: '85%', background: '#a855f7' }}></span>
              <span style={{ height: '100%', background: '#9333ea' }}></span>
            </div>
          </div>
          <span className="sa-stat-label">Total Students</span>
          <div className="sa-stat-value">
            {(data?.totalStudents || 12450).toLocaleString('en-IN')}
          </div>
          <div className="sa-stat-trend positive">
            <TrendingUp size={14} />
            <span>+18%</span>
            <span className="sa-stat-sub">Across all schools</span>
          </div>
        </div>

        {/* Card 5: Monthly Revenue */}
        <div className="sa-stat-card">
          <div className="sa-stat-top">
            <div className="sa-stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>₹</span>
            </div>
            <div className="sa-sparkline">
              <span style={{ height: '45%', background: '#fde68a' }}></span>
              <span style={{ height: '60%', background: '#fcd34d' }}></span>
              <span style={{ height: '75%', background: '#fbbf24' }}></span>
              <span style={{ height: '90%', background: '#f59e0b' }}></span>
              <span style={{ height: '100%', background: '#d97706' }}></span>
            </div>
          </div>
          <span className="sa-stat-label">Monthly Revenue</span>
          <div className="sa-stat-value">
            ₹{Number(data?.totalRevenue || 148875).toLocaleString('en-IN')}
          </div>
          <div className="sa-stat-trend positive">
            <TrendingUp size={14} />
            <span>+24%</span>
            <span className="sa-stat-sub">Gross run-rate</span>
          </div>
        </div>
      </div>

      {/* ─── Middle Analytics Row (3 Columns) ─── */}
      <div className="sa-analytics-row">
        {/* Chart 1: Schools Growth */}
        <div className="sa-card sa-chart-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <BarChart3 size={18} className="sa-card-icon" />
              <h3>Schools Growth</h3>
            </div>
            <select
              className="sa-filter-select"
              value={growthTimeframe}
              onChange={e => setGrowthTimeframe(e.target.value)}
            >
              <option value="Last 6 Months">Last 6 Months</option>
              <option value="This Year">This Year</option>
              <option value="All Time">All Time</option>
            </select>
          </div>

          <div className="sa-chart-container">
            {/* SVG Bar Chart */}
            <div className="sa-barchart-wrapper">
              <div className="sa-y-axis">
                <span>40</span>
                <span>30</span>
                <span>20</span>
                <span>10</span>
                <span>0</span>
              </div>
              <div className="sa-barchart-plot">
                {growthData.map((d, i) => (
                  <div key={i} className="sa-bar-col">
                    <div className="sa-bar-track">
                      <span className="sa-bar-tooltip">{d.value} Schools</span>
                      <div
                        className="sa-bar-fill"
                        style={{ height: `${(d.value / 40) * 100}%` }}
                      >
                        <span className="sa-bar-value-label">{d.value}</span>
                      </div>
                    </div>
                    <span className="sa-bar-label">{d.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Subscription Health */}
        <div className="sa-card sa-chart-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <FileText size={18} className="sa-card-icon" />
              <h3>Subscription Health</h3>
            </div>
            <select
              className="sa-filter-select"
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
            >
              <option value="All Plans">All Plans</option>
              <option value="Basic">Basic</option>
              <option value="Standard">Standard</option>
              <option value="Enterprise">Enterprise</option>
            </select>
          </div>

          <div className="sa-donut-section">
            {/* Circular Donut Graphic */}
            <div className="sa-donut-wrap">
              <svg viewBox="0 0 120 120" className="sa-donut-svg">
                {/* Background Ring */}
                <circle cx="60" cy="60" r="46" fill="none" stroke="#f1f5f9" strokeWidth="15" />
                {/* Active Segment (83% = ~240 deg stroke-dasharray) */}
                <circle
                  cx="60" cy="60" r="46"
                  fill="none" stroke="#10b981" strokeWidth="15"
                  strokeDasharray="239 289"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
                {/* Expiring Soon Segment (8% = ~23 deg) */}
                <circle
                  cx="60" cy="60" r="46"
                  fill="none" stroke="#f59e0b" strokeWidth="15"
                  strokeDasharray="23 289"
                  strokeDashoffset="-242"
                  strokeLinecap="round"
                />
                {/* Expired Segment (8% = ~23 deg) */}
                <circle
                  cx="60" cy="60" r="46"
                  fill="none" stroke="#ef4444" strokeWidth="15"
                  strokeDasharray="23 289"
                  strokeDashoffset="-267"
                  strokeLinecap="round"
                />
              </svg>
              <div className="sa-donut-center">
                <span className="sa-donut-big">24</span>
                <span className="sa-donut-sub">Schools</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="sa-donut-legend">
              <div className="sa-legend-row">
                <span className="sa-legend-dot" style={{ background: '#10b981' }}></span>
                <span className="sa-legend-name">Active</span>
                <strong className="sa-legend-val">20 (83%)</strong>
              </div>
              <div className="sa-legend-row">
                <span className="sa-legend-dot" style={{ background: '#f59e0b' }}></span>
                <span className="sa-legend-name">Expiring Soon</span>
                <strong className="sa-legend-val">2 (8%)</strong>
              </div>
              <div className="sa-legend-row">
                <span className="sa-legend-dot" style={{ background: '#ef4444' }}></span>
                <span className="sa-legend-name">Expired</span>
                <strong className="sa-legend-val">2 (8%)</strong>
              </div>
              <div className="sa-legend-row">
                <span className="sa-legend-dot" style={{ background: '#94a3b8' }}></span>
                <span className="sa-legend-name">Suspended</span>
                <strong className="sa-legend-val">0 (0%)</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 3: Revenue Overview */}
        <div className="sa-card sa-chart-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <CreditCard size={18} className="sa-card-icon" />
              <h3>Revenue Overview</h3>
            </div>
            <select
              className="sa-filter-select"
              value={revenueTimeframe}
              onChange={e => setRevenueTimeframe(e.target.value)}
            >
              <option value="Last 6 Months">Last 6 Months</option>
              <option value="This Year">This Year</option>
              <option value="All Time">All Time</option>
            </select>
          </div>

          <div className="sa-chart-container">
            {/* SVG Area Chart */}
            <div className="sa-areachart-wrapper">
              <div className="sa-y-axis">
                <span>₹2.5L</span>
                <span>₹2L</span>
                <span>₹1.5L</span>
                <span>₹1L</span>
                <span>₹50K</span>
                <span>₹0</span>
              </div>
              <div className="sa-areachart-svg-box">
                <svg viewBox="0 0 315 180" preserveAspectRatio="none" className="sa-revenue-svg">
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines */}
                  <line x1="0" y1="170" x2="315" y2="170" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="135" x2="315" y2="135" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="100" x2="315" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="65" x2="315" y2="65" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="30" x2="315" y2="30" stroke="#f1f5f9" strokeWidth="1" />

                  {/* Filled Area */}
                  <polygon
                    points="20,155 75,135 130,110 185,85 240,65 295,40 295,170 20,170"
                    fill="url(#revenueGrad)"
                  />

                  {/* Smooth Line */}
                  <polyline
                    points="20,155 75,135 130,110 185,85 240,65 295,40"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                  />

                  {/* Data Points */}
                  {revenuePoints.map((p, idx) => (
                    <g key={idx} className="sa-point-group">
                      <circle cx={p.x} cy={p.y} r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                    </g>
                  ))}
                </svg>

                {/* X Axis Labels */}
                <div className="sa-x-axis">
                  {revenuePoints.map((p, idx) => (
                    <span key={idx}>{p.month}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Row 1: Recent Schools + Subscription Plans ─── */}
      <div className="sa-grid-two-col">
        {/* Table Card: Recent Schools */}
        <div className="sa-card sa-table-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <FileText size={18} className="sa-card-icon" />
              <h3>Recent Schools</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="sa-btn-primary-small"
                onClick={() => setCreateModalOpen(true)}
              >
                <Plus size={14} /> <span>New School</span>
              </button>
              <button className="sa-link-btn" onClick={() => nav('/super-admin')}>
                <span>View All</span> <ChevronRight size={14} />
              </button>
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
                {filteredSchools.slice(0, 5).map((s, idx) => (
                  <tr key={s.id}>
                    <td className="sa-td-num">{idx + 1}</td>
                    <td>
                      <div className="sa-school-cell">
                        <div
                          className="sa-school-avatar"
                          style={{ backgroundColor: s.color || '#1e3a8a' }}
                        >
                          {s.code ? s.code.slice(0, 2) : s.name.slice(0, 2)}
                        </div>
                        <span className="sa-school-name">{s.name}</span>
                      </div>
                    </td>
                    <td className="sa-td-admin">{s.adminName}</td>
                    <td className="sa-td-num">{(s.studentCount || 0).toLocaleString('en-IN')}</td>
                    <td>
                      <span className="sa-plan-tag">{s.plan}</span>
                    </td>
                    <td className="sa-td-validity">{s.validity}</td>
                    <td>
                      <span
                        className={`sa-status-pill ${
                          s.status.toLowerCase().includes('active')
                            ? 'active'
                            : s.status.toLowerCase().includes('soon')
                            ? 'expiring'
                            : 'expired'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', position: 'relative' }}>
                      <button
                        className="sa-more-btn"
                        title="Actions"
                        onClick={() => setActiveMenuId(activeMenuId === s.id ? null : s.id)}
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {/* Dropdown Action Popover */}
                      {activeMenuId === s.id && (
                        <div className="sa-action-dropdown">
                          <button onClick={() => {
                            setSelectedSchool(s);
                            setRenewModalOpen(true);
                            setActiveMenuId(null);
                          }}>
                            <RefreshCw size={13} /> <span>Renew License</span>
                          </button>
                          <button onClick={() => handleToggleStatus(s.id, s.status)}>
                            <ShieldAlert size={13} /> <span>{s.status === 'Active' ? 'Suspend School' : 'Activate School'}</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card: Subscription Plans */}
        <div className="sa-card sa-plans-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <Layers size={18} className="sa-card-icon" />
              <h3>Subscription Plans</h3>
            </div>
            <button className="sa-link-btn" onClick={() => nav('/super-admin')}>
              <span>Manage Plans</span> <ChevronRight size={14} />
            </button>
          </div>

          <div className="sa-plans-list">
            {/* Plan 1: Basic */}
            <div
              className="sa-plan-item"
              onClick={() => nav('/super-admin')}
            >
              <div className="sa-plan-left">
                <div className="sa-plan-badge-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                  <div className="sa-3d-box"></div>
                </div>
                <div>
                  <h4 className="sa-plan-name">Basic</h4>
                  <p className="sa-plan-desc">For small schools</p>
                </div>
              </div>
              <div className="sa-plan-right">
                <span className="sa-plan-price">₹499 / month</span>
                <span className="sa-plan-limit">Up to 300 students</span>
              </div>
              <ChevronRight size={16} className="sa-plan-chevron" />
            </div>

            {/* Plan 2: Standard */}
            <div
              className="sa-plan-item"
              onClick={() => nav('/super-admin')}
            >
              <div className="sa-plan-left">
                <div className="sa-plan-badge-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                  <Layers size={18} />
                </div>
                <div>
                  <h4 className="sa-plan-name">Standard</h4>
                  <p className="sa-plan-desc">For growing schools</p>
                </div>
              </div>
              <div className="sa-plan-right">
                <span className="sa-plan-price">₹999 / month</span>
                <span className="sa-plan-limit">Up to 1,000 students</span>
              </div>
              <ChevronRight size={16} className="sa-plan-chevron" />
            </div>

            {/* Plan 3: Enterprise */}
            <div
              className="sa-plan-item"
              onClick={() => nav('/super-admin')}
            >
              <div className="sa-plan-left">
                <div className="sa-plan-badge-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                  <span style={{ fontSize: 18 }}>👑</span>
                </div>
                <div>
                  <h4 className="sa-plan-name">Enterprise</h4>
                  <p className="sa-plan-desc">For large institutions</p>
                </div>
              </div>
              <div className="sa-plan-right">
                <span className="sa-plan-price">₹1,999 / month</span>
                <span className="sa-plan-limit">Custom students</span>
              </div>
              <ChevronRight size={16} className="sa-plan-chevron" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Row 2: Recent Activities + System Status ─── */}
      <div className="sa-grid-two-col-bottom">
        {/* Card 1: Recent Activities */}
        <div className="sa-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <FileText size={18} className="sa-card-icon" />
              <h3>Recent Activities</h3>
            </div>
            <button className="sa-link-btn" onClick={() => nav('/attendance-corrections')}>
              <span>View All</span> <ChevronRight size={14} />
            </button>
          </div>

          <div className="sa-activities-list">
            <div className="sa-activity-item">
              <div className="sa-act-icon-wrap" style={{ background: '#10b981', color: '#ffffff' }}>
                <Plus size={14} />
              </div>
              <div className="sa-act-text">
                <span className="sa-act-title">New school registered - Greenwood International</span>
                <span className="sa-act-time">2 hours ago</span>
              </div>
            </div>

            <div className="sa-activity-item">
              <div className="sa-act-icon-wrap" style={{ background: '#2563eb', color: '#ffffff' }}>
                <CreditCard size={14} />
              </div>
              <div className="sa-act-text">
                <span className="sa-act-title">Payment received - ₹999 (Sunrise Public School)</span>
                <span className="sa-act-time">4 hours ago</span>
              </div>
            </div>

            <div className="sa-activity-item">
              <div className="sa-act-icon-wrap" style={{ background: '#f59e0b', color: '#ffffff' }}>
                <AlertTriangle size={14} />
              </div>
              <div className="sa-act-text">
                <span className="sa-act-title">Subscription expiring in 7 days - Bright Future Academy</span>
                <span className="sa-act-time">6 hours ago</span>
              </div>
            </div>

            <div className="sa-activity-item">
              <div className="sa-act-icon-wrap" style={{ background: '#6366f1', color: '#ffffff' }}>
                <UserCheck size={14} />
              </div>
              <div className="sa-act-text">
                <span className="sa-act-title">New admin added - Neha Verma (Sunrise Public School)</span>
                <span className="sa-act-time">1 day ago</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: System Status */}
        <div className="sa-card">
          <div className="sa-card-head">
            <div className="sa-card-title-group">
              <ActivityIcon size={18} className="sa-card-icon" />
              <h3>System Status</h3>
            </div>
            <div className="sa-status-operational-pill">
              <span className="sa-pulse-dot"></span>
              <span>All Systems Operational</span>
            </div>
          </div>

          <div className="sa-system-grid">
            <div className="sa-sys-item">
              <div className="sa-sys-icon-circle">
                <Server size={20} />
              </div>
              <span className="sa-sys-name">Platform</span>
              <div className="sa-sys-badge">
                <span className="sa-green-dot"></span>
                <span>Operational</span>
              </div>
            </div>

            <div className="sa-sys-item">
              <div className="sa-sys-icon-circle">
                <Database size={20} />
              </div>
              <span className="sa-sys-name">Database</span>
              <div className="sa-sys-badge">
                <span className="sa-green-dot"></span>
                <span>Operational</span>
              </div>
            </div>

            <div className="sa-sys-item">
              <div className="sa-sys-icon-circle">
                <CreditCard size={20} />
              </div>
              <span className="sa-sys-name">Payments</span>
              <div className="sa-sys-badge">
                <span className="sa-green-dot"></span>
                <span>Operational</span>
              </div>
            </div>

            <div className="sa-sys-item">
              <div className="sa-sys-icon-circle">
                <RefreshCw size={20} />
              </div>
              <span className="sa-sys-name">Auto Sync</span>
              <div className="sa-sys-badge">
                <span className="sa-green-dot"></span>
                <span>Operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modal: Create New School ─── */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-content sa-modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register New School</h3>
              <button className="modal-close" onClick={() => setCreateModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleCreateSchool} className="modal-form">
              {modalMsg && <div className="error">{modalMsg}</div>}
              <div className="form-row">
                <label>
                  School Name *
                  <input
                    required
                    placeholder="e.g. Greenwood International"
                    value={newSchool.name}
                    onChange={e => setNewSchool({ ...newSchool, name: e.target.value })}
                  />
                </label>
                <label>
                  School Code *
                  <input
                    required
                    placeholder="e.g. GWI001"
                    value={newSchool.code}
                    onChange={e => setNewSchool({ ...newSchool, code: e.target.value.toUpperCase() })}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Principal / Admin Name *
                  <input
                    required
                    placeholder="e.g. Rohit Sharma"
                    value={newSchool.adminName}
                    onChange={e => setNewSchool({ ...newSchool, adminName: e.target.value })}
                  />
                </label>
                <label>
                  Admin Email *
                  <input
                    required
                    type="email"
                    placeholder="admin@school.com"
                    value={newSchool.adminEmail}
                    onChange={e => setNewSchool({ ...newSchool, adminEmail: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Admin Initial Password *
                  <input
                    required
                    type="password"
                    value={newSchool.adminPassword}
                    onChange={e => setNewSchool({ ...newSchool, adminPassword: e.target.value })}
                  />
                </label>
                <label>
                  Enquiry Helpline
                  <input
                    value={newSchool.enquiryNumber}
                    onChange={e => setNewSchool({ ...newSchool, enquiryNumber: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Subscription Plan
                  <select
                    value={newSchool.planId}
                    onChange={e => setNewSchool({ ...newSchool, planId: e.target.value })}
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ₹{p.price_monthly}/month ({p.max_students} students)
                      </option>
                    ))}
                    {plans.length === 0 && (
                      <>
                        <option value="basic">Basic — ₹499/month (300 students)</option>
                        <option value="standard">Standard — ₹999/month (1,000 students)</option>
                        <option value="enterprise">Enterprise — ₹1,999/month (Custom)</option>
                      </>
                    )}
                  </select>
                </label>
                <label>
                  Validity Period (Days)
                  <input
                    type="number"
                    min="1"
                    value={newSchool.days}
                    onChange={e => setNewSchool({ ...newSchool, days: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Create School & Provision Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Renew Subscription ─── */}
      {renewModalOpen && selectedSchool && (
        <div className="modal-backdrop" onClick={() => setRenewModalOpen(false)}>
          <div className="modal-content sa-modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Renew Subscription — {selectedSchool.name}</h3>
              <button className="modal-close" onClick={() => setRenewModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleRenewSubmit} className="modal-form">
              <label>
                Renewal Period (Days)
                <input
                  type="number"
                  min="1"
                  value={renewDays}
                  onChange={e => setRenewDays(Number(e.target.value))}
                />
              </label>
              <label>
                Renewal Amount (₹ INR)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={renewAmount}
                  onChange={e => setRenewAmount(Number(e.target.value))}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setRenewModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Confirm Renewal & Settle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityIcon(props: any) {
  return (
    <svg
      {...props}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
