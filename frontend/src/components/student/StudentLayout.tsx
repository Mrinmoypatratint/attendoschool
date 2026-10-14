import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BrandedWelcomeLoader } from '../BrandedWelcomeLoader';
import { ErrorBoundary } from '../ErrorBoundary';
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
  ChevronDown,
  Globe,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../services/studentApi';
import { StudentSearchBar } from './StudentSearchBar';

interface StudentLayoutProps {
  children: React.ReactNode;
}

export function StudentLayout({ children }: StudentLayoutProps) {
  const { user, logout, updateUser } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dark, setDark] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [studentPhoto, setStudentPhoto] = useState<string | null>(
    (user as any)?.photoUrl || (user as any)?.photo_url || (user as any)?.avatarUrl || null
  );
  const [schoolPhoto, setSchoolPhoto] = useState<string | null>(
    (user as any)?.school_photo_url || (user as any)?.schoolPhotoUrl || null
  );
  const [schoolNameState, setSchoolNameState] = useState<string>(
    user?.schoolName || 'AttendoSchool'
  );
  const [schoolWebsite, setSchoolWebsite] = useState<string>(() => {
    return (
      (typeof window !== 'undefined' ? localStorage.getItem('attendo_school_website') : '') ||
      (user as any)?.schoolWebsite ||
      (user as any)?.school_website ||
      (user as any)?.website ||
      'https://davmodeldurgapur.org'
    );
  });

  useEffect(() => {
    studentApi.getProfile()
      .then((p) => {
        const photo = p?.photoUrl || p?.photo_url || null;
        if (photo) {
          setStudentPhoto(photo);
          updateUser({ photoUrl: photo, avatarUrl: photo, photo_url: photo });
        }
        if (p?.schoolPhotoUrl || p?.school_photo_url) {
          setSchoolPhoto(p.schoolPhotoUrl || p.school_photo_url || null);
        }
        if (p?.schoolName) {
          setSchoolNameState(p.schoolName);
        }
        const web = p?.schoolWebsite || (p as any)?.school_website || (p as any)?.website;
        if (web) {
          setSchoolWebsite(web);
          try {
            localStorage.setItem('attendo_school_website', web);
          } catch {}
        }
      })
      .catch(() => {});
    const handleProfileUpdated = (e: any) => {
      if (e.detail?.website !== undefined) {
        setSchoolWebsite(e.detail.website);
        if (e.detail.website) {
          try {
            localStorage.setItem('attendo_school_website', e.detail.website);
          } catch {}
          if (updateUser) {
            updateUser({ schoolWebsite: e.detail.website });
          }
        }
      }
      if (e.detail?.photo_url) {
        setSchoolPhoto(e.detail.photo_url);
      }
      if (e.detail?.name) {
        setSchoolNameState(e.detail.name);
      }
    };
    const handleStorageUpdated = (e: StorageEvent) => {
      if (e.key === 'attendo_school_website' && e.newValue) {
        setSchoolWebsite(e.newValue);
        if (updateUser) {
          updateUser({ schoolWebsite: e.newValue });
        }
      }
    };
    window.addEventListener('school-profile-updated', handleProfileUpdated);
    window.addEventListener('storage', handleStorageUpdated);
    return () => {
      window.removeEventListener('school-profile-updated', handleProfileUpdated);
      window.removeEventListener('storage', handleStorageUpdated);
    };
  }, [updateUser]);

  useEffect(() => {
    const currentPhoto = (user as any)?.photoUrl || (user as any)?.photo_url || (user as any)?.avatarUrl;
    if (currentPhoto) {
      setStudentPhoto(currentPhoto);
    }
  }, [user?.photoUrl, user?.photo_url, user?.avatarUrl]);

  useEffect(() => {
    const handlePhotoUpdated = (e: any) => {
      const url = e?.detail?.photoUrl;
      setStudentPhoto(url || null);
      if (url) {
        updateUser({ photoUrl: url, avatarUrl: url, photo_url: url });
      } else {
        updateUser({ photoUrl: undefined, avatarUrl: undefined, photo_url: undefined });
      }
    };
    window.addEventListener('student-photo-updated', handlePhotoUpdated);
    return () => window.removeEventListener('student-photo-updated', handlePhotoUpdated);
  }, [updateUser]);

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
  const schoolName = schoolNameState || user?.schoolName || 'AttendoSchool';
  const isDav =
    String(schoolName || '').toUpperCase().includes('DAV') ||
    String((user as any)?.schoolCode || '').includes('15582') ||
    String((user as any)?.email || '').toLowerCase().includes('@dav.') ||
    (user as any)?.schoolId === '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3';
  const displaySchoolName = isDav ? 'DAV MODEL SCHOOL' : schoolName;
  const displaySchoolCode = isDav ? '15582' : ((user as any)?.schoolCode || (user as any)?.school_code || '15582');
  const displaySchoolPhoto = schoolPhoto || (isDav ? '/dav-logo.png' : '/attendo-school-logo.png');

  const normalizeWebsiteUrl = (url?: string | null) => {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const rawWebsite =
    schoolWebsite ||
    (typeof window !== 'undefined' ? localStorage.getItem('attendo_school_website') : '') ||
    (user as any)?.schoolWebsite ||
    (user as any)?.school_website ||
    (user as any)?.website ||
    (isDav ? 'https://davmodeldurgapur.org' : '');

  const targetWebsiteUrl = normalizeWebsiteUrl(rawWebsite);

  const handleOpenSchoolWebsite = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (targetWebsiteUrl) {
      window.open(targetWebsiteUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const resolvedStudentName = user?.name?.trim() || 'Student';
  const resolvedSchoolName = isDav ? 'DAV MODEL SCHOOL' : (user?.schoolName?.trim() || 'School');
  const resolvedLogoUrl = displaySchoolPhoto;

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
        <div className="student-sidebar-brand" style={{ padding: '16px 16px 14px' }}>
          <div 
            className="student-logo-wrap" 
            onClick={() => { 
              setMobileNavOpen(false); 
              handleOpenSchoolWebsite(); 
            }} 
            title={targetWebsiteUrl ? `Visit Official School Website: ${targetWebsiteUrl}` : displaySchoolName}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12, 
              minWidth: 0 
            }}
          >
            <div className="school-crest" style={{ width: 44, height: 44, borderRadius: 12, background: '#ffffff', border: '1px solid rgba(226, 232, 240, 0.85)', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0, overflow: 'hidden' }}>
              <img
                src={displaySchoolPhoto}
                alt={displaySchoolName}
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallback = isDav ? '/dav-logo.png' : '/attendo-school-logo.png';
                  if (target.src !== fallback && !target.src.endsWith(fallback)) {
                    target.src = fallback;
                  }
                }}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className="school-name" style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displaySchoolName}</span>
              <span className="school-meta" style={{ fontSize: 12, color: '#4b6b94', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, whiteSpace: 'nowrap' }}>Code: {displaySchoolCode} · Affiliated</span>
            </div>
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
            <StudentSearchBar />
          </div>

          <div className="student-topbar-right">
            {/* Institute Pill */}
            <div 
              className="student-institute-pill" 
              onClick={handleOpenSchoolWebsite}
              title={targetWebsiteUrl ? `Official School Website: ${targetWebsiteUrl}` : schoolName}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: targetWebsiteUrl ? 'pointer' : 'default' }}
            >
              {schoolPhoto ? (
                <img
                  src={schoolPhoto}
                  alt={schoolName}
                  style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <Building2 size={15} className="student-inst-icon" />
              )}
              <span className="student-inst-name">{schoolName}</span>
              {schoolWebsite ? (
                <ExternalLink size={12} style={{ color: '#2563eb', opacity: 0.8 }} />
              ) : (
                <ChevronDown size={14} className="student-inst-chevron" />
              )}
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
              <div className="user-avatar" style={{ background: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: 13, overflow: 'hidden', position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ position: 'absolute' }}>
                  {studentName ? studentName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'ST'}
                </span>
                {(studentPhoto || user?.avatarUrl || user?.photoUrl || user?.photo_url) && (
                  <img 
                    src={studentPhoto || user?.avatarUrl || user?.photoUrl || user?.photo_url} 
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
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  </>
);
}
