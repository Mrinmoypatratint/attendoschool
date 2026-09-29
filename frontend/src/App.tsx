import {useEffect,useState,useRef,useCallback} from 'react';
import type {ReactNode} from 'react';
import {Navigate,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import {api, API_BASE_URL} from './api';
import {useAuth,Guard,RoleGuard} from './hooks/useAuth';
import AttendanceReports from './pages/admin/AttendanceReports';
import AttendanceCorrections from './pages/admin/AttendanceCorrections';
import PeopleManagement from './pages/admin/PeopleManagement';
import AcademicYears from './pages/admin/AcademicYears';
import StudentPromotion from './pages/admin/StudentPromotion';
import Permissions from './pages/admin/Permissions';
import SubscriptionEnforcement from './pages/admin/SubscriptionEnforcement';
import Security from './pages/admin/Security';
import Backup from './pages/admin/Backup';
import Timetable from './pages/admin/Timetable';
import OfflineAttendance from './pages/admin/OfflineAttendance';
import Analytics from './pages/admin/Analytics';
import Communication from './pages/admin/Communication';
import ParentCommunication from './pages/admin/ParentCommunication';
import ParentPortal from './pages/parent/ParentPortal';
import { SuperAdminModule } from './super-admin/SuperAdminModule';
import ResetPassword from './pages/auth/ResetPassword';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Layers, LogOut, Plus,
  CalendarDays, ClipboardCheck, School, CheckCircle2, MessageSquare, BarChart3,
  FileText, Shield, Database, Clock, Wifi, UserPlus, Settings, Moon, Sun,
  ArrowUpDown, Bell, CreditCard, Eye, FileSpreadsheet, Download, Trash2,
  UploadCloud, CheckSquare, Square, RefreshCw, Send, ShieldCheck, Mail, Server,
  Search, Sparkles, ArrowRight, Activity, Zap, EyeOff, ArrowLeft, Building2,
  Menu, ChevronDown, Calendar, Globe, Lock, AlertTriangle, Pencil, HelpCircle, Check, AlertCircle, KeyRound, X, Loader2,
  History as HistoryIcon, DoorOpen, UserCheck, UserX, Info
} from 'lucide-react';
import { studentApi, Institute } from './services/studentApi';
import { StudentLayout } from './components/student/StudentLayout';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentAttendance } from './pages/student/StudentAttendance';
import { StudentTimetable } from './pages/student/StudentTimetable';
import { StudentAssignments } from './pages/student/StudentAssignments';
import { StudentExams } from './pages/student/StudentExams';
import { StudentAnnouncements } from './pages/student/StudentAnnouncements';
import { StudentLeaveRequest } from './pages/student/StudentLeaveRequest';
import { StudentProfile } from './pages/student/StudentProfile';
import { ThreeDBackground } from './components/ThreeDBackground';
import { HandwritingQuoteTyping } from './components/HandwritingQuoteTyping';

const fmt=(t:string)=>t?.slice(0,5)||'';
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/* ────── Dark Mode ────── */
function useTheme(){
  const [dark,setDark]=useState(()=>{
    const saved=localStorage.getItem('theme');
    if(saved) return saved==='dark';
    return false;
  });
  useEffect(()=>{
    document.documentElement.setAttribute('data-theme',dark?'dark':'light');
    localStorage.setItem('theme',dark?'dark':'light');
  },[dark]);
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme') {
        setDark(e.newValue === 'dark');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  return {dark,toggle:()=>setDark(d=>!d)};
}

