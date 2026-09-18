import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, School, CreditCard, FileText, Eye, BarChart3,
  Users, Shield, ShieldCheck, Database, Settings, Moon, Sun,
  Menu, Bell, Search, Check, ChevronDown, LogOut, ArrowRight,
  Clock, Server, RefreshCw, X, AlertTriangle, Layers, UserPlus
} from 'lucide-react';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export function SuperAdminLayout({ children, currentPath, onNavigate }: SuperAdminLayoutProps) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      nav(path);
    }
    setMobileDrawerOpen(false);
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Dark mode
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggleTheme = () => setDark(prev => !prev);

  // Academic Sessions
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<string>('2025–26 Academic Session');
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ schools: any[]; students: any[]; invoices: any[] }>({
    schools: [],
    students: [],
    invoices: []
  });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCategory, setSearchCategory] = useState<'all' | 'schools' | 'students' | 'invoices'>('all');
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  // User Profile Menu
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifDropdownOpen(false);
      }
      if (sessionRef.current && !sessionRef.current.contains(event.target as Node)) {
        setSessionDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSelectedEntity(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch initial notifications and academic years
  useEffect(() => {
    async function initHeader() {
      try {
        const notifRes = await api.get('/super-admin/notifications');
        if (notifRes.data?.notifications) {
          setNotifications(notifRes.data.notifications);
          setUnreadCount(notifRes.data.unreadCount || 0);
        }
      } catch {}

      try {
        const ayRes = await api.get('/academic-years');
        if (Array.isArray(ayRes.data) && ayRes.data.length > 0) {
          setAcademicYears(ayRes.data);
          const active = ayRes.data.find((x: any) => x.is_active);
          if (active) setActiveSession(`${active.name} Academic Session`);
        }
      } catch {}
    }
    initHeader();
  }, []);

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ schools: [], students: [], invoices: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get(`/super-admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.data?.results) {
          setSearchResults(res.data.results);
        }
      } catch (err) {
        console.error('Search query failed:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleMarkAllNotificationsRead() {
    try {
      await api.post('/super-admin/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }

  async function handleNotificationClick(n: any) {
    if (!n.read) {
      try {
        await api.post(`/super-admin/notifications/${n.id}/read`);
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {}
    }
    if (n.link) {
      setNotifDropdownOpen(false);
      nav(n.link);
    }
  }

  // Navigation items grouped cleanly (Phase 4)
  const navSections = [
    {
      title: 'MAIN',
      items: [
        { path: '/super-admin', label: 'Overview', icon: LayoutDashboard },
        { path: '/super-admin/schools', label: 'Schools', icon: School },
        { path: '/super-admin/subscriptions', label: 'Subscriptions', icon: Layers },
        { path: '/super-admin/payments', label: 'Payments', icon: CreditCard },
        { path: '/super-admin/invoices', label: 'Invoices', icon: FileText },
        { path: '/super-admin/monitoring', label: 'Monitoring', icon: Eye }
      ]
    },
    {
      title: 'INSIGHTS',
      items: [
        { path: '/super-admin/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/attendance-reports', label: 'Reports', icon: FileText }
      ]
    },
    {
      title: 'ACCESS & SECURITY',
      items: [
        { path: '/super-admin/people', label: 'People', icon: Users },
        { path: '/super-admin/permissions', label: 'Roles & Permissions', icon: ShieldCheck },
        { path: '/super-admin/security', label: 'Security', icon: Shield },
        { path: '/super-admin/audit-logs', label: 'Audit Logs', icon: Database }
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { path: '/super-admin/monitoring', label: 'System Health', icon: Server },
        { path: '/backups', label: 'Backups', icon: RefreshCw },
        { path: '/super-admin/settings', label: 'Settings', icon: Settings }
      ]
    }
  ];

  // Breadcrumbs calculation (Phase 37)
  function renderBreadcrumbs() {
    const p = location.pathname;
    let section = 'Overview';
    let sub = '';

    if (p.includes('/schools')) { section = 'Schools'; sub = 'Directory & Onboarding'; }
    else if (p.includes('/subscriptions')) { section = 'Subscriptions'; sub = 'Licensing & Tier Management'; }
    else if (p.includes('/payments')) { section = 'Payments'; sub = 'Transaction Ledger'; }
    else if (p.includes('/invoices')) { section = 'Invoices'; sub = 'Billing & Receipts'; }
    else if (p.includes('/monitoring')) { section = 'Monitoring'; sub = 'Platform & System Pulse'; }
    else if (p.includes('/analytics')) { section = 'Analytics'; sub = 'Platform Usage Insights'; }
    else if (p.includes('/people')) { section = 'People'; sub = 'User Directory'; }
    else if (p.includes('/permissions')) { section = 'Roles & Permissions'; sub = 'RBAC Enforcement'; }
    else if (p.includes('/security')) { section = 'Security'; sub = 'Policy Hardening'; }
    else if (p.includes('/audit-logs')) { section = 'Audit Logs'; sub = 'Immutable Activity Stream'; }
    else if (p.includes('/settings')) { section = 'Settings'; sub = 'Global SaaS Configuration'; }

    return (
      <div className="sa-breadcrumbs">
        <span className="sa-bc-root" onClick={() => nav('/super-admin')}>Super Admin</span>
        <span className="sa-bc-sep">/</span>
        <span className="sa-bc-current">{section}</span>
        {sub && (
          <>
            <span className="sa-bc-sep">/</span>
            <span className="sa-bc-sub">{sub}</span>
          </>
        )}
      </div>
    );
  }

  const userInitials = user?.name ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() : 'SA';

  return (
    <div className="sa-app-shell">
      {/* ─── SIDEBAR ─── */}
      <aside className={`sa-sidebar ${sidebarCollapsed ? 'sa-sidebar-collapsed' : ''} ${mobileDrawerOpen ? 'sa-sidebar-mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="sa-sidebar-brand" onClick={() => nav('/super-admin')}>
          <div className="sa-brand-logo-wrap">
            <img src="/attendo-school-logo.png" alt="AttendoSchool" className="sa-brand-logo" />
          </div>
          {!sidebarCollapsed && (
            <div className="sa-brand-text">
              <span className="sa-brand-name">AttendoSchool</span>
              <span className="sa-brand-badge">Super Admin</span>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="sa-sidebar-nav-scroll">
          {navSections.map((sec, idx) => (
            <div key={idx} className="sa-nav-section">
              {!sidebarCollapsed && <div className="sa-nav-section-title">{sec.title}</div>}
              <div className="sa-nav-list">
                {sec.items.map((item, itemIdx) => {
                  const activePath = currentPath || location.pathname;
                  const isActive = activePath === item.path ||
                    (item.path !== '/super-admin' && activePath.startsWith(item.path));
                  const IconComp = item.icon;
                  return (
                    <button
                      key={itemIdx}
                      className={`sa-nav-item ${isActive ? 'active' : ''}`}
                      title={sidebarCollapsed ? item.label : undefined}
                      onClick={() => navigateTo(item.path)}
                    >
                      <IconComp size={18} className="sa-nav-icon" />
                      {!sidebarCollapsed && <span className="sa-nav-label">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="sa-sidebar-footer">
          <div className="sa-sidebar-darkmode-row">
            {!sidebarCollapsed && (
              <div className="sa-sidebar-darkmode-label">
                {dark ? <Moon size={16} /> : <Sun size={16} />}
                <span>{dark ? 'Dark Mode' : 'Light Mode'}</span>
              </div>
            )}
            <label className="sa-toggle-switch" title="Toggle color theme">
              <input type="checkbox" checked={dark} onChange={toggleTheme} />
              <span className="sa-slider"></span>
            </label>
          </div>
          {!sidebarCollapsed && <div className="sa-sidebar-version">AttendoSchool SaaS v2.5.0</div>}
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div className="sa-drawer-backdrop" onClick={() => setMobileDrawerOpen(false)} />
      )}

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="sa-main-wrap">
        {/* ─── TOP BAR ─── */}
        <header className="sa-topbar">
          <div className="sa-topbar-left">
            <button
              className="sa-icon-btn sa-menu-btn"
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setMobileDrawerOpen(prev => !prev);
                } else {
                  setSidebarCollapsed(prev => !prev);
                }
              }}
              title="Toggle Menu"
            >
              <Menu size={18} />
            </button>

            {/* Global Search Trigger */}
            <div className="sa-search-trigger" onClick={() => setSearchOpen(true)}>
              <Search size={16} className="sa-search-trigger-icon" />
              <span className="sa-search-trigger-text">Search schools, users, payments, invoices...</span>
              <kbd className="sa-search-kbd">Ctrl K</kbd>
            </div>
          </div>

          <div className="sa-topbar-right">
            {/* Academic Session Selector */}
            <div className="sa-session-wrap" ref={sessionRef}>
              <button
                className="sa-session-btn"
                onClick={() => setSessionDropdownOpen(prev => !prev)}
                title="Academic Session"
              >
                <Clock size={15} />
                <span>{activeSession}</span>
                <ChevronDown size={14} />
              </button>

              {sessionDropdownOpen && (
                <div className="sa-popover sa-session-popover">
                  <div className="sa-popover-header">
                    <h4>Academic Sessions</h4>
                  </div>
                  <div className="sa-popover-list">
                    {(academicYears.length > 0 ? academicYears : [
                      { id: 'ay-1', name: '2025–26', is_active: true },
                      { id: 'ay-2', name: '2024–25', is_active: false },
                      { id: 'ay-3', name: '2026–27', is_active: false }
                    ]).map((ay: any) => (
                      <div
                        key={ay.id}
                        className={`sa-popover-item ${activeSession.includes(ay.name) ? 'active' : ''}`}
                        onClick={() => {
                          setActiveSession(`${ay.name} Academic Session`);
                          setSessionDropdownOpen(false);
                        }}
                      >
                        <div>
                          <strong>{ay.name} Session</strong>
                          <span className="sa-popover-item-sub">{ay.is_active ? 'Active Term' : 'Archived Term'}</span>
                        </div>
                        {activeSession.includes(ay.name) && <Check size={16} className="sa-check-icon" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications Bell */}
            <div className="sa-notif-wrap" ref={notifRef}>
              <button
                className="sa-icon-btn sa-notif-btn"
                onClick={() => setNotifDropdownOpen(prev => !prev)}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="sa-notif-badge">{unreadCount}</span>}
              </button>

              {notifDropdownOpen && (
                <div className="sa-popover sa-notif-popover">
                  <div className="sa-popover-header">
                    <div>
                      <h4>Notifications</h4>
                      <span className="sa-popover-sub">{unreadCount} unread system alerts</span>
                    </div>
                    {unreadCount > 0 && (
                      <button className="sa-link-action-btn" onClick={handleMarkAllNotificationsRead}>
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="sa-popover-list">
                    {notifications.length === 0 ? (
                      <div className="sa-empty-popover">No notifications available</div>
                    ) : (
                      notifications.slice(0, 8).map(n => (
                        <div
                          key={n.id}
                          className={`sa-notif-item ${n.read ? 'read' : 'unread'}`}
                          onClick={() => handleNotificationClick(n)}
                        >
                          <div className={`sa-notif-cat-dot cat-${n.category?.toLowerCase() || 'system'}`} />
                          <div className="sa-notif-text">
                            <strong className="sa-notif-title">{n.title}</strong>
                            <p className="sa-notif-message">{n.message}</p>
                            <span className="sa-notif-time">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {!n.read && <div className="sa-unread-dot" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Dark Mode Icon */}
            <button className="sa-icon-btn" onClick={toggleTheme} title="Toggle theme">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Super Admin Profile Chip */}
            <div className="sa-profile-wrap" ref={profileRef}>
              <button
                className="sa-profile-chip"
                onClick={() => setProfileMenuOpen(prev => !prev)}
              >
                <div className="sa-profile-avatar">{userInitials}</div>
                <div className="sa-profile-meta">
                  <span className="sa-profile-name">{user?.name || 'Company Super Admin'}</span>
                  <span className="sa-profile-email">{user?.email || 'superadmin@attendoschool.com'}</span>
                </div>
                <ChevronDown size={14} className="sa-profile-chevron" />
              </button>

              {profileMenuOpen && (
                <div className="sa-popover sa-profile-popover">
                  <div className="sa-profile-popover-top">
                    <strong>{user?.name || 'Company Super Admin'}</strong>
                    <span>{user?.email}</span>
                    <span className="sa-role-badge">Super Admin</span>
                  </div>
                  <div className="sa-profile-popover-links">
                    <button onClick={() => { setProfileMenuOpen(false); nav('/super-admin/settings'); }}>
                      <Settings size={15} /> <span>Account Settings</span>
                    </button>
                    <button onClick={() => { setProfileMenuOpen(false); nav('/super-admin/security'); }}>
                      <Shield size={15} /> <span>Security Center</span>
                    </button>
                    <button onClick={() => { setProfileMenuOpen(false); nav('/super-admin/audit-logs'); }}>
                      <Database size={15} /> <span>Audit Trail</span>
                    </button>
                  </div>
                  <div className="sa-profile-popover-bottom">
                    <button
                      className="sa-signout-btn"
                      onClick={() => {
                        logout();
                        nav('/login');
                      }}
                    >
                      <LogOut size={15} /> <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Breadcrumb row */}
        <div className="sa-breadcrumb-bar">
          {renderBreadcrumbs()}
        </div>

        {/* Main Content Area */}
        <main className="sa-main-content">
          {children}
        </main>
      </div>

      {/* ─── GLOBAL SEARCH MODAL (Ctrl + K) ─── */}
      {searchOpen && (
        <div className="sa-modal-backdrop" onClick={() => setSearchOpen(false)}>
          <div className="sa-search-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-search-modal-head">
              <Search size={18} className="sa-search-input-icon" />
              <input
                autoFocus
                type="text"
                className="sa-search-modal-input"
                placeholder="Search schools, users, payments, invoices... (Press ESC to close)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="sa-search-clear" onClick={() => setSearchQuery('')}>
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="sa-search-tabs">
              {(['all', 'schools', 'students', 'invoices'] as const).map(cat => (
                <button
                  key={cat}
                  className={`sa-search-tab ${searchCategory === cat ? 'active' : ''}`}
                  onClick={() => setSearchCategory(cat)}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Search Results List */}
            <div className="sa-search-results-list">
              {searchLoading ? (
                <div className="sa-search-loading">Searching platform databases...</div>
              ) : !searchQuery.trim() ? (
                <div className="sa-search-placeholder">Type to search across all institutes, users, and invoices.</div>
              ) : (
                <>
                  {(searchCategory === 'all' || searchCategory === 'schools') && searchResults.schools.length > 0 && (
                    <div className="sa-search-group">
                      <div className="sa-search-group-title">Schools ({searchResults.schools.length})</div>
                      {searchResults.schools.map(s => (
                        <div
                          key={s.id}
                          className="sa-search-result-row"
                          onClick={() => {
                            setSearchOpen(false);
                            nav('/super-admin/schools');
                          }}
                        >
                          <School size={16} className="sa-result-icon" />
                          <div className="sa-result-info">
                            <strong>{s.title}</strong>
                            <span>{s.subtitle}</span>
                          </div>
                          <span className="sa-badge-pill">{s.badge}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(searchCategory === 'all' || searchCategory === 'students') && searchResults.students.length > 0 && (
                    <div className="sa-search-group">
                      <div className="sa-search-group-title">Students & Users ({searchResults.students.length})</div>
                      {searchResults.students.map(st => (
                        <div
                          key={st.id}
                          className="sa-search-result-row"
                          onClick={() => {
                            setSearchOpen(false);
                            nav('/super-admin/people');
                          }}
                        >
                          <Users size={16} className="sa-result-icon" />
                          <div className="sa-result-info">
                            <strong>{st.title}</strong>
                            <span>{st.subtitle}</span>
                          </div>
                          <span className="sa-badge-pill">{st.badge}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(searchCategory === 'all' || searchCategory === 'invoices') && searchResults.invoices.length > 0 && (
                    <div className="sa-search-group">
                      <div className="sa-search-group-title">Invoices ({searchResults.invoices.length})</div>
                      {searchResults.invoices.map(inv => (
                        <div
                          key={inv.id}
                          className="sa-search-result-row"
                          onClick={() => {
                            setSearchOpen(false);
                            nav('/super-admin/invoices');
                          }}
                        >
                          <FileText size={16} className="sa-result-icon" />
                          <div className="sa-result-info">
                            <strong>{inv.title}</strong>
                            <span>{inv.subtitle}</span>
                          </div>
                          <span className="sa-badge-pill">{inv.badge}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchResults.schools.length === 0 && searchResults.students.length === 0 && searchResults.invoices.length === 0 && (
                    <div className="sa-search-empty">No matching records found for "{searchQuery}".</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
