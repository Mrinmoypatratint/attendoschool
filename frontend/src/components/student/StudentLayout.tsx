import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BrandedWelcomeLoader } from '../BrandedWelcomeLoader';
import {
  LayoutDashboard,
  CalendarCheck,
  Calendar,
  BookOpen,
  FileCheck,
  GraduationCap,
  Megaphone,
  FileText,
  User as UserIcon,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  Sun,
  Moon,
  Building2,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../services/studentApi';

interface StudentLayoutProps {
  children: React.ReactNode;
}

export function StudentLayout({ children }: StudentLayoutProps) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dark, setDark] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Branded Welcome Loader state - displayed only once per session per student
  const welcomeSessionKey = user?.id ? `attendo_welcome_seen_${user.id}` : null;
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    if (!user || user.role !== 'STUDENT') return false;
    if (typeof window === 'undefined') return false;
    try {
      return !sessionStorage.getItem(`attendo_welcome_seen_${user.id}`);
    } catch {
      return false;
    }
  });

  // Ensure that if the user changes while StudentLayout remains mounted, loader state syncs immediately
  useEffect(() => {
    if (!user || user.role !== 'STUDENT') {
      setShowWelcome(false);
      return;
    }
    try {
      const alreadySeen = sessionStorage.getItem(`attendo_welcome_seen_${user.id}`);
      setShowWelcome(!alreadySeen);
    } catch {
      setShowWelcome(false);
    }
  }, [user?.id, user?.role]);

  const handleWelcomeComplete = useCallback(() => {
    if (welcomeSessionKey) {
      try {
        sessionStorage.setItem(welcomeSessionKey, 'true');
      } catch {}
    }
    setShowWelcome(false);
  }, [welcomeSessionKey]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Dynamic notification count from School Admin announcements
  useEffect(() => {
    let isMounted = true;
    studentApi
      .getAnnouncements()
      .then((list) => {
        if (!isMounted) return;
        if (!Array.isArray(list)) {
          setUnreadCount(0);
          return;
        }

        let readIds: string[] = [];
        try {
          const stored = localStorage.getItem(`read_announcements_${user?.id || 'guest'}`);
          if (stored) readIds = JSON.parse(stored);
        } catch {}

        if (location.pathname === '/student/announcements') {
          // If student is on announcements page, mark all as read
          const allIds = list.map((a) => a.id);
          try {
            localStorage.setItem(`read_announcements_${user?.id || 'guest'}`, JSON.stringify(allIds));
          } catch {}
          setUnreadCount(0);
        } else {
          const unread = list.filter((a) => !readIds.includes(a.id));
          setUnreadCount(unread.length);
        }
      })
      .catch(() => {
        if (isMounted) setUnreadCount(0);
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname, user?.id]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const navItems = [
    { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/attendance', label: 'My Attendance', icon: CalendarCheck },
    { to: '/student/timetable', label: 'Timetable', icon: Calendar },
    // { to: '/student/homework', label: 'Homework', icon: BookOpen }, // Merged with Assignments
    { to: '/student/assignments', label: 'Assignments', icon: FileCheck },
    { to: '/student/exams', label: 'Exams & Results', icon: GraduationCap },
    { to: '/student/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/student/leave-request', label: 'Leave Request', icon: FileText },
    { to: '/student/profile', label: 'Profile', icon: UserIcon },
  ];

  const handleLogout = () => {
    logout();
    nav('/login');
  };

  const studentName = user?.name || 'Rohan Sharma';
  const studentClass = user?.className && user?.sectionName 
    ? `${user.className} - Section ${user.sectionName}` 
    : 'Class 10 - Section A';
  const schoolName = user?.schoolName || 'AttendoSchool';

  const resolvedStudentName = user?.name?.trim() || 'Student';
  const resolvedSchoolName = user?.schoolName?.trim() || 'School';
  const resolvedLogoUrl = (user as any)?.photo_url || (user as any)?.photoUrl || '';

  return (
    <>
      {showWelcome && (
        <BrandedWelcomeLoader
          schoolName={resolvedSchoolName}
          userName={resolvedStudentName}
          subtitle="Student Portal · Secure Session"
          logoUrl={resolvedLogoUrl}
          onComplete={handleWelcomeComplete}
        />
      )}
      <div className="student-portal-root">
      {/* Mobile Backdrop */}
      {mobileNavOpen && (
        <div 
          className="student-mobile-backdrop"
          onClick={() => setMobileNavOpen(false)} 
        />
      )}

      {/* Left Sidebar */}
      <aside className={`student-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="student-sidebar-brand">
          <div className="student-logo-wrap" onClick={() => { setMobileNavOpen(false); nav('/student/dashboard'); }} style={{ cursor: 'pointer' }}>
            <img src="/attendo-school-logo.png" alt="AttendoSchool" className="student-brand-logo" />
            <span style={{ marginLeft: 8, fontWeight: 700, fontSize: 15, color: 'var(--text, #0F172A)' }}>AttendoSchool</span>
          </div>
          <button 
            type="button" 
            className="student-mobile-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMobileNavOpen(false);
            }}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="student-nav-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `student-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={18} className="student-nav-icon" />
                <span className="student-nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Motivational Card at Bottom */}
        <div className="student-motivation-card">
          <div className="student-motivation-emblem">📖</div>
          <h4 className="student-motivation-title">Learn Today, Lead Tomorrow</h4>
          <p className="student-motivation-desc">
            "Discipline today creates brighter tomorrows."
          </p>
        </div>

        <div className="student-sidebar-footer">
          <button type="button" onClick={handleLogout} className="student-logout-btn">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="student-main-wrapper">
        {/* Topbar */}
        <header className="student-topbar">
          <div className="student-topbar-left">
            <button
              type="button"
              className="student-hamburger-btn"
              onClick={() => setMobileNavOpen(prev => !prev)}
              aria-label="Toggle navigation menu"
            >
              <Menu size={20} />
            </button>
            <div className="student-search-bar">
              <Search size={16} className="student-search-icon" />
              <input
                type="text"
                placeholder="Search classes, subjects, announcements..."
                aria-label="Search"
              />
            </div>
          </div>

          <div className="student-topbar-right">
            {/* Institute Pill */}
            <div className="student-institute-pill">
              <Building2 size={15} className="student-inst-icon" />
              <span className="student-inst-name">{schoolName}</span>
              <ChevronDown size={14} className="student-inst-chevron" />
            </div>

            {/* Notification Bell */}
            <NavLink
              to="/student/announcements"
              className="student-topbar-icon-btn"
              aria-label="Notifications"
              title={unreadCount > 0 ? `${unreadCount} new notifications` : 'Notifications'}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="student-notification-badge">{unreadCount}</span>
              )}
            </NavLink>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              className="student-topbar-icon-btn"
              onClick={() => setDark(!dark)}
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Student Profile preview */}
            <div 
              className="profile-pill" 
              style={{ cursor: 'pointer' }} 
              onClick={() => nav('/student/profile')} 
              title="View My Profile"
            >
              <div className="user-avatar" style={{ background: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: 13, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute' }}>
                  {studentName ? studentName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'ST'}
                </span>
                {user?.avatarUrl && (
                  <img 
                    src={user.avatarUrl} 
                    alt={studentName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div className="profile-info">
                <span className="profile-name">{studentName}</span>
                <span className="profile-role">{studentClass || 'Student'}</span>
              </div>
              <button 
                type="button"
                className="header-icon-btn" 
                title="Sign out" 
                style={{ width: 28, height: 28, marginLeft: 4 }}
                onClick={(e) => { e.stopPropagation(); handleLogout(); }}
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="student-page-container">
          {children}
        </main>
      </div>
    </div>
  </>
);
}