function AttendoEmblem({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6 10C12 10 18 8 24 6V36C18 38 12 40 6 40V10Z" fill="url(#heroBookL)" />
      <path d="M42 10C36 10 30 8 24 6V36C30 38 36 40 42 40V10Z" fill="url(#heroBookR)" />
      <path d="M24 6V36" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.4" />
      <circle cx="24" cy="14" r="3.5" fill="#f59e0b" />
      <path d="M19 28L23 32L30 22" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="heroBookL" x1="6" y1="6" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="heroBookR" x1="42" y1="6" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function GoogleGLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.37 7.33 24 12 24z"/>
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.63 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
    </svg>
  );
}

type LoginOption = 'ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT';

interface LoginRoleConfig {
  title: string;
  roleName: string;
  roleSub: string;
  bannerTitle: string;
  bannerText: string;
  needsSchool: boolean;
  emailLabel: string;
  emailPlaceholder: string;
  defaultEmail: string;
  icon: any;
  color: string;
}

const LOGIN_ROLES: Record<LoginOption, LoginRoleConfig> = {
  ADMIN: {
    title: 'Administrator Login',
    roleName: 'Administrator',
    roleSub: 'Platform',
    bannerTitle: 'Platform Administrator',
    bannerText: 'Sign in with your platform administrator credentials to access the central management portal.',
    needsSchool: false,
    emailLabel: 'Email Address',
    emailPlaceholder: 'superadmin@attendance.local',
    defaultEmail: 'superadmin@attendance.local',
    icon: Building2,
    color: '#2563eb'
  },
  SCHOOL_ADMIN: {
    title: 'School Admin Login',
    roleName: 'School Admin',
    roleSub: 'Manage school',
    bannerTitle: 'School Administrator',
    bannerText: 'Select your affiliated institution and enter your administrative credentials.',
    needsSchool: true,
    emailLabel: 'Email Address',
    emailPlaceholder: 'admin@demo-school.local',
    defaultEmail: 'admin@demo-school.local',
    icon: School,
    color: '#059669'
  },
  TEACHER: {
    title: 'Teacher Login',
    roleName: 'Teacher',
    roleSub: 'Manage classes',
    bannerTitle: 'Teacher Portal',
    bannerText: 'Select your school to access class attendance, routines, and marks.',
    needsSchool: true,
    emailLabel: 'Teacher Email / Employee ID',
    emailPlaceholder: 'rahul@demo-school.local or EMP001',
    defaultEmail: 'rahul@demo-school.local',
    icon: GraduationCap,
    color: '#d97706'
  },
  STUDENT: {
    title: 'Student Login',
    roleName: 'Student',
    roleSub: 'Learning portal',
    bannerTitle: 'Student Portal',
    bannerText: 'Select your institute and enter your student ID or email to access timetable, assignments, and attendance.',
    needsSchool: true,
    emailLabel: 'Student ID / Email',
    emailPlaceholder: 'student@attendance.local or Roll No. 25',
    defaultEmail: 'student@greenwood.local',
    icon: BookOpen,
    color: '#7c3aed'
  }
};

/* ────── Login ────── */
function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const { dark, toggle } = useTheme();

  const [institutes, setInstitutes] = useState<Institute[]>(() => {
    try {
      const cached = localStorage.getItem('attendoschool_cached_institutes');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Discard legacy mock entries if any
          const clean = parsed.filter((x: any) => x && x.id && x.name && x.id !== 'sch-1789773642845' && x.id !== 'school-delhi-001' && x.id !== 'school-central-001');
          if (clean.length > 0) return clean;
        }
      }
    } catch {}
    return [];
  });
  const [institutesLoading, setInstitutesLoading] = useState(false);
  const [institutesError, setInstitutesError] = useState(false);
  const [selectedRole, setSelectedRole] = useState<LoginOption | null>(null);
  const [loginRole, setLoginRole] = useState<LoginOption>('SCHOOL_ADMIN');
  const [instituteId, setInstituteId] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('attendoschool_last_institute_id');
      if (cached && cached !== 'sch-1789773642845') return cached;
    } catch {}
    return '';
  });
  const [instituteSearch, setInstituteSearch] = useState('');
  const [instituteOpen, setInstituteOpen] = useState(false);
  const [email, setEmail] = useState('admin@demo-school.local');
  const [password, setPassword] = useState('ChangeMe123!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotNotice, setForgotNotice] = useState<{ type: 'success' | 'error'; message: string; resetUrl?: string } | null>(null);

  const instituteDropdownRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.location.hash.includes('session_expired=1') || window.location.search.includes('session_expired=1'))) {
      setError('Your session has expired. Please sign in again.');
    }
  }, []);

  const fetchInstitutes = useCallback(async (isRetry = false) => {
    setInstitutesLoading(true);
    setInstitutesError(false);
    try {
      const res = await api.get('/auth/institutes');
      const list = Array.isArray(res.data) ? res.data : (res.data?.institutes || res.data?.data || []);
      if (Array.isArray(list)) {
        const cleanList: Institute[] = list
          .filter((i: any) => i && (i.id || i._id) && i.name)
          .map((i: any) => ({
            id: String(i.id || i._id),
            name: String(i.name),
            code: String(i.code || 'SCH001'),
            address: String(i.address || '')
          }));

        setInstitutes(cleanList);
        try {
          localStorage.setItem('attendoschool_cached_institutes', JSON.stringify(cleanList));
        } catch {}

        // Preserve user selection if valid, otherwise select the first live school from Firestore
        setInstituteId(prev => {
          if (prev && cleanList.some(i => i.id === prev)) return prev;
          return cleanList.length > 0 ? cleanList[0].id : '';
        });
      }
    } catch (err) {
      console.warn('Institute fetch failed:', err);
      setInstitutesError(true);
      if (!isRetry) {
        setTimeout(() => fetchInstitutes(true), 3000);
      }
    } finally {
      setInstitutesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstitutes();
  }, [fetchInstitutes]);

  function selectInstitute(id: string) {
    setInstituteId(id);
    setInstituteOpen(false);
    try {
      localStorage.setItem('attendoschool_last_institute_id', id);
    } catch {}
  }

  // Close institute dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (instituteDropdownRef.current && !instituteDropdownRef.current.contains(event.target as Node)) {
        setInstituteOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentConfig = LOGIN_ROLES[loginRole];
  const selectedInstitute = institutes.find(i => i.id === instituteId);
  const filteredInstitutes = institutes.filter(i => 
    i.name.toLowerCase().includes(instituteSearch.toLowerCase()) ||
    (i.code && i.code.toLowerCase().includes(instituteSearch.toLowerCase())) ||
    (i.address && i.address.toLowerCase().includes(instituteSearch.toLowerCase()))
  );

  function handleSelectRole(role: LoginOption) {
    setSelectedRole(role);
    setLoginRole(role);
    setError('');
    const cfg = LOGIN_ROLES[role];
    setEmail(cfg.defaultEmail);
    setPassword('ChangeMe123!');
    if (cfg.needsSchool) {
      setInstituteId(prev => {
        if (prev && institutes.some(i => i.id === prev)) return prev;
        return institutes.length > 0 ? institutes[0].id : '';
      });
    } else {
      setInstituteId('');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (currentConfig.needsSchool && !instituteId) {
      setError('Please select your institute before signing in.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        email: email.trim(),
        password,
        role: loginRole
      };
      if (currentConfig.needsSchool && instituteId) {
        payload.instituteId = instituteId;
      }
      const { data } = await api.post('/auth/login', payload);
      login(data.token, data.user);
      if (data.user.role === 'STUDENT') {
        nav('/student/dashboard');
      } else if (data.user.role === 'SUPER_ADMIN') {
        nav('/super-admin');
      } else {
        nav('/dashboard');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Login failed. Please verify your role, school, and credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotNotice(null);
    try {
      const res = await api.post('/auth/request-password-reset', { email: forgotEmail.trim() });
      setForgotNotice({
        type: 'success',
        message: res.data.message || 'Password reset link dispatched to your email.',
        resetUrl: res.data.resetUrl
      });
    } catch (err: any) {
      setForgotNotice({
        type: 'error',
        message: err?.response?.data?.message || 'Could not send reset link. Please check your email address.'
      });
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="as-simple-page">
      {/* 3D Educational Dynamic Animated Background */}
      <ThreeDBackground dark={dark} />

      {/* Floating Top-Left Brand Logo */}
      <div className="as-top-left-brand">
        <img
          src="/attendo-school-logo.png"
          alt="AttendoSchool Logo"
          className="as-simple-logo-img"
        />
        <div className="as-brand-text-block">
          <h1 className="as-simple-brand-title">AttendoSchool</h1>
          <p className="as-simple-brand-tagline">Attendance Today — Brighter Tomorrow</p>
        </div>
      </div>

      {/* Centered Main Login Content: Left Handwriting Quote & Right Form */}
      <main className="as-simple-main">
        <div className="as-duo-login-container animate-fade-in">
          {/* LEFT SIDE: Dynamic Handwriting Typewriter Quote */}
          <div className="as-duo-left-pane">
            <HandwritingQuoteTyping />
          </div>

          {/* RIGHT SIDE: Interactive Role Selection & Authentication Card */}
          <div className="as-duo-right-pane">
            <div className="as-duo-form-header">
              <h2 className="as-form-title">
                {selectedRole ? LOGIN_ROLES[selectedRole].title : 'Portal Sign In'}
              </h2>
              <p className="as-form-subtitle">
                {selectedRole
                  ? 'Enter credentials to access your secure portal'
                  : 'Select your educational role to begin'}
              </p>
            </div>

            {/* Validation Error Banner */}
            {error && (
              <div className="as-error-banner" role="alert" style={{ marginBottom: 16 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

          {/* STEP 1: ONLY SHOW LOGIN TYPE (Administrator, School Admin, Teacher, Student) */}
          {selectedRole === null ? (
            <div className="as-simple-step1 animate-fade-in">
              <p className="as-simple-prompt-text">Select your login role to continue</p>

              <div className="as-simple-role-grid">
                {/* 1. Administrator */}
                <button
                  type="button"
                  className="as-simple-role-card"
                  onClick={() => handleSelectRole('ADMIN')}
                  id="role-select-admin"
                >
                  <div className="as-simple-role-icon role-admin">
                    <Building2 size={24} />
                  </div>
                  <div className="as-simple-role-info">
                    <span className="as-simple-role-title">Administrator</span>
                    <span className="as-simple-role-sub">Central Platform Admin</span>
                  </div>
                </button>

                {/* 2. School Admin */}
                <button
                  type="button"
                  className="as-simple-role-card"
                  onClick={() => handleSelectRole('SCHOOL_ADMIN')}
                  id="role-select-school-admin"
                >
                  <div className="as-simple-role-icon role-school-admin">
                    <School size={24} />
                  </div>
                  <div className="as-simple-role-info">
                    <span className="as-simple-role-title">School Admin</span>
                    <span className="as-simple-role-sub">Principal & Administration</span>
                  </div>
                </button>

                {/* 3. Teacher */}
                <button
                  type="button"
                  className="as-simple-role-card"
                  onClick={() => handleSelectRole('TEACHER')}
                  id="role-select-teacher"
                >
                  <div className="as-simple-role-icon role-teacher">
                    <GraduationCap size={24} />
                  </div>
                  <div className="as-simple-role-info">
                    <span className="as-simple-role-title">Teacher</span>
                    <span className="as-simple-role-sub">Faculty & Routine</span>
                  </div>
                </button>

                {/* 4. Student */}
                <button
                  type="button"
                  className="as-simple-role-card"
                  onClick={() => handleSelectRole('STUDENT')}
                  id="role-select-student"
                >
                  <div className="as-simple-role-icon role-student">
                    <BookOpen size={24} />
                  </div>
                  <div className="as-simple-role-info">
                    <span className="as-simple-role-title">Student</span>
                    <span className="as-simple-role-sub">Student & Guardian Portal</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: REQUIRED FIELDS SHOWN AFTER CHOOSING ROLE */
            <form className="as-simple-step2-form animate-fade-in" onSubmit={submit}>
              {/* Active Role Bar with Change Role Button */}
              <div className="as-simple-role-bar">
                <button
                  type="button"
                  className="as-simple-back-btn"
                  onClick={() => {
                    setSelectedRole(null);
                    setError('');
                  }}
                  title="Choose a different role"
                >
                  <ArrowLeft size={14} />
                  <span>Change Role</span>
                </button>

                <div className="as-simple-active-tag">
                  {loginRole === 'STUDENT' ? <BookOpen size={13} /> :
                   loginRole === 'TEACHER' ? <GraduationCap size={13} /> :
                   loginRole === 'SCHOOL_ADMIN' ? <School size={13} /> :
                   <Building2 size={13} />}
                  <span>{currentConfig.roleName}</span>
                </div>
              </div>

              {/* Quick Demo Auto-Fill Button */}
              <div className="as-simple-demo-row">
                <span className="as-simple-demo-label">⚡ Test Mode</span>
                <button
                  type="button"
                  className="as-simple-demo-btn"
                  onClick={() => {
                    const cfg = LOGIN_ROLES[loginRole];
                    setEmail(cfg.defaultEmail);
                    setPassword('ChangeMe123!');
                    if (cfg.needsSchool) {
                      setInstituteId(prev => {
                        if (prev && institutes.some(i => i.id === prev)) return prev;
                        return institutes.length > 0 ? institutes[0].id : '';
                      });
                    }
                  }}
                >
                  <Sparkles size={12} />
                  Auto-fill {currentConfig.roleName}
                </button>
              </div>

              {/* Institute Choose Option (REQUIRED for School Admin, Teacher, Student) */}
              {currentConfig.needsSchool && (
                <div className="as-simple-field" ref={instituteDropdownRef} style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="as-simple-label" style={{ margin: 0 }}>
                      Select Institute / School <span style={{ color: '#fb923c' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {institutesLoading ? (
                        <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <RefreshCw size={11} className="spin" /> Syncing...
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); fetchInstitutes(); }}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}
                          title="Refresh schools from server"
                        >
                          <RefreshCw size={10} />
                          <span>Refresh list</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`as-simple-select-trigger ${instituteOpen ? 'focused' : ''}`}
                    onClick={() => setInstituteOpen(o => !o)}
                    id="institute-trigger-btn"
                    aria-haspopup="listbox"
                    aria-expanded={instituteOpen}
                    title="Click to toggle institute selection"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', pointerEvents: 'none' }}>
                      <School size={16} style={{ color: '#fed7aa', flexShrink: 0 }} />
                      <div className="as-simple-inst-summary">
                        <span className="as-simple-inst-name">
                          {selectedInstitute?.name || (institutesLoading ? 'Connecting to Cloud Firestore...' : 'Choose your school...')}
                        </span>
                        {selectedInstitute && (
                          <span className="as-simple-inst-code">
                            Code: {selectedInstitute.code || 'SCH'} · {selectedInstitute.address || 'Main Campus'}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown size={14} className={`as-chevron ${instituteOpen ? 'rotated' : ''}`} style={{ pointerEvents: 'none' }} />
                  </button>

                  {/* Searchable Dropdown Popover */}
                  {instituteOpen && (
                    <div className="as-inst-popover-menu">
                      <div className="as-popover-search-wrap">
                        <div className="as-popover-search-box">
                          <Search size={14} className="as-popover-search-icon" />
                          <input
                            type="text"
                            placeholder="Search institute name or code..."
                            value={instituteSearch}
                            onChange={e => setInstituteSearch(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Escape') setInstituteOpen(false);
                            }}
                            autoFocus
                            className="as-popover-search-input"
                          />
                        </div>
                        <button
                          type="button"
                          className="as-popover-reload-btn"
                          onClick={(e) => { e.stopPropagation(); fetchInstitutes(); }}
                          title="Reload schools from server"
                        >
                          <RefreshCw size={11} className={institutesLoading ? 'spin' : ''} />
                          <span>Reload</span>
                        </button>
                      </div>
                      <div className="as-inst-popover-list" role="listbox">
                        {institutesLoading && institutes.length === 0 ? (
                          <div className="as-inst-empty">
                            <RefreshCw size={14} className="spin" style={{ margin: '0 auto 6px', display: 'block', color: '#60a5fa' }} />
                            <div>Connecting to Cloud Firestore...</div>
                          </div>
                        ) : filteredInstitutes.length === 0 ? (
                          <div className="as-inst-empty">
                            <div>{institutes.length === 0 ? 'No active schools found in database' : 'No institutes match your search'}</div>
                            <button
                              type="button"
                              onClick={() => { setInstituteSearch(''); fetchInstitutes(); }}
                              style={{ marginTop: 8, display: 'inline-block', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', fontWeight: 600 }}
                            >
                              {institutes.length === 0 ? 'Reload from Firestore' : 'Reset search'}
                            </button>
                          </div>
                        ) : (
                          filteredInstitutes.map(inst => (
                            <button
                              key={inst.id}
                              type="button"
                              role="option"
                              aria-selected={inst.id === instituteId}
                              className={`as-inst-option ${inst.id === instituteId ? 'selected' : ''}`}
                              onClick={() => selectInstitute(inst.id)}
                            >
                              <School size={15} className="as-inst-opt-icon" />
                              <div className="as-inst-option-text">
                                <div className="as-inst-option-title">{inst.name}</div>
                                <div className="as-inst-option-sub">{inst.address || 'Main Campus'}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <span className="as-inst-option-code">{inst.code || 'SCH'}</span>
                                {inst.id === instituteId && <Check size={14} style={{ color: '#2563eb' }} />}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Email Address Input */}
              <div className="as-simple-field">
                <label className="as-simple-label">
                  Email Address <span style={{ color: '#fb923c' }}>*</span>
                </label>
                <div className="as-simple-input-wrap">
                  <input
                    required
                    type="text"
                    placeholder="name@school.edu"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    id="identifier-input"
                    className="as-simple-input"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="as-simple-field">
                <label className="as-simple-label">
                  Password <span style={{ color: '#fb923c' }}>*</span>
                </label>
                <div className="as-simple-input-wrap">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    id="password-input"
                    className="as-simple-input"
                  />
                  <button
                    type="button"
                    className="as-simple-eye-btn"
                    onClick={() => setShowPassword(s => !s)}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Keep me logged in + Forgot password? */}
              <div className="as-simple-meta-row">
                <label className="as-simple-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="as-simple-checkbox"
                  />
                  <span>Keep me logged in</span>
                </label>
                <a
                  href="#forgot"
                  className="as-simple-forgot-link"
                  onClick={e => {
                    e.preventDefault();
                    setForgotEmail(email && email.includes('@') ? email : '');
                    setForgotNotice(null);
                    setForgotOpen(true);
                  }}
                >
                  Forgot password?
                </a>
              </div>

              {/* Sign In CTA Button */}
              <button
                type="submit"
                className="as-simple-submit-btn"
                disabled={loading}
                id="submit-auth-btn"
              >
                {loading ? (
                  <span>Signing in…</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
              {/* Bottom Help Link */}
              <div className="as-simple-help-tag">
                Need account assistance? <a href="#help" onClick={(e) => { e.preventDefault(); setShowHelp(true); }}>Get Help & Support</a>
              </div>
            </form>
          )}
          </div>
        </div>
      </main>

      {/* Help Modal */}
      {showHelp && (
        <Modal title="AttendoSchool Help & Support" close={() => setShowHelp(false)}>
          <div style={{ padding: '4px 0' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Need assistance signing in to your AttendoSchool portal? Use the guidelines below:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8 }}>
                <b>Administrator Login:</b> Global platform accounts do not require school selection. Sign in directly with your platform email and password.
              </div>
              <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8 }}>
                <b>School Admin & Faculty:</b> Select your affiliated school from the dropdown, then enter your assigned institutional email and password.
              </div>
              <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8 }}>
                <b>Student Portal:</b> Select your school and enter your Student ID, Admission Number, or Roll Number with your password.
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Helpdesk Email: <code>support@attendoschool.com</code> · Toll-Free: <code>1800-ATTENDO</code>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <Modal title="Reset Your Password" close={() => setForgotOpen(false)}>
          <div style={{ padding: '4px 0' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Enter your registered institutional email address (Student, Teacher, or School Admin). We will send you an official password setup link.
            </p>

            {forgotNotice && (
              <div style={{
                padding: '12px 14px',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                backgroundColor: forgotNotice.type === 'error' ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${forgotNotice.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
                color: forgotNotice.type === 'error' ? '#991b1b' : '#166534'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: forgotNotice.resetUrl ? 8 : 0 }}>
                  {forgotNotice.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{forgotNotice.message}</span>
                </div>
                {forgotNotice.resetUrl && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={forgotNotice.resetUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#1d4ed8',
                        fontWeight: 600,
                        textDecoration: 'underline'
                      }}
                    >
                      Open Password Reset Link Now <ArrowRight size={13} />
                    </a>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Registered Email Address
                <input
                  type="email"
                  required
                  placeholder="e.g. student@school.local or teacher@school.local"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: 14
                  }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {forgotLoading ? 'Sending link...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

    </div>
  );
}

/* ────── Super Admin Interactive Top Header ────── */
function SuperAdminHeader({
  user,
  logout,
  sidebarCollapsed,
  setSidebarCollapsed,
  setMobileSidebarOpen
}: {
  user: any;
  logout: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setMobileSidebarOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const nav = useNavigate();

  // 1. Search State
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ schools: any[]; students: any[]; invoices: any[] }>({
    schools: [],
    students: [],
    invoices: []
  });
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTab, setSearchTab] = useState<'ALL' | 'SCHOOLS' | 'STUDENTS' | 'INVOICES'>('ALL');
  const [detailItem, setDetailItem] = useState<any | null>(null);

  // 2. Notifications State
  const notifContainerRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  // 3. Academic Session State
  const sessionContainerRef = useRef<HTMLDivElement>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState(() => {
    return localStorage.getItem('attendo_academic_session') || '2025–26 Academic Session';
  });

  // Load Sessions from backend
  useEffect(() => {
    api.get('/academic-years')
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSessions(res.data);
          const active = res.data.find((s: any) => s.is_active);
          if (active && !localStorage.getItem('attendo_academic_session')) {
            setCurrentSession(active.name);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Load Notifications from backend
  const fetchNotifications = () => {
    api.get('/super-admin/notifications')
      .then(res => {
        if (res.data) {
          setNotifications(res.data.notifications || []);
          setUnreadCount(res.data.unreadCount || 0);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post('/super-admin/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const markOneRead = async (notif: any) => {
    try {
      if (!notif.read) {
        await api.post(`/super-admin/notifications/${notif.id}/read`);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setNotifOpen(false);
      if (notif.link) nav(notif.link);
    } catch {}
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ schools: [], students: [], invoices: [] });
      setSearchTotal(0);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      api.get(`/super-admin/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(res => {
          if (res.data) {
            setSearchResults(res.data.results || { schools: [], students: [], invoices: [] });
            setSearchTotal(res.data.total || 0);
          }
        })
        .catch(() => {})
        .finally(() => setIsSearching(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Global Ctrl+K & Click Outside
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
        setSessionOpen(false);
        setDetailItem(null);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (sessionContainerRef.current && !sessionContainerRef.current.contains(e.target as Node)) {
        setSessionOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const initials = (user.name || 'Company Super Admin')
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SA';

  const displayedNotifications = notifFilter === 'UNREAD'
    ? notifications.filter(n => !n.read)
    : notifications;

  return (
    <>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            className="header-icon-btn mobile-menu-btn"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => {
              if (window.innerWidth <= 1024 && setMobileSidebarOpen) {
                setMobileSidebarOpen(s => !s);
              } else {
                setSidebarCollapsed(s => !s);
              }
            }}
            style={{ border: '1px solid var(--border)', borderRadius: 8 }}
          >
            <Menu size={16} />
          </button>

          {/* Connected Global Search */}
          <div className="super-search-container" ref={searchContainerRef}>
            <div className="super-search-input-wrap">
              <Search size={15} style={{ color: 'var(--text-secondary)' }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search schools, students, invoices..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
              />
              {isSearching ? (
                <Loader2 size={14} className="animate-spin" style={{ opacity: 0.7 }} />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}
                >
                  <X size={13} />
                </button>
              ) : (
                <span className="super-search-kbd">Ctrl + K</span>
              )}
            </div>

            {searchOpen && searchQuery.trim() && (
              <div className="super-search-dropdown">
                <div className="super-search-tabs">
                  <button
                    type="button"
                    className={`super-search-tab-btn ${searchTab === 'ALL' ? 'active' : ''}`}
                    onClick={() => setSearchTab('ALL')}
                  >
                    All ({searchTotal})
                  </button>
                  <button
                    type="button"
                    className={`super-search-tab-btn ${searchTab === 'SCHOOLS' ? 'active' : ''}`}
                    onClick={() => setSearchTab('SCHOOLS')}
                  >
                    Schools ({searchResults.schools.length})
                  </button>
                  <button
                    type="button"
                    className={`super-search-tab-btn ${searchTab === 'STUDENTS' ? 'active' : ''}`}
                    onClick={() => setSearchTab('STUDENTS')}
                  >
                    Students ({searchResults.students.length})
                  </button>
                  <button
                    type="button"
                    className={`super-search-tab-btn ${searchTab === 'INVOICES' ? 'active' : ''}`}
                    onClick={() => setSearchTab('INVOICES')}
                  >
                    Invoices ({searchResults.invoices.length})
                  </button>
                </div>

                <div className="super-search-results-list">
                  {searchTotal === 0 && !isSearching ? (
                    <div className="super-search-empty">
                      <Search size={24} style={{ opacity: 0.4 }} />
                      <div>No results found for "<b>{searchQuery}</b>"</div>
                      <span style={{ fontSize: 11.5, opacity: 0.7 }}>Try searching by school name, student admission, or invoice ID</span>
                    </div>
                  ) : (
                    <>
                      {(searchTab === 'ALL' || searchTab === 'SCHOOLS') && searchResults.schools.length > 0 && (
                        <div>
                          <div className="super-search-group-header">
                            <span>Schools</span>
                            <span>{searchResults.schools.length}</span>
                          </div>
                          {searchResults.schools.map((item: any) => (
                            <button
                              type="button"
                              key={item.id}
                              className="super-search-item"
                              onClick={() => {
                                setDetailItem({ ...item, category: 'School' });
                                setSearchOpen(false);
                              }}
                            >
                              <div className="super-search-item-left">
                                <div className="super-search-icon icon-school">
                                  <School size={15} />
                                </div>
                                <div className="super-search-text">
                                  <span className="super-search-title">{item.title}</span>
                                  <span className="super-search-sub">{item.subtitle}</span>
                                </div>
                              </div>
                              <span className={`super-search-badge ${item.badge === 'ACTIVE' ? 'badge-active' : 'badge-expired'}`}>
                                {item.badge}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {(searchTab === 'ALL' || searchTab === 'STUDENTS') && searchResults.students.length > 0 && (
                        <div>
                          <div className="super-search-group-header" style={{ marginTop: 4 }}>
                            <span>Students</span>
                            <span>{searchResults.students.length}</span>
                          </div>
                          {searchResults.students.map((item: any) => (
                            <button
                              type="button"
                              key={item.id}
                              className="super-search-item"
                              onClick={() => {
                                setDetailItem({ ...item, category: 'Student' });
                                setSearchOpen(false);
                              }}
                            >
                              <div className="super-search-item-left">
                                <div className="super-search-icon icon-student">
                                  <GraduationCap size={15} />
                                </div>
                                <div className="super-search-text">
                                  <span className="super-search-title">{item.title}</span>
                                  <span className="super-search-sub">{item.subtitle}</span>
                                </div>
                              </div>
                              <span className="super-search-badge">
                                {item.badge}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {(searchTab === 'ALL' || searchTab === 'INVOICES') && searchResults.invoices.length > 0 && (
                        <div>
                          <div className="super-search-group-header" style={{ marginTop: 4 }}>
                            <span>Invoices & Subscriptions</span>
                            <span>{searchResults.invoices.length}</span>
                          </div>
                          {searchResults.invoices.map((item: any) => (
                            <button
                              type="button"
                              key={item.id}
                              className="super-search-item"
                              onClick={() => {
                                setDetailItem({ ...item, category: 'Invoice' });
                                setSearchOpen(false);
                              }}
                            >
                              <div className="super-search-item-left">
                                <div className="super-search-icon icon-invoice">
                                  <FileText size={15} />
                                </div>
                                <div className="super-search-text">
                                  <span className="super-search-title">{item.title}</span>
                                  <span className="super-search-sub">{item.subtitle}</span>
                                </div>
                              </div>
                              <span className="super-search-badge badge-active">
                                {item.badge}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="super-search-footer">
                  <span>Click any result to preview details</span>
                  <span>Esc to dismiss</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="header-right">
          {/* Connected Academic Session Selector */}
          <div className="super-session-wrap" ref={sessionContainerRef}>
            <div
              className="session-pill"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              onClick={() => setSessionOpen(s => !s)}
              title="Switch Academic Session"
            >
              <Calendar size={14} />
              <span>{currentSession}</span>
              <ChevronDown size={14} style={{ opacity: 0.7, transform: sessionOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </div>

            {sessionOpen && (
              <div className="super-session-dropdown">
                <div style={{ padding: '6px 10px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  Active Academic Session
                </div>
                {(sessions.length > 0 ? sessions : [
                  { id: 'ay-2024-25', name: '2024–25 Academic Session', is_active: false },
                  { id: 'ay-2025-26', name: '2025–26 Academic Session', is_active: true },
                  { id: 'ay-2026-27', name: '2026–27 Academic Session', is_active: false }
                ]).map((sess: any) => {
                  const isSelected = currentSession.includes(sess.code || sess.name);
                  return (
                    <button
                      type="button"
                      key={sess.id}
                      className={`super-session-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setCurrentSession(sess.name);
                        localStorage.setItem('attendo_academic_session', sess.name);
                        localStorage.setItem('attendo_active_academic_year', sess.name);
                        window.dispatchEvent(new CustomEvent('sessionChanged', { detail: sess.name }));
                        window.dispatchEvent(new Event('storage'));
                        setSessionOpen(false);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CalendarDays size={14} style={{ opacity: 0.7 }} />
                        <span>{sess.name}</span>
                      </div>
                      {isSelected && <Check size={14} style={{ color: '#2563eb' }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Connected Notification Bell & Popover */}
          <div className="super-notif-wrap" ref={notifContainerRef}>
            <button
              type="button"
              className="header-icon-btn"
              title="Notifications"
              onClick={() => setNotifOpen(s => !s)}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="header-badge-num">{unreadCount}</span>
              )}
            </button>

            {notifOpen && (
              <div className="super-notif-dropdown">
                <div className="super-notif-header">
                  <div className="super-notif-title-row">
                    <h4 className="super-notif-title">Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="super-notif-count-pill">{unreadCount} new</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button type="button" className="super-notif-readall-btn" onClick={markAllRead}>
                      <Check size={13} />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, padding: '8px 16px', background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    className={`super-search-tab-btn ${notifFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setNotifFilter('ALL')}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    type="button"
                    className={`super-search-tab-btn ${notifFilter === 'UNREAD' ? 'active' : ''}`}
                    onClick={() => setNotifFilter('UNREAD')}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>

                <div className="super-notif-list">
                  {displayedNotifications.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                      No {notifFilter === 'UNREAD' ? 'unread ' : ''}notifications.
                    </div>
                  ) : (
                    displayedNotifications.map((n: any) => (
                      <div
                        key={n.id}
                        className={`super-notif-item ${!n.read ? 'unread' : ''}`}
                        onClick={() => markOneRead(n)}
                      >
                        <div className={`super-notif-icon-wrap ${
                          n.category === 'SCHOOL' ? 'notif-school' :
                          n.category === 'SYSTEM' ? 'notif-system' :
                          n.category === 'BILLING' ? 'notif-billing' : 'notif-academic'
                        }`}>
                          {n.category === 'SCHOOL' ? <School size={16} /> :
                           n.category === 'SYSTEM' ? <Database size={16} /> :
                           n.category === 'BILLING' ? <CreditCard size={16} /> : <Calendar size={16} />}
                        </div>

                        <div className="super-notif-body">
                          <div className="super-notif-item-title">
                            <span>{n.title}</span>
                            <span className="super-notif-time">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="super-notif-msg">{n.message}</p>
                        </div>

                        {!n.read && <span className="super-notif-unread-dot"></span>}
                      </div>
                    ))
                  )}
                </div>

                <div className="super-notif-footer">
                  <button
                    type="button"
                    className="super-notif-viewall"
                    onClick={() => { setNotifOpen(false); nav('/notifications'); }}
                  >
                    View System Notification Logs →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Connected User Profile Pill */}
          <div className="profile-pill">
            <div className="user-avatar" style={{ background: '#1d4ed8', color: '#ffffff', fontWeight: 700, fontSize: 13 }}>
              {initials}
            </div>
            <div className="profile-info">
              <span className="profile-name">{user.name || 'Company Super Admin'}</span>
              <span className="profile-role">{user.email || 'superadmin@attendoschool.com'}</span>
            </div>
            <button
              type="button"
              className="header-icon-btn"
              title="Sign out"
              style={{ width: 28, height: 28, marginLeft: 2 }}
              onClick={(e) => { e.stopPropagation(); logout(); nav('/login'); }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Interactive Detail Modal for Search Results */}
      {detailItem && (
        <div className="super-modal-backdrop" onClick={() => setDetailItem(null)}>
          <div className="super-modal-card" onClick={e => e.stopPropagation()}>
            <div className="super-modal-header">
              <h3>
                {detailItem.category === 'School' && <School size={18} color="#2563eb" />}
                {detailItem.category === 'Student' && <GraduationCap size={18} color="#4f46e5" />}
                {detailItem.category === 'Invoice' && <FileText size={18} color="#d97706" />}
                <span>{detailItem.category} Details — {detailItem.title}</span>
              </h3>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="super-modal-body">
              {detailItem.category === 'Student' && (
                <div className="super-detail-grid">
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Full Name</span>
                    <span className="super-detail-value">{detailItem.meta?.fullName || detailItem.title}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Admission Number</span>
                    <span className="super-detail-value">{detailItem.meta?.admissionNumber || '—'}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Class & Section</span>
                    <span className="super-detail-value">Class {detailItem.meta?.className} - {detailItem.meta?.section}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Roll Number</span>
                    <span className="super-detail-value">#{detailItem.meta?.rollNumber || '25'}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Enrolled School</span>
                    <span className="super-detail-value" style={{ color: '#2563eb' }}>
                      {detailItem.meta?.schoolName || detailItem.meta?.school?.name || 'Institutional Campus'}
                    </span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Parent / Guardian</span>
                    <span className="super-detail-value">{detailItem.meta?.parentName || '—'}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Parent Phone</span>
                    <span className="super-detail-value">{detailItem.meta?.parentPhone || '—'}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Status</span>
                    <span className="super-search-badge badge-active" style={{ alignSelf: 'flex-start' }}>
                      {detailItem.meta?.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              )}

              {detailItem.category === 'School' && (
                <div className="super-detail-grid">
                  <div className="super-detail-cell">
                    <span className="super-detail-label">School Name</span>
                    <span className="super-detail-value">{detailItem.meta?.name || detailItem.title}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">School Code</span>
                    <span className="super-detail-value">{detailItem.meta?.code || '—'}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Address</span>
                    <span className="super-detail-value">{detailItem.meta?.address || 'Tech Park Boulevard'}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Phone</span>
                    <span className="super-detail-value">{detailItem.meta?.phone || detailItem.meta?.enquiry_number || '—'}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Admin Email</span>
                    <span className="super-detail-value">{detailItem.meta?.email || detailItem.meta?.admin_email || '—'}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Subscription Plan</span>
                    <span className="super-detail-value" style={{ color: '#16a34a' }}>
                      {detailItem.meta?.planName || 'Enterprise Plan'}
                    </span>
                  </div>
                </div>
              )}

              {detailItem.category === 'Invoice' && (
                <div className="super-detail-grid">
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Invoice Reference</span>
                    <span className="super-detail-value">{detailItem.meta?.number || detailItem.id}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Client School</span>
                    <span className="super-detail-value">{detailItem.meta?.school || 'Institution'}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Tier / Service</span>
                    <span className="super-detail-value">{detailItem.meta?.plan || 'Enterprise'}</span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Amount</span>
                    <span className="super-detail-value" style={{ color: '#16a34a', fontSize: 16 }}>
                      ₹{Number(detailItem.meta?.amount || 1999).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="super-detail-cell">
                    <span className="super-detail-label">Status</span>
                    <span className="super-search-badge badge-active" style={{ alignSelf: 'flex-start' }}>
                      {detailItem.meta?.status || 'PAID'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="super-modal-footer">
              <button
                type="button"
                className="small-btn"
                onClick={() => setDetailItem(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  const cat = detailItem.category;
                  setDetailItem(null);
                  if (cat === 'School') nav('/super-admin');
                  else if (cat === 'Student') nav('/people');
                  else nav('/payments');
                }}
              >
                Open in Management →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ────── Layout ────── */
function Layout({children}:{children:React.ReactNode}){
  const {user,logout}=useAuth();
  const nav=useNavigate();
  const loc=useLocation();
  const {dark,toggle}=useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [loc.pathname]);

  // ── Global Search State ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>({ students: [], teachers: [], classes: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<any>(null);

  // ── Academic Year Switcher State ──
  const [ayDropdownOpen, setAyDropdownOpen] = useState(false);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [ayLoading, setAyLoading] = useState(false);
  const [aySwitching, setAySwitching] = useState<string | null>(null);
  const ayDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.role === 'SCHOOL_ADMIN') {
      api.get('/dashboard/school').then(res => setSchoolInfo(res.data)).catch(() => {});
      loadAcademicYears();
    }
  }, [user?.role]);

  // Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setAyDropdownOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus search input when modal opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!searchOpen) {
      setSearchQuery('');
      setSearchResults({ students: [], teachers: [], classes: [] });
    }
  }, [searchOpen]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults({ students: [], teachers: [], classes: [] });
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data);
      } catch {
        setSearchResults({ students: [], teachers: [], classes: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  // Close AY dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ayDropdownRef.current && !ayDropdownRef.current.contains(e.target as Node)) {
        setAyDropdownOpen(false);
      }
    }
    if (ayDropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ayDropdownOpen]);

  // Load academic years when dropdown opens or on mount
  async function loadAcademicYears() {
    setAyLoading(true);
    try {
      const res = await api.get('/academic-years');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setAcademicYears(res.data);
        const active = res.data.find((ay: any) => ay.is_active);
        if (active) {
          setSchoolInfo((prev: any) => ({
            ...(prev || {}),
            activeAcademicYear: active
          }));
          localStorage.setItem('attendo_active_academic_year', active.name);
        }
      }
    } catch {
      setAcademicYears([]);
    } finally {
      setAyLoading(false);
    }
  }

  async function switchAcademicYear(yearId: string) {
    setAySwitching(yearId);

    // 1. Optimistically update local dropdown state immediately
    setAcademicYears(prev => prev.map(ay => ({
      ...ay,
      is_active: ay.id === yearId,
      is_archived: ay.id === yearId ? false : ay.is_archived
    })));

    // 2. Optimistically update schoolInfo header pill and persistence immediately
    const target = academicYears.find(ay => ay.id === yearId);
    if (target) {
      const activeObj = { ...target, is_active: true };
      setSchoolInfo((prev: any) => ({
        ...(prev || {}),
        activeAcademicYear: activeObj
      }));
      localStorage.setItem('attendo_active_academic_year', target.name);
      localStorage.setItem('attendo_academic_session', target.name);
    }

    try {
      // 3. Post to backend activation endpoint
      await api.post(`/academic-years/${yearId}/activate`);

      // 4. Re-fetch school dashboard and academic years
      const res = await api.get('/dashboard/school');
      if (res.data) {
        setSchoolInfo(res.data);
      }
      const refreshedYears = await api.get('/academic-years');
      if (Array.isArray(refreshedYears.data) && refreshedYears.data.length > 0) {
        setAcademicYears(refreshedYears.data);
      }
    } catch (err) {
      console.warn('Academic year activation sync warning:', err);
    } finally {
      setAySwitching(null);
      // Auto-close dropdown smoothly after a brief pause so user sees checkmark
      setTimeout(() => setAyDropdownOpen(false), 350);
    }
  }

  function handleSearchResultClick(result: any) {
    setSearchOpen(false);
    if (user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN') {
      if (result.type === 'student') nav('/students');
      else if (result.type === 'teacher') nav('/teachers');
      else if (result.type === 'class') nav('/classes');
    }
  }

  const hasAnyResults = searchResults.students.length > 0 || searchResults.teachers.length > 0 || searchResults.classes.length > 0;

  if(!user) return null;

  const adminLinks: any[] = [
    ['—', 'MAIN'],
    ['/dashboard', 'Dashboard', LayoutDashboard],
    ['/students', 'Students', Users],
    ['/teachers', 'Teachers', GraduationCap],
    ['/classes', 'Classes & Sections', Layers],
    ['/attendance-reports', 'Attendance', ClipboardCheck],
    ['/timetable', 'Timetable', CalendarDays],
    ['—', 'ACADEMICS'],
    ['/academic-years', 'Academic Years', Clock],
    ['/subjects', 'Subjects', BookOpen],
    ['/promotion', 'Student Promotions', ArrowUpDown],
    ['—', 'COMMUNICATION'],
    ['/communication', 'Announcements', MessageSquare],
    ['/notifications', 'Parent Communication', Bell],
    ['—', 'MANAGEMENT'],
    ['/attendance-corrections', 'Corrections', CheckCircle2],
    ['/analytics', 'Reports & Analytics', BarChart3],
    ['/people', 'People Directory', UserPlus],
    ['—', 'BILLING'],
    ['/subscription', 'Subscription', CreditCard],
    ['/invoices', 'Invoices', FileText],
    ['/payments', 'Payments', CreditCard],
    ['—', 'SETTINGS'],
    ['/school-profile', 'School Profile', Building2],
    ['/permissions', 'Permissions & Roles', ShieldCheck],
    ['/backups', 'Backups & Security', Database],
  ];

  const teacherLinks:any[]=[
    ['—','MAIN'],
    ['/dashboard','Dashboard',LayoutDashboard],
    ['/take-attendance','Take Attendance',ClipboardCheck],
    ['/teacher-history','History',CalendarDays],
    ['—','ATTENDANCE'],
    ['/attendance-reports','Reports',FileText],
    ['/attendance-corrections','Corrections',ArrowUpDown],
    ['/timetable','Timetable',CalendarDays],
    ['/offline-attendance','Offline Mode',Wifi],
  ];

  const superAdminLinks:any[]=[
    ['/super-admin','Overview',LayoutDashboard],
    ['/super-admin/schools','Schools',School],
    ['/super-admin/subscriptions','Subscriptions',CalendarDays],
    ['/super-admin/payments','Payments',CreditCard],
    ['/super-admin/invoices','Invoices',FileText],
    ['/super-admin/monitoring','Monitoring & System Health',Eye],
    ['/super-admin/reports','Reports',BarChart3],
    ['—','ADMINISTRATION'],
    ['/super-admin/people','People',Users],
    ['/super-admin/permissions','Roles & Permissions',ShieldCheck],
    ['/super-admin/security','Security',Shield],
    ['/super-admin/audit-logs','Audit Logs',FileSpreadsheet],
    ['/super-admin/backups','Backups',Database],
  ];

  const links=user.role==='SUPER_ADMIN'?superAdminLinks:
    user.role==='TEACHER'?teacherLinks:
    adminLinks;

  const currentSchoolName = schoolInfo?.school?.name || (user as any)?.schoolName || (user.role === 'SUPER_ADMIN' ? 'AttendoSchool' : 'School Administration');
  const currentSchoolCode = schoolInfo?.school?.code || (user as any)?.schoolCode || 'SCH';
  const storedSession = localStorage.getItem('attendo_active_academic_year') || localStorage.getItem('attendo_academic_session');
  const rawSessionName = schoolInfo?.activeAcademicYear?.name || storedSession || '2025–26';
  const activeSessionName = rawSessionName.replace(/ Academic Session| Session/gi, '').trim();

  return <div className="app-shell">
    {/* ── Mobile Sidebar Backdrop ── */}
    {mobileSidebarOpen && (
      <div
        className="sidebar-backdrop"
        onClick={() => setMobileSidebarOpen(false)}
        aria-label="Close navigation"
      />
    )}
    <aside className={`${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="school-crest" style={{ background: '#ffffff', border: '1px solid var(--border)', padding: 3, overflow: 'hidden' }}>
          <img src="/attendo-school-logo.png" alt="AttendoSchool" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }} />
        </div>
        <div className="school-info">
          <span className="school-name">{user.role==='SUPER_ADMIN'?'AttendoSchool':currentSchoolName}</span>
          <span className="school-meta">{user.role==='SUPER_ADMIN'?'Platform Administration':`Code: ${currentSchoolCode} · Affiliated`}</span>
        </div>
        <button
          type="button"
          className="sidebar-mobile-close-btn"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>
      <div className="sidebar-nav-container">
        <nav>
          {links.map(([p,l,I]:any,i:number)=>{
            if(p==='—') return <div className="sidebar-section-label" key={`s-${i}`}>{l}</div>;
            return <button key={`${p}-${l}`} className={loc.pathname===p?'nav-active':''} onClick={()=>{ setMobileSidebarOpen(false); nav(p); }}>
              <I size={16}/> <span>{l}</span>
            </button>;
          })}
        </nav>
      </div>
      {user.role === 'SUPER_ADMIN' && (
        <div className="sidebar-promo-card">
          <div className="sidebar-promo-badge">
            <GraduationCap size={20} color="#60a5fa" />
          </div>
          <div className="sidebar-promo-title">Smart Attendance</div>
          <div className="sidebar-promo-subtitle">Smarter Schools</div>
          <div className="sidebar-promo-desc">Empowering education through technology.</div>
        </div>
      )}
      <div className="sidebar-footer" style={user.role === 'SUPER_ADMIN' ? { borderTop: 'none', paddingTop: 0 } : {}}>
        {user.role === 'SUPER_ADMIN' ? (
          <>
            <div className="sidebar-darkmode-row">
              <div className="sidebar-darkmode-label">
                <Moon size={15} />
                <span>Dark Mode</span>
              </div>
              <label className="sidebar-toggle-switch">
                <input type="checkbox" checked={dark} onChange={toggle} />
                <span className="sidebar-slider"></span>
              </label>
            </div>
            <div className="sidebar-version-tag">AttendoSchool</div>
          </>
        ) : (
          <>
            <button className="theme-toggle" onClick={toggle} title={dark?'Light mode':'Dark mode'}>
              {dark?<Sun size={15}/>:<Moon size={15}/>} <span>{dark?'Light Mode':'Dark Mode'}</span>
            </button>
            <button className="logout" onClick={()=>{logout();nav('/login')}}>
              <LogOut size={15}/> <span>Sign out</span>
            </button>
          </>
        )}
      </div>
    </aside>
    <main>
      {user.role === 'SUPER_ADMIN' ? (
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              className="header-icon-btn mobile-menu-btn"
              title="Toggle menu"
              style={{ border: '1px solid var(--border)', borderRadius: 8 }}
              onClick={() => {
                if (window.innerWidth <= 1024) {
                  setMobileSidebarOpen(prev => !prev);
                } else {
                  setSidebarCollapsed(prev => !prev);
                }
              }}
            >
              <Menu size={16} />
            </button>
            <div className="header-search" style={{ width: 340 }} onClick={() => setSearchOpen(true)}>
              <Search size={15}/>
              <input placeholder="Search schools, students, invoices..." readOnly style={{ cursor: 'pointer' }} />
              <span className="header-kbd">Ctrl + K</span>
            </div>
          </div>
          <div className="header-right">
            <div className="session-pill" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <Calendar size={14} />
              <span>2025–26 Session</span>
              <ChevronDown size={14} style={{ opacity: 0.7 }} />
            </div>
            <button className="header-icon-btn" title="Notifications" onClick={()=>nav('/notifications')}>
              <Bell size={16}/>
              <span className="header-badge-num">3</span>
            </button>
            <div className="profile-pill">
              <div className="user-avatar" style={{ background: '#1d4ed8', color: '#ffffff', fontWeight: 700, fontSize: 13 }}>
                {user.name ? user.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase() : 'SA'}
              </div>
              <div className="profile-info">
                <span className="profile-name">{user.name || 'Company Super Admin'}</span>
                <span className="profile-role">{user.email || 'superadmin@attendoschool.com'}</span>
              </div>
              <button 
                className="header-icon-btn" 
                title="Sign out" 
                style={{ width: 28, height: 28, marginLeft: 2 }}
                onClick={(e) => { e.stopPropagation(); logout(); nav('/login'); }}
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </header>
      ) : user.role === 'SCHOOL_ADMIN' ? (
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              className="header-icon-btn mobile-menu-btn"
              title="Toggle menu"
              style={{ border: '1px solid var(--border)', borderRadius: 8 }}
              onClick={() => setMobileSidebarOpen(prev => !prev)}
            >
              <Menu size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div className="school-crest" style={{ width: 34, height: 34, background: '#ffffff', border: '1px solid var(--border)', padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <School size={20} color="#1d4ed8" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentSchoolName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Code: <b>{currentSchoolCode}</b> · AttendoSchool
                </div>
              </div>
            </div>
            <div className="header-search" style={{ marginLeft: 16, width: 300, cursor: 'pointer' }} onClick={() => setSearchOpen(true)}>
              <Search size={15}/>
              <input placeholder="Search students, teachers, classes..." readOnly style={{ cursor: 'pointer' }} />
              <span className="header-kbd">Ctrl + K</span>
            </div>
          </div>
          <div className="header-right">
            {/* Academic Year Switcher Dropdown */}
            <div className="ay-switcher-wrap" ref={ayDropdownRef} style={{ position: 'relative' }}>
              <div
                className="session-pill"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                onClick={() => { setAyDropdownOpen(prev => !prev); if (!ayDropdownOpen) loadAcademicYears(); }}
              >
                <Calendar size={14} color="#10b981" />
                <span>{activeSessionName} Session</span>
                <ChevronDown size={14} style={{ opacity: 0.7, transform: ayDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
              {ayDropdownOpen && (
                <div className="ay-dropdown">
                  <div className="ay-dropdown-header">
                    <span>Academic Sessions</span>
                    <button className="ay-manage-btn" onClick={() => { setAyDropdownOpen(false); nav('/academic-years'); }}>Manage</button>
                  </div>
                  {ayLoading ? (
                    <div className="ay-dropdown-loading"><RefreshCw size={14} className="spin" /> Loading sessions...</div>
                  ) : academicYears.length === 0 ? (
                    <div className="ay-dropdown-empty">No academic years found. <button onClick={() => { setAyDropdownOpen(false); nav('/academic-years'); }}>Create one</button></div>
                  ) : (
                    <div className="ay-dropdown-list">
                      {academicYears.map((ay: any) => {
                        const isActive = Boolean(ay.is_active || (activeSessionName && ay.name.includes(activeSessionName)));
                        return (
                          <div
                            key={ay.id}
                            className={`ay-dropdown-item ${isActive ? 'active' : ''} ${ay.is_archived ? 'archived' : ''}`}
                            onClick={() => { if (!isActive && !ay.is_archived) switchAcademicYear(ay.id); }}
                          >
                            <div className="ay-item-info">
                              <span className="ay-item-name">{ay.name}</span>
                              <span className="ay-item-dates">
                                {String(ay.start_date).slice(0, 10)} → {String(ay.end_date).slice(0, 10)}
                              </span>
                            </div>
                            <div className="ay-item-status">
                              {aySwitching === ay.id ? (
                                <RefreshCw size={12} className="spin" />
                              ) : isActive ? (
                                <span className="ay-active-badge"><Check size={10} /> Active</span>
                              ) : ay.is_archived ? (
                                <span className="ay-archived-badge">Archived</span>
                              ) : (
                                <button className="ay-switch-btn" onClick={(e) => { e.stopPropagation(); switchAcademicYear(ay.id); }}>Switch</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button className="header-icon-btn" title="Announcements & Notifications" onClick={()=>nav('/notifications')}>
              <Bell size={16}/>
              {(schoolInfo?.pendingCorrectionsCount > 0) && (
                <span className="header-badge-num">{schoolInfo.pendingCorrectionsCount}</span>
              )}
            </button>
            <button className="header-icon-btn" onClick={toggle} title={dark?'Light mode':'Dark mode'}>
              {dark?<Sun size={16}/>:<Moon size={16}/>}
            </button>
            <div className="profile-pill" style={{ cursor: 'pointer' }} onClick={()=>nav('/school-profile')}>
              <div className="user-avatar" style={{ background: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: 13 }}>
                {user.name ? user.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase() : 'SA'}
              </div>
              <div className="profile-info">
                <span className="profile-name">{user.name}</span>
                <span className="profile-role">School Admin</span>
              </div>
              <button 
                className="header-icon-btn" 
                title="Sign out" 
                style={{ width: 28, height: 28, marginLeft: 4 }}
                onClick={(e) => { e.stopPropagation(); logout(); nav('/login'); }}
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </header>
      ) : (
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              className="header-icon-btn mobile-menu-btn"
              title="Toggle menu"
              style={{ border: '1px solid var(--border)', borderRadius: 8 }}
              onClick={() => setMobileSidebarOpen(prev => !prev)}
            >
              <Menu size={18} />
            </button>
            <div className="header-meta" style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src="/attendo-school-logo.png" alt="AttendoSchool" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
                <p className="eyebrow" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>ATTENDOSCHOOL · {user.role.replace(/_/g,' ')}</p>
              </div>
              <h2 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 18 }}>{user.name}</h2>
            </div>
          </div>
          <div className="header-search" onClick={() => setSearchOpen(true)} style={{ cursor: 'pointer' }}>
            <Search size={15}/>
            <input placeholder="Search records, classes..." readOnly style={{ cursor: 'pointer' }} />
            <span className="header-kbd">⌘K</span>
          </div>
          <div className="header-right">
            <div className="session-pill">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
              2025–26 ACADEMIC SESSION
            </div>
            <button className="header-icon-btn" title="Notifications" onClick={()=>nav(user.role==='TEACHER'?'/teacher-history':'/notifications')}>
              <Bell size={16}/>
              <span className="header-badge-dot"></span>
            </button>
            <button className="header-icon-btn" onClick={toggle} title={dark?'Light mode':'Dark mode'}>
              {dark?<Sun size={16}/>:<Moon size={16}/>}
            </button>
            <div className="profile-pill">
              <div className="user-avatar">
                {user.name ? user.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase() : 'SA'}
              </div>
              <div className="profile-info">
                <span className="profile-name">{user.name}</span>
                <span className="profile-role">{user.email}</span>
              </div>
            </div>
          </div>
        </header>
      )}
      {/* ── Global Search Command Palette ── */}
      {searchOpen && (
        <div className="search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-palette" onClick={(e) => e.stopPropagation()}>
            <div className="search-palette-header">
              <Search size={18} color="var(--text-muted)" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search students, teachers, classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-palette-input"
              />
              <kbd className="search-palette-esc">ESC</kbd>
            </div>

            <div className="search-palette-body">
              {searchQuery.length < 2 ? (
                <div className="search-palette-hint">
                  <div className="search-hint-section">
                    <span className="search-hint-title">Quick Navigation</span>
                    <div className="search-hint-items">
                      {(user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN') && (
                        <button onClick={() => { setSearchOpen(false); nav('/students'); }}>
                          <Users size={14} /> <span>Students</span>
                        </button>
                      )}
                      {(user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN') && (
                        <button onClick={() => { setSearchOpen(false); nav('/teachers'); }}>
                          <GraduationCap size={14} /> <span>Teachers</span>
                        </button>
                      )}
                      {(user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN') && (
                        <button onClick={() => { setSearchOpen(false); nav('/classes'); }}>
                          <Layers size={14} /> <span>Classes</span>
                        </button>
                      )}
                      <button onClick={() => { setSearchOpen(false); nav(user.role === 'TEACHER' ? '/take-attendance' : '/attendance-reports'); }}>
                        <ClipboardCheck size={14} /> <span>Attendance</span>
                      </button>
                      <button onClick={() => { setSearchOpen(false); nav('/timetable'); }}>
                        <CalendarDays size={14} /> <span>Timetable</span>
                      </button>
                      <button onClick={() => { setSearchOpen(false); nav('/analytics'); }}>
                        <BarChart3 size={14} /> <span>Analytics</span>
                      </button>
                    </div>
                  </div>
                  <p className="search-hint-tip">Type at least 2 characters to search</p>
                </div>
              ) : searchLoading ? (
                <div className="search-palette-loading">
                  <RefreshCw size={16} className="spin" />
                  <span>Searching...</span>
                </div>
              ) : !hasAnyResults ? (
                <div className="search-palette-empty">
                  <Search size={28} color="var(--text-muted)" />
                  <p>No results found for "<strong>{searchQuery}</strong>"</p>
                  <span>Try different keywords or check for typos</span>
                </div>
              ) : (
                <>
                  {searchResults.students.length > 0 && (
                    <div className="search-result-group">
                      <div className="search-result-label"><Users size={13} /> Students ({searchResults.students.length})</div>
                      {searchResults.students.map((s: any) => (
                        <div key={s.id} className="search-result-item" onClick={() => handleSearchResultClick(s)}>
                          <div className="search-result-avatar student">{s.name?.[0]?.toUpperCase() || 'S'}</div>
                          <div className="search-result-info">
                            <span className="search-result-name">{s.name}</span>
                            <span className="search-result-meta">
                              Roll: {s.roll} · {s.class || 'Unassigned'}{s.section ? ` - ${s.section}` : ''} · {s.email}
                            </span>
                          </div>
                          <ArrowRight size={14} color="var(--text-muted)" />
                        </div>
                      ))}
                    </div>
                  )}
                  {searchResults.teachers.length > 0 && (
                    <div className="search-result-group">
                      <div className="search-result-label"><GraduationCap size={13} /> Teachers ({searchResults.teachers.length})</div>
                      {searchResults.teachers.map((t: any) => (
                        <div key={t.id} className="search-result-item" onClick={() => handleSearchResultClick(t)}>
                          <div className="search-result-avatar teacher">{t.name?.[0]?.toUpperCase() || 'T'}</div>
                          <div className="search-result-info">
                            <span className="search-result-name">{t.name}</span>
                            <span className="search-result-meta">{t.email}</span>
                          </div>
                          <ArrowRight size={14} color="var(--text-muted)" />
                        </div>
                      ))}
                    </div>
                  )}
                  {searchResults.classes.length > 0 && (
                    <div className="search-result-group">
                      <div className="search-result-label"><Layers size={13} /> Classes ({searchResults.classes.length})</div>
                      {searchResults.classes.map((c: any) => (
                        <div key={c.id} className="search-result-item" onClick={() => handleSearchResultClick(c)}>
                          <div className="search-result-avatar class">C</div>
                          <div className="search-result-info">
                            <span className="search-result-name">{c.name}</span>
                            <span className="search-result-meta">{c.sections} section(s)</span>
                          </div>
                          <ArrowRight size={14} color="var(--text-muted)" />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="search-palette-footer">
              <span><kbd>↑↓</kbd> Navigate</span>
              <span><kbd>↵</kbd> Open</span>
              <span><kbd>ESC</kbd> Close</span>
            </div>
          </div>
        </div>
      )}
      {children}
    </main>
  </div>
}

/* ────── Shared Components ────── */
function Stat({label,value,trend,sub}:{label:string;value:any;trend?:string;sub?:string}){
  return <div className="stat">
    <span>{label}</span>
    <strong>{value}</strong>
    {(trend || sub) && (
      <div className="stat-sub">
        {trend && (
          <span className={`stat-trend ${trend.startsWith('-') || trend.toLowerCase().includes('expired') || trend.toLowerCase().includes('failed') ? 'negative' : 'positive'}`}>
            {trend.startsWith('+') ? '↑ ' : trend.startsWith('-') ? '↓ ' : ''}{trend}
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    )}
  </div>
}
function PageHead({title,sub,button,onClick}:{title:string;sub:string;button?:string;onClick?:()=>void}){return <div className="page-head"><div><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><img src="/attendo-school-logo.png" alt="AttendoSchool" style={{width:18,height:18,borderRadius:4,objectFit:'contain'}}/><p className="eyebrow" style={{margin:0}}>{title.includes('Admin')?'ATTENDOSCHOOL SUPER ADMIN':'ATTENDOSCHOOL ADMIN'}</p></div><h1>{title}</h1><p className="muted">{sub}</p></div>{button&&<button onClick={onClick}><Plus size={16}/>{button}</button>}</div>}
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){return <div className="overlay"><div className="modal"><div className="modal-head"><h3>{title}</h3><button className="close" onClick={close}>×</button></div>{children}</div></div>}

/* ────── Dashboard ────── */
function Dashboard(){const {user}=useAuth();if(!user)return null;if(user.role==='STUDENT')return <Navigate to="/student/dashboard" replace/>;return user.role==='SUPER_ADMIN'?<SuperAdminHome/>:user.role==='TEACHER'?<TeacherHome/>:<AdminHome/>}

function AdminHome(){
  const {user}=useAuth();
  const nav=useNavigate();
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [simulating,setSimulating]=useState(false);

  async function load(){
    setLoading(true);
    try {
      const res = await api.get('/dashboard/school');
      setData(res.data);
    } catch (e) {
      console.error('Failed to load school dashboard', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);

  async function quickDemoAttendance() {
    setSimulating(true);
    try {
      const [cRes, sRes] = await Promise.all([api.get('/classes'), api.get('/sections')]);
      const cls = cRes.data?.[0];
      const sec = (sRes.data || []).find((s:any)=>s.class_id === cls?.id) || sRes.data?.[0];
      if (cls && sec) {
        const studentsRes = await api.get(`/teacher/students/${cls.id}/${sec.id}`);
        const stList = studentsRes.data || [];
        const presentIds = stList.slice(0, Math.max(1, stList.length - 1)).map((s:any)=>s.id);
        await api.post('/teacher/attendance', {
          classId: cls.id,
          sectionId: sec.id,
          subjectId: null,
          startTime: '09:00:00',
          endTime: '09:45:00',
          attendanceDate: new Date().toISOString().slice(0, 10),
          presentStudentIds: presentIds
        });
        await load();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Quick attendance simulation completed');
      await load();
    } finally {
      setSimulating(false);
    }
  }

  const school = data?.school;
  const todayAtt = data?.todayAttendance || { total: 0, present: 0, absent: 0, percentage: 0, classBreakdown: [] };
  const sub = data?.subscription;
  const pendingCorrections = data?.pendingCorrectionsCount || 0;
  const weeklyTrend = data?.weeklyTrend || [
    { day: 'Mon', percentage: 94.2, present: 14, absent: 1, total: 15, isToday: false },
    { day: 'Tue', percentage: 93.3, present: 14, absent: 1, total: 15, isToday: false },
    { day: 'Wed', percentage: 96.0, present: 15, absent: 0, total: 15, isToday: false },
    { day: 'Thu', percentage: 91.8, present: 13, absent: 2, total: 15, isToday: false },
    { day: 'Fri', percentage: todayAtt.percentage > 0 ? todayAtt.percentage : 93.5, present: todayAtt.present > 0 ? todayAtt.present : 14, absent: todayAtt.absent > 0 ? todayAtt.absent : 1, total: todayAtt.total > 0 ? todayAtt.total : 15, isToday: true }
  ];
  const todaySchedule = data?.todaySchedule || [];
  const recentActivity = data?.recentActivity || [];

  return <Layout>
    {/* Institutional Header Banner */}
    <div className="admin-dashboard-hero">
      <div className="hero-content">
        <div className="hero-eyebrow">
          <span className="live-indicator"></span>
          <span>Institutional Administration Portal</span>
          <span className="school-status-tag">{school?.status || 'ACTIVE'}</span>
        </div>
        <h1 className="hero-school-name">{school?.name || (user as any)?.schoolName || 'Institutional Campus'}</h1>
        <p className="hero-school-desc">
          Official attendance monitoring, student & faculty directories, curriculum setup, and timetable scheduling.
        </p>
        <div className="hero-meta-row">
          <span>🏛️ School Code: <b>{school?.code || (user as any)?.schoolCode || 'SCH'}</b></span>
          <span>📅 Session: <b>{data?.activeAcademicYear?.name || '2026-27'}</b></span>
          <span>📞 Enquiry: <b>{school?.enquiry_number || '1800-999-000'}</b></span>
          <span>🛡️ Plan: <b>{sub?.plan_name || 'Enterprise'}</b></span>
        </div>
      </div>
      <div className="hero-actions">
        <button className="action-btn-primary" onClick={() => nav('/take-attendance')}>
          <ClipboardCheck size={16} /> Take Today's Attendance
        </button>
        <button className="action-btn-secondary" onClick={() => nav('/students?enroll=true')}>
          <UserPlus size={16} /> Enroll Student
        </button>
        <button className="action-btn-secondary" onClick={() => nav('/communication')}>
          <MessageSquare size={16} /> Broadcast Notice
        </button>
      </div>
    </div>

    {/* Alert Banner if Pending Corrections */}
    {pendingCorrections > 0 && (
      <div className="admin-alert-banner warning">
        <div className="alert-left">
          <AlertTriangle size={20} color="#d97706" />
          <div>
            <strong>Attendance Correction Requests Pending Review</strong>
            <p>There are {pendingCorrections} attendance correction request(s) submitted by faculty waiting for administrative verification.</p>
          </div>
        </div>
        <button className="alert-action-btn" onClick={() => nav('/attendance-corrections')}>
          Review Corrections ({pendingCorrections}) →
        </button>
      </div>
    )}

    {/* 6 Top KPI Cards */}
    <div className="dashboard-kpi-grid">
      <div className="kpi-card" onClick={() => nav('/students')}>
        <div className="kpi-icon-wrap blue"><Users size={22} /></div>
        <div className="kpi-body">
          <span className="kpi-label">Enrolled Students</span>
          <strong className="kpi-value">{loading ? '...' : (data?.totalStudents ?? 0)}</strong>
          <span className="kpi-sub positive">Active registered records</span>
        </div>
      </div>

      <div className="kpi-card" onClick={() => nav('/teachers')}>
        <div className="kpi-icon-wrap indigo"><GraduationCap size={22} /></div>
        <div className="kpi-body">
          <span className="kpi-label">Active Faculty</span>
          <strong className="kpi-value">{loading ? '...' : (data?.totalTeachers ?? 0)}</strong>
          <span className="kpi-sub positive">Verified teachers</span>
        </div>
      </div>

      <div className="kpi-card" onClick={() => nav('/classes')}>
        <div className="kpi-icon-wrap teal"><Layers size={22} /></div>
        <div className="kpi-body">
          <span className="kpi-label">Academic Classes</span>
          <strong className="kpi-value">{loading ? '...' : (data?.totalClasses ?? 0)}</strong>
          <span className="kpi-sub neutral">{data?.totalSections ?? 0} active sections</span>
        </div>
      </div>

      <div className="kpi-card" onClick={() => nav('/attendance-reports')}>
        <div className="kpi-icon-wrap green"><ClipboardCheck size={22} /></div>
        <div className="kpi-body">
          <span className="kpi-label">Today's Attendance</span>
          <strong className="kpi-value">{loading ? '...' : `${todayAtt.percentage}%`}</strong>
          <span className="kpi-sub neutral">{todayAtt.present} Present · {todayAtt.absent} Absent</span>
        </div>
      </div>

      <div className="kpi-card" onClick={() => nav('/attendance-corrections')}>
        <div className={`kpi-icon-wrap ${pendingCorrections > 0 ? 'amber' : 'slate'}`}><ArrowUpDown size={22} /></div>
        <div className="kpi-body">
          <span className="kpi-label">Pending Corrections</span>
          <strong className="kpi-value">{loading ? '...' : pendingCorrections}</strong>
          <span className={`kpi-sub ${pendingCorrections > 0 ? 'negative' : 'positive'}`}>
            {pendingCorrections > 0 ? 'Requires attention' : 'All clear'}
          </span>
        </div>
      </div>

      <div className="kpi-card" onClick={() => nav('/subscription')}>
        <div className="kpi-icon-wrap purple"><CreditCard size={22} /></div>
        <div className="kpi-body">
          <span className="kpi-label">Subscription Tier</span>
          <strong className="kpi-value" style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>{sub?.plan_name || 'Enterprise'}</span>
            {sub?.discount_percentage > 0 && (
              <span style={{ fontSize: 11, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                {sub.discount_percentage}% OFF
              </span>
            )}
          </strong>
          <span className="kpi-sub neutral">{sub?.days_remaining ?? 365} days validity remaining</span>
        </div>
      </div>
    </div>

    {/* Attendance Overview & Quick Actions 2-Column Section */}
    <div className="dashboard-two-col">
      {/* Attendance Deep-Dive Card */}
      <div className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <h3>Today's Attendance Monitor</h3>
            <p className="panel-sub">Real-time attendance ratio and section distribution for today</p>
          </div>
          <button className="panel-header-btn" onClick={() => nav('/attendance-reports')}>
            View Detailed Reports →
          </button>
        </div>

        {todayAtt.total === 0 ? (
          <div className="empty-attendance-box">
            <CalendarDays size={36} color="var(--text-muted)" />
            <h4>No attendance recorded today yet</h4>
            <p>Faculty members can submit daily attendance sessions from their portal or the Quick Actions menu.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <button className="action-btn-primary small" onClick={() => nav('/take-attendance')}>
                <ClipboardCheck size={14} /> Take Attendance Now
              </button>
              <button 
                className="action-btn-secondary small" 
                onClick={quickDemoAttendance} 
                disabled={simulating}
              >
                {simulating ? <RefreshCw size={14} className="spin" /> : <ClipboardCheck size={14} color="#2563eb" />}
                <span>{simulating ? 'Recording...' : 'Sample Attendance Session'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="attendance-metric-bars">
              <div className="metric-stat">
                <span className="metric-label">Present</span>
                <span className="metric-num green">{todayAtt.present}</span>
              </div>
              <div className="metric-stat">
                <span className="metric-label">Absent</span>
                <span className="metric-num red">{todayAtt.absent}</span>
              </div>
              <div className="metric-stat">
                <span className="metric-label">Total Marked</span>
                <span className="metric-num">{todayAtt.total}</span>
              </div>
              <div className="metric-stat">
                <span className="metric-label">Overall Rate</span>
                <span className="metric-num blue">{todayAtt.percentage}%</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="attendance-progress-track">
              <div className="attendance-progress-fill" style={{ width: `${todayAtt.percentage}%` }}></div>
            </div>

            {/* Class Breakdown List */}
            {todayAtt.classBreakdown?.length > 0 && (
              <div className="class-breakdown-list">
                <h4 style={{ margin: '14px 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Class-Wise Performance</h4>
                <div className="breakdown-grid">
                  {todayAtt.classBreakdown.map((cb: any, i: number) => (
                    <div key={i} className="breakdown-item">
                      <div className="breakdown-info">
                        <strong>Class {cb.class_number} - Section {cb.section_name}</strong>
                        <span>{cb.present}/{cb.total} Present</span>
                      </div>
                      <span className={`breakdown-pct ${cb.percentage >= 90 ? 'high' : cb.percentage >= 75 ? 'med' : 'low'}`}>
                        {cb.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Operations & Resource Shortcuts */}
      <div className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <h3>Administrative Quick Actions</h3>
            <p className="panel-sub">Common workflows and daily operational controls</p>
          </div>
        </div>

        <div className="quick-actions-grid">
          <button className="quick-action-tile" onClick={() => nav('/students')}>
            <div className="tile-icon blue"><UserPlus size={18} /></div>
            <div className="tile-texts">
              <strong>Student Directory</strong>
              <span>Enroll, search, or bulk import Excel</span>
            </div>
          </button>

          <button className="quick-action-tile" onClick={() => nav('/teachers')}>
            <div className="tile-icon indigo"><GraduationCap size={18} /></div>
            <div className="tile-texts">
              <strong>Faculty Management</strong>
              <span>Add teachers & subject assignments</span>
            </div>
          </button>

          <button className="quick-action-tile" onClick={() => nav('/classes')}>
            <div className="tile-icon teal"><Layers size={18} /></div>
            <div className="tile-texts">
              <strong>Classes & Sections</strong>
              <span>Configure standards & divisions</span>
            </div>
          </button>

          <button className="quick-action-tile" onClick={() => nav('/timetable')}>
            <div className="tile-icon amber"><CalendarDays size={18} /></div>
            <div className="tile-texts">
              <strong>Timetable Routine</strong>
              <span>Manage daily periods & conflicts</span>
            </div>
          </button>

          <button className="quick-action-tile" onClick={() => nav('/attendance-corrections')}>
            <div className="tile-icon orange"><CheckCircle2 size={18} /></div>
            <div className="tile-texts">
              <strong>Review Corrections</strong>
              <span>Approve or reject faculty requests</span>
            </div>
          </button>

          <button className="quick-action-tile" onClick={() => nav('/communication')}>
            <div className="tile-icon purple"><MessageSquare size={18} /></div>
            <div className="tile-texts">
              <strong>Announcements</strong>
              <span>Broadcast notices to parents & staff</span>
            </div>
          </button>

          <button className="quick-action-tile" onClick={() => nav('/invoices')}>
            <div className="tile-icon green"><FileText size={18} /></div>
            <div className="tile-texts">
              <strong>Invoices & Receipts</strong>
              <span>Download official PDF tax invoices</span>
            </div>
          </button>

          <button className="quick-action-tile" onClick={() => nav('/school-profile')}>
            <div className="tile-icon slate"><Building2 size={18} /></div>
            <div className="tile-texts">
              <strong>School Profile</strong>
              <span>View & update institutional information</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    {/* Row 2: Weekly Trend & Schedule/Activity */}
    <div className="dashboard-two-col" style={{ marginTop: 24 }}>
      {/* Weekly Trend Panel */}
      <div className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <h3>Weekly Attendance Trend</h3>
            <p className="panel-sub">5-Day institutional ratio across all academic classes</p>
          </div>
          <button className="panel-header-btn" onClick={() => nav('/analytics')}>
            Full Analytics →
          </button>
        </div>

        <div className="dashboard-trend-grid">
          {weeklyTrend.map((t: any, idx: number) => (
            <div key={idx} className="trend-col">
              <span className="trend-pct-label">{t.percentage}%</span>
              <div className="trend-bar-track">
                <div 
                  className={`trend-bar-fill ${t.isToday ? 'today' : ''}`}
                  style={{ height: `${Math.max(10, Math.min(100, t.percentage))}%` }}
                ></div>
              </div>
              <span className={`trend-day-label ${t.isToday ? 'today' : ''}`}>
                {t.day} {t.isToday ? '(Today)' : ''}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
          <span>Institutional Target: <b>90% Minimum</b></span>
          <span style={{ color: '#10b981', fontWeight: 600 }}>Weekly Average: ~94.1%</span>
        </div>
      </div>

      {/* Today's Schedule & Live Stream */}
      <div className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <h3>Today's Timetable Routine</h3>
            <p className="panel-sub">Active periods and faculty assignments for today</p>
          </div>
          <button className="panel-header-btn" onClick={() => nav('/timetable')}>
            Manage Routine →
          </button>
        </div>

        {todaySchedule.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)' }}>
            <p>No timetable periods scheduled for today.</p>
            <button className="panel-header-btn" onClick={() => nav('/timetable')}>
              Configure Timetable Routine
            </button>
          </div>
        ) : (
          <div className="schedule-mini-list">
            {todaySchedule.slice(0, 4).map((item: any) => (
              <div key={item.id} className="schedule-mini-item">
                <div className="schedule-item-left">
                  <span className="schedule-item-time">{fmt(item.start_time)}–{fmt(item.end_time)}</span>
                  <div className="schedule-item-details">
                    <strong>Class {item.class_number}-{item.section_name} · {item.subject_name}</strong>
                    <span>{item.room ? `${item.room} · ` : ''}{item.teacher_name || 'Faculty assigned'}</span>
                  </div>
                </div>
                <button 
                  className="schedule-take-btn"
                  onClick={() => nav(`/take-attendance?routine=${item.id}`)}
                >
                  Take Attendance
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Live status indicators */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
            SMS Gateway: Active
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
            Database: Tenant Isolated
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
            Backups: Automated Daily
          </span>
        </div>
      </div>
    </div>
  </Layout>
}

function TeacherHome(){
  const {user}=useAuth();
  const nav=useNavigate();
  const [r,setR]=useState<any[]>([]);
  const [todaySessions,setTodaySessions]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    async function loadSchedule() {
      try {
        const [routineRes, historyRes] = await Promise.all([
          api.get('/teacher/routine/today').catch(()=>({data:[]})),
          api.get('/teacher/attendance/history').catch(()=>({data:[]}))
        ]);
        setR(Array.isArray(routineRes.data) ? routineRes.data : []);
        const todayStr = new Date().toISOString().slice(0, 10);
        const historyList = Array.isArray(historyRes.data) ? historyRes.data : [];
        setTodaySessions(historyList.filter((h: any) => (h.attendance_date || '').slice(0, 10) === todayStr));
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  },[]);

  // Helper to find if routine class has already had attendance taken today
  const getRoutineAttendance = (item: any) => {
    return todaySessions.find((s: any) => {
      const matchClass =
        (s.class_id && s.class_id === item.class_id) ||
        (Number(s.class_number) === Number(item.class_number));
      const matchSec =
        (s.section_id && s.section_id === item.section_id) ||
        (String(s.section_name || '').toLowerCase() === String(item.section_name || '').toLowerCase());
      return matchClass && matchSec;
    });
  };

  return <Layout>
    <div className="hero">
      <p className="eyebrow">TODAY'S ROUTINE & ATTENDANCE</p>
      <h1>Ready to take attendance.</h1>
      <p>Your daily teaching schedule is synchronized directly from the school timetable. Click "Take attendance" to record classroom attendance, or view and update existing class roll calls.</p>
    </div>
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Today's Scheduled Classes ({r.length})</h3>
        <a href="#/timetable" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
          View Full Weekly Timetable →
        </a>
      </div>
      {loading ? (
        <p className="muted" style={{ padding: 20, textAlign: 'center' }}>Loading today's routine schedule...</p>
      ) : r.length === 0 ? (
        <div style={{ padding: '28px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 10, border: '1px dashed var(--border)' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>No routine periods assigned for today</p>
          <p className="muted" style={{ margin: '0 auto 14px', maxWidth: 460, fontSize: 13, lineHeight: 1.5 }}>
            You do not have any timetable entries scheduled for today. You can view the full weekly timetable or open the Attendance Station to review or take attendance.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a href="#/timetable" className="primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
              View Weekly Timetable
            </a>
            <button onClick={() => nav('/take-attendance')} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
              Open Attendance Station
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {r.map(x => {
            const recordedSession = getRoutineAttendance(x);
            return (
              <div
                className="routine-card"
                key={x.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: recordedSession ? 'rgba(16, 185, 129, 0.03)' : 'var(--card)',
                  border: recordedSession ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <b style={{ fontSize: 15.5 }}>Class {x.class_number}-{x.section_name}</b>
                    {x.period_name && <span className="badge" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontSize: 11, fontWeight: 600 }}>{x.period_name}</span>}
                    {recordedSession && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#d1fae5', color: '#065f46', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        ✓ Recorded ({recordedSession.present || 0} Present{recordedSession.left_early_count ? ` · ${recordedSession.left_early_count} Left Early` : ''})
                      </span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span><b>{x.subject_name}</b> · {fmt(x.start_time)}–{fmt(x.end_time)} {x.room ? '· Room ' + x.room : ''}</span>
                    {recordedSession && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 4 }}>
                        Taken by: <b>{recordedSession.teacher_name || 'Faculty Member'}</b>
                        {recordedSession.is_reattendance ? ' · (Re-attended)' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => nav(`/take-attendance?routine=${x.id}&classId=${x.class_id}&sectionId=${x.section_id}&subjectId=${x.subject_id}`)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      background: recordedSession ? '#059669' : '#2563eb',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {recordedSession ? 'View / Re-attendance →' : 'Take attendance →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </Layout>
}

const DEFAULT_CLASSES = [
  { id: 'cls-lkg', class_number: -1, label: 'L-KG' },
  { id: 'cls-ukg', class_number: 0,  label: 'U-KG' },
  ...([1,2,3,4,5,6,7,8,9,10,11,12].map(n => ({ id: `cls-${n}`, class_number: n, label: `Class ${n}` })))
];

const DEFAULT_SECTIONS = DEFAULT_CLASSES.flatMap(c => [
  { id: `sec-${c.id}-a`, class_id: c.id, class_number: c.class_number, name: 'A', section_name: 'A' },
  { id: `sec-${c.id}-b`, class_id: c.id, class_number: c.class_number, name: 'B', section_name: 'B' }
]);

function cleanSess(s?: string | null) {
  return String(s || '').replace(/[\u2013\u2014]/g, '-').replace(/[^0-9-]/g, '').trim();
}

function studentMatchesSession(st: any, activeSess: string) {
  if (!activeSess) return true;
  const sName = st.session_name || st.session || '';
  const sId = st.academic_year_id || st.session_id || '';
  if (sName || sId) {
    const cActive = cleanSess(activeSess);
    const cStudent = cleanSess(sName || sId);
    if (cActive && cStudent) {
      return cActive === cStudent || cStudent.includes(cActive) || cActive.includes(cStudent);
    }
    return sId === activeSess || sName === activeSess;
  }
  return cleanSess(activeSess).includes('2025-26');
}

/* ────── Students ────── */
function Students(){
  const {user}=useAuth();
  const [activeSession, setActiveSession] = useState<string>(() => {
    return localStorage.getItem('attendo_academic_session') || '2025–26 Academic Session';
  });
  const [rows,setRows]=useState<any[]>([]);
  const [classes,setClasses]=useState<any[]>(DEFAULT_CLASSES);
  const [sections,setSections]=useState<any[]>(DEFAULT_SECTIONS);
  const [sessions,setSessions]=useState<any[]>([]);
  const [editingStudent,setEditingStudent]=useState<any|null>(null);
  const [classFilter,setClassFilter]=useState('');
  const [sectionFilter,setSectionFilter]=useState('');
  const [open,setOpen]=useState(false);
  const [importOpen,setImportOpen]=useState(false);
  const [importStep,setImportStep]=useState(1); // 1=select session/class/section 2=upload 3=preview
  const [importSession,setImportSession]=useState('');
  const [importClass,setImportClass]=useState('');
  const [importSection,setImportSection]=useState('');
  const [f,setF]=useState<any>({});
  const [saving,setSaving]=useState(false);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set());
  const [search,setSearch]=useState('');
  const [previewRows,setPreviewRows]=useState<any[]>([]);
  const [importing,setImporting]=useState(false);
  const [importErrors,setImportErrors]=useState<{row:number;field:string;message:string}[]>([]);
  const [toastNotice,setToastNotice]=useState<{type:'success'|'error'|'info';message:string;resetUrl?:string}|null>(null);

  useEffect(() => {
    const onSessionChange = (e: any) => {
      const sess = e?.detail || localStorage.getItem('attendo_academic_session') || '2025–26 Academic Session';
      setActiveSession(sess);
    };
    window.addEventListener('sessionChanged', onSessionChange);
    window.addEventListener('storage', onSessionChange);
    return () => {
      window.removeEventListener('sessionChanged', onSessionChange);
      window.removeEventListener('storage', onSessionChange);
    };
  }, []);

  async function load(sessionToLoad = activeSession){
    try {
      const sessParam = encodeURIComponent(sessionToLoad || '');
      const [a,b,c,d]=await Promise.all([
        api.get(`/students${sessParam ? `?session=${sessParam}` : ''}`),
        api.get('/classes'),
        api.get('/sections'),
        api.get('/academic-years').catch(()=>({data:[]})) as any
      ]);
      if (Array.isArray(a.data)) {
        setRows(a.data);
      }
      if (Array.isArray(b.data) && b.data.length > 0) {
        setClasses(b.data);
      }
      if (Array.isArray(c.data) && c.data.length > 0) {
        setSections(c.data);
      }
      if (Array.isArray(d.data) && d.data.length > 0) setSessions(d.data);
      else setSessions([
        { id: 'ay-2024-25', name: '2024–25 Academic Session', code: '2024-25', label: '2024–25 Academic Session', is_active: false },
        { id: 'ay-2025-26', name: '2025–26 Academic Session', code: '2025-26', label: '2025–26 Academic Session', is_active: true },
        { id: 'ay-2026-27', name: '2026–27 Academic Session', code: '2026-27', label: '2026–27 Academic Session', is_active: false }
      ]);
    } catch(err) {
      console.error('Failed to load students:', err);
    }
  }

  useEffect(()=>{
    load(activeSession);
    if (new URLSearchParams(window.location.search).get('enroll') === 'true' && (user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN')) {
      setEditingStudent(null);
      setF({ loginOption: 'STUDENT', sendInviteEmail: true, session: activeSession });
      setOpen(true);
    }
  },[activeSession]);

  async function sendStudentResetEmail(st: any) {
    try {
      const res = await api.post(`/students/${st.id}/send-reset-email`);
      setToastNotice({
        type: 'success',
        message: res.data.message || `Password setup email sent to ${res.data.email}`,
        resetUrl: res.data.resetUrl
      });
    } catch (err: any) {
      setToastNotice({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to dispatch password setup email. Ensure an email is configured.'
      });
    }
  }

  async function save(e:React.FormEvent){
    e.preventDefault();
    setSaving(true);
    try {
      // Compute full name from first + last name
      const firstName = String(f.firstName || '').trim();
      const lastName = String(f.lastName || '').trim();
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || f.name || '';
      const selectedSessionStr = f.session || activeSession || '2025–26 Academic Session';
      const matchedSession = sessions.find(s => s.id === selectedSessionStr || s.name === selectedSessionStr || s.code === selectedSessionStr || cleanSess(s.name) === cleanSess(selectedSessionStr));
      let finalSectionId = f.sectionId;
      if (finalSectionId && f.classId) {
        const curName = sections.find(s => s.id === finalSectionId)?.name || (finalSectionId.endsWith('-b') || finalSectionId === 'B' ? 'B' : 'A');
        const targetSec = sections.find(s => s.class_id === f.classId && s.name.toUpperCase() === curName.toUpperCase());
        if (targetSec) finalSectionId = targetSec.id;
        else if (!finalSectionId.includes(f.classId)) finalSectionId = `sec-${f.classId}-${curName.toLowerCase()}`;
      }
      const payload = {
        ...f,
        sectionId: finalSectionId,
        name: fullName,
        firstName,
        lastName,
        session: matchedSession?.name || selectedSessionStr,
        sessionId: matchedSession?.id || selectedSessionStr
      };
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, payload);
        setToastNotice({ type: 'success', message: `Student profile for ${fullName} updated successfully.` });
      } else {
        const res = await api.post('/students', payload);
        const created = res.data;
        const cls = classes.find(c => c.id === f.classId || String(c.class_number) === String(f.classId));
        const sec = sections.find(s => s.id === f.sectionId || s.name === f.sectionId);
        const resolvedClsNum = (created.class_number !== undefined && created.class_number !== null)
          ? Number(created.class_number)
          : (cls ? Number(cls.class_number) : 1);
        const resolvedSecName = created.section_name || sec?.name || (f.sectionId?.endsWith('-b') || f.sectionId === 'B' ? 'B' : 'A');
        const rowItem = {
          ...created,
          class_number: resolvedClsNum,
          section_name: resolvedSecName
        };
        setRows(prev => [rowItem, ...prev.filter(r => r.id !== rowItem.id)]);
        if (created.invite_sent) {
          setToastNotice({
            type: 'success',
            message: `Student enrolled successfully! An official password setup email has been dispatched to ${created.student_email || created.parent_email}.`,
            resetUrl: created.reset_url
          });
        } else {
          setToastNotice({ type: 'success', message: `Student ${created.name} enrolled successfully.` });
        }
      }
      setOpen(false);
      setEditingStudent(null);
      setF({});
      load();
    } catch(err:any){
      alert(err?.response?.data?.message || 'Could not save student');
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent(id: string) {
    if (!confirm('Are you sure you want to delete this student record?')) return;
    try {
      await api.delete(`/students/${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete student');
    }
  }

  async function deleteBulk() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.size} selected students?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await api.post('/students/bulk-delete', { ids });
      setRows(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to bulk delete students');
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchesSearch = 
      r.name.toLowerCase().includes(q) || 
      String(r.roll_number).toLowerCase().includes(q) ||
      String(r.class_number).toLowerCase().includes(q) ||
      (r.admission_number && r.admission_number.toLowerCase().includes(q)) ||
      (r.admissionNumber && r.admissionNumber.toLowerCase().includes(q)) ||
      (r.student_email && r.student_email.toLowerCase().includes(q)) ||
      (r.parent_email && r.parent_email.toLowerCase().includes(q));
    const matchesClass = !classFilter || String(r.class_id) === classFilter || String(r.class_number) === classFilter;
    const matchesSection = !sectionFilter || String(r.section_id) === sectionFilter || String(r.section_name) === sectionFilter;
    const matchesSession = studentMatchesSession(r, activeSession);
    return matchesSearch && matchesClass && matchesSection && matchesSession;
  });

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  }

  async function downloadTemplate() {
    try {
      // Fetch from backend API — always up to date with correct columns
      const res = await api.get('/students/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'students_import_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: build locally
      const sample = [
        { "First Name": "Aarav", "Last Name": "Sharma", "Full Name": "Aarav Sharma", "Admission Number": "ADM-2025-001", "Roll Number": "101", "Session": "2025-26", "Class": "Class 1", "Section": "A", "Parent Name": "Rajesh Sharma", "Parent Phone": "9876543210", "Parent Email": "rajesh@example.com", "Student Email": "aarav@school.edu" },
        { "First Name": "Diya",  "Last Name": "Patel",  "Full Name": "Diya Patel",   "Admission Number": "ADM-2025-002", "Roll Number": "102", "Session": "2025-26", "Class": "L-KG",    "Section": "A", "Parent Name": "Kirit Patel",   "Parent Phone": "9876543211", "Parent Email": "kirit@example.com",  "Student Email": "" },
        { "First Name": "Rohan", "Last Name": "Gupta",  "Full Name": "Rohan Gupta",  "Admission Number": "ADM-2025-003", "Roll Number": "103", "Session": "2025-26", "Class": "U-KG",    "Section": "B", "Parent Name": "Manoj Gupta",   "Parent Phone": "9876543212", "Parent Email": "manoj@example.com", "Student Email": "" },
      ];
      const ws = XLSX.utils.json_to_sheet(sample);
      ws['!cols'] = [14,14,20,18,14,12,12,10,20,16,24,26].map(wch => ({ wch }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Students Import Template');
      XLSX.writeFile(wb, 'students_import_template.xlsx');
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        // Required headers validation
        const REQUIRED = ['First Name','Last Name','Admission Number','Roll Number','Parent Name','Parent Phone'];
        const headers = Object.keys(json[0] || {});
        const missingHeaders = REQUIRED.filter(h => !headers.some(hk => hk.trim()===h));
        if (missingHeaders.length > 0) {
          alert(`Missing required columns: ${missingHeaders.join(', ')}\n\nPlease download the sample template and use the correct column names.`);
          return;
        }

        const rowErrors: {row:number;field:string;message:string}[] = [];
        const seenAdm = new Set<string>();

        const mapped = json.map((r, idx) => {
          const rowNum = idx + 1;
          let firstName = String(r['First Name'] || r['first_name'] || r['FirstName'] || '').trim();
          let lastName  = String(r['Last Name']  || r['last_name']  || r['LastName']  || '').trim();
          const rawFullName = String(r['Full Name'] || r['full_name'] || r['FullName'] || r['Student Name'] || r['Full Name (Auto)'] || r['Name'] || r['name'] || '').trim();
          if ((!firstName || !lastName) && rawFullName) {
            const parts = rawFullName.split(' ');
            if (!firstName) firstName = parts[0] || '';
            if (!lastName) lastName = parts.slice(1).join(' ') || '';
          }
          const fullName = rawFullName || ((firstName && lastName) ? `${firstName} ${lastName}` : (firstName || lastName || `Student ${idx+1}`));
          const admissionNumber = String(r['Admission Number']||r['admission_number']||r['Adm No']||'').trim();
          const rollNumber = String(r['Roll Number']||r['Roll']||r['roll_number']||r['Roll No']||String(idx+101)).trim();
          const parentName  = String(r['Parent Name']||r['parent_name']||'').trim();
          const parentPhone = String(r['Parent Phone']||r['Parent Mobile']||r['parent_sms_number']||'').trim();
          const parentEmail = String(r['Parent Email']||r['parent_email']||'').trim();
          const studentEmail = String(r['Student Email']||r['Email ID']||r['Email']||r['student_email']||'').trim();
          const session = String(r['Session']||r['Academic Session']||importSession||'2025-26').trim();

          // Class parsing: supports 'L-KG','U-KG','Class 1','1' etc.
          const rawClass = String(r['Class']||r['Class Number']||r['class_number']||importClass||'').trim();
          let classId='', classNumber=1, classLabel='';
          if (/l.?kg/i.test(rawClass))      { classId='cls-lkg'; classNumber=-1; classLabel='L-KG'; }
          else if (/u.?kg/i.test(rawClass)) { classId='cls-ukg'; classNumber=0; classLabel='U-KG'; }
          else { classNumber=Number(rawClass.replace(/[^0-9]/g,''))||Number(importClass)||1; classId=`cls-${classNumber}`; classLabel=`Class ${classNumber}`; }
          const sectionName = String(r['Section']||r['Section Name']||r['section_name']||importSection||'A').trim().toUpperCase();
          const sectionId = `sec-${classId}-${sectionName.toLowerCase()}`;

          // Per-row validation
          const rowErrs: {row:number;field:string;message:string}[] = [];
          if (!firstName)       rowErrs.push({row:rowNum,field:'First Name',message:'First Name is required'});
          if (!lastName)        rowErrs.push({row:rowNum,field:'Last Name',message:'Last Name is required'});
          if (!rollNumber)      rowErrs.push({row:rowNum,field:'Roll Number',message:'Roll Number is required'});
          if (!admissionNumber) rowErrs.push({row:rowNum,field:'Admission Number',message:'Admission Number is required'});
          if (!parentPhone)     rowErrs.push({row:rowNum,field:'Parent Phone',message:'Parent Phone is required'});
          if (admissionNumber && seenAdm.has(admissionNumber)) rowErrs.push({row:rowNum,field:'Admission Number',message:`Duplicate: '${admissionNumber}'`});
          if (admissionNumber) seenAdm.add(admissionNumber);

          rowErrors.push(...rowErrs);
          return { firstName, lastName, name:fullName, admissionNumber, rollNumber, parentName, parentPhone, parentEmail, studentEmail, session, classId, classNumber, classLabel, sectionId, sectionName, _errors: rowErrs };
        });

        setImportErrors(rowErrors);
        setPreviewRows(mapped);
        setImportStep(3);
      } catch (err) {
        alert('Failed to parse file. Please upload a valid .xlsx or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function submitBulkImport() {
    if (previewRows.length === 0) return;
    if (importErrors.length > 0) {
      if (!confirm(`There are ${importErrors.length} validation error(s). Only valid rows will be submitted. Continue?`)) return;
    }
    setImporting(true);
    try {
      const validRows = previewRows.filter(r => !r._errors || r._errors.length === 0);
      if (validRows.length === 0) { alert('No valid rows to import.'); setImporting(false); return; }
      // Resolve sessionId from wizard selection
      const sessionObj = sessions.find(s => (s.name||s.code||s.id) === importSession);
      const enrichedRows = validRows.map(r => ({
        ...r,
        session: r.session || importSession || '2025-26',
        classNumber: r.classNumber || Number(importClass) || 1,
        sectionName: r.sectionName || importSection || 'A'
      }));
      const res = await api.post('/students/bulk-import', {
        students: enrichedRows,
        sessionId: sessionObj?.id || undefined
      });
      alert(`Successfully imported ${res.data.count || enrichedRows.length} students${res.data.session ? ` into ${res.data.session}` : ''}!`);
      setImportOpen(false);
      setPreviewRows([]);
      setImportErrors([]);
      setImportStep(1);
      setImportSession(''); setImportClass(''); setImportSection('');
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to import students';
      const serverErrs = err?.response?.data?.errors;
      if (serverErrs && Array.isArray(serverErrs)) {
        setImportErrors(serverErrs);
        setImportStep(3);
      }
      alert(msg);
    } finally {
      setImporting(false);
    }
  }

  return <Layout>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
      <div>
        <p className="eyebrow">STUDENT DIRECTORY</p>
        <h1 style={{ margin: 0, fontSize: 24 }}>Students Directory</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Manage enrolled students, section assignments, parent contacts, and batch Excel imports.</p>
      </div>
      {(user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN') && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button 
            onClick={() => setImportOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#ffffff' }}
          >
            <FileSpreadsheet size={16} /> Import Excel / CSV
          </button>
          <button 
            onClick={() => {
              setEditingStudent(null);
              const curSess = localStorage.getItem('attendo_academic_session') || activeSession || '2025–26 Academic Session';
              setF({ session: curSess });
              setOpen(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Add Student
          </button>
        </div>
      )}
    </div>

    {/* Toast / Feedback Notice */}
    {toastNotice && (
      <div style={{
        padding: '12px 16px',
        marginBottom: 16,
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        backgroundColor: toastNotice.type === 'error' ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${toastNotice.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
        color: toastNotice.type === 'error' ? '#991b1b' : '#166534',
        fontSize: 13
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {toastNotice.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toastNotice.message}</span>
          {toastNotice.resetUrl && (
            <a
              href={toastNotice.resetUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: '#1d4ed8',
                fontWeight: 600,
                textDecoration: 'underline',
                marginLeft: 4
              }}
            >
              Test Setup Link <ArrowRight size={13} />
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => setToastNotice(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: 0 }}
        >
          ×
        </button>
      </div>
    )}

    {/* Search & Filter Bar */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#1d4ed8' }}>
          <CalendarDays size={14} />
          <span><b>Session:</b> {activeSession}</span>
        </div>
        <input 
          placeholder="🔍 Search name, roll number, admission number, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 340, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
        />
        <select 
          value={classFilter} 
          onChange={e => { setClassFilter(e.target.value); setSectionFilter(''); }}
          style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
        >
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.label || (c.class_number===-1?'L-KG':c.class_number===0?'U-KG':`Class ${c.class_number}`)}</option>)}
        </select>
        <select 
          value={sectionFilter} 
          onChange={e => setSectionFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
        >
          <option value="">All Sections</option>
          {(() => {
            const list = classFilter ? sections.filter(s => s.class_id === classFilter) : sections;
            const seen = new Set<string>();
            const unique: any[] = [];
            for (const s of list) {
              const name = String(s.name || '').toUpperCase();
              if (name && !seen.has(name)) {
                seen.add(name);
                unique.push(s);
              }
            }
            return unique.map(s => <option key={s.id} value={classFilter ? s.id : s.name}>Section {s.name}</option>);
          })()}
        </select>
        {(search || classFilter || sectionFilter) && (
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => { setSearch(''); setClassFilter(''); setSectionFilter(''); }}
            style={{ padding: '6px 10px', fontSize: 12 }}
          >
            Clear Filters
          </button>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Showing <b>{filtered.length}</b> of <b>{rows.length}</b> students
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 40, textAlign: 'center' }}>
              <input 
                type="checkbox" 
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll}
                title="Select all"
              />
            </th>
            <th>Roll / Adm No</th>
            <th>Student Name</th>
            <th>Class</th>
            <th>Student Email</th>
            <th>Guardian & Contact</th>
            <th>Portal Access</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }} className="muted">No students found. Click "Add Student" or "Import Excel / CSV" to enroll students.</td></tr>
          ) : filtered.map(x => (
            <tr key={x.id} style={{ background: selectedIds.has(x.id) ? 'rgba(59, 130, 246, 0.06)' : 'transparent' }}>
              <td style={{ textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(x.id)}
                  onChange={() => toggleSelect(x.id)}
                />
              </td>
              <td>
                <span className="roll">{x.roll_number}</span>
                {(x.admission_number || x.admissionNumber) && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                    {x.admission_number || x.admissionNumber}
                  </div>
                )}
              </td>
              <td><b>{x.name}</b></td>
              <td>
                {(() => {
                  const cNum = Number(x.class_number);
                  const cId = String(x.class_id || '');
                  if (cNum === -1 || /l.?kg/i.test(cId)) return 'L-KG';
                  if (cNum === 0 || /u.?kg/i.test(cId)) return 'U-KG';
                  if (!isNaN(cNum) && cNum > 0) return `Class ${cNum}`;
                  const m = cId.match(/cls-(\d+)/);
                  if (m) return `Class ${m[1]}`;
                  return 'Class ' + (cNum || 1);
                })()} — Section {x.section_name || 'A'}
              </td>
              <td>
                <span style={{ fontSize: 12, color: x.student_email || x.email ? 'var(--text-main)' : 'var(--text-muted)' }}>
                  {x.student_email || x.email || '—'}
                </span>
              </td>
              <td>
                <div><b>{x.parent_name || 'Guardian'}</b></div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <code>{x.parent_sms_number}</code>
                  {x.parent_email && <span style={{ marginLeft: 6 }}>• {x.parent_email}</span>}
                </div>
              </td>
              <td>
                {x.student_email || x.email || x.parent_email ? (
                  <span className="badge active" title={`Student portal login email: ${x.student_email || x.email || x.parent_email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                    🎓 Student Portal
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Offline Only</span>
                )}
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button
                  className="table-action-btn"
                  onClick={() => sendStudentResetEmail(x)}
                  title="Send password setup / reset email"
                  style={{ marginRight: 6, color: '#2563eb' }}
                >
                  <KeyRound size={14} />
                </button>
                <button 
                  className="table-action-btn" 
                  onClick={() => {
                    setEditingStudent(x);
                    setF({
                      name: x.name,
                      rollNumber: x.roll_number,
                      admissionNumber: x.admission_number || x.admissionNumber || '',
                      studentEmail: x.student_email || x.email || '',
                      parentName: x.parent_name || '',
                      parentSmsNumber: x.parent_sms_number || '',
                      parentEmail: x.parent_email || '',
                      classId: x.class_id,
                      sectionId: x.section_id,
                      loginOption: (x.student_email || x.email) ? 'STUDENT' : x.parent_email ? 'PARENT' : 'STUDENT',
                      sendInviteEmail: true
                    });
                    setOpen(true);
                  }}
                  title="Edit student"
                  style={{ marginRight: 6 }}
                >
                  <Pencil size={14} />
                </button>
                <button 
                  className="table-action-btn danger" 
                  onClick={() => deleteStudent(x.id)}
                  title="Delete student"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Sticky Floating Action Bar for Bulk Selection */}
    {selectedIds.size > 0 && (
      <div className="bulk-action-bar">
        <span className="count-badge">{selectedIds.size} students selected</span>
        <button className="btn-secondary" onClick={() => setSelectedIds(new Set())}>
          Deselect All
        </button>
        <button className="btn-danger" onClick={deleteBulk}>
          <Trash2 size={14} /> Delete Selected ({selectedIds.size})
        </button>
      </div>
    )}

    {/* SINGLE STUDENT ADD / EDIT MODAL */}
    {open && <Modal title={editingStudent ? "Edit Student Record" : "Add Student"} close={()=>{setOpen(false); setEditingStudent(null);}}>
      <form className="modal-form" onSubmit={save}>

        {/* First Name + Last Name */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label>First Name
            <input
              required
              placeholder="e.g. Aarav"
              value={f.firstName || (editingStudent ? (f.name||'').split(' ')[0] : '') || ''}
              onChange={e => {
                const fn = e.target.value;
                const ln = f.lastName || (editingStudent ? (f.name||'').split(' ').slice(1).join(' ') : '') || '';
                setF({ ...f, firstName: fn, name: [fn, ln].filter(Boolean).join(' ') });
              }}
            />
          </label>
          <label>Last Name
            <input
              placeholder="e.g. Sharma"
              value={f.lastName || (editingStudent ? (f.name||'').split(' ').slice(1).join(' ') : '') || ''}
              onChange={e => {
                const ln = e.target.value;
                const fn = f.firstName || (editingStudent ? (f.name||'').split(' ')[0] : '') || '';
                setF({ ...f, lastName: ln, name: [fn, ln].filter(Boolean).join(' ') });
              }}
            />
          </label>
        </div>

        {/* Full Name — auto-computed, read-only */}
        <label style={{ color: '#64748b', fontSize: 12 }}>
          Full Name <span style={{ color: '#10b981', fontSize: 11 }}>● Auto-generated</span>
          <input
            readOnly
            tabIndex={-1}
            style={{ backgroundColor: '#f8fafc', color: '#334155', cursor: 'default', border: '1px solid #e2e8f0' }}
            value={[f.firstName || (editingStudent ? (f.name||'').split(' ')[0] : ''), f.lastName || (editingStudent ? (f.name||'').split(' ').slice(1).join(' ') : '')].filter(Boolean).join(' ') || f.name || ''}
            placeholder="Full name will appear here automatically"
          />
        </label>

        {/* Session Selection */}
        <label>Session
          <select
            value={f.session || ''}
            onChange={e => setF({ ...f, session: e.target.value })}
          >
            <option value="">Select Session</option>
            {(sessions.length > 0 ? sessions : [
              { id: 'ay-2024-25', name: '2024-25', label: '2024-25 Academic Session' },
              { id: 'ay-2025-26', name: '2025-26', label: '2025-26 Academic Session' },
              { id: 'ay-2026-27', name: '2026-27', label: '2026-27 Academic Session' }
            ]).map(s => (
              <option key={s.id} value={s.name || s.code || s.id}>{s.label || s.name}</option>
            ))}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label>Roll Number
            <input required placeholder="Roll Number (e.g. 101)" value={f.rollNumber||''} onChange={e=>setF({...f,rollNumber:e.target.value})}/>
          </label>
          <label>Admission Number
            <input placeholder="Admission Number (e.g. ADM-2025-001)" value={f.admissionNumber||''} onChange={e=>setF({...f,admissionNumber:e.target.value})}/>
          </label>
        </div>
        <label>Class
          <select 
            required 
            value={f.classId||''} 
            onChange={e => {
              const newClassId = e.target.value;
              let newSecId = f.sectionId;
              if (f.sectionId) {
                const curName = sections.find(s => s.id === f.sectionId)?.name || (f.sectionId.endsWith('-b') || f.sectionId === 'B' ? 'B' : 'A');
                const targetSec = sections.find(s => s.class_id === newClassId && s.name.toUpperCase() === curName.toUpperCase());
                newSecId = targetSec ? targetSec.id : (newClassId ? `sec-${newClassId}-${curName.toLowerCase()}` : `sec-${curName.toLowerCase()}`);
              }
              setF({ ...f, classId: newClassId, sectionId: newSecId });
            }}
          >
            <option value="">Select Class</option>
            {classes.map(c=><option key={c.id} value={c.id}>{c.label || (c.class_number===-1?'L-KG':c.class_number===0?'U-KG':`Class ${c.class_number}`)}</option>)}
          </select>
        </label>
        <label>Section
          <select 
            required 
            value={(() => {
              if (!f.sectionId) return '';
              const found = sections.find(s => s.id === f.sectionId);
              if (found) return found.id;
              if (f.classId) {
                const letter = (f.sectionId === 'B' || f.sectionId.endsWith('-b')) ? 'B' : 'A';
                const match = sections.find(s => s.class_id === f.classId && s.name.toUpperCase() === letter);
                if (match) return match.id;
              }
              return f.sectionId;
            })()} 
            onChange={e => {
              const val = e.target.value;
              setF({ ...f, sectionId: val });
            }}
          >
            <option value="">Select Section</option>
            {(() => {
              const selectedCls = classes.find(c => c.id === f.classId || String(c.class_number) === String(f.classId));
              const classNum = selectedCls ? selectedCls.class_number : null;
              // If class is chosen, get sections for that specific class; otherwise generic Section A & Section B
              const matching = f.classId
                ? sections.filter(s => s.class_id === f.classId || (classNum !== null && Number(s.class_number) === Number(classNum)))
                : [];
              const opts = matching.length > 0 ? matching : [
                { id: f.classId ? `sec-${f.classId}-a` : 'sec-a', name: 'A' },
                { id: f.classId ? `sec-${f.classId}-b` : 'sec-b', name: 'B' }
              ];
              // Strictly deduplicate by name ('A', 'B') so only ONE Section A and ONE Section B are displayed
              const seen = new Set<string>();
              const deduped = [];
              for (const opt of opts) {
                const name = String(opt.name || '').trim().toUpperCase();
                if (name && !seen.has(name)) {
                  seen.add(name);
                  deduped.push(opt);
                }
              }
              deduped.sort((a,b) => a.name.localeCompare(b.name));
              return deduped.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>);
            })()}
          </select>
        </label>

        <label>Student Email Address
          <input
            type="email"
            placeholder="student@school.edu"
            value={f.studentEmail || f.email || ''}
            onChange={e => setF({ ...f, studentEmail: e.target.value })}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label>Parent / Guardian Name
            <input placeholder="Guardian Name" value={f.parentName||''} onChange={e=>setF({...f,parentName:e.target.value})}/>
          </label>
          <label>Parent SMS Mobile Number
            <input required placeholder="Mobile (e.g. 9876543210)" value={f.parentSmsNumber||''} onChange={e=>setF({...f,parentSmsNumber:e.target.value})}/>
          </label>
        </div>

        <label>Parent Email Address (for Login / Absent Alerts)
          <input
            type="email"
            placeholder="parent@example.com"
            value={f.parentEmail||''}
            onChange={e => setF({...f,parentEmail:e.target.value})}
          />
        </label>

        {/* Student Portal Login Credentials Section */}
        <div style={{
          padding: 14,
          backgroundColor: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          margin: '6px 0 16px 0'
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <KeyRound size={14} style={{ color: '#2563eb' }} />
            Student Portal Login Email Option
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: 12, color: '#64748b' }}>
            Select which email will be used to log in to the <b>Student Portal</b>:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#334155', marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontWeight: 500 }}>
              <input
                type="radio"
                name="loginOption"
                value="STUDENT"
                checked={(f.loginOption || 'STUDENT') === 'STUDENT'}
                onChange={e => setF({ ...f, loginOption: e.target.value })}
              />
              <span>🎓 <b>Use Student Email</b> for Student Portal Login</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontWeight: 500 }}>
              <input
                type="radio"
                name="loginOption"
                value="PARENT"
                checked={f.loginOption === 'PARENT'}
                onChange={e => setF({ ...f, loginOption: e.target.value })}
              />
              <span>👨‍👩‍👧 <b>Use Parent Email</b> for Student Portal Login</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontWeight: 500 }}>
              <input
                type="radio"
                name="loginOption"
                value="NONE"
                checked={f.loginOption === 'NONE'}
                onChange={e => setF({ ...f, loginOption: e.target.value })}
              />
              <span>⚪ <b>Offline Record Only</b> (No portal account created)</span>
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontSize: 12, color: '#1e40af', backgroundColor: '#eff6ff', padding: '8px 10px', borderRadius: 6, border: '1px solid #dbeafe' }}>
            <input
              type="checkbox"
              checked={f.sendInviteEmail !== false}
              onChange={e => setF({ ...f, sendInviteEmail: e.target.checked })}
            />
            <span>Send password setup email to selected login email (secure 24-hour setup link; spam-filtered)</span>
          </label>
        </div>

        <button type="submit" disabled={saving}>{saving ? 'Saving student...' : editingStudent ? 'Update student record' : 'Save student & send invite'}</button>
      </form>
    </Modal>}

    {/* EXCEL / CSV BULK IMPORT MODAL — Multi-Step Wizard */}
    {importOpen && <Modal title="Bulk Import Students (Excel / CSV)" close={()=>{setImportOpen(false); setPreviewRows([]); setImportStep(1); setImportSession(''); setImportClass(''); setImportSection('');}}>
      <div style={{ padding: '0 4px' }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20, fontSize: 12 }}>
          {['Select Session', 'Upload File', 'Preview & Confirm'].map((label, idx) => {
            const step = idx + 1;
            const active = importStep === step;
            const done = importStep > step;
            return (
              <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                    background: done ? '#10b981' : active ? '#2563eb' : '#e2e8f0',
                    color: (done || active) ? '#fff' : '#94a3b8'
                  }}>{done ? '✓' : step}</div>
                  <span style={{ color: active ? '#1e293b' : done ? '#10b981' : '#94a3b8', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>{label}</span>
                </div>
                {step < 3 && <div style={{ height: 2, background: done ? '#10b981' : '#e2e8f0', flex: 1, margin: '0 6px' }} />}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1: Select Session / Class / Section ── */}
        {importStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label>Academic Session <span style={{ color: '#ef4444', fontSize: 11 }}>*</span>
              <select value={importSession} onChange={e => setImportSession(e.target.value)}>
                <option value="">Select Session</option>
                {(sessions.length > 0 ? sessions : [
                  { id: 'ay-2024-25', name: '2024-25', label: '2024-25 Academic Session' },
                  { id: 'ay-2025-26', name: '2025-26', label: '2025-26 Academic Session' },
                  { id: 'ay-2026-27', name: '2026-27', label: '2026-27 Academic Session' }
                ]).map(s => (
                  <option key={s.id} value={s.name || s.code || s.id}>{s.label || s.name}</option>
                ))}
              </select>
            </label>
            <label>Class (default for import) <span style={{ fontSize: 11, color: '#64748b' }}>— overridden by Excel column</span>
              <select value={importClass} onChange={e => setImportClass(e.target.value)}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.class_number}>{c.label || (c.class_number===-1?'L-KG':c.class_number===0?'U-KG':`Class ${c.class_number}`)}</option>)}
              </select>
            </label>
            <label>Section (default for import) <span style={{ fontSize: 11, color: '#64748b' }}>— overridden by Excel column</span>
              <select value={importSection} onChange={e => setImportSection(e.target.value)}>
                <option value="">Select Section</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
              </select>
            </label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <button
                type="button"
                className="template-download-btn"
                onClick={downloadTemplate}
              >
                <Download size={13} /> Download Sample Template (.xlsx)
              </button>
              <button
                type="button"
                disabled={!importSession}
                onClick={() => setImportStep(2)}
                style={{ background: '#2563eb', color: '#fff', opacity: importSession ? 1 : 0.5 }}
              >
                Next: Upload File →
              </button>
            </div>
            {!importSession && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>Please select a session to continue.</p>}
          </div>
        )}

        {/* ── STEP 2: Upload File ── */}
        {importStep === 2 && (
          <div>
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13, color: '#166534' }}>
              📋 Session: <b>{importSession}</b>{importClass ? ` · Class ${importClass}` : ''}{importSection ? ` · Section ${importSection}` : ''}
            </div>
            <label className="dropzone">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <div className="dropzone-icon">
                <UploadCloud size={24} />
              </div>
              <strong style={{ fontSize: 14 }}>Click to browse or drop Excel file here</strong>
              <span className="muted" style={{ fontSize: 12 }}>Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</span>
              <span className="muted" style={{ fontSize: 11, marginTop: 4 }}>Columns: First Name, Last Name, Full Name, Admission Number, Roll Number, Session, Class, Section, Parent Phone, Student Email</span>
            </label>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="btn-secondary" onClick={() => setImportStep(1)}>← Back</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Preview & Confirm ── */}
        {importStep === 3 && previewRows.length > 0 && (
          <div>
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13, color: '#166534' }}>
              ✅ <b>{previewRows.length} students</b> ready to import · Session: <b>{importSession}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>Preview Data</strong>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {importErrors.length > 0 && (
                  <span style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, padding:'3px 10px', fontSize:12 }}>
                    ⚠ {importErrors.length} error{importErrors.length>1?'s':''} — highlighted in red
                  </span>
                )}
                <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { setPreviewRows([]); setImportErrors([]); setImportStep(2); }}>Re-upload</button>
              </div>
            </div>
            <div className="preview-table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Full Name</th>
                    <th>Adm. No.</th>
                    <th>Roll No</th>
                    <th>Session</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Parent Phone</th>
                    <th>Student Email</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i} style={{ background: r._errors?.length ? '#fef2f2' : undefined, outline: r._errors?.length ? '1px solid #fecaca' : undefined }}>
                      <td style={{ color: r._errors?.length ? '#dc2626' : '#94a3b8', fontSize: 11 }}>
                        {r._errors?.length ? '⚠' : i+1}
                      </td>
                      <td style={{ color: r._errors?.some((e:any)=>e.field==='First Name') ? '#dc2626' : undefined }}>
                        {r.firstName || r.name?.split(' ')[0] || '—'}
                        {r._errors?.filter((e:any)=>e.field==='First Name').map((e:any,j:number)=>
                          <div key={j} style={{fontSize:10,color:'#dc2626'}}>{e.message}</div>
                        )}
                      </td>
                      <td style={{ color: r._errors?.some((e:any)=>e.field==='Last Name') ? '#dc2626' : undefined }}>
                        {r.lastName || r.name?.split(' ').slice(1).join(' ') || '—'}
                        {r._errors?.filter((e:any)=>e.field==='Last Name').map((e:any,j:number)=>
                          <div key={j} style={{fontSize:10,color:'#dc2626'}}>{e.message}</div>
                        )}
                      </td>
                      <td><b>{r.name}</b></td>
                      <td style={{ color: r._errors?.some((e:any)=>e.field==='Admission Number') ? '#dc2626' : undefined }}>
                        {r.admissionNumber||'—'}
                        {r._errors?.filter((e:any)=>e.field==='Admission Number').map((e:any,j:number)=>
                          <div key={j} style={{fontSize:10,color:'#dc2626'}}>{e.message}</div>
                        )}
                      </td>
                      <td style={{ color: r._errors?.some((e:any)=>e.field==='Roll Number') ? '#dc2626' : undefined }}>
                        <span className="roll">{r.rollNumber}</span>
                      </td>
                      <td><span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>{r.session || importSession}</span></td>
                      <td>{r.classLabel || r.classNumber}</td>
                      <td>{r.sectionName}</td>
                      <td style={{ fontSize: 12, color: r._errors?.some((e:any)=>e.field==='Parent Phone') ? '#dc2626' : undefined }}>
                        {r.parentPhone || r.parentSmsNumber || '—'}
                        {r._errors?.filter((e:any)=>e.field==='Parent Phone').map((e:any,j:number)=>
                          <div key={j} style={{fontSize:10,color:'#dc2626'}}>{e.message}</div>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{r.studentEmail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => { setImportStep(2); setPreviewRows([]); setImportErrors([]); }}>← Back</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => { setImportOpen(false); setPreviewRows([]); setImportErrors([]); setImportStep(1); }}>Cancel</button>
                <button
                  type="button"
                  onClick={submitBulkImport}
                  disabled={importing}
                  style={{ background: '#10b981', color: '#ffffff' }}
                >
                  {importing ? 'Importing Students...' : `Confirm & Import ${previewRows.filter(r=>!r._errors?.length).length} Valid Students`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>}
  </Layout>
}

/* ────── Teachers ────── */
function Teachers(){
  const {user}=useAuth();
  const [rows,setRows]=useState<any[]>([]);
  const [open,setOpen]=useState(false);
  const [importOpen,setImportOpen]=useState(false);
  const [f,setF]=useState<any>({});
  const [saving,setSaving]=useState(false);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set());
  const [search,setSearch]=useState('');
  const [previewRows,setPreviewRows]=useState<any[]>([]);
  const [importing,setImporting]=useState(false);
  const [toastNotice,setToastNotice]=useState<{type:'success'|'error'|'info';message:string;resetUrl?:string}|null>(null);

  // Teaching allocations state
  const [allAssignments,setAllAssignments]=useState<any[]>([]);
  const [allocOpen,setAllocOpen]=useState(false);
  const [allocTeacher,setAllocTeacher]=useState<any>(null);
  const [allocRows,setAllocRows]=useState<any[]>([]);
  const [allocSaving,setAllocSaving]=useState(false);
  const [allocSubjects,setAllocSubjects]=useState<any[]>([]);
  const [allocClasses,setAllocClasses]=useState<any[]>([]);
  const [allocSections,setAllocSections]=useState<any[]>([]);
  const [allocSessions,setAllocSessions]=useState<any[]>([]);

  async function load(){
    try {
      const [tRes, aRes, subRes, clsRes, secRes] = await Promise.all([
        api.get('/teachers'),
        api.get('/teacher-assignments').catch(()=>({data:[]})),
        api.get('/subjects').catch(()=>({data:[]})),
        api.get('/classes').catch(()=>({data:[]})),
        api.get('/sections').catch(()=>({data:[]}))
      ]);
      setRows(tRes.data || []);
      setAllAssignments(Array.isArray(aRes.data) ? aRes.data : []);
      setAllocSubjects(Array.isArray(subRes.data) ? subRes.data : []);
      setAllocClasses(Array.isArray(clsRes.data) ? clsRes.data : []);
      setAllocSections(Array.isArray(secRes.data) ? secRes.data : []);
    } catch(err) {
      console.error('Failed to load teachers:', err);
    }
  }

  useEffect(()=>{
    load();
    api.get('/dashboard/school').then(r => {
      if(r.data?.academicYears) setAllocSessions(r.data.academicYears);
    }).catch(()=>{});
  },[]);

  // Open allocations modal for a specific teacher
  function openAllocModal(t: any) {
    setAllocTeacher(t);
    const existing = allAssignments.filter(a => a.teacher_id === t.id);
    setAllocRows(existing.length > 0 ? existing.map(a => ({...a})) : [{
      subject_id: '', subject_name: '', class_id: '', class_number: '', section_id: '', section_name: '',
      session_id: '', session_name: '', alt_teacher_id: '', alt_teacher_name: ''
    }]);
    setAllocOpen(true);
  }

  function addAllocRow() {
    setAllocRows(prev => [...prev, { subject_id: '', class_id: '', section_id: '', session_id: '', alt_teacher_id: '' }]);
  }
  function removeAllocRow(idx: number) {
    setAllocRows(prev => prev.filter((_,i) => i !== idx));
  }
  function updateAllocRow(idx: number, field: string, value: string) {
    setAllocRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      // Resolve names
      if (field === 'subject_id') updated.subject_name = allocSubjects.find(s => s.id === value)?.name || '';
      if (field === 'class_id') updated.class_number = allocClasses.find(c => c.id === value)?.class_number || '';
      if (field === 'section_id') updated.section_name = allocSections.find(s => s.id === value)?.name || '';
      if (field === 'session_id') updated.session_name = allocSessions.find(s => s.id === value)?.name || '';
      if (field === 'alt_teacher_id') updated.alt_teacher_name = rows.find(t => t.id === value)?.name || '';
      return updated;
    }));
  }

  async function saveAllocations() {
    if (!allocTeacher) return;
    setAllocSaving(true);
    try {
      const validRows = allocRows.filter(r => r.subject_id && r.class_id);
      await api.put(`/teachers/${allocTeacher.id}/assignments`, { assignments: validRows });
      setToastNotice({ type: 'success', message: `Allocations updated for ${allocTeacher.name}.` });
      setAllocOpen(false);
      load();
    } catch (err: any) {
      setToastNotice({ type: 'error', message: err?.response?.data?.message || 'Failed to save allocations' });
    } finally {
      setAllocSaving(false);
    }
  }

  // Get allocation summary for a teacher (for table display)
  function getTeacherAllocSummary(tid: string): string {
    const allocs = allAssignments.filter(a => a.teacher_id === tid);
    if (allocs.length === 0) return '—';
    return allocs.map(a => `${a.subject_name || '?'} (${a.class_number||'?'}-${a.section_name||'?'})`).join(', ');
  }

  async function sendTeacherResetEmail(t: any) {
    try {
      const res = await api.post(`/teachers/${t.id}/send-reset-email`);
      setToastNotice({
        type: 'success',
        message: res.data.message || `Password setup email dispatched to ${res.data.email}.`,
        resetUrl: res.data.resetUrl
      });
    } catch (err: any) {
      setToastNotice({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to dispatch password setup email.'
      });
    }
  }

  async function save(e:React.FormEvent){
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/teachers', f);
      const created = res.data;
      setRows(prev => [created, ...prev.filter(r => r.id !== created.id)]);
      setOpen(false);
      setF({});
      if (created.invite_sent) {
        setToastNotice({
          type: 'success',
          message: `Faculty member created! Official password setup email has been dispatched to ${created.email}.`,
          resetUrl: created.reset_url
        });
      } else {
        setToastNotice({
          type: 'success',
          message: `Faculty member ${created.name} registered successfully.`
        });
      }
      load();
    } catch(err:any){
      alert(err?.response?.data?.message || 'Could not save teacher');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeacher(id: string) {
    if (!confirm('Are you sure you want to deactivate and remove this teacher?')) return;
    try {
      await api.delete(`/teachers/${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete teacher');
    }
  }

  async function deleteBulk() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected faculty accounts?`)) return;
    try {
      const ids = Array.from(selectedIds);
      await api.post('/teachers/bulk-delete', { ids });
      setRows(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to bulk delete teachers');
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = rows.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.email.toLowerCase().includes(search.toLowerCase()) ||
    String(r.employee_id).toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  }

  function downloadTemplate() {
    const sample = [
      { "Teacher Name": "Sunita Verma", "Email": "sunita.v@school.local", "Employee ID": "EMP010", "Mobile": "9876500001", "Default Password": "ChangeMe123!" },
      { "Teacher Name": "Alok Mishra", "Email": "alok.m@school.local", "Employee ID": "EMP011", "Mobile": "9876500002", "Default Password": "ChangeMe123!" },
      { "Teacher Name": "Rekha Sengupta", "Email": "rekha.s@school.local", "Employee ID": "EMP012", "Mobile": "9876500003", "Default Password": "ChangeMe123!" }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teachers");
    XLSX.writeFile(wb, "teachers_import_template.xlsx");
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const mapped = json.map((r, idx) => ({
          name: r["Teacher Name"] || r["Name"] || r["name"] || `Teacher ${idx + 1}`,
          email: String(r["Email"] || r["Email Address"] || r["email"] || `teacher${idx+1}@school.local`).toLowerCase().trim(),
          employeeId: String(r["Employee ID"] || r["Emp ID"] || r["employee_id"] || `EMP0${idx+10}`),
          mobile: String(r["Mobile"] || r["Phone"] || r["mobile"] || '9876500000'),
          password: r["Default Password"] || r["Password"] || r["password"] || 'ChangeMe123!'
        })).filter(x => x.name && x.email);
        setPreviewRows(mapped);
      } catch (err) {
        alert('Failed to parse file. Please upload a valid .xlsx or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function submitBulkImport() {
    if (previewRows.length === 0) return;
    setImporting(true);
    try {
      const res = await api.post('/teachers/bulk-import', { teachers: previewRows });
      alert(`Successfully registered ${res.data.count} teachers!`);
      setImportOpen(false);
      setPreviewRows([]);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to import teachers');
    } finally {
      setImporting(false);
    }
  }

  return <Layout>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
      <div>
        <p className="eyebrow">FACULTY & STAFF</p>
        <h1 style={{ margin: 0, fontSize: 24 }}>Teachers & Faculty</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Appointed faculty accounts, classroom attendance permissions, and bulk onboarding.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button 
          onClick={() => setImportOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#ffffff' }}
        >
          <FileSpreadsheet size={16} /> Import Excel / CSV
        </button>
        <button 
          onClick={() => setOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} /> Add Teacher
        </button>
      </div>
    </div>

    {/* Toast / Feedback Notice */}
    {toastNotice && (
      <div style={{
        padding: '12px 16px',
        marginBottom: 16,
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        backgroundColor: toastNotice.type === 'error' ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${toastNotice.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
        color: toastNotice.type === 'error' ? '#991b1b' : '#166534',
        fontSize: 13
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {toastNotice.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toastNotice.message}</span>
          {toastNotice.resetUrl && (
            <a
              href={toastNotice.resetUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: '#1d4ed8',
                fontWeight: 600,
                textDecoration: 'underline',
                marginLeft: 4
              }}
            >
              Test Setup Link <ArrowRight size={13} />
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => setToastNotice(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: 0 }}
        >
          ×
        </button>
      </div>
    )}

    {/* Search & Filter Bar */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
      <input 
        placeholder="🔍 Search teacher name, email, or employee ID..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ maxWidth: 380, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
      />
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Showing <b>{filtered.length}</b> of <b>{rows.length}</b> faculty members
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 40, textAlign: 'center' }}>
              <input 
                type="checkbox" 
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll}
                title="Select all"
              />
            </th>
            <th>Employee ID</th>
            <th>Teacher Name</th>
            <th>Subjects & Classes</th>
            <th>Email</th>
            <th>Mobile</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }} className="muted">No faculty members found. Click "Add Teacher" or "Import Excel / CSV" to onboard staff.</td></tr>
          ) : filtered.map(x => (
            <tr key={x.id} style={{ background: selectedIds.has(x.id) ? 'rgba(59, 130, 246, 0.06)' : 'transparent' }}>
              <td style={{ textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(x.id)}
                  onChange={() => toggleSelect(x.id)}
                />
              </td>
              <td><code>{x.employee_id}</code></td>
              <td><b>{x.name}</b></td>
              <td style={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span title={getTeacherAllocSummary(x.id)}>{getTeacherAllocSummary(x.id)}</span>
              </td>
              <td>{x.email}</td>
              <td>{x.mobile || '—'}</td>
              <td><span className="badge active">{x.is_active !== false ? 'ACTIVE' : 'INACTIVE'}</span></td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button
                  className="table-action-btn"
                  onClick={() => openAllocModal(x)}
                  title="Manage teaching allocations"
                  style={{ marginRight: 6, color: '#7c3aed' }}
                >
                  <BookOpen size={14} />
                </button>
                <button
                  className="table-action-btn"
                  onClick={() => sendTeacherResetEmail(x)}
                  title="Send password setup / reset email"
                  style={{ marginRight: 6, color: '#2563eb' }}
                >
                  <KeyRound size={14} />
                </button>
                <button 
                  className="table-action-btn danger" 
                  onClick={() => deleteTeacher(x.id)}
                  title="Delete teacher"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Sticky Floating Action Bar for Bulk Selection */}
    {selectedIds.size > 0 && (
      <div className="bulk-action-bar">
        <span className="count-badge">{selectedIds.size} faculty selected</span>
        <button className="btn-secondary" onClick={() => setSelectedIds(new Set())}>
          Deselect All
        </button>
        <button className="btn-danger" onClick={deleteBulk}>
          <Trash2 size={14} /> Delete Selected ({selectedIds.size})
        </button>
      </div>
    )}

    {/* SINGLE TEACHER ADD MODAL */}
    {open && <Modal title="Add Teacher" close={()=>setOpen(false)}>
      <form className="modal-form" onSubmit={save}>
        <label>Teacher Full Name
          <input required placeholder="Full Name (e.g. Rahul Sharma)" value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/>
        </label>
        <label>Email Address (for Faculty Portal Login)
          <input required type="email" placeholder="teacher@school.local" value={f.email||''} onChange={e=>setF({...f,email:e.target.value})}/>
        </label>
        <label>Employee ID
          <input required placeholder="EMP001" value={f.employeeId||''} onChange={e=>setF({...f,employeeId:e.target.value})}/>
        </label>
        <label>Mobile Number
          <input placeholder="Mobile Number" value={f.mobile||''} onChange={e=>setF({...f,mobile:e.target.value})}/>
        </label>

        {/* Password Setup & Activation Box */}
        <div style={{
          padding: 14,
          backgroundColor: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          margin: '6px 0 16px 0'
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <KeyRound size={14} style={{ color: '#2563eb' }} />
            Password Setup & Account Activation
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: '0 0 10px 0', fontSize: 13, color: '#1e40af', backgroundColor: '#eff6ff', padding: '8px 10px', borderRadius: 6, border: '1px solid #dbeafe' }}>
            <input
              type="checkbox"
              checked={f.sendInviteEmail !== false}
              onChange={e => setF({ ...f, sendInviteEmail: e.target.checked })}
            />
            <span>Send welcome email with secure link to set password (spam-filtered; 24h validity)</span>
          </label>
          <label style={{ display: 'block', fontSize: 12, color: '#64748b', margin: 0 }}>
            Optional Initial Password (leave empty to let teacher set password via email):
            <input
              type="password"
              placeholder="Optional initial password (e.g. ChangeMe123!)"
              value={f.password||''}
              onChange={e => setF({...f,password:e.target.value})}
              style={{ marginTop: 4 }}
            />
          </label>
        </div>

        <button type="submit" disabled={saving}>{saving ? 'Creating teacher...' : (f.sendInviteEmail !== false ? 'Create teacher & send invite' : 'Create teacher')}</button>
      </form>
    </Modal>}

    {/* ═══ TEACHING ALLOCATIONS MODAL ═══ */}
    {allocOpen && allocTeacher && <Modal title={`Manage Allocations — ${allocTeacher.name}`} close={()=>setAllocOpen(false)}>
      <div style={{ padding: '10px 4px' }}>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
          Assign subject-class-section combinations for this teacher. Each row is one teaching allocation.
        </p>
        <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 12 }}>
          {allocRows.map((ar, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 8, alignItems: 'end' }}>
              {/* Subject */}
              <label style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'Subject' : ''}
                <select value={ar.subject_id||''} onChange={e=>updateAllocRow(idx,'subject_id',e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  <option value="">Subject</option>
                  {allocSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              {/* Class */}
              <label style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'Class' : ''}
                <select value={ar.class_id||''} onChange={e=>updateAllocRow(idx,'class_id',e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  <option value="">Class</option>
                  {allocClasses.map(c=><option key={c.id} value={c.id}>Class {c.class_number}</option>)}
                </select>
              </label>
              {/* Section */}
              <label style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'Section' : ''}
                <select value={ar.section_id||''} onChange={e=>updateAllocRow(idx,'section_id',e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  <option value="">Section</option>
                  {allocSections.filter(s => !ar.class_id || s.class_id === ar.class_id || String(s.class_number) === String(allocClasses.find(c=>c.id===ar.class_id)?.class_number)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              {/* Session */}
              <label style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'Session' : ''}
                <select value={ar.session_id||''} onChange={e=>updateAllocRow(idx,'session_id',e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  <option value="">Session</option>
                  {allocSessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              {/* Alt Faculty */}
              <label style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'Alt. Faculty' : ''}
                <select value={ar.alt_teacher_id||''} onChange={e=>updateAllocRow(idx,'alt_teacher_id',e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  <option value="">None</option>
                  {rows.filter(t => t.id !== allocTeacher.id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={()=>removeAllocRow(idx)} title="Remove" style={{ padding: '5px 8px', background: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" onClick={addAllocRow} style={{ fontSize: 12, padding: '5px 12px', background: 'transparent', border: '1px dashed var(--border)', color: '#2563eb', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>+ Add Row</button>
          <button type="button" onClick={saveAllocations} disabled={allocSaving}
            style={{ background: '#2563eb', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13 }}>
            {allocSaving ? 'Saving...' : 'Save Allocations'}
          </button>
        </div>
      </div>
    </Modal>}

    {/* EXCEL / CSV BULK IMPORT MODAL */}
    {importOpen && <Modal title="Bulk Import Teachers (Excel / CSV)" close={()=>{setImportOpen(false); setPreviewRows([]);}}>
      <div style={{ padding: '0 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Upload an Excel (.xlsx, .xls) or CSV file with teacher rosters.
          </p>
          <button 
            type="button" 
            className="template-download-btn"
            onClick={downloadTemplate}
          >
            <Download size={13} /> Download Sample Template (.xlsx)
          </button>
        </div>

        <label className="dropzone">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          <div className="dropzone-icon">
            <UploadCloud size={24} />
          </div>
          <strong style={{ fontSize: 14 }}>Click to browse or drop Excel file here</strong>
          <span className="muted" style={{ fontSize: 12 }}>Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</span>
        </label>

        {previewRows.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>Preview Data ({previewRows.length} faculty ready to import)</strong>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setPreviewRows([])}
              >
                Clear
              </button>
            </div>
            <div className="preview-table-container">
              <table>
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Default Password</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      <td><code>{r.employeeId}</code></td>
                      <td><b>{r.name}</b></td>
                      <td>{r.email}</td>
                      <td>{r.mobile}</td>
                      <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>••••••••</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => { setImportOpen(false); setPreviewRows([]); }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={submitBulkImport}
                disabled={importing}
                style={{ background: '#10b981', color: '#ffffff' }}
              >
                {importing ? 'Importing Teachers...' : `Confirm & Import ${previewRows.length} Teachers`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>}
  </Layout>
}

/* ────── Classes ────── */
function Classes(){
  const {user}=useAuth();
  const [c,setC]=useState<any[]>([]);
  const [s,setS]=useState<any[]>([]);
  const [n,setN]=useState('');
  const [cid,setCid]=useState('');
  const [sn,setSn]=useState('');
  const [addingClass,setAddingClass]=useState(false);
  const [addingSection,setAddingSection]=useState(false);

  async function load(){
    try {
      const [cr, sr]=await Promise.all([api.get('/classes'), api.get('/sections')]);
      const classesData = cr.data || [];
      const sectionsData = sr.data || [];
      setC(classesData);
      setS(sectionsData);
      if (classesData.length > 0 && !cid) {
        setCid(classesData[0].id);
      }
    } catch(err) {
      console.error('Failed to load classes and sections:', err);
    }
  }

  useEffect(()=>{load()},[]);

  async function addClass(e?: React.FormEvent){
    if (e) e.preventDefault();
    if (!n) {
      alert('Please select a class number to add.');
      return;
    }
    setAddingClass(true);
    try {
      const res = await api.post('/classes', { classNumber: Number(n) });
      const created = res.data;
      setC(prev => {
        const filtered = prev.filter(x => x.class_number !== created.class_number);
        return [...filtered, created].sort((a,b) => a.class_number - b.class_number);
      });
      setN('');
      load();
    } catch(err:any){
      if (err?.response?.status !== 401) {
        alert(err?.response?.data?.message || 'Could not add class');
      }
    } finally {
      setAddingClass(false);
    }
  }

  async function addSection(e?: React.FormEvent){
    if (e) e.preventDefault();
    const targetCid = cid || c[0]?.id;
    if (!targetCid) {
      alert('Please select a class first.');
      return;
    }
    if (!sn.trim()) {
      alert('Please enter a section name (e.g. C).');
      return;
    }
    setAddingSection(true);
    try {
      const res = await api.post('/sections', { classId: targetCid, name: sn.trim() });
      const created = res.data;
      setS(prev => [...prev, created].sort((a,b) => a.class_number - b.class_number || a.name.localeCompare(b.name)));
      setSn('');
      load();
    } catch(err:any){
      if (err?.response?.status !== 401) {
        alert(err?.response?.data?.message || 'Could not add section');
      }
    } finally {
      setAddingSection(false);
    }
  }

  return <Layout>
    <PageHead title="Classes & Sections" sub="Build Classes 1–12 and their sections."/>
    <div className="two-col">
      <div className="panel">
        <h3>Add class</h3>
        <form className="inline" onSubmit={addClass}>
          <select value={n} onChange={e=>setN(e.target.value)}>
            <option value="">Select Class</option>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(x=><option key={x} value={x}>Class {x}</option>)}
          </select>
          <button type="submit" disabled={addingClass}>{addingClass ? 'Adding...' : 'Add Class'}</button>
        </form>
        <div className="list">
          {c.map(x=><div className="list-row" key={x.id}>
            <b>Class {x.class_number}</b>
            <span>{x.section_count || 0} sections</span>
          </div>)}
        </div>
      </div>

      <div className="panel">
        <h3>Add section</h3>
        <form className="inline" onSubmit={addSection}>
          <select value={cid || (c[0]?.id || '')} onChange={e=>setCid(e.target.value)}>
            {c.map(x=><option key={x.id} value={x.id}>Class {x.class_number}</option>)}
          </select>
          <input placeholder="Section (e.g. C)" value={sn} onChange={e=>setSn(e.target.value)}/>
          <button type="submit" disabled={addingSection}>{addingSection ? 'Adding...' : 'Add Section'}</button>
        </form>
        <div className="list">
          {s.map(x=><div className="list-row" key={x.id}>
            <b>Class {x.class_number} — Section {x.name}</b>
          </div>)}
        </div>
      </div>
    </div>
  </Layout>
}

/* ────── Subjects ────── */
function Subjects(){
  const {user}=useAuth();
  const [rows,setRows]=useState<any[]>([]);
  const [n,setN]=useState('');
  const [adding,setAdding]=useState(false);

  async function load(){
    try {
      const res = await api.get('/subjects');
      setRows(res.data || []);
    } catch(err) {
      console.error('Failed to load subjects:', err);
    }
  }

  useEffect(()=>{load()},[]);

  async function addSubject(e?: React.FormEvent){
    if (e) e.preventDefault();
    if (!n.trim()) {
      alert('Please enter a subject name (e.g. Economics).');
      return;
    }
    setAdding(true);
    try {
      const res = await api.post('/subjects', { name: n.trim() });
      const created = res.data;
      setRows(prev => [...prev, created]);
      setN('');
      load();
    } catch(err:any){
      alert(err?.response?.data?.message || 'Could not add subject');
    } finally {
      setAdding(false);
    }
  }

  return <Layout>
    <PageHead title="Subjects" sub="Subjects used by class routines."/>
    <div className="panel narrow">
      <form className="inline" onSubmit={addSubject}>
        <input placeholder="Subject name (e.g. Mathematics)" value={n} onChange={e=>setN(e.target.value)}/>
        <button type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add subject'}</button>
      </form>
      <div className="list">
        {rows.map(x=><div className="list-row" key={x.id}>
          <b>{x.name}</b>
        </div>)}
      </div>
    </div>
  </Layout>
}

/* ────── Routine ────── */
function Routine(){const {user}=useAuth();const [rows,setRows]=useState<any[]>([]);const [c,setC]=useState<any[]>([]);const [s,setS]=useState<any[]>([]);const [sub,setSub]=useState<any[]>([]);const [t,setT]=useState<any[]>([]);const [f,setF]=useState<any>({dayOfWeek:1});
  async function load(){const[a,b,d,e,g]=await Promise.all([api.get('/routines'),api.get('/classes'),api.get('/sections'),api.get('/subjects'),api.get('/teachers')]);setRows(a.data);setC(b.data);setS(d.data);setSub(e.data);setT(g.data)}useEffect(()=>{load()},[]);
  async function add(e:React.FormEvent){e.preventDefault();try{await api.post('/routines',f);setF({dayOfWeek:1});load()}catch(e:any){alert(e?.response?.data?.message||'Could not create routine')}}
  async function del(id:string){if(confirm('Delete this routine?')){await api.delete('/routines/'+id);load()}}
  return <Layout><PageHead title="Class Routine" sub="Create section-wise teacher and time-slot schedules."/><div className="panel"><form className="routine-form" onSubmit={add}><label>Day<select value={f.dayOfWeek} onChange={e=>setF({...f,dayOfWeek:Number(e.target.value)})}>{days.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label><label>Class<select required value={f.classId||''} onChange={e=>setF({...f,classId:e.target.value,sectionId:''})}><option value="">Select</option>{c.map(x=><option key={x.id} value={x.id}>Class {x.class_number}</option>)}</select></label><label>Section<select required value={f.sectionId||''} onChange={e=>setF({...f,sectionId:e.target.value})}><option value="">Select</option>{s.filter(x=>x.class_id===f.classId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Subject<select required value={f.subjectId||''} onChange={e=>setF({...f,subjectId:e.target.value})}><option value="">Select</option>{sub.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Teacher<select required value={f.teacherId||''} onChange={e=>setF({...f,teacherId:e.target.value})}><option value="">Select</option>{t.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Start<input required type="time" value={f.startTime||''} onChange={e=>setF({...f,startTime:e.target.value})}/></label><label>End<input required type="time" value={f.endTime||''} onChange={e=>setF({...f,endTime:e.target.value})}/></label><label>Room<input value={f.room||''} onChange={e=>setF({...f,room:e.target.value})}/></label><button>Create routine</button></form></div>
  <div className="table-wrap"><table><thead><tr><th>Day</th><th>Class</th><th>Subject</th><th>Teacher</th><th>Time</th><th>Room</th><th></th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{days[x.day_of_week]}</td><td>{x.class_number}-{x.section_name}</td><td>{x.subject_name}</td><td>{x.teacher_name}</td><td>{fmt(x.start_time)}–{fmt(x.end_time)}</td><td>{x.room||'—'}</td><td><button className="danger" onClick={()=>del(x.id)}>Delete</button></td></tr>)}</tbody></table></div></Layout>}

/* ────── Attendance ────── */
function Attendance(){
  const {user}=useAuth();
  const nav=useNavigate();
  const loc=useLocation();

  const getQueryParam = (name: string) => {
    const p = new URLSearchParams(loc.search).get(name);
    if (p) return p;
    try {
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) {
        const hp = new URLSearchParams(hash.slice(qIdx)).get(name);
        if (hp) return hp;
      }
      return new URLSearchParams(window.location.search).get(name);
    } catch {
      return null;
    }
  };

  const [classes,setClasses]=useState<any[]>([]);
  const [sections,setSections]=useState<any[]>([]);
  const [subjects,setSubjects]=useState<any[]>([]);
  const [routines,setRoutines]=useState<any[]>([]);

  const [selectedClassId,setSelectedClassId]=useState<string>('');
  const [selectedSectionId,setSelectedSectionId]=useState<string>('');
  const [selectedSubjectId,setSelectedSubjectId]=useState<string>('');
  const [attendanceDate,setAttendanceDate]=useState<string>(getQueryParam('date') || getQueryParam('attendance_date') || new Date().toISOString().slice(0,10));
  const [activeRoutine,setActiveRoutine]=useState<any>(null);

  const [students,setStudents]=useState<any[]>([]);
  const [checked,setChecked]=useState<Record<string,boolean>>({});
  const [search,setSearch]=useState<string>('');
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [summary,setSummary]=useState<any>(null);

  // Existing session & Re-attendance state
  const [existingSession, setExistingSession] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [studentStatusMap, setStudentStatusMap] = useState<Record<string, {
    status: 'PRESENT' | 'ABSENT' | 'LEFT_EARLY' | 'LATE';
    departurePeriod?: string;
    departureTime?: string;
    arrivalPeriod?: string;
    arrivalTime?: string;
    remarks?: string;
    updatedByName?: string;
  }>>({});
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);
  const [reattendanceSuccessMsg, setReattendanceSuccessMsg] = useState<string>('');

  // Modals state
  const [activeModal, setActiveModal] = useState<'EARLY_DEPARTURE' | 'LATE_ARRIVAL' | 'AUDIT_LOGS' | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  // Early departure form state
  const [depPeriod, setDepPeriod] = useState<string>('After 1st Period');
  const [depTime, setDepTime] = useState<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [depReason, setDepReason] = useState<string>('Parent / Guardian Picked Up Early');
  const [depRemarks, setDepRemarks] = useState<string>('');
  const [depNotify, setDepNotify] = useState<boolean>(true);

  // Late arrival form state
  const [arrPeriod, setArrPeriod] = useState<string>('Period 2');
  const [arrTime, setArrTime] = useState<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [arrReason, setArrReason] = useState<string>('Traffic / Commute Delay');
  const [arrRemarks, setArrRemarks] = useState<string>('');
  const [arrNotify, setArrNotify] = useState<boolean>(true);

  const [savingAction, setSavingAction] = useState<boolean>(false);

  // Email notifications state
  const [emailTarget, setEmailTarget] = useState<'ABSENT_ONLY' | 'PRESENT_ONLY' | 'ALL'>('ABSENT_ONLY');
  const [emailToParents, setEmailToParents] = useState(true);
  const [emailToStudents, setEmailToStudents] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{
    success: boolean;
    queued?: number;
    skipped?: number;
    alreadySent?: number;
    failed?: number;
    message?: string;
  } | null>(null);

  // Load initial reference data
  useEffect(()=>{
    async function init(){
      try {
        const [cRes,sRes,subRes,rRes] = await Promise.all([
          api.get('/classes'),
          api.get('/sections'),
          api.get('/subjects'),
          api.get('/teacher/routine/today').catch(()=>({data:[]}))
        ]);
        setClasses(cRes.data || []);
        setSections(sRes.data || []);
        setSubjects(subRes.data || []);
        const rList = rRes.data || [];
        setRoutines(rList);

        const routineId = getQueryParam('routine');
        const classIdParam = getQueryParam('classId');
        const sectionIdParam = getQueryParam('sectionId');
        const subjectIdParam = getQueryParam('subjectId');
        const dateParam = getQueryParam('date') || getQueryParam('attendance_date');
        if (dateParam) setAttendanceDate(dateParam);

        const matched = routineId
          ? rList.find((r:any)=>r.id===routineId)
          : (classIdParam ? rList.find((r:any)=>r.class_id===classIdParam && (!sectionIdParam || r.section_id===sectionIdParam)) : rList[0]);

        if (matched) {
          setActiveRoutine(matched);
          setSelectedClassId(matched.class_id);
          setSelectedSectionId(matched.section_id);
          setSelectedSubjectId(matched.subject_id);
        } else {
          const targetClassId = classIdParam || (cRes.data?.length > 0 ? cRes.data[0].id : '');
          setSelectedClassId(targetClassId);
          const availableSecs = (sRes.data || []).filter((s:any)=>
            !targetClassId || s.class_id === targetClassId || s.classId === targetClassId || String(s.class_number) === String(targetClassId)
          );
          const targetSecId = sectionIdParam || (availableSecs.length > 0 ? availableSecs[0].id : (sRes.data?.[0]?.id || ''));
          setSelectedSectionId(targetSecId);
          const targetSubId = subjectIdParam || (subRes.data?.length > 0 ? subRes.data[0].id : '');
          setSelectedSubjectId(targetSubId);
        }
      } catch (err) {
        console.error('Failed to load attendance station dependencies:', err);
      }
    }
    init();
  }, []);

  // Fetch today status helper
  const checkTodayStatus = useCallback(async (classId: string, sectionId: string, date: string, studentList: any[]) => {
    if (!classId) return;
    setLoadingStatus(true);
    try {
      const res = await api.get(`/teacher/attendance/today-status?classId=${classId}&sectionId=${sectionId}&date=${date}`);
      if (res.data?.hasAttendance && res.data.session) {
        const sess = res.data.session;
        setExistingSession(sess);
        setAuditLogs(res.data.auditLogs || []);

        const stMap: Record<string, any> = {};
        const chkMap: Record<string, boolean> = {};

        (res.data.records || []).forEach((r: any) => {
          const sId = String(r.studentId || r.student_id);
          const st = r.status || (r.is_present || r.isPresent ? 'PRESENT' : 'ABSENT');
          stMap[sId] = {
            status: st,
            departurePeriod: r.departurePeriod || r.departure_period,
            departureTime: r.departureTime || r.departure_time,
            arrivalPeriod: r.arrivalPeriod || r.arrival_period,
            arrivalTime: r.arrivalTime || r.arrival_time,
            remarks: r.remarks,
            updatedByName: r.updatedByName || r.updated_by_name
          };
          chkMap[sId] = (st === 'PRESENT' || st === 'LATE' || (st !== 'ABSENT' && (r.is_present || r.isPresent)));
        });

        // Ensure every student in roster has a status if not in records
        (studentList || []).forEach(s => {
          if (!stMap[s.id]) {
            stMap[s.id] = { status: 'PRESENT' };
            chkMap[s.id] = true;
          }
        });

        setStudentStatusMap(stMap);
        setChecked(chkMap);
        setDone(true);
        setSummary({
          sessionId: sess.id,
          total: sess.total_count ?? sess.totalCount,
          present: sess.present_count ?? sess.presentCount,
          absent: sess.absent_count ?? sess.absentCount,
          leftEarly: sess.left_early_count ?? sess.leftEarlyCount ?? 0,
          late: sess.late_count ?? sess.lateCount ?? 0,
          isReattendance: sess.is_reattendance ?? sess.isReattendance,
          teacherName: sess.teacher_name ?? sess.teacherName,
          lastModifiedName: sess.last_modified_name ?? sess.lastModifiedName
        });
      } else {
        setExistingSession(null);
        setAuditLogs([]);
        const initChecked: Record<string, boolean> = {};
        const initMap: Record<string, any> = {};
        (studentList || []).forEach(s => {
          initChecked[s.id] = true;
          initMap[s.id] = { status: 'PRESENT' };
        });
        setChecked(initChecked);
        setStudentStatusMap(initMap);
        setDone(false);
        setSummary(null);
      }
    } catch (err) {
      console.error('Failed to query today attendance status:', err);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Fetch students when class or section changes
  useEffect(()=>{
    if (!selectedClassId || !selectedSectionId) return;
    api.get(`/teacher/students/${selectedClassId}/${selectedSectionId}`)
      .then(res => {
        const list = res.data || [];
        setStudents(list);
        checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, list);
      })
      .catch(() => {
        // Fallback to /students
        api.get('/students').then(res => {
          const matched = (res.data || []).filter((s:any)=>
            (String(s.class_id) === String(selectedClassId) || String(s.classId) === String(selectedClassId) || String(s.class_number) === String(selectedClassId)) &&
            (!selectedSectionId || String(s.section_id) === String(selectedSectionId) || String(s.sectionId) === String(selectedSectionId) || s.section_name === 'A' || s.section === 'A')
          );
          setStudents(matched);
          checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, matched);
        }).catch(()=>{});
      });
  }, [selectedClassId, selectedSectionId, attendanceDate, checkTodayStatus]);

  function switchRoutine(r: any) {
    setActiveRoutine(r);
    setSelectedClassId(r.class_id);
    setSelectedSectionId(r.section_id);
    setSelectedSubjectId(r.subject_id);
    setDone(false);
  }

  const selectAll = (val: boolean) => {
    const updatedChk: Record<string, boolean> = {};
    const updatedMap = { ...studentStatusMap };
    students.forEach(s => {
      updatedChk[s.id] = val;
      updatedMap[s.id] = {
        ...updatedMap[s.id],
        status: val ? 'PRESENT' : 'ABSENT'
      };
    });
    setChecked(updatedChk);
    setStudentStatusMap(updatedMap);
  };

  const leftEarlyCount = students.filter(s => studentStatusMap[s.id]?.status === 'LEFT_EARLY').length;
  const lateCount = students.filter(s => studentStatusMap[s.id]?.status === 'LATE').length;
  const presentCount = students.filter(s => {
    const st = studentStatusMap[s.id]?.status;
    if (st === 'PRESENT') return true;
    if (st === 'LATE') return true;
    if (st === 'LEFT_EARLY' || st === 'ABSENT') return false;
    return !!checked[s.id];
  }).length;
  const absentCount = Math.max(0, students.length - presentCount - leftEarlyCount);
  const ratePct = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;

  const filteredStudents = students.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || String(s.roll_number || '').toLowerCase().includes(q);
  });

  // Early Departure Handler
  function openEarlyDeparture(student: any) {
    setSelectedStudent(student);
    const existing = studentStatusMap[student.id];
    setDepPeriod(existing?.departurePeriod || 'After 1st Period');
    setDepTime(existing?.departureTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setDepReason('Parent / Guardian Picked Up Early');
    setDepRemarks(existing?.remarks || '');
    setDepNotify(true);
    setActiveModal('EARLY_DEPARTURE');
  }

  // Late Arrival Handler
  function openLateArrival(student: any) {
    setSelectedStudent(student);
    const existing = studentStatusMap[student.id];
    setArrPeriod(existing?.arrivalPeriod || 'Period 2');
    setArrTime(existing?.arrivalTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setArrReason('Traffic / Commute Delay');
    setArrRemarks(existing?.remarks || '');
    setArrNotify(true);
    setActiveModal('LATE_ARRIVAL');
  }

  async function submitEarlyDeparture() {
    if (!selectedStudent) return;
    setSavingAction(true);
    const fullReason = depReason + (depRemarks ? ` (${depRemarks})` : '');
    try {
      if (existingSession?.id) {
        const res = await api.put(`/teacher/attendance/${existingSession.id}/student/${selectedStudent.id}`, {
          status: 'LEFT_EARLY',
          departurePeriod: depPeriod,
          departureTime: depTime,
          reason: fullReason,
          notifyParent: depNotify
        });
        setExistingSession(res.data.session);
        setReattendanceSuccessMsg(`✓ ${selectedStudent.name} marked as Left Early (${depPeriod}). Parent alert queued.`);
        checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
      } else {
        setStudentStatusMap(prev => ({
          ...prev,
          [selectedStudent.id]: {
            status: 'LEFT_EARLY',
            departurePeriod: depPeriod,
            departureTime: depTime,
            remarks: fullReason
          }
        }));
        setChecked(prev => ({ ...prev, [selectedStudent.id]: false }));
        setReattendanceSuccessMsg(`✓ Marked ${selectedStudent.name} as Left Early (${depPeriod}) for upcoming submission.`);
      }
      setActiveModal(null);
      setTimeout(() => setReattendanceSuccessMsg(''), 6000);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to update student status');
    } finally {
      setSavingAction(false);
    }
  }

  async function submitLateArrival() {
    if (!selectedStudent) return;
    setSavingAction(true);
    const fullReason = arrReason + (arrRemarks ? ` (${arrRemarks})` : '');
    try {
      if (existingSession?.id) {
        const res = await api.put(`/teacher/attendance/${existingSession.id}/student/${selectedStudent.id}`, {
          status: 'LATE',
          arrivalPeriod: arrPeriod,
          arrivalTime: arrTime,
          reason: fullReason,
          notifyParent: arrNotify
        });
        setExistingSession(res.data.session);
        setReattendanceSuccessMsg(`✓ ${selectedStudent.name} marked as Late Arrival (${arrPeriod}). Parent alert queued.`);
        checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
      } else {
        setStudentStatusMap(prev => ({
          ...prev,
          [selectedStudent.id]: {
            status: 'LATE',
            arrivalPeriod: arrPeriod,
            arrivalTime: arrTime,
            remarks: fullReason
          }
        }));
        setChecked(prev => ({ ...prev, [selectedStudent.id]: true }));
        setReattendanceSuccessMsg(`✓ Marked ${selectedStudent.name} as Late Arrival (${arrPeriod}) for upcoming submission.`);
      }
      setActiveModal(null);
      setTimeout(() => setReattendanceSuccessMsg(''), 6000);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to update student status');
    } finally {
      setSavingAction(false);
    }
  }

  async function quickToggleStudent(s: any, newStatus: 'PRESENT' | 'ABSENT') {
    if (existingSession?.id) {
      setBusy(true);
      try {
        await api.put(`/teacher/attendance/${existingSession.id}/student/${s.id}`, {
          status: newStatus,
          reason: `Quick toggle to ${newStatus} by ${user?.name || 'Faculty'}`
        });
        checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
      } catch (err: any) {
        alert(err?.response?.data?.message || 'Failed to toggle status');
      } finally {
        setBusy(false);
      }
    } else {
      setChecked(prev => ({ ...prev, [s.id]: newStatus === 'PRESENT' }));
      setStudentStatusMap(prev => ({
        ...prev,
        [s.id]: { status: newStatus }
      }));
    }
  }

  async function submitWholeClassReattendance() {
    if (!existingSession?.id) return submit();
    setBusy(true);
    try {
      const recordsPayload = students.map(s => {
        const st = studentStatusMap[s.id] || {};
        const isPres = checked[s.id];
        let status = st.status;
        if (!status) {
          status = isPres ? 'PRESENT' : 'ABSENT';
        } else if (status === 'PRESENT' && !isPres) {
          status = 'ABSENT';
        } else if (status === 'ABSENT' && isPres) {
          status = 'PRESENT';
        }
        return {
          studentId: s.id,
          studentName: s.name,
          rollNumber: s.roll_number,
          status,
          departurePeriod: st.departurePeriod,
          departureTime: st.departureTime,
          arrivalPeriod: st.arrivalPeriod,
          arrivalTime: st.arrivalTime,
          remarks: st.remarks
        };
      });

      const res = await api.post(`/teacher/attendance/${existingSession.id}/reattendance`, {
        records: recordsPayload,
        reason: `Whole-class period verification / re-attendance by ${user?.name || 'Faculty'}`,
        notifyParents: false
      });
      setExistingSession(res.data.session);
      setReattendanceSuccessMsg('✓ Whole-class re-attendance verified and saved to audit trail.');
      checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
      setTimeout(() => setReattendanceSuccessMsg(''), 6000);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to save whole-class re-attendance');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!selectedClassId || !selectedSectionId) {
      alert('Please select both Class and Section.');
      return;
    }
    const cObj = classes.find(c => c.id === selectedClassId);
    const sObj = sections.find(s => s.id === selectedSectionId);
    const subObj = subjects.find(s => s.id === selectedSubjectId);

    setBusy(true);
    try {
      const recordsPayload = students.map(s => {
        const st = studentStatusMap[s.id] || {};
        const isPres = checked[s.id];
        let status = st.status;
        if (!status) {
          status = isPres ? 'PRESENT' : 'ABSENT';
        } else if (status === 'PRESENT' && !isPres) {
          status = 'ABSENT';
        } else if (status === 'ABSENT' && isPres) {
          status = 'PRESENT';
        }
        return {
          studentId: s.id,
          studentName: s.name,
          rollNumber: s.roll_number,
          status,
          departurePeriod: st.departurePeriod,
          departureTime: st.departureTime,
          arrivalPeriod: st.arrivalPeriod,
          arrivalTime: st.arrivalTime,
          remarks: st.remarks
        };
      });

      const res = await api.post('/teacher/attendance', {
        classId: selectedClassId,
        classNumber: cObj?.class_number ?? cObj?.classNumber ?? null,
        sectionId: selectedSectionId,
        sectionName: sObj?.name || sObj?.sectionName || '',
        subjectId: selectedSubjectId || null,
        subjectName: subObj?.name || '',
        startTime: activeRoutine?.start_time ? fmt(activeRoutine.start_time) : '09:00:00',
        endTime: activeRoutine?.end_time ? fmt(activeRoutine.end_time) : '09:45:00',
        attendanceDate,
        records: recordsPayload,
        studentIds: students.map(s => s.id),
        presentStudentIds: students.filter(s => checked[s.id]).map(s => s.id)
      });
      setSummary(res.data);
      setDone(true);
      checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Attendance submission failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendAttendanceEmails() {
    if (!summary?.sessionId) {
      alert('Attendance session ID not found. Please confirm attendance first.');
      return;
    }
    const recipientTypes: ('PARENT' | 'STUDENT')[] = [];
    if (emailToParents) recipientTypes.push('PARENT');
    if (emailToStudents) recipientTypes.push('STUDENT');
    if (recipientTypes.length === 0) {
      alert('Please select at least one recipient type (Parents or Students).');
      return;
    }

    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await api.post('/notifications-v11/attendance-email', {
        sessionId: summary.sessionId,
        targetType: emailTarget,
        recipientTypes,
        classId: selectedClassId,
        sectionId: selectedSectionId
      });
      setEmailResult({
        success: true,
        queued: res.data.queued,
        skipped: res.data.skipped,
        alreadySent: res.data.alreadySent,
        failed: res.data.failed,
        message: `Dispatched: ${res.data.queued} email(s) queued for delivery, ${res.data.skipped} skipped (no email on record), ${res.data.alreadySent} already sent.`
      });
    } catch (e: any) {
      setEmailResult({
        success: false,
        message: e?.response?.data?.message || 'Failed to dispatch attendance emails'
      });
    } finally {
      setEmailSending(false);
    }
  }

  const targetStudentCount =
    emailTarget === 'ABSENT_ONLY' ? (summary?.absent ?? absentCount) :
    emailTarget === 'PRESENT_ONLY' ? (summary?.present ?? presentCount) :
    (summary?.total ?? students.length);
  const recipientMultiplier = (emailToParents ? 1 : 0) + (emailToStudents ? 1 : 0);
  const estimatedEmails = targetStudentCount * recipientMultiplier;

  const currentClass = classes.find(c => c.id === selectedClassId);
  const currentSection = sections.find(s => s.id === selectedSectionId);
  const currentSubject = subjects.find(s => s.id === selectedSubjectId);

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: existingSession ? '#10b981' : '#f59e0b' }}></span>
            <p className="eyebrow" style={{ margin: 0 }}>ATTENDANCE CONTROL & RE-ATTENDANCE STATION</p>
          </div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Daily Class Attendance</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Multi-teacher synchronized roll-call with period-by-period re-attendance, early departure tracking, and automated parent alerts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary" onClick={() => nav('/dashboard')}>
            ← Back to Dashboard
          </button>
          <button className="secondary" onClick={() => nav('/attendance-history')}>
            Session History →
          </button>
        </div>
      </div>

      {/* Routine Quick Switchers */}
      {routines.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 8 }}>
            Today's Scheduled Periods ({routines.length})
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {routines.slice(0, 6).map((r: any) => {
              const isActive = activeRoutine?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => switchRoutine(r)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: isActive ? '2px solid #2563eb' : '1px solid var(--border)',
                    background: isActive ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
                    color: isActive ? '#2563eb' : 'var(--text)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>Class {r.class_number}-{r.section_name}</span>
                  <span style={{ opacity: 0.7 }}>· {r.subject_name} ({fmt(r.start_time)})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cross-Teacher Live Session Banner (When attendance has already been taken) */}
      {existingSession && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(37, 99, 235, 0.06) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: '#10b981', color: '#ffffff', fontWeight: 700, padding: '3px 8px', fontSize: 11 }}>
                ✓ ATTENDANCE RECORDED FOR TODAY
              </span>
              {existingSession.is_reattendance && (
                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontWeight: 700, padding: '3px 8px', fontSize: 11 }}>
                  🔄 RE-ATTENDANCE LOGGED ({existingSession.reattendance_count || 1}x)
                </span>
              )}
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                Taken by: <strong style={{ color: '#2563eb' }}>{existingSession.teacher_name || 'Faculty Member'}</strong>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ({fmt(existingSession.start_time)} – {fmt(existingSession.end_time)})
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
              {existingSession.is_reattendance
                ? `Last modified by ${existingSession.last_modified_name || 'Faculty'}. Any assigned subject teacher can adjust early departures (e.g. left after 1st period) or late arrivals.`
                : 'All teachers assigned to this class can view submitted records and make official re-attendance adjustments (e.g. early departure or late arrival).'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="secondary"
              onClick={() => setActiveModal('AUDIT_LOGS')}
              style={{ fontSize: 12.5, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <HistoryIcon size={14} /> Audit Trail ({auditLogs.length})
            </button>
            <button
              onClick={submitWholeClassReattendance}
              disabled={busy}
              style={{ fontSize: 12.5, padding: '6px 14px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <RefreshCw size={14} className={busy ? 'spin' : ''} /> {busy ? 'Saving...' : 'Save Re-attendance'}
            </button>
          </div>
        </div>
      )}

      {/* Temporary Success Alert */}
      {reattendanceSuccessMsg && (
        <div className="admin-alert-banner success" style={{ marginBottom: 16 }}>
          <div className="alert-left">
            <CheckCircle2 size={20} color="#059669" />
            <strong style={{ fontSize: 13.5 }}>{reattendanceSuccessMsg}</strong>
          </div>
          <button className="secondary" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setReattendanceSuccessMsg('')}>✕</button>
        </div>
      )}

      {/* Selectors Bar */}
      <div className="attendance-station-header">
        <div className="attendance-selectors">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Class:
            <select
              value={selectedClassId}
              onChange={(e) => {
                const cid = e.target.value;
                setSelectedClassId(cid);
                setActiveRoutine(null);
                const matchingSec = sections.find(s => s.class_id === cid || s.classId === cid || String(s.class_number) === String(cid));
                if (matchingSec) setSelectedSectionId(matchingSec.id);
                else {
                  const anySec = sections.filter(s => s.class_id === cid || s.classId === cid)[0];
                  if (anySec) setSelectedSectionId(anySec.id);
                }
              }}
              style={{ marginLeft: 6 }}
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>Class {c.class_number ?? c.classNumber ?? c.name}</option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Section:
            <select
              value={selectedSectionId}
              onChange={(e) => {
                setSelectedSectionId(e.target.value);
                setActiveRoutine(null);
              }}
              style={{ marginLeft: 6 }}
            >
              {sections
                .filter(s => !selectedClassId || s.class_id === selectedClassId || s.classId === selectedClassId || String(s.class_number) === String(selectedClassId))
                .map(s => (
                  <option key={s.id} value={s.id}>Section {s.name || s.sectionName || s.section}</option>
                ))}
            </select>
          </label>

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Subject:
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              style={{ marginLeft: 6 }}
            >
              {subjects.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Date:
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              style={{ marginLeft: 6 }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="roster-stat-pill present">
            <CheckCircle2 size={15} /> {presentCount} Present
          </div>
          {leftEarlyCount > 0 && (
            <div className="roster-stat-pill left-early">
              <DoorOpen size={15} /> {leftEarlyCount} Left Early
            </div>
          )}
          {lateCount > 0 && (
            <div className="roster-stat-pill late">
              <Clock size={15} /> {lateCount} Late
            </div>
          )}
          <div className="roster-stat-pill absent">
            <AlertCircle size={15} /> {absentCount} Absent
          </div>
          <div className="roster-stat-pill">
            Rate: {ratePct}%
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {done && (
        <div className="admin-alert-banner success" style={{ marginBottom: 20 }}>
          <div className="alert-left">
            <CheckCircle2 size={24} color="#059669" />
            <div>
              <strong>Daily Attendance Confirmed for Class {currentClass?.class_number || ''}-{currentSection?.name || ''}</strong>
              <p>
                Session date: {attendanceDate}. {summary?.present ?? presentCount} present, {leftEarlyCount} left early, {lateCount} late, {summary?.absent ?? absentCount} absent.
                {summary?.absent > 0 ? ` Absent notification messages queued for ${summary.absent} student(s).` : ' All students attended.'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="alert-action-btn" style={{ background: '#059669' }} onClick={() => nav('/dashboard')}>
              Go to Dashboard →
            </button>
            <button className="secondary" onClick={() => setActiveModal('AUDIT_LOGS')}>
              View Audit Trail
            </button>
          </div>
        </div>
      )}

      {/* Attendance Email Action Card */}
      {done && (
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid #cbd5e1',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 24,
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                  Dispatch Institutional Email Alerts
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
                Send professional, branded notification emails to parents and students for this confirmed attendance session.
              </p>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12.5,
              fontWeight: 600
            }}>
              <span>Estimated Delivery: {estimatedEmails} recipient{estimatedEmails !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 18 }}>
            {/* Filter Target */}
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                Target Attendance Group
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', fontWeight: emailTarget === 'ABSENT_ONLY' ? 600 : 400 }}>
                  <input
                    type="radio"
                    name="emailTarget"
                    value="ABSENT_ONLY"
                    checked={emailTarget === 'ABSENT_ONLY'}
                    onChange={() => setEmailTarget('ABSENT_ONLY')}
                  />
                  <span>Absent Students Only ({summary?.absent ?? absentCount})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', fontWeight: emailTarget === 'PRESENT_ONLY' ? 600 : 400 }}>
                  <input
                    type="radio"
                    name="emailTarget"
                    value="PRESENT_ONLY"
                    checked={emailTarget === 'PRESENT_ONLY'}
                    onChange={() => setEmailTarget('PRESENT_ONLY')}
                  />
                  <span>Present Students Only ({summary?.present ?? presentCount})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', fontWeight: emailTarget === 'ALL' ? 600 : 400 }}>
                  <input
                    type="radio"
                    name="emailTarget"
                    value="ALL"
                    checked={emailTarget === 'ALL'}
                    onChange={() => setEmailTarget('ALL')}
                  />
                  <span>Entire Class ({summary?.total ?? students.length} students)</span>
                </label>
              </div>
            </div>

            {/* Recipient Contacts */}
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                Recipient Contact Addresses
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', fontWeight: emailToParents ? 600 : 400 }}>
                  <input
                    type="checkbox"
                    checked={emailToParents}
                    onChange={e => setEmailToParents(e.target.checked)}
                  />
                  <span>Send to Parent / Guardian Email (Primary)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', fontWeight: emailToStudents ? 600 : 400 }}>
                  <input
                    type="checkbox"
                    checked={emailToStudents}
                    onChange={e => setEmailToStudents(e.target.checked)}
                  />
                  <span>Send to Student Email (Institutional ID)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 12.5, color: '#64748b' }}>
              ℹ️ Individual MIME emails are delivered separately. Contact privacy is strictly preserved.
            </div>
            <button
              onClick={sendAttendanceEmails}
              disabled={emailSending || estimatedEmails === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: 600,
                padding: '9px 18px',
                borderRadius: 8,
                border: 'none',
                cursor: emailSending || estimatedEmails === 0 ? 'not-allowed' : 'pointer',
                opacity: emailSending || estimatedEmails === 0 ? 0.6 : 1
              }}
            >
              <Send size={15} />
              {emailSending ? 'Queueing Emails...' : `Send Attendance Emails (${estimatedEmails})`}
            </button>
          </div>

          {/* Results Feedback */}
          {emailResult && (
            <div style={{
              marginTop: 14,
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: emailResult.success ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${emailResult.success ? '#bbf7d0' : '#fecaca'}`,
              color: emailResult.success ? '#166534' : '#991b1b'
            }}>
              {emailResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{emailResult.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Roster Controls */}
      <div className="attendance-roster-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => selectAll(true)} style={{ fontSize: 12.5, padding: '6px 14px' }}>
            ✓ Select All Present
          </button>
          <button className="secondary" onClick={() => selectAll(false)} style={{ fontSize: 12.5, padding: '6px 14px' }}>
            ✕ Clear All
          </button>
        </div>

        <div style={{ width: 260 }}>
          <input
            type="text"
            placeholder="Search students in this class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 12.5
            }}
          />
        </div>
      </div>

      {/* Instruction Note */}
      <div className="instruction" style={{ marginBottom: 14 }}>
        <CheckCircle2 size={16} />
        <span>
          {existingSession
            ? 'Re-attendance Station Active: All assigned teachers can adjust early departures (e.g. student left after 1st period), record late arrivals, or save a re-roll call.'
            : 'Check only students who are physically present. Unchecked students are marked absent and their guardians will be notified.'}
        </span>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Users size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3>No students found in this section</h3>
          <p className="muted">
            {user?.role === 'TEACHER'
              ? 'No students are currently enrolled in this section. Please contact your School Administrator to enroll students.'
              : `Add students to Class ${currentClass?.class_number || ''}-${currentSection?.name || ''} in the Student Directory.`}
          </p>
          {(user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <button onClick={() => nav('/students?enroll=true')} style={{ marginTop: 12 }}>
              + Enroll Student Now
            </button>
          )}
        </div>
      ) : (
        <div className="attendance-list">
          {filteredStudents.map((s: any) => {
            const stObj = studentStatusMap[s.id] || {};
            const rawStatus = stObj.status || (checked[s.id] ? 'PRESENT' : 'ABSENT');
            const isLeftEarly = rawStatus === 'LEFT_EARLY';
            const isLate = rawStatus === 'LATE';
            const isPresent = rawStatus === 'PRESENT' || isLate;
            const isAbsent = rawStatus === 'ABSENT';

            return (
              <div
                className="student-row"
                key={s.id}
                style={{
                  background: isLeftEarly
                    ? 'rgba(245, 158, 11, 0.05)'
                    : isLate
                    ? 'rgba(37, 99, 235, 0.05)'
                    : isPresent
                    ? 'var(--bg-card)'
                    : 'rgba(239, 68, 68, 0.04)',
                  borderColor: isLeftEarly
                    ? 'rgba(245, 158, 11, 0.4)'
                    : isLate
                    ? 'rgba(37, 99, 235, 0.3)'
                    : isPresent
                    ? 'var(--border)'
                    : 'rgba(239, 68, 68, 0.3)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 10,
                  marginBottom: 8,
                  gap: 12,
                  flexWrap: 'wrap'
                }}
              >
                {/* Left: Roll and Student Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span
                    className="roll"
                    style={{
                      background: isLeftEarly ? '#fef3c7' : isLate ? '#dbeafe' : isPresent ? '#eff6ff' : '#fee2e2',
                      color: isLeftEarly ? '#b45309' : isLate ? '#1d4ed8' : isPresent ? '#2563eb' : '#dc2626',
                      fontWeight: 700,
                      minWidth: 32,
                      textAlign: 'center'
                    }}
                  >
                    {s.roll_number || '•'}
                  </span>
                  <div>
                    <strong style={{ fontSize: 14, color: 'var(--text)' }}>{s.name}</strong>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {s.parent_name ? `Parent: ${s.parent_name}` : 'Guardian registered'} · {s.parent_sms_number || 'Mobile on file'}
                    </div>
                    {/* Status Annotations for Re-attendance */}
                    {isLeftEarly && (
                      <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <DoorOpen size={13} />
                        <span>Left early {stObj.departurePeriod ? `(${stObj.departurePeriod})` : ''} at {stObj.departureTime || '—'}{stObj.remarks ? `: ${stObj.remarks}` : ''}</span>
                      </div>
                    )}
                    {isLate && (
                      <div style={{ fontSize: 11.5, color: '#1d4ed8', marginTop: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} />
                        <span>Late arrival {stObj.arrivalPeriod ? `(${stObj.arrivalPeriod})` : ''} at {stObj.arrivalTime || '—'}{stObj.remarks ? `: ${stObj.remarks}` : ''}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Status Pill & Re-attendance Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Status Indicator Chip */}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 100,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: isLeftEarly
                        ? 'rgba(245, 158, 11, 0.15)'
                        : isLate
                        ? 'rgba(37, 99, 235, 0.12)'
                        : isPresent
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(239, 68, 68, 0.12)',
                      color: isLeftEarly ? '#b45309' : isLate ? '#2563eb' : isPresent ? '#059669' : '#dc2626'
                    }}
                  >
                    {isLeftEarly ? '🚪 LEFT EARLY' : isLate ? '⏰ LATE' : isPresent ? '✓ PRESENT' : '✕ ABSENT'}
                  </span>

                  {/* Re-attendance Specific Quick Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {/* Early Departure Button (Scenario: Student came 1st period and went after 1st period) */}
                    {(isPresent || isLeftEarly) && (
                      <button
                        type="button"
                        onClick={() => openEarlyDeparture(s)}
                        title="Mark student early departure (e.g. left after 1st period)"
                        style={{
                          fontSize: 11.5,
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: isLeftEarly ? '1px solid #f59e0b' : '1px solid var(--border)',
                          background: isLeftEarly ? '#fef3c7' : 'var(--bg-subtle)',
                          color: isLeftEarly ? '#b45309' : 'var(--text)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600
                        }}
                      >
                        <DoorOpen size={13} />
                        {isLeftEarly ? 'Edit Departure' : 'Left Early'}
                      </button>
                    )}

                    {/* Late Arrival Button */}
                    {(isAbsent || isLate) && (
                      <button
                        type="button"
                        onClick={() => openLateArrival(s)}
                        title="Mark student late arrival"
                        style={{
                          fontSize: 11.5,
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: isLate ? '1px solid #3b82f6' : '1px solid var(--border)',
                          background: isLate ? '#dbeafe' : 'var(--bg-subtle)',
                          color: isLate ? '#1d4ed8' : 'var(--text)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600
                        }}
                      >
                        <Clock size={13} />
                        {isLate ? 'Edit Late' : 'Late Arrival'}
                      </button>
                    )}

                    {/* Toggle Present / Absent Quick Button */}
                    {isPresent && (
                      <button
                        type="button"
                        onClick={() => quickToggleStudent(s, 'ABSENT')}
                        title="Mark Absent"
                        style={{
                          fontSize: 11.5,
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Mark Absent
                      </button>
                    )}

                    {(isAbsent || isLeftEarly) && (
                      <button
                        type="button"
                        onClick={() => quickToggleStudent(s, 'PRESENT')}
                        title="Mark Present"
                        style={{
                          fontSize: 11.5,
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          background: 'rgba(16, 185, 129, 0.08)',
                          color: '#059669',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Mark Present
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Submit / Re-attendance Action Bar */}
      {students.length > 0 && (
        <div className="submit-bar" style={{ marginTop: 20 }}>
          <div>
            <strong>Summary: {presentCount} Present</strong>, {leftEarlyCount > 0 ? `${leftEarlyCount} Left Early, ` : ''}{lateCount > 0 ? `${lateCount} Late, ` : ''}{absentCount} Absent ({ratePct}% Rate)
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {existingSession && (
              <button
                type="button"
                className="secondary"
                onClick={() => setActiveModal('AUDIT_LOGS')}
                style={{ fontSize: 13 }}
              >
                📜 Audit Trail ({auditLogs.length})
              </button>
            )}
            <button
              disabled={busy}
              onClick={existingSession ? submitWholeClassReattendance : submit}
              style={{ minWidth: 160 }}
            >
              {busy ? 'Saving…' : existingSession ? '🔄 Save Re-attendance' : 'Submit Attendance'}
            </button>
          </div>
        </div>
      )}

      {/* ────── MODAL: Early Departure (Scenario: Came 1st period and left after 1st period) ────── */}
      {activeModal === 'EARLY_DEPARTURE' && selectedStudent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 520,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#fef3c7', color: '#b45309', padding: 8, borderRadius: 10, display: 'inline-flex' }}>
                  <DoorOpen size={20} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Student Early Departure</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Official re-attendance departure adjustment</p>
                </div>
              </div>
              <button className="secondary" onClick={() => setActiveModal(null)} style={{ padding: '4px 8px', borderRadius: 6 }}>✕</button>
            </div>

            {/* Student Card Summary */}
            <div style={{ background: 'var(--bg-subtle, #f8fafc)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedStudent.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Roll: {selectedStudent.roll_number || '—'} · Parent: {selectedStudent.parent_name || 'Guardian'} ({selectedStudent.parent_sms_number || 'Mobile on record'})
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Departure Period */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Departure Period / Timing:
                </label>
                <select
                  value={depPeriod}
                  onChange={(e) => setDepPeriod(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  <option value="After 1st Period">After 1st Period (Attended 1st Period Only)</option>
                  <option value="During 1st Period">During 1st Period (Emergency dismissal)</option>
                  <option value="After 2nd Period">After 2nd Period</option>
                  <option value="After 3rd Period / Recess">After 3rd Period / Recess</option>
                  <option value="After 4th Period">After 4th Period</option>
                  <option value="After 5th Period">After 5th Period</option>
                  <option value="Custom Departure">Custom Departure</option>
                </select>
              </div>

              {/* Departure Time */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Exact Departure Time:
                </label>
                <input
                  type="text"
                  value={depTime}
                  onChange={(e) => setDepTime(e.target.value)}
                  placeholder="e.g. 10:15 AM"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

              {/* Departure Reason */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Reason for Early Departure:
                </label>
                <select
                  value={depReason}
                  onChange={(e) => setDepReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  <option value="Parent / Guardian Picked Up Early">Parent / Guardian Picked Up Early</option>
                  <option value="Medical Emergency / Illness (Sick Bay)">Medical Emergency / Illness (Sick Bay)</option>
                  <option value="Doctor / Hospital Appointment">Doctor / Hospital Appointment</option>
                  <option value="Official School Representation (Sports / Olympiad)">Official School Representation (Sports / Olympiad)</option>
                  <option value="Approved Family Leave / Urgent Matter">Approved Family Leave / Urgent Matter</option>
                  <option value="Unexcused Campus Departure">Unexcused Campus Departure</option>
                  <option value="Other Discretionary Reason">Other Discretionary Reason</option>
                </select>
              </div>

              {/* Remarks & Gate Pass */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Gate Pass # / Teacher Notes:
                </label>
                <input
                  type="text"
                  value={depRemarks}
                  onChange={(e) => setDepRemarks(e.target.value)}
                  placeholder="e.g. Gate pass GP-104 issued. Parent Mrs. Sen collected student."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

              {/* Notification Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={depNotify}
                  onChange={(e) => setDepNotify(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Dispatch early departure alert to Parent / Guardian (SMS & Portal)</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button className="secondary" onClick={() => setActiveModal(null)} disabled={savingAction}>
                Cancel
              </button>
              <button
                onClick={submitEarlyDeparture}
                disabled={savingAction}
                style={{ background: '#d97706', color: '#ffffff', border: 'none', padding: '9px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                {savingAction ? 'Recording Departure…' : '✓ Confirm Early Departure'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────── MODAL: Late Arrival ────── */}
      {activeModal === 'LATE_ARRIVAL' && selectedStudent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 520,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: 8, borderRadius: 10, display: 'inline-flex' }}>
                  <Clock size={20} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Student Late Arrival</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Convert absent record to late arrival</p>
                </div>
              </div>
              <button className="secondary" onClick={() => setActiveModal(null)} style={{ padding: '4px 8px', borderRadius: 6 }}>✕</button>
            </div>

            <div style={{ background: 'var(--bg-subtle, #f8fafc)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedStudent.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Roll: {selectedStudent.roll_number || '—'} · Parent: {selectedStudent.parent_name || 'Guardian'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Arrival Period:
                </label>
                <select
                  value={arrPeriod}
                  onChange={(e) => setArrPeriod(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  <option value="Period 2">Period 2 (Arrived during 2nd period)</option>
                  <option value="Period 3">Period 3</option>
                  <option value="After Recess">After Recess / Mid-Day</option>
                  <option value="Period 4">Period 4</option>
                  <option value="Other Period">Other Period</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Arrival Time:
                </label>
                <input
                  type="text"
                  value={arrTime}
                  onChange={(e) => setArrTime(e.target.value)}
                  placeholder="e.g. 10:05 AM"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Reason for Late Arrival:
                </label>
                <select
                  value={arrReason}
                  onChange={(e) => setArrReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  <option value="Traffic / Commute Delay">Traffic / Commute Delay</option>
                  <option value="Doctor / Dental Appointment">Doctor / Dental Appointment</option>
                  <option value="Parent Note Provided">Parent Note Provided</option>
                  <option value="Weather / Transport Issue">Weather / Transport Issue</option>
                  <option value="Unexcused Late Arrival">Unexcused Late Arrival</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Remarks:
                </label>
                <input
                  type="text"
                  value={arrRemarks}
                  onChange={(e) => setArrRemarks(e.target.value)}
                  placeholder="Optional explanatory notes..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={arrNotify}
                  onChange={(e) => setArrNotify(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Notify Parent / Guardian of Late Arrival</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button className="secondary" onClick={() => setActiveModal(null)} disabled={savingAction}>
                Cancel
              </button>
              <button
                onClick={submitLateArrival}
                disabled={savingAction}
                style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '9px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                {savingAction ? 'Saving Late Arrival…' : '✓ Confirm Late Arrival'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────── MODAL: Re-attendance Audit Trail ────── */}
      {activeModal === 'AUDIT_LOGS' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 700,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HistoryIcon size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                  Session Re-attendance Audit Trail
                </h3>
              </div>
              <button className="secondary" onClick={() => setActiveModal(null)} style={{ padding: '4px 8px', borderRadius: 6 }}>✕</button>
            </div>

            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                Immutable historical record of all attendance submissions, re-roll calls, early departure adjustments, and late arrivals for this session.
              </p>

              {auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                  <HistoryIcon size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No re-attendance events recorded yet</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12 }}>Initial roll-call was submitted with no subsequent adjustments.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {auditLogs.map((log: any, idx: number) => {
                    const timeStr = log.created_at || log.createdAt ? new Date(log.created_at || log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                    const prevSt = log.previous_status || log.previousStatus || '—';
                    const newSt = log.new_status || log.newStatus || '—';
                    return (
                      <div
                        key={log.id || idx}
                        style={{
                          background: 'var(--bg-subtle, #f8fafc)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '12px 14px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                            {log.student_name || log.studentName || 'Student Record'}
                          </span>
                          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {timeStr}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, marginBottom: 4 }}>
                          <span className="badge" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--text-muted)' }}>{prevSt}</span>
                          <span>➔</span>
                          <span className="badge" style={{
                            background: newSt === 'LEFT_EARLY' ? '#fef3c7' : newSt === 'LATE' ? '#dbeafe' : newSt === 'PRESENT' ? '#dcfce7' : '#fee2e2',
                            color: newSt === 'LEFT_EARLY' ? '#b45309' : newSt === 'LATE' ? '#1d4ed8' : newSt === 'PRESENT' ? '#15803d' : '#b91c1c',
                            fontWeight: 700
                          }}>
                            {newSt}
                          </span>
                          <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                            Modified by: <strong>{log.modified_by_name || log.modifiedByName || 'Faculty'}</strong>
                          </span>
                        </div>
                        {log.reason && (
                          <div style={{ fontSize: 12, color: 'var(--text)', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 6 }}>
                            Reason: {log.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ────── History ────── */
function History(){
  const {user}=useAuth();
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  // Inspector modal state
  const [inspectedSession, setInspectedSession] = useState<any>(null);
  const [inspectedRecords, setInspectedRecords] = useState<any[]>([]);
  const [inspectedAuditLogs, setInspectedAuditLogs] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'AUDIT'>('ROSTER');

  useEffect(()=>{
    api.get('/teacher/attendance/history')
      .then(x=>setRows(Array.isArray(x.data)?x.data:[]))
      .catch(()=>setRows([]))
      .finally(()=>setLoading(false));
  },[]);

  async function openInspector(session: any) {
    setInspectedSession(session);
    setLoadingRecords(true);
    setActiveTab('ROSTER');
    try {
      const res = await api.get(`/teacher/attendance/${session.id}/records`);
      setInspectedRecords(res.data?.records || []);
      setInspectedAuditLogs(res.data?.auditLogs || []);
    } catch (err) {
      console.error('Failed to load session records:', err);
    } finally {
      setLoadingRecords(false);
    }
  }

  const totalSessions = rows.length;
  const totalStudents = rows.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
  const totalPresent = rows.reduce((acc, r) => acc + (Number(r.present) || 0), 0);
  const totalAbsent = totalStudents - totalPresent;
  const overallRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
        <div>
          <p className="eyebrow">ATTENDANCE AUDIT & HISTORY</p>
          <h1 style={{ margin: 0, fontSize: 24 }}>Session Attendance History</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Permanent institutional record of all roll-call sessions and cross-teacher re-attendance logs.
          </p>
        </div>
        <a href="#/take-attendance" className="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          Take New Attendance →
        </a>
      </div>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="panel" style={{ padding: '16px 20px', margin: 0 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>TOTAL SESSIONS</span>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{totalSessions}</div>
        </div>
        <div className="panel" style={{ padding: '16px 20px', margin: 0 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>STUDENTS MARKED</span>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{totalStudents}</div>
        </div>
        <div className="panel" style={{ padding: '16px 20px', margin: 0 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>PRESENT COUNT</span>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: '#10b981' }}>{totalPresent}</div>
        </div>
        <div className="panel" style={{ padding: '16px 20px', margin: 0 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>ATTENDANCE RATE</span>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: overallRate >= 75 ? '#2563eb' : '#ea580c' }}>
            {overallRate}%
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Class & Section</th>
                <th>Subject</th>
                <th>Recorded By</th>
                <th>Present</th>
                <th>Left Early</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Turnout Rate</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="muted" style={{ padding: 24, textAlign: 'center' }}>Loading attendance history...</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="muted" style={{ padding: 32, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--text)' }}>No attendance sessions recorded yet</p>
                    <p style={{ margin: 0, fontSize: 13 }}>Sessions will appear here in real-time as daily class attendance is submitted.</p>
                  </td>
                </tr>
              ) : (
                rows.map(x => {
                  const rate = x.total > 0 ? Math.round((x.present / x.total) * 100) : 0;
                  const dateStr = x.attendance_date ? new Date(x.attendance_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                  const leftEarlyCount = Number(x.left_early_count || 0);
                  const lateCount = Number(x.late_count || 0);
                  const absentCount = Number(x.absent ?? (x.total - x.present));

                  return (
                    <tr key={x.id}>
                      <td><b>{dateStr}</b></td>
                      <td><span className="badge" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 600 }}>Class {x.class_number}-{x.section_name}</span></td>
                      <td><b>{x.subject_name || 'General'}</b></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{x.teacher_name || 'Faculty Member'}</span>
                          {x.is_reattendance && (
                            <span style={{ fontSize: 11, color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                              <RefreshCw size={10} /> Re-attended ({x.reattendance_count || 1}x)
                            </span>
                          )}
                        </div>
                      </td>
                      <td><span style={{ color: '#10b981', fontWeight: 600 }}>{x.present}</span></td>
                      <td>
                        {leftEarlyCount > 0 ? (
                          <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                            {leftEarlyCount}
                          </span>
                        ) : (
                          <span className="muted">0</span>
                        )}
                      </td>
                      <td>
                        {lateCount > 0 ? (
                          <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}>
                            {lateCount}
                          </span>
                        ) : (
                          <span className="muted">0</span>
                        )}
                      </td>
                      <td><span style={{ color: absentCount > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 600 }}>{absentCount}</span></td>
                      <td>
                        <span className="badge" style={{
                          background: rate >= 85 ? 'rgba(16,185,129,0.12)' : rate >= 70 ? 'rgba(37,99,235,0.12)' : 'rgba(239,68,68,0.12)',
                          color: rate >= 85 ? '#059669' : rate >= 70 ? '#2563eb' : '#dc2626',
                          fontWeight: 700
                        }}>
                          {rate}% Present
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => openInspector(x)}
                            className="secondary"
                            style={{ fontSize: 11.5, padding: '4px 8px', whiteSpace: 'nowrap' }}
                          >
                            Inspect & Audit
                          </button>
                          <a
                            href={`#/take-attendance?classId=${x.class_id}&sectionId=${x.section_id}&date=${x.attendance_date}`}
                            className="primary"
                            style={{ fontSize: 11.5, padding: '4px 8px', textDecoration: 'none', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            Re-attend →
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────── MODAL: Session Inspector & Audit Trail in History ────── */}
      {inspectedSession && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 750,
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{ background: '#2563eb', color: '#ffffff', fontWeight: 700 }}>
                    Class {inspectedSession.class_number}-{inspectedSession.section_name}
                  </span>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                    Session Inspection ({inspectedSession.attendance_date})
                  </h3>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Taken by: <strong>{inspectedSession.teacher_name || 'Faculty Member'}</strong>
                  {inspectedSession.is_reattendance && ` · Re-attendance modified by ${inspectedSession.last_modified_name || 'Faculty'}`}
                </div>
              </div>
              <button className="secondary" onClick={() => setInspectedSession(null)} style={{ padding: '4px 8px', borderRadius: 6 }}>✕</button>
            </div>

            {/* Tab switch */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle, #f8fafc)' }}>
              <button
                onClick={() => setActiveTab('ROSTER')}
                style={{
                  padding: '10px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'ROSTER' ? '2px solid #2563eb' : 'none',
                  color: activeTab === 'ROSTER' ? '#2563eb' : 'var(--text-muted)',
                  fontWeight: activeTab === 'ROSTER' ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Student Roster ({inspectedRecords.length})
              </button>
              <button
                onClick={() => setActiveTab('AUDIT')}
                style={{
                  padding: '10px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'AUDIT' ? '2px solid #2563eb' : 'none',
                  color: activeTab === 'AUDIT' ? '#2563eb' : 'var(--text-muted)',
                  fontWeight: activeTab === 'AUDIT' ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Re-attendance Audit Trail ({inspectedAuditLogs.length})
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {loadingRecords ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Loading session records...</div>
              ) : activeTab === 'ROSTER' ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Roll</th>
                        <th>Student Name</th>
                        <th>Status</th>
                        <th>Period Timing</th>
                        <th>Remarks / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspectedRecords.length === 0 ? (
                        <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>No records found for this session</td></tr>
                      ) : (
                        inspectedRecords.map(r => {
                          const st = r.status || (r.is_present || r.isPresent ? 'PRESENT' : 'ABSENT');
                          const isLeftEarly = st === 'LEFT_EARLY';
                          const isLate = st === 'LATE';
                          const isPres = st === 'PRESENT';
                          return (
                            <tr key={r.id || r.studentId}>
                              <td><b>{r.rollNumber || r.roll_number || '—'}</b></td>
                              <td><b>{r.studentName || r.student_name}</b></td>
                              <td>
                                <span className="badge" style={{
                                  background: isLeftEarly ? '#fef3c7' : isLate ? '#dbeafe' : isPres ? '#dcfce7' : '#fee2e2',
                                  color: isLeftEarly ? '#b45309' : isLate ? '#1d4ed8' : isPres ? '#15803d' : '#b91c1c',
                                  fontWeight: 700
                                }}>
                                  {isLeftEarly ? 'LEFT EARLY' : isLate ? 'LATE' : isPres ? 'PRESENT' : 'ABSENT'}
                                </span>
                              </td>
                              <td style={{ fontSize: 12 }}>
                                {isLeftEarly ? `Departed: ${r.departurePeriod || 'After 1st Period'} (${r.departureTime || '—'})` : isLate ? `Arrived: ${r.arrivalPeriod || 'Period 2'} (${r.arrivalTime || '—'})` : 'Full Day'}
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {r.remarks || '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  {inspectedAuditLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)' }}>
                      <HistoryIcon size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>No re-attendance events recorded for this session</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {inspectedAuditLogs.map((log: any, idx: number) => {
                        const timeStr = log.created_at || log.createdAt ? new Date(log.created_at || log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                        return (
                          <div key={log.id || idx} style={{ background: 'var(--bg-subtle, #f8fafc)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <strong style={{ fontSize: 13 }}>{log.student_name || log.studentName}</strong>
                              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{timeStr}</span>
                            </div>
                            <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="badge">{log.previous_status || log.previousStatus}</span>
                              <span>➔</span>
                              <span className="badge" style={{ fontWeight: 700 }}>{log.new_status || log.newStatus}</span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>Modified by: {log.modified_by_name || log.modifiedByName || 'Faculty'}</span>
                            </div>
                            {log.reason && (
                              <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
                                Reason: {log.reason}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a
                href={`#/take-attendance?classId=${inspectedSession.class_id}&sectionId=${inspectedSession.section_id}&date=${inspectedSession.attendance_date}`}
                className="primary"
                style={{ padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}
              >
                Open in Attendance Station for Live Re-attendance →
              </a>
              <button className="secondary" onClick={() => setInspectedSession(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ────── Notifications V11 & SMTP ────── */
function NotificationCenter(){
  const {user}=useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [channels,setChannels]=useState<any>(null);
  const [smtp,setSmtp]=useState<any>({
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'STARTTLS',
    username: '',
    password: '',
    senderEmail: 'attendance@school.local',
    senderName: 'School Attendance Office',
    isEnabled: true
  });
  const [showPass,setShowPass]=useState(false);
  const [logs,setLogs]=useState<any[]>([]);
  const [analytics,setAnalytics]=useState<any>(null);
  const [tab,setTab]=useState<'settings' | 'smtp' | 'templates' | 'analytics' | 'logs'>('settings');
  const [msg,setMsg]=useState('');
  const [templates,setTemplates]=useState<any[]>([]);
  const [testModal,setTestModal]=useState(false);
  const [testEmail,setTestEmail]=useState(user?.email || 'admin@demo-school.local');
  const [testing,setTesting]=useState(false);
  const [testResult,setTestResult]=useState<any>(null);
  const [selectedPreviewTpl, setSelectedPreviewTpl] = useState<string>('ATTENDANCE_ABSENT');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewData, setPreviewData] = useState<{ subject: string; text: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [viewFormat, setViewFormat] = useState<'html' | 'text'>('html');

  async function loadPreview(templateKey: string) {
    setPreviewLoading(true);
    try {
      const res = await api.get(`/notifications-v11/preview/${templateKey}`);
      setPreviewData(res.data);
    } catch (err: any) {
      console.warn('Failed to load template preview:', err.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'templates') {
      loadPreview(selectedPreviewTpl);
    }
  }, [tab, selectedPreviewTpl]);

  async function load(){
    try {
      const [a,b,c,d,e]=await Promise.all([
        api.get('/notifications-v11/channels'),
        api.get('/notifications-v11/logs'),
        api.get('/notifications-v11/analytics'),
        api.get('/notifications-v11/templates'),
        api.get('/notifications-v11/smtp')
      ]);
      setChannels(a.data);
      setLogs(b.data);
      setAnalytics(c.data);
      setTemplates(d.data);
      if (e.data) setSmtp(e.data);
    } catch {}
  }

  useEffect(()=>{load()},[]);

  async function saveChannels(){
    await api.put('/notifications-v11/channels',{
      smsEnabled:channels.sms_enabled,
      whatsappEnabled:channels.whatsapp_enabled,
      emailEnabled:channels.email_enabled,
      whatsappProvider:channels.whatsapp_provider,
      whatsappApiUrl:channels.whatsapp_api_url||'',
      whatsappApiKey:channels.whatsapp_api_key||''
    });
    setMsg('Channel delivery settings saved.');
  }

  async function saveSmtp(){
    try {
      await api.put('/notifications-v11/smtp', smtp);
      setMsg('SMTP Email server configuration saved successfully!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save SMTP settings');
    }
  }

  async function runTestEmail(e: React.FormEvent){
    e.preventDefault();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/notifications-v11/smtp/test', {
        recipientEmail: testEmail,
        ...smtp
      });
      setTestResult({ success: true, message: res.data.message || 'Test email successfully dispatched!' });
    } catch (err: any) {
      setTestResult({ success: false, message: err?.response?.data?.message || 'SMTP Connection Test Failed' });
    } finally {
      setTesting(false);
    }
  }

  async function process(){
    const x=await api.post('/notifications-v11/process');
    setMsg(`Queue processed: ${x.data.sent} sent, ${x.data.failed} failed.`);
    load();
  }

  const set=(k:string,v:any)=>setChannels({...channels,[k]:v});

  return <Layout>
    <PageHead title="Notification Center" sub="Manage SMS, WhatsApp, and SMTP Email alerts for student absences."/>
    
    <div className="tabs">
      <button className={tab==='settings'?'tab-active':''} onClick={()=>setTab('settings')}>Channels</button>
      <button className={tab==='smtp'?'tab-active':''} onClick={()=>setTab('smtp')}>📧 SMTP Email Settings</button>
      <button className={tab==='templates'?'tab-active':''} onClick={()=>setTab('templates')}>📑 Templates & Live Preview</button>
      <button className={tab==='analytics'?'tab-active':''} onClick={()=>setTab('analytics')}>Analytics</button>
      <button className={tab==='logs'?'tab-active':''} onClick={()=>setTab('logs')}>Delivery logs</button>
    </div>

    {msg && <div className="success" style={{ marginBottom: 16 }}>{msg}</div>}

    {/* TAB 1: GENERAL CHANNELS */}
    {tab==='settings'&&channels&&(
      <div className="panel">
        <h3>Notification Channels</h3>
        <p className="muted">Configure active dispatch channels for absent notifications.</p>
        <label className="checkline">
          <input type="checkbox" checked={channels.sms_enabled} onChange={e=>set('sms_enabled',e.target.checked)}/> SMS Enabled
        </label>
        <label className="checkline">
          <input type="checkbox" checked={channels.whatsapp_enabled} onChange={e=>set('whatsapp_enabled',e.target.checked)}/> WhatsApp Enabled
        </label>
        <label className="checkline">
          <input type="checkbox" checked={channels.email_enabled} onChange={e=>set('email_enabled',e.target.checked)}/> Email Alerts Enabled (Automatic Absent Notifications)
        </label>

        {channels.whatsapp_enabled&&(
          <div style={{ marginTop: 14, padding: 14, background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
            <label>WhatsApp Provider
              <select value={channels.whatsapp_provider||'MOCK'} onChange={e=>set('whatsapp_provider',e.target.value)}>
                <option value="MOCK">MOCK (Local Sandbox)</option>
                <option value="HTTP">HTTP API Gateway</option>
              </select>
            </label>
            <label>WhatsApp API URL
              <input value={channels.whatsapp_api_url||''} onChange={e=>set('whatsapp_api_url',e.target.value)}/>
            </label>
            <label>WhatsApp API Key
              <input type="password" value={channels.whatsapp_api_key||''} onChange={e=>set('whatsapp_api_key',e.target.value)}/>
            </label>
          </div>
        )}

        <div className="action-row" style={{ marginTop: 18 }}>
          <button onClick={saveChannels}>Save Channel Settings</button>
          <button className="small-btn" onClick={process}>Process Queue Now</button>
        </div>
      </div>
    )}

    {/* TAB 2: SMTP EMAIL SERVER CONFIGURATION */}
    {tab==='smtp'&&(
      <div className="smtp-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Server size={22} style={{ color: 'var(--primary-600)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 17 }}>SMTP Email Server Configuration</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                Configure your custom outgoing SMTP mail server for automatic student absence email notifications.
              </p>
            </div>
          </div>
          <span className={`smtp-header-badge ${smtp.isEnabled ? 'active' : ''}`}>
            <Mail size={13} /> {smtp.isEnabled ? 'Automated Absence Alerts Active' : 'SMTP Disabled'}
          </span>
        </div>

        <form onSubmit={e => { e.preventDefault(); saveSmtp(); }}>
          <div className="smtp-grid">
            <div>
              <label>SMTP Host Server
                <input 
                  required 
                  placeholder="e.g. smtp.gmail.com, smtp.office365.com"
                  value={smtp.host || ''} 
                  onChange={e => setSmtp({ ...smtp, host: e.target.value })}
                />
              </label>
            </div>
            <div>
              <label>SMTP Port
                <input 
                  required 
                  type="number" 
                  placeholder="587 or 465"
                  value={smtp.port || 587} 
                  onChange={e => setSmtp({ ...smtp, port: Number(e.target.value) })}
                />
              </label>
            </div>
            <div>
              <label>Encryption Protocol
                <select 
                  value={smtp.encryption || 'STARTTLS'} 
                  onChange={e => setSmtp({ ...smtp, encryption: e.target.value })}
                >
                  <option value="STARTTLS">STARTTLS (Port 587 / 25)</option>
                  <option value="SSL/TLS">SSL / TLS (Port 465)</option>
                  <option value="NONE">None / Plaintext</option>
                </select>
              </label>
            </div>
            <div>
              <label>SMTP Username / Login Email <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700 }}>(e.g. rajbsmv@gmail.com)</span>
                <input 
                  placeholder="e.g. rajbsmv@gmail.com"
                  value={smtp.username || ''} 
                  onChange={e => setSmtp({ ...smtp, username: e.target.value })}
                />
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <label>SMTP Password / App Password <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700 }}>(Google App Password)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input 
                    type={showPass ? 'text' : 'password'}
                    placeholder="e.g. ovmz huhs fxnx inlq"
                    value={smtp.password || ''} 
                    onChange={e => setSmtp({ ...smtp, password: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn-secondary"
                    style={{ padding: '7px 10px' }}
                    onClick={() => setShowPass(!showPass)}
                    title={showPass ? 'Hide Password' : 'Show Password'}
                  >
                    <Eye size={15} />
                  </button>
                </div>
              </label>
            </div>
            <div>
              <label>Sender Email Address
                <input 
                  required 
                  type="email" 
                  placeholder="attendance@demo-school.local"
                  value={smtp.senderEmail || ''} 
                  onChange={e => setSmtp({ ...smtp, senderEmail: e.target.value })}
                />
              </label>
            </div>
            <div className="full-width">
              <label>Sender Display Name
                <input 
                  placeholder="e.g. Demo Higher Secondary School Attendance Office"
                  value={smtp.senderName || ''} 
                  onChange={e => setSmtp({ ...smtp, senderName: e.target.value })}
                />
              </label>
            </div>
            <div className="full-width">
              <label className="checkline" style={{ marginTop: 4 }}>
                <input 
                  type="checkbox" 
                  checked={smtp.isEnabled !== false} 
                  onChange={e => setSmtp({ ...smtp, isEnabled: e.target.checked })}
                />
                <b>Enable Automatic Absence Notification Emails via SMTP</b>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
            <button type="submit">
              Save SMTP Configuration
            </button>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => { setTestResult(null); setTestModal(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Send size={15} /> Test SMTP Connection & Send Email
            </button>
          </div>
        </form>
      </div>
    )}

    {/* TAB 3: TEMPLATES & LIVE EMAIL PREVIEW */}
    {tab==='templates'&&(
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Email Template Previewer Card */}
        <div className="panel" style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid #cbd5e1', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={22} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Institutional Responsive Email Templates</h3>
              </div>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
                Multi-client compliant, responsive HTML &amp; plain-text transactional emails for all institutional lifecycle events.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Template Selector */}
              <select
                value={selectedPreviewTpl}
                onChange={e => setSelectedPreviewTpl(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'var(--bg, #f8fafc)'
                }}
              >
                <option value="ATTENDANCE_ABSENT">Absent Notification (Alert)</option>
                <option value="ATTENDANCE_PRESENT">Present Confirmation (Alert)</option>
                <option value="SCHOOL_WELCOME">School Welcome (Onboarding)</option>
                <option value="TEACHER_CREATED">Faculty Welcome (Portal Invite)</option>
                <option value="STUDENT_CREATED">Student/Parent Welcome (Portal Access)</option>
                <option value="PASSWORD_RESET">Password Reset (Security)</option>
                <option value="TEST_EMAIL">SMTP Deliverability Verification (Test)</option>
              </select>

              {/* Viewport Device Toggle */}
              <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12.5,
                    border: 'none',
                    borderRadius: 0,
                    background: previewDevice === 'desktop' ? '#2563eb' : 'var(--bg, #f8fafc)',
                    color: previewDevice === 'desktop' ? '#ffffff' : 'var(--text, #334155)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Desktop (Wide)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12.5,
                    border: 'none',
                    borderRadius: 0,
                    background: previewDevice === 'mobile' ? '#2563eb' : 'var(--bg, #f8fafc)',
                    color: previewDevice === 'mobile' ? '#ffffff' : 'var(--text, #334155)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Mobile (375px)
                </button>
              </div>

              {/* Format Toggle */}
              <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setViewFormat('html')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12.5,
                    border: 'none',
                    borderRadius: 0,
                    background: viewFormat === 'html' ? '#0f172a' : 'var(--bg, #f8fafc)',
                    color: viewFormat === 'html' ? '#ffffff' : 'var(--text, #334155)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  HTML View
                </button>
                <button
                  type="button"
                  onClick={() => setViewFormat('text')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12.5,
                    border: 'none',
                    borderRadius: 0,
                    background: viewFormat === 'text' ? '#0f172a' : 'var(--bg, #f8fafc)',
                    color: viewFormat === 'text' ? '#ffffff' : 'var(--text, #334155)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Plain-Text MIME
                </button>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setTestEmail(user?.email || 'admin@school.local'); setTestResult(null); setTestModal(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 14px' }}
              >
                <Send size={14} /> Send Test Email
              </button>
            </div>
          </div>

          {/* Subject Bar */}
          <div style={{
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span style={{ fontWeight: 700, color: '#475569' }}>Subject:</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{previewData?.subject || 'Loading preview...'}</span>
          </div>

          {/* Preview Viewport Container */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            background: '#e2e8f0',
            padding: '24px 16px',
            borderRadius: 10,
            overflowX: 'auto',
            minHeight: 460
          }}>
            {previewLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#64748b' }}>
                <Loader2 size={24} className="spin" style={{ marginRight: 8 }} /> Loading rendered preview...
              </div>
            ) : viewFormat === 'html' ? (
              <iframe
                title="Email Preview"
                srcDoc={previewData?.html || ''}
                sandbox="allow-same-origin"
                style={{
                  width: previewDevice === 'desktop' ? '650px' : '375px',
                  height: '580px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: previewDevice === 'mobile' ? 24 : 8,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  transition: 'width 0.25s ease'
                }}
              />
            ) : (
              <div style={{
                width: previewDevice === 'desktop' ? '650px' : '375px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: 20,
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                color: '#1e293b',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                transition: 'width 0.25s ease'
              }}>
                {previewData?.text || 'No plain-text version available.'}
              </div>
            )}
          </div>
        </div>

        {/* Deliverability & Email Authentication Guide */}
        <div className="panel" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ShieldCheck size={20} color="#059669" />
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              Institutional Email Deliverability &amp; DNS Authentication Guide
            </h4>
          </div>
          <p style={{ margin: '0 0 14px 0', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            To protect your institution's domain reputation and achieve optimal inbox placement with Gmail, Microsoft 365, and institutional spam filters, configure your school domain DNS records:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>1. SPF Record (Sender Policy)</div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4 }}>TXT record at domain root:</div>
              <code style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 6px', borderRadius: 4, display: 'block', wordBreak: 'break-all' }}>
                v=spf1 include:_spf.google.com ~all
              </code>
            </div>
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>2. DKIM Signature (DomainKeys)</div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4 }}>2048-bit cryptographic key published at:</div>
              <code style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 6px', borderRadius: 4, display: 'block' }}>
                google._domainkey.yourschool.edu
              </code>
            </div>
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>3. DMARC Policy (Domain Message Auth)</div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4 }}>TXT record at _dmarc:</div>
              <code style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 6px', borderRadius: 4, display: 'block', wordBreak: 'break-all' }}>
                v=DMARC1; p=quarantine; pct=100;
              </code>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', fontStyle: 'italic', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
            Note: All AttendoSchool transactional emails include compliant multipart MIME, institutional identification headers, and TLS transmission. Recipient mail servers evaluate sender domain reputation, authentication (SPF/DKIM/DMARC), and user interaction history to determine final mailbox placement.
          </div>
        </div>

        {/* Quick SMS & WhatsApp Templates */}
        <div className="panel">
          <h3>SMS &amp; WhatsApp Alert Templates</h3>
          {['SMS','WHATSAPP'].map(ch=>{
            const t=templates.find(x=>x.channel===ch);
            return (
              <div className="template-box" key={ch}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <b>{ch} Template</b>
                  <span className="badge active">ACTIVE</span>
                </div>
                <textarea 
                  defaultValue={t?.body||`Attendance Alert: {student_name} was absent from Class {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.`} 
                  onBlur={async e=>{await api.put('/notifications-v11/templates/'+ch,{body:e.target.value}); load();}}
                />
                <small className="muted">Variables: {'{student_name}'} {'{class_name}'} {'{section}'} {'{time}'} {'{teacher_name}'} {'{enquiry_number}'}</small>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* TAB 4: ANALYTICS */}
    {tab==='analytics'&&<>
      <div className="stats">
        <Stat label="Total Alerts" value={analytics?.totals?.total??0}/>
        <Stat label="Delivered" value={analytics?.totals?.sent??0}/>
        <Stat label="Queued" value={analytics?.totals?.queued??0}/>
        <Stat label="Failed" value={analytics?.totals?.failed??0}/>
      </div>
      <div className="panel">
        <h3>Dispatch Metrics by Channel</h3>
        <div className="list">
          {analytics?.byChannel?.map((x:any,i:number)=>(
            <div className="list-row" key={i}>
              <b>{x.channel}</b>
              <span>{x.status} · {x.count}</span>
            </div>
          ))}
        </div>
      </div>
    </>}

    {/* TAB 5: LOGS */}
    {tab==='logs'&&(
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Channel</th>
              <th>Recipient</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(x=>(
              <tr key={x.id}>
                <td>{x.student_name||'—'}</td>
                <td><span className="badge">{x.channel}</span></td>
                <td><code>{x.recipient}</code></td>
                <td><span className={`badge ${x.status==='SENT'?'active':'processing'}`}>{x.status}</span></td>
                <td>{x.attempts}</td>
                <td>{x.created_at?.slice(0,19).replace('T',' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* SMTP TEST EMAIL MODAL */}
    {testModal && (
      <Modal title="Test SMTP Connection" close={() => setTestModal(false)}>
        <form className="modal-form" onSubmit={runTestEmail}>
          <p className="muted" style={{ margin: '0 0 14px 0', fontSize: 13 }}>
            Send a live verification test email to confirm that your SMTP server host (<code>{smtp.host}:{smtp.port}</code>) and authentication credentials are correct.
          </p>
          <label>Recipient Test Email Address
            <input 
              required 
              type="email" 
              placeholder="e.g. admin@school.com or your personal email"
              value={testEmail} 
              onChange={e => setTestEmail(e.target.value)}
            />
          </label>

          {testResult && (
            <div className={testResult.success ? 'success' : 'error'} style={{ marginTop: 12 }}>
              {testResult.message}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn-secondary" onClick={() => setTestModal(false)}>
              Close
            </button>
            <button type="submit" disabled={testing}>
              {testing ? 'Connecting & Sending...' : 'Send Test Verification Email'}
            </button>
          </div>
        </form>
      </Modal>
    )}
  </Layout>
}

/* ────── Notifications (Legacy SMS) ────── */
function Notifications(){const {user}=useAuth();const [settings,setSettings]=useState<any>({sms_enabled:true,provider:'mock',sender_id:'',template:'Dear Parent, {student_name} was absent from {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.'});const [logs,setLogs]=useState<any[]>([]);const [busy,setBusy]=useState(false);
  async function load(){const[a,b]=await Promise.all([api.get('/notifications/settings'),api.get('/notifications/logs')]);setSettings(a.data);setLogs(b.data)}useEffect(()=>{load()},[]);
  async function save(){setBusy(true);try{await api.put('/notifications/settings',{smsEnabled:settings.sms_enabled,provider:settings.provider,senderId:settings.sender_id,template:settings.template});alert('Notification settings saved')}catch(e:any){alert(e?.response?.data?.message||'Save failed')}finally{setBusy(false)}}
  async function process(){setBusy(true);try{const r=await api.post('/notifications/process');alert(`Processed ${r.data.processed}: ${r.data.sent} sent, ${r.data.failed} failed`);load()}catch(e:any){alert('Queue processing failed')}finally{setBusy(false)}}
  return <Layout><PageHead title="Parent SMS" sub="Automatic absent notifications, templates and delivery logs."/><div className="two-col"><div className="panel"><h3>SMS settings</h3><label className="toggle"><input type="checkbox" checked={settings.sms_enabled!==false} onChange={e=>setSettings({...settings,sms_enabled:e.target.checked})}/> Enable parent SMS</label><label>Provider<select value={settings.provider||'mock'} onChange={e=>setSettings({...settings,provider:e.target.value})}><option value="mock">Mock / Local testing</option><option value="http">HTTP SMS provider</option></select></label><label>Sender ID<input value={settings.sender_id||''} onChange={e=>setSettings({...settings,sender_id:e.target.value})}/></label><label>Message template<textarea value={settings.template||''} onChange={e=>setSettings({...settings,template:e.target.value})}/></label><p className="muted small">Variables: {'{student_name}'}, {'{class_name}'}, {'{section}'}, {'{time}'}, {'{teacher_name}'}, {'{enquiry_number}'}</p><div className="inline"><button disabled={busy} onClick={save}>Save settings</button><button className="secondary" disabled={busy} onClick={process}>Process queue</button></div></div><div className="panel"><h3>How it works</h3><div className="flow"><b>1. Teacher submits</b><span>Unchecked students become ABSENT.</span><b>2. System queues SMS</b><span>Parent number and class details are inserted into the template.</span><b>3. Provider sends</b><span>Mock mode works locally; HTTP mode connects to your SMS gateway.</span><b>4. Delivery is logged</b><span>Queued, processing, sent or failed status is stored.</span></div></div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Parent SMS</th><th>Status</th><th>Attempts</th><th>Message</th><th>Created</th></tr></thead><tbody>{logs.map(x=><tr key={x.id}><td>{x.student_name||'—'}</td><td>{x.parent_number}</td><td><span className={'badge '+String(x.status).toLowerCase()}>{x.status}</span></td><td>{x.attempts}</td><td>{x.message}</td><td>{new Date(x.created_at).toLocaleString()}</td></tr>)}</tbody></table></div></Layout>}

/* ────── Subscription (School) ────── */
function SubscriptionPage(){
 const {user}=useAuth();
 const [s,setS]=useState<any>(null);
 const [availablePlans,setAvailablePlans]=useState<any[]>([]);
 const [payments,setPayments]=useState<any[]>([]);
 const [busy,setBusy]=useState(false);
 const [subDays,setSubDays]=useState(30);
 const [msg,setMsg]=useState('');

 async function load(){
   const[a,b,c]=await Promise.all([
     api.get('/school-payment/subscription'),
     api.get('/school-payment/payments'),
     api.get('/school-payment/plans').catch(() => ({ data: [] }))
   ]);
   setS(a.data);
   setPayments(b.data);
   setAvailablePlans(c.data || []);
 }

 useEffect(()=>{load()},[]);

 async function renew(){
   setBusy(true);setMsg('');
   try{
     const order=(await api.post('/school-payment/renew/order',{days:subDays,gateway:'MOCK'})).data;
     await api.post('/school-payment/renew/mock-complete',{orderId:order.orderId,days:subDays});
     setMsg('Payment successful. Subscription renewed.');
     await load();
   }catch(e:any){setMsg(e?.response?.data?.message||'Payment failed')}
   finally{setBusy(false)}
 }

 return <Layout><PageHead title="Subscription & Billing" sub="View your plan, validity, payments and renew your school subscription."/>
 <div className="stats">
   <Stat label="Plan" value={s?.plan_name||'—'}/>
   <Stat label="Students" value={s?.student_count??'—'}/>
   <Stat label="Days remaining" value={s?.days_remaining??'—'}/>
   <Stat label="Status" value={s?.computed_status||'—'}/>
 </div>
 <div className="two-col">
   <div className="panel">
     <h3>Current subscription</h3>
     <div className="list">
       <div className="list-row"><b>Start</b><span>{s?.start_date?.slice(0,10)||'—'}</span></div>
       <div className="list-row"><b>End</b><span>{s?.end_date?.slice(0,10)||'—'}</span></div>
       <div className="list-row"><b>Student limit</b><span>{s?.max_students??'—'}</span></div>
       <div className="list-row"><b>Monthly plan</b><span>₹{Number(s?.price_monthly||0).toLocaleString('en-IN')}</span></div>
       {s?.discount_percentage > 0 && (
         <div className="list-row" style={{ background: '#ecfdf5', padding: '6px 10px', borderRadius: '6px', margin: '4px 0' }}>
           <b style={{ color: '#047857' }}>Active Discount</b>
           <span style={{ fontWeight: '700', color: '#047857', display: 'flex', alignItems: 'center', gap: '4px' }}>
             🏷️ {s.discount_percentage}% OFF Applied
           </span>
         </div>
       )}
     </div>
   </div>
   <div className="panel">
     <h3>Renew online</h3>
     <label>Renewal period
       <select value={subDays} onChange={e=>setSubDays(Number(e.target.value))}>
         <option value={30}>30 days</option>
         <option value={90}>90 days</option>
         <option value={180}>180 days</option>
         <option value={365}>365 days</option>
       </select>
     </label>
     <p className="muted">Use mock mode for local testing. If Razorpay is configured on the server, the production checkout endpoint is available.</p>
     <button disabled={busy} onClick={renew}>{busy?'Processing…':`Pay & renew ${subDays} days (Test)`}</button>
     {msg&&<div className="success">{msg}</div>}
   </div>
 </div>

 {availablePlans.length > 0 && (
   <div className="panel" style={{ marginTop: '20px' }}>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
       <div>
         <h3 style={{ margin: 0 }}>Available Subscription Tiers</h3>
         <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>Explore packages and student capacities available for your institution.</p>
       </div>
     </div>
     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
       {availablePlans.map((p: any) => {
         const isCurrent = s?.plan_name && (s.plan_name.toLowerCase() === p.name.toLowerCase() || p.id === s?.plan_id);
         const hasDiscount = p.discount_percentage && p.discount_percentage > 0;
         const discountedMonthly = hasDiscount ? Math.round(p.price_monthly * (1 - p.discount_percentage / 100)) : p.price_monthly;
         return (
           <div key={p.id} style={{ border: isCurrent ? '2px solid #2563eb' : '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: isCurrent ? '#f8faff' : '#ffffff', position: 'relative' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
               <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{p.name}</h4>
               <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                 {isCurrent && <span className="badge active" style={{ fontSize: '11px' }}>Current</span>}
                 {hasDiscount && (
                   <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '700' }}>
                     {p.discount_percentage}% OFF
                   </span>
                 )}
               </div>
             </div>
             <p style={{ fontSize: '12px', color: '#64748b', minHeight: '34px', margin: '4px 0 12px' }}>{p.description || `Capacity for up to ${p.max_students} students with full SIS features.`}</p>
             <div style={{ margin: '8px 0 12px' }}>
               <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                 <span style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>₹{Number(discountedMonthly).toLocaleString('en-IN')}</span>
                 {hasDiscount && (
                   <span style={{ fontSize: '14px', textDecoration: 'line-through', color: '#94a3b8' }}>₹{Number(p.price_monthly).toLocaleString('en-IN')}</span>
                 )}
                 <span style={{ fontSize: '12px', color: '#64748b' }}>/ month</span>
               </div>
               <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                 ₹{Number(p.price_yearly || p.price_monthly * 12).toLocaleString('en-IN')} / year
               </div>
             </div>
             <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '12px', color: '#334155' }}>
               <div>👥 <strong>Up to {Number(p.max_students).toLocaleString()} students</strong></div>
             </div>
           </div>
         );
       })}
     </div>
   </div>
 )}

 <div className="panel" style={{ marginTop: '20px' }}>
   <h3>Payment history</h3>
   <div className="table-wrap">
     <table>
       <thead><tr><th>Date</th><th>Provider</th><th>Amount</th><th>Status</th><th>Invoice</th><th>Receipt</th></tr></thead>
       <tbody>{payments.map(p=><tr key={p.id}><td>{p.created_at?.slice(0,19).replace('T',' ')}</td><td>{p.provider}</td><td>₹{Number(p.amount||0).toLocaleString('en-IN')}</td><td><span className="badge">{p.status}</span></td><td>{p.invoice_number||'—'}</td><td>{p.receipt_number||'—'} {p.invoice_id&&<button className="small-btn" onClick={()=>window.open(`${API_BASE_URL}/super-admin/invoices/${p.invoice_id}/receipt`,'_blank')}>Receipt</button>}</td></tr>)}</tbody>
     </table>
   </div>
 </div>
 </Layout>
}

/* ────── Invoices (Super Admin & School Admin) ────── */
function Invoices(){
  const {user}=useAuth();
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [downloadingId,setDownloadingId]=useState<string|null>(null);

  async function load(){
    setLoading(true);
    try {
      const endpoint = user?.role === 'SUPER_ADMIN' ? '/super-admin/invoices' : '/school-payment/invoices';
      const res = await api.get(endpoint);
      setRows(res.data || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{load()},[user?.role]);

  async function downloadPdf(invId: string, invoiceNum: string) {
    setDownloadingId(invId);
    try {
      const res = await api.get(`/invoices/${invId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceNum || 'invoice'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      const token = localStorage.getItem('token');
      window.open(`${API_BASE_URL}/invoices/${invId}/pdf?token=${token}`, '_blank');
    } finally {
      setDownloadingId(null);
    }
  }

  return <Layout>
    <PageHead 
      title="Invoices & Billing Statements" 
      sub={user?.role === 'SUPER_ADMIN' ? "Platform-wide subscription invoices and payment receipts." : "Official subscription invoices, tax receipts, and payment statements."}
    />
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Invoice #</th>
            {user?.role === 'SUPER_ADMIN' && <th>School</th>}
            <th>Receipt #</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Issued Date</th>
            <th>Paid Date</th>
            <th style={{ textAlign: 'right' }}>Official PDF</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={user?.role === 'SUPER_ADMIN' ? 8 : 7} style={{ textAlign: 'center', padding: 24 }} className="muted">{loading ? 'Loading invoices...' : 'No invoices on record.'}</td></tr>
          ) : rows.map(x => (
            <tr key={x.id}>
              <td><b>{x.invoice_number}</b></td>
              {user?.role === 'SUPER_ADMIN' && <td>{x.school_name}</td>}
              <td>{x.receipt_number || '—'}</td>
              <td><b>₹{Number(x.amount || 0).toLocaleString('en-IN')}</b></td>
              <td><span className={`badge ${x.status === 'PAID' ? 'active' : 'processing'}`}>{x.status}</span></td>
              <td>{x.issued_at?.slice(0, 10) || '—'}</td>
              <td>{x.paid_at?.slice(0, 19).replace('T', ' ') || '—'}</td>
              <td style={{ textAlign: 'right' }}>
                <button 
                  className="small-btn" 
                  disabled={downloadingId === x.id}
                  onClick={() => downloadPdf(x.id, x.invoice_number)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <Download size={13} /> {downloadingId === x.id ? 'Generating...' : 'Download PDF'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Layout>;
}

/* ────── Super Admin Monitor ────── */
function SuperMonitor(){
 const {user}=useAuth();const [d,setD]=useState<any>(null);const [busy,setBusy]=useState(false);
 async function load(){setD((await api.get('/super-admin/monitor')).data)}
 useEffect(()=>{load()},[]);
 const m=d?.metrics||{};
 const attendance=(Number(m.today_present||0)+Number(m.today_absent||0));
 return <Layout><PageHead title="SaaS Monitoring" sub="Live operational view of schools, subscriptions and today's attendance."/>
 <div className="stats">
   <Stat label="Schools" value={m.total_schools??'—'}/><Stat label="Active" value={m.active_schools??'—'}/>
   <Stat label="Expired" value={m.expired_schools??'—'}/><Stat label="Students" value={m.total_students??'—'}/>
   <Stat label="Today's sessions" value={m.today_sessions??'—'}/><Stat label="Revenue" value={`₹${Number(m.total_revenue||0).toLocaleString('en-IN')}`}/>
 </div>
 <div className="two-col">
  <div className="panel"><h3>Today's attendance</h3>
   <div className="list"><div className="list-row"><b>Present</b><span>{m.today_present??0}</span></div><div className="list-row"><b>Absent</b><span>{m.today_absent??0}</span></div><div className="list-row"><b>Recorded</b><span>{attendance}</span></div></div>
  </div>
  <div className="panel"><h3>Expiring within 7 days</h3>
   {d?.expiringSoon?.length?<div className="list">{d.expiringSoon.map((x:any)=><div className="list-row" key={x.id}><b>{x.name}</b><span>{x.plan_name} · {x.end_date?.slice(0,10)}</span></div>)}</div>:<p className="muted">No schools expiring in the next 7 days.</p>}
  </div>
 </div>
 <div className="panel"><div className="panel-head"><h3>Subscription operations</h3><button className="small-btn" disabled={busy} onClick={async()=>{setBusy(true);try{await api.post('/super-admin/subscriptions/expire-now');await load()}finally{setBusy(false)}}}>{busy?'Refreshing…':'Refresh expiry status'}</button></div>
 <p className="muted">Run this after a deployment or schedule the backend subscription worker to keep expired schools synchronized automatically.</p></div>
 </Layout>
}

/* ────── Payments (Super Admin & School Admin) ────── */
function Payments(){
  const {user}=useAuth();
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [downloadingId,setDownloadingId]=useState<string|null>(null);

  async function load(){
    setLoading(true);
    try {
      const endpoint = user?.role === 'SUPER_ADMIN' ? '/super-admin/payments' : '/school-payment/payments';
      const res = await api.get(endpoint);
      setRows(res.data || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{load()},[user?.role]);

  async function downloadPdf(invId: string, invoiceNum: string) {
    setDownloadingId(invId);
    try {
      const res = await api.get(`/invoices/${invId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceNum || 'receipt'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      const token = localStorage.getItem('token');
      window.open(`${API_BASE_URL}/invoices/${invId}/pdf?token=${token}`, '_blank');
    } finally {
      setDownloadingId(null);
    }
  }

  return <Layout>
    <PageHead 
      title="Payment History" 
      sub={user?.role === 'SUPER_ADMIN' ? "Platform-wide subscription payments received across all schools." : "History of subscription renewal payments, transaction IDs, and receipts."}
    />
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {user?.role === 'SUPER_ADMIN' && <th>School</th>}
            <th>Date & Time</th>
            <th>Gateway</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Invoice</th>
            <th>Receipt</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={user?.role === 'SUPER_ADMIN' ? 7 : 6} style={{ textAlign: 'center', padding: 24 }} className="muted">{loading ? 'Loading payments...' : 'No payment records found.'}</td></tr>
          ) : rows.map(x => (
            <tr key={x.id}>
              {user?.role === 'SUPER_ADMIN' && <td><b>{x.school_name}</b></td>}
              <td>{x.created_at?.slice(0, 19).replace('T', ' ')}</td>
              <td><code>{x.provider}</code></td>
              <td><b>₹{Number(x.amount || 0).toLocaleString('en-IN')}</b></td>
              <td><span className={`badge ${x.status === 'PAID' || x.status === 'COMPLETED' ? 'active' : 'processing'}`}>{x.status}</span></td>
              <td>{x.invoice_number || '—'}</td>
              <td>
                {x.invoice_id ? (
                  <button 
                    className="small-btn" 
                    disabled={downloadingId === x.invoice_id}
                    onClick={() => downloadPdf(x.invoice_id, x.invoice_number || 'receipt')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <Download size={12} /> Receipt
                  </button>
                ) : (
                  x.receipt_number || '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Layout>;
}

/* ────── School Profile (School Admin) ────── */
function SchoolProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ contact_number: '', address: '', website: '' });
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/school-profile');
      setProfile(res.data);
      setForm({
        contact_number: res.data.contact_number || res.data.enquiry_number || res.data.phone || '',
        address: res.data.address || '',
        website: res.data.website || ''
      });
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to load school profile' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.put('/school-profile', form);
      setProfile(res.data);
      setMsg({ type: 'success', text: 'School profile updated successfully!' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to update school profile' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <PageHead
        title="School Profile & Settings"
        sub="Institutional credentials, contact coordinates, campus address, and official communication channels."
      />
      {msg && (
        <div className={msg.type === 'success' ? 'success' : 'error'} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}
      {loading ? (
        <p className="muted">Loading institutional profile...</p>
      ) : (
        <div className="two-col">
          <div className="panel">
            <h3>Institution Identity</h3>
            <div className="list">
              <div className="list-row">
                <b>Institution Name</b>
                <span>{profile?.name || '—'}</span>
              </div>
              <div className="list-row">
                <b>Affiliation / School Code</b>
                <span><code>{profile?.code || '—'}</code></span>
              </div>
              <div className="list-row">
                <b>Registered Official Email</b>
                <span>{profile?.email || '—'}</span>
              </div>
              <div className="list-row">
                <b>Operational Status</b>
                <span><span className="badge active">{profile?.status || 'ACTIVE'}</span></span>
              </div>
              <div className="list-row">
                <b>Timezone</b>
                <span>{profile?.timezone || 'Asia/Kolkata'}</span>
              </div>
              <div className="list-row">
                <b>System Tenant ID</b>
                <span><code style={{ fontSize: 11 }}>{profile?.id}</code></span>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Campus Contact & Location</h3>
            <form onSubmit={save} className="modal-form" style={{ gap: 14 }}>
              <label>
                Enquiry / Emergency Contact Number
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={form.contact_number}
                  onChange={e => setForm({ ...form, contact_number: e.target.value })}
                />
              </label>
              <label>
                Official School Website
                <input
                  type="text"
                  placeholder="https://greenwood.edu"
                  value={form.website}
                  onChange={e => setForm({ ...form, website: e.target.value })}
                />
              </label>
              <label>
                Campus Physical Address
                <textarea
                  rows={3}
                  placeholder="Street, City, State, PIN"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                />
              </label>
              <button type="submit" disabled={saving} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                {saving ? 'Saving changes...' : 'Update Institutional Profile'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ────── Super Admin Home ────── */
function SuperAdminHome(){
  return <SuperAdminModule />;
}

/* ────── Routes ────── */
function App(){return <Routes>
  <Route path="/login" element={<Login/>}/>
  <Route path="/reset-password" element={<ResetPassword/>}/>
  <Route path="/dashboard" element={<Guard><Dashboard/></Guard>}/>
  <Route path="/students" element={<RoleGuard roles={['SCHOOL_ADMIN','SUPER_ADMIN']}><Students/></RoleGuard>}/>
  <Route path="/teachers" element={<RoleGuard roles={['SCHOOL_ADMIN','SUPER_ADMIN']}><Teachers/></RoleGuard>}/>
  <Route path="/classes" element={<RoleGuard roles={['SCHOOL_ADMIN','SUPER_ADMIN']}><Classes/></RoleGuard>}/>
  <Route path="/subjects" element={<RoleGuard roles={['SCHOOL_ADMIN','SUPER_ADMIN']}><Subjects/></RoleGuard>}/>
  <Route path="/routine" element={<RoleGuard roles={['SCHOOL_ADMIN','SUPER_ADMIN']}><Routine/></RoleGuard>}/>
  <Route path="/notifications" element={<RoleGuard roles={['SCHOOL_ADMIN','SUPER_ADMIN']}><NotificationCenter/></RoleGuard>}/>
  <Route path="/take-attendance" element={<Guard><Attendance/></Guard>}/>
  <Route path="/teacher-history" element={<Guard><History/></Guard>}/>
  <Route path="/attendance-reports" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN','TEACHER']}><Layout><AttendanceReports/></Layout></RoleGuard>}/>
  <Route path="/attendance-corrections" element={<RoleGuard roles={['SCHOOL_ADMIN','TEACHER']}><Layout><AttendanceCorrections/></Layout></RoleGuard>}/>
  <Route path="/people" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN']}><Layout><PeopleManagement/></Layout></RoleGuard>}/>
  <Route path="/academic-years" element={<RoleGuard roles={['SCHOOL_ADMIN']}><Layout><AcademicYears/></Layout></RoleGuard>}/>
  <Route path="/promotion" element={<RoleGuard roles={['SCHOOL_ADMIN']}><Layout><StudentPromotion/></Layout></RoleGuard>}/>
  <Route path="/permissions" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN']}><Layout><Permissions/></Layout></RoleGuard>}/>
  <Route path="/subscription-enforcement" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN']}><Layout><SubscriptionEnforcement/></Layout></RoleGuard>}/>
  <Route path="/security" element={<RoleGuard roles={['SUPER_ADMIN']}><Layout><Security/></Layout></RoleGuard>}/>
  <Route path="/backups" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN']}><Layout><Backup/></Layout></RoleGuard>}/>
  <Route path="/timetable" element={<RoleGuard roles={['SCHOOL_ADMIN','TEACHER']}><Layout><Timetable/></Layout></RoleGuard>}/>
  <Route path="/offline-attendance" element={<RoleGuard roles={['TEACHER']}><Layout><OfflineAttendance/></Layout></RoleGuard>}/>
  <Route path="/analytics" element={<RoleGuard roles={['SUPER_ADMIN','SCHOOL_ADMIN']}><Layout><Analytics/></Layout></RoleGuard>}/>
  <Route path="/communication" element={<RoleGuard roles={['SCHOOL_ADMIN']}><Layout><Communication/></Layout></RoleGuard>}/>
  <Route path="/parent-communication" element={<RoleGuard roles={['PARENT']}><Layout><ParentCommunication/></Layout></RoleGuard>}/>
  <Route path="/parent-portal" element={<RoleGuard roles={['PARENT']}><Layout><ParentPortal/></Layout></RoleGuard>}/>
  <Route path="/super-admin/*" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminModule/></RoleGuard>}/>
  <Route path="/super-admin" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminModule/></RoleGuard>}/>
  <Route path="/reports" element={<RoleGuard roles={['SUPER_ADMIN']}><Navigate to="/super-admin/reports" replace /></RoleGuard>}/>
  <Route path="/payments" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminModule/></RoleGuard>}/>
  <Route path="/invoices" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminModule/></RoleGuard>}/>
  <Route path="/school-profile" element={<RoleGuard roles={['SCHOOL_ADMIN']}><SchoolProfile/></RoleGuard>}/>
  <Route path="/monitor" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminModule/></RoleGuard>}/>
  <Route path="/subscription" element={<RoleGuard roles={['SCHOOL_ADMIN']}><SubscriptionPage/></RoleGuard>}/>
  {/* Student Portal Routes */}
  <Route path="/student/dashboard" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentDashboard/></StudentLayout></RoleGuard>}/>
  <Route path="/student/attendance" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentAttendance/></StudentLayout></RoleGuard>}/>
  <Route path="/student/timetable" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentTimetable/></StudentLayout></RoleGuard>}/>
  <Route path="/student/homework" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentAssignments/></StudentLayout></RoleGuard>}/>
  <Route path="/student/assignments" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentAssignments/></StudentLayout></RoleGuard>}/>
  <Route path="/student/exams" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentExams/></StudentLayout></RoleGuard>}/>
  <Route path="/student/announcements" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentAnnouncements/></StudentLayout></RoleGuard>}/>
  <Route path="/student/leave-request" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentLeaveRequest/></StudentLayout></RoleGuard>}/>
  <Route path="/student/profile" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentProfile/></StudentLayout></RoleGuard>}/>
  <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
</Routes>}

export default App;
