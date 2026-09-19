import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const navItems = [
    { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/attendance', label: 'My Attendance', icon: CalendarCheck },
    { to: '/student/timetable', label: 'Timetable', icon: Calendar },
    { to: '/student/homework', label: 'Homework', icon: BookOpen },
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
  const schoolName = user?.schoolName || 'Greenwood International School';

  return (
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
          <div className="student-logo-wrap">
            <img src="/attendo-school-logo.png" alt="AttendoSchool" className="student-brand-logo" />
          </div>
          <button 
            type="button" 
            className="student-mobile-close-btn"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
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
              onClick={() => setMobileNavOpen(true)}
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
            <NavLink to="/student/announcements" className="student-topbar-icon-btn" aria-label="Notifications">
              <Bell size={18} />
              <span className="student-notification-badge">3</span>
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
            <NavLink to="/student/profile" className="student-topbar-profile">
              <div className="student-avatar-wrap">
                <img 
                  src={user?.avatarUrl || '/educational_student_campus.jpg'} 
                  alt={studentName}
                  className="student-avatar-img"
                  onError={(e) => {
                    // Fallback to initials
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="student-avatar-fallback">{studentName.charAt(0)}</span>
              </div>
              <div className="student-profile-info">
                <span className="student-profile-name">{studentName}</span>
                <span className="student-profile-meta">{studentClass}</span>
              </div>
            </NavLink>
          </div>
        </header>

        {/* Page Content */}
        <main className="student-page-container">
          {children}
        </main>
      </div>
    </div>
  );
}
