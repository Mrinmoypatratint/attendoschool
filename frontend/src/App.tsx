import { useEffect, useState, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from './api';
import { useAuth, Guard, RoleGuard } from './hooks/useAuth';

// Canonical domain enforcement: Redirect from legacy domains
if (typeof window !== 'undefined' && (window.location.hostname.includes('optinetinnovations.in') || window.location.hostname.includes('vercel.app'))) {
  window.location.replace('https://attendoschool.online' + window.location.pathname + window.location.search + window.location.hash);
}

// Route Code-Splitting via React.lazy()
const AttendanceReports = lazy(() => import('./pages/admin/AttendanceReports'));
const AttendanceCorrections = lazy(() => import('./pages/admin/AttendanceCorrections'));
const AcademicYears = lazy(() => import('./pages/admin/AcademicYears'));
const StudentPromotion = lazy(() => import('./pages/admin/StudentPromotion'));
const Permissions = lazy(() => import('./pages/admin/Permissions'));
const SubscriptionEnforcement = lazy(() => import('./pages/admin/SubscriptionEnforcement'));
const Security = lazy(() => import('./pages/admin/Security'));
const Backup = lazy(() => import('./pages/admin/Backup'));
const Timetable = lazy(() => import('./pages/admin/Timetable'));
const OfflineAttendance = lazy(() => import('./pages/admin/OfflineAttendance'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const Communication = lazy(() => import('./pages/admin/Communication'));
const ParentCommunication = lazy(() => import('./pages/admin/ParentCommunication'));
const ParentPortal = lazy(() => import('./pages/parent/ParentPortal'));
const TeacherAnnouncements = lazy(() => import('./pages/teacher/TeacherAnnouncements'));
const TeacherProfile = lazy(() => import('./pages/teacher/TeacherProfile'));
const PhotoApprove = lazy(() => import('./pages/admin/PhotoApprove'));
const LeaveApprove = lazy(() => import('./pages/admin/LeaveApprove'));
const TeacherLeaveApprove = lazy(() => import('./pages/admin/TeacherLeaveApprove'));
const TeacherLeaveRequest = lazy(() => import('./pages/teacher/TeacherLeaveRequest'));
const ClassMentorWorkspace = lazy(() => import('./pages/teacher/ClassMentorWorkspace').then(m => ({ default: m.ClassMentorWorkspace })));
const TeacherAssignments = lazy(() => import('./pages/teacher/TeacherAssignments'));
const SmtpLogs = lazy(() => import('./pages/admin/SmtpLogs'));
const Designations = lazy(() => import('./pages/admin/Designations'));
const LeavePolicy = lazy(() => import('./pages/admin/LeavePolicy'));
const TemporaryAssignments = lazy(() => import('./pages/admin/TemporaryAssignments'));
const SuperAdminModule = lazy(() => import('./super-admin/SuperAdminModule').then(m => ({ default: m.SuperAdminModule })));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
import * as XLSX from 'xlsx';
import {
  LayoutDashboard, Users, User, GraduationCap, BookOpen, Layers, LogOut, Plus, Megaphone,
  CalendarDays, ClipboardCheck, School, CheckCircle2, MessageSquare, BarChart3,
  FileText, Shield, Database, Clock, UserPlus, Settings, Moon, Sun,
  ArrowUpDown, Bell, CreditCard, Eye, FileSpreadsheet, Download, Trash2,
  UploadCloud, CheckSquare, Square, RefreshCw, Send, ShieldCheck, Mail, Server,
  Search, ArrowRight, Activity, Zap, EyeOff, ArrowLeft, Building2,
  Menu, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar, Globe, Lock, AlertTriangle, Pencil, HelpCircle, Check, AlertCircle, KeyRound, X, Loader2,
  History as HistoryIcon, DoorOpen, UserCheck, UserX, Info, Maximize2, Minimize2,
  Camera, CalendarCheck, CalendarPlus, Award, PenLine
} from 'lucide-react';
import { studentApi, Institute } from './services/studentApi';
import { listAssignments } from './services/temporaryAssignmentApi';
import { validatePassword } from './utils/passwordPolicy';
import { StudentLayout } from './components/student/StudentLayout';

const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const StudentAttendance = lazy(() => import('./pages/student/StudentAttendance').then(m => ({ default: m.StudentAttendance })));
const StudentTimetable = lazy(() => import('./pages/student/StudentTimetable').then(m => ({ default: m.StudentTimetable })));
const StudentAssignments = lazy(() => import('./pages/student/StudentAssignments').then(m => ({ default: m.StudentAssignments })));
const StudentExams = lazy(() => import('./pages/student/StudentExams').then(m => ({ default: m.StudentExams })));
const StudentAnnouncements = lazy(() => import('./pages/student/StudentAnnouncements').then(m => ({ default: m.StudentAnnouncements })));
const StudentLeaveRequest = lazy(() => import('./pages/student/StudentLeaveRequest').then(m => ({ default: m.StudentLeaveRequest })));
const StudentProfile = lazy(() => import('./pages/student/StudentProfile').then(m => ({ default: m.StudentProfile })));
import { StudentProfileHoverCard } from './components/StudentProfileHoverCard';
import { TeacherProfileHoverCard } from './components/TeacherProfileHoverCard';
import { formatGender } from './utils/gender';
import { formatCapitalizedName, formatStudentFullName, formatTeacherFullName } from './utils/formatters';
import { convertRomanClassToDigital, parseImportClassAndSection } from './utils/roman';
import { ThreeDBackground } from './components/ThreeDBackground';
import { HandwritingQuoteTyping } from './components/HandwritingQuoteTyping';
import { BrandedWelcomeLoader } from './components/BrandedWelcomeLoader';
import { AutoExpandingTextarea } from './components/AutoExpandingTextarea';
import {
  UniversalPreviewModal,
  DestructiveConfirmModal,
  calculateChanges,
  PreviewSectionData,
  PreviewChangeData,
  PreviewSummaryCard,
  PreviewTableData
} from './components/preview';
import { TableSubToolbar, TablePaginationFooter } from './components/TablePagination';
import { SidebarToggle } from './components/SidebarToggle';

const fmt = (t: string) => t?.slice(0, 5) || '';
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ────── Dark Mode ────── */
function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return false;
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme') {
        setDark(e.newValue === 'dark');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  return { dark, toggle: () => setDark(d => !d) };
}

export const sortAcademicYearsAscending = (list: any[]) => {
  return [...list].sort((a: any, b: any) => {
    const yearA = parseInt((String(a.name || '').match(/\d{4}/) || ['0'])[0], 10);
    const yearB = parseInt((String(b.name || '').match(/\d{4}/) || ['0'])[0], 10);
    if (yearA !== yearB && yearA > 0 && yearB > 0) return yearA - yearB;
    const dateA = new Date(a.start_date || a.startDate || 0).getTime();
    const dateB = new Date(b.start_date || b.startDate || 0).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
};

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
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.37 7.33 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.63 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
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
    bannerText: 'Enter your administrative credentials to automatically identify your institution.',
    needsSchool: true,
    emailLabel: 'Email Address',
    emailPlaceholder: 'e.g. admin@school.edu.in',
    defaultEmail: '',
    icon: School,
    color: '#059669'
  },
  TEACHER: {
    title: 'Teacher Login',
    roleName: 'Teacher',
    roleSub: 'Manage classes',
    bannerTitle: 'Teacher Portal',
    bannerText: 'Enter your teacher email or Employee ID / Savior_NO to automatically identify your school.',
    needsSchool: true,
    emailLabel: 'Teacher Email / Employee Id / Savior_NO',
    emailPlaceholder: 'e.g. teacher@school.edu.in, Employee ID, or Savior_NO (e.g. 20059)',
    defaultEmail: '',
    icon: GraduationCap,
    color: '#d97706'
  },
  STUDENT: {
    title: 'Student Login',
    roleName: 'Student',
    roleSub: 'Learning portal',
    bannerTitle: 'Student Portal',
    bannerText: 'Enter your Admission No. or student email to automatically identify your school.',
    needsSchool: true,
    emailLabel: 'Admission No. / Student Email',
    emailPlaceholder: 'e.g. ADM-2025-105 or student@gmail.com',
    defaultEmail: '',
    icon: BookOpen,
    color: '#7c3aed'
  }
};

function getDemoEmailForInstitute(schoolIdOrCode?: string, role: LoginOption = 'SCHOOL_ADMIN'): string {
  const norm = String(schoolIdOrCode || '').toLowerCase();
  const isTint = norm.includes('tint') || norm === '00000000-0000-0000-0000-000000000002';
  const isAbc = norm.includes('abc') || norm === '08c4960d-75d6-4a92-989b-48309500632e';
  const isDav = norm.includes('dav') || norm.includes('15582') || norm === '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3';

  if (isDav) {
    if (role === 'TEACHER') return 'teacher1@dav.com';
    if (role === 'STUDENT') return 'student@dav.com';
    return 'admin@dav.com';
  }

  if (isTint) {
    if (role === 'TEACHER') return 'teacher@tint.edu.in';
    if (role === 'STUDENT') return 'ADM-2025-105';
    return 'admin@tint.edu.in';
  }

  if (isAbc) {
    if (role === 'TEACHER') return 'mmrinmay76@gmail.com';
    if (role === 'STUDENT') return 'ADM1';
    return 'admin@abc155.edu.in';
  }

  if (role === 'TEACHER') return 'rahul@demo-school.local';
  if (role === 'STUDENT') return 'ADM-2026-001';
  if (role === 'ADMIN') return 'superadmin@attendance.local';
  return 'admin@demo-school.local';
}

function detectInstituteFromEmail(inputEmail: string, list: Institute[]): Institute | undefined {
  if (!inputEmail || !inputEmail.trim()) return undefined;
  const norm = inputEmail.trim().toLowerCase();
  const safeList = Array.isArray(list) ? list : [];

  // 1. Explicit DAV MODEL SCHOOL matches
  if (
    norm.includes('dav') ||
    norm.includes('15582') ||
    norm === 'admin@dav.com' ||
    norm === 'teacher1@dav.com' ||
    norm === 'teacher2@dav.com' ||
    norm === 'teacher@dav.com' ||
    norm === 'student@dav.com' ||
    norm === 'student1@dav.com' ||
    norm === 'student2@dav.com' ||
    norm === 'student@gmail.com' ||
    norm.includes('adm-2026-dav')
  ) {
    const found = safeList.find(i =>
      (i.code && (i.code === '15582' || i.code.toUpperCase() === 'DAV')) ||
      i.id === '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3' ||
      i.name.toLowerCase().includes('dav')
    );
    if (found) return found;
    return {
      id: '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3',
      name: 'DAV MODEL SCHOOL',
      code: '15582',
      address: 'DAV Campus'
    };
  }

  // 2. Explicit TINT matches (Faculty, Student, School Admin)
  if (
    norm.includes('tint.edu.in') ||
    norm.includes('tint.local') ||
    norm.includes('@tint') ||
    norm.includes('tint') ||
    norm === 'adm-2025-105' ||
    norm === 'adm-2025-001' ||
    norm === 'teacher@tint.edu.in' ||
    norm === 'student@tint.edu.in' ||
    norm === 'admin@tint.edu.in' ||
    norm === 'admin@tint.local'
  ) {
    const found = safeList.find(i =>
      (i.code && i.code.toUpperCase() === 'TINT') ||
      i.id === '00000000-0000-0000-0000-000000000002' ||
      i.name.toLowerCase().includes('techno international') ||
      i.name.toLowerCase().includes('tint')
    );
    if (found) return found;
    return {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Techno International New Town (TINT)',
      code: 'TINT',
      address: 'Major Arterial Road, New Town, Kolkata'
    };
  }

  // 3. Explicit Greenwood matches
  if (
    norm.includes('demo-school.local') ||
    norm.includes('greenwood') ||
    norm.includes('greenwood.local') ||
    norm === 'adm-2026-001' ||
    norm === 'rahul@demo-school.local' ||
    norm === 'priya@demo-school.local' ||
    norm === 'student@greenwood.local' ||
    norm === 'admin@demo-school.local' ||
    norm === 'tch-001' ||
    norm === 'tch-002' ||
    norm === 'emp001' ||
    norm === 'emp002' ||
    norm === 'emp012'
  ) {
    const found = safeList.find(i =>
      (i.code && i.code.toUpperCase() === 'GIS001') ||
      i.id === '00000000-0000-0000-0000-000000000001' ||
      i.name.toLowerCase().includes('greenwood')
    );
    if (found) return found;
    return {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Greenwood International School',
      code: 'GIS001',
      address: 'Campus 4, Tech Park Boulevard, Bengaluru'
    };
  }

  // 4. Explicit ABC Public School matches
  if (
    norm.includes('abc155') ||
    norm.includes('abc') ||
    norm === 'adm1' ||
    norm === 'mmrinmay76@gmail.com' ||
    norm === 'admin@abc155.edu.in' ||
    norm === 'ahana12@gmail.com' ||
    norm === 'dhardhuran689@gmail.com'
  ) {
    const found = safeList.find(i =>
      (i.code && i.code.toUpperCase() === 'ABC') ||
      i.id === '08c4960d-75d6-4a92-989b-48309500632e' ||
      i.name.toLowerCase().includes('abc')
    );
    if (found) return found;
  }

  // 3b. Explicit DAV Model School matches (Domain, Emails, and Savior_NOs / Employee IDs)
  if (
    norm.includes('dav') ||
    norm === 'admin@dav.com' ||
    norm === 'teacher1@dav.com' ||
    norm === 'teacher2@dav.com' ||
    norm.startsWith('teacher.') ||
    /^(20\d{3}|30\d{3}|50\d{3}|53\d{3}|\d{5})$/.test(norm)
  ) {
    const found = list.find(i =>
      (i.code && (i.code.toUpperCase() === 'DAV' || i.code === '15582')) ||
      i.id === '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3' ||
      i.name.toLowerCase().includes('dav')
    );
    if (found) return found;
  }

  // 4. Exact domain match against school codes or school names
  const atParts = norm.split('@');
  if (atParts.length === 2) {
    const domain = atParts[1];
    const subParts = domain.split('.');
    for (const part of subParts) {
      if (part.length >= 3 && !['com', 'edu', 'org', 'local', 'in', 'gov', 'net', 'co'].includes(part)) {
        const match = list.find(i =>
          (i.code && i.code.toLowerCase() === part) ||
          i.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(part)
        );
        if (match) return match;
      }
    }
  }

  return undefined;
}

/* ────── Login ────── */
function Login() {
  const nav = useNavigate();
  const { login, user } = useAuth();
  const { dark, toggle } = useTheme();

  useEffect(() => {
    if (user) {
      if (user.role === 'STUDENT') {
        nav('/student/dashboard', { replace: true });
      } else if (user.role === 'SUPER_ADMIN') {
        nav('/super-admin', { replace: true });
      } else {
        nav('/dashboard', { replace: true });
      }
    }
  }, [user, nav]);

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [institutesLoading, setInstitutesLoading] = useState(false);
  const [institutesError, setInstitutesError] = useState(false);
  const [selectedRole, setSelectedRole] = useState<LoginOption | null>(null);
  const [loginRole, setLoginRole] = useState<LoginOption>('SCHOOL_ADMIN');
  const [instituteId, setInstituteId] = useState<string>('');
  const [detectedInstitute, setDetectedInstitute] = useState<Institute | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupNotFound, setLookupNotFound] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const lookupAbortRef = useRef<AbortController | null>(null);
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const currentConfig = LOGIN_ROLES[loginRole];

  // Automatically select the institute/school based on the entered login ID (email or admission number)
  useEffect(() => {
    if (!currentConfig.needsSchool) {
      setInstituteId('');
      setDetectedInstitute(null);
      setLookupLoading(false);
      setLookupNotFound(false);
      return;
    }

    const cleanInput = email.trim();
    if (!cleanInput) {
      setInstituteId('');
      setDetectedInstitute(null);
      setLookupLoading(false);
      setLookupNotFound(false);
      if (lookupAbortRef.current) {
        lookupAbortRef.current.abort();
      }
      return;
    }

    // 1. Immediate client-side auto-selection
    const clientMatch = detectInstituteFromEmail(cleanInput, institutes);
    if (clientMatch) {
      setInstituteId(clientMatch.id);
      setDetectedInstitute(clientMatch);
      setLookupNotFound(false);
      setLookupLoading(false);
      try {
        localStorage.setItem('attendoschool_last_institute_id', clientMatch.id);
      } catch { }
      return;
    }

    // 2. Server-side database lookup for arbitrary database accounts / admission numbers
    if (cleanInput.length >= 3) {
      if (lookupAbortRef.current) {
        lookupAbortRef.current.abort();
      }
      const controller = new AbortController();
      lookupAbortRef.current = controller;
      setLookupLoading(true);
      setLookupNotFound(false);

      const timer = setTimeout(async () => {
        try {
          const res = await api.get(`/auth/lookup-institute?email=${encodeURIComponent(cleanInput)}`, {
            signal: controller.signal
          });
          if (res.data?.found && res.data.instituteId) {
            const serverId = String(res.data.instituteId);
            setInstituteId(serverId);
            setLookupNotFound(false);
            const instObj: Institute = {
              id: serverId,
              name: res.data.instituteName || 'Affiliated Institution',
              code: res.data.instituteCode || 'SCH'
            };
            setDetectedInstitute(instObj);
            setInstitutes(prev => {
              if (!prev.some(i => i.id === serverId)) {
                return [...prev, instObj];
              }
              return prev;
            });
            try {
              localStorage.setItem('attendoschool_last_institute_id', serverId);
            } catch { }
          } else {
            setInstituteId('');
            setDetectedInstitute(null);
            setLookupNotFound(true);
          }
        } catch (e: any) {
          if (e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') {
            setInstituteId('');
            setDetectedInstitute(null);
            setLookupNotFound(true);
          }
        } finally {
          setLookupLoading(false);
        }
      }, 250);

      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    } else {
      setInstituteId('');
      setDetectedInstitute(null);
      setLookupLoading(false);
      setLookupNotFound(false);
    }
  }, [email, institutes, currentConfig.needsSchool]);

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
        } catch { }

        // Automatically match the institute only if an identifier is already entered
        if (email.trim()) {
          const match = detectInstituteFromEmail(email, cleanList);
          if (match) {
            setInstituteId(match.id);
            setDetectedInstitute(match);
          }
        }
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
  }, [email]);

  useEffect(() => {
    try {
      localStorage.removeItem('attendoschool_cached_institutes');
    } catch { }
    fetchInstitutes();
  }, [fetchInstitutes]);

  const selectedInstitute = detectedInstitute || institutes.find(i => i.id === instituteId);

  function handleSelectRole(role: LoginOption) {
    setSelectedRole(role);
    setLoginRole(role);
    setError('');
    const cfg = LOGIN_ROLES[role];
    if (cfg.needsSchool) {
      setEmail('');
      setPassword('');
      setInstituteId('');
      setDetectedInstitute(null);
      setLookupNotFound(false);
      setLookupLoading(false);
    } else {
      setEmail(cfg.defaultEmail || '');
      setPassword('ChangeMe123!');
      setInstituteId('');
      setDetectedInstitute(null);
      setLookupNotFound(false);
      setLookupLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (currentConfig.needsSchool && !instituteId) {
      setError(
        loginRole === 'STUDENT'
          ? 'Please enter your Admission Number or Student Email to detect your school.'
          : 'Please enter your Login ID / Email to detect your school.'
      );
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        email: email.trim(),
        admissionNumber: email.trim(),
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
    <div className="as-simple-page" data-theme="dark">
      {/* 3D Educational Dynamic Animated Background */}
      <ThreeDBackground dark={true} />

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
                      <span className="as-simple-role-sub">Student & Parent Portal</span>
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


                {/* Affiliated School / Institute (Auto-detected from Login ID) */}
                {currentConfig.needsSchool && (
                  <div className="as-simple-field" style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label className="as-simple-label" style={{ margin: 0 }}>
                        School / Institute <span style={{ color: '#fb923c' }}>*</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {selectedInstitute && (
                          <span style={{
                            fontSize: 10.5,
                            color: '#34d399',
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '2px 8px',
                            borderRadius: 9999,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <Check size={11} strokeWidth={3} /> Auto-detected
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedInstitute ? (
                      <div
                        id="detected-institute-display"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(56, 189, 248, 0.05))',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(37,99,235,0.25))',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <School size={18} style={{ color: '#38bdf8' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-main, #f8fafc)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {selectedInstitute.name}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Code: <strong style={{ color: '#38bdf8' }}>{selectedInstitute.code || 'SCH'}</strong> · {selectedInstitute.address || 'Active Institution'}
                            </span>
                          </div>
                        </div>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            color: '#38bdf8',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            flexShrink: 0
                          }}
                        >
                          {selectedInstitute.code || 'ACTIVE'}
                        </span>
                      </div>
                    ) : lookupLoading ? (
                      <div
                        id="detecting-institute-placeholder"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '11px 14px',
                          borderRadius: 10,
                          background: 'rgba(56, 189, 248, 0.04)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          color: '#38bdf8',
                          fontSize: 12.5,
                          minHeight: 46
                        }}
                      >
                        <RefreshCw size={14} className="spin" style={{ flexShrink: 0 }} />
                        <span>Detecting affiliated school from Login ID...</span>
                      </div>
                    ) : lookupNotFound && email.trim().length >= 3 ? (
                      <div
                        id="not-found-institute-placeholder"
                        style={{
                          padding: '11px 14px',
                          borderRadius: 10,
                          background: 'rgba(239, 68, 68, 0.05)',
                          border: '1px dashed rgba(239, 68, 68, 0.35)',
                          color: '#f87171',
                          fontSize: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                            <span>No school auto-detected.</span>
                          </div>
                          <select
                            value={instituteId}
                            onChange={e => {
                              const val = e.target.value;
                              setInstituteId(val);
                              const matched = institutes.find(i => i.id === val);
                              setDetectedInstitute(matched || null);
                              if (val) setLookupNotFound(false);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              background: '#0f172a',
                              color: '#f8fafc',
                              fontSize: 12,
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">Select your school manually...</option>
                            {institutes.map(inst => (
                              <option key={inst.id} value={inst.id}>
                                {inst.name} ({inst.code})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div
                        id="empty-institute-placeholder"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '11px 14px',
                          borderRadius: 10,
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px dashed rgba(255, 255, 255, 0.14)',
                          color: '#94a3b8',
                          fontSize: 12.5,
                          minHeight: 46
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <School size={16} style={{ opacity: 0.45, flexShrink: 0 }} />
                          <span style={{ opacity: 0.75 }}>
                            {loginRole === 'STUDENT'
                              ? 'School will appear automatically when you enter your Admission No.'
                              : 'School will appear automatically when you enter your Login ID / Email'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Identifier Input (Admission No. for Student, Email for Faculty/Admin) */}
                <div className="as-simple-field">
                  <label className="as-simple-label">
                    {currentConfig.emailLabel} <span style={{ color: '#fb923c' }}>*</span>
                  </label>
                  <div className="as-simple-input-wrap">
                    <input
                      required
                      type="text"
                      placeholder={currentConfig.emailPlaceholder}
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

                {/* Forgot password? */}
                <div className="as-simple-meta-row" style={{ justifyContent: 'flex-end' }}>
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
                Registered Email Address, Employee ID, or Admission No.
                <input
                  type="text"
                  required
                  placeholder="e.g. teacher2@dav.com, EMP300, or Admission No."
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
          const sortedSessions = sortAcademicYearsAscending(res.data);
          setSessions(sortedSessions);
          const active = res.data.find((s: any) => s.is_active) || sortedSessions[0];
          const stored = localStorage.getItem('attendo_academic_session');
          const isValidStored = sortedSessions.some((s: any) => s.name === stored || s.code === stored);
          if (active && (!stored || !isValidStored)) {
            setCurrentSession(active.name);
            localStorage.setItem('attendo_academic_session', active.name);
            localStorage.setItem('attendo_active_academic_year', active.name);
            if (active.id) {
              localStorage.setItem('attendo_active_academic_year_id', active.id);
            }
          }
        }
      })
      .catch(() => { });
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
      .catch(() => { });
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
    } catch { }
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
    } catch { }
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
        .catch(() => { })
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
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }}></span>
              <span>{currentSession ? `${String(currentSession).replace(/\b(academic\s+)?sessions?\b/gi, '').trim()} ACADEMIC SESSION` : 'ACADEMIC SESSION'}</span>
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
                        if (sess.id) {
                          localStorage.setItem('attendo_active_academic_year_id', sess.id);
                        }
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
                        <div className={`super-notif-icon-wrap ${n.category === 'SCHOOL' ? 'notif-school' :
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
                    <span className="super-detail-label">Parent</span>
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
                  else if (cat === 'Student') nav('/students');
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
function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, updateUser } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { dark, toggle } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('attendo_staff_nav_collapsed') === 'true');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [reviewOpen, setReviewOpen] = useState(true);

  // Close mobile drawer on route change & keep review section open if active
  useEffect(() => {
    setMobileSidebarOpen(false);
    if (loc.pathname.startsWith('/review')) {
      setReviewOpen(true);
    }
  }, [loc.pathname]);

  // ── Global Search State (Menu & Page Navigation Only) ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Academic Year Switcher State ──
  const [ayDropdownOpen, setAyDropdownOpen] = useState(false);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [ayLoading, setAyLoading] = useState(false);
  const [aySwitching, setAySwitching] = useState<string | null>(null);
  const ayDropdownRef = useRef<HTMLDivElement>(null);

  // Faculty In-App Inbox Drawer state
  const [teacherDrawerOpen, setTeacherDrawerOpen] = useState(false);
  const [teacherNotices, setTeacherNotices] = useState<any[]>([]);
  const [teacherUnreadCount, setTeacherUnreadCount] = useState(0);
  const [teacherLoadingNotices, setTeacherLoadingNotices] = useState(false);

  async function loadTeacherNotices() {
    if (user?.role !== 'TEACHER') return;
    setTeacherLoadingNotices(true);
    try {
      const res = await api.get('/communication/teacher/inbox');
      const data = res.data || [];
      setTeacherNotices(data);
      const unread = data.filter((n: any) => !n.read_at).length;
      setTeacherUnreadCount(unread);
    } catch (_e) {
      setTeacherNotices([]);
    } finally {
      setTeacherLoadingNotices(false);
    }
  }

  async function markTeacherNoticeRead(recipientId: string, noticeId: string) {
    try {
      await api.post(`/communication/teacher/read/${recipientId || noticeId}`);
      setTeacherNotices(prev => prev.map(n => (n.id === noticeId || n.recipient_id === recipientId) ? { ...n, read_at: new Date().toISOString() } : n));
      setTeacherUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_e) { }
  }

  useEffect(() => {
    if (user?.role === 'TEACHER') {
      loadTeacherNotices();
    }
  }, [user?.role]);

  // ── Review Notifications (Admin Photos & Teacher Leaves) ──
  const [adminNotifs, setAdminNotifs] = useState<any[]>([]);
  const [adminNotifOpen, setAdminNotifOpen] = useState(false);
  const adminNotifRef = useRef<HTMLDivElement>(null);
  const [teacherNotifOpen, setTeacherNotifOpen] = useState(false);
  const teacherNotifRef = useRef<HTMLDivElement>(null);
  const [pendingPhotoCount, setPendingPhotoCount] = useState(0);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);

  const loadAdminNotifications = useCallback(async () => {
    try {
      const res = await api.get('/reviews/notifications');
      if (res.data?.success) {
        setAdminNotifs(res.data.notifications || []);
        setPendingPhotoCount(res.data.pendingPhotosCount || 0);
        setPendingLeaveCount(res.data.pendingLeavesCount || 0);
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (user && (user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'TEACHER')) {
      loadAdminNotifications();
      const interval = setInterval(loadAdminNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [user?.role, loadAdminNotifications]);

  useEffect(() => {
    const handleReviewsUpdated = () => {
      loadAdminNotifications();
    };
    window.addEventListener('reviews-updated', handleReviewsUpdated);
    return () => window.removeEventListener('reviews-updated', handleReviewsUpdated);
  }, [loadAdminNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (adminNotifRef.current && !adminNotifRef.current.contains(e.target as Node)) {
        setAdminNotifOpen(false);
      }
      if (teacherNotifRef.current && !teacherNotifRef.current.contains(e.target as Node)) {
        setTeacherNotifOpen(false);
      }
    }
    if (adminNotifOpen || teacherNotifOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [adminNotifOpen, teacherNotifOpen]);

  useEffect(() => {
    if (user) {
      loadAcademicYears();
      if (user.role === 'SCHOOL_ADMIN' || user.role === 'TEACHER') {
        api.get('/dashboard/school').then(res => {
          setSchoolInfo(res.data);
          if (res.data?.school && updateUser) {
            const updates: any = {};
            if (res.data.school.name && user.schoolName !== res.data.school.name) {
              updates.schoolName = res.data.school.name;
            }
            if (res.data.school.code && (user as any).schoolCode !== res.data.school.code) {
              updates.schoolCode = res.data.school.code;
            }
            if (res.data.school.photo_url && (user as any).schoolPhotoUrl !== res.data.school.photo_url) {
              updates.schoolPhotoUrl = res.data.school.photo_url;
              updates.school_photo_url = res.data.school.photo_url;
            }
            if (Object.keys(updates).length > 0) {
              updateUser(updates);
            }
          }
        }).catch(() => { });
        if (user.role === 'TEACHER') {
          api.get('/teacher/profile').then(res => {
            const updates: any = {};
            if (res.data?.schoolName && user.schoolName !== res.data.schoolName) {
              updates.schoolName = res.data.schoolName;
            }
            if (res.data?.schoolWebsite) {
              updates.schoolWebsite = res.data.schoolWebsite;
              setSchoolInfo((prev: any) => ({
                ...prev,
                school: {
                  ...(prev?.school || {}),
                  website: res.data.schoolWebsite
                }
              }));
              try {
                localStorage.setItem('attendo_school_website', res.data.schoolWebsite);
              } catch { }
            }
            if (Object.keys(updates).length > 0 && updateUser) {
              updateUser(updates);
            }
          }).catch(() => { });
        }
      }
    }
  }, [user?.role]);

  useEffect(() => {
    const handleSchoolUpdated = (e: any) => {
      if (e.detail) {
        if (e.detail.website) {
          try {
            localStorage.setItem('attendo_school_website', e.detail.website);
          } catch { }
          if (updateUser) {
            updateUser({ schoolWebsite: e.detail.website });
          }
        }
        setSchoolInfo((prev: any) => ({
          ...prev,
          school: {
            ...(prev?.school || {}),
            ...e.detail
          }
        }));
      }
    };
    const handleStorageUpdated = (e: StorageEvent) => {
      if (e.key === 'attendo_school_website' && e.newValue) {
        setSchoolInfo((prev: any) => ({
          ...prev,
          school: {
            ...(prev?.school || {}),
            website: e.newValue
          }
        }));
        if (updateUser) {
          updateUser({ schoolWebsite: e.newValue });
        }
      }
    };
    window.addEventListener('school-profile-updated', handleSchoolUpdated);
    window.addEventListener('storage', handleStorageUpdated);
    return () => {
      window.removeEventListener('school-profile-updated', handleSchoolUpdated);
      window.removeEventListener('storage', handleStorageUpdated);
    };
  }, [updateUser]);

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
        setAdminNotifOpen(false);
        setTeacherNotifOpen(false);
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
      setSelectedIndex(0);
    }
  }, [searchOpen]);

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
      const res = await api.get('/academic-years?fresh=1');
      if (Array.isArray(res.data) && res.data.length > 0) {
        const stored = localStorage.getItem('attendo_active_academic_year') || localStorage.getItem('attendo_academic_session');
        const storedId = localStorage.getItem('attendo_active_academic_year_id');
        // Prioritize user's selected session from localStorage if it exists in res.data
        const storedMatch =
          (storedId ? res.data.find((ay: any) => String(ay.id) === String(storedId)) : null) ||
          (stored ? res.data.find((ay: any) => ay.name === stored || ay.code === stored || String(ay.id) === String(stored)) : null);
        const activeFromDb = res.data.find((ay: any) => ay.is_active);
        const current = storedMatch || activeFromDb || res.data[0];

        // Enforce strictly 1 active session in the state list (sorted ascending)
        const sortedRes = sortAcademicYearsAscending(res.data);
        const normalized = sortedRes.map((ay: any) => ({
          ...ay,
          is_active: ay.id === current.id
        }));
        setAcademicYears(normalized);

        if (current) {
          setSchoolInfo((prev: any) => ({
            ...(prev || {}),
            activeAcademicYear: current
          }));
          localStorage.setItem('attendo_active_academic_year', current.name);
          localStorage.setItem('attendo_academic_session', current.name);
          localStorage.setItem('attendo_active_academic_year_id', current.id);
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

    // 1. Optimistically update local dropdown state immediately: strictly ONE is_active
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
      localStorage.setItem('attendo_active_academic_year_id', target.id);
      window.dispatchEvent(new CustomEvent('sessionChanged', { detail: target.name }));
      window.dispatchEvent(new Event('storage'));
    }

    try {
      if (user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN') {
        // 3. Post to backend activation endpoint for admins
        await api.post(`/academic-years/${yearId}/activate`);

        // 4. Re-fetch school dashboard and academic years for this specific session
        const res = await api.get('/dashboard/school', {
          params: { academicYearId: target?.id || yearId, session: target?.name }
        });
        if (res.data) {
          setSchoolInfo(res.data);
        }
      }
      const refreshedYears = await api.get('/academic-years?fresh=1');
      if (Array.isArray(refreshedYears.data) && refreshedYears.data.length > 0) {
        const activeFound = refreshedYears.data.find((y: any) => y.id === yearId) || refreshedYears.data.find((y: any) => y.is_active) || refreshedYears.data[0];
        setAcademicYears(refreshedYears.data.map((y: any) => ({
          ...y,
          is_active: y.id === activeFound.id
        })));
      }
    } catch (err) {
      console.warn('Academic year activation sync warning:', err);
    } finally {
      setAySwitching(null);
      // Auto-close dropdown smoothly after a brief pause so user sees checkmark
      setTimeout(() => setAyDropdownOpen(false), 350);
    }
  }

  // ── Navigation Menu Items for Global Command Palette (No Students / Teachers) ──
  const menuItems = useMemo(() => {
    if (!user) return [];

    if (user.role === 'SCHOOL_ADMIN') {
      return [
        {
          path: '/dashboard',
          label: 'Dashboard',
          category: 'Main Navigation',
          description: 'School overview, statistics, daily attendance pulse & live metrics',
          icon: LayoutDashboard,
          keywords: ['home', 'main', 'stats', 'metrics', 'overview', 'summary']
        },
        {
          path: '/students',
          label: 'Students',
          category: 'Main Navigation',
          description: 'Student directory, enrollments, admissions, documents & profiles',
          icon: Users,
          keywords: ['students', 'directory', 'admissions', 'enrollment', 'roster', 'pupils']
        },
        {
          path: '/teachers',
          label: 'Teachers & Staff',
          category: 'Main Navigation',
          description: 'Faculty directory, teacher profiles, employee IDs & department roster',
          icon: GraduationCap,
          keywords: ['teachers', 'faculty', 'staff', 'instructors', 'educators', 'employee']
        },
        {
          path: '/designations',
          label: 'Staff Designations',
          category: 'Main Navigation',
          description: 'Manage faculty designations, teacher roles, department titles & hierarchy',
          icon: Award,
          keywords: ['designations', 'designation', 'roles', 'faculty roles', 'titles', 'job titles']
        },
        {
          path: '/classes',
          label: 'Classes, Sections & Teachers',
          category: 'Main Navigation',
          description: 'Manage grade levels, classrooms, divisions & class teacher allocations',
          icon: Layers,
          keywords: ['classes', 'sections', 'grades', 'classrooms', 'divisions', 'rooms', 'teachers', 'class administration']
        },
        {
          path: '/attendance-reports',
          label: 'Attendance Reports',
          category: 'Main Navigation',
          description: 'School-wide attendance registers, monthly reports & analytics',
          icon: ClipboardCheck,
          keywords: ['attendance', 'reports', 'register', 'daily attendance', 'absent', 'present']
        },
        {
          path: '/timetable',
          label: 'Timetable & Schedule',
          category: 'Main Navigation',
          description: 'Weekly timetable, class periods & schedule management',
          icon: CalendarDays,
          keywords: ['timetable', 'schedule', 'periods', 'routine', 'bell timing']
        },
        {
          path: '/academic-years',
          label: 'Academic Calendar & Sessions',
          category: 'Academics',
          description: 'Academic sessions, term dates, and calendar setup',
          icon: Clock,
          keywords: ['academic year', 'sessions', 'calendar', 'terms', 'session switch']
        },
        {
          path: '/working-calendar',
          label: 'Working Days Configuration',
          category: 'Academics',
          description: 'Configure operational school days and instructional schedule',
          icon: Calendar,
          keywords: ['working days', 'operational days', 'weekdays', 'school calendar']
        },
        {
          path: '/holidays',
          label: 'Holidays List',
          category: 'Academics',
          description: 'Declared school holidays, vacations & public holiday schedule',
          icon: CalendarDays,
          keywords: ['holidays', 'vacation', 'breaks', 'festivals', 'off days']
        },
        {
          path: '/subjects',
          label: 'Subjects & Curriculum',
          category: 'Academics',
          description: 'Subject list, curriculum mapping, course codes & credits',
          icon: BookOpen,
          keywords: ['subjects', 'curriculum', 'courses', 'syllabus']
        },
        {
          path: '/routine',
          label: 'Class Routine Setup',
          category: 'Academics',
          description: 'Daily class routine layout, period timing & structure',
          icon: CalendarDays,
          keywords: ['routine', 'class routine', 'bell schedule', 'periods']
        },
        {
          path: '/promotion',
          label: 'Student Promotions',
          category: 'Academics',
          description: 'Promote students to next class / academic session batch',
          icon: ArrowUpDown,
          keywords: ['promotion', 'promote', 'progression', 'next grade', 'batch transition']
        },
        {
          path: '/communication',
          label: 'Announcements & Broadcasts',
          category: 'Communication',
          description: 'Broadcast school-wide announcements, news & notices',
          icon: MessageSquare,
          keywords: ['announcements', 'broadcast', 'notices', 'circulars', 'communication', 'bulletins', 'bulletin']
        },
        {
          path: '/smtp-logs',
          label: 'SMTP Email Logs',
          category: 'Communication',
          description: 'Email delivery audit logs, password setup & notification history',
          icon: Mail,
          keywords: ['smtp', 'email logs', 'delivery', 'welcome emails', 'mail status']
        },
        {
          path: '/leave-policy',
          label: 'Leave Policy',
          category: 'Management',
          description: 'Configure institutional leave types, dynamic counts, and yearly or half-yearly renewal cycles',
          icon: FileText,
          keywords: ['leave policy', 'casual leave', 'sick leave', 'earned leave', 'leave rules', 'yearly leave', 'half yearly leave']
        },
        {
          path: '/classes?tab=temporary',
          label: 'Teacher Substitution',
          category: 'Academics',
          description: 'Assign substitute teachers and manage temporary class allocations for specific dates',
          icon: ClipboardCheck,
          keywords: ['teacher substitution', 'substitute teacher', 'temporary assignment', 'temp mentor', 'proxy attendance', 'substitution']
        },
        {
          path: '/teacher-leave-approvals',
          label: 'Teacher Leave Review',
          category: 'Reviews & Approvals',
          description: 'Review and approve teacher leave applications',
          icon: CalendarCheck,
          keywords: ['teacher leave', 'leave review', 'leave approvals', 'staff absence']
        },
        {
          path: '/leave-applications',
          label: 'Student Leave Review',
          category: 'Reviews & Approvals',
          description: 'Review and approve student absence requests',
          icon: CalendarCheck,
          keywords: ['student leave', 'leave review', 'absence requests', 'student approvals']
        },
        {
          path: '/photo-approvals',
          label: 'Student Photo Approvals',
          category: 'Reviews & Approvals',
          description: 'Review submitted student ID photos and profile pictures',
          icon: Camera,
          keywords: ['photo approvals', 'student photos', 'profile picture review', 'id photos']
        },
        {
          path: '/classes',
          label: 'Class Administration',
          category: 'Academics',
          description: 'Manage grade levels, sections, and allocate permanent class teachers',
          icon: Users,
          keywords: ['class administration', 'class teacher', 'class mentor', 'mentor', 'mentors', 'class teachers', 'teacher mentor', 'section mentor', 'teacher allocation']
        },
        {
          path: '/analytics',
          label: 'Reports & Analytics',
          category: 'Management',
          description: 'Attendance analytics, visual charts, trends and KPIs',
          icon: BarChart3,
          keywords: ['analytics', 'charts', 'trends', 'metrics', 'kpi', 'reports']
        },
        {
          path: '/invoices',
          label: 'Invoices & Receipts',
          category: 'Billing',
          description: 'Official subscription invoices, statements & receipts',
          icon: FileText,
          keywords: ['invoices', 'bills', 'receipts']
        },
        {
          path: '/payments',
          label: 'Payment History',
          category: 'Billing',
          description: 'Payment transactions, receipts and payment history',
          icon: CreditCard,
          keywords: ['payments', 'transactions', 'billing history']
        },
        {
          path: '/school-profile',
          label: 'School Profile & Branding',
          category: 'Settings',
          description: 'School name, crest/logo, website, code & contact details',
          icon: Building2,
          keywords: ['profile', 'settings', 'school profile', 'logo', 'branding', 'website']
        },
        {
          path: '/permissions',
          label: 'Permissions & Roles',
          category: 'Settings',
          description: 'Manage staff roles, access permissions and privileges',
          icon: ShieldCheck,
          keywords: ['permissions', 'roles', 'rbac', 'access control', 'security']
        },
        {
          path: '/backups',
          label: 'Backups & Security',
          category: 'Settings',
          description: 'Data export, system backups, and database security',
          icon: Database,
          keywords: ['backups', 'export', 'security', 'database']
        }
      ];
    }

    if (user.role === 'TEACHER') {
      return [
        {
          path: '/dashboard',
          label: 'Dashboard',
          category: 'Main Navigation',
          description: "Today's schedule, classes, and quick teacher actions",
          icon: LayoutDashboard,
          keywords: ['home', 'main', 'today', 'schedule']
        },
        {
          path: '/take-attendance',
          label: 'Take Attendance',
          category: 'Main Navigation',
          description: 'Mark student attendance for assigned periods & classes',
          icon: ClipboardCheck,
          keywords: ['attendance', 'take attendance', 'mark attendance', 'roll call', 'present', 'absent']
        },
        // {
        //   path: '/teacher-history',
        //   label: 'Attendance History',
        //   category: 'Main Navigation',
        //   description: 'View past submitted attendance records and class logs',
        //   icon: CalendarDays,
        //   keywords: ['history', 'past attendance', 'attendance records', 'logs']
        // },
        {
          path: '/attendance-reports',
          label: 'Attendance Reports',
          category: 'Main Navigation',
          description: 'Student attendance percentages, monthly sheets & summaries',
          icon: FileText,
          keywords: ['reports', 'sheets', 'attendance summary']
        },
        {
          path: '/timetable',
          label: 'My Timetable',
          category: 'Main Navigation',
          description: 'Weekly teaching timetable and class schedule',
          icon: CalendarDays,
          keywords: ['timetable', 'schedule', 'routine', 'classes']
        },
        {
          path: '/teacher/assignments',
          label: 'Assignments & Homework',
          category: 'Workspace',
          description: 'Create homework, manage assignments & review student submissions',
          icon: BookOpen,
          keywords: ['assignments', 'homework', 'tasks', 'submissions']
        },
        {
          path: '/leave-applications',
          label: 'Student Leave Review',
          category: 'Workspace',
          description: 'Review and approve student leave and absence requests',
          icon: CalendarCheck,
          keywords: ['student leave', 'leave review', 'approvals']
        },
        {
          path: '/photo-approvals',
          label: 'Student Photo Approvals',
          category: 'Workspace',
          description: 'Review submitted student ID photos and profile pictures',
          icon: Camera,
          keywords: ['photo approvals', 'student photos', 'pictures']
        },
        {
          path: '/teacher/leave-request',
          label: 'Apply Leave',
          category: 'Workspace',
          description: 'Submit teacher leave application and view leave approval status',
          icon: CalendarPlus,
          keywords: ['apply leave', 'leave request', 'time off', 'vacation']
        },
        {
          path: '/teacher/mentor-workspace',
          label: 'Class Mentor Workspace',
          category: 'Workspace',
          description: 'Mentored class student monitoring and attendance overview',
          icon: Users,
          keywords: ['mentor', 'workspace', 'class mentor']
        },
        {
          path: '/announcements',
          label: 'School Announcements',
          category: 'Communication',
          description: 'School announcements, circulars & bulletins',
          icon: Megaphone,
          keywords: ['announcements', 'circulars', 'notices', 'bulletins']
        },
        {
          path: '/teacher/profile',
          label: 'My Profile',
          category: 'Settings',
          description: 'Manage personal profile, contact information & password',
          icon: User,
          keywords: ['profile', 'account', 'password', 'settings']
        }
      ];
    }

    if (user.role === 'SUPER_ADMIN') {
      return [
        {
          path: '/super-admin',
          label: 'Platform Overview',
          category: 'Platform Management',
          description: 'Platform overview, tenant schools & global metrics',
          icon: LayoutDashboard,
          keywords: ['dashboard', 'overview', 'metrics']
        },
        {
          path: '/super-admin/schools',
          label: 'Schools Directory',
          category: 'Platform Management',
          description: 'Manage school tenants, onboarding & status',
          icon: School,
          keywords: ['schools', 'tenants', 'institutions']
        },
        {
          path: '/super-admin/subscriptions',
          label: 'Subscriptions',
          category: 'Platform Management',
          description: 'School subscription plans, tiers & limits',
          icon: CalendarDays,
          keywords: ['subscriptions', 'plans']
        },
        {
          path: '/super-admin/payments',
          label: 'Payments',
          category: 'Platform Management',
          description: 'Platform revenue, transactions & payment gateways',
          icon: CreditCard,
          keywords: ['payments', 'revenue', 'transactions']
        },
        {
          path: '/super-admin/invoices',
          label: 'Invoices',
          category: 'Platform Management',
          description: 'Billing statements and issued invoices',
          icon: FileText,
          keywords: ['invoices', 'bills', 'statements']
        },
        {
          path: '/super-admin/monitoring',
          label: 'System Monitoring',
          category: 'Platform Management',
          description: 'Server health, worker processes & uptime',
          icon: Eye,
          keywords: ['monitoring', 'health', 'uptime', 'server']
        },
        {
          path: '/super-admin/reports',
          label: 'Platform Reports',
          category: 'Platform Management',
          description: 'Cross-school aggregated reports & analytics',
          icon: BarChart3,
          keywords: ['reports', 'analytics']
        },
        {
          path: '/super-admin/people',
          label: 'People & Staff',
          category: 'Platform Administration',
          description: 'Platform administrators and user accounts',
          icon: Users,
          keywords: ['people', 'users', 'administrators']
        },
        {
          path: '/super-admin/permissions',
          label: 'Roles & Permissions',
          category: 'Platform Administration',
          description: 'Platform security roles & permissions',
          icon: ShieldCheck,
          keywords: ['permissions', 'roles', 'rbac']
        },
        {
          path: '/super-admin/security',
          label: 'Security Policies',
          category: 'Platform Administration',
          description: 'Authentication policies & security controls',
          icon: Shield,
          keywords: ['security', 'policies', 'auth']
        },
        {
          path: '/super-admin/audit-logs',
          label: 'Audit Logs',
          category: 'Platform Administration',
          description: 'Administrative activity trail & change logs',
          icon: FileSpreadsheet,
          keywords: ['audit', 'logs', 'activity']
        },
        {
          path: '/super-admin/backups',
          label: 'System Backups',
          category: 'Platform Administration',
          description: 'Database snapshots & system restoration',
          icon: Database,
          keywords: ['backups', 'snapshots', 'recovery']
        },
        {
          path: '/smtp-logs',
          label: 'SMTP Email Logs',
          category: 'Platform Administration',
          description: 'Global SMTP email logs and notification status',
          icon: Mail,
          keywords: ['smtp', 'email logs', 'notifications']
        }
      ];
    }

    if (user.role === 'STUDENT') {
      return [
        { path: '/student/dashboard', label: 'Dashboard', category: 'Student Portal', description: 'Student dashboard & daily overview', icon: LayoutDashboard, keywords: ['home', 'dashboard'] },
        { path: '/student/attendance', label: 'My Attendance', category: 'Student Portal', description: 'Personal attendance records & statistics', icon: ClipboardCheck, keywords: ['attendance', 'presence'] },
        { path: '/student/timetable', label: 'My Timetable', category: 'Student Portal', description: 'Class schedule & routine', icon: CalendarDays, keywords: ['timetable', 'schedule'] },
        { path: '/student/assignments', label: 'Assignments', category: 'Student Portal', description: 'Class homework & tasks', icon: BookOpen, keywords: ['assignments', 'homework'] },
        { path: '/student/exams', label: 'Exams', category: 'Student Portal', description: 'Exam schedules & results', icon: FileText, keywords: ['exams', 'tests'] },
        { path: '/student/announcements', label: 'Announcements', category: 'Student Portal', description: 'School announcements & circulars', icon: Megaphone, keywords: ['announcements', 'notices'] },
        { path: '/student/leave-request', label: 'Apply Leave', category: 'Student Portal', description: 'Apply for leave & check status', icon: CalendarPlus, keywords: ['leave', 'sick leave'] },
        { path: '/student/profile', label: 'My Profile', category: 'Student Portal', description: 'Personal profile & account', icon: User, keywords: ['profile', 'account'] }
      ];
    }

    return [];
  }, [user]);

  // Filter menu items matching search query in real-time (only active when user types a query)
  const filteredMenuItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return menuItems.filter(item => {
      if (item.label.toLowerCase().includes(q)) return true;
      if (item.category.toLowerCase().includes(q)) return true;
      if (item.description.toLowerCase().includes(q)) return true;
      if (item.path.toLowerCase().includes(q)) return true;
      if (item.keywords?.some((k: string) => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [menuItems, searchQuery]);

  // Group filtered results by category for clean visual hierarchy
  const groupedMenuResults = useMemo(() => {
    const map = new Map<string, typeof filteredMenuItems>();
    filteredMenuItems.forEach(item => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });
    return Array.from(map.entries());
  }, [filteredMenuItems]);

  // Handle keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredMenuItems.length > 0 ? (prev + 1) % filteredMenuItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredMenuItems.length > 0 ? (prev - 1 + filteredMenuItems.length) % filteredMenuItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredMenuItems[selectedIndex]) {
        setSearchOpen(false);
        nav(filteredMenuItems[selectedIndex].path);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchOpen(false);
    }
  };

  // Dynamic browser title for School Admin & Teacher portals
  useEffect(() => {
    const originalTitle = 'AttendoSchool - Smart School Attendance & Cloud SIS Platform';
    if (user?.role === 'SCHOOL_ADMIN') {
      const resolvedName = schoolInfo?.school?.name || user?.schoolName || 'School Administration';
      document.title = `${resolvedName} | Admin Portal`;
    } else if (user?.role === 'TEACHER') {
      const resolvedName = user?.schoolName || schoolInfo?.school?.name || 'School';
      document.title = `${resolvedName} | Teacher Portal`;
    } else {
      document.title = originalTitle;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [user?.role, user?.schoolName, schoolInfo?.school?.name]);

  if (!user) return null;

  const adminLinks: any[] = [
    ['—', 'MAIN'],
    ['/dashboard', 'Dashboard', LayoutDashboard],
    ['/students', 'Students', Users],
    ['/teachers', 'Teachers', GraduationCap],
    ['/designations', 'Designations', Award],
    ['/classes', 'Classes, Sections & Teachers', Layers],
    ['/attendance-reports', 'Attendance', ClipboardCheck],
    ['/timetable', 'Timetable', CalendarDays],
    ['—', 'ACADEMICS'],
    ['/academic-years', 'Academic Calendar & Holidays', Clock],
    ['/subjects', 'Subjects', BookOpen],
    ['/promotion', 'Student Promotions', ArrowUpDown],
    ['—', 'COMMUNICATION'],
    ['/communication', 'Announcements', MessageSquare],
    ['/smtp-logs', 'SMTP Email Logs', Mail],
    ...(user.role !== 'SCHOOL_ADMIN' ? [['/notifications', 'Parent Communication', Bell]] : []),
    ['—', 'MANAGEMENT'],
    // ['/attendance-corrections', 'Corrections', CheckCircle2], // Temporarily commented out as requested
    ['/analytics', 'Reports & Analytics', BarChart3],
    ['/leave-policy', 'Leave Policy', FileText],
    ['/photo-approvals', 'Photo Approvals', Camera],
    ['/teacher-leave-approvals', "Teacher's Leave Review", CalendarCheck],
    ['—', 'BILLING'],
    ['/invoices', 'Invoices', FileText],
    ['/payments', 'Payments', CreditCard],
    ['—', 'SETTINGS'],
    ['/school-profile', 'School Profile', Building2],
    ['/permissions', 'Permissions & Roles', ShieldCheck],
    ['/backups', 'Backups & Security', Database],
  ];

  const teacherLinks: any[] = [
    ['—', 'MAIN'],
    ['/dashboard', 'Dashboard', LayoutDashboard],
    ['/take-attendance', 'Take Attendance', ClipboardCheck],
    // ['/teacher-history', 'History', CalendarDays], // Temporarily commented out as requested
    ['—', 'REVIEW'],
    ['/teacher/assignments', 'Assignments', BookOpen],
    ['/leave-applications', 'Leave Review', CalendarCheck],
    ['/photo-approvals', 'Photo Approvals', Camera],
    ['/teacher/leave-request', 'Apply Leave', CalendarPlus],
    ['—', 'COMMUNICATION'],
    ['/announcements', 'Announcements', Megaphone],
    ['—', 'ATTENDANCE'],
    ['/teacher/mentor-workspace', 'Class Mentor Workspace', Users],
    // ['/attendance-corrections','Corrections',ArrowUpDown], // Temporarily commented out as requested
    ['/timetable', 'Timetable', CalendarDays],
    ['/teacher/profile', 'Profile', User],
  ];

  const superAdminLinks: any[] = [
    ['/super-admin', 'Overview', LayoutDashboard],
    ['/super-admin/schools', 'Schools', School],
    ['/super-admin/subscriptions', 'Subscriptions', CalendarDays],
    ['/super-admin/payments', 'Payments', CreditCard],
    ['/super-admin/invoices', 'Invoices', FileText],
    ['/super-admin/monitoring', 'Monitoring & System Health', Eye],
    ['/super-admin/reports', 'Reports', BarChart3],
    ['—', 'ADMINISTRATION'],
    ['/super-admin/people', 'People', Users],
    ['/super-admin/permissions', 'Roles & Permissions', ShieldCheck],
    ['/super-admin/security', 'Security', Shield],
    ['/super-admin/audit-logs', 'Audit Logs', FileSpreadsheet],
    ['/super-admin/backups', 'Backups', Database],
  ];

  const rawLinks = user.role === 'SUPER_ADMIN' ? superAdminLinks :
    user.role === 'TEACHER' ? teacherLinks :
      adminLinks;

  const links = rawLinks.filter(item => {
    if (user.role === 'SCHOOL_ADMIN') {
      if (item[0] === '/notifications' || item[1] === 'Parent Communication') return false;
      if (item[0] === '/leave-applications' || item[1] === 'Leave Applications' || item[1] === 'Leave Review') return false;
      if (item[0] === '/photo-approvals' || item[1] === 'Photo Approvals') return false;
      if (item[0] === '/offline-attendance' || item[1] === 'Offline Mode') return false;
    }
    if (user.role === 'TEACHER') {
      if (item[0] === '/offline-attendance' || item[1] === 'Offline Mode') return false;
    }
    return true;
  });

  const isDavSchool =
    String(schoolInfo?.school?.name || '').toUpperCase().includes('DAV') ||
    String((user as any)?.schoolName || '').toUpperCase().includes('DAV') ||
    String(schoolInfo?.school?.code || '').includes('15582') ||
    String((user as any)?.schoolCode || '').includes('15582') ||
    String((user as any)?.email || '').toLowerCase().includes('@dav.') ||
    (user as any)?.schoolId === '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3';

  const rawSchoolCode = schoolInfo?.school?.code || (user as any)?.schoolCode || (user as any)?.school_code || (isDavSchool ? '15582' : 'SCH');
  const currentSchoolCode = (isDavSchool || rawSchoolCode === 'SCH') ? (isDavSchool ? '15582' : rawSchoolCode) : rawSchoolCode;

  const rawSchoolName = schoolInfo?.school?.name || (user as any)?.schoolName || (user.role === 'SUPER_ADMIN' ? 'AttendoSchool' : user.role === 'TEACHER' ? 'School' : 'School Administration');
  const currentSchoolName = isDavSchool ? 'DAV MODEL SCHOOL' : rawSchoolName;

  const rawPhoto = schoolInfo?.school?.photo_url || schoolInfo?.school?.photoUrl || (user as any)?.school_photo_url || (user as any)?.schoolPhotoUrl || (user.role === 'SCHOOL_ADMIN' ? ((user as any)?.photo_url || (user as any)?.photoUrl) : null);
  const currentSchoolPhoto = rawPhoto || (isDavSchool ? '/dav-logo.png' : null);

  const normalizeWebsiteUrl = (url?: string | null) => {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const rawWebsite =
    schoolInfo?.school?.website ||
    (user as any)?.schoolWebsite ||
    (user as any)?.school_website ||
    (typeof window !== 'undefined' ? localStorage.getItem('attendo_school_website') : '') ||
    (isDavSchool ? 'https://davmodeldurgapur.org' : '');

  const currentSchoolWebsite = normalizeWebsiteUrl(rawWebsite);

  const handleOpenSchoolWebsite = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentSchoolWebsite) {
      window.open(currentSchoolWebsite, '_blank', 'noopener,noreferrer');
    }
  };

  const storedSession = localStorage.getItem('attendo_active_academic_year') || localStorage.getItem('attendo_academic_session');
  const storedSessionId = localStorage.getItem('attendo_active_academic_year_id');
  const authoritativeActiveYear =
    (storedSessionId ? academicYears.find((ay: any) => String(ay.id) === String(storedSessionId)) : null) ||
    (storedSession ? academicYears.find((ay: any) => ay.name === storedSession || ay.code === storedSession || String(ay.id) === String(storedSession)) : null) ||
    academicYears.find((ay: any) => ay.is_active) ||
    (schoolInfo?.activeAcademicYear?.id ? academicYears.find((ay: any) => String(ay.id) === String(schoolInfo.activeAcademicYear.id)) : null) ||
    (schoolInfo?.activeAcademicYear?.name ? academicYears.find((ay: any) => ay.name === schoolInfo.activeAcademicYear.name) : null) ||
    (academicYears.length > 0 ? academicYears[0] : null);

  const authoritativeActiveYearId = authoritativeActiveYear?.id || null;
  const rawSessionName = authoritativeActiveYear?.name || schoolInfo?.activeAcademicYear?.name || storedSession || '2026–27';
  const cleanSessionName = String(rawSessionName || '').replace(/\b(academic\s+)?sessions?\b/gi, '').trim();
  const activeSessionName = cleanSessionName || '2026–27';

  const handleNavigationToggle = () => {
    if (window.matchMedia('(max-width: 1180px)').matches) {
      setMobileSidebarOpen(previous => !previous);
      return;
    }
    setSidebarCollapsed(previous => {
      const next = !previous;
      localStorage.setItem('attendo_staff_nav_collapsed', String(next));
      return next;
    });
  };

  return <div className="app-shell">
    {/* ── Mobile Sidebar Backdrop ── */}
    {mobileSidebarOpen && (
      <div
        className="sidebar-backdrop"
        onClick={() => setMobileSidebarOpen(false)}
        aria-label="Close navigation"
      />
    )}
    <aside id="primary-navigation" className={`${(sidebarCollapsed && !mobileSidebarOpen) ? 'sidebar-collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div
          className="sidebar-brand-interactive"
          onClick={handleOpenSchoolWebsite}
          title={currentSchoolWebsite ? `Visit Official School Website: ${currentSchoolWebsite}` : (user.role === 'SUPER_ADMIN' ? 'AttendoSchool' : currentSchoolName)}
          style={{
            cursor: currentSchoolWebsite ? 'pointer' : 'default',
            userSelect: 'none'
          }}
        >
          <div className="school-crest">
            <img
              src={currentSchoolPhoto || (isDavSchool ? '/dav-logo.png' : '/attendo-school-logo.png')}
              alt={user.role === 'SUPER_ADMIN' ? 'AttendoSchool' : currentSchoolName}
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = isDavSchool ? '/dav-logo.png' : '/attendo-school-logo.png';
                if (target.src !== fallback && !target.src.endsWith(fallback)) {
                  target.src = fallback;
                }
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div className="school-info">
            <span className="school-name">{user.role === 'SUPER_ADMIN' ? 'AttendoSchool' : currentSchoolName}</span>
            <span className="school-meta">
              {user.role === 'SUPER_ADMIN' ? 'Platform Administration' : `Code: ${currentSchoolCode} · Affiliated`}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-collapse-toggle-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleNavigationToggle();
          }}
          aria-label={sidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
          title={sidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <button
          type="button"
          className="sidebar-mobile-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            setMobileSidebarOpen(false);
          }}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>
      <div className="sidebar-nav-container">
        <nav>
          {links.map(([p, l, I, sub]: any, i: number) => {
            if (p === '—') return <div className="sidebar-section-label" key={`s-${i}`}>{l}</div>;
            if (sub && Array.isArray(sub)) {
              const isChildActive = sub.some(([sp]: any) => loc.pathname === sp);
              return (
                <div key={`group-${p}-${l}`} className="sidebar-group-wrap" style={{ display: 'grid', gap: 2 }}>
                  <button
                    type="button"
                    className={`sidebar-group-btn ${isChildActive ? 'nav-active-parent' : ''}`}
                    onClick={() => setReviewOpen(prev => !prev)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <I size={16} /> <span>{l}</span>
                    </div>
                    {reviewOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {reviewOpen && (
                    <div style={{ display: 'grid', gap: 2, paddingLeft: 10, marginLeft: 16, borderLeft: '2px solid var(--border)' }}>
                      {sub.map(([sp, sl, SubIcon]: any) => (
                        <button
                          key={`${sp}-${sl}`}
                          type="button"
                          className={loc.pathname === sp ? 'nav-active' : ''}
                          onClick={() => { setMobileSidebarOpen(false); nav(sp); }}
                          style={{
                            fontSize: 13,
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontWeight: loc.pathname === sp ? 600 : 500
                          }}
                        >
                          <SubIcon size={14} /> <span>{sl}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return <button key={`${p}-${l}`} className={loc.pathname === p ? 'nav-active' : ''} onClick={() => { setMobileSidebarOpen(false); nav(p); }} style={{ textAlign: 'left' }}>
              <I size={16} style={{ flexShrink: 0 }} /> <span style={{ textAlign: 'left' }}>{l}</span>
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
            <button className="theme-toggle" onClick={toggle} title={dark ? 'Light mode' : 'Dark mode'}>
              {dark ? <Sun size={15} /> : <Moon size={15} />} <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button className="logout" onClick={() => { logout(); nav('/login') }}>
              <LogOut size={15} /> <span>Sign out</span>
            </button>
          </>
        )}
      </div>
    </aside>
    <main>
      {user.role === 'SUPER_ADMIN' ? (
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              className="header-icon-btn mobile-menu-btn mobile-only-menu-btn"
              onClick={() => setMobileSidebarOpen(prev => !prev)}
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <Menu size={18} />
            </button>
            <div className="header-search" style={{ width: 380, maxWidth: 440 }} onClick={() => setSearchOpen(true)}>
              <Search size={15} />
              <input placeholder="Search menu, pages..." readOnly style={{ cursor: 'pointer' }} />
              <span className="header-kbd">CTRL+K</span>
            </div>
          </div>
          <div className="header-right">
            <div className="ay-switcher-wrap" ref={ayDropdownRef} style={{ position: 'relative' }}>
              <div
                className="session-pill"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                onClick={() => { setAyDropdownOpen(prev => !prev); if (!ayDropdownOpen) loadAcademicYears(); }}
                title="Switch Academic Session"
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }}></span>
                <span>{activeSessionName ? `${activeSessionName} ACADEMIC SESSION` : 'ACADEMIC SESSION'}</span>
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
                    <div className="ay-dropdown-empty">No academic sessions found in database.</div>
                  ) : (
                    <div className="ay-dropdown-list">
                      {academicYears.map((ay: any) => {
                        const isActive = ay.id === authoritativeActiveYearId;
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
            <button className="header-icon-btn" title="Notifications" onClick={() => nav('/notifications')}>
              <Bell size={16} />
              <span className="header-badge-num">3</span>
            </button>
            <div className="profile-pill">
              <div className="user-avatar" style={{ background: '#1d4ed8', color: '#ffffff', fontWeight: 700, fontSize: 13 }}>
                {user.name ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'SA'}
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
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              type="button"
              className="header-icon-btn mobile-menu-btn mobile-only-menu-btn"
              onClick={() => setMobileSidebarOpen(prev => !prev)}
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <Menu size={18} />
            </button>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, cursor: currentSchoolWebsite ? 'pointer' : 'default' }}
              onClick={handleOpenSchoolWebsite}
              title={currentSchoolWebsite ? `Visit Official School Website: ${currentSchoolWebsite}` : currentSchoolName}
            >
              <div
                className="school-crest"
                style={{ width: 34, height: 34, background: '#ffffff', border: '1px solid var(--border)', padding: 2, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}
              >
                <img
                  src={currentSchoolPhoto || (isDavSchool ? '/dav-logo.png' : '/attendo-school-logo.png')}
                  alt={currentSchoolName}
                  onError={(e) => {
                    const target = e.currentTarget;
                    const fallback = isDavSchool ? '/dav-logo.png' : '/attendo-school-logo.png';
                    if (target.src !== fallback && !target.src.endsWith(fallback)) {
                      target.src = fallback;
                    }
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentSchoolName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Code: <b>{currentSchoolCode}</b> · {currentSchoolName}
                </div>
              </div>
            </div>
            <div className="header-search" style={{ marginLeft: 16, width: 380, maxWidth: 440, cursor: 'pointer' }} onClick={() => setSearchOpen(true)}>
              <Search size={15} />
              <input placeholder="Search menu, pages..." readOnly style={{ cursor: 'pointer' }} />
              <span className="header-kbd">CTRL+K</span>
            </div>
          </div>
          <div className="header-right">
            {/* Academic Year Switcher Dropdown */}
            <div className="ay-switcher-wrap" ref={ayDropdownRef} style={{ position: 'relative' }}>
              <div
                className="session-pill"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                onClick={() => { setAyDropdownOpen(prev => !prev); if (!ayDropdownOpen) loadAcademicYears(); }}
                title="Switch Academic Session"
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }}></span>
                <span>{activeSessionName ? `${activeSessionName} ACADEMIC SESSION` : 'ACADEMIC SESSION'}</span>
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
                        const isActive = ay.id === authoritativeActiveYearId;
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
            {/* Connected Review Notifications Bell & Popover (Teacher Leaves) */}
            <div className="super-notif-wrap" ref={adminNotifRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="header-icon-btn"
                title="Review Approval Requests"
                onClick={() => { setAdminNotifOpen(prev => !prev); if (!adminNotifOpen) loadAdminNotifications(); }}
                style={{ position: 'relative' }}
              >
                <Bell size={16} />
                {(pendingLeaveCount + (schoolInfo?.pendingCorrectionsCount || 0) > 0) && (
                  <span className="header-badge-num" style={{ background: '#ef4444' }}>
                    {pendingLeaveCount + (schoolInfo?.pendingCorrectionsCount || 0)}
                  </span>
                )}
              </button>

              {adminNotifOpen && (
                <div className="super-notif-dropdown">
                  <div className="super-notif-header">
                    <div className="super-notif-title-row">
                      <h4 className="super-notif-title">Notifications</h4>
                      {pendingLeaveCount > 0 && (
                        <span className="super-notif-count-pill">
                          {pendingLeaveCount} pending
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="super-notif-readall-btn"
                        title="Review Teacher Leave Requests"
                        style={{ color: '#d97706', background: '#fffbeb', borderColor: '#fde68a' }}
                        onClick={() => { setAdminNotifOpen(false); nav('/teacher-leave-approvals'); }}
                      >
                        <CalendarCheck size={12} />
                        <span>Teacher Leaves</span>
                      </button>
                    </div>
                  </div>

                  <div className="super-notif-list">
                    {adminNotifs.filter((n: any) => n.type === 'TEACHER_LEAVE_REQUEST').length === 0 ? (
                      <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                          <CheckCircle2 size={24} />
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>All Caught Up!</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>No pending teacher leave requests.</div>
                      </div>
                    ) : (
                      adminNotifs.filter((n: any) => n.type === 'TEACHER_LEAVE_REQUEST').map((n: any) => (
                        <div
                          key={n.id}
                          className="super-notif-item unread"
                          onClick={() => {
                            setAdminNotifOpen(false);
                            nav(n.link || '/teacher-leave-approvals');
                          }}
                        >
                          <div className="super-notif-icon-wrap notif-leave" style={{ background: '#fef3c7', color: '#d97706', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <CalendarCheck size={18} />
                          </div>

                          <div className="super-notif-body">
                            <div className="super-notif-item-title">
                              <span className="super-notif-item-title-text">{n.title}</span>
                              <span className="super-notif-time">
                                {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="super-notif-msg">{n.message}</p>
                            <span className="super-notif-action-tag">
                              Review Faculty Leave →
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="super-notif-footer">
                    <button
                      type="button"
                      className="super-notif-footer-link"
                      onClick={() => { setAdminNotifOpen(false); nav('/teacher-leave-approvals'); }}
                    >
                      <CalendarCheck size={13} />
                      <span>Teacher's Leaves</span>
                    </button>
                    {user?.role !== 'SCHOOL_ADMIN' && (
                      <button
                        type="button"
                        className="super-notif-footer-link"
                        onClick={() => { setAdminNotifOpen(false); nav('/notifications'); }}
                      >
                        <span>All Alerts →</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="header-icon-btn" onClick={toggle} title={dark ? 'Light mode' : 'Dark mode'}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="profile-pill" style={{ cursor: 'pointer' }} onClick={() => nav('/school-profile')}>
              <div className="user-avatar" style={{ background: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: 13, overflow: 'hidden' }}>
                {user.photo_url || user.photoUrl || user.avatarUrl ? (
                  <img
                    src={user.photo_url || user.photoUrl || user.avatarUrl}
                    alt={user.name || 'Admin'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  user.name ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'SA'
                )}
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
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              type="button"
              className="header-icon-btn mobile-menu-btn mobile-only-menu-btn"
              onClick={() => setMobileSidebarOpen(prev => !prev)}
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <Menu size={18} />
            </button>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, cursor: currentSchoolWebsite ? 'pointer' : 'default' }}
              onClick={handleOpenSchoolWebsite}
              title={currentSchoolWebsite ? `Visit Official School Website: ${currentSchoolWebsite}` : currentSchoolName}
            >
              <div
                className="school-crest"
                style={{ width: 34, height: 34, background: "#ffffff", border: "1px solid var(--border)", padding: 2, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}
              >
                <img
                  src={currentSchoolPhoto || (isDavSchool ? '/dav-logo.png' : '/attendo-school-logo.png')}
                  alt={currentSchoolName}
                  onError={(e) => {
                    const target = e.currentTarget;
                    const fallback = isDavSchool ? '/dav-logo.png' : '/attendo-school-logo.png';
                    if (target.src !== fallback && !target.src.endsWith(fallback)) {
                      target.src = fallback;
                    }
                  }}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {currentSchoolName}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.name} · {user.role === "TEACHER" ? "Faculty" : user.role.replace(/_/g, " ")}
                </div>
              </div>
            </div>
          </div>
          <div className="header-search" onClick={() => setSearchOpen(true)} style={{ width: 380, maxWidth: 440, cursor: 'pointer' }}>
            <Search size={15} />
            <input placeholder="Search menu, pages..." readOnly style={{ cursor: 'pointer' }} />
            <span className="header-kbd">CTRL+K</span>
          </div>
          <div className="header-right">
            {/* Connected Academic Session Selector Dropdown */}
            <div className="ay-switcher-wrap" ref={ayDropdownRef} style={{ position: 'relative' }}>
              <div
                className="session-pill"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                onClick={() => { setAyDropdownOpen(prev => !prev); if (!ayDropdownOpen) loadAcademicYears(); }}
                title="Switch Academic Session"
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }}></span>
                <span>{activeSessionName ? `${activeSessionName} ACADEMIC SESSION` : 'ACADEMIC SESSION'}</span>
                <ChevronDown size={14} style={{ opacity: 0.7, transform: ayDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
              {ayDropdownOpen && (
                <div className="ay-dropdown">
                  <div className="ay-dropdown-header">
                    <span>Academic Sessions</span>
                    {(user as any).role === 'SCHOOL_ADMIN' && (
                      <button className="ay-manage-btn" onClick={() => { setAyDropdownOpen(false); nav('/academic-years'); }}>Manage</button>
                    )}
                  </div>
                  {ayLoading ? (
                    <div className="ay-dropdown-loading"><RefreshCw size={14} className="spin" /> Loading sessions...</div>
                  ) : academicYears.length === 0 ? (
                    <div className="ay-dropdown-empty">No academic sessions found in database.</div>
                  ) : (
                    <div className="ay-dropdown-list">
                      {academicYears.map((ay: any) => {
                        const isActive = ay.id === authoritativeActiveYearId;
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
            {user.role === 'TEACHER' ? (
              <div className="super-notif-wrap" ref={teacherNotifRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="header-icon-btn"
                  title="Student Reviews & Photo Approvals"
                  onClick={() => { setTeacherNotifOpen(prev => !prev); if (!teacherNotifOpen) loadAdminNotifications(); }}
                  style={{ position: 'relative' }}
                >
                  <Bell size={16} />
                  {(pendingLeaveCount + pendingPhotoCount) > 0 && (
                    <span className="header-badge-num" style={{ background: '#ef4444' }}>
                      {pendingLeaveCount + pendingPhotoCount}
                    </span>
                  )}
                </button>

                {teacherNotifOpen && (
                  <div className="super-notif-dropdown">
                    <div className="super-notif-header">
                      <div className="super-notif-title-row">
                        <h4 className="super-notif-title">Notifications</h4>
                        {(pendingLeaveCount + pendingPhotoCount) > 0 && (
                          <span className="super-notif-count-pill">
                            {pendingLeaveCount + pendingPhotoCount} pending
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {pendingPhotoCount > 0 && (
                          <button
                            type="button"
                            className="super-notif-readall-btn"
                            style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.25)', cursor: 'pointer' }}
                            title="Review Student Photos"
                            onClick={() => { setTeacherNotifOpen(false); nav('/photo-approvals'); }}
                          >
                            <Camera size={12} />
                            <span>Photos ({pendingPhotoCount})</span>
                          </button>
                        )}
                        {pendingLeaveCount > 0 && (
                          <button
                            type="button"
                            className="super-notif-readall-btn"
                            style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.25)', cursor: 'pointer' }}
                            title="Mark all pending leave requests as seen"
                            onClick={async () => {
                              try {
                                await api.put('/reviews/leaves/mark-all-seen');
                                setPendingLeaveCount(0);
                                setAdminNotifs(prev => prev.filter((n: any) => n.type !== 'LEAVE_REQUEST'));
                                window.dispatchEvent(new CustomEvent('reviews-updated'));
                              } catch { }
                            }}
                          >
                            <Check size={12} />
                            <span>Mark all seen</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="super-notif-readall-btn"
                          style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.25)', cursor: 'pointer' }}
                          title="Review Leave Requests"
                          onClick={() => { setTeacherNotifOpen(false); nav('/leave-applications'); }}
                        >
                          <CalendarCheck size={12} />
                          <span>Leaves{pendingLeaveCount > 0 ? ` (${pendingLeaveCount})` : ''}</span>
                        </button>
                      </div>
                    </div>

                    <div className="super-notif-list">
                      {adminNotifs.filter((n: any) => n.type === 'LEAVE_REQUEST' || n.type === 'PHOTO_APPROVAL').length === 0 ? (
                        <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                            <CheckCircle2 size={24} />
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>All Caught Up!</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>No pending student leaves or photo approvals for your class.</div>
                        </div>
                      ) : (
                        adminNotifs.filter((n: any) => n.type === 'LEAVE_REQUEST' || n.type === 'PHOTO_APPROVAL').map((n: any) => (
                          <div
                            key={n.id}
                            className="super-notif-item unread"
                            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', cursor: 'pointer' }}
                            onClick={async () => {
                              setTeacherNotifOpen(false);
                              if (n.type === 'PHOTO_APPROVAL') {
                                nav('/photo-approvals');
                              } else {
                                if (n.rawId) {
                                  api.put(`/reviews/leaves/${n.rawId}/seen`).catch(() => { });
                                  setAdminNotifs(prev => prev.filter(x => x.id !== n.id));
                                  setPendingLeaveCount(p => Math.max(0, p - 1));
                                  window.dispatchEvent(new CustomEvent('reviews-updated'));
                                }
                                nav('/leave-applications');
                              }
                            }}
                          >
                            <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
                              {n.type === 'PHOTO_APPROVAL' ? (
                                n.avatar ? (
                                  <img
                                    src={n.avatar}
                                    alt={n.applicantName || 'Student'}
                                    style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                                  />
                                ) : (
                                  <div className="super-notif-icon-wrap notif-photo" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', flexShrink: 0 }}>
                                    <Camera size={18} />
                                  </div>
                                )
                              ) : (
                                <div className="super-notif-icon-wrap notif-leave">
                                  <Calendar size={17} />
                                </div>
                              )}

                              <div className="super-notif-body">
                                <div className="super-notif-item-title">
                                  <span className="super-notif-item-title-text">{n.title}</span>
                                  <span className="super-notif-time">
                                    {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </span>
                                </div>
                                <p className="super-notif-msg">{n.message}</p>
                                <span className="super-notif-action-tag">
                                  {n.type === 'PHOTO_APPROVAL' ? 'Review Photo →' : 'Review & Verify →'}
                                </span>
                              </div>
                            </div>

                            {n.type === 'LEAVE_REQUEST' && (
                              <button
                                type="button"
                                title="Mark as Seen"
                                style={{
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  color: '#10b981',
                                  borderRadius: 6,
                                  padding: '4px 7px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  cursor: 'pointer',
                                  marginLeft: 8,
                                  flexShrink: 0
                                }}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (n.rawId) {
                                    try {
                                      await api.put(`/reviews/leaves/${n.rawId}/seen`);
                                      setAdminNotifs(prev => prev.filter(x => x.id !== n.id));
                                      setPendingLeaveCount(p => Math.max(0, p - 1));
                                      window.dispatchEvent(new CustomEvent('reviews-updated'));
                                    } catch { }
                                  }
                                }}
                              >
                                <Check size={12} />
                                <span>Seen</span>
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="super-notif-footer">
                      <button
                        type="button"
                        className="super-notif-footer-link"
                        onClick={() => { setTeacherNotifOpen(false); nav('/leave-applications'); }}
                      >
                        <CalendarCheck size={13} />
                        <span>Leave Applications</span>
                      </button>
                      <button
                        type="button"
                        className="super-notif-footer-link"
                        onClick={() => { setTeacherNotifOpen(false); nav('/photo-approvals'); }}
                      >
                        <Camera size={13} />
                        <span>Photo Approvals</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="header-icon-btn"
                title="Notifications"
                style={{ position: 'relative' }}
                onClick={() => nav('/notifications')}
              >
                <Bell size={16} />
              </button>
            )}
            <button className="header-icon-btn" onClick={toggle} title={dark ? 'Light mode' : 'Dark mode'}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="profile-pill" style={{ cursor: 'pointer' }} onClick={() => nav('/teacher/profile')} title="View My Profile">
              <div className="user-avatar" style={{ background: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: 13, overflow: 'hidden', position: 'relative' }}>
                <span style={{ position: 'absolute' }}>
                  {user.name ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'TC'}
                </span>
                {user?.avatarUrl && (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div className="profile-info">
                <span className="profile-name">{user.name}</span>
                <span className="profile-role">{user.role === 'TEACHER' ? 'Teacher' : (user.role ? user.role.replace(/_/g, ' ') : user.email)}</span>
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
      )}
      {/* ── Faculty In-App Inbox Drawer (Teacher Portal) ── */}
      {teacherDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1200
          }}
          onClick={() => setTeacherDrawerOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              backgroundColor: 'var(--surface, #ffffff)',
              height: '100%',
              overflowY: 'auto',
              padding: '24px 20px',
              boxSizing: 'border-box',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid var(--border, #e2e8f0)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={18} color="#2563eb" />
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text, #0f172a)' }}>Faculty In-App Inbox</h2>
                {teacherUnreadCount > 0 && (
                  <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>
                    {teacherUnreadCount} unread
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTeacherDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)', padding: 4 }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--text-muted, #64748b)' }}>
              Official administrative notices and academic broadcasts strictly visible to faculty accounts.
            </p>

            {teacherLoadingNotices ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>Loading faculty inbox...</div>
            ) : teacherNotices.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', border: '1px dashed var(--border, #cbd5e1)', borderRadius: 8, color: 'var(--text-muted, #94a3b8)' }}>
                No notifications in your faculty inbox.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14, overflowY: 'auto' }}>
                {teacherNotices.map((n: any) => (
                  <div
                    key={n.id || n.recipient_id}
                    style={{
                      border: n.priority === 'EMERGENCY' ? '1.5px solid #ef4444' : '1px solid var(--border, #e2e8f0)',
                      borderRadius: 8,
                      padding: 14,
                      backgroundColor: n.read_at ? 'var(--card-subtle, #f8fafc)' : 'var(--bg-card, #ffffff)',
                      boxShadow: n.read_at ? 'none' : '0 1px 4px rgba(0,0,0,0.06)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: n.priority === 'EMERGENCY' ? 'rgba(239, 68, 68, 0.15)' : n.priority === 'HIGH' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: n.priority === 'EMERGENCY' ? '#ef4444' : n.priority === 'HIGH' ? '#f97316' : '#3b82f6',
                          border: n.priority === 'EMERGENCY' ? '1px solid rgba(239, 68, 68, 0.3)' : n.priority === 'HIGH' ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                        }}
                      >
                        {n.priority}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
                        {n.published_at ? new Date(n.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px', fontSize: 14.5, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                      {n.title}
                    </h4>

                    <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {n.message}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border, #f1f5f9)', paddingTop: 8 }}>
                      {n.author_name ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>From: {n.author_name}</span>
                      ) : <span />}

                      {!n.read_at ? (
                        <button
                          type="button"
                          onClick={() => markTeacherNoticeRead(n.recipient_id, n.id)}
                          style={{
                            padding: '3px 8px',
                            fontSize: 11.5,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: '1px solid var(--border, #cbd5e1)',
                            backgroundColor: 'transparent',
                            color: 'var(--primary, #2563eb)',
                            cursor: 'pointer'
                          }}
                        >
                          Mark as read
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✓ Read</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Global Search Command Palette (Menu & Page Navigation Only) ── */}
      {searchOpen && (
        <div className="search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-palette" onClick={(e) => e.stopPropagation()}>
            <div className="search-palette-header">
              <Search size={18} color="var(--text-muted)" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search menus, pages, modules... (e.g. Attendance, Timetable, Promotion)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handlePaletteKeyDown}
                className="search-palette-input"
              />
              <kbd className="search-palette-esc" onClick={() => setSearchOpen(false)} style={{ cursor: 'pointer' }}>ESC</kbd>
            </div>

            <div className="search-palette-body">
              {!searchQuery.trim() ? (
                <div className="search-palette-hint" style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <Search size={32} color="var(--primary, #2563eb)" style={{ opacity: 0.6, margin: '0 auto 12px', display: 'block' }} />
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
                    Type to search menu &amp; pages
                  </h4>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, maxWidth: 420, marginInline: 'auto' }}>
                    Type any page name or section (e.g. <strong>Leave</strong>, <strong>Attendance</strong>, <strong>Timetable</strong>, <strong>Promotion</strong>, <strong>Routine</strong>) to view suggestions.
                  </p>
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="search-palette-empty">
                  <Search size={28} color="var(--text-muted)" />
                  <p>No menu found for "<strong>{searchQuery}</strong>"</p>
                  <span>This search bar is only for navigation menu pages.</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    Student and teacher name search is not allowed in this search bar.
                  </span>
                </div>
              ) : (
                groupedMenuResults.map(([category, items]) => (
                  <div key={category} className="search-result-group">
                    <div className="search-result-label">
                      {category} ({items.length})
                    </div>
                    {items.map((item) => {
                      const isSelected = item.path === filteredMenuItems[selectedIndex]?.path;
                      const ItemIcon = item.icon || Layers;
                      return (
                        <div
                          key={item.path + item.label}
                          className={`search-result-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setSearchOpen(false);
                            nav(item.path);
                          }}
                          onMouseEnter={() => {
                            const idx = filteredMenuItems.findIndex(m => m.path === item.path);
                            if (idx !== -1) setSelectedIndex(idx);
                          }}
                        >
                          <div className="search-result-avatar" style={{ background: 'var(--primary, #2563eb)', color: '#fff' }}>
                            <ItemIcon size={16} />
                          </div>
                          <div className="search-result-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="search-result-name">{item.label}</span>
                              <span style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: 'var(--bg-muted, #f1f5f9)',
                                color: 'var(--text-muted, #64748b)',
                                border: '1px solid var(--border)'
                              }}>
                                {item.category}
                              </span>
                            </div>
                            <span className="search-result-meta">{item.description}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.85 }}>{item.path}</span>
                            <ArrowRight size={14} color="var(--text-muted)" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="search-palette-footer">
              <span><kbd>↑↓</kbd> Navigate</span>
              <span><kbd>↵</kbd> Open Menu</span>
              <span><kbd>ESC</kbd> Close</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                Menu &amp; Navigation Only
              </span>
            </div>
          </div>
        </div>
      )}
      {children}
    </main>
  </div>
}

/* ────── Shared Components ────── */
function Stat({ label, value, trend, sub }: { label: string; value: any; trend?: string; sub?: string }) {
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
function PageHead({ title, sub, button, onClick, schoolName: customSchoolName }: { title: string; sub: string; button?: string; onClick?: () => void; schoolName?: string }) {
  const { user } = useAuth();
  const isSchoolAdmin = user?.role === 'SCHOOL_ADMIN';
  const isTeacher = user?.role === 'TEACHER';
  const resolvedSchoolName = customSchoolName || user?.schoolName || (isTeacher ? 'School' : 'School Administration');
  const eyebrowText = isSchoolAdmin
    ? `${resolvedSchoolName.toUpperCase()} ADMIN`
    : isTeacher
      ? `${resolvedSchoolName.toUpperCase()} FACULTY`
      : (title.includes('Admin') ? 'ATTENDOSCHOOL SUPER ADMIN' : 'ATTENDOSCHOOL ADMIN');
  const logoAlt = (isSchoolAdmin || isTeacher) ? resolvedSchoolName : 'AttendoSchool';

  return <div className="page-head">
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src="/attendo-school-logo.png" alt={logoAlt} style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'contain' }} />
        <p className="eyebrow" style={{ margin: 0 }}>{eyebrowText}</p>
      </div>
      <h1>{title}</h1>
      <p className="muted">{sub}</p>
    </div>
    {button && <button onClick={onClick}><Plus size={16} />{button}</button>}
  </div>;
}
function Modal({
  title,
  close,
  children,
  size,
  fullWindow = false,
  maxWidth,
  style,
  bodyStyle
}: {
  title: string;
  close: () => void;
  children: React.ReactNode | ((props: { isFull: boolean }) => React.ReactNode);
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  fullWindow?: boolean;
  maxWidth?: string | number;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}) {
  const [isFull, setIsFull] = useState<boolean>(fullWindow || size === 'full');

  return (
    <div className="overlay" style={isFull ? { padding: 12 } : undefined}>
      <div
        className={`modal ${isFull ? 'modal-fullwindow' : ''}`}
        style={{
          ...(!isFull && maxWidth ? { width: maxWidth, maxWidth } : {}),
          ...(!isFull && size === 'xl' ? { width: 'min(1200px, 95vw)', maxWidth: '95vw' } : {}),
          ...(!isFull && size === 'lg' ? { width: 'min(900px, 95vw)', maxWidth: '95vw' } : {}),
          ...style
        }}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="modal-toggle-btn"
              onClick={() => setIsFull(!isFull)}
              title={isFull ? "Restore standard size" : "Maximize to full window"}
            >
              {isFull ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button className="close" onClick={close}>×</button>
          </div>
        </div>
        <div
          className={isFull ? "modal-body-full" : undefined}
          style={{
            flex: isFull ? 1 : undefined,
            display: isFull ? 'flex' : undefined,
            flexDirection: isFull ? 'column' : undefined,
            minHeight: 0,
            overflowY: isFull ? 'auto' : undefined,
            ...bodyStyle
          }}
        >
          {typeof children === 'function' ? (children as (props: { isFull: boolean }) => React.ReactNode)({ isFull }) : children}
        </div>
      </div>
    </div>
  );
}

/* ────── Dashboard ────── */
function Dashboard() { const { user } = useAuth(); if (!user) return null; if (user.role === 'STUDENT') return <Navigate to="/student/dashboard" replace />; return user.role === 'SUPER_ADMIN' ? <SuperAdminHome /> : user.role === 'TEACHER' ? <TeacherHome /> : <AdminHome /> }

function AdminHome() {
  const { user } = useAuth();
  const nav = useNavigate();

  const getSessionStorageKey = () => {
    try {
      return localStorage.getItem('attendo_academic_session') || localStorage.getItem('attendo_active_academic_year') || 'default';
    } catch {
      return 'default';
    }
  };

  const getCacheKey = (sessionKey?: string) => {
    const sid = (user as any)?.schoolId || 'current';
    const s = sessionKey || getSessionStorageKey();
    return `dashboard_cache_${sid}_${s}`;
  };

  const [currentSessionName, setCurrentSessionName] = useState<string>(() => {
    try {
      return localStorage.getItem('attendo_academic_session') || localStorage.getItem('attendo_active_academic_year') || '';
    } catch {
      return '';
    }
  });

  const [data, setData] = useState<any>(() => {
    try {
      const c = typeof window !== 'undefined' ? localStorage.getItem(getCacheKey()) : null;
      return c ? JSON.parse(c) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!data);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Branded Welcome Loader state - displayed only once per session per school admin
  const welcomeSessionKey = user?.id ? `attendo_welcome_seen_${user.id}` : null;
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    if (!user || user.role !== 'SCHOOL_ADMIN') return false;
    if (typeof window === 'undefined') return false;
    try {
      return !sessionStorage.getItem(`attendo_welcome_seen_${user.id}`);
    } catch {
      return false;
    }
  });

  const handleWelcomeComplete = useCallback(() => {
    if (welcomeSessionKey) {
      try {
        sessionStorage.setItem(welcomeSessionKey, 'true');
      } catch { }
    }
    setShowWelcome(false);
  }, [welcomeSessionKey]);

  async function load(retryCount = 0, specificYearId?: string, specificSession?: string) {
    const yearId = specificYearId !== undefined ? specificYearId : localStorage.getItem('attendo_active_academic_year_id');
    const session = specificSession !== undefined ? specificSession : (localStorage.getItem('attendo_academic_session') || localStorage.getItem('attendo_active_academic_year'));
    const cacheKey = getCacheKey(session || undefined);

    if (session) {
      setCurrentSessionName(session);
    }

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached));
      } else {
        setLoading(true);
      }
    } catch { }

    setDashboardError(null);
    try {
      const params: any = {};
      if (yearId) params.academicYearId = yearId;
      if (session) params.session = session;
      const res = await api.get('/dashboard/school', { params });
      if (res.data) {
        setData(res.data);
        if (res.data.activeAcademicYear?.name) {
          setCurrentSessionName(res.data.activeAcademicYear.name);
        }
        try {
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch { }
      }
    } catch (e: any) {
      console.error('Failed to load school dashboard', e);
      if (retryCount < 2) {
        setTimeout(() => load(retryCount + 1, yearId || undefined, session || undefined), 1500);
        return;
      }
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached && !data) {
          setData(JSON.parse(cached));
        }
      } catch { }
      setDashboardError(e?.response?.data?.message || 'Database connection is synchronizing. Please click Retry Connection.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    const handleSessionChange = (e: any) => {
      const targetObj = typeof e?.detail === 'object' ? e.detail : null;
      const newSessionName = targetObj?.name || (typeof e?.detail === 'string' ? e.detail : '') || localStorage.getItem('attendo_academic_session') || '';
      const newYearId = targetObj?.id || localStorage.getItem('attendo_active_academic_year_id') || undefined;
      if (newSessionName) setCurrentSessionName(newSessionName);
      load(0, newYearId, newSessionName);
    };

    const handleStorage = () => {
      const s = localStorage.getItem('attendo_academic_session') || localStorage.getItem('attendo_active_academic_year') || '';
      const y = localStorage.getItem('attendo_active_academic_year_id') || undefined;
      if (s) setCurrentSessionName(s);
      load(0, y, s);
    };

    const handleDashboardRefresh = () => {
      load();
    };

    window.addEventListener('sessionChanged', handleSessionChange);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('dashboardShouldRefresh', handleDashboardRefresh);
    return () => {
      window.removeEventListener('sessionChanged', handleSessionChange);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('dashboardShouldRefresh', handleDashboardRefresh);
    };
  }, []);

  const school = data?.school;
  const todayAtt = data?.todayAttendance || { total: 0, present: 0, absent: 0, leftEarly: 0, percentage: 0, classBreakdown: [] };
  const sub = data?.subscription;
  const pendingCorrections = data?.pendingCorrectionsCount || 0;
  const weeklyTrend = Array.isArray(data?.weeklyTrend) ? data.weeklyTrend : [];
  const weeklyAvg = weeklyTrend.length > 0
    ? Number((weeklyTrend.reduce((acc: number, t: any) => acc + (Number(t.percentage) || 0), 0) / weeklyTrend.length).toFixed(1))
    : 0;
  const todaySchedule = data?.todaySchedule || [];
  const recentActivity = data?.recentActivity || [];

  const resolvedSchoolName = data?.school?.name || (user as any)?.schoolName || 'School Administration';
  const resolvedLogoUrl = (user as any)?.photo_url || (user as any)?.photoUrl || data?.school?.photo_url || '';

  return (
    <>
      {showWelcome && (
        <BrandedWelcomeLoader
          schoolName={resolvedSchoolName}
          logoUrl={resolvedLogoUrl}
          onComplete={handleWelcomeComplete}
        />
      )}
      <Layout>
        {/* Dashboard Error / Quota Notice */}
        {dashboardError && (
          <div className="admin-alert-banner warning" style={{ marginBottom: 16, backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
            <div className="alert-left">
              <AlertTriangle size={20} color="#dc2626" />
              <div>
                <strong>Unable to Connect to Live Database</strong>
                <p style={{ margin: 0, fontSize: 13 }}>{dashboardError}</p>
              </div>
            </div>
            <button className="alert-action-btn" onClick={() => load(0)} style={{ backgroundColor: '#dc2626', color: '#ffffff' }}>
              Retry Connection
            </button>
          </div>
        )}

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
              <span>🏛️ School Code: <b>{school?.code || (user as any)?.schoolCode || '—'}</b></span>
              <span>📅 Session: <b>{data?.activeAcademicYear?.name || currentSessionName || 'Current Session'}</b></span>
              <span>📞 Enquiry: <b>{school?.enquiry_number || school?.phone || '—'}</b></span>
              <span>🛡️ Plan: <b>{sub?.plan_name || 'Standard'}</b></span>
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

        {/* Top KPI Cards */}
        <div className="dashboard-kpi-grid">
          <div className="kpi-card" onClick={() => nav('/students')}>
            <div className="kpi-icon-wrap blue"><Users size={22} /></div>
            <div className="kpi-body">
              <span className="kpi-label">Enrolled Students</span>
              <strong className="kpi-value">{loading ? '...' : (data?.totalStudents ?? 0)}</strong>
              <span className="kpi-sub positive">Active registered records</span>
            </div>
          </div>

          {/* Student Gender Split - Session Dependent */}
          <div className="kpi-card" onClick={() => nav('/students')} title="Click to view student directory">
            <div className="kpi-icon-wrap blue" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
              <Users size={22} />
            </div>
            <div className="kpi-body" style={{ width: '100%' }}>
              <span className="kpi-label">Students (M / F)</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, color: '#0284c7' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>Male:</span>
                  <strong style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text, #0f172a)' }}>{loading ? '...' : (data?.studentMaleCount ?? 0)}</strong>
                </span>
                <span style={{ color: 'var(--border, #cbd5e1)', fontWeight: 300, fontSize: 13 }}>|</span>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, color: '#db2777' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>Female:</span>
                  <strong style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text, #0f172a)' }}>{loading ? '...' : (data?.studentFemaleCount ?? 0)}</strong>
                </span>
              </div>
              <span className="kpi-sub neutral" style={{ marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
                📅 Session: <b>{data?.activeAcademicYear?.name || currentSessionName || 'Active'}</b>
              </span>
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

          {/* Teacher Gender Split - Session Independent */}
          <div className="kpi-card" onClick={() => nav('/teachers')} title="Click to view faculty directory">
            <div className="kpi-icon-wrap indigo" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
              <GraduationCap size={22} />
            </div>
            <div className="kpi-body" style={{ width: '100%' }}>
              <span className="kpi-label">Faculty (M / F)</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, color: '#0284c7' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>Male:</span>
                  <strong style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text, #0f172a)' }}>{loading ? '...' : (data?.teacherMaleCount ?? 0)}</strong>
                </span>
                <span style={{ color: 'var(--border, #cbd5e1)', fontWeight: 300, fontSize: 13 }}>|</span>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, color: '#db2777' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>Female:</span>
                  <strong style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text, #0f172a)' }}>{loading ? '...' : (data?.teacherFemaleCount ?? 0)}</strong>
                </span>
              </div>
              <span className="kpi-sub neutral" style={{ marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
                🏫 School-wide faculty
              </span>
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
              <span className="kpi-sub neutral">{todayAtt.present} Present · {todayAtt.absent} Absent{(todayAtt.leftEarly || todayAtt.left_early) ? ` · ${todayAtt.leftEarly || todayAtt.left_early} Left Early` : ''}</span>
            </div>
          </div>

          {/* Temporarily commented out Attendance Corrections KPI card as requested
      <div className="kpi-card" onClick={() => nav('/attendance-corrections')}>
        <div className={`kpi-icon-wrap ${pendingCorrections > 0 ? 'amber' : 'slate'}`}><ArrowUpDown size={22} /></div>
        <div className="kpi-body">
          <span className="kpi-label">Pending Corrections</span>
          <strong className="kpi-value">{loading ? '...' : pendingCorrections}</strong>
          <span className={`kpi-sub ${pendingCorrections > 0 ? 'negative' : 'positive'}`}>
            {pendingCorrections > 0 ? 'Requires attention' : 'All clear'}
          </span>
        </div>
      </div> */}

          {/* Subscription Tier card removed as requested
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
      </div> */}
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
                    <span className="metric-label">Left Early</span>
                    <span className="metric-num amber" style={{ color: '#d97706' }}>{todayAtt.leftEarly ?? todayAtt.left_early ?? 0}</span>
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
                            <span>{cb.present}/{cb.total} Present{(cb.left_early || cb.leftEarly) ? `, ${cb.left_early || cb.leftEarly} Left Early` : ''}</span>
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

              {/* Temporarily commented out Attendance Corrections Quick Action as requested
          <button className="quick-action-tile" onClick={() => nav('/attendance-corrections')}>
            <div className="tile-icon orange"><CheckCircle2 size={18} /></div>
            <div className="tile-texts">
              <strong>Review Corrections</strong>
              <span>Approve or reject faculty requests</span>
            </div>
          </button> */}

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

            {weeklyTrend.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <CalendarDays size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 13.5 }}>No weekly attendance data recorded yet.</p>
                <span style={{ fontSize: 12 }}>Daily attendance sessions submitted this week will chart here automatically.</span>
              </div>
            ) : (
              <>
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
                        {t.day} {t.isToday ? <span style={{ display: 'block', fontSize: 9.5, lineHeight: 1.1 }}>(Today)</span> : null}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap', gap: 6 }}>
                  <span>Institutional Target: <b>90% Minimum</b></span>
                  <span style={{ color: weeklyAvg >= 90 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>Weekly Average: ~{weeklyAvg}%</span>
                </div>
              </>
            )}
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
    </>
  );
}

function TeacherHome() {
  const { user } = useAuth();
  const nav = useNavigate();

  // Branded Welcome Loader state - displayed only once per session per teacher
  const welcomeSessionKey = user?.id ? `attendo_welcome_seen_${user.id}` : null;
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    if (!user || user.role !== 'TEACHER') return false;
    if (typeof window === 'undefined') return false;
    try {
      return !sessionStorage.getItem(`attendo_welcome_seen_${user.id}`);
    } catch {
      return false;
    }
  });

  const handleWelcomeComplete = useCallback(() => {
    if (welcomeSessionKey) {
      try {
        sessionStorage.setItem(welcomeSessionKey, 'true');
      } catch { }
    }
    setShowWelcome(false);
  }, [welcomeSessionKey]);

  const [r, setR] = useState<any[]>([]);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const [authorizedSections, setAuthorizedSections] = useState<any[]>([]);
  const [schoolDate, setSchoolDate] = useState<string>('');

  // 1-second interval timer for live digital clock widget with cleanup on unmount
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadSchedule(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const [routineRes, historyRes, noticesRes, authSecRes] = await Promise.all([
        api.get('/teacher/routine/today').catch(() => ({ data: [] })),
        api.get('/teacher/attendance/history').catch(() => ({ data: [] })),
        api.get('/communication/teacher/inbox').catch(() => ({ data: [] })),
        api.get('/teacher/attendance/authorized-sections').catch(() => ({ data: { sections: [], schoolDate: '' } }))
      ]);

      const secData = Array.isArray(authSecRes.data?.sections) ? authSecRes.data.sections : [];
      setAuthorizedSections(secData);
      setSchoolDate(authSecRes.data?.schoolDate || new Date().toISOString().slice(0, 10));

      const routineData = Array.isArray(routineRes.data) ? routineRes.data : [];
      setR(routineData);

      const todayStr = new Date().toISOString().slice(0, 10);
      const historyList = Array.isArray(historyRes.data) ? historyRes.data : [];
      setTodaySessions(historyList.filter((h: any) => (h.attendance_date || '').slice(0, 10) === todayStr));

      const rawNotices = Array.isArray(noticesRes.data) ? noticesRes.data : [];
      setNotices(rawNotices.filter((n: any) => !n.read_at));

      // Calculate distinct active students across teacher's assigned classes
      if (routineData.length > 0) {
        const uniqueClassSecs = new Map<string, { classId: string; sectionId: string }>();
        routineData.forEach((item: any) => {
          const key = `${item.class_id || item.class_number}_${item.section_id || item.section_name}`;
          if (!uniqueClassSecs.has(key)) {
            uniqueClassSecs.set(key, { classId: item.class_id || item.class_number, sectionId: item.section_id || item.section_name });
          }
        });

        const studentRequests = Array.from(uniqueClassSecs.values()).map(cs =>
          api.get('/teacher/students', { params: { classId: cs.classId, sectionId: cs.sectionId } }).catch(() => ({ data: [] }))
        );

        const studentResponses = await Promise.all(studentRequests);
        const uniqueStudentIds = new Set<string>();
        studentResponses.forEach(res => {
          if (Array.isArray(res.data)) {
            res.data.forEach((st: any) => {
              const stKey = String(st.id || st.admission_number || st.roll_number || st.name);
              if (stKey) uniqueStudentIds.add(stKey);
            });
          }
        });
        setStudentCount(uniqueStudentIds.size);
      } else {
        setStudentCount(0);
      }
    } finally {
      setLoading(false);
    }
  }

  const fetchTodayRoutine = (showSpinner = true) => loadSchedule(showSpinner);

  useEffect(() => {
    loadSchedule(true);
    const onFocus = () => loadSchedule(false);
    const onAnnouncementsUpdated = () => loadSchedule(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('announcements-read', onAnnouncementsUpdated);
    window.addEventListener('storage', onAnnouncementsUpdated);
    window.addEventListener('sessionChanged', onAnnouncementsUpdated);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('announcements-read', onAnnouncementsUpdated);
      window.removeEventListener('storage', onAnnouncementsUpdated);
      window.removeEventListener('sessionChanged', onAnnouncementsUpdated);
    };
  }, []);

  useEffect(() => {
    const loadPhotoCount = () => {
      api.get('/reviews/notifications').then(res => {
        if (res.data?.success) setPendingPhotos(res.data.pendingPhotosCount || 0);
      }).catch(() => { });
    };
    loadPhotoCount();
    window.addEventListener('reviews-updated', loadPhotoCount);
    return () => window.removeEventListener('reviews-updated', loadPhotoCount);
  }, []);

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

  // Helper to determine time-based period status (UPCOMING, IN_PROGRESS, COMPLETED)
  const getPeriodTimeStatus = (item: any): 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' => {
    if (!item.start_time || !item.end_time) return 'UPCOMING';
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();

    const parseTime = (tStr: string) => {
      if (!tStr) return 0;
      const parts = String(tStr).split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    };

    const sMins = parseTime(item.start_time);
    const eMins = parseTime(item.end_time);

    if (curMins >= eMins) return 'COMPLETED';
    if (curMins >= sMins && curMins < eMins) return 'IN_PROGRESS';
    return 'UPCOMING';
  };

  // Helper to get dynamic greeting
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const teacherFirstName = user?.name ? user.name.split(' ')[0] : 'Teacher';

  // Metrics
  const pendingClasses = r.filter(x => !getRoutineAttendance(x));
  const completedClassesCount = r.filter(x => getPeriodTimeStatus(x) === 'COMPLETED' || getRoutineAttendance(x)).length;

  // Next Class Calculation
  const upcomingOrCurrentClasses = r.filter(x => getPeriodTimeStatus(x) !== 'COMPLETED');
  upcomingOrCurrentClasses.sort((a, b) => {
    const parseTime = (tStr: string) => {
      const parts = String(tStr || '00:00').split(':');
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    };
    return parseTime(a.start_time) - parseTime(b.start_time);
  });
  const nextClass = upcomingOrCurrentClasses[0];

  const getNextClassTimerText = (item: any) => {
    if (!item) return 'No upcoming classes';
    const status = getPeriodTimeStatus(item);
    if (status === 'IN_PROGRESS') return 'In progress now';
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    const parts = String(item.start_time || '00:00').split(':');
    const sMins = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    const diff = sMins - curMins;
    if (diff <= 0) return 'Starting now';
    if (diff < 60) return `Next class in ${diff} min`;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `Next class in ${hrs}h ${mins}m`;
  };

  // Weekdays for Today at a Glance
  const todayDate = new Date();
  const currentDayOfWeek = todayDate.getDay(); // 0 = Sun
  const weekDays = [];
  const startOfWeek = new Date(todayDate);
  startOfWeek.setDate(todayDate.getDate() - currentDayOfWeek);

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    weekDays.push({
      dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
      dayNum: d.getDate(),
      isToday: i === currentDayOfWeek
    });
  }

  const formattedTodayDateString = todayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Time ago formatter for updates
  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return 'Recently';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs} hours ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays} days ago`;
  };

  const resolvedSchoolName = (user as any)?.schoolName || 'School';
  const resolvedTeacherName = user?.name || 'Faculty Member';
  const resolvedLogoUrl = (user as any)?.photo_url || (user as any)?.photoUrl || '';

  return (
    <>
      {showWelcome && (
        <BrandedWelcomeLoader
          schoolName={resolvedSchoolName}
          userName={resolvedTeacherName}
          subtitle="Faculty Portal · Secure Session"
          logoUrl={resolvedLogoUrl}
          onComplete={handleWelcomeComplete}
        />
      )}
      <Layout>
        {pendingPhotos > 0 && (
          <div className="admin-alert-banner" style={{ marginBottom: 16, background: "rgba(37, 99, 235, 0.12)", borderColor: "rgba(59, 130, 246, 0.25)", color: "var(--text, #1e40af)" }}>
            <div className="alert-left">
              <Camera size={20} color="#3b82f6" />
              <div>
                <strong style={{ color: "var(--text, #1e3a8a)" }}>Student Profile Photo Submissions Pending Approval</strong>
                <p style={{ color: "var(--text-secondary, #1e40af)", margin: 0, fontSize: 13 }}>
                  There {pendingPhotos === 1 ? "is 1 photo" : `are ${pendingPhotos} photos`} submitted by students waiting for your verification.
                </p>
              </div>
            </div>
            <button className="alert-action-btn" onClick={() => nav("/photo-approvals")} style={{ background: "#2563eb", color: "#ffffff" }}>
              Review Photos ({pendingPhotos}) →
            </button>
          </div>
        )}
        <div className="td-container">

          {/* 1. Welcome Banner */}
          <div className="td-welcome-banner">
            <div className="td-welcome-content">
              <h1 className="td-welcome-title">
                {getGreeting()}, {teacherFirstName}! ☀️
              </h1>
              <p className="td-welcome-subtitle">Here's your teaching overview for today.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div className="td-quote-box">
                  <span>“A great teacher inspires, guides, and creates brighter futures.”</span>
                </div>
                <div className="td-clock-card" title="Current Local Time & Date">
                  <div className="td-clock-time">
                    <Clock size={15} />
                    <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                  </div>
                  <div className="td-clock-date">
                    {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
            <div className="td-welcome-illustration">
              <svg width="220" height="130" viewBox="0 0 220 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="20" width="120" height="85" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" />
                <rect x="18" y="28" width="104" height="69" rx="4" fill="#0f172a" />
                <text x="32" y="52" fill="#38bdf8" fontSize="11" fontWeight="700" fontFamily="sans-serif">Teach</text>
                <text x="44" y="68" fill="#f59e0b" fontSize="11" fontWeight="700" fontFamily="sans-serif">Learn</text>
                <text x="36" y="84" fill="#10b981" fontSize="11" fontWeight="700" fontFamily="sans-serif">Grow</text>

                <path d="M150 95C150 75 165 60 180 60C195 60 210 75 210 95V105H150V95Z" fill="#2563eb" />
                <circle cx="180" cy="45" r="14" fill="#fdba74" />
                <path d="M172 40C172 40 178 34 184 40" stroke="#475569" strokeWidth="2" strokeLinecap="round" />

                <path d="M140 100L155 75L170 100H140Z" fill="#3b82f6" opacity="0.3" />
                <path d="M125 105H215" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                <circle cx="40" cy="12" r="6" fill="#f59e0b" />
                <path d="M190 20L205 12L198 25L190 20Z" fill="#60a5fa" />
              </svg>
            </div>
          </div>

          {/* 2. Four Summary Cards Grid */}
          <div className="td-summary-grid">

            {/* Card 1: Today's Classes */}
            <div
              className="td-summary-card"
              onClick={() => nav('/timetable')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav('/timetable'); } }}
              tabIndex={0}
              role="button"
              aria-label="View today's scheduled classes timetable"
              style={{ cursor: 'pointer' }}
            >
              <div className="td-card-left">
                <div className="td-card-icon blue">
                  <CalendarDays size={22} />
                </div>
                <div>
                  <div className="td-card-label">Today's Classes</div>
                  <div className="td-card-value">{loading ? '...' : r.length}</div>
                  <div className="td-card-sub">Scheduled for today</div>
                </div>
              </div>
              <ChevronRight size={18} className="td-card-arrow" />
            </div>

            {/* Card 2: Attendance Pending */}
            <div
              className="td-summary-card"
              onClick={() => nav('/take-attendance')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav('/take-attendance'); } }}
              tabIndex={0}
              role="button"
              aria-label="Mark pending class attendance"
              style={{ cursor: 'pointer' }}
            >
              <div className="td-card-left">
                <div className="td-card-icon amber">
                  <ClipboardCheck size={22} />
                </div>
                <div>
                  <div className="td-card-label">Attendance Pending</div>
                  <div className="td-card-value">{loading ? '...' : (authorizedSections.length > 0 ? authorizedSections.filter(s => !s.hasSubmitted).length : pendingClasses.length)}</div>
                  <div className="td-card-sub">{authorizedSections.length > 0 ? 'Assigned sections to mark' : 'Classes to mark'}</div>
                </div>
              </div>
              <ChevronRight size={18} className="td-card-arrow" />
            </div>

            {/* Card 3: Classes Completed */}
            <div
              className="td-summary-card"
              onClick={() => nav('/teacher/mentor-workspace?tab=REPORTS')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav('/teacher/mentor-workspace?tab=REPORTS'); } }}
              tabIndex={0}
              role="button"
              aria-label="View completed classes attendance reports"
              style={{ cursor: 'pointer' }}
            >
              <div className="td-card-left">
                <div className="td-card-icon emerald">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <div className="td-card-label">Classes Completed</div>
                  <div className="td-card-value">{loading ? '...' : completedClassesCount}</div>
                  <div className="td-card-sub">Out of {r.length} today</div>
                </div>
              </div>
              <ChevronRight size={18} className="td-card-arrow" />
            </div>

            {/* Card 4: Students in My Classes */}
            <div
              className="td-summary-card"
              onClick={() => nav('/teacher/mentor-workspace?tab=REPORTS')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav('/teacher/mentor-workspace?tab=REPORTS'); } }}
              tabIndex={0}
              role="button"
              aria-label="View student rosters across assigned classes"
              style={{ cursor: 'pointer' }}
            >
              <div className="td-card-left">
                <div className="td-card-icon purple">
                  <Users size={22} />
                </div>
                <div>
                  <div className="td-card-label">Students in My Classes</div>
                  <div className="td-card-value">{loading ? '...' : studentCount}</div>
                  <div className="td-card-sub">Across all assigned classes</div>
                </div>
              </div>
              <ChevronRight size={18} className="td-card-arrow" />
            </div>

          </div>

          {/* Daily Class Teacher Attendance Card */}
          <div className="td-section-card" style={{ marginBottom: 20 }}>
            <div className="td-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
                <h3 className="td-section-title">
                  <ClipboardCheck size={18} style={{ color: '#2563eb' }} />
                  Daily Class Attendance — My Assigned Sections ({authorizedSections.length})
                </h3>
                <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-subtle, #f1f5f9)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={() => fetchTodayRoutine(true)}
                type="button"
                title="Refresh"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
              </button>
            </div>

            {loading ? (
              <p className="muted" style={{ padding: 20, textAlign: 'center' }}>Loading assigned sections...</p>
            ) : authorizedSections.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 10, border: '1px dashed var(--border)' }}>
                <p style={{ margin: '0 0 6px', fontWeight: 600 }}>No class mentor or temporary assignments found</p>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  You are not currently assigned as a permanent mentor or temporary substitute for any section. Class attendance is restricted to assigned class teachers.
                </p>
              </div>
            ) : (
              <div className="td-table-wrap">
                <table className="td-table">
                  <thead>
                    <tr>
                      <th>CLASS & SECTION</th>
                      <th>ASSIGNMENT TYPE</th>
                      <th>ATTENDANCE STATUS</th>
                      <th>SUMMARY</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authorizedSections.map((sec: any) => {
                      const formattedTime = sec.submittedAt
                        ? new Date(sec.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : null;

                      const storedRaw = (typeof window !== 'undefined')
                        ? (
                            sessionStorage.getItem(`finalized_att_${schoolDate}_${sec.classId}_${sec.sectionId}`) ||
                            localStorage.getItem(`finalized_att_${schoolDate}_${sec.classId}_${sec.sectionId}`) ||
                            sessionStorage.getItem(`finalized_att_${sec.classId}_${sec.sectionId}`) ||
                            localStorage.getItem(`finalized_att_${sec.classId}_${sec.sectionId}`) ||
                            sessionStorage.getItem(`finalized_att_${sec.classNumber}_${sec.sectionName}`) ||
                            localStorage.getItem(`finalized_att_${sec.classNumber}_${sec.sectionName}`) ||
                            sessionStorage.getItem(`finalized_attendance_${schoolDate}_${sec.classId}_${sec.sectionId}`) ||
                            localStorage.getItem(`finalized_attendance_${schoolDate}_${sec.classId}_${sec.sectionId}`) ||
                            sessionStorage.getItem(`finalized_attendance_${sec.classId}_${sec.sectionId}`) ||
                            localStorage.getItem(`finalized_attendance_${sec.classId}_${sec.sectionId}`) ||
                            sessionStorage.getItem(`finalized_attendance_${sec.classNumber}_${sec.sectionName}`) ||
                            localStorage.getItem(`finalized_attendance_${sec.classNumber}_${sec.sectionName}`)
                          )
                        : null;

                      let storedFinalized: any = null;
                      if (storedRaw) {
                        try {
                          const parsed = JSON.parse(storedRaw);
                          if (!parsed.date || parsed.date === schoolDate) {
                            storedFinalized = parsed;
                          }
                        } catch {
                          storedFinalized = { finalized: true };
                        }
                      }

                      // Finalized only applies if attendance has already been submitted for today
                      const isFinalized = Boolean(
                        sec.hasSubmitted && (
                          sec.isReattendance ||
                          (sec.reattendanceCount && Number(sec.reattendanceCount) > 0) ||
                          storedFinalized?.finalized ||
                          storedRaw === '1'
                        )
                      );

                      const displayPres = storedFinalized?.presentCount !== undefined ? Number(storedFinalized.presentCount) : Number(sec.presentCount || 0);
                      let displayLeftEarly = storedFinalized?.leftEarlyCount !== undefined ? Number(storedFinalized.leftEarlyCount) : Number(sec.leftEarlyCount || 0);
                      let displayAbs = storedFinalized?.absentCount !== undefined ? Number(storedFinalized.absentCount) : Number(sec.absentCount || 0);

                      // If storedFinalized was saved with older code where leftEarly was lumped into absentCount,
                      // or if sec has leftEarlyCount:
                      if (displayLeftEarly > 0 && storedFinalized?.leftEarlyCount === undefined && displayAbs >= displayLeftEarly) {
                        displayAbs = displayAbs - displayLeftEarly;
                      } else if (sec.leftEarlyCount && Number(sec.leftEarlyCount) > 0 && displayLeftEarly === 0) {
                        displayLeftEarly = Number(sec.leftEarlyCount);
                        if (displayAbs >= displayLeftEarly) {
                          displayAbs = displayAbs - displayLeftEarly;
                        }
                      }

                      // Check fallback flag stored during early departure marking
                      if (displayLeftEarly === 0) {
                        const storedHasLeftEarly = (typeof window !== 'undefined')
                          ? (
                              sessionStorage.getItem(`has_left_early_${sec.classId}_${sec.sectionId}`) ||
                              localStorage.getItem(`has_left_early_${sec.classId}_${sec.sectionId}`) ||
                              sessionStorage.getItem(`has_left_early_${sec.classNumber}_${sec.sectionName}`) ||
                              localStorage.getItem(`has_left_early_${sec.classNumber}_${sec.sectionName}`)
                            )
                          : null;
                        if (storedHasLeftEarly && Number(storedHasLeftEarly) > 0) {
                          const leNum = Number(storedHasLeftEarly);
                          displayLeftEarly = leNum;
                          if (displayAbs >= leNum) {
                            displayAbs = displayAbs - leNum;
                          }
                        }
                      }

                      const displayTot = sec.totalCount ? Number(sec.totalCount) : (displayPres + displayAbs + displayLeftEarly);

                      // Construct summary breakdown parts: e.g. "0P / 1LA" or "2P / 1A / 1LA"
                      const summaryParts: string[] = [`${displayPres}P`];
                      if (displayAbs > 0) {
                        summaryParts.push(`${displayAbs}A`);
                      }
                      if (displayLeftEarly > 0) {
                        summaryParts.push(`${displayLeftEarly}LA`);
                      }
                      if (summaryParts.length === 1 && displayAbs === 0 && displayLeftEarly === 0) {
                        summaryParts.push('0A');
                      }
                      const summaryBreakdown = summaryParts.join(' / ');

                      return (
                        <tr key={`${sec.classId}-${sec.sectionId}`}>
                          <td style={{ fontWeight: 700 }}>
                            Class {sec.classNumber} - Section {sec.sectionName}
                          </td>
                          <td>
                            {sec.isTemporary ? (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', background: '#ffedd5', padding: '3px 8px', borderRadius: 4 }}>
                                Temporary Substitute
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '3px 8px', borderRadius: 4 }}>
                                Class Mentor
                              </span>
                            )}
                          </td>
                          <td>
                            {sec.hasSubmitted ? (
                              <span className="td-status-pill completed" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 12 }}>
                                <CheckCircle2 size={13} /> Completed
                              </span>
                            ) : (
                              <span className="td-status-pill in-progress" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 12 }}>
                                <Clock size={12} /> Pending Submission
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                            {sec.hasSubmitted ? (
                              <span>
                                Submitted at {formattedTime} · <strong style={{ color: 'var(--text)' }}>{summaryBreakdown}</strong> ({displayTot} total)
                                {isFinalized && (
                                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#059669', background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>
                                    Finalized
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span>Not yet marked for today</span>
                            )}
                          </td>
                          <td>
                            {!sec.hasSubmitted ? (
                              <button
                                onClick={() => nav(`/take-attendance?classId=${sec.classId}&sectionId=${sec.sectionId}&date=${schoolDate}`)}
                                className="td-btn-primary"
                                style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                              >
                                <ClipboardCheck size={13} />
                                Take Attendance
                              </button>
                            ) : isFinalized ? (
                              <span
                                style={{
                                  minWidth: 140,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  padding: '7px 14px',
                                  borderRadius: 8,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: '#64748b',
                                  background: 'var(--bg-subtle, #f1f5f9)',
                                  border: '1px solid var(--border, #e2e8f0)',
                                  cursor: 'not-allowed',
                                  userSelect: 'none'
                                }}
                              >
                                <Lock size={13} />
                                Not Editable
                              </span>
                            ) : (
                              <button
                                onClick={() => nav(`/take-attendance?classId=${sec.classId}&sectionId=${sec.sectionId}&date=${schoolDate}&edit=1`)}
                                className="td-btn-secondary"
                                style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                              >
                                <PenLine size={13} />
                                Edit Attendance
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. Middle Grid: Schedule Table (Left) + Today at a Glance (Right) */}
          <div className="td-middle-grid">

            {/* Today's Teaching Schedule */}
            <div className="td-section-card">
              <div className="td-section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
                  <h3 className="td-section-title">
                    <CalendarDays size={18} style={{ color: '#2563eb' }} />
                    Today's Teaching Schedule ({r.length})
                  </h3>
                  <button
                    onClick={() => fetchTodayRoutine(true)}
                    type="button"
                    title="Refresh routine"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <RefreshCw size={11} className={loading ? 'spin' : ''} /> Refresh
                  </button>
                </div>
                <a href="#/timetable" className="td-link-btn">
                  View Full Timetable →
                </a>
              </div>

              {loading ? (
                <p className="muted" style={{ padding: 20, textAlign: 'center' }}>Loading today's schedule...</p>
              ) : r.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', background: 'var(--card)', borderRadius: 10, border: '1px dashed var(--border)' }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 600 }}>No routine periods assigned for today</p>
                  <p className="muted" style={{ margin: '0 auto 14px', maxWidth: 460, fontSize: 13, lineHeight: 1.5 }}>
                    You do not have any timetable entries scheduled for today. You can view the full weekly timetable or open the Attendance Station to review attendance.
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
                <div className="td-table-wrap">
                  <table className="td-table">
                    <thead>
                      <tr>
                        <th>PERIOD</th>
                        <th>TIME</th>
                        <th>CLASS & SECTION</th>
                        <th>SUBJECT</th>
                        <th>ROOM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.map((x, idx) => {
                        const recordedSession = getRoutineAttendance(x);
                        const timeStatus = getPeriodTimeStatus(x);
                        const uId = String(user?.id || '');
                        const uTeacherId = String((user as any)?.teacher_id || '');
                        const subId = String(x.substitute_teacher_id || x.altTeacherId || '');
                        const isAlternate = Boolean(subId && (subId === uId || (uTeacherId && subId === uTeacherId)));

                        return (
                          <tr key={x.id || idx}>
                            <td style={{ fontWeight: 700 }}>{x.period_number || idx + 1}</td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)' }}>
                              {fmt(x.start_time)} – {fmt(x.end_time)}
                            </td>
                            <td>
                              <span className="td-class-pill">
                                Class {x.class_number}-{x.section_name}
                              </span>
                              {isAlternate && (
                                <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 6, color: '#ea580c', background: '#ffedd5', padding: '2px 6px', borderRadius: 4 }}>
                                  Alt Teacher
                                </span>
                              )}
                            </td>
                            <td style={{ fontWeight: 600 }}>{x.subject_name || 'General'}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{x.room || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Today at a Glance */}
            <div className="td-section-card">
              <div className="td-section-header">
                <h3 className="td-section-title">
                  <Calendar size={18} style={{ color: '#2563eb' }} />
                  Today at a glance
                </h3>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
                {formattedTodayDateString}
              </div>

              {/* Weekday Strip */}
              <div className="td-calendar-strip">
                {weekDays.map((wd, i) => (
                  <div key={i} className={`td-day-col ${wd.isToday ? 'active' : ''}`}>
                    <span className="td-day-name">{wd.dayName}</span>
                    <span className="td-day-num">{wd.dayNum}</span>
                  </div>
                ))}
              </div>

              {/* Next Class Box */}
              {nextClass ? (
                <div className="td-next-class-box">
                  <div className="td-next-timer">
                    <div className="td-timer-icon">
                      <Clock size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Status
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0284c7' }}>
                        {getNextClassTimerText(nextClass)}
                      </div>
                    </div>
                  </div>
                  <div className="td-next-details">
                    <div className="td-next-class-name">
                      Class {nextClass.class_number}-{nextClass.section_name}
                    </div>
                    <div className="td-next-sub">
                      {nextClass.subject_name} · {fmt(nextClass.start_time)} - {fmt(nextClass.end_time)}
                    </div>
                    {nextClass.room && (
                      <div className="td-next-sub">Room {nextClass.room}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="td-next-class-box" style={{ justifyContent: 'center', textAlign: 'center' }}>
                  <div>
                    <CheckCircle2 size={24} style={{ color: '#10b981', margin: '0 auto 6px' }} />
                    <div className="td-next-class-name">All classes completed for today</div>
                    <div className="td-next-sub">Great job! No more upcoming routine periods.</div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* 4. Announcements */}

          <div className="td-section-card">
            <div className="td-section-header">
              <h3 className="td-section-title">
                <Megaphone size={18} style={{ color: '#2563eb' }} />
                Announcements
              </h3>
              <a href="#/announcements" className="td-link-btn">
                View All →
              </a>
            </div>

            {loading ? (
              <p className="muted" style={{ padding: 14 }}>Loading announcements...</p>
            ) : notices.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', background: 'var(--gray-50)', borderRadius: 10 }}>
                <CheckCircle2 size={28} style={{ color: '#10b981', margin: '0 auto 6px' }} />
                <div style={{ fontWeight: 700, fontSize: 14 }}>All caught up!</div>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>You have read all recent announcements.</p>
              </div>
            ) : (
              <div>
                {notices.slice(0, 3).map((notice, idx) => {
                  const isEmergency = notice.priority === 'EMERGENCY';
                  const isHigh = notice.priority === 'HIGH';
                  const iconColorClass = isEmergency ? 'amber' : isHigh ? 'purple' : 'green';

                  return (
                    <div key={notice.id || idx} className="td-update-item">
                      <div className={`td-update-icon ${iconColorClass}`}>
                        {isEmergency ? <AlertTriangle size={18} /> : isHigh ? <Users size={18} /> : <Megaphone size={18} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {notice.title}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                            {formatTimeAgo(notice.published_at || notice.created_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {notice.message || notice.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}

const DEFAULT_CLASSES = [
  { id: 'cls-lkg', class_number: -1, label: 'Class L KG' },
  { id: 'cls-ukg', class_number: 0, label: 'Class U KG' },
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({ id: `cls-${n}`, class_number: n, label: `Class ${n}` })))
];

const DEFAULT_SECTIONS = DEFAULT_CLASSES.flatMap(c => [
  { id: `sec-${c.id}-a`, class_id: c.id, class_number: c.class_number, name: 'A', section_name: 'A' },
  { id: `sec-${c.id}-b`, class_id: c.id, class_number: c.class_number, name: 'B', section_name: 'B' }
]);

export function toCanonicalSession(s?: string | null): string {
  if (!s) return '';
  const str = String(s).trim();
  const m = str.match(/(\d{4})[^\d]+(\d{2,4})/);
  if (m) {
    const y1 = m[1];
    const y2 = m[2].length === 2 ? y1.slice(0, 2) + m[2] : m[2];
    return `${y1}-${y2}`;
  }
  const single = str.match(/(\d{4})/);
  if (single) return single[1];
  return str.toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function isSameSession(s1?: string | null, s2?: string | null): boolean {
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  const str1 = String(s1).trim();
  const str2 = String(s2).trim();
  if (!str1 || !str2) return false;
  if (/^all(\s+sessions?)?$/i.test(str1) || /^all(\s+sessions?)?$/i.test(str2)) return true;
  if (str1.toLowerCase() === str2.toLowerCase()) return true;

  const c1 = toCanonicalSession(str1);
  const c2 = toCanonicalSession(str2);
  if (c1 && c2 && c1 === c2) return true;
  if (c1 && c2 && (c1.includes(c2) || c2.includes(c1))) return true;
  return str1.toLowerCase().includes(str2.toLowerCase()) || str2.toLowerCase().includes(str1.toLowerCase());
}

function cleanSess(s?: string | null) {
  return toCanonicalSession(s);
}

function studentMatchesSession(st: any, activeSess: string): boolean {
  if (!activeSess || /^all(\s+sessions?)?$/i.test(activeSess)) return true;
  const sName = st.session_name || st.session || '';
  const sId = st.academic_year_id || st.session_id || '';
  if (sName || sId) {
    if (sId && isSameSession(sId, activeSess)) return true;
    if (sName && isSameSession(sName, activeSess)) return true;
    return false;
  }
  return true;
}

export function formatLastFetched(date: Date | null): string {
  if (!date) return 'Not yet fetched';
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (diffSec < 8) return `${timeStr} (Just now)`;
  if (diffSec < 60) return `${timeStr} (${diffSec}s ago)`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${timeStr} (${diffMin}m ago)`;
  return `${timeStr} (${date.toLocaleDateString([], { month: 'short', day: 'numeric' })})`;
}

/* ────── Students ────── */
function Students() {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<string>(() => {
    return localStorage.getItem('attendo_academic_session') ||
      localStorage.getItem('attendo_active_academic_year') ||
      '2026-2027';
  });
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem('attendo_students_last_fetched');
      return saved ? new Date(saved) : null;
    } catch {
      return null;
    }
  });
  const [, setTimeTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTimeTick(t => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const [rows, setRows] = useState<any[]>([]);
  const [registeredStudentEmails, setRegisteredStudentEmails] = useState<Set<string>>(new Set());
  const [classes, setClasses] = useState<any[]>(DEFAULT_CLASSES);
  const [sections, setSections] = useState<any[]>(DEFAULT_SECTIONS);
  const [sessions, setSessions] = useState<any[]>([]);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(1); // 1=select session/class/section 2=upload 3=preview
  const [importSession, setImportSession] = useState('');
  const [importClass, setImportClass] = useState('');
  const [importSection, setImportSection] = useState('');
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    batch: number;
    totalBatches: number;
    uploadedBytes: number;
    totalBytes: number;
    percent: number;
  } | null>(null);
  const [importFileMeta, setImportFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [importErrors, setImportErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [importPreviewPage, setImportPreviewPage] = useState(1);
  const [importPreviewPageSize, setImportPreviewPageSize] = useState<number>(25);
  const [importPreviewSearch, setImportPreviewSearch] = useState('');
  const [importPreviewErrorFilter, setImportPreviewErrorFilter] = useState<'all' | 'errors' | 'valid'>('all');
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryPageSize, setDirectoryPageSize] = useState<number>(25);
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string; resetUrl?: string } | null>(null);

  const lastRegisteredStudentInfo = useMemo(() => {
    // Ground truth: strictly evaluate active students in directory
    if (!rows || rows.length === 0) {
      try {
        localStorage.removeItem('attendo_last_registered_student');
      } catch { }
      return null;
    }

    // Sort to find the most recently registered student in the directory
    const sorted = [...rows].sort((a, b) => {
      const timeA = a.created_at || a.createdAt ? new Date(a.created_at || a.createdAt).getTime() : 0;
      const timeB = b.created_at || b.createdAt ? new Date(b.created_at || b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;

      // Secondary: highest numeric admission number
      const numA = parseInt(String(a.admission_number || a.admissionNumber || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.admission_number || b.admissionNumber || '').replace(/\D/g, ''), 10) || 0;
      if (numB !== numA) return numB - numA;

      // Tertiary: highest numeric roll number
      const rollA = parseInt(String(a.roll_number || a.rollNumber || '').replace(/\D/g, ''), 10) || 0;
      const rollB = parseInt(String(b.roll_number || b.rollNumber || '').replace(/\D/g, ''), 10) || 0;
      if (rollB !== rollA) return rollB - rollA;

      return String(b.admission_number || b.admissionNumber || '').localeCompare(String(a.admission_number || a.admissionNumber || ''));
    });

    const latest = sorted[0];
    if (!latest) {
      try {
        localStorage.removeItem('attendo_last_registered_student');
      } catch { }
      return null;
    }

    const info = {
      name: latest.name || latest.full_name || `${latest.first_name || ''} ${latest.last_name || ''}`.trim() || 'Student',
      rollNumber: latest.roll_number || latest.rollNumber || latest.roll || '—',
      admissionNumber: latest.admission_number || latest.admissionNumber || latest.admission_no || latest.admissionNo || '—'
    };

    // Keep localStorage synchronized with the real latest student in directory
    try {
      localStorage.setItem('attendo_last_registered_student', JSON.stringify(info));
    } catch { }

    return info;
  }, [rows]);

  const directoryTopRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const isInitialDirectoryMount = useRef(true);

  const scrollToDirectoryTop = useCallback(() => {
    setTimeout(() => {
      if (tableBodyRef.current) {
        try {
          tableBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          tableBodyRef.current.scrollTop = 0;
        }
      }
      if (directoryTopRef.current) {
        try {
          directoryTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch {
          // ignore
        }
      }
    }, 10);
  }, []);

  useEffect(() => {
    if (isInitialDirectoryMount.current) {
      isInitialDirectoryMount.current = false;
      return;
    }
    scrollToDirectoryTop();
  }, [directoryPage, scrollToDirectoryTop]);

  // Universal Preview & Edit State
  const [studentPreview, setStudentPreview] = useState<{
    isOpen: boolean;
    operationType: 'create' | 'update';
    title: string;
    subtitle?: string;
    confirmText: string;
    sections: PreviewSectionData[];
    changes?: PreviewChangeData[];
    summaryCards?: PreviewSummaryCard[];
    payload?: any;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    operationType: 'create',
    title: '',
    confirmText: 'Confirm & Save',
    sections: [],
    loading: false,
    error: null,
  });

  // Destructive Delete State
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    studentId?: string;
    isBulk?: boolean;
    entityName: string;
    entityType: string;
    details: { label: string; value: string | number }[];
    warningMessage: string;
    confirmText: string;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    entityName: '',
    entityType: 'Student Record',
    details: [],
    warningMessage: '',
    confirmText: 'Delete',
    loading: false,
    error: null,
  });

  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const sessionPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sessionPickerRef.current && !sessionPickerRef.current.contains(event.target as Node)) {
        setSessionPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelectSession(sessName: string) {
    setActiveSession(sessName);
    localStorage.setItem('attendo_academic_session', sessName);
    localStorage.setItem('attendo_active_academic_year', sessName);
    window.dispatchEvent(new CustomEvent('sessionChanged', { detail: sessName }));
    window.dispatchEvent(new Event('storage'));
    load(sessName);
    setSessionPickerOpen(false);
  }

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

  async function load(sessionToLoad = activeSession) {
    setLoading(true);
    setLoadProgress(15);
    const progressTimer = setInterval(() => {
      setLoadProgress(prev => {
        if (prev >= 88) return prev;
        const jump = Math.floor(Math.random() * 12) + 8;
        return Math.min(88, prev + jump);
      });
    }, 120);

    try {
      const isAll = !sessionToLoad || /^all(\s+sessions?)?$/i.test(sessionToLoad);
      const sessParam = isAll ? '' : encodeURIComponent(sessionToLoad || '');
      const [a, b, c, d] = await Promise.all([
        api.get(`/students${sessParam ? `?session=${sessParam}` : ''}`),
        api.get('/classes'),
        api.get('/sections'),
        api.get('/academic-years').catch(() => ({ data: [] })) as any
      ]);
      setLoadProgress(95);
      const studentData = Array.isArray(a.data) ? a.data : (Array.isArray(a.data?.data) ? a.data.data : null);
      if (studentData) {
        setRows(studentData);
      }
      if (Array.isArray(b.data) && b.data.length > 0) {
        setClasses(b.data);
      }
      if (Array.isArray(c.data) && c.data.length > 0) {
        setSections(c.data);
      }
      if (Array.isArray(d.data) && d.data.length > 0) {
        setSessions(d.data);
        const activeDbYear = d.data.find((y: any) => y.is_active);
        if (activeDbYear && !localStorage.getItem('attendo_academic_session') && !localStorage.getItem('attendo_active_academic_year')) {
          setActiveSession(activeDbYear.name || activeDbYear.code || activeDbYear.id);
        }
      } else {
        setSessions([
          { id: 'ay-2024-25', name: '2024–25 Academic Session', code: '2024-25', label: '2024–25 Academic Session', is_active: false },
          { id: 'ay-2025-26', name: '2025–26 Academic Session', code: '2025-26', label: '2025–26 Academic Session', is_active: false },
          { id: 'ay-2026-27', name: '2026–27 Academic Session', code: '2026-27', label: '2026–27 Academic Session', is_active: true }
        ]);
      }
      setLoadProgress(100);
      const now = new Date();
      setLastFetchedAt(now);
      try {
        localStorage.setItem('attendo_students_last_fetched', now.toISOString());
      } catch { }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      clearInterval(progressTimer);
      setTimeout(() => {
        setLoading(false);
        setLoadProgress(0);
      }, 350);
    }
  }

  useEffect(() => {
    load(activeSession);
    if (new URLSearchParams(window.location.search).get('enroll') === 'true' && (user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN')) {
      setEditingStudent(null);
      setF({ loginOption: 'STUDENT', sendInviteEmail: true, session: activeSession, countryCode: '+91' });
      setOpen(true);
    }
  }, [activeSession]);

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

  async function handleInitiateSave(e: React.FormEvent) {
    e.preventDefault();
    // STAGE 1 VALIDATION
    const firstName = String(f.firstName !== undefined ? f.firstName : (editingStudent ? (f.name || '').split(' ')[0] : '')).trim();
    const middleName = String(f.middleName || '').trim();
    const lastName = String(f.lastName !== undefined ? f.lastName : (editingStudent ? (f.name || '').split(' ').slice(1).join(' ') : '')).trim();
    const fullName = (formatStudentFullName(firstName, middleName, lastName) || f.name || '').toUpperCase();
    if (!firstName) {
      alert('Validation Error: Please enter student first name.');
      return;
    }
    if (firstName.length < 3 || firstName.length > 15) {
      alert('Validation Error: First Name must be between 3 and 15 characters.');
      return;
    }
    if (/\s/.test(firstName)) {
      alert('Validation Error: Spaces are not allowed in First Name.');
      return;
    }
    if (/\d/.test(firstName)) {
      alert('Validation Error: Enter a string not a number in First Name.');
      return;
    }
    if (middleName && /\d/.test(middleName)) {
      alert('Validation Error: Enter a string not a number in Middle Name.');
      return;
    }
    if (!lastName) {
      alert('Validation Error: Please enter student last name.');
      return;
    }
    if (lastName.length < 3 || lastName.length > 15) {
      alert('Validation Error: Last Name must be between 3 and 15 characters.');
      return;
    }
    if (/\d/.test(lastName)) {
      alert('Validation Error: Enter a string not a number in Last Name.');
      return;
    }

    if (!f.session && !activeSession) {
      alert('Validation Error: Academic Session is a required field. Please select a session.');
      return;
    }

    const fatherName = String(f.fatherName || '').trim();
    const fatherPhone = String(f.fatherPhone || '').trim();
    const fatherOccupation = String(f.fatherOccupation || '').trim();
    const motherName = String(f.motherName || '').trim();
    const motherPhone = String(f.motherPhone || '').trim();
    const motherOccupation = String(f.motherOccupation || '').trim();
    const guardianName = String(f.guardianName || f.guardian_name || '').trim();
    const parentWhatsappNo = String(f.parentWhatsappNo || f.parent_whatsapp_no || '').trim();

    if (fatherName) {
      if (fatherName.length < 2) {
        alert('Validation Error: Father Name must be at least 2 characters.');
        return;
      }
      if (/\d/.test(fatherName)) {
        alert('Validation Error: Enter a string not a number in Father Name.');
        return;
      }
    }

    if (motherName) {
      if (motherName.length < 2) {
        alert('Validation Error: Mother Name must be at least 2 characters.');
        return;
      }
      if (/\d/.test(motherName)) {
        alert('Validation Error: Enter a string not a number in Mother Name.');
        return;
      }
    }

    if (guardianName) {
      if (guardianName.length < 2) {
        alert('Validation Error: Guardian Name must be at least 2 characters.');
        return;
      }
      if (/\d/.test(guardianName)) {
        alert('Validation Error: Enter a string not a number in Guardian Name.');
        return;
      }
    }

    if (!parentWhatsappNo) {
      alert('Validation Error: Parent WhatsApp No. is a required field.');
      return;
    }
    if (parentWhatsappNo.replace(/\D/g, '').length < 10) {
      alert('Validation Error: Parent WhatsApp No. must be a valid 10-digit number.');
      return;
    }

    if (f.parentName && /\d/.test(f.parentName)) {
      alert('Validation Error: Enter a string not a number in parent name.');
      return;
    }

    if (!f.dob) {
      alert('Validation Error: Date of Birth is a required field.');
      return;
    }
    const dobYr = String(f.dob).split('-')[0];
    if (dobYr && (dobYr.length > 4 || parseInt(dobYr, 10) > 9999 || parseInt(dobYr, 10) < 1000)) {
      alert('Validation Error: Date of Birth year cannot exceed 4 digits.');
      return;
    }

    const admStr = f.admissionDate || f.admission_date;
    if (!admStr) {
      alert('Validation Error: Admission Date is a required field.');
      return;
    }
    const admYr = String(admStr).split('-')[0];
    if (admYr && (admYr.length > 4 || parseInt(admYr, 10) > 9999 || parseInt(admYr, 10) < 1000)) {
      alert('Validation Error: Admission Date year cannot exceed 4 digits.');
      return;
    }

    const code = f.countryCode || '+91';
    const primaryPhone = String(fatherPhone || motherPhone || f.parentSmsNumber || '').trim();
    const phoneDigits = primaryPhone.replace(/\D/g, '');
    if (!primaryPhone || phoneDigits.length === 0) {
      alert('Validation Error: Please enter Father Contact No. or Mother Contact No.');
      return;
    }
    if (fatherPhone && fatherPhone.replace(/\D/g, '').length < 10) {
      alert('Validation Error: Father Contact No. must be a valid 10-digit number.');
      return;
    }
    if (motherPhone && motherPhone.replace(/\D/g, '').length < 10) {
      alert('Validation Error: Mother Contact No. must be a valid 10-digit number.');
      return;
    }
    const fullParentPhone = primaryPhone.startsWith('+') ? primaryPhone : `${code} ${phoneDigits.slice(-10)}`;
    const compositeParentName = (fatherName && motherName) ? `${fatherName} / ${motherName}` : (fatherName || motherName || guardianName || f.parentName || '');

    if (!f.classId) {
      alert('Validation Error: Please select an enrolled class.');
      return;
    }
    if (!f.sectionId) {
      alert('Validation Error: Please select an assigned section.');
      return;
    }

    const cleanRoll = String(f.rollNumber || f.roll_number || '').trim();
    if (!cleanRoll) {
      alert('Validation Error: Roll Number is a required field.');
      return;
    }
    if (!/^\d+$/.test(cleanRoll)) {
      alert('Validation Error: Roll Number must contain only numbers.');
      return;
    }

    const cleanAdm = String(f.admissionNumber || f.admission_number || '').trim();
    if (!cleanAdm) {
      alert('Validation Error: Admission Number is a required field.');
      return;
    }

    const selectedSessionStr = f.session || activeSession || '2026-2027';
    const matchedSession = sessions.find(s =>
      s.id === selectedSessionStr ||
      s.name === selectedSessionStr ||
      s.code === selectedSessionStr ||
      isSameSession(s.name, selectedSessionStr) ||
      isSameSession(s.id, selectedSessionStr)
    );
    let finalSectionId = f.sectionId;
    if (finalSectionId && f.classId) {
      const curName = sections.find(s => s.id === finalSectionId)?.name || (finalSectionId.endsWith('-b') || finalSectionId === 'B' ? 'B' : 'A');
      const targetSec = sections.find(s => (s.class_id === f.classId || s.classId === f.classId) && s.name.toUpperCase() === curName.toUpperCase());
      if (targetSec) finalSectionId = targetSec.id;
    }
    if (f.password && f.password.trim() && f.password.trim().length < 6) {
      alert('Password must be at least 6 characters in length.');
      return;
    }

    // Client-side uniqueness pre-checks against loaded student directory
    if (cleanAdm) {
      const dupAdm = rows.find(r =>
        (!editingStudent || r.id !== editingStudent.id) &&
        String(r.admission_number || r.admissionNumber || '').trim().toLowerCase() === cleanAdm.toLowerCase()
      );
      if (dupAdm) {
        alert(`Validation Error: Admission Number already exists. Admission number '${cleanAdm}' is already assigned to student '${dupAdm.name || dupAdm.full_name || 'Existing Student'}'.`);
        return;
      }
    }

    const EMAIL_FORMAT_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const cleanStuEmail = String(f.studentEmail || f.email || '').trim().toLowerCase();
    if (!cleanStuEmail) {
      alert('Validation Error: Student email address is a required field.');
      return;
    }
    if (!EMAIL_FORMAT_REGEX.test(cleanStuEmail)) {
      alert('Validation Error: Please enter a valid student email address (e.g. student@school.edu).');
      return;
    }
    const dupEmail = rows.find(r =>
      (!editingStudent || r.id !== editingStudent.id) &&
      (r.email || r.student_email || '').trim().toLowerCase() === cleanStuEmail
    );
    if (dupEmail) {
      alert(`Validation Error: Student email already exists. Student email '${cleanStuEmail}' is already registered to student '${dupEmail.name || dupEmail.full_name || 'Existing Student'}'.`);
      return;
    }

    const cleanParentEmail = String(f.parentEmail || '').trim().toLowerCase();
    if (!cleanParentEmail) {
      alert('Validation Error: Parent email address is a required field.');
      return;
    }
    if (!EMAIL_FORMAT_REGEX.test(cleanParentEmail)) {
      alert('Validation Error: Please enter a valid parent email address (e.g. parent@example.com).');
      return;
    }
    if (f.loginOption === 'PARENT' && !cleanParentEmail) {
      alert('Validation Error: Parent email is required when using parent email for student portal login.');
      return;
    }

    if (cleanRoll && f.classId && finalSectionId) {
      const dupRoll = rows.find(r => {
        if (editingStudent && r.id === editingStudent.id) return false;
        const rSession = r.session || r.session_name || r.academic_year_id || r.session_id;
        const sameSess = isSameSession(rSession, selectedSessionStr);
        const sameClass = r.class_id === f.classId || r.classId === f.classId || String(r.class_number || r.classNumber) === String(f.classId);
        const sameSec = r.section_id === finalSectionId || r.sectionId === finalSectionId;
        const sameRoll = String(r.roll_number || r.rollNumber || '').trim().toLowerCase() === cleanRoll.toLowerCase();
        return sameSess && sameClass && sameSec && sameRoll && r.is_active !== false;
      });
      if (dupRoll) {
        alert(`Validation Error: Roll Number already exists. Roll number '${cleanRoll}' is already assigned to student '${dupRoll.name || dupRoll.full_name || 'Existing Student'}' in this section for session ${selectedSessionStr}.`);
        return;
      }
    }

    const payload = {
      ...f,
      fatherName,
      father_name: fatherName,
      fatherPhone,
      father_phone: fatherPhone,
      fatherContactNo: fatherPhone,
      fatherOccupation,
      father_occupation: fatherOccupation,
      motherName,
      mother_name: motherName,
      motherPhone,
      mother_phone: motherPhone,
      motherContactNo: motherPhone,
      motherOccupation,
      mother_occupation: motherOccupation,
      guardianName,
      guardian_name: guardianName,
      parentWhatsappNo,
      parent_whatsapp_no: parentWhatsappNo,
      parentWhatsapp: parentWhatsappNo,
      parentName: compositeParentName,
      parent_name: compositeParentName,
      parentSmsNumber: fullParentPhone,
      parent_sms_number: fullParentPhone,
      parentPhone: fullParentPhone,
      parent_phone: fullParentPhone,
      dob: f.dob,
      date_of_birth: f.dob,
      admissionDate: f.admissionDate || f.admission_date || undefined,
      admission_date: f.admissionDate || f.admission_date || undefined,
      is_active: f.is_active !== false,
      status: f.is_active !== false ? 'ACTIVE' : 'INACTIVE',
      password: f.password && f.password.trim() ? f.password.trim() : undefined,
      countryCode: code,
      sectionId: finalSectionId,
      name: fullName,
      firstName,
      middleName,
      middle_name: middleName,
      lastName,
      session: matchedSession?.name || selectedSessionStr,
      sessionId: matchedSession?.id || selectedSessionStr
    };

    const cls = classes.find(c => c.id === f.classId || String(c.class_number) === String(f.classId));
    const sec = sections.find(s => s.id === finalSectionId || s.name === finalSectionId);
    const classLabel = cls ? (cls.label || (cls.class_number === -1 ? 'Class L KG' : cls.class_number === 0 ? 'Class U KG' : `Class ${cls.class_number}`)) : `Class ${f.classId}`;
    const secLabel = sec ? `Section ${sec.name}` : `Section ${finalSectionId || 'A'}`;

    const previewSections: PreviewSectionData[] = [
      {
        title: 'Student Identity',
        fields: [
          { label: 'Full Name', value: fullName, color: 'blue' },
          { label: 'First Name', value: firstName },
          ...(middleName ? [{ label: 'Middle Name', value: middleName }] : []),
          { label: 'Last Name', value: lastName || '—' },
          { label: 'Roll Number', value: f.rollNumber || editingStudent?.roll_number || 'Auto-assigned', type: 'code' },
          { label: 'Admission Number', value: f.admissionNumber || editingStudent?.admission_number || '—' },
          { label: 'Admission Date', value: f.admissionDate || f.admission_date || editingStudent?.admission_date || '—', type: 'date' },
          { label: 'Academic Session', value: selectedSessionStr, type: 'badge', color: 'blue' },
          { label: 'Date of Birth', value: f.dob || editingStudent?.dob || editingStudent?.date_of_birth || '—', type: 'date' },
          { label: 'Gender', value: formatGender(f.gender || editingStudent?.gender) || '—' },
        ]
      },
      {
        title: 'Academic Placement',
        fields: [
          { label: 'Enrolled Class', value: classLabel, color: 'blue' },
          { label: 'Assigned Section', value: secLabel, color: 'green' },
        ]
      },
      {
        title: 'Parent & Family Coordinates',
        fields: [
          { label: 'Father Name', value: fatherName || editingStudent?.father_name || '—' },
          { label: 'Father Contact No.', value: fatherPhone || editingStudent?.father_phone || '—', type: 'phone' },
          { label: 'Father Occupation', value: fatherOccupation || editingStudent?.father_occupation || '—' },
          { label: 'Mother Name', value: motherName || editingStudent?.mother_name || '—' },
          { label: 'Mother Contact No.', value: motherPhone || editingStudent?.mother_phone || '—', type: 'phone' },
          { label: 'Mother Occupation', value: motherOccupation || editingStudent?.mother_occupation || '—' },
          { label: 'Guardian Name', value: guardianName || editingStudent?.guardian_name || '—' },
          { label: 'Parent WhatsApp No.', value: parentWhatsappNo || editingStudent?.parent_whatsapp_no || '—', type: 'phone' },
        ]
      },
      {
        title: 'Portal Credentials & Security',
        fields: [
          { label: 'Account Status', value: f.is_active !== false ? 'Active' : 'Deactive', type: 'pill', color: f.is_active !== false ? 'green' : 'amber' },
          { label: 'Portal Password', value: editingStudent ? (f.password ? 'Custom password specified' : 'Retain existing password') : (f.password ? 'Initial password set' : 'Auto-invite link'), type: 'pill', color: 'purple' },
          { label: 'Student Portal Email', value: f.studentEmail || f.email || editingStudent?.student_email || '—', type: 'email' },
          { label: 'Parent Portal Email', value: f.parentEmail || editingStudent?.parent_email || '—', type: 'email' },
          { label: 'Login Provisioning', value: f.loginOption || 'STUDENT', type: 'pill', color: 'purple' },
          { label: 'Dispatch Activation Email', value: f.sendInviteEmail !== false ? 'Yes (24hr secure token)' : 'No', type: 'boolean' },
        ]
      }
    ];

    const summaryCards: PreviewSummaryCard[] = [
      { label: 'Student Name', value: fullName, color: 'blue' },
      { label: 'Class & Section', value: `${classLabel} · ${secLabel}`, color: 'green' },
      { label: 'Roll No', value: f.rollNumber || editingStudent?.roll_number || 'Auto', color: 'purple' },
      { label: 'Status', value: f.is_active !== false ? 'Active' : 'Deactive', color: f.is_active !== false ? 'green' : 'amber' },
    ];

    const changes = editingStudent ? calculateChanges(
      editingStudent,
      {
        name: fullName,
        roll_number: f.rollNumber || editingStudent.roll_number,
        admission_number: f.admissionNumber || editingStudent.admission_number,
        admission_date: f.admissionDate || f.admission_date || editingStudent.admission_date,
        date_of_birth: f.dob || editingStudent.dob || editingStudent.date_of_birth,
        father_name: fatherName,
        father_phone: fatherPhone,
        father_occupation: fatherOccupation,
        mother_name: motherName,
        mother_phone: motherPhone,
        mother_occupation: motherOccupation,
        guardian_name: guardianName,
        parent_whatsapp_no: parentWhatsappNo || editingStudent.parent_whatsapp_no,
        parent_name: compositeParentName,
        parent_phone: fullParentPhone,
        address: f.address,
        student_email: f.studentEmail || f.email,
        parent_email: f.parentEmail,
        is_active: f.is_active !== false ? 'ACTIVE' : 'INACTIVE',
      },
      {
        name: 'Student Name',
        roll_number: 'Roll Number',
        admission_number: 'Admission Number',
        admission_date: 'Admission Date',
        date_of_birth: 'Date of Birth',
        father_name: 'Father Name',
        father_phone: 'Father Contact No',
        father_occupation: 'Father Occupation',
        mother_name: 'Mother Name',
        mother_phone: 'Mother Contact No',
        mother_occupation: 'Mother Occupation',
        guardian_name: 'Guardian Name',
        parent_whatsapp_no: 'Parent WhatsApp No',
        parent_name: 'Parent Name',
        parent_phone: 'Parent Phone',
        address: 'Residential Address',
        student_email: 'Student Email',
        parent_email: 'Parent Email',
        is_active: 'Account Status',
      }
    ) : [];

    setStudentPreview({
      isOpen: true,
      operationType: editingStudent ? 'update' : 'create',
      title: editingStudent ? `Review Updates for ${fullName}` : `Review Enrollment for ${fullName}`,
      subtitle: editingStudent ? 'Confirm changes before updating institutional database' : 'Verify student credentials and class placement before enrolling',
      confirmText: editingStudent ? 'Confirm & Save Changes' : 'Confirm & Enroll Student',
      sections: previewSections,
      changes,
      summaryCards,
      payload,
      loading: false,
      error: null,
    });
  }

  async function executeConfirmStudentSave() {
    if (!studentPreview.payload) return;
    const payload = studentPreview.payload;

    // STAGE 2 VALIDATION
    if (!payload.name || !payload.classId || !payload.sectionId) {
      setStudentPreview(prev => ({ ...prev, error: 'Data integrity error: Required fields missing.' }));
      return;
    }

    setStudentPreview(prev => ({ ...prev, loading: true, error: null }));
    try {
      if (editingStudent) {
        const res = await api.put(`/students/${editingStudent.id}`, payload);
        const updated = res.data;
        setRows(prev => prev.map(r => r.id === editingStudent.id ? {
          ...r,
          ...updated,
          is_active: payload.is_active !== false,
          status: payload.is_active !== false ? 'ACTIVE' : 'INACTIVE'
        } : r));
        setToastNotice({ type: 'success', message: `Student profile for ${payload.name} updated successfully.` });
      } else {
        const res = await api.post('/students', payload);
        const created = res.data;
        const cls = classes.find(c => c.id === f.classId || String(c.class_number) === String(f.classId));
        const sec = sections.find(s => s.id === payload.sectionId || s.name === payload.sectionId);
        const resolvedClsNum = (created.class_number !== undefined && created.class_number !== null)
          ? Number(created.class_number)
          : (cls ? Number(cls.class_number) : 1);
        const resolvedSecName = created.section_name || sec?.name || (payload.sectionId?.endsWith('-b') || payload.sectionId === 'B' ? 'B' : 'A');
        const rowItem = {
          ...created,
          class_number: resolvedClsNum,
          section_name: resolvedSecName
        };
        setRows(prev => [rowItem, ...prev.filter(r => r.id !== rowItem.id)]);
        try {
          localStorage.setItem('attendo_last_registered_student', JSON.stringify({
            name: created.name || payload.name,
            rollNumber: created.roll_number || payload.rollNumber || '—',
            admissionNumber: created.admission_number || created.admissionNumber || payload.admissionNumber || payload.admission_number || '—'
          }));
        } catch { }
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
      setStudentPreview(prev => ({ ...prev, isOpen: false, loading: false }));
      setOpen(false);
      setEditingStudent(null);
      setF({});
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('dashboard_cache_')) localStorage.removeItem(k);
        }
      } catch { }
      window.dispatchEvent(new Event('dashboardShouldRefresh'));
      load();
    } catch (err: any) {
      setStudentPreview(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Could not save student. Please try again.'
      }));
    }
  }

  function promptDeleteStudent(student: any) {
    const cls = classes.find(c => c.id === student.class_id || String(c.class_number) === String(student.class_number));
    const classLabel = cls ? (cls.label || `Class ${cls.class_number}`) : (student.class_number ? `Class ${student.class_number}` : '—');
    setDeleteDialog({
      isOpen: true,
      studentId: student.id,
      isBulk: false,
      entityName: student.name,
      entityType: 'Student Profile',
      details: [
        { label: 'Roll Number', value: student.roll_number || '—' },
        { label: 'Class & Section', value: `${classLabel} - ${student.section_name || 'A'}` },
        { label: 'Parent', value: student.parent_name || '—' },
      ],
      warningMessage: 'Deleting this student will permanently erase all associated academic records, historical attendance sessions, and disable their portal account. This action cannot be reversed.',
      confirmText: 'Delete Student Record',
      loading: false,
      error: null,
    });
  }

  function promptBulkDelete() {
    if (selectedIds.size === 0) return;
    setDeleteDialog({
      isOpen: true,
      isBulk: true,
      entityName: `${selectedIds.size} Selected Students`,
      entityType: 'Student Profiles',
      details: [
        { label: 'Total Selected', value: selectedIds.size },
        { label: 'Session', value: activeSession },
      ],
      warningMessage: `Are you sure you want to permanently delete these ${selectedIds.size} student records? All associated attendance logs and login profiles will be deleted.`,
      confirmText: `Permanently Delete ${selectedIds.size} Students`,
      loading: false,
      error: null,
    });
  }

  async function executeConfirmDelete() {
    setDeleteDialog(prev => ({ ...prev, loading: true, error: null }));
    try {
      if (deleteDialog.isBulk) {
        const ids = Array.from(selectedIds);
        await api.post('/students/bulk-delete', { ids });
        setRows(prev => prev.filter(r => !selectedIds.has(r.id)));
        setSelectedIds(new Set());
      } else if (deleteDialog.studentId) {
        await api.delete(`/students/${deleteDialog.studentId}`);
        setRows(prev => prev.filter(r => r.id !== deleteDialog.studentId));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(deleteDialog.studentId!);
          return next;
        });
      }
      setDeleteDialog(prev => ({ ...prev, isOpen: false, loading: false }));
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('dashboard_cache_')) localStorage.removeItem(k);
        }
      } catch { }
      window.dispatchEvent(new Event('dashboardShouldRefresh'));
    } catch (err: any) {
      setDeleteDialog(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || 'Failed to delete student(s).'
      }));
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
      (r.gender && String(r.gender).toLowerCase().includes(q)) ||
      (r.student_email && r.student_email.toLowerCase().includes(q)) ||
      (r.parent_email && r.parent_email.toLowerCase().includes(q));
    const matchesClass = !classFilter || String(r.class_id) === classFilter || String(r.class_number) === classFilter;
    const matchesSection = !sectionFilter || String(r.section_id) === sectionFilter || String(r.section_name) === sectionFilter;
    const matchesSession = studentMatchesSession(r, activeSession);
    const matchesGender = !genderFilter || (
      genderFilter === 'Male'
        ? /^m/i.test(String(r.gender || '').trim())
        : genderFilter === 'Female'
          ? /^f/i.test(String(r.gender || '').trim())
          : true
    );
    return matchesSearch && matchesClass && matchesSection && matchesSession && matchesGender;
  });

  useEffect(() => {
    setDirectoryPage(1);
  }, [search, classFilter, sectionFilter, genderFilter, activeSession]);

  const totalDirectoryPages = Math.max(1, Math.ceil(filtered.length / (directoryPageSize || 25)));
  const currentDirectoryPage = Math.min(Math.max(1, directoryPage), totalDirectoryPages);
  const directoryStartIdx = filtered.length === 0 ? 0 : (currentDirectoryPage - 1) * (directoryPageSize || 25);
  const directoryEndIdx = Math.min(directoryStartIdx + (directoryPageSize || 25), filtered.length);
  const displayedStudents = filtered.slice(directoryStartIdx, directoryEndIdx);

  function toggleSelectAll() {
    const displayedIds = displayedStudents.map(r => r.id);
    const allDisplayedSelected = displayedIds.length > 0 && displayedIds.every(id => selectedIds.has(id));
    if (allDisplayedSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        displayedIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        displayedIds.forEach(id => next.add(id));
        return next;
      });
    }
  }

  function toIsoDate(val: any): string {
    if (!val) return '';
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
    }
    if (typeof val === 'number' || (/^\d{4,5}$/.test(s) && !s.includes('-') && !s.includes('/'))) {
      const num = Number(val);
      if (!isNaN(num) && num > 1000 && num < 60000) {
        const date = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
          const y = String(date.getUTCFullYear());
          const m = String(date.getUTCMonth() + 1).padStart(2, '0');
          const d = String(date.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      }
    }
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const y = String(dt.getFullYear());
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return s;
  }

  function prepareStudentExportData(): any[] {
    const list = selectedIds.size > 0 ? rows.filter(r => selectedIds.has(r.id)) : filtered;
    return list.map((r, idx) => {
      let fn = r.first_name || r.firstName || '';
      let mn = r.middle_name || r.middleName || '';
      let ln = r.last_name || r.lastName || '';
      if (!fn && !ln && r.name) {
        const parts = r.name.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          fn = parts[0] || '';
        } else if (parts.length === 2) {
          fn = parts[0] || '';
          ln = parts[1] || '';
        } else if (parts.length >= 3) {
          fn = parts[0] || '';
          mn = parts.slice(1, -1).join(' ') || '';
          ln = parts[parts.length - 1] || '';
        }
      }
      const fullName = (formatStudentFullName(fn, mn, ln) || r.name || `${fn} ${ln}`.trim()).toUpperCase();

      const cNum = Number(r.class_number);
      const cId = String(r.class_id || '');
      let classLabel = 'Class ' + (cNum || 1);
      if (cNum === -1 || /l.?kg/i.test(cId)) classLabel = 'L-KG';
      else if (cNum === 0 || /u.?kg/i.test(cId)) classLabel = 'U-KG';
      else if (!isNaN(cNum) && cNum > 0) classLabel = `Class ${cNum}`;
      else if (r.class_label || r.class_name) classLabel = String(r.class_label || r.class_name);

      const secName = String(r.section_name || r.sectionName || r.section || 'A').replace(/^section\s*/i, '').trim() || 'A';

      return {
        'Roll Number': r.roll_number !== undefined && r.roll_number !== null ? String(r.roll_number) : String(idx + 101),
        'Admission Number': r.admission_number || r.admissionNumber || '',
        'Admission Date': toDdMmYyyy(r.admission_date || r.admissionDate),
        'First Name': fn,
        'Middle Name': mn,
        'Last Name': ln,
        'Full Name': fullName,
        'Gender': formatGender(r.gender) || '',
        'Class': classLabel,
        'Section': secName,
        'Date of Birth': toDdMmYyyy(r.dob || r.date_of_birth),
        'Academic Session': r.session || r.session_name || activeSession || '2025-26',
        'Father Name': r.father_name || r.fatherName || '',
        'Father Contact No': r.father_phone || r.fatherPhone || '',
        'Father Occupation': r.father_occupation || r.fatherOccupation || '',
        'Mother Name': r.mother_name || r.motherName || '',
        'Mother Contact No': r.mother_phone || r.motherPhone || '',
        'Mother Occupation': r.mother_occupation || r.motherOccupation || '',
        'Guardian Name': r.guardian_name || r.guardianName || '',
        'Parent WhatsApp No': r.parent_whatsapp_no || r.parentWhatsappNo || r.parent_whatsapp || '',
        'Parent Email': r.parent_email || r.parentEmail || '',
        'Student Email': r.student_email || r.email || '',
        'Status': r.is_active !== false ? 'Active' : 'Inactive'
      };
    });
  }

  function handleExportStudentsExcel() {
    const data = prepareStudentExportData();
    if (!data.length) {
      alert('No student records found to export for current selection/filters.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [12, 16, 14, 14, 14, 14, 20, 10, 12, 10, 14, 14, 18, 16, 16, 18, 16, 16, 18, 18, 22, 22, 10].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    const filterDesc = selectedIds.size > 0 ? `Selected_${selectedIds.size}` : (classFilter ? `Class_${classFilter}` : 'All');
    XLSX.writeFile(wb, `Students_Export_${filterDesc}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExportStudentsCSV() {
    const data = prepareStudentExportData();
    if (!data.length) {
      alert('No student records found to export for current selection/filters.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const filterDesc = selectedIds.size > 0 ? `Selected_${selectedIds.size}` : (classFilter ? `Class_${classFilter}` : 'All');
    link.setAttribute('download', `Students_Export_${filterDesc}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadTemplate() {
    const sample = [
      {
        "First Name": "Aarav",
        "Middle Name": "Kumar",
        "Last Name": "Sharma",
        "Full Name": "Aarav Kumar Sharma",
        "Admission Number": "ADM-2025-001",
        "Admission Date": "2025-04-01",
        "Roll Number": "101",
        "Session": "2025-26",
        "Class": "Class 1",
        "Section": "A",
        "Date of Birth": "2019-05-15",
        "Gender": "Male",
        "Father Name": "Rajesh Sharma",
        "Father Contact No": "9876543210",
        "Father Occupation": "Business",
        "Mother Name": "Sunita Sharma",
        "Mother Contact No": "9876543219",
        "Mother Occupation": "Teacher",
        "Guardian Name": "",
        "Parent WhatsApp No": "9876543210",
        "Parent Email": "rajesh@example.com",
        "Student Email": "aarav@school.edu"
      },
      {
        "First Name": "Diya",
        "Middle Name": "",
        "Last Name": "Patel",
        "Full Name": "Diya Patel",
        "Admission Number": "ADM-2025-002",
        "Admission Date": "2025-04-01",
        "Roll Number": "102",
        "Session": "2025-26",
        "Class": "L-KG",
        "Section": "A",
        "Date of Birth": "2021-08-20",
        "Gender": "Female",
        "Father Name": "Kirit Patel",
        "Father Contact No": "9876543211",
        "Father Occupation": "Engineer",
        "Mother Name": "Bhavna Patel",
        "Mother Contact No": "9876543218",
        "Mother Occupation": "Doctor",
        "Guardian Name": "Vikram Patel",
        "Parent WhatsApp No": "9876543211",
        "Parent Email": "kirit@example.com",
        "Student Email": ""
      },
      {
        "First Name": "Rohan",
        "Middle Name": "Kumar",
        "Last Name": "Gupta",
        "Full Name": "Rohan Kumar Gupta",
        "Admission Number": "ADM-2025-003",
        "Admission Date": "2025-04-02",
        "Roll Number": "103",
        "Session": "2025-26",
        "Class": "U-KG",
        "Section": "B",
        "Date of Birth": "2020-11-10",
        "Gender": "Male",
        "Father Name": "Manoj Gupta",
        "Father Contact No": "9876543212",
        "Father Occupation": "Civil Servant",
        "Mother Name": "Rekha Gupta",
        "Mother Contact No": "9876543217",
        "Mother Occupation": "Home Maker",
        "Guardian Name": "",
        "Parent WhatsApp No": "9876543212",
        "Parent Email": "manoj@example.com",
        "Student Email": ""
      },
      {
        "First Name": "Amit",
        "Middle Name": "",
        "Last Name": "Verma",
        "Full Name": "Amit Verma",
        "Admission Number": "ADM-2025-004",
        "Admission Date": "2025-04-05",
        "Roll Number": "104",
        "Session": "2025-26",
        "Class": "Class 2",
        "Section": "A",
        "Date of Birth": "2018-02-14",
        "Gender": "Male",
        "Father Name": "Sunil Verma",
        "Father Contact No": "9876543213",
        "Father Occupation": "Banker",
        "Mother Name": "Pooja Verma",
        "Mother Contact No": "9876543216",
        "Mother Occupation": "Architect",
        "Guardian Name": "",
        "Parent WhatsApp No": "9876543213",
        "Parent Email": "sunil@example.com",
        "Student Email": ""
      },
      {
        "First Name": "Ananya",
        "Middle Name": "Kumari",
        "Last Name": "Singh",
        "Full Name": "Ananya Kumari Singh",
        "Admission Number": "ADM-2025-005",
        "Admission Date": "2025-04-05",
        "Roll Number": "105",
        "Session": "2025-26",
        "Class": "Class 3",
        "Section": "B",
        "Date of Birth": "2017-06-30",
        "Gender": "Female",
        "Father Name": "Sanjay Singh",
        "Father Contact No": "9876543214",
        "Father Occupation": "Professor",
        "Mother Name": "Meena Singh",
        "Mother Contact No": "9876543215",
        "Mother Occupation": "Scientist",
        "Guardian Name": "",
        "Parent WhatsApp No": "9876543214",
        "Parent Email": "sanjay@example.com",
        "Student Email": ""
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws['!cols'] = [14, 14, 14, 20, 18, 16, 14, 12, 12, 10, 16, 12, 20, 18, 18, 20, 18, 18, 18, 20, 24, 26].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students Import Template');
    XLSX.writeFile(wb, 'students_import_template.xlsx');
  }

  function formatBytes(bytes: number): string {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) {
      const kb = Math.round(bytes / 1024);
      return `${kb} KB`;
    }
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  }

  interface ParsedClassResult {
    valid: boolean;
    classNumber: number;
    classId: string;
    classLabel: string;
    error?: string;
  }

  function parseClassValue(rawVal: any, fallbackClass?: string | number): ParsedClassResult {
    let val = String(rawVal ?? '').trim();

    if (!val && fallbackClass !== undefined && fallbackClass !== null && String(fallbackClass).trim() !== '') {
      val = String(fallbackClass).trim();
    }

    if (!val) {
      return {
        valid: false,
        classNumber: 1,
        classId: 'cls-1',
        classLabel: '',
        error: 'Class is required'
      };
    }

    // Kindergarten string checks
    if (/^l\.?kg$/i.test(val) || /^l-kg$/i.test(val) || /^lower\s*kg$/i.test(val)) {
      return { valid: true, classNumber: -1, classId: 'cls-lkg', classLabel: 'L-KG' };
    }
    if (/^u\.?kg$/i.test(val) || /^u-kg$/i.test(val) || /^upper\s*kg$/i.test(val)) {
      return { valid: true, classNumber: 0, classId: 'cls-ukg', classLabel: 'U-KG' };
    }

    const clean = val.toLowerCase();

    // Roman Numeral lookup (I to XII)
    const ROMAN_MAP: Record<string, number> = {
      i: 1,
      ii: 2,
      iii: 3,
      iv: 4,
      v: 5,
      vi: 6,
      vii: 7,
      viii: 8,
      ix: 9,
      x: 10,
      xi: 11,
      xii: 12,
    };

    if (Object.prototype.hasOwnProperty.call(ROMAN_MAP, clean)) {
      const num = ROMAN_MAP[clean];
      return { valid: true, classNumber: num, classId: `cls-${num}`, classLabel: `Class ${num}` };
    }

    // Numeric string e.g. "10", "Class 10", "Grade 5", "Std 8"
    const cleanNoPrefix = val.replace(/^(class|grade|std|standard)\s*/i, '').trim();
    if (/^\d+$/.test(cleanNoPrefix)) {
      const num = parseInt(cleanNoPrefix, 10);
      if (num >= 1 && num <= 12) {
        return { valid: true, classNumber: num, classId: `cls-${num}`, classLabel: `Class ${num}` };
      }
    }

    // Numeric classNumber passed directly e.g. -1 (LKG) or 0 (UKG) or 1..12
    if (typeof rawVal === 'number') {
      if (rawVal === -1) return { valid: true, classNumber: -1, classId: 'cls-lkg', classLabel: 'L-KG' };
      if (rawVal === 0) return { valid: true, classNumber: 0, classId: 'cls-ukg', classLabel: 'U-KG' };
      if (rawVal >= 1 && rawVal <= 12) {
        return { valid: true, classNumber: rawVal, classId: `cls-${rawVal}`, classLabel: `Class ${rawVal}` };
      }
    }

    // Invalid class value
    return {
      valid: false,
      classNumber: 1,
      classId: 'cls-1',
      classLabel: val,
      error: `Invalid Class '${val}'. Expected 1–12, Roman numerals (I–XII), LKG, or UKG.`
    };
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileMeta({ name: file.name, size: file.size });
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        // Required headers validation
        const headers = Object.keys(json[0] || {});
        const REQUIRED_CORE = ['First Name', 'Last Name', 'Admission Number', 'Roll Number'];
        const missingCore = REQUIRED_CORE.filter(h => !headers.some(hk => hk.trim().toLowerCase() === h.toLowerCase()));
        const hasParentName = headers.some(hk => /father name|parent name|mother name|guardian/i.test(hk));
        const hasParentPhone = headers.some(hk => /father contact|father phone|parent phone|parent mobile|mother contact|mother phone|contact/i.test(hk));
        const hasDobHeader = headers.some(hk => /date of birth|dob|birth date/i.test(hk));

        const missingHeaders = [...missingCore];
        if (!hasDobHeader) missingHeaders.push('Date of Birth');
        if (!hasParentName) missingHeaders.push('Father Name (or Parent Name)');
        if (!hasParentPhone) missingHeaders.push('Father Contact No (or Parent Phone)');
        if (missingHeaders.length > 0) {
          alert(`Missing required columns: ${missingHeaders.join(', ')}\n\nPlease download the sample template and use the correct column names.`);
          return;
        }

        const rowErrors: { row: number; field: string; message: string }[] = [];
        const seenAdm = new Map<string, number>();
        const seenRoll = new Map<string, number>();
        const seenEmails = new Map<string, number>();

        const mapped = json.map((r, idx) => {
          const rowNum = idx + 1;
          let firstName = String(r['First Name'] || r['first_name'] || r['FirstName'] || '').trim();
          let middleName = String(r['Middle Name'] || r['middle_name'] || r['MiddleName'] || '').trim();
          let lastName = String(r['Last Name'] || r['last_name'] || r['LastName'] || '').trim();
          const rawFullName = String(r['Full Name'] || r['full_name'] || r['FullName'] || r['Student Name'] || r['Full Name (Auto)'] || r['Name'] || r['name'] || '').trim();
          if ((!firstName || !lastName) && rawFullName) {
            const parts = rawFullName.split(/\s+/).filter(Boolean);
            if (parts.length === 1) {
              if (!firstName) firstName = parts[0] || '';
            } else if (parts.length === 2) {
              if (!firstName) firstName = parts[0] || '';
              if (!lastName) lastName = parts[1] || '';
            } else if (parts.length >= 3) {
              if (!firstName) firstName = parts[0] || '';
              if (!middleName) middleName = parts.slice(1, -1).join(' ') || '';
              if (!lastName) lastName = parts[parts.length - 1] || '';
            }
          }
          const fullName = (formatStudentFullName(firstName, middleName, lastName) || rawFullName || ((firstName && lastName) ? `${firstName} ${lastName}` : (firstName || lastName || `STUDENT ${idx + 1}`))).toUpperCase();
          const admissionNumber = String(r['Admission Number'] || r['admission_number'] || r['Adm No'] || '').trim();
          const rollNumber = String(r['Roll Number'] || r['Roll'] || r['roll_number'] || r['Roll No'] || String(idx + 101)).trim();

          const fatherName = String(r['Father Name'] || r['Father\'s Name'] || r['father_name'] || r['FatherName'] || '').trim();
          const fatherPhone = String(r['Father Contact No'] || r['Father Contact'] || r['Father Phone'] || r['father_phone'] || r['FatherPhone'] || '').trim();
          const fatherOccupation = String(r['Father Occupation'] || r['Father\'s Occupation'] || r['father_occupation'] || r['FatherOccupation'] || '').trim();

          const motherName = String(r['Mother Name'] || r['Mother\'s Name'] || r['mother_name'] || r['MotherName'] || '').trim();
          const motherPhone = String(r['Mother Contact No'] || r['Mother Contact'] || r['Mother Phone'] || r['mother_phone'] || r['MotherPhone'] || '').trim();
          const motherOccupation = String(r['Mother Occupation'] || r['Mother\'s Occupation'] || r['mother_occupation'] || r['MotherOccupation'] || '').trim();
          const guardianName = String(r['Guardian Name'] || r['Guardian\'s Name'] || r['guardian_name'] || r['GuardianName'] || '').trim();

          const rawAdmDate = r['Admission Date'] || r['admission_date'] || r['AdmissionDate'] || r['Adm Date'] || '';
          const admissionDate = rawAdmDate ? (toIsoDate(rawAdmDate) || String(rawAdmDate)) : '';

          const rawDob = r['Date of Birth'] || r['date_of_birth'] || r['DOB'] || r['dob'] || r['DateOfBirth'] || '';
          const dob = rawDob ? (toIsoDate(rawDob) || String(rawDob)) : '';

          const parentWhatsappNo = String(r['Parent WhatsApp No'] || r['Parent Whatsapp No'] || r['WhatsApp No'] || r['Whatsapp No'] || r['parent_whatsapp_no'] || r['parent_whatsapp'] || '').trim();

          let parentName = String(r['Parent Name'] || r['parent_name'] || '').trim();
          if (!parentName && (fatherName || motherName || guardianName)) {
            parentName = (fatherName && motherName) ? `${fatherName} / ${motherName}` : (fatherName || motherName || guardianName || '');
          }
          let parentPhone = String(r['Parent Phone'] || r['Parent Mobile'] || r['parent_sms_number'] || '').trim();
          if (!parentPhone && (fatherPhone || motherPhone)) {
            parentPhone = fatherPhone || motherPhone || '';
          }
          const parentEmail = String(r['Parent Email'] || r['parent_email'] || '').trim();
          const studentEmail = String(r['Student Email'] || r['Email ID'] || r['Email'] || r['student_email'] || '').trim();
          let rawGender = String(r['Gender'] || r['gender'] || r['GENDER'] || r['Sex'] || r['sex'] || r['SEX'] || r['Gender (M/F)'] || r['Gender(M/F)'] || r['M/F'] || r['MF'] || r['Sex/Gender'] || r['Gen'] || '').trim();
          if (!rawGender && r && typeof r === 'object') {
            const gk = Object.keys(r).find(k => /gender|sex|\bm[\/\-_]?f\b/i.test(k));
            if (gk && r[gk] !== undefined && r[gk] !== null) rawGender = String(r[gk]).trim();
          }
          const gender = formatGender(rawGender);
          const session = String(r['Session'] || r['Academic Session'] || importSession || '2025-26').trim();

          // Class parsing: supports 'L-KG','U-KG','Class 1','1', Roman numerals (I-XII), etc.
          let excelClassVal: any = undefined;
          if (r && typeof r === 'object') {
            for (const k of Object.keys(r)) {
              const cleanKey = k.trim().toLowerCase();
              if (['class', 'class number', 'class_number', 'classnumber', 'grade', 'std', 'standard', 'class / grade', 'class/grade', 'class name'].includes(cleanKey)) {
                if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
                  excelClassVal = r[k];
                  break;
                }
              }
            }
          }
          if (excelClassVal === undefined || excelClassVal === null || String(excelClassVal).trim() === '') {
            excelClassVal = r['Class'] ?? r['Class Number'] ?? r['class_number'] ?? r['CLASS'] ?? r['class'] ?? r['Grade'] ?? r['grade'];
          }
          const parsedCls = parseClassValue(excelClassVal, importClass);
          const classId = parsedCls.classId;
          const classNumber = parsedCls.classNumber;
          const classLabel = parsedCls.classLabel;

          // Section extraction: case-insensitive, whitespace-tolerant, prefix-stripping
          let rawSecVal: any = undefined;
          if (r && typeof r === 'object') {
            for (const k of Object.keys(r)) {
              const cleanKey = k.trim().toLowerCase();
              if (['section', 'section name', 'section_name', 'sectionname', 'sec', 'sec_name', 'sec name'].includes(cleanKey)) {
                if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
                  rawSecVal = r[k];
                  break;
                }
              }
            }
          }
          if (rawSecVal === undefined || rawSecVal === null || String(rawSecVal).trim() === '') {
            rawSecVal = r['Section'] ?? r['Section Name'] ?? r['section_name'] ?? r['SECTION'] ?? r['section'] ?? r['Sec'] ?? r['sec'];
          }

          let sectionName = '';
          if (rawSecVal !== undefined && rawSecVal !== null && String(rawSecVal).trim() !== '') {
            sectionName = String(rawSecVal).trim().replace(/^section\s*/i, '').trim().toUpperCase();
          }
          if (!sectionName && importSection && String(importSection).trim() !== '') {
            sectionName = String(importSection).trim().replace(/^section\s*/i, '').trim().toUpperCase();
          }
          if (!sectionName) {
            sectionName = 'A';
          }

          const sectionId = `sec-${classId}-${sectionName.toLowerCase()}`;

          // Per-row validation
          const rowErrs: { row: number; field: string; message: string }[] = [];
          if (!firstName) rowErrs.push({ row: rowNum, field: 'First Name', message: 'First Name is required' });
          if (!lastName) rowErrs.push({ row: rowNum, field: 'Last Name', message: 'Last Name is required' });
          if (!dob) rowErrs.push({ row: rowNum, field: 'Date of Birth', message: 'Date of Birth is required' });
          if (!parentPhone && !fatherPhone && !motherPhone) {
            rowErrs.push({ row: rowNum, field: 'Father Contact No', message: 'Father Contact No (or Parent Phone) is required' });
          }
          if (!parsedCls.valid) rowErrs.push({ row: rowNum, field: 'Class', message: parsedCls.error || 'Invalid Class' });

          const normAdm = admissionNumber.toLowerCase();
          if (!admissionNumber) {
            rowErrs.push({ row: rowNum, field: 'Admission Number', message: 'Admission Number is required' });
          } else if (seenAdm.has(normAdm)) {
            rowErrs.push({ row: rowNum, field: 'Admission Number', message: `Duplicate admission number in file: '${admissionNumber}' (row ${seenAdm.get(normAdm)})` });
          } else {
            seenAdm.set(normAdm, rowNum);
            const dbDupAdm = rows.find(dr => (dr.admission_number || dr.admissionNumber || '').trim().toLowerCase() === normAdm);
            if (dbDupAdm) {
              rowErrs.push({ row: rowNum, field: 'Admission Number', message: `Admission number '${admissionNumber}' already exists in database` });
            }
          }

          const normRoll = rollNumber.toLowerCase();
          if (!rollNumber) {
            rowErrs.push({ row: rowNum, field: 'Roll Number', message: 'Roll Number is required' });
          } else if (parsedCls.valid) {
            const rollKey = `${classNumber}_${sectionName}_${normRoll}`;
            if (seenRoll.has(rollKey)) {
              rowErrs.push({ row: rowNum, field: 'Roll Number', message: `Duplicate roll '${rollNumber}' for ${classLabel} ${sectionName} in file (row ${seenRoll.get(rollKey)})` });
            } else {
              seenRoll.set(rollKey, rowNum);
              const dbDupRoll = rows.find(dr => {
                const rSess = dr.session || dr.session_name || dr.academic_year_id || dr.session_id;
                const sameSess = isSameSession(rSess, session);
                const sameClass = String(dr.class_number || dr.classNumber) === String(classNumber);
                const sameSec = (dr.section_name || 'A').toUpperCase() === sectionName;
                const sameRoll = String(dr.roll_number || dr.rollNumber || '').trim().toLowerCase() === normRoll;
                return sameSess && sameClass && sameSec && sameRoll && dr.is_active !== false;
              });
              if (dbDupRoll) {
                rowErrs.push({ row: rowNum, field: 'Roll Number', message: `Roll number '${rollNumber}' already exists in database for this class/section` });
              }
            }
          }

          const normEmail = studentEmail.toLowerCase();
          if (studentEmail) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
              rowErrs.push({ row: rowNum, field: 'Student Email', message: `Invalid student email format '${studentEmail}'` });
            } else if (seenEmails.has(normEmail)) {
              rowErrs.push({ row: rowNum, field: 'Student Email', message: `Duplicate student email in file (row ${seenEmails.get(normEmail)})` });
            } else {
              seenEmails.set(normEmail, rowNum);
              const dbDupEmail = rows.find(dr => (dr.email || dr.student_email || '').trim().toLowerCase() === normEmail);
              if (dbDupEmail) {
                rowErrs.push({ row: rowNum, field: 'Student Email', message: `Student email '${studentEmail}' already in use in database` });
              }
            }
          }

          rowErrors.push(...rowErrs);
          return {
            firstName,
            middleName,
            middle_name: middleName,
            lastName,
            name: fullName,
            admissionNumber,
            admissionDate,
            admission_date: admissionDate,
            rollNumber,
            gender,
            dob,
            dateOfBirth: dob,
            date_of_birth: dob,
            fatherName,
            father_name: fatherName,
            fatherPhone,
            father_phone: fatherPhone,
            fatherContactNo: fatherPhone,
            fatherOccupation,
            father_occupation: fatherOccupation,
            motherName,
            mother_name: motherName,
            motherPhone,
            mother_phone: motherPhone,
            motherContactNo: motherPhone,
            motherOccupation,
            mother_occupation: motherOccupation,
            guardianName,
            guardian_name: guardianName,
            parentWhatsappNo,
            parent_whatsapp_no: parentWhatsappNo,
            parentName,
            parentPhone,
            parentEmail,
            studentEmail,
            session,
            classId,
            classNumber,
            classLabel,
            sectionId,
            sectionName,
            _origRowIndex: rowNum,
            _errors: rowErrs
          };
        });

        setImportErrors(rowErrors);
        setPreviewRows(mapped);
        setImportPreviewPage(1);
        setImportPreviewSearch('');
        setImportPreviewErrorFilter('all');
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
      alert(`Cannot import file: ${importErrors.length} validation error(s) found in your file.\n\nAll rows must be valid before uploading, otherwise no data will be stored. Please correct the highlighted errors in your spreadsheet and re-upload.`);
      return;
    }
    setImporting(true);
    try {
      const validRows = previewRows.filter(r => !r._errors || r._errors.length === 0);
      if (validRows.length === 0 || validRows.length !== previewRows.length) {
        alert('Cannot proceed with import: some rows have validation errors. All rows must be valid to import.');
        setImporting(false);
        return;
      }
      // Resolve sessionId from wizard selection
      const sessionObj = sessions.find(s => (s.name || s.code || s.id) === importSession);
      const enrichedRows = validRows.map(r => ({
        ...r,
        session: r.session || importSession || '2025-26',
        classNumber: r.classNumber !== undefined ? r.classNumber : (Number(importClass) || 1),
        sectionName: r.sectionName || importSection || 'A'
      }));

      const totalFileSize = (importFileMeta && importFileMeta.size > 0)
        ? importFileMeta.size
        : (enrichedRows.length * 320);

      // Initialize progress display
      setImportProgress({
        current: 0,
        total: enrichedRows.length,
        batch: 1,
        totalBatches: 1,
        uploadedBytes: 0,
        totalBytes: totalFileSize,
        percent: 10
      });

      // Submit the ENTIRE dataset in a single atomic request so PostgreSQL executes in ONE transaction (BEGIN...COMMIT)
      // If ANY row fails, the entire transaction is cancelled and zero records are stored!
      const res = await api.post('/students/bulk-import', {
        students: enrichedRows,
        sessionId: sessionObj?.id || importSession || undefined,
        session: importSession || undefined,
        sendInviteEmail: false
      }, { timeout: 300000 });

      setImportProgress({
        current: enrichedRows.length,
        total: enrichedRows.length,
        batch: 1,
        totalBatches: 1,
        uploadedBytes: totalFileSize,
        totalBytes: totalFileSize,
        percent: 100
      });

      const totalImported = res.data?.count || enrichedRows.length;
      const targetSession = res.data?.session || '';
      const allCreatedItems: any[] = Array.isArray(res.data?.items) ? res.data.items : [];

      if (enrichedRows.length > 0) {
        const lastRow = enrichedRows[enrichedRows.length - 1];
        const lastFullName = lastRow.fullName || lastRow.name || `${lastRow.firstName || ''} ${lastRow.lastName || ''}`.trim() || 'Student';
        const lastRoll = lastRow.rollNumber || lastRow.roll_number || '—';
        const lastAdm = lastRow.admissionNumber || lastRow.admission_number || lastRow.admission_no || '—';
        try {
          localStorage.setItem('attendo_last_registered_student', JSON.stringify({
            name: lastFullName,
            rollNumber: lastRoll,
            admissionNumber: lastAdm
          }));
        } catch { }
      }

      alert(`Successfully imported ${totalImported} students${targetSession ? ` into ${targetSession}` : ''}!`);
      setImportOpen(false);
      setPreviewRows([]);
      setImportErrors([]);
      setImportPreviewPage(1);
      setImportPreviewSearch('');
      setImportStep(1);

      // Switch active session to imported session so students appear immediately
      const finalSession = targetSession || importSession || activeSession;
      if (finalSession && finalSession !== activeSession) {
        setActiveSession(finalSession);
        try {
          localStorage.setItem('attendo_academic_session', finalSession);
          window.dispatchEvent(new CustomEvent('sessionChanged', { detail: finalSession }));
        } catch { }
      }

      // Update rows immediately with imported items
      if (allCreatedItems.length > 0) {
        setRows(prev => {
          const newIds = new Set(allCreatedItems.map((it: any) => it.id));
          return [...allCreatedItems, ...prev.filter(r => !newIds.has(r.id))];
        });
      }

      setImportSession(''); setImportClass(''); setImportSection('');
      load(finalSession || activeSession);
    } catch (err: any) {
      const msg = err?.response?.data?.message || (err?.response?.status === 413 ? 'Payload size too large. Please retry with a smaller file.' : (err?.message || 'Failed to import students'));
      const serverErrs = err?.response?.data?.errors;
      if (serverErrs && Array.isArray(serverErrs)) {
        setImportErrors(serverErrs);
        setImportStep(3);
      }
      alert(`Import Failed: ${msg}\n\nThe operation was cancelled and no records were saved in the database.`);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  // Student Bulk Import Preview Pagination & Filtering
  const studentValidCount = previewRows.filter(r => !r._errors?.length).length;
  const studentErrorCount = previewRows.filter(r => r._errors?.length).length;

  const filteredStudentPreviewRows = previewRows.filter((r) => {
    if (importPreviewErrorFilter === 'errors' && (!r._errors || r._errors.length === 0)) return false;
    if (importPreviewErrorFilter === 'valid' && (r._errors && r._errors.length > 0)) return false;
    if (!importPreviewSearch.trim()) return true;
    const q = importPreviewSearch.toLowerCase();
    const searchTarget = [
      r.firstName,
      r.middleName,
      r.lastName,
      r.name,
      r.admissionNumber,
      r.rollNumber,
      r.session,
      r.classLabel || r.classNumber,
      r.sectionName,
      r.gender,
      r.parentPhone || r.parentSmsNumber,
      r.studentEmail
    ].filter(Boolean).join(' ').toLowerCase();
    return searchTarget.includes(q);
  });

  const totalStudentImportPages = Math.max(1, Math.ceil(filteredStudentPreviewRows.length / (importPreviewPageSize || 25)));
  const currentStudentImportPage = Math.min(Math.max(1, importPreviewPage), totalStudentImportPages);
  const studentStartIdx = filteredStudentPreviewRows.length === 0 ? 0 : (currentStudentImportPage - 1) * (importPreviewPageSize || 25);
  const studentEndIdx = Math.min(studentStartIdx + (importPreviewPageSize || 25), filteredStudentPreviewRows.length);
  const displayedStudentPreviewRows = filteredStudentPreviewRows.slice(studentStartIdx, studentEndIdx);

  return <Layout>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
      <div>
        <p className="eyebrow">STUDENT DIRECTORY</p>
        <h1 style={{ margin: 0, fontSize: 24 }}>Students Directory</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Manage enrolled students, section assignments, parent contacts, and batch Excel imports.</p>
      </div>
      {(user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN') ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#0284c7',
              color: '#ffffff',
              border: '1px solid #0369a1',
              padding: '7px 13px',
              borderRadius: 'var(--radius-sm, 6px)',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
            title="Export student records as Excel spreadsheet or CSV"
            id="students-top-export-btn"
          >
            <Download size={16} /> Export Excel / CSV{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
          <button
            onClick={() => setImportOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#ffffff' }}
          >
            <FileSpreadsheet size={16} /> Import Excel / CSV
          </button>
          <button
            onClick={() => {
              setEditingStudent(null);
              const curSess = localStorage.getItem('attendo_academic_session') || activeSession || '2026-2027';
              setF({ session: curSess, countryCode: '+91' });
              setOpen(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Add Student
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => load(activeSession)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: loading ? '#f1f5f9' : 'var(--card-bg, #ffffff)',
              color: loading ? '#64748b' : 'var(--text, #1e293b)',
              border: '1px solid var(--border, #cbd5e1)',
              padding: '7px 13px',
              borderRadius: 'var(--radius-sm, 6px)',
              fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
            title="Refetch students directly from database"
            id="students-top-refresh-btn"
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spinAnim 0.8s linear infinite' : 'none', color: '#2563eb' }} />
            <span>{loading ? `Refetching (${loadProgress}%)` : 'Refresh'}</span>
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#0284c7',
              color: '#ffffff',
              border: '1px solid #0369a1',
              padding: '7px 13px',
              borderRadius: 'var(--radius-sm, 6px)',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
            title="Export student records as Excel spreadsheet or CSV"
          >
            <Download size={16} /> Export Excel / CSV{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>
      )}
    </div>

    {/* Toast / Feedback Notice */}
    {toastNotice && (
      <div className={`feedback-notice ${toastNotice.type}`} style={{
        padding: '12px 16px',
        marginBottom: 16,
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
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

    {/* ── UNIFIED STUDENT DIRECTORY BOX WITH INNER SCROLLBAR ── */}
    <div className="directory-box" ref={directoryTopRef}>
      {/* Top Loading Progress Bar */}
      {loading && (
        <div style={{
          width: '100%',
          height: '4px',
          background: 'rgba(37, 99, 235, 0.12)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            width: `${loadProgress}%`,
            background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
            transition: 'width 0.15s ease-out',
            boxShadow: '0 0 8px rgba(59, 130, 246, 0.5)'
          }} />
        </div>
      )}
      {/* Box Header Toolbar */}
      <div className="directory-box-header">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto' }}>
          {/* Interactive Session Switcher Dropdown */}
          <div style={{ position: 'relative', flexShrink: 0 }} ref={sessionPickerRef}>
            <button
              type="button"
              onClick={() => setSessionPickerOpen(prev => !prev)}
              className={`session-picker-btn ${sessionPickerOpen ? 'open' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 500,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
                outline: 'none',
                whiteSpace: 'nowrap'
              }}
              title="Click to change academic session"
              id="students-session-picker-btn"
            >
              <CalendarDays size={14} style={{ color: 'inherit' }} />
              <span><b>Session:</b> {activeSession}</span>
              <ChevronDown size={14} style={{ transform: sessionPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'inherit' }} />
            </button>

            {sessionPickerOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 1000,
                  background: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border, #cbd5e1)',
                  borderRadius: 8,
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)',
                  minWidth: 260,
                  overflow: 'hidden',
                  animation: 'fadeIn 0.15s ease-out'
                }}
              >
                <div style={{ padding: '8px 12px', background: 'var(--card-subtle, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Switch Academic Session</span>
                  <span style={{ fontSize: 10, background: 'var(--border, #e2e8f0)', color: 'var(--text)', padding: '1px 5px', borderRadius: 4, textTransform: 'none' }}>{sessions.length} available</span>
                </div>

                <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px 0' }}>
                  {/* All Sessions Option */}
                  <button
                    type="button"
                    onClick={() => handleSelectSession('All Sessions')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: activeSession === 'All Sessions' ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                      color: activeSession === 'All Sessions' ? '#3b82f6' : 'var(--text, #334155)',
                      fontSize: 13,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: activeSession === 'All Sessions' ? 600 : 400
                    }}
                    onMouseEnter={e => { if (activeSession !== 'All Sessions') e.currentTarget.style.background = 'var(--card-subtle, #f8fafc)'; }}
                    onMouseLeave={e => { if (activeSession !== 'All Sessions') e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={14} style={{ opacity: 0.6 }} />
                      <span>All Sessions (View All)</span>
                    </div>
                    {activeSession === 'All Sessions' && <Check size={14} style={{ color: '#2563eb' }} />}
                  </button>

                  {/* Individual Sessions List */}
                  {(sessions.length > 0 ? sessions : [
                    { id: 'ay-2024-25', name: '2024–25 Academic Session', is_active: false },
                    { id: 'ay-2025-26', name: '2025–26 Academic Session', is_active: true },
                    { id: 'ay-2026-27', name: '2026–27 Academic Session', is_active: false }
                  ]).map((sess: any) => {
                    const sessName = sess.name || sess.label || sess.code || sess.id;
                    const isSelected = activeSession === sessName || (isSameSession(activeSession, sessName) && activeSession !== 'All Sessions');
                    return (
                      <button
                        type="button"
                        key={sess.id}
                        onClick={() => handleSelectSession(sessName)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                          color: isSelected ? '#3b82f6' : 'var(--text, #334155)',
                          fontSize: 13,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 600 : 400
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--card-subtle, #f8fafc)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CalendarDays size={14} style={{ opacity: 0.6 }} />
                          <span>{sessName}</span>
                          {sess.is_active && (
                            <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Active</span>
                          )}
                        </div>
                        {isSelected && <Check size={14} style={{ color: '#2563eb' }} />}
                      </button>
                    );
                  })}
                </div>

                {(user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN') && (
                  <div style={{ borderTop: '1px solid var(--border, #e2e8f0)', padding: '6px 8px', background: 'var(--card-subtle, #f8fafc)' }}>
                    <a
                      href="#/academic-years"
                      onClick={() => setSessionPickerOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: '#2563eb',
                        textDecoration: 'none',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: 4
                      }}
                      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      Manage Academic Sessions →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
          <input
            placeholder="🔍 Search name, roll no, admission no, class, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 320px', minWidth: 260, maxWidth: 460, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
            title="Search by student name, roll number, admission number, class, or email"
          />
          {/* Class and Section grouped together on the same line */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <select
              value={classFilter}
              onChange={e => { setClassFilter(e.target.value); setSectionFilter(''); }}
              style={{ padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, minWidth: 110 }}
            >
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.label || (c.class_number === -1 ? 'Class L KG' : c.class_number === 0 ? 'Class U KG' : `Class ${c.class_number}`)}</option>)}
            </select>
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, minWidth: 110 }}
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
            <select
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, minWidth: 110 }}
              aria-label="Filter by Gender"
            >
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          {(search || classFilter || sectionFilter || genderFilter) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setSearch(''); setClassFilter(''); setSectionFilter(''); setGenderFilter(''); }}
              style={{ padding: '6px 10px', fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => load(activeSession)}
            disabled={loading}
            className="directory-refresh-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: loading ? 'var(--card-subtle, #1e293b)' : 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border, #cbd5e1)',
              borderRadius: 'var(--radius-sm, 6px)',
              fontSize: 12.5,
              color: loading ? 'var(--text-muted, #94a3b8)' : 'var(--text, #1e293b)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
            title="Refetch student records from database"
            id="students-directory-refresh-btn"
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spinAnim 0.8s linear infinite' : 'none', color: '#2563eb' }} />
            <span>{loading ? `Refetching (${loadProgress}%)` : 'Refresh'}</span>
          </button>
          {/* Last Fetched Time Badge */}
          <div
            className="last-fetched-badge"
            title="Last successful synchronization with database"
          >
            <Clock size={12} />
            <span>Last fetched: <b>{formatLastFetched(lastFetchedAt)}</b></span>
            {loading && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginLeft: 3,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(37, 99, 235, 0.16)',
                color: '#3b82f6',
                fontWeight: 600,
                fontSize: 11
              }}>
                <Loader2 size={10} style={{ animation: 'spinAnim 0.8s linear infinite' }} />
                {loadProgress}%
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary, #475569)' }}>
            <span>Rows per page:</span>
            <select
              value={directoryPageSize}
              onChange={e => { setDirectoryPageSize(Number(e.target.value)); setDirectoryPage(1); scrollToDirectoryTop(); }}
              className="directory-select"
              style={{
                padding: '4px 8px',
                fontSize: 12.5,
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                cursor: 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25 (Default)</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={100000}>All ({filtered.length})</option>
            </select>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {filtered.length === 0 ? (
              'Showing 0 students'
            ) : (
              <>
                Showing <b>{directoryStartIdx + 1}</b> to <b>{directoryEndIdx}</b> of <b>{filtered.length}</b> students
                {filtered.length !== rows.length && (
                  <span style={{ opacity: 0.75, marginLeft: 4 }}>(filtered from {rows.length} total)</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Box Body (Scrollable Table Area) */}
      <div className="directory-box-body" ref={tableBodyRef} style={{ overflowX: 'hidden' }}>
        {loading && displayedStudents.length > 0 && (
          <div style={{
            position: 'sticky',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            background: 'rgba(239, 246, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            borderBottom: '1px solid #bfdbfe',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#1d4ed8',
            fontWeight: 500
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <RefreshCw size={12} style={{ animation: 'spinAnim 0.8s linear infinite' }} />
              <span>Refetching student directory from database...</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700 }}>{loadProgress}%</span>
              <div style={{ width: 70, height: 5, background: '#bfdbfe', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${loadProgress}%`, height: '100%', background: '#2563eb', transition: 'width 0.15s ease' }} />
              </div>
            </div>
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={displayedStudents.length > 0 && displayedStudents.every(x => selectedIds.has(x.id))}
                  onChange={toggleSelectAll}
                  title="Select all on this page"
                />
              </th>
              <th style={{ whiteSpace: 'nowrap' }}>Roll No</th>
              <th style={{ whiteSpace: 'nowrap' }}>Adm No</th>
              <th style={{ whiteSpace: 'nowrap' }}>Adm Date</th>
              <th style={{ whiteSpace: 'nowrap' }}>Student Name</th>
              <th style={{ whiteSpace: 'nowrap' }}>Gender</th>
              <th style={{ whiteSpace: 'nowrap' }}>Class</th>
              <th style={{ whiteSpace: 'nowrap' }}>Section</th>
              <th style={{ whiteSpace: 'nowrap' }}>Student Email</th>
              <th style={{ whiteSpace: 'nowrap' }}>Parent & Contact</th>
              <th style={{ whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && displayedStudents.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 320, margin: '0 auto' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={38} style={{ color: '#2563eb', animation: 'spinAnim 0.8s linear infinite' }} />
                      <span style={{ position: 'absolute', fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>{loadProgress}%</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text, #1e293b)' }}>Loading Student Directory...</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>Fetching enrolled students from database ({loadProgress}%)</div>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${loadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)', transition: 'width 0.15s ease' }} />
                    </div>
                  </div>
                </td>
              </tr>
            ) : displayedStudents.length === 0 ? (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: 24 }} className="muted">No students found. Click "Add Student" or "Import Excel / CSV" to enroll students.</td></tr>
            ) : displayedStudents.map(x => (
              <tr key={x.id} style={{ background: selectedIds.has(x.id) ? 'rgba(59, 130, 246, 0.06)' : 'transparent' }}>
                <td style={{ textAlign: 'center', width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(x.id)}
                    onChange={() => toggleSelect(x.id)}
                  />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span className="roll">{x.roll_number}</span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {(x.admission_number || x.admissionNumber) ? (
                    <span className="adm-no-tag">
                      {x.admission_number || x.admissionNumber}
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>—</span>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {toDdMmYyyy(x.admission_date || x.admissionDate) || '—'}
                </td>
                <td>
                  <StudentProfileHoverCard student={x} activeSession={activeSession}>
                    <b style={{ textTransform: 'uppercase' }}>{String(x.name || '').toUpperCase()}</b>
                  </StudentProfileHoverCard>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {x.gender ? (
                    <span
                      className={`gender-chip gender-${(formatGender(x.gender) || 'other').toLowerCase()}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 500,
                        background: formatGender(x.gender) === 'Female' ? '#fdf2f8' : formatGender(x.gender) === 'Male' ? '#f0f9ff' : '#f8fafc',
                        color: formatGender(x.gender) === 'Female' ? '#db2777' : formatGender(x.gender) === 'Male' ? '#0284c7' : '#64748b',
                        border: `1px solid ${formatGender(x.gender) === 'Female' ? '#fbcfe8' : formatGender(x.gender) === 'Male' ? '#bae6fd' : '#e2e8f0'}`
                      }}
                    >
                      {formatGender(x.gender)}
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>—</span>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {(() => {
                    const cNum = Number(x.class_number);
                    const cId = String(x.class_id || '');
                    if (cNum === -1 || /l.?kg/i.test(cId)) return 'L-KG';
                    if (cNum === 0 || /u.?kg/i.test(cId)) return 'U-KG';
                    if (!isNaN(cNum) && cNum > 0) return `Class ${cNum}`;
                    const m = cId.match(/cls-(\d+)/);
                    if (m) return `Class ${m[1]}`;
                    const label = String(x.class_label || x.class_name || '');
                    if (label) return label.replace(/^class\s*/i, '').trim() || label;
                    return 'Class ' + (cNum || 1);
                  })()}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {(() => {
                      const raw = String(x.section_name || x.sectionName || x.section || 'A').trim();
                      return raw.replace(/^section\s*/i, '').trim() || 'A';
                    })()}
                  </span>
                </td>
                <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 12, color: x.student_email || x.email ? 'var(--text-main)' : 'var(--text-muted)' }} title={x.student_email || x.email || ''}>
                    {x.student_email || x.email || '—'}
                  </span>
                </td>
                <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div><b>{x.parent_name || 'Parent'}</b></div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <code>{x.parent_sms_number}</code>
                    {x.parent_whatsapp_no && <span style={{ marginLeft: 4, color: '#16a34a' }} title={`WhatsApp: ${x.parent_whatsapp_no}`}>• WA</span>}
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span className={`badge ${x.is_active !== false ? 'active' : 'inactive'}`} style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600
                  }}>
                    {x.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                  </span>
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
                      const rawPhone = x.father_phone || x.fatherPhone || x.parent_sms_number || x.parentPhone || '';
                      let cCode = '+91';
                      let pNum = rawPhone;
                      const cMatch = rawPhone.match(/^(\+\d{1,4})\s*(.*)$/);
                      if (cMatch) {
                        cCode = cMatch[1];
                        pNum = cMatch[2];
                      }
                      const nameParts = (x.name || '').trim().split(/\s+/);
                      let fName = x.first_name || '';
                      let mName = x.middle_name || x.middleName || '';
                      let lName = x.last_name || '';
                      if (!fName && nameParts.length > 0) {
                        if (nameParts.length === 1) {
                          fName = nameParts[0];
                        } else if (nameParts.length === 2) {
                          fName = nameParts[0];
                          lName = nameParts[1];
                        } else {
                          fName = nameParts[0];
                          mName = nameParts.slice(1, -1).join(' ');
                          lName = nameParts[nameParts.length - 1];
                        }
                      }
                      setF({
                        name: String(x.name || '').toUpperCase(),
                        firstName: String(fName || '').toUpperCase(),
                        middleName: String(mName || '').toUpperCase(),
                        lastName: String(lName || '').toUpperCase(),
                        rollNumber: x.roll_number,
                        admissionNumber: x.admission_number || x.admissionNumber || '',
                        admissionDate: x.admission_date ? new Date(x.admission_date).toISOString().slice(0, 10) : (x.admissionDate || ''),
                        studentEmail: x.student_email || x.email || '',
                        parentName: x.parent_name || '',
                        fatherName: x.father_name || x.fatherName || '',
                        fatherPhone: x.father_phone || x.fatherPhone || pNum || '',
                        fatherOccupation: x.father_occupation || x.fatherOccupation || '',
                        motherName: x.mother_name || x.motherName || '',
                        motherPhone: x.mother_phone || x.motherPhone || '',
                        motherOccupation: x.mother_occupation || x.motherOccupation || '',
                        guardianName: x.guardian_name || x.guardianName || '',
                        countryCode: cCode,
                        parentSmsNumber: pNum,
                        parentWhatsappNo: x.parent_whatsapp_no || x.parentWhatsappNo || x.parent_whatsapp || x.parentWhatsapp || '',
                        parentEmail: x.parent_email || '',
                        classId: x.class_id,
                        sectionId: x.section_id,
                        gender: formatGender(x.gender) || '',
                        dob: x.date_of_birth ? new Date(x.date_of_birth).toISOString().slice(0, 10) : (x.dob || ''),
                        loginOption: (x.student_email || x.email) ? 'STUDENT' : x.parent_email ? 'PARENT' : 'STUDENT',
                        sendInviteEmail: true,
                        is_active: x.is_active !== false,
                        status: x.status || (x.is_active !== false ? 'ACTIVE' : 'INACTIVE'),
                        password: ''
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
                    onClick={() => promptDeleteStudent(x)}
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

      {/* Box Footer (Pagination Bar) */}
      <div className="directory-box-footer">
        <div style={{ color: 'var(--text-secondary, #475569)', fontSize: 12.5 }}>
          {filtered.length === 0 ? (
            'Showing 0 students'
          ) : (
            <>
              Showing <b>{directoryStartIdx + 1}</b> to <b>{directoryEndIdx}</b> of <b>{filtered.length}</b> students
              {filtered.length !== rows.length && (
                <span style={{ opacity: 0.75, marginLeft: 4 }}>(filtered from {rows.length} total)</span>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage <= 1}
            onClick={() => { setDirectoryPage(1); scrollToDirectoryTop(); }}
            title="First Page"
          >
            <ChevronsLeft size={14} /> First
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage <= 1}
            onClick={() => { setDirectoryPage(p => Math.max(1, p - 1)); scrollToDirectoryTop(); }}
            title="Previous Page"
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px', fontSize: 12.5 }}>
            <span>Page</span>
            <select
              value={currentDirectoryPage}
              onChange={(e) => { setDirectoryPage(Number(e.target.value)); scrollToDirectoryTop(); }}
              className="directory-select"
              style={{
                padding: '3px 6px',
                fontSize: 12,
                borderRadius: 4,
                border: '1px solid var(--border, #cbd5e1)',
                cursor: 'pointer'
              }}
            >
              {Array.from({ length: totalDirectoryPages }, (_, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {idx + 1}
                </option>
              ))}
            </select>
            <span>of <b>{totalDirectoryPages}</b></span>
          </div>

          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage >= totalDirectoryPages}
            onClick={() => { setDirectoryPage(p => Math.min(totalDirectoryPages, p + 1)); scrollToDirectoryTop(); }}
            title="Next Page"
          >
            Next <ChevronRight size={14} />
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage >= totalDirectoryPages}
            onClick={() => { setDirectoryPage(totalDirectoryPages); scrollToDirectoryTop(); }}
            title="Last Page"
          >
            Last <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>

    {/* Sticky Floating Action Bar for Bulk Selection */}
    {selectedIds.size > 0 && (
      <div className="bulk-action-bar">
        <span className="count-badge">{selectedIds.size} students selected</span>
        <button className="btn-secondary" onClick={() => setSelectedIds(new Set())}>
          Deselect All
        </button>
        <button className="btn-danger" onClick={promptBulkDelete}>
          <Trash2 size={14} /> Delete Selected ({selectedIds.size})
        </button>
      </div>
    )}

    {/* SINGLE STUDENT ADD / EDIT MODAL */}
    {open && (() => {
      const currentFormRoll = String(f.rollNumber || '').trim();
      const currentFormAdm = String(f.admissionNumber || '').trim();
      const currentFormStuEmail = String(f.studentEmail || f.email || '').trim().toLowerCase();
      const currentFormParentEmail = String(f.parentEmail || '').trim().toLowerCase();
      const EMAIL_VALIDATION_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      const isRollDuplicateInUi = Boolean(
        currentFormRoll &&
        rows.some(r => {
          if (editingStudent && r.id === editingStudent.id) return false;
          const sameRoll = String(r.roll_number || r.rollNumber || '').trim().toLowerCase() === currentFormRoll.toLowerCase();
          if (!sameRoll) return false;
          if (f.classId && f.sectionId) {
            const rSession = r.session || r.session_name || r.academic_year_id || r.session_id;
            const sameSess = isSameSession(rSession, f.session || activeSession);
            const sameClass = r.class_id === f.classId || r.classId === f.classId || String(r.class_number || r.classNumber) === String(f.classId);
            const sameSec = r.section_id === f.sectionId || r.sectionId === f.sectionId;
            return sameSess && sameClass && sameSec && r.is_active !== false;
          }
          return r.is_active !== false;
        })
      );

      const isAdmDuplicateInUi = Boolean(
        currentFormAdm &&
        rows.some(r =>
          (!editingStudent || r.id !== editingStudent.id) &&
          String(r.admission_number || r.admissionNumber || '').trim().toLowerCase() === currentFormAdm.toLowerCase()
        )
      );

      const isStuEmailDuplicateInUi = Boolean(
        currentFormStuEmail &&
        rows.some(r =>
          (!editingStudent || r.id !== editingStudent.id) &&
          String(r.email || r.student_email || '').trim().toLowerCase() === currentFormStuEmail
        )
      );

      const isStuEmailInvalidInUi = Boolean(
        currentFormStuEmail && !EMAIL_VALIDATION_REGEX.test(currentFormStuEmail)
      );

      const isParentEmailInvalidInUi = Boolean(
        currentFormParentEmail && !EMAIL_VALIDATION_REGEX.test(currentFormParentEmail)
      );

      const fnVal = f.firstName !== undefined ? f.firstName : (editingStudent ? (f.name || '').split(' ')[0] : '');
      const mnVal = f.middleName || '';
      const lnVal = f.lastName !== undefined ? f.lastName : (editingStudent ? (f.name || '').split(' ').slice(1).join(' ') : '');
      const isFnInvalid = Boolean(fnVal && (fnVal.length < 3 || fnVal.length > 15 || /\s/.test(fnVal) || /\d/.test(fnVal)));
      const isMnInvalid = Boolean(mnVal && (/\d/.test(mnVal) || /\s/.test(mnVal)));
      const isLnInvalid = Boolean(lnVal && (/\d/.test(lnVal) || lnVal.length < 3 || lnVal.length > 15));

      const isDobYearInvalidInUi = Boolean(
        f.dob && (String(f.dob).split('-')[0]?.length > 4 || parseInt(String(f.dob).split('-')[0], 10) > 9999)
      );

      const isAdmDateYearInvalidInUi = Boolean(
        (f.admissionDate || f.admission_date) &&
        (String(f.admissionDate || f.admission_date).split('-')[0]?.length > 4 || parseInt(String(f.admissionDate || f.admission_date).split('-')[0], 10) > 9999)
      );

      return (
        <Modal maxWidth={620} title={editingStudent ? "Edit Student Record" : "Add Student"} close={() => { setOpen(false); setEditingStudent(null); }}>
          {({ isFull }) => (
            <form className="modal-form" onSubmit={handleInitiateSave}>
              {/* Last Registered Student Banner in Red */}
              {lastRegisteredStudentInfo && (
                <div style={{
                  color: '#ef4444',
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: '8px 12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 6,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Info size={15} style={{ flexShrink: 0, color: '#ef4444' }} />
                  <span>
                    Last registered student: <strong style={{ color: '#ef4444' }}>{lastRegisteredStudentInfo.name}</strong> | Roll Number: <strong style={{ color: '#ef4444' }}>{lastRegisteredStudentInfo.rollNumber}</strong> | Admission Number: <strong style={{ color: '#ef4444' }}>{lastRegisteredStudentInfo.admissionNumber || '—'}</strong>
                  </span>
                </div>
              )}

              {/* First Name + Middle Name + Last Name */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isFull ? 'repeat(3, minmax(0, 1fr))' : '1fr 1fr',
                gap: 14,
                alignItems: 'start'
              }}>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    First Name <span style={{ color: '#ef4444', fontWeight: 600 }}>*</span>
                  </span>
                  <input
                    required
                    placeholder="e.g. Aarav"
                    maxLength={15}
                    value={fnVal || ''}
                    style={{
                      borderColor: isFnInvalid ? '#ef4444' : undefined,
                      boxShadow: isFnInvalid ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      const fn = e.target.value.replace(/\s/g, '').slice(0, 15);
                      const fullName = formatStudentFullName(fn, mnVal, lnVal);
                      setF({ ...f, firstName: fn, name: fullName });
                    }}
                  />
                  {fnVal && /\d/.test(fnVal) ? (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Enter a string not a number
                    </span>
                  ) : fnVal && /\s/.test(fnVal) ? (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Spaces are not allowed in First Name
                    </span>
                  ) : fnVal && fnVal.length < 3 ? (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Must be 3 to 15 characters
                    </span>
                  ) : null}
                </label>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    Middle Name <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', fontWeight: 'normal' }}>(Optional)</span>
                  </span>
                  <input
                    placeholder="e.g. Kumar"
                    maxLength={15}
                    value={mnVal}
                    style={{
                      borderColor: isMnInvalid ? '#ef4444' : undefined,
                      boxShadow: isMnInvalid ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      const mn = e.target.value.replace(/\s/g, '').slice(0, 15);
                      const fullName = formatStudentFullName(fnVal, mn, lnVal);
                      setF({ ...f, middleName: mn, name: fullName });
                    }}
                  />
                  {mnVal && /\d/.test(mnVal) && (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Enter a string not a number
                    </span>
                  )}
                </label>
                <label style={!isFull ? { gridColumn: '1 / -1' } : undefined}>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    Last Name <span style={{ color: '#ef4444', fontWeight: 600 }}>*</span>
                  </span>
                  <input
                    required
                    placeholder="e.g. Sharma"
                    maxLength={15}
                    value={lnVal || ''}
                    style={{
                      borderColor: isLnInvalid ? '#ef4444' : undefined,
                      boxShadow: isLnInvalid ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      const ln = e.target.value.replace(/\d/g, '').slice(0, 15);
                      const fullName = formatStudentFullName(fnVal, mnVal, ln);
                      setF({ ...f, lastName: ln, name: fullName });
                    }}
                  />
                  {lnVal && /\d/.test(lnVal) ? (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Enter a string not a number
                    </span>
                  ) : lnVal && lnVal.length < 3 ? (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Must be 3 to 15 characters
                    </span>
                  ) : null}
                </label>
              </div>

              {/* Full Name — auto-computed, read-only */}
              <label style={{ color: 'var(--text-secondary, #64748b)', fontSize: 12 }}>
                <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text, #334155)' }}>Full Name</span>
                  <span style={{ color: '#10b981', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
                    Auto-generated
                  </span>
                </span>
                <input
                  readOnly
                  tabIndex={-1}
                  style={{ backgroundColor: 'var(--card-subtle, #f8fafc)', color: 'var(--text, #334155)', cursor: 'default', border: '1px solid var(--border, #e2e8f0)', fontWeight: 600 }}
                  value={(formatStudentFullName(fnVal, mnVal, lnVal) || f.name || '').toUpperCase()}
                  placeholder="Full name will appear here automatically"
                />
              </label>

              {/* Session Selection */}
              <label>
                <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Session <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <select
                  required
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
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Roll Number <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    required
                    inputMode="numeric"
                    placeholder="Roll Number (e.g. 101)"
                    value={f.rollNumber || ''}
                    style={{
                      borderColor: isRollDuplicateInUi ? '#ef4444' : undefined,
                      boxShadow: isRollDuplicateInUi ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setF({ ...f, rollNumber: val });
                    }}
                  />
                  {isRollDuplicateInUi && (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 600 }}>
                      Already exist
                    </span>
                  )}
                </label>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Admission Number <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    required
                    placeholder="e.g. 1001 or ADM-101"
                    value={f.admissionNumber || ''}
                    style={{
                      borderColor: isAdmDuplicateInUi ? '#ef4444' : undefined,
                      boxShadow: isAdmDuplicateInUi ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      const val = e.target.value.trimStart();
                      setF({ ...f, admissionNumber: val });
                    }}
                  />
                  {isAdmDuplicateInUi && (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 600 }}>
                      Already exist
                    </span>
                  )}
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Admission Date <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    type="date"
                    required
                    min="1900-01-01"
                    max="9999-12-31"
                    value={f.admissionDate || f.admission_date || ''}
                    style={{
                      borderColor: isAdmDateYearInvalidInUi ? '#ef4444' : undefined,
                      boxShadow: isAdmDateYearInvalidInUi ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      let val = e.target.value;
                      if (val) {
                        const parts = val.split('-');
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].slice(0, 4);
                          val = parts.join('-');
                        }
                      }
                      setF({ ...f, admissionDate: val });
                    }}
                  />
                  {isAdmDateYearInvalidInUi && (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Year cannot exceed 4 digits
                    </span>
                  )}
                </label>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Date of Birth <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    type="date"
                    required
                    min="1900-01-01"
                    max={new Date().toISOString().slice(0, 10)}
                    value={f.dob || ''}
                    style={{
                      borderColor: isDobYearInvalidInUi ? '#ef4444' : undefined,
                      boxShadow: isDobYearInvalidInUi ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      let val = e.target.value;
                      if (val) {
                        const parts = val.split('-');
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].slice(0, 4);
                          val = parts.join('-');
                        }
                      }
                      setF({ ...f, dob: val });
                    }}
                  />
                  {isDobYearInvalidInUi && (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Year cannot exceed 4 digits
                    </span>
                  )}
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Gender
                  </span>
                  <select
                    value={formatGender(f.gender) || ''}
                    onChange={e => setF({ ...f, gender: formatGender(e.target.value) })}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              </div>
              <label>
                <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Class <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <select
                  required
                  value={f.classId || ''}
                  onChange={e => {
                    const newClassId = e.target.value;
                    let newSecId = f.sectionId;
                    if (newClassId) {
                      const curName = sections.find(s => s.id === f.sectionId)?.name || (f.sectionId?.endsWith('-b') || f.sectionId === 'B' ? 'B' : 'A');
                      const targetSec = sections.find(s => (s.class_id === newClassId || s.classId === newClassId) && s.name.toUpperCase() === curName.toUpperCase())
                        || sections.find(s => s.class_id === newClassId || s.classId === newClassId);
                      newSecId = targetSec ? targetSec.id : f.sectionId;
                    }
                    setF({ ...f, classId: newClassId, sectionId: newSecId });
                  }}
                >
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.label || (c.class_number === -1 ? 'Class L KG' : c.class_number === 0 ? 'Class U KG' : `Class ${c.class_number}`)}</option>)}
                </select>
              </label>
              <label>
                <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Section <span style={{ color: '#ef4444' }}>*</span>
                </span>
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
                    deduped.sort((a, b) => a.name.localeCompare(b.name));
                    return deduped.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>);
                  })()}
                </select>
              </label>

              <label>
                <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Student Email Address <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <input
                  required
                  type="email"
                  placeholder="student@school.edu"
                  value={f.studentEmail || f.email || ''}
                  style={{
                    borderColor: (isStuEmailDuplicateInUi || isStuEmailInvalidInUi) ? '#ef4444' : undefined,
                    boxShadow: (isStuEmailDuplicateInUi || isStuEmailInvalidInUi) ? '0 0 0 1px #ef4444' : undefined
                  }}
                  onChange={e => setF({ ...f, studentEmail: e.target.value.trim() })}
                />
                {isStuEmailDuplicateInUi ? (
                  <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 600 }}>
                    Already exist
                  </span>
                ) : isStuEmailInvalidInUi ? (
                  <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                    Please enter a valid email address
                  </span>
                ) : null}
              </label>

              {/* Father's Information */}
              <div style={{
                padding: '12px 14px',
                background: 'var(--card-subtle, #f8fafc)',
                borderRadius: 8,
                border: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginTop: 4
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main, #1e293b)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Father's Details</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                  <label>
                    <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Father Name
                    </span>
                    <input
                      placeholder="Father Name (Optional)"
                      value={f.fatherName || ''}
                      style={{
                        borderColor: /\d/.test(f.fatherName || '') ? '#ef4444' : undefined,
                        boxShadow: /\d/.test(f.fatherName || '') ? '0 0 0 1px #ef4444' : undefined
                      }}
                      onChange={e => setF({ ...f, fatherName: e.target.value })}
                    />
                    {/\d/.test(f.fatherName || '') && (
                      <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                        Enter a string not a number
                      </span>
                    )}
                  </label>
                  <label>
                    <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Father Contact No.
                    </span>
                    <input
                      placeholder="10-digit mobile"
                      maxLength={10}
                      inputMode="numeric"
                      value={f.fatherPhone || ''}
                      style={{
                        borderColor: (f.fatherPhone && String(f.fatherPhone).replace(/\D/g, '').length < 10) ? '#ef4444' : undefined,
                        boxShadow: (f.fatherPhone && String(f.fatherPhone).replace(/\D/g, '').length < 10) ? '0 0 0 1px #ef4444' : undefined
                      }}
                      onChange={e => {
                        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setF({ ...f, fatherPhone: cleaned });
                      }}
                    />
                    {f.fatherPhone && String(f.fatherPhone).replace(/\D/g, '').length < 10 && (
                      <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                        Must be 10 digits
                      </span>
                    )}
                  </label>
                  <label>
                    <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Father Occupation
                    </span>
                    <input
                      placeholder="Father Occupation"
                      value={f.fatherOccupation || ''}
                      onChange={e => setF({ ...f, fatherOccupation: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              {/* Mother's Information */}
              <div style={{
                padding: '12px 14px',
                background: 'var(--card-subtle, #f8fafc)',
                borderRadius: 8,
                border: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main, #1e293b)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Mother's Details</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                  <label>
                    <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Mother Name
                    </span>
                    <input
                      placeholder="Mother Name (Optional)"
                      value={f.motherName || ''}
                      style={{
                        borderColor: /\d/.test(f.motherName || '') ? '#ef4444' : undefined,
                        boxShadow: /\d/.test(f.motherName || '') ? '0 0 0 1px #ef4444' : undefined
                      }}
                      onChange={e => setF({ ...f, motherName: e.target.value })}
                    />
                    {/\d/.test(f.motherName || '') && (
                      <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                        Enter a string not a number
                      </span>
                    )}
                  </label>
                  <label>
                    <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Mother Contact No.
                    </span>
                    <input
                      placeholder="10-digit mobile"
                      maxLength={10}
                      inputMode="numeric"
                      value={f.motherPhone || ''}
                      style={{
                        borderColor: (f.motherPhone && String(f.motherPhone).replace(/\D/g, '').length < 10) ? '#ef4444' : undefined,
                        boxShadow: (f.motherPhone && String(f.motherPhone).replace(/\D/g, '').length < 10) ? '0 0 0 1px #ef4444' : undefined
                      }}
                      onChange={e => {
                        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setF({ ...f, motherPhone: cleaned });
                      }}
                    />
                    {f.motherPhone && String(f.motherPhone).replace(/\D/g, '').length < 10 && (
                      <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                        Must be 10 digits
                      </span>
                    )}
                  </label>
                  <label>
                    <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Mother Occupation
                    </span>
                    <input
                      placeholder="Mother Occupation"
                      value={f.motherOccupation || ''}
                      onChange={e => setF({ ...f, motherOccupation: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              {/* Guardian's Information */}
              <div style={{
                padding: '12px 14px',
                background: 'var(--card-subtle, #f8fafc)',
                borderRadius: 8,
                border: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main, #1e293b)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Guardian's Details</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                  <label>
                    <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Guardian Name
                    </span>
                    <input
                      placeholder="Guardian Name (Optional)"
                      value={f.guardianName || f.guardian_name || ''}
                      style={{
                        borderColor: /\d/.test(f.guardianName || f.guardian_name || '') ? '#ef4444' : undefined,
                        boxShadow: /\d/.test(f.guardianName || f.guardian_name || '') ? '0 0 0 1px #ef4444' : undefined
                      }}
                      onChange={e => setF({ ...f, guardianName: e.target.value, guardian_name: e.target.value })}
                    />
                    {/\d/.test(f.guardianName || f.guardian_name || '') && (
                      <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                        Enter a string not a number
                      </span>
                    )}
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Parent WhatsApp No. <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    required
                    placeholder="10-digit mobile"
                    maxLength={10}
                    inputMode="numeric"
                    value={f.parentWhatsappNo || f.parent_whatsapp_no || ''}
                    style={{
                      borderColor: (f.parentWhatsappNo && String(f.parentWhatsappNo).replace(/\D/g, '').length < 10) ? '#ef4444' : undefined,
                      boxShadow: (f.parentWhatsappNo && String(f.parentWhatsappNo).replace(/\D/g, '').length < 10) ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setF({ ...f, parentWhatsappNo: cleaned, parent_whatsapp_no: cleaned });
                    }}
                  />
                  {f.parentWhatsappNo && String(f.parentWhatsappNo).replace(/\D/g, '').length < 10 && (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Must be 10 digits
                    </span>
                  )}
                </label>
                <label>
                  <span className="label-text">
                    Parent Email Address (for Login / Absent <span style={{ whiteSpace: 'nowrap' }}>Alerts)&nbsp;<span style={{ color: '#ef4444' }}>*</span></span>
                  </span>
                  <input
                    required
                    type="email"
                    placeholder="parent@example.com"
                    value={f.parentEmail || ''}
                    style={{
                      borderColor: isParentEmailInvalidInUi ? '#ef4444' : undefined,
                      boxShadow: isParentEmailInvalidInUi ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => setF({ ...f, parentEmail: e.target.value.trim() })}
                  />
                  {isParentEmailInvalidInUi && (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Please enter a valid email address
                    </span>
                  )}
                </label>
              </div>

              {editingStudent && (
                <label>Account Status
                  <select
                    value={f.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                    onChange={e => setF({ ...f, is_active: e.target.value === 'ACTIVE', status: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', marginTop: 4 }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Deactive (Inactive)</option>
                  </select>
                </label>
              )}

              {/* Student Portal Password & Account Setup Box */}
              <div className="student-portal-box">
                <div className="student-portal-box-title" style={{ marginBottom: 6 }}>
                  <KeyRound size={14} style={{ color: '#2563eb' }} />
                  {editingStudent ? 'Update Portal Password (Optional)' : 'Portal Password & Setup'}
                </div>
                <label style={{ display: 'block', fontSize: 12, margin: '4px 0 10px 0' }} className="student-portal-box-desc">
                  {editingStudent
                    ? 'Leave blank to retain current password, or set a new password for student portal login:'
                    : 'Optional initial login password (leave empty to let student/parent activate via link):'}
                  <div style={{ position: 'relative', marginTop: 6, display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showStudentPassword ? 'text' : 'password'}
                      placeholder={editingStudent ? 'New password (min 6 characters, e.g. ChangeMe123!)' : 'Optional initial password'}
                      value={f.password || ''}
                      onChange={e => setF({ ...f, password: e.target.value })}
                      style={{ width: '100%', paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowStudentPassword(s => !s)}
                      className="password-toggle-btn"
                      title={showStudentPassword ? "Hide password" : "Show password"}
                      style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary, #64748b)', display: 'flex', alignItems: 'center' }}
                    >
                      {showStudentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
              </div>

              {/* Student Portal Login Credentials Section */}
              <div className="student-portal-box">
                <div className="student-portal-box-title">
                  <KeyRound size={14} style={{ color: '#2563eb' }} />
                  Student Portal Login Email Option
                </div>
                <p className="student-portal-box-desc">
                  Select which email will be used to log in to the <b>Student Portal</b>:
                </p>
                <div className="student-portal-radio-group">
                  <label className="student-portal-radio-label">
                    <input
                      type="radio"
                      name="loginOption"
                      value="STUDENT"
                      checked={(f.loginOption || 'STUDENT') === 'STUDENT'}
                      onChange={e => setF({ ...f, loginOption: e.target.value })}
                    />
                    <span>🎓 <b>Use Student Email</b> for Student Portal Login</span>
                  </label>
                  <label className="student-portal-radio-label">
                    <input
                      type="radio"
                      name="loginOption"
                      value="PARENT"
                      checked={f.loginOption === 'PARENT'}
                      onChange={e => setF({ ...f, loginOption: e.target.value })}
                    />
                    <span>👨‍👩‍👧 <b>Use Parent Email</b> for Student Portal Login</span>
                  </label>
                  <label className="student-portal-radio-label">
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

                <label className="student-portal-invite-note">
                  <input
                    type="checkbox"
                    checked={f.sendInviteEmail !== false}
                    onChange={e => setF({ ...f, sendInviteEmail: e.target.checked })}
                  />
                  <span>Send password setup email to selected login email (secure 24-hour setup link; spam-filtered)</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setOpen(false); setEditingStudent(null); setF({}); }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving}>{saving ? 'Saving student...' : editingStudent ? 'Update student record' : 'Save student & send invite'}</button>
              </div>
            </form>
          )}
        </Modal>
      );
    })()}

    {/* EXCEL / CSV BULK IMPORT MODAL — Multi-Step Wizard */}
    {importOpen && (
      <Modal
        title="Bulk Import Students (Excel / CSV)"
        fullWindow={true}
        close={() => {
          setImportOpen(false);
          setPreviewRows([]);
          setImportStep(1);
          setImportSession('');
          setImportClass('');
          setImportSection('');
        }}
      >
        <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Last Registered Student Banner in Red */}
          {lastRegisteredStudentInfo && (
            <div style={{
              color: '#ef4444',
              fontSize: 12.5,
              fontWeight: 600,
              padding: '8px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 6,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0
            }}>
              <Info size={15} style={{ flexShrink: 0, color: '#ef4444' }} />
              <span>
                Last registered student: <strong style={{ color: '#ef4444' }}>{lastRegisteredStudentInfo.name}</strong> | Roll Number: <strong style={{ color: '#ef4444' }}>{lastRegisteredStudentInfo.rollNumber}</strong> | Admission Number: <strong style={{ color: '#ef4444' }}>{lastRegisteredStudentInfo.admissionNumber || '—'}</strong>
              </span>
            </div>
          )}

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 18, fontSize: 12.5, flexShrink: 0 }}>
            {['Select Session', 'Upload File', 'Preview & Confirm'].map((label, idx) => {
              const step = idx + 1;
              const active = importStep === step;
              const done = importStep > step;
              return (
                <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                      background: done ? '#10b981' : active ? '#2563eb' : 'var(--border, #e2e8f0)',
                      color: (done || active) ? '#fff' : 'var(--text-secondary, #94a3b8)'
                    }}>{done ? '✓' : step}</div>
                    <span style={{ color: active ? 'var(--text, #1e293b)' : done ? '#10b981' : 'var(--text-secondary, #94a3b8)', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{label}</span>
                  </div>
                  {step < 3 && <div style={{ height: 2, background: done ? '#10b981' : 'var(--border, #e2e8f0)', flex: 1, margin: '0 8px' }} />}
                </div>
              );
            })}
          </div>

          {/* ── STEP 1: Select Session ── */}
          {importStep === 1 && (
            <div style={{ maxWidth: 640, width: '100%', margin: '20px auto', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg-card, #ffffff)', padding: '24px 28px', borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))' }}>
              <label style={{ fontSize: 13.5, fontWeight: 600 }}>Academic Session <span style={{ color: '#ef4444', fontSize: 11 }}>*</span>
                <select value={importSession} onChange={e => setImportSession(e.target.value)} style={{ marginTop: 6, width: '100%', padding: '9px 12px', fontSize: 14 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
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
                  style={{ background: '#2563eb', color: '#fff', opacity: importSession ? 1 : 0.5, padding: '8px 20px', fontWeight: 600 }}
                >
                  Next: Upload File →
                </button>
              </div>
              {!importSession && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>Please select a session to continue.</p>}
            </div>
          )}

          {/* ── STEP 2: Upload File ── */}
          {importStep === 2 && (
            <div style={{ maxWidth: 760, width: '100%', margin: '16px auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: 14, padding: '12px 18px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: 13.5, color: '#10b981' }}>
                📋 Session: <b>{importSession}</b>
              </div>
              <label className="dropzone" style={{ padding: '36px 24px' }}>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFile}
                  style={{ display: 'none' }}
                />
                <div className="dropzone-icon">
                  <UploadCloud size={32} />
                </div>
                <strong style={{ fontSize: 15 }}>Click to browse or drop Excel file here</strong>
                <span className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</span>
                <span className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Columns: First Name, Middle Name, Last Name, Admission Number, Admission Date, Roll Number, Session, Class, Section, Date of Birth, Gender, Father Name, Father Contact No, Father Occupation, Mother Name, Mother Contact No, Mother Occupation, Guardian Name, Parent WhatsApp No, Parent Email, Student Email</span>
              </label>
              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn-secondary" onClick={() => setImportStep(1)}>← Back</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview & Confirm ── */}
          {importStep === 3 && previewRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ marginBottom: 10, padding: '10px 16px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: 13, color: '#10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span>✅ <b>{previewRows.length} students</b> parsed · Session: <b>{importSession}</b> · <b>{studentValidCount} valid</b></span>
                <span style={{ fontSize: 12, color: '#10b981' }}>Review parsed records below before finalizing import</span>
              </div>

              {/* ── TOP TOOLBAR: Search, Filter Tabs, Page Size & Re-upload ── */}
              <div className="preview-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 15 }}>Preview Data</strong>
                  <span style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', borderRadius: 10, fontWeight: 600 }}>
                    {previewRows.length} records
                  </span>

                  {/* Filter tabs if validation errors exist */}
                  {studentErrorCount > 0 && (
                    <div style={{ display: 'inline-flex', background: 'var(--card-subtle, #f1f5f9)', borderRadius: 6, padding: 2, fontSize: 12, marginLeft: 4 }}>
                      <button
                        type="button"
                        onClick={() => { setImportPreviewErrorFilter('all'); setImportPreviewPage(1); }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: importPreviewErrorFilter === 'all' ? 'var(--bg-card, #ffffff)' : 'transparent',
                          color: importPreviewErrorFilter === 'all' ? 'var(--text, #0f172a)' : 'var(--text-secondary, #64748b)',
                          boxShadow: importPreviewErrorFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                          fontWeight: importPreviewErrorFilter === 'all' ? 600 : 400
                        }}
                      >
                        All ({previewRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setImportPreviewErrorFilter('valid'); setImportPreviewPage(1); }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: importPreviewErrorFilter === 'valid' ? 'var(--bg-card, #ffffff)' : 'transparent',
                          color: importPreviewErrorFilter === 'valid' ? '#10b981' : 'var(--text-secondary, #64748b)',
                          boxShadow: importPreviewErrorFilter === 'valid' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                          fontWeight: importPreviewErrorFilter === 'valid' ? 600 : 400
                        }}
                      >
                        Valid ({studentValidCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setImportPreviewErrorFilter('errors'); setImportPreviewPage(1); }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: importPreviewErrorFilter === 'errors' ? 'var(--bg-card, #ffffff)' : 'transparent',
                          color: importPreviewErrorFilter === 'errors' ? '#ef4444' : 'var(--text-secondary, #64748b)',
                          boxShadow: importPreviewErrorFilter === 'errors' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                          fontWeight: importPreviewErrorFilter === 'errors' ? 600 : 400
                        }}
                      >
                        ⚠ Errors ({studentErrorCount})
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Search inside preview */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} style={{ position: 'absolute', left: 8, color: '#94a3b8', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Search preview..."
                      value={importPreviewSearch}
                      onChange={(e) => { setImportPreviewSearch(e.target.value); setImportPreviewPage(1); }}
                      style={{
                        padding: '5px 26px 5px 28px',
                        fontSize: 12.5,
                        border: '1px solid var(--border, #cbd5e1)',
                        borderRadius: 6,
                        width: 180,
                        background: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #0f172a)'
                      }}
                    />
                    {importPreviewSearch && (
                      <button
                        type="button"
                        onClick={() => { setImportPreviewSearch(''); setImportPreviewPage(1); }}
                        style={{
                          position: 'absolute',
                          right: 6,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                          color: '#94a3b8'
                        }}
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Rows per page selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary, #475569)' }}>
                    <span>Rows per page:</span>
                    <select
                      value={importPreviewPageSize}
                      onChange={(e) => { setImportPreviewPageSize(Number(e.target.value)); setImportPreviewPage(1); }}
                      style={{
                        padding: '4px 8px',
                        fontSize: 12.5,
                        borderRadius: 6,
                        border: '1px solid var(--border, #cbd5e1)',
                        background: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #1e293b)',
                        cursor: 'pointer'
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25 (Default)</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                      <option value={500}>500</option>
                      <option value={100000}>All ({previewRows.length})</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => { setPreviewRows([]); setImportErrors([]); setImportPreviewPage(1); setImportPreviewSearch(''); setImportStep(2); }}
                  >
                    Re-upload
                  </button>
                </div>
              </div>

              {/* ── PREVIEW TABLE ── */}
              <div className="preview-table-container" style={{ flex: 1, minHeight: 320, overflow: 'auto' }}>
                <table style={{ width: '100%', minWidth: 1400, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 44, textAlign: 'center' }}>#</th>
                      <th style={{ minWidth: 120 }}>First Name</th>
                      <th style={{ minWidth: 120 }}>Middle Name</th>
                      <th style={{ minWidth: 120 }}>Last Name</th>
                      <th style={{ minWidth: 150 }}>Full Name</th>
                      <th style={{ minWidth: 120 }}>Adm. No.</th>
                      <th style={{ minWidth: 110 }}>Adm. Date</th>
                      <th style={{ minWidth: 90 }}>Roll No</th>
                      <th style={{ minWidth: 110 }}>Session</th>
                      <th style={{ minWidth: 90 }}>Class</th>
                      <th style={{ minWidth: 80 }}>Section</th>
                      <th style={{ minWidth: 110 }}>Date of Birth</th>
                      <th style={{ minWidth: 90 }}>Gender</th>
                      <th style={{ minWidth: 160 }}>Father Details</th>
                      <th style={{ minWidth: 160 }}>Mother Details</th>
                      <th style={{ minWidth: 140 }}>Guardian Name</th>
                      <th style={{ minWidth: 160 }}>Student Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedStudentPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={17} style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
                          No students match the current search or error filter.
                        </td>
                      </tr>
                    ) : (
                      displayedStudentPreviewRows.map((r, i) => {
                        const rowNum = r._origRowIndex || (studentStartIdx + i + 1);
                        return (
                          <tr key={studentStartIdx + i} className={r._errors?.length ? 'preview-row-error' : ''} style={{ background: r._errors?.length ? 'rgba(239, 68, 68, 0.12)' : undefined, outline: r._errors?.length ? '1px solid rgba(239, 68, 68, 0.35)' : undefined }}>
                            <td style={{ color: r._errors?.length ? '#dc2626' : '#94a3b8', fontSize: 11, textAlign: 'center', fontWeight: r._errors?.length ? 700 : 500 }}>
                              {r._errors?.length ? `⚠ ${rowNum}` : rowNum}
                            </td>
                            <td style={{ color: r._errors?.some((e: any) => e.field === 'First Name') ? '#dc2626' : undefined }}>
                              {r.firstName || r.name?.split(' ')[0] || '—'}
                              {r._errors?.filter((e: any) => e.field === 'First Name').map((e: any, j: number) =>
                                <div key={j} style={{ fontSize: 10, color: '#dc2626' }}>{e.message}</div>
                              )}
                            </td>
                            <td>
                              {r.middleName || r.middle_name || '—'}
                            </td>
                            <td style={{ color: r._errors?.some((e: any) => e.field === 'Last Name') ? '#dc2626' : undefined }}>
                              {r.lastName || r.name?.split(' ').slice(1).join(' ') || '—'}
                              {r._errors?.filter((e: any) => e.field === 'Last Name').map((e: any, j: number) =>
                                <div key={j} style={{ fontSize: 10, color: '#dc2626' }}>{e.message}</div>
                              )}
                            </td>
                            <td><b>{r.name}</b></td>
                            <td style={{ color: r._errors?.some((e: any) => e.field === 'Admission Number') ? '#dc2626' : undefined }}>
                              {r.admissionNumber || '—'}
                              {r._errors?.filter((e: any) => e.field === 'Admission Number').map((e: any, j: number) =>
                                <div key={j} style={{ fontSize: 10, color: '#dc2626' }}>{e.message}</div>
                              )}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {r.admissionDate || r.admission_date || '—'}
                            </td>
                            <td style={{ color: r._errors?.some((e: any) => e.field === 'Roll Number') ? '#dc2626' : undefined }}>
                              <span className="roll">{r.rollNumber}</span>
                            </td>
                            <td><span style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#3b82f6', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>{r.session || importSession}</span></td>
                            <td>{r.classLabel || r.classNumber}</td>
                            <td>{r.sectionName}</td>
                            <td style={{ color: r._errors?.some((e: any) => e.field === 'Date of Birth') ? '#dc2626' : undefined, fontSize: 12 }}>
                              {r.dob ? toDdMmYyyy(r.dob) : '—'}
                              {r._errors?.filter((e: any) => e.field === 'Date of Birth').map((e: any, j: number) =>
                                <div key={j} style={{ fontSize: 10, color: '#dc2626' }}>{e.message}</div>
                              )}
                            </td>
                            <td>
                              {r.gender ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  background: formatGender(r.gender) === 'Female' ? 'rgba(236, 72, 153, 0.12)' : formatGender(r.gender) === 'Male' ? 'rgba(2, 132, 199, 0.12)' : 'var(--card-subtle)',
                                  color: formatGender(r.gender) === 'Female' ? '#ec4899' : formatGender(r.gender) === 'Male' ? '#38bdf8' : 'var(--text-secondary, #64748b)',
                                  border: `1px solid ${formatGender(r.gender) === 'Female' ? 'rgba(236, 72, 153, 0.25)' : formatGender(r.gender) === 'Male' ? 'rgba(2, 132, 199, 0.25)' : 'var(--border)'}`
                                }}>
                                  {formatGender(r.gender)}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ fontSize: 12, color: r._errors?.some((e: any) => e.field === 'Father Contact No') ? '#dc2626' : undefined }}>
                              <div><b>{r.fatherName || '—'}</b></div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{r.fatherPhone || r.parentPhone || ''}</div>
                              {r.fatherOccupation && <div style={{ fontSize: 10, color: '#94a3b8' }}>{r.fatherOccupation}</div>}
                              {r._errors?.filter((e: any) => e.field === 'Father Contact No').map((e: any, j: number) =>
                                <div key={j} style={{ fontSize: 10, color: '#dc2626' }}>{e.message}</div>
                              )}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              <div><b>{r.motherName || '—'}</b></div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{r.motherPhone || ''}</div>
                              {r.motherOccupation && <div style={{ fontSize: 10, color: '#94a3b8' }}>{r.motherOccupation}</div>}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              <div><b>{r.guardianName || r.guardian_name || '—'}</b></div>
                            </td>
                            <td style={{ fontSize: 12 }}>{r.studentEmail || '—'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── PAGINATION BAR ── */}
              <div className="preview-pagination-bar">
                <div style={{ color: 'var(--text-secondary, #475569)', fontSize: 12.5 }}>
                  {filteredStudentPreviewRows.length === 0 ? (
                    'Showing 0 records'
                  ) : (
                    <>
                      Showing <b>{studentStartIdx + 1}</b> to <b>{studentEndIdx}</b> of <b>{filteredStudentPreviewRows.length}</b> records
                      {filteredStudentPreviewRows.length !== previewRows.length && (
                        <span style={{ opacity: 0.75, marginLeft: 4 }}>(filtered from {previewRows.length} total)</span>
                      )}
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    disabled={currentStudentImportPage <= 1}
                    onClick={() => setImportPreviewPage(1)}
                    title="First Page"
                  >
                    <ChevronsLeft size={14} /> First
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    disabled={currentStudentImportPage <= 1}
                    onClick={() => setImportPreviewPage(p => Math.max(1, p - 1))}
                    title="Previous Page"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px', fontSize: 12.5 }}>
                    <span>Page</span>
                    <select
                      value={currentStudentImportPage}
                      onChange={(e) => setImportPreviewPage(Number(e.target.value))}
                      style={{
                        padding: '3px 6px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid var(--border, #cbd5e1)',
                        background: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #1e293b)',
                        cursor: 'pointer'
                      }}
                    >
                      {Array.from({ length: totalStudentImportPages }, (_, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {idx + 1}
                        </option>
                      ))}
                    </select>
                    <span>of <b>{totalStudentImportPages}</b></span>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    disabled={currentStudentImportPage >= totalStudentImportPages}
                    onClick={() => setImportPreviewPage(p => Math.min(totalStudentImportPages, p + 1))}
                    title="Next Page"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    disabled={currentStudentImportPage >= totalStudentImportPages}
                    onClick={() => setImportPreviewPage(totalStudentImportPages)}
                    title="Last Page"
                  >
                    Last <ChevronsRight size={14} />
                  </button>
                </div>
              </div>

              {/* ── LIVE UPLOAD & BATCH PROGRESS DISPLAY ── */}
              {importing && importProgress && (
                <div style={{
                  marginTop: 12,
                  marginBottom: 6,
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.06))',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 10
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #0f172a)' }}>
                        Uploading & Processing Batch {importProgress.batch} of {importProgress.totalBatches} ({importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()} students)
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                      {formatBytes(importProgress.uploadedBytes)} / {formatBytes(importProgress.totalBytes)} ({importProgress.percent}%)
                    </span>
                  </div>
                  {/* Progress bar track & filler */}
                  <div style={{ width: '100%', height: 10, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${importProgress.percent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981, #059669)',
                        borderRadius: 999,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: '#64748b' }}>
                    <span>File: {importFileMeta?.name || 'Bulk Student Import'}</span>
                    <span>{importProgress.percent}% Uploaded</span>
                  </div>
                </div>
              )}

              {/* ── MODAL FOOTER ── */}
              <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <button type="button" className="btn-secondary" disabled={importing} onClick={() => { setImportStep(2); setPreviewRows([]); setImportErrors([]); setImportPreviewPage(1); }}>← Back</button>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" className="btn-secondary" disabled={importing} onClick={() => { setImportOpen(false); setPreviewRows([]); setImportErrors([]); setImportPreviewPage(1); setImportStep(1); }}>Cancel</button>
                  <button
                    type="button"
                    onClick={submitBulkImport}
                    disabled={importing}
                    style={{ background: '#10b981', color: '#ffffff', fontWeight: 600, padding: '8px 20px', minWidth: 220 }}
                  >
                    {importing
                      ? (importProgress
                        ? `Uploading: ${importProgress.percent}% (${formatBytes(importProgress.uploadedBytes)} / ${formatBytes(importProgress.totalBytes)})`
                        : 'Importing Students...')
                      : `Confirm & Import ${studentValidCount} Valid Students`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    )}

    {/* Universal Student Preview & Edit Modal */}
    <UniversalPreviewModal
      isOpen={studentPreview.isOpen}
      onClose={() => setStudentPreview(prev => ({ ...prev, isOpen: false }))}
      onEdit={() => setStudentPreview(prev => ({ ...prev, isOpen: false }))}
      onConfirm={executeConfirmStudentSave}
      title={studentPreview.title}
      subtitle={studentPreview.subtitle}
      operationType={studentPreview.operationType}
      confirmText={studentPreview.confirmText}
      editText="Back to Edit"
      sections={studentPreview.sections}
      changes={studentPreview.changes}
      summaryCards={studentPreview.summaryCards}
      loading={studentPreview.loading}
      error={studentPreview.error}
    />

    {/* Destructive Confirm Modal for Single / Bulk Student Delete */}
    <DestructiveConfirmModal
      isOpen={deleteDialog.isOpen}
      onClose={() => setDeleteDialog(prev => ({ ...prev, isOpen: false }))}
      onConfirm={executeConfirmDelete}
      title={deleteDialog.isBulk ? "Confirm Bulk Student Deletion" : "Confirm Student Deletion"}
      entityName={deleteDialog.entityName}
      entityType={deleteDialog.entityType}
      details={deleteDialog.details}
      warningMessage={deleteDialog.warningMessage}
      confirmText={deleteDialog.confirmText}
      loading={deleteDialog.loading}
      error={deleteDialog.error}
    />

    {/* ═══ STUDENT EXPORT PREVIEW MODAL ═══ */}
    {exportOpen && (
      <Modal title="Export Student Directory (Preview)" close={() => setExportOpen(false)}>
        <div style={{ padding: '4px 2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {selectedIds.size > 0
                  ? `Exporting ${selectedIds.size} manually selected student record${selectedIds.size > 1 ? 's' : ''}`
                  : `Exporting ${prepareStudentExportData().length} student record${prepareStudentExportData().length !== 1 ? 's' : ''} matching current filters`}
              </div>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>
                {selectedIds.size > 0
                  ? 'Manual selection active across student directory.'
                  : `Filters: Class [${classFilter || 'All'}], Section [${sectionFilter || 'All'}], Gender [${genderFilter || 'All'}], Session [${activeSession || 'Current'}]${search ? `, Search ["${search}"]` : ''}`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleExportStudentsExcel}
                disabled={prepareStudentExportData().length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: prepareStudentExportData().length === 0 ? '#94a3b8' : '#10b981',
                  color: '#ffffff',
                  cursor: prepareStudentExportData().length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <FileSpreadsheet size={15} /> Download Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={handleExportStudentsCSV}
                disabled={prepareStudentExportData().length === 0}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: prepareStudentExportData().length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <Download size={15} /> Download CSV (.csv)
              </button>
            </div>
          </div>

          <div className="preview-table-container" style={{ maxHeight: 380, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Admission No</th>
                  <th>Admission Date</th>
                  <th>First Name</th>
                  <th>Middle Name</th>
                  <th>Last Name</th>
                  <th>Full Name</th>
                  <th>Gender</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Date of Birth</th>
                  <th>Parent WhatsApp</th>
                  <th>Father Name</th>
                  <th>Mother Name</th>
                  <th>Guardian Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {prepareStudentExportData().slice(0, 15).map((r, i) => (
                  <tr key={i}>
                    <td><code>{r['Roll Number'] || '—'}</code></td>
                    <td><code>{r['Admission Number'] || '—'}</code></td>
                    <td>{r['Admission Date'] || '—'}</td>
                    <td>{r['First Name'] || '—'}</td>
                    <td>{r['Middle Name'] || '—'}</td>
                    <td>{r['Last Name'] || '—'}</td>
                    <td><b>{r['Full Name'] || `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim()}</b></td>
                    <td>
                      {r['Gender'] ? (
                        <span className={`badge ${String(r['Gender']).toLowerCase() === 'female' ? 'role-teacher' : 'role-admin'}`} style={{ fontSize: 11 }}>
                          {r['Gender']}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{r['Class'] || '—'}</td>
                    <td>{r['Section'] || '—'}</td>
                    <td>{r['Date of Birth'] ? <code>{r['Date of Birth']}</code> : '—'}</td>
                    <td>{r['Parent WhatsApp No'] ? <code>{r['Parent WhatsApp No']}</code> : '—'}</td>
                    <td>{r['Father Name'] || '—'}</td>
                    <td>{r['Mother Name'] || '—'}</td>
                    <td>{r['Guardian Name'] || '—'}</td>
                    <td><span className="badge active">{r['Status']}</span></td>
                  </tr>
                ))}
                {prepareStudentExportData().length === 0 && (
                  <tr>
                    <td colSpan={16} style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                      No student records match the selected filters or manual selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {prepareStudentExportData().length > 15 && (
            <p className="muted" style={{ fontSize: 11, margin: '8px 0 0', textAlign: 'center' }}>
              Showing first 15 of {prepareStudentExportData().length} student records in preview. Full dataset will be included in the exported file.
            </p>
          )}
        </div>
      </Modal>
    )}
  </Layout>
}

/* ────── Teacher DOB Validation & Formatting Helpers ────── */
function isValidDdMmYyyy(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const match = val.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return false;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1000 || year > 9999) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function formatDdMmYyyyInput(inputVal: string, prevVal: string): string {
  if (inputVal.length < prevVal.length) {
    return inputVal;
  }

  const rawDigits = inputVal.replace(/\D/g, '').slice(0, 8);
  if (!rawDigits) return '';

  let dayStr = '';
  let monthStr = '';
  let yearStr = '';

  // 1. Day segment (Max 31)
  if (rawDigits.length >= 2) {
    let dayNum = parseInt(rawDigits.slice(0, 2), 10);
    if (dayNum > 31) dayNum = 31;
    dayStr = String(dayNum).padStart(2, '0');
  } else {
    return rawDigits;
  }

  const monthDigits = rawDigits.slice(2);
  if (!monthDigits) {
    return dayStr;
  }

  // 2. Month segment (Max 12)
  if (monthDigits.length >= 2) {
    let monthNum = parseInt(monthDigits.slice(0, 2), 10);
    if (monthNum > 12) monthNum = 12;
    monthStr = String(monthNum).padStart(2, '0');
  } else {
    return `${dayStr}-${monthDigits}`;
  }

  const yearDigits = monthDigits.slice(2);
  if (!yearDigits) {
    return `${dayStr}-${monthStr}`;
  }

  // 3. Year segment (Max 4 digits)
  yearStr = yearDigits.slice(0, 4);
  return `${dayStr}-${monthStr}-${yearStr}`;
}

function toDdMmYyyy(val: any): string {
  if (!val) return '';
  if (typeof val === 'number' || (/^\d{4,5}$/.test(String(val).trim()) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (!isNaN(num) && num > 1000 && num < 60000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const d = String(date.getUTCDate()).padStart(2, '0');
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const y = String(date.getUTCFullYear());
        return `${d}-${m}-${y}`;
      }
    }
  }
  const s = String(val).trim();
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}-${dmy[3]}`;
  }
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    return `${ymd[3].padStart(2, '0')}-${ymd[2].padStart(2, '0')}-${ymd[1]}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = String(dt.getFullYear());
    return `${d}-${m}-${y}`;
  }
  return s;
}

/* ────── Teachers ────── */
function Teachers() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem('attendo_teachers_last_fetched');
      return saved ? new Date(saved) : null;
    } catch {
      return null;
    }
  });
  const [, setTimeTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTimeTick(t => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [addTeacherPreview, setAddTeacherPreview] = useState(false);
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [importPreviewErrorFilter, setImportPreviewErrorFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const [importing, setImporting] = useState(false);
  const [importPreviewPage, setImportPreviewPage] = useState(1);
  const [importPreviewPageSize, setImportPreviewPageSize] = useState<number>(25);
  const [importPreviewSearch, setImportPreviewSearch] = useState('');
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryPageSize, setDirectoryPageSize] = useState<number>(25);
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string; resetUrl?: string } | null>(null);

  const lastRegisteredTeacherInfo = useMemo(() => {
    try {
      const stored = localStorage.getItem('attendo_last_registered_teacher');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.name) return parsed;
      }
    } catch { }

    if (!rows || rows.length === 0) return null;

    const withTime = rows.filter(r => r.created_at || r.createdAt);
    if (withTime.length > 0) {
      const latest = [...withTime].sort((a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime())[0];
      return {
        name: latest.name || `${latest.first_name || ''} ${latest.last_name || ''}`.trim() || 'Teacher',
        employeeId: latest.employee_id || latest.savior_no || latest.Savior_No || latest.employeeId || '—'
      };
    }

    const candidate = rows[0];
    return {
      name: candidate.name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Teacher',
      employeeId: candidate.employee_id || candidate.savior_no || candidate.Savior_No || candidate.employeeId || '—'
    };
  }, [rows]);

  const directoryTopRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const isInitialDirectoryMount = useRef(true);

  const scrollToDirectoryTop = useCallback(() => {
    setTimeout(() => {
      if (tableBodyRef.current) {
        try {
          tableBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          tableBodyRef.current.scrollTop = 0;
        }
      }
      if (directoryTopRef.current) {
        try {
          directoryTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch {
          // ignore
        }
      }
    }, 10);
  }, []);

  useEffect(() => {
    if (isInitialDirectoryMount.current) {
      isInitialDirectoryMount.current = false;
      return;
    }
    scrollToDirectoryTop();
  }, [directoryPage, scrollToDirectoryTop]);
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);

  // Universal Preview State for Teacher Add/Edit
  const [teacherPreview, setTeacherPreview] = useState<{
    isOpen: boolean;
    operationType: 'create' | 'update';
    title: string;
    subtitle?: string;
    confirmText: string;
    sections: PreviewSectionData[];
    changes?: PreviewChangeData[];
    summaryCards?: PreviewSummaryCard[];
    payload?: any;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    operationType: 'create',
    title: '',
    confirmText: 'Confirm & Save',
    sections: [],
    loading: false,
    error: null,
  });

  // Teaching Allocations Preview State
  const [allocPreview, setAllocPreview] = useState<{
    isOpen: boolean;
    tableData?: PreviewTableData;
    validRows?: any[];
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    loading: false,
    error: null,
  });

  // Destructive Delete State for Teachers
  const [deleteTeacherDialog, setDeleteTeacherDialog] = useState<{
    isOpen: boolean;
    teacherId?: string;
    isBulk?: boolean;
    entityName: string;
    entityType: string;
    details: { label: string; value: string | number }[];
    warningMessage: string;
    confirmText: string;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    entityName: '',
    entityType: 'Faculty Account',
    details: [],
    warningMessage: '',
    confirmText: 'Delete Faculty',
    loading: false,
    error: null,
  });

  // Teaching allocations state
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocTeacher, setAllocTeacher] = useState<any>(null);
  const [allocRows, setAllocRows] = useState<any[]>([]);
  const [allocSaving, setAllocSaving] = useState(false);
  const [allocSubjects, setAllocSubjects] = useState<any[]>([]);
  const [allocClasses, setAllocClasses] = useState<any[]>([]);
  const [allocSections, setAllocSections] = useState<any[]>([]);
  const [allocSessions, setAllocSessions] = useState<any[]>([]);
  const [allocDesignations, setAllocDesignations] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    setLoadProgress(15);
    const progressTimer = setInterval(() => {
      setLoadProgress(prev => {
        if (prev >= 88) return prev;
        const jump = Math.floor(Math.random() * 12) + 8;
        return Math.min(88, prev + jump);
      });
    }, 120);

    try {
      const [tRes, aRes, subRes, clsRes, secRes, desigRes] = await Promise.all([
        api.get('/teachers'),
        api.get('/teacher-assignments').catch(() => ({ data: [] })),
        api.get('/subjects').catch(() => ({ data: [] })),
        api.get('/classes').catch(() => ({ data: [] })),
        api.get('/sections').catch(() => ({ data: [] })),
        api.get('/designations').catch(() => ({ data: [] }))
      ]);
      setLoadProgress(95);
      setRows(tRes.data || []);
      setAllAssignments(Array.isArray(aRes.data) ? aRes.data : []);
      setAllocSubjects(Array.isArray(subRes.data) ? subRes.data : []);
      setAllocClasses(Array.isArray(clsRes.data) ? clsRes.data : []);
      setAllocSections(Array.isArray(secRes.data) ? secRes.data : []);
      setAllocDesignations(Array.isArray(desigRes.data) ? desigRes.data : (desigRes.data?.data || []));
      setLoadProgress(100);
      const now = new Date();
      setLastFetchedAt(now);
      try {
        localStorage.setItem('attendo_teachers_last_fetched', now.toISOString());
      } catch { }
    } catch (err) {
      console.error('Failed to load teachers:', err);
    } finally {
      clearInterval(progressTimer);
      setTimeout(() => {
        setLoading(false);
        setLoadProgress(0);
      }, 350);
    }
  }

  useEffect(() => {
    load();
    api.get('/dashboard/school').then(r => {
      if (r.data?.academicYears) setAllocSessions(r.data.academicYears);
    }).catch(() => { });
  }, []);

  // Open allocations modal for a specific teacher
  function openAllocModal(t: any) {
    setAllocTeacher(t);
    const existing = allAssignments.filter(a => a.teacher_id === t.id);
    setAllocRows(existing.length > 0 ? existing.map(a => ({ ...a })) : [{
      subject_id: '', subject_name: '', class_id: '', class_number: '', section_id: '', section_name: '',
      session_id: '', session_name: '', alt_teacher_id: '', alt_teacher_name: ''
    }]);
    setAllocOpen(true);
  }

  function addAllocRow() {
    setAllocRows(prev => [...prev, { subject_id: '', class_id: '', section_id: '', session_id: '', alt_teacher_id: '' }]);
  }
  function removeAllocRow(idx: number) {
    setAllocRows(prev => prev.filter((_, i) => i !== idx));
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

  function handleInitiateAllocSave() {
    if (!allocTeacher) return;
    const validRows = allocRows.filter(r => r.subject_id && r.class_id);
    if (validRows.length === 0) {
      alert('Validation Error: Please configure at least one valid Subject and Class assignment.');
      return;
    }

    const headers = ['Subject', 'Class', 'Section', 'Session', 'Alt / Substitute Faculty'];
    const tableRows = validRows.map(r => [
      r.subject_name || allocSubjects.find(s => s.id === r.subject_id)?.name || '—',
      `Class ${r.class_number || allocClasses.find(c => c.id === r.class_id)?.class_number || '—'}`,
      `Section ${r.section_name || allocSections.find(s => s.id === r.section_id)?.name || 'All'}`,
      r.session_name || allocSessions.find(s => s.id === r.session_id)?.name || 'Default Session',
      r.alt_teacher_name || rows.find(t => t.id === r.alt_teacher_id)?.name || 'None'
    ]);

    setAllocPreview({
      isOpen: true,
      validRows,
      tableData: { headers, rows: tableRows },
      loading: false,
      error: null,
    });
  }

  async function executeConfirmAllocSave() {
    if (!allocTeacher || !allocPreview.validRows) return;
    setAllocPreview(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.put(`/teachers/${allocTeacher.id}/assignments`, { assignments: allocPreview.validRows });
      setToastNotice({ type: 'success', message: `Allocations updated for ${allocTeacher.name}.` });
      setAllocPreview(prev => ({ ...prev, isOpen: false, loading: false }));
      setAllocOpen(false);
      load();
    } catch (err: any) {
      setAllocPreview(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || 'Failed to save allocations'
      }));
    }
  }

  // Get allocation summary for a teacher (for table display)
  function getTeacherAllocSummary(teacherOrId: any): string {
    const tid = typeof teacherOrId === 'object' ? teacherOrId?.id : teacherOrId;
    const teacherObj = typeof teacherOrId === 'object' ? teacherOrId : rows.find(r => r.id === tid);

    // 0. Check mentor_allocations / allocationsSummary / assigned_classes
    if (teacherObj?.mentor_allocations || teacherObj?.allocationsSummary) {
      return convertRomanClassToDigital(teacherObj.mentor_allocations || teacherObj.allocationsSummary);
    }

    // 1. Check direct allocations in allAssignments
    const allocs = allAssignments.filter(a => a.teacher_id === tid);
    if (allocs.length > 0) {
      return allocs.map(a => {
        let clsNum = a.class_number !== undefined && a.class_number !== null ? String(a.class_number).trim() : '';
        if (clsNum === '-1') clsNum = 'Class L KG';
        else if (clsNum === '0') clsNum = 'Class U KG';
        else if (clsNum && !clsNum.toLowerCase().startsWith('class')) clsNum = `Class ${clsNum}`;
        const sec = a.section_name ? `-${String(a.section_name).trim().toUpperCase()}` : '';
        const classSec = `${clsNum}${sec}`.trim();
        return convertRomanClassToDigital(classSec) || '—';
      }).filter(Boolean).join(', ');
    }

    // 2. Check direct class_name / section_name on teacher profile (e.g. from Excel import)
    if (teacherObj?.class_name || teacherObj?.class) {
      let rawCls = String(teacherObj.class_name || teacherObj.class || '').trim();
      if (rawCls === '-1') rawCls = 'Class L KG';
      else if (rawCls === '0') rawCls = 'Class U KG';
      else if (rawCls && !rawCls.toLowerCase().startsWith('class')) rawCls = `Class ${rawCls}`;
      const sec = (teacherObj.section_name || teacherObj.section) ? `-${String(teacherObj.section_name || teacherObj.section).trim().toUpperCase()}` : '';
      return convertRomanClassToDigital(`${rawCls}${sec}`);
    }

    if (teacherObj?.assigned_classes || teacherObj?.assigned_class) {
      return convertRomanClassToDigital(teacherObj.assigned_classes || teacherObj.assigned_class);
    }

    if (teacherObj?.assignedClass !== undefined && teacherObj?.assignedClass !== null) {
      let rawCls = String(teacherObj.assignedClass).trim();
      if (rawCls === '-1') rawCls = 'Class L KG';
      else if (rawCls === '0') rawCls = 'Class U KG';
      else if (rawCls && !rawCls.toLowerCase().startsWith('class')) rawCls = `Class ${rawCls}`;
      const sec = teacherObj.assignedSection ? `-${String(teacherObj.assignedSection).trim().toUpperCase()}` : '';
      return convertRomanClassToDigital(`${rawCls}${sec}`);
    }

    return '—';
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

  function prepareExportData(): any[] {
    const list = selectedIds.size > 0 ? rows.filter(r => selectedIds.has(r.id)) : filtered;
    return list.map(r => {
      let fn = r.first_name || r.firstName || '';
      let mn = r.middle_name || r.middleName || '';
      let ln = r.last_name || r.lastName || '';
      if (!fn && !ln && r.name) {
        const parts = String(r.name).trim().split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          fn = parts[0] || '';
        } else if (parts.length === 2) {
          fn = parts[0] || '';
          ln = parts[1] || '';
        } else if (parts.length >= 3) {
          fn = parts[0] || '';
          mn = parts.slice(1, -1).join(' ') || '';
          ln = parts[parts.length - 1] || '';
        }
      }
      const fullName = (fn || mn || ln) ? formatTeacherFullName(fn, mn, ln) : String(r.name || '').toUpperCase();
      const allocSummary = getTeacherAllocSummary(r.id);

      return {
        'Savior_No': r.savior_no || r.employee_id || r.Savior_No || '',
        'First Name': String(fn || '').toUpperCase(),
        'Middle Name': String(mn || '').toUpperCase(),
        'Last Name': String(ln || '').toUpperCase(),
        'Full Name(Automatically generated)': fullName,
        'Email_id': r.email || '',
        'Gender': r.gender || '',
        'Joining_Date': toDdMmYyyy(r.joining_date || r.joiningDate),
        'Class': allocSummary !== '—' ? allocSummary : '',
        'Section': '',
        'Status': r.is_active !== false ? 'Active' : 'Inactive',
        'Designation': r.designation || 'Teacher',
        'Mobile': r.mobile || r.phone || ''
      };
    });
  }

  function handleExportExcel() {
    const data = prepareExportData();
    if (!data.length) {
      alert('No faculty records found to export for current selection/filters.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [16, 14, 14, 14, 26, 26, 12, 16, 14, 10, 12, 20, 16].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faculty');
    const filterDesc = selectedIds.size > 0
      ? `Selected_${selectedIds.size}`
      : ([genderFilter && `Gender_${genderFilter}`, designationFilter && `Designation_${designationFilter}`].filter(Boolean).join('_') || 'All');
    XLSX.writeFile(wb, `Faculty_Export_${filterDesc}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExportCSV() {
    const data = prepareExportData();
    if (!data.length) {
      alert('No faculty records found to export for current selection/filters.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const filterDesc = selectedIds.size > 0
      ? `Selected_${selectedIds.size}`
      : ([genderFilter && `Gender_${genderFilter}`, designationFilter && `Designation_${designationFilter}`].filter(Boolean).join('_') || 'All');
    link.setAttribute('download', `Faculty_Export_${filterDesc}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleInitiateTeacherSave(e: React.FormEvent) {
    if (e && e.preventDefault) e.preventDefault();
    // STAGE 1 VALIDATION
    const firstName = String(f.firstName || '').trim().toUpperCase();
    const middleName = String(f.middleName || '').trim().toUpperCase();
    const lastName = String(f.lastName || '').trim().toUpperCase();
    const fullName = formatTeacherFullName(firstName, middleName, lastName) || String(f.name || '').trim().toUpperCase();
    const name = fullName;
    const email = String(f.email || '').trim().toLowerCase();
    const employeeId = String(f.employeeId || f.saviorNo || f.employee_id || '').trim();

    if (!firstName) {
      alert('Validation Error: Please enter faculty member first name.');
      return;
    }
    if (firstName.length < 3 || firstName.length > 15) {
      alert('Validation Error: First Name must be between 3 and 15 characters.');
      return;
    }
    if (/\s/.test(firstName)) {
      alert('Validation Error: Spaces are not allowed in First Name.');
      return;
    }
    if (/\d/.test(firstName)) {
      alert('Validation Error: Enter a string not a number in First Name.');
      return;
    }
    if (middleName && /\d/.test(middleName)) {
      alert('Validation Error: Enter a string not a number in Middle Name.');
      return;
    }
    if (!lastName) {
      alert('Validation Error: Please enter faculty member last name.');
      return;
    }
    if (lastName.length < 3 || lastName.length > 15) {
      alert('Validation Error: Last Name must be between 3 and 15 characters.');
      return;
    }
    if (/\d/.test(lastName)) {
      alert('Validation Error: Enter a string not a number in Last Name.');
      return;
    }
    if (!email) {
      alert('Validation Error: Please enter registered email address.');
      return;
    }
    const EMAIL_VALIDATION_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!EMAIL_VALIDATION_REGEX.test(email)) {
      alert('Validation Error: Please enter a valid email address (e.g. teacher@school.edu).');
      return;
    }
    const dupEmail = rows.find(r => (!editingTeacher || r.id !== editingTeacher.id) && String(r.email || '').trim().toLowerCase() === email);
    if (dupEmail) {
      alert(`Validation Error: Teacher email already exists. Email '${email}' is already registered to teacher '${dupEmail.name || 'Existing Teacher'}'.`);
      return;
    }
    if (!employeeId) {
      alert('Validation Error: Please enter Employee ID / Savior_No.');
      return;
    }
    const joiningDateVal = f.joiningDate || f.joining_date;
    if (!joiningDateVal) {
      alert('Validation Error: Joining Date is a required field.');
      return;
    }
    if (!isValidDdMmYyyy(joiningDateVal)) {
      alert('Validation Error: Joining Date must follow DD-MM-YYYY format (e.g. 01-07-2022).');
      return;
    }
    if (!f.designation || !String(f.designation).trim()) {
      alert('Validation Error: Designation is a required field. Please select or enter a designation.');
      return;
    }
    const cleanMobile = String(f.mobile || '').replace(/\D/g, '');
    if (!cleanMobile) {
      alert('Validation Error: Mobile Number is a required field.');
      return;
    }
    if (cleanMobile.length < 10) {
      alert('Validation Error: Mobile Number must be a valid 10-digit number.');
      return;
    }

    const assignedClassSecText = (f.class_name || f.class)
      ? `${f.class_name || f.class}${f.section_name || f.section ? ` - Section ${f.section_name || f.section}` : ''}`
      : 'Not assigned';

    const payload = {
      ...f,
      firstName,
      middleName,
      middle_name: middleName,
      lastName,
      name,
      fullName,
      email,
      employeeId,
      saviorNo: employeeId,
      employee_id: employeeId,
      mobile: f.mobile || '',
      gender: f.gender || '',
      joining_date: joiningDateVal ? toDdMmYyyy(joiningDateVal) : '',
      joiningDate: joiningDateVal ? toDdMmYyyy(joiningDateVal) : '',
      designation: f.designation || 'Teacher',
      class_id: f.class_id || '',
      class_name: f.class_name || f.class || '',
      class: f.class_name || f.class || '',
      section_id: f.section_id || '',
      section_name: f.section_name || f.section || '',
      section: f.section_name || f.section || '',
      is_active: f.is_active !== false,
      status: f.is_active !== false ? 'ACTIVE' : 'INACTIVE',
      ...(f.password && f.password.trim() ? { password: f.password.trim() } : {}),
      sendInviteEmail: f.sendInviteEmail !== false
    };

    const previewSections: PreviewSectionData[] = [
      {
        title: 'Faculty Profile Details',
        fields: [
          { label: 'Full Name', value: name, color: 'blue' },
          { label: 'First Name', value: firstName },
          ...(middleName ? [{ label: 'Middle Name', value: middleName }] : []),
          { label: 'Last Name', value: lastName || '—' },
          { label: 'Employee ID / Savior_No', value: employeeId, type: 'code' },
          { label: 'Gender', value: f.gender || 'Not specified' },
          { label: 'Joining Date', value: f.joiningDate || f.joining_date || 'Not specified' },
          { label: 'Designation', value: f.designation || 'Teacher' },
          { label: 'Assigned Class & Section', value: assignedClassSecText, color: (f.class_name || f.class) ? 'purple' : 'slate' },
          { label: 'Mobile Number', value: f.mobile || '—', type: 'phone' },
          { label: 'Account Status', value: f.is_active !== false ? 'ACTIVE' : 'INACTIVE', type: 'badge', color: f.is_active !== false ? 'green' : 'slate' },
        ]
      },
      {
        title: 'Security & Portal Access',
        fields: [
          { label: 'Registered Email', value: email, type: 'email' },
          { label: 'Password Setup', value: editingTeacher ? (f.password ? 'Custom password specified' : 'Retain existing password') : (f.password ? 'Initial password set' : 'Auto-generated setup invite email dispatched'), type: 'pill', color: 'purple' },
        ]
      }
    ];

    const summaryCards: PreviewSummaryCard[] = [
      { label: 'Faculty Name', value: name, color: 'blue' },
      { label: 'Employee ID', value: employeeId, color: 'purple' },
      { label: 'Status', value: f.is_active !== false ? 'Active' : 'Inactive', color: f.is_active !== false ? 'green' : 'amber' },
    ];

    const changes = editingTeacher ? calculateChanges(
      editingTeacher,
      {
        name,
        email,
        employee_id: employeeId,
        gender: f.gender || '',
        joining_date: (f.joiningDate || f.joining_date) ? toDdMmYyyy(f.joiningDate || f.joining_date) : (editingTeacher.joining_date || editingTeacher.joiningDate || ''),
        mobile: f.mobile || '',
        designation: f.designation || 'Teacher',
        class_name: f.class_name || f.class || '',
        section_name: f.section_name || f.section || '',
        is_active: f.is_active !== false ? 'ACTIVE' : 'INACTIVE'
      },
      {
        name: 'Faculty Name',
        email: 'Email Address',
        employee_id: 'Employee ID',
        gender: 'Gender',
        joining_date: 'Joining Date',
        mobile: 'Mobile Number',
        designation: 'Designation',
        class_name: 'Assigned Class',
        section_name: 'Assigned Section',
        is_active: 'Status'
      }
    ) : [];

    setTeacherPreview({
      isOpen: true,
      operationType: editingTeacher ? 'update' : 'create',
      title: editingTeacher ? `Review Updates for ${name}` : `Review Registration for ${name}`,
      subtitle: editingTeacher ? 'Verify faculty changes before saving to database' : 'Verify faculty profile coordinates before onboarding',
      confirmText: editingTeacher ? 'Confirm & Update Faculty' : 'Confirm & Register Faculty',
      sections: previewSections,
      changes,
      summaryCards,
      payload,
      loading: false,
      error: null,
    });
  }

  async function executeConfirmTeacherSave() {
    if (!teacherPreview.payload) return;
    const payload = teacherPreview.payload;

    // STAGE 2 VALIDATION
    if (!payload.name || !payload.email || !payload.employeeId) {
      setTeacherPreview(prev => ({ ...prev, error: 'Validation error: Missing mandatory profile fields.' }));
      return;
    }

    setTeacherPreview(prev => ({ ...prev, loading: true, error: null }));
    try {
      if (editingTeacher) {
        const oldDesig = (editingTeacher.designation || '').trim();
        const newDesig = (payload.designation || '').trim();
        const isPromoted = Boolean(oldDesig && newDesig && oldDesig.toLowerCase() !== newDesig.toLowerCase());

        payload.previous_designation = oldDesig;
        payload.previousDesignation = oldDesig;

        const res = await api.put(`/teachers/${editingTeacher.id}`, payload);
        const updated = res.data;

        // If designation changed, also explicitly log via /designations/promote
        if (isPromoted) {
          try {
            await api.post('/designations/promote', {
              teacher_id: editingTeacher.id,
              previous_position: oldDesig,
              current_position: newDesig,
              promotion_date: new Date().toISOString().slice(0, 10),
              notes: `Promoted from ${oldDesig} to ${newDesig} via Faculty Directory edit`
            });
          } catch (promoErr) {
            console.warn('[Edit Teacher] Logged via teacher update:', promoErr);
          }
        }
        setRows(prev => prev.map(r => r.id === editingTeacher.id ? {
          ...r,
          ...updated,
          employee_id: payload.employeeId,
          savior_no: payload.employeeId,
          mobile: payload.mobile,
          gender: payload.gender || updated.gender,
          dob: payload.dob || updated.dob,
          date_of_birth: payload.dob || updated.dob,
          joining_date: payload.joining_date || updated.joining_date,
          joiningDate: payload.joiningDate || updated.joiningDate,
          designation: payload.designation || updated.designation,
          class_name: payload.class_name || updated.class_name,
          section_name: payload.section_name || updated.section_name,
          class: payload.class || updated.class,
          section: payload.section || updated.section,
          is_active: payload.is_active
        } : r));
        load();
        setToastNotice({
          type: 'success',
          message: `Faculty member ${payload.name} updated successfully.`
        });
      } else {
        const res = await api.post('/teachers', payload);
        const created = res.data;
        setRows(prev => [created, ...prev.filter(r => r.id !== created.id)]);
        load();
        try {
          localStorage.setItem('attendo_last_registered_teacher', JSON.stringify({
            name: created.name || payload.name,
            employeeId: created.employee_id || payload.employeeId || '—'
          }));
        } catch { }
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
      }
      setTeacherPreview(prev => ({ ...prev, isOpen: false, loading: false }));
      setOpen(false);
      setEditingTeacher(null);
      setF({});
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('dashboard_cache_')) localStorage.removeItem(k);
        }
      } catch { }
      window.dispatchEvent(new Event('dashboardShouldRefresh'));
      load();
    } catch (err: any) {
      setTeacherPreview(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Could not save faculty record.'
      }));
    }
  }

  function promptDeleteTeacher(teacher: any) {
    setDeleteTeacherDialog({
      isOpen: true,
      teacherId: teacher.id,
      isBulk: false,
      entityName: teacher.name,
      entityType: 'Faculty Account',
      details: [
        { label: 'Employee ID', value: teacher.employee_id || '—' },
        { label: 'Email', value: teacher.email || '—' },
        { label: 'Teaching Summary', value: getTeacherAllocSummary(teacher.id) },
      ],
      warningMessage: 'Deactivating and removing this faculty member will revoke their portal access and remove their routine allocations.',
      confirmText: 'Delete Faculty Account',
      loading: false,
      error: null,
    });
  }

  function promptBulkDeleteTeachers() {
    if (selectedIds.size === 0) return;
    setDeleteTeacherDialog({
      isOpen: true,
      isBulk: true,
      entityName: `${selectedIds.size} Selected Faculty`,
      entityType: 'Faculty Accounts',
      details: [
        { label: 'Total Selected', value: selectedIds.size }
      ],
      warningMessage: `Are you sure you want to delete these ${selectedIds.size} faculty accounts? Portal access will be terminated.`,
      confirmText: `Delete ${selectedIds.size} Faculty`,
      loading: false,
      error: null,
    });
  }

  async function executeConfirmDeleteTeacher() {
    setDeleteTeacherDialog(prev => ({ ...prev, loading: true, error: null }));
    try {
      if (deleteTeacherDialog.isBulk) {
        const ids = Array.from(selectedIds);
        await api.post('/teachers/bulk-delete', { ids });
        setRows(prev => prev.filter(r => !selectedIds.has(r.id)));
        setSelectedIds(new Set());
      } else if (deleteTeacherDialog.teacherId) {
        await api.delete(`/teachers/${deleteTeacherDialog.teacherId}`);
        setRows(prev => prev.filter(r => r.id !== deleteTeacherDialog.teacherId));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(deleteTeacherDialog.teacherId!);
          return next;
        });
      }
      setDeleteTeacherDialog(prev => ({ ...prev, isOpen: false, loading: false }));
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('dashboard_cache_')) localStorage.removeItem(k);
        }
      } catch { }
      window.dispatchEvent(new Event('dashboardShouldRefresh'));
    } catch (err: any) {
      setDeleteTeacherDialog(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || 'Failed to delete faculty member(s).'
      }));
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

  const availableDesignations = useMemo(() => {
    const set = new Set<string>();
    allocDesignations.forEach(d => {
      const val = (d.title || d.name || '').trim();
      if (val) set.add(val);
    });
    rows.forEach(r => {
      const val = (r.designation || '').trim();
      if (val) set.add(val);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allocDesignations, rows]);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchesSearch = !q || (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      String(r.employee_id || r.savior_no || '').toLowerCase().includes(q)
    );
    const g = formatGender(r.gender);
    const matchesGender = !genderFilter || g === genderFilter;
    const teacherDesig = (r.designation || 'Teacher').trim();
    const matchesDesignation = !designationFilter || teacherDesig.toLowerCase() === designationFilter.toLowerCase();
    return matchesSearch && matchesGender && matchesDesignation;
  });

  useEffect(() => {
    setDirectoryPage(1);
  }, [search, genderFilter, designationFilter]);

  const totalDirectoryPages = Math.max(1, Math.ceil(filtered.length / (directoryPageSize || 25)));
  const currentDirectoryPage = Math.min(Math.max(1, directoryPage), totalDirectoryPages);
  const directoryStartIdx = filtered.length === 0 ? 0 : (currentDirectoryPage - 1) * (directoryPageSize || 25);
  const directoryEndIdx = Math.min(directoryStartIdx + (directoryPageSize || 25), filtered.length);
  const displayedTeachers = filtered.slice(directoryStartIdx, directoryEndIdx);

  function toggleSelectAll() {
    const displayedIds = displayedTeachers.map(r => r.id);
    const allDisplayedSelected = displayedIds.length > 0 && displayedIds.every(id => selectedIds.has(id));
    if (allDisplayedSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        displayedIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        displayedIds.forEach(id => next.add(id));
        return next;
      });
    }
  }

  function downloadTemplate() {
    const sample = [
      { "Savior_No": "EMP010", "First Name": "Sunita", "Middle Name": "Kumar", "Last Name": "Verma", "Full Name(Automatically generated)": "Sunita Kumar Verma", "Email_id": "sunita.v@school.local", "Gender": "Female", "Joining_Date": "01-07-2020", "Class": "Class 10", "Section": "A", "Status": "Active", "Designation": "Senior Teacher" },
      { "Savior_No": "EMP011", "First Name": "Alok", "Middle Name": "", "Last Name": "Mishra", "Full Name(Automatically generated)": "Alok Mishra", "Email_id": "alok.m@school.local", "Gender": "Male", "Joining_Date": "15-01-2019", "Class": "Class 9", "Section": "B", "Status": "Active", "Designation": "TGT Mathematics" },
      { "Savior_No": "EMP012", "First Name": "Rekha", "Middle Name": "Devi", "Last Name": "Sengupta", "Full Name(Automatically generated)": "Rekha Devi Sengupta", "Email_id": "rekha.s@school.local", "Gender": "Female", "Joining_Date": "10-08-2021", "Class": "Class 8", "Section": "A", "Status": "Active", "Designation": "PRT Science" }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws['!cols'] = [16, 14, 14, 14, 24, 26, 12, 16, 12, 10, 12, 20].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teachers Import Template");
    XLSX.writeFile(wb, "teachers_import_template.xlsx");
  }

  // Helper for case-insensitive and punctuation-stripped Excel row lookup
  function getExcelCell(r: Record<string, any>, possibleKeys: string[]): string {
    if (!r || typeof r !== 'object') return '';
    for (const key of possibleKeys) {
      if (r[key] !== undefined && r[key] !== null && String(r[key]).trim() !== '') {
        return String(r[key]).trim();
      }
    }
    const rKeys = Object.keys(r);
    for (const targetKey of possibleKeys) {
      const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchedKey = rKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget);
      if (matchedKey && r[matchedKey] !== undefined && r[matchedKey] !== null && String(r[matchedKey]).trim() !== '') {
        return String(r[matchedKey]).trim();
      }
    }
    return '';
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

        // Filter out completely blank rows
        const cleanedJson = json.filter(r => {
          return Object.values(r).some(v => v !== undefined && v !== null && String(v).trim() !== '');
        });

        const rowErrors: { row: number; field: string; message: string }[] = [];
        const seenSavior = new Set<string>();
        const seenMail = new Set<string>();

        const mapped = cleanedJson.map((r, idx) => {
          const rowNum = idx + 1;
          const saviorNo = getExcelCell(r, [
            'Savior_No', 'SAVIOR_NO', 'Savior No', 'savior_no', 'saviorNo',
            'Employee ID', 'EMPLOYEE_ID', 'Employee Id/Savior_NO', 'Emp ID', 'EMP_ID', 'employee_id', 'ID'
          ]);

          let firstName = getExcelCell(r, ['Fist Name', 'First Name', 'firstName', 'first_name', 'FIRST NAME']);
          let middleName = getExcelCell(r, ['Middle Name', 'middleName', 'middle_name', 'MIDDLE NAME', 'MiddleName']);
          let lastName = getExcelCell(r, ['Last Name', 'lastName', 'last_name', 'LAST NAME', 'Surname']);
          const explicitFullName = getExcelCell(r, [
            'Full Name(Automatically generated)', 'Full Name', 'FULL NAME', 'fullName',
            'Teacher Name', 'TEACHER NAME', 'Name', 'NAME', 'name', 'Faculty Name', 'Staff Name'
          ]);

          if ((!firstName || !lastName) && explicitFullName) {
            const parts = explicitFullName.split(/\s+/).filter(Boolean);
            if (parts.length === 1) {
              if (!firstName) firstName = parts[0] || '';
            } else if (parts.length === 2) {
              if (!firstName) firstName = parts[0] || '';
              if (!lastName) lastName = parts[1] || '';
            } else if (parts.length >= 3) {
              if (!firstName) firstName = parts[0] || '';
              if (!middleName) middleName = parts.slice(1, -1).join(' ') || '';
              if (!lastName) lastName = parts[parts.length - 1] || '';
            }
          }
          if (firstName) firstName = firstName.toUpperCase();
          if (middleName) middleName = middleName.toUpperCase();
          if (lastName) lastName = lastName.toUpperCase();
          const name = (formatTeacherFullName(firstName, middleName, lastName) || explicitFullName || ((firstName && lastName) ? `${firstName} ${lastName}` : (firstName || lastName || ''))).toUpperCase();

          let email = getExcelCell(r, ['Email_id', 'EMAIL_ID', 'email_id', 'Email ID', 'emailId', 'Email', 'EMAIL', 'email', 'Email Address']).toLowerCase();
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            const cleanId = (saviorNo || `emp${rowNum}`).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            email = `teacher.${cleanId}@school.local`;
          }

          const rawMobile = getExcelCell(r, ['Mobile', 'MOBILE', 'mobile', 'Phone', 'PHONE', 'phone', 'Contact']).replace(/[^0-9]/g, '');
          const mobile = rawMobile || '9876500000';
          let rawGender = getExcelCell(r, ['Gender', 'GENDER', 'gender', 'Sex', 'SEX', 'sex', 'Gender (M/F)', 'Gender(M/F)', 'M/F', 'MF', 'Sex/Gender', 'Gen']);
          if (!rawGender) {
            const gk = Object.keys(r).find(k => /gender|sex|\bm[\/\-_]?f\b/i.test(k));
            if (gk && r[gk]) rawGender = String(r[gk]).trim();
          }
          let gender = '';
          if (rawGender) {
            if (/^f/i.test(rawGender)) gender = 'Female';
            else if (/^m/i.test(rawGender)) gender = 'Male';
            else gender = rawGender;
          }
          const rawDob = getExcelCell(r, ['Date_of_Birth', 'DATE_OF_BIRTH', 'Date of Birth', 'date_of_birth', 'DOB', 'dob', 'DateOfBirth']);
          const dob = rawDob ? toDdMmYyyy(rawDob) : '';
          const rawJoiningDate = getExcelCell(r, ['Joining_Date', 'JOINING_DATE', 'Joining Date', 'joining_date', 'DOJ', 'doj', 'Date of Joining', 'Date_of_Joining', 'JoiningDate', 'joiningDate']);
          const joiningDate = rawJoiningDate ? toDdMmYyyy(rawJoiningDate) : '';

          const designation = getExcelCell(r, [
            'Designation', 'DESIGNATION', 'designation', 'Role', 'ROLE', 'role', 'Post', 'POST', 'post', 'Job Title'
          ]) || 'Teacher';

          const rawStatus = getExcelCell(r, ['Status', 'STATUS', 'status']);
          const status = (rawStatus === 'T' || /active/i.test(rawStatus) || !rawStatus) ? 'Active' : 'Inactive';

          const rawClassCell = getExcelCell(r, ['Class', 'CLASS', 'class', 'Standard', 'Grade']);
          const rawSectionCell = getExcelCell(r, ['Section', 'SECTION', 'section', 'Sec', 'SEC']);
          const { className, sectionName } = parseImportClassAndSection(rawClassCell, rawSectionCell);

          // Field validations
          const rowErrs: { row: number; field: string; message: string }[] = [];
          if (!name) {
            rowErrs.push({ row: rowNum, field: 'Full Name', message: 'Name is required' });
          }
          if (!saviorNo) {
            rowErrs.push({ row: rowNum, field: 'Savior_No', message: 'Savior_No / Employee ID is required' });
          } else if (seenSavior.has(saviorNo)) {
            rowErrs.push({ row: rowNum, field: 'Savior_No', message: `Duplicate Savior_No '${saviorNo}' in file` });
          } else {
            seenSavior.add(saviorNo);
          }
          if (email && seenMail.has(email)) {
            rowErrs.push({ row: rowNum, field: 'Email ID', message: `Duplicate email '${email}' in file` });
          } else if (email) {
            seenMail.add(email);
          }
          if (joiningDate && !isValidDdMmYyyy(joiningDate)) {
            rowErrs.push({ row: rowNum, field: 'Joining Date', message: 'Joining Date must be DD-MM-YYYY' });
          }
          if (rawMobile && rawMobile.length !== 10) {
            rowErrs.push({ row: rowNum, field: 'Mobile', message: `Mobile must be 10 digits (${rawMobile.length} given)` });
          }

          rowErrors.push(...rowErrs);

          return {
            saviorNo: saviorNo || `EMP0${idx + 10}`,
            employeeId: saviorNo || `EMP0${idx + 10}`,
            firstName,
            middleName,
            middle_name: middleName,
            lastName,
            name: name || `Faculty ${rowNum}`,
            email,
            mobile,
            gender,
            dob,
            joiningDate,
            joining_date: joiningDate,
            designation,
            status,
            class: className,
            section: sectionName,
            emailStatus: 'Pending',
            _origRowIndex: rowNum,
            _errors: rowErrs
          };
        });

        setImportErrors(rowErrors);
        setPreviewRows(mapped);
        setImportPreviewPage(1);
        setImportPreviewSearch('');
        setImportPreviewErrorFilter('all');
      } catch (err) {
        alert('Failed to parse file. Please upload a valid .xlsx or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function submitBulkImport() {
    if (previewRows.length === 0) return;
    const errorRows = previewRows.filter(r => r._errors && r._errors.length > 0);
    if (errorRows.length > 0) {
      alert(`Cannot import file: ${errorRows.length} record(s) have validation errors.\n\nPlease fix the highlighted fields in the preview table or correct your spreadsheet and re-upload.`);
      setImportPreviewErrorFilter('errors');
      setImportPreviewPage(1);
      return;
    }
    setImporting(true);
    try {
      const res = await api.post('/teachers/bulk-import', { teachers: previewRows }, { timeout: 300000 });
      if (previewRows.length > 0) {
        const lastRow = previewRows[previewRows.length - 1];
        const teacherName = lastRow.name || `${lastRow.firstName || ''} ${lastRow.lastName || ''}`.trim() || 'Teacher';
        const teacherEmpId = lastRow.saviorNo || lastRow.employeeId || '—';
        try {
          localStorage.setItem('attendo_last_registered_teacher', JSON.stringify({
            name: teacherName,
            employeeId: teacherEmpId
          }));
        } catch { }
      }
      alert(`Successfully registered ${res.data.count} teachers! Credentials and setup links have been dispatched via SMTP.`);
      setImportOpen(false);
      setPreviewRows([]);
      setImportErrors([]);
      setImportPreviewPage(1);
      setImportPreviewSearch('');
      setImportPreviewErrorFilter('all');
      load();
    } catch (err: any) {
      const serverErrs = err?.response?.data?.errors;
      if (serverErrs && Array.isArray(serverErrs) && serverErrs.length > 0) {
        setImportErrors(serverErrs);
        setPreviewRows(prev => prev.map(r => {
          const matched = serverErrs.filter(se => se.row === r._origRowIndex);
          return {
            ...r,
            _errors: matched.length > 0 ? matched : r._errors
          };
        }));
        setImportPreviewErrorFilter('errors');
        setImportPreviewPage(1);
      }
      const msg = err?.response?.data?.message || err?.message || 'Failed to import teachers';
      alert(`Import Failed: ${msg}\n\nPlease check the highlighted error records below.`);
    } finally {
      setImporting(false);
    }
  }

  // Teacher Bulk Import Preview Pagination & Filtering
  const teacherValidCount = previewRows.filter(r => !r._errors?.length).length;
  const teacherErrorCount = previewRows.filter(r => r._errors?.length).length;

  const filteredTeacherPreviewRows = previewRows.filter((r) => {
    if (importPreviewErrorFilter === 'errors' && (!r._errors || r._errors.length === 0)) return false;
    if (importPreviewErrorFilter === 'valid' && (r._errors && r._errors.length > 0)) return false;
    if (!importPreviewSearch.trim()) return true;
    const q = importPreviewSearch.toLowerCase();
    const target = [
      r.saviorNo,
      r.employeeId,
      r.firstName,
      r.middleName,
      r.lastName,
      r.name,
      r.email,
      r.mobile,
      r.designation,
      r.class,
      r.section
    ].filter(Boolean).join(' ').toLowerCase();
    return target.includes(q);
  });

  const totalTeacherImportPages = Math.max(1, Math.ceil(filteredTeacherPreviewRows.length / (importPreviewPageSize || 25)));
  const currentTeacherImportPage = Math.min(Math.max(1, importPreviewPage), totalTeacherImportPages);
  const teacherStartIdx = filteredTeacherPreviewRows.length === 0 ? 0 : (currentTeacherImportPage - 1) * (importPreviewPageSize || 25);
  const teacherEndIdx = Math.min(teacherStartIdx + (importPreviewPageSize || 25), filteredTeacherPreviewRows.length);
  const displayedTeacherPreviewRows = filteredTeacherPreviewRows.slice(teacherStartIdx, teacherEndIdx);

  return <Layout>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
      <div>
        <p className="eyebrow">FACULTY & STAFF</p>
        <h1 style={{ margin: 0, fontSize: 24 }}>Teachers & Faculty</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Appointed faculty accounts, classroom attendance permissions, and bulk onboarding.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#0284c7',
            color: '#ffffff',
            border: '1px solid #0369a1',
            padding: '7px 13px',
            borderRadius: 'var(--radius-sm, 6px)',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: 500,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}
          title="Export faculty records as Excel spreadsheet or CSV"
          id="teachers-top-export-btn"
        >
          <Download size={16} /> Export Excel / CSV{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </button>
        <button
          onClick={() => setImportOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#ffffff' }}
          title="Import teachers via Excel spreadsheet or CSV with interactive preview"
        >
          <FileSpreadsheet size={16} /> Import Excel / CSV
        </button>
        <button
          onClick={() => {
            setEditingTeacher(null);
            setF({
              sendInviteEmail: true,
              is_active: true,
              class_id: '',
              class_name: '',
              class: '',
              section_id: '',
              section_name: '',
              section: ''
            });
            setOpen(true);
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} /> Add Teacher
        </button>
      </div>
    </div>

    {/* Toast / Feedback Notice */}
    {toastNotice && (
      <div className={`feedback-notice ${toastNotice.type}`} style={{
        padding: '12px 16px',
        marginBottom: 16,
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
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

    {/* ── UNIFIED TEACHER DIRECTORY BOX WITH INNER SCROLLBAR ── */}
    <div className="directory-box" ref={directoryTopRef}>
      {/* Top Loading Progress Bar */}
      {loading && (
        <div style={{
          width: '100%',
          height: '4px',
          background: 'rgba(37, 99, 235, 0.12)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            width: `${loadProgress}%`,
            background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
            transition: 'width 0.15s ease-out',
            boxShadow: '0 0 8px rgba(59, 130, 246, 0.5)'
          }} />
        </div>
      )}
      {/* Box Header Toolbar */}
      <div className="directory-box-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', flexShrink: 0 }}>
          <input
            placeholder="🔍 Search teacher name, email, or employee ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 280, maxWidth: '100%', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
            id="teacher-search-input"
          />
          <select
            value={genderFilter}
            onChange={e => setGenderFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 'var(--radius-sm, 6px)',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text, #1e293b)',
              fontSize: 13,
              cursor: 'pointer',
              minWidth: 115,
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
            aria-label="Filter teachers by gender"
            id="teacher-gender-filter"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <select
            value={designationFilter}
            onChange={e => setDesignationFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 'var(--radius-sm, 6px)',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text, #1e293b)',
              fontSize: 13,
              cursor: 'pointer',
              minWidth: 140,
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
            aria-label="Filter teachers by designation"
            id="teacher-designation-filter"
          >
            <option value="">All Designations</option>
            {availableDesignations.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {(search || genderFilter || designationFilter) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setSearch(''); setGenderFilter(''); setDesignationFilter(''); }}
              style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}
              title="Clear active search and filters"
              id="clear-teacher-filters-btn"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="directory-refresh-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: loading ? 'var(--card-subtle, #1e293b)' : 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border, #cbd5e1)',
              borderRadius: 'var(--radius-sm, 6px)',
              fontSize: 12.5,
              color: loading ? 'var(--text-muted, #94a3b8)' : 'var(--text, #1e293b)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
            title="Refetch faculty records from database"
            id="teachers-directory-refresh-btn"
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spinAnim 0.8s linear infinite' : 'none', color: '#2563eb' }} />
            <span>{loading ? `Refetching (${loadProgress}%)` : 'Refresh'}</span>
          </button>
          {/* Last Fetched Time Badge */}
          <div
            className="last-fetched-badge"
            title="Last successful synchronization with database"
          >
            <Clock size={12} />
            <span>Last fetched: <b>{formatLastFetched(lastFetchedAt)}</b></span>
            {loading && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginLeft: 3,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(37, 99, 235, 0.16)',
                color: '#3b82f6',
                fontWeight: 600,
                fontSize: 11
              }}>
                <Loader2 size={10} style={{ animation: 'spinAnim 0.8s linear infinite' }} />
                {loadProgress}%
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary, #475569)' }}>
            <span>Rows per page:</span>
            <select
              value={directoryPageSize}
              onChange={e => { setDirectoryPageSize(Number(e.target.value)); setDirectoryPage(1); scrollToDirectoryTop(); }}
              className="directory-select"
              style={{
                padding: '4px 8px',
                fontSize: 12.5,
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                cursor: 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25 (Default)</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={100000}>All ({filtered.length})</option>
            </select>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {filtered.length === 0 ? (
              'Showing 0 faculty members'
            ) : (
              <>
                Showing <b>{directoryStartIdx + 1}</b> to <b>{directoryEndIdx}</b> of <b>{filtered.length}</b> faculty members
                {filtered.length !== rows.length && (
                  <span style={{ opacity: 0.75, marginLeft: 4 }}>(filtered from {rows.length} total)</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Box Body (Scrollable Table Area) */}
      <div className="directory-box-body" ref={tableBodyRef}>
        {loading && displayedTeachers.length > 0 && (
          <div style={{
            position: 'sticky',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            background: 'rgba(239, 246, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            borderBottom: '1px solid #bfdbfe',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#1d4ed8',
            fontWeight: 500
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <RefreshCw size={12} style={{ animation: 'spinAnim 0.8s linear infinite' }} />
              <span>Refetching faculty directory from database...</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700 }}>{loadProgress}%</span>
              <div style={{ width: 70, height: 5, background: '#bfdbfe', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${loadProgress}%`, height: '100%', background: '#2563eb', transition: 'width 0.15s ease' }} />
              </div>
            </div>
          </div>
        )}
        <table>
          <thead>
            <tr style={{ verticalAlign: 'middle' }}>
              <th style={{ width: 36, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={displayedTeachers.length > 0 && displayedTeachers.every(x => selectedIds.has(x.id))}
                  onChange={toggleSelectAll}
                  title="Select all on this page"
                />
              </th>
              <th style={{ lineHeight: 1.25, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                Employee Id /<br />Savior_NO
              </th>
              <th style={{ whiteSpace: 'nowrap' }}>Teacher Name</th>
              <th style={{ whiteSpace: 'nowrap' }}>Joining Date</th>
              <th style={{ whiteSpace: 'nowrap' }}>Gender</th>
              <th style={{ whiteSpace: 'nowrap' }}>Designation</th>
              <th style={{ lineHeight: 1.25, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                Assigned<br />Classes
              </th>
              <th style={{ whiteSpace: 'nowrap' }}>Email</th>
              <th style={{ whiteSpace: 'nowrap' }}>Mobile</th>
              <th style={{ whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && displayedTeachers.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 320, margin: '0 auto' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={38} style={{ color: '#2563eb', animation: 'spinAnim 0.8s linear infinite' }} />
                      <span style={{ position: 'absolute', fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>{loadProgress}%</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text, #1e293b)' }}>Loading Faculty Directory...</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>Fetching faculty records and allocations from database ({loadProgress}%)</div>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${loadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)', transition: 'width 0.15s ease' }} />
                    </div>
                  </div>
                </td>
              </tr>
            ) : displayedTeachers.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 24 }} className="muted">No faculty members found. Click "Add Teacher" or "Import Excel / CSV" to onboard staff.</td></tr>
            ) : displayedTeachers.map(x => (
              <tr key={x.id} style={{ background: selectedIds.has(x.id) ? 'rgba(59, 130, 246, 0.06)' : 'transparent' }}>
                <td style={{ textAlign: 'center', width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(x.id)}
                    onChange={() => toggleSelect(x.id)}
                  />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}><code>{x.savior_no || x.employee_id || x.Savior_No || '—'}</code></td>
                <td>
                  <TeacherProfileHoverCard teacher={x} allocationsSummary={getTeacherAllocSummary(x)}>
                    <b style={{ textTransform: 'uppercase' }}>{String(x.name || '').toUpperCase()}</b>
                  </TeacherProfileHoverCard>
                </td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12.5, color: 'var(--text-secondary, #475569)' }}>
                  {toDdMmYyyy(x.joining_date || x.joiningDate) || '—'}
                </td>
                <td>
                  {x.gender ? (
                    <span
                      className={`gender-chip gender-${(formatGender(x.gender) || 'other').toLowerCase()}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 500,
                        background: formatGender(x.gender) === 'Female' ? '#fdf2f8' : formatGender(x.gender) === 'Male' ? '#f0f9ff' : '#f8fafc',
                        color: formatGender(x.gender) === 'Female' ? '#db2777' : formatGender(x.gender) === 'Male' ? '#0284c7' : '#64748b',
                        border: `1px solid ${formatGender(x.gender) === 'Female' ? '#fbcfe8' : formatGender(x.gender) === 'Male' ? '#bae6fd' : '#e2e8f0'}`
                      }}
                    >
                      {formatGender(x.gender)}
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>—</span>
                  )}
                </td>
                <td>
                  <span className="teacher-designation" style={{ fontWeight: 500, color: 'var(--text-secondary, #cbd5e1)' }}>{x.designation || 'Teacher'}</span>
                </td>
                <td style={{ fontSize: 12, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span title={getTeacherAllocSummary(x)}>{getTeacherAllocSummary(x)}</span>
                </td>
                <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.email}>
                  {x.email}
                </td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{x.mobile || '—'}</td>
                <td><span className={`badge ${x.is_active !== false ? 'active' : 'inactive'}`}>{x.is_active !== false ? 'ACTIVE' : 'INACTIVE'}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    className="table-action-btn"
                    onClick={() => openAllocModal(x)}
                    title="Manage teaching allocations"
                    style={{ marginRight: 4, color: '#7c3aed' }}
                  >
                    <BookOpen size={14} />
                  </button>
                  <button
                    className="table-action-btn"
                    onClick={() => {
                      setEditingTeacher(x);
                      const directAssign = allAssignments.find(a => a.teacher_id === x.id);
                      const rawCls = x.class_name || x.class || (directAssign ? directAssign.class_number : '');
                      const rawSec = x.section_name || x.section || (directAssign ? directAssign.section_name : '');
                      const matchingClass = allocClasses.find(c => {
                        const cName = c.class_number === -1 ? 'Class L KG' : c.class_number === 0 ? 'Class U KG' : `Class ${c.class_number}`;
                        const rawNum = String(c.class_number);
                        const target = String(rawCls || '').replace(/^Class\s*/i, '').trim();
                        return String(c.id) === String(x.class_id) || cName.toLowerCase() === String(rawCls || '').toLowerCase() || rawNum === target;
                      });
                      const matchingSec = allocSections.find(s => {
                        return String(s.id) === String(x.section_id) || (String(s.name).trim().toUpperCase() === String(rawSec || '').trim().toUpperCase() && (!matchingClass || String(s.class_id) === String(matchingClass.id)));
                      });
                      const cVal = rawCls || (matchingClass ? (matchingClass.class_number === -1 ? 'Class L KG' : matchingClass.class_number === 0 ? 'Class U KG' : `Class ${matchingClass.class_number}`) : '');
                      const sVal = rawSec || (matchingSec ? matchingSec.name : '');
                      const nameParts = (x.name || '').trim().split(/\s+/);
                      let fName = x.first_name || x.firstName || '';
                      let mName = x.middle_name || x.middleName || '';
                      let lName = x.last_name || x.lastName || '';
                      if (!fName && nameParts.length > 0) {
                        if (nameParts.length === 1) {
                          fName = nameParts[0];
                        } else if (nameParts.length === 2) {
                          fName = nameParts[0];
                          lName = nameParts[1];
                        } else {
                          fName = nameParts[0];
                          mName = nameParts.slice(1, -1).join(' ');
                          lName = nameParts[nameParts.length - 1];
                        }
                      }
                      setF({
                        name: x.name,
                        firstName: fName,
                        middleName: mName,
                        lastName: lName,
                        email: x.email,
                        employeeId: x.employee_id || x.employeeId || x.savior_no || '',
                        mobile: x.mobile || x.phone || '',
                        gender: formatGender(x.gender) || '',
                        joiningDate: toDdMmYyyy(x.joining_date || x.joiningDate),
                        joining_date: toDdMmYyyy(x.joining_date || x.joiningDate),
                        designation: x.designation || 'Teacher',
                        class_id: matchingClass ? String(matchingClass.id) : (x.class_id || ''),
                        class_name: cVal,
                        class: cVal,
                        section_id: matchingSec ? String(matchingSec.id) : (x.section_id || ''),
                        section_name: sVal,
                        section: sVal,
                        is_active: x.is_active !== false
                      });
                      setOpen(true);
                    }}
                    title="Edit teacher profile"
                    style={{ marginRight: 4, color: '#0d9488' }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="table-action-btn"
                    onClick={() => sendTeacherResetEmail(x)}
                    title="Send password setup / reset email"
                    style={{ marginRight: 4, color: '#2563eb' }}
                  >
                    <KeyRound size={14} />
                  </button>
                  <button
                    className="table-action-btn danger"
                    onClick={() => promptDeleteTeacher(x)}
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

      {/* Box Footer (Pagination Bar) */}
      <div className="directory-box-footer">
        <div style={{ color: 'var(--text-secondary, #475569)', fontSize: 12.5 }}>
          {filtered.length === 0 ? (
            'Showing 0 faculty members'
          ) : (
            <>
              Showing <b>{directoryStartIdx + 1}</b> to <b>{directoryEndIdx}</b> of <b>{filtered.length}</b> faculty members
              {filtered.length !== rows.length && (
                <span style={{ opacity: 0.75, marginLeft: 4 }}>(filtered from {rows.length} total)</span>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage <= 1}
            onClick={() => { setDirectoryPage(1); scrollToDirectoryTop(); }}
            title="First Page"
          >
            <ChevronsLeft size={14} /> First
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage <= 1}
            onClick={() => { setDirectoryPage(p => Math.max(1, p - 1)); scrollToDirectoryTop(); }}
            title="Previous Page"
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px', fontSize: 12.5 }}>
            <span>Page</span>
            <select
              value={currentDirectoryPage}
              onChange={(e) => { setDirectoryPage(Number(e.target.value)); scrollToDirectoryTop(); }}
              className="directory-select"
              style={{
                padding: '3px 6px',
                fontSize: 12,
                borderRadius: 4,
                border: '1px solid var(--border, #cbd5e1)',
                cursor: 'pointer'
              }}
            >
              {Array.from({ length: totalDirectoryPages }, (_, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {idx + 1}
                </option>
              ))}
            </select>
            <span>of <b>{totalDirectoryPages}</b></span>
          </div>

          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage >= totalDirectoryPages}
            onClick={() => { setDirectoryPage(p => Math.min(totalDirectoryPages, p + 1)); scrollToDirectoryTop(); }}
            title="Next Page"
          >
            Next <ChevronRight size={14} />
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage >= totalDirectoryPages}
            onClick={() => { setDirectoryPage(totalDirectoryPages); scrollToDirectoryTop(); }}
            title="Last Page"
          >
            Last <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>

    {/* Sticky Floating Action Bar for Bulk Selection */}
    {selectedIds.size > 0 && (
      <div className="bulk-action-bar">
        <span className="count-badge">{selectedIds.size} faculty selected</span>
        <button className="btn-secondary" onClick={() => setSelectedIds(new Set())}>
          Deselect All
        </button>
        <button className="btn-danger" onClick={promptBulkDeleteTeachers}>
          <Trash2 size={14} /> Delete Selected ({selectedIds.size})
        </button>
      </div>
    )}

    {/* SINGLE TEACHER ADD / EDIT MODAL */}
    {open && (() => {
      const EMAIL_VALIDATION_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const currentTeacherEmail = String(f.email || '').trim().toLowerCase();
      const isEmailDuplicateInUi = Boolean(
        currentTeacherEmail &&
        rows.some(r => {
          const rowEmail = String(r.email || '').trim().toLowerCase();
          const matches = rowEmail === currentTeacherEmail;
          const isSameRecord = editingTeacher && (
            r.id === editingTeacher.id ||
            r.employee_id === editingTeacher.employee_id ||
            r.employeeId === editingTeacher.employeeId ||
            (editingTeacher.id && r.id && String(r.id) === String(editingTeacher.id))
          );
          return matches && !isSameRecord;
        })
      );
      const isEmailInvalidInUi = Boolean(
        currentTeacherEmail && !EMAIL_VALIDATION_REGEX.test(currentTeacherEmail)
      );

      const fnVal = f.firstName !== undefined ? f.firstName : (editingTeacher ? (f.name || '').split(' ')[0] : '');
      const mnVal = f.middleName || '';
      const lnVal = f.lastName !== undefined ? f.lastName : (editingTeacher ? (f.name || '').split(' ').slice(1).join(' ') : '');
      const isFnInvalid = Boolean(fnVal && (fnVal.length < 3 || fnVal.length > 15 || /\s/.test(fnVal) || /\d/.test(fnVal)));
      const isMnInvalid = Boolean(mnVal && (/\d/.test(mnVal) || /\s/.test(mnVal)));
      const isLnInvalid = Boolean(lnVal && (/\d/.test(lnVal) || lnVal.length < 3 || lnVal.length > 15));

      return (
        <Modal maxWidth={620} title={editingTeacher ? `Edit Faculty Member — ${editingTeacher.name}` : "Add Faculty Member / Teacher"} close={() => { setOpen(false); setEditingTeacher(null); setF({}); }}>
          {({ isFull }) => (
            <form className="modal-form" onSubmit={handleInitiateTeacherSave}>
              {/* Last Registered Teacher Banner in Red */}
              {lastRegisteredTeacherInfo && (
                <div style={{
                  color: '#ef4444',
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: '8px 12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 6,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Info size={15} style={{ flexShrink: 0, color: '#ef4444' }} />
                  <span>
                    Last registered teacher: <strong style={{ color: '#ef4444' }}>{lastRegisteredTeacherInfo.name}</strong> | Employee ID: <strong style={{ color: '#ef4444' }}>{lastRegisteredTeacherInfo.employeeId}</strong>
                  </span>
                </div>
              )}

              {/* First Name + Middle Name + Last Name */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isFull ? 'repeat(3, minmax(0, 1fr))' : '1fr 1fr',
                gap: 14,
                alignItems: 'start'
              }}>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    First Name <span style={{ color: '#ef4444', fontWeight: 600 }}>*</span>
                  </span>
                  <input
                    required
                    placeholder="e.g. Rahul"
                    maxLength={15}
                    value={fnVal || ''}
                    style={{
                      textTransform: 'uppercase',
                      borderColor: isFnInvalid ? '#ef4444' : undefined,
                      boxShadow: isFnInvalid ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      const fn = e.target.value.replace(/\s/g, '').slice(0, 15).toUpperCase();
                      const fullName = formatTeacherFullName(fn, mnVal, lnVal);
                      setF({ ...f, firstName: fn, name: fullName });
                    }}
                  />
                  {fnVal && /\d/.test(fnVal) ? (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Enter a string not a number
                    </span>
                  ) : fnVal && /\s/.test(fnVal) ? (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Spaces are not allowed in First Name
                    </span>
                  ) : fnVal && fnVal.length < 3 ? (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Must be 3 to 15 characters
                    </span>
                  ) : null}
                </label>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    Middle Name <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', fontWeight: 'normal' }}>(Optional)</span>
                  </span>
                  <input
                    placeholder="e.g. Kumar"
                    maxLength={15}
                    value={mnVal}
                    style={{
                      textTransform: 'uppercase',
                      borderColor: isMnInvalid ? '#ef4444' : undefined,
                      boxShadow: isMnInvalid ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      const mn = e.target.value.replace(/\s/g, '').slice(0, 15).toUpperCase();
                      const fullName = formatTeacherFullName(fnVal, mn, lnVal);
                      setF({ ...f, middleName: mn, name: fullName });
                    }}
                  />
                  {mnVal && /\d/.test(mnVal) && (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Enter a string not a number
                    </span>
                  )}
                </label>
                <label style={!isFull ? { gridColumn: '1 / -1' } : undefined}>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    Last Name <span style={{ color: '#ef4444', fontWeight: 600 }}>*</span>
                  </span>
                  <input
                    required
                    placeholder="e.g. Sharma"
                    maxLength={15}
                    value={lnVal || ''}
                    style={{
                      textTransform: 'uppercase',
                      borderColor: isLnInvalid ? '#ef4444' : undefined,
                      boxShadow: isLnInvalid ? '0 0 0 1px #ef4444' : undefined
                    }}
                    onChange={e => {
                      const ln = e.target.value.replace(/\d/g, '').slice(0, 15).toUpperCase();
                      const fullName = formatTeacherFullName(fnVal, mnVal, ln);
                      setF({ ...f, lastName: ln, name: fullName });
                    }}
                  />
                  {lnVal && /\d/.test(lnVal) ? (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Enter a string not a number
                    </span>
                  ) : lnVal && lnVal.length < 3 ? (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Must be 3 to 15 characters
                    </span>
                  ) : null}
                </label>
              </div>

              {/* Full Name — auto-computed, read-only */}
              <label style={{ color: 'var(--text-secondary, #64748b)', fontSize: 12 }}>
                <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text, #334155)' }}>Full Name</span>
                  <span style={{ color: '#10b981', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
                    Auto-generated
                  </span>
                </span>
                <input
                  readOnly
                  tabIndex={-1}
                  style={{ textTransform: 'uppercase', backgroundColor: 'var(--card-subtle, #f8fafc)', color: 'var(--text, #334155)', cursor: 'default', border: '1px solid var(--border, #e2e8f0)', fontWeight: 600 }}
                  value={(formatTeacherFullName(fnVal, mnVal, lnVal) || f.name || '').toUpperCase()}
                  placeholder="Full name will appear here automatically"
                />
              </label>

              <label>
                <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Email Address (for Faculty Portal Login) <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <input
                  required
                  type="email"
                  placeholder="teacher@school.local"
                  value={f.email || ''}
                  style={{
                    borderColor: (isEmailDuplicateInUi || isEmailInvalidInUi) ? '#ef4444' : undefined,
                    boxShadow: (isEmailDuplicateInUi || isEmailInvalidInUi) ? '0 0 0 1px #ef4444' : undefined
                  }}
                  onChange={e => setF({ ...f, email: e.target.value.trim() })}
                />
                {isEmailDuplicateInUi ? (
                  <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 600 }}>
                    Already exist
                  </span>
                ) : isEmailInvalidInUi ? (
                  <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                    Please enter a valid email address
                  </span>
                ) : null}
              </label>
              <label>
                <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Employee ID / Savior_NO <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <input required placeholder="e.g. EMP001 or SAVIOR_101" value={f.employeeId || f.saviorNo || ''} onChange={e => setF({ ...f, employeeId: e.target.value, saviorNo: e.target.value })} />
              </label>
              {/* Row 1: Gender & Joining Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Gender
                  </span>
                  <select
                    value={formatGender(f.gender) || ''}
                    onChange={e => setF({ ...f, gender: formatGender(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4, boxSizing: 'border-box' }}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Joining Date <span style={{ color: '#ef4444' }}>*</span> <span style={{ color: '#64748b', fontSize: 11, fontWeight: 400 }}>(DD-MM-YYYY)</span>
                  </span>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: 4 }}>
                    <input
                      required
                      type="text"
                      placeholder="DD-MM-YYYY (e.g. 01-07-2022)"
                      maxLength={10}
                      value={f.joiningDate || f.joining_date || ''}
                      onChange={e => {
                        const formatted = formatDdMmYyyyInput(e.target.value, f.joiningDate || f.joining_date || '');
                        setF({ ...f, joiningDate: formatted, joining_date: formatted });
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 34px 8px 10px',
                        borderRadius: 6,
                        border: `1px solid ${(f.joiningDate || f.joining_date) && !isValidDdMmYyyy(f.joiningDate || f.joining_date) ? '#ef4444' : 'var(--border)'}`,
                        boxSizing: 'border-box'
                      }}
                    />
                    <input
                      type="date"
                      title="Select from date picker"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 38,
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        zIndex: 2
                      }}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker?.();
                        } catch { }
                      }}
                      onChange={e => {
                        if (e.target.value) {
                          const [y, m, d] = e.target.value.split('-');
                          setF({ ...f, joiningDate: `${d}-${m}-${y}`, joining_date: `${d}-${m}-${y}` });
                        }
                      }}
                    />
                    <Calendar
                      size={16}
                      style={{
                        position: 'absolute',
                        right: 10,
                        color: '#64748b',
                        pointerEvents: 'none'
                      }}
                    />
                  </div>
                  {(f.joiningDate || f.joining_date) && !isValidDdMmYyyy(f.joiningDate || f.joining_date) && (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Strict format required: DD-MM-YYYY (e.g. 01-07-2022)
                    </span>
                  )}
                </label>
              </div>

              {/* Row 2: Designation & Mobile Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Designation <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <select
                    required
                    value={f.designation || ''}
                    onChange={e => setF({ ...f, designation: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4, boxSizing: 'border-box' }}
                  >
                    <option value="">Select Designation</option>
                    {f.designation && !allocDesignations.some(d => (d.title || d.name) === f.designation) && (
                      <option value={f.designation}>{f.designation}</option>
                    )}
                    {allocDesignations.filter(d => d.is_active !== false).map(d => (
                      <option key={d.id || d.title} value={d.title || d.name}>
                        {d.title || d.name}{d.category ? ` (${d.category})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    required
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    inputMode="numeric"
                    value={f.mobile || ''}
                    onChange={e => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setF({ ...f, mobile: cleaned });
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      borderColor: (f.mobile && f.mobile.length < 10) ? '#ef4444' : undefined,
                      boxShadow: (f.mobile && f.mobile.length < 10) ? '0 0 0 1px #ef4444' : undefined
                    }}
                  />
                  {f.mobile && f.mobile.length < 10 && (
                    <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                      Must be a valid 10-digit mobile number
                    </span>
                  )}
                </label>
              </div>

              {/* Row 3: Assign Class & Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>Assign Class
                  <select
                    value={f.class_id || (allocClasses.find(c => {
                      const cName = c.class_number === -1 ? 'Class L KG' : c.class_number === 0 ? 'Class U KG' : `Class ${c.class_number}`;
                      return cName.toLowerCase() === String(f.class_name || f.class || '').toLowerCase() || String(c.class_number) === String(f.class_name || f.class || '').replace(/^Class\s*/i, '').trim();
                    })?.id) || ''}
                    onChange={e => {
                      const selectedClassId = e.target.value;
                      const clsObj = allocClasses.find(c => String(c.id) === String(selectedClassId));
                      let clsName = '';
                      if (clsObj) {
                        if (clsObj.class_number === -1) clsName = 'Class L KG';
                        else if (clsObj.class_number === 0) clsName = 'Class U KG';
                        else clsName = `Class ${clsObj.class_number}`;
                      } else if (selectedClassId) {
                        clsName = selectedClassId.startsWith('Class') ? selectedClassId : `Class ${selectedClassId}`;
                      }
                      setF({
                        ...f,
                        class_id: selectedClassId,
                        class_name: clsName,
                        class: clsName,
                        section_id: '',
                        section_name: '',
                        section: ''
                      });
                    }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4, boxSizing: 'border-box' }}
                  >
                    <option value="">Select Class (Optional)</option>
                    {allocClasses.length > 0 ? (
                      allocClasses.map(c => {
                        const label = c.class_number === -1 ? 'Class L KG' : c.class_number === 0 ? 'Class U KG' : `Class ${c.class_number}`;
                        return (
                          <option key={c.id} value={c.id}>{label}</option>
                        );
                      })
                    ) : (
                      <>
                        <option value="Class L KG">Class L KG</option>
                        <option value="Class U KG">Class U KG</option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={`Class ${i + 1}`}>Class {i + 1}</option>
                        ))}
                      </>
                    )}
                  </select>
                </label>
                <label>Assign Section
                  <select
                    value={f.section_name || f.section || ''}
                    onChange={e => {
                      const sName = e.target.value;
                      const secObj = allocSections.find(s => {
                        const matchName = String(s.name).trim().toUpperCase() === sName.toUpperCase();
                        if (!matchName) return false;
                        if (!f.class_id) return true;
                        return String(s.class_id) === String(f.class_id);
                      }) || allocSections.find(s => String(s.name).trim().toUpperCase() === sName.toUpperCase());

                      setF({
                        ...f,
                        section_id: secObj ? String(secObj.id) : sName,
                        section_name: sName,
                        section: sName
                      });
                    }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4, boxSizing: 'border-box' }}
                  >
                    <option value="">Select Section (Optional)</option>
                    {(() => {
                      let list = allocSections;
                      if (f.class_id) {
                        const selectedCls = allocClasses.find(c => String(c.id) === String(f.class_id));
                        const filtered = allocSections.filter(s => String(s.class_id) === String(f.class_id) || (selectedCls && String(s.class_number) === String(selectedCls.class_number)));
                        if (filtered.length > 0) {
                          list = filtered;
                        }
                      }
                      const seen = new Set<string>();
                      const uniqueNames: string[] = [];
                      for (const s of list) {
                        const name = String(s.name || '').trim().toUpperCase();
                        if (name && !seen.has(name)) {
                          seen.add(name);
                          uniqueNames.push(name);
                        }
                      }
                      if (uniqueNames.length === 0) {
                        return ['A', 'B', 'C', 'D'].map(sec => (
                          <option key={sec} value={sec}>Section {sec}</option>
                        ));
                      }
                      uniqueNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                      return uniqueNames.map(secName => (
                        <option key={secName} value={secName}>Section {secName}</option>
                      ));
                    })()}
                  </select>
                </label>
              </div>

              {editingTeacher && (
                <label>Account Status
                  <select
                    value={f.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                    onChange={e => setF({ ...f, is_active: e.target.value === 'ACTIVE' })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </label>
              )}

              {/* Password Setup & Activation Box */}
              <div className="student-portal-box">
                <div className="student-portal-box-title" style={{ marginBottom: 6 }}>
                  <KeyRound size={14} style={{ color: '#2563eb' }} />
                  {editingTeacher ? 'Update Password (Optional)' : 'Password Setup & Account Activation'}
                </div>
                {!editingTeacher && (
                  <label className="student-portal-invite-note" style={{ margin: '0 0 10px 0', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={f.sendInviteEmail !== false}
                      onChange={e => setF({ ...f, sendInviteEmail: e.target.checked })}
                    />
                    <span>Send welcome email with secure link to set password (spam-filtered; 24h validity)</span>
                  </label>
                )}
                <label style={{ display: 'block', fontSize: 12, margin: 0 }} className="student-portal-box-desc">
                  {editingTeacher ? 'Leave blank to keep existing password, or enter new password:' : 'Optional Initial Password (leave empty to let teacher set password via email):'}
                  <div style={{ position: 'relative', marginTop: 4, display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showTeacherPassword ? 'text' : 'password'}
                      placeholder={editingTeacher ? 'New password (min 6 characters)' : 'Optional initial password (e.g. ChangeMe123!)'}
                      value={f.password || ''}
                      onChange={e => setF({ ...f, password: e.target.value })}
                      style={{ width: '100%', paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowTeacherPassword(s => !s)}
                      className="password-toggle-btn"
                      title={showTeacherPassword ? "Hide password" : "Show password"}
                      style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary, #64748b)', display: 'flex', alignItems: 'center' }}
                    >
                      {showTeacherPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setOpen(false); setEditingTeacher(null); setF({}); }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving}>
                  {editingTeacher ? 'Preview & Update Teacher' : 'Preview & Save Teacher'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      );
    })()}

    {/* ═══ TEACHING ALLOCATIONS MODAL ═══ */}
    {allocOpen && allocTeacher && <Modal title={`Manage Allocations — ${allocTeacher.name}`} close={() => setAllocOpen(false)}>
      <div style={{ padding: '10px 4px' }}>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
          Assign subject-class-section combinations for this teacher. Each row is one teaching allocation.
        </p>
        <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 12 }}>
          {allocRows.map((ar, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 8, alignItems: 'end' }}>
              {/* Subject */}
              <label style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'Subject' : ''}
                <select value={ar.subject_id || ''} onChange={e => updateAllocRow(idx, 'subject_id', e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  <option value="">Subject</option>
                  {allocSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              {/* Class */}
              <label style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'Class' : ''}
                <select value={ar.class_id || ''} onChange={e => updateAllocRow(idx, 'class_id', e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  <option value="">Class</option>
                  {allocClasses.map(c => <option key={c.id} value={c.id}>Class {c.class_number}</option>)}
                </select>
              </label>
              {/* Section */}
              <label style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'Section' : ''}
                <select value={ar.section_id || ''} onChange={e => updateAllocRow(idx, 'section_id', e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  <option value="">Section</option>
                  {allocSections.filter(s => !ar.class_id || s.class_id === ar.class_id || String(s.class_number) === String(allocClasses.find(c => c.id === ar.class_id)?.class_number)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              {/* Session */}
              <label style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'Session' : ''}
                <select value={ar.session_id || ''} onChange={e => updateAllocRow(idx, 'session_id', e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  <option value="">Session</option>
                  {allocSessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              {/* Alt Faculty */}
              <label style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'Alt. Faculty' : ''}
                <select value={ar.alt_teacher_id || ''} onChange={e => updateAllocRow(idx, 'alt_teacher_id', e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  <option value="">None</option>
                  {rows.filter(t => t.id !== allocTeacher.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => removeAllocRow(idx)} title="Remove" style={{ padding: '5px 8px', background: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" onClick={addAllocRow} style={{ fontSize: 12, padding: '5px 12px', background: 'transparent', border: '1px dashed var(--border)', color: '#2563eb', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>+ Add Row</button>
          <button type="button" onClick={handleInitiateAllocSave} disabled={allocSaving}
            style={{ background: '#2563eb', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13 }}>
            Review & Save Allocations
          </button>
        </div>
      </div>
    </Modal>}

    {/* EXCEL / CSV BULK IMPORT MODAL */}
    {importOpen && (
      <Modal
        title="Bulk Import Teachers (Excel / CSV)"
        fullWindow={true}
        close={() => { setImportOpen(false); setPreviewRows([]); }}
      >
        <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Last Registered Teacher Banner in Red */}
          {lastRegisteredTeacherInfo && (
            <div style={{
              color: '#ef4444',
              fontSize: 12.5,
              fontWeight: 600,
              padding: '8px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 6,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0
            }}>
              <Info size={15} style={{ flexShrink: 0, color: '#ef4444' }} />
              <span>
                Last registered teacher: <strong style={{ color: '#ef4444' }}>{lastRegisteredTeacherInfo.name}</strong> | Employee ID: <strong style={{ color: '#ef4444' }}>{lastRegisteredTeacherInfo.employeeId}</strong>
              </span>
            </div>
          )}
          {previewRows.length === 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexShrink: 0 }}>
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

              <label className="dropzone" style={{ flexShrink: 0, padding: '30px 20px', maxWidth: 760, width: '100%', margin: '0 auto 16px' }}>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFile}
                  style={{ display: 'none' }}
                />
                <div className="dropzone-icon">
                  <UploadCloud size={28} />
                </div>
                <strong style={{ fontSize: 15 }}>Click to browse or drop Excel file here</strong>
                <span className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</span>
              </label>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Review parsed faculty roster below before confirming import.
              </p>
              <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, padding: '5px 12px', borderRadius: 6 }}>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFile}
                  style={{ display: 'none' }}
                />
                <UploadCloud size={14} /> Upload Different File
              </label>
            </div>
          )}

          {previewRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginTop: 8 }}>
              {/* ── ERROR / VALIDITY SUMMARY BANNER ── */}
              <div style={{
                marginBottom: 10,
                padding: '10px 16px',
                background: teacherErrorCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                borderRadius: 8,
                border: `1px solid ${teacherErrorCount > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                fontSize: 13,
                color: teacherErrorCount > 0 ? '#f59e0b' : '#10b981',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <span>
                  {teacherErrorCount > 0 ? '⚠️' : '✅'} <b>{previewRows.length} faculty</b> parsed · <b>{teacherValidCount} valid</b>
                  {teacherErrorCount > 0 && (
                    <> · <b style={{ color: '#ef4444' }}>{teacherErrorCount} with validation errors</b></>
                  )}
                </span>
                <span style={{ fontSize: 12, color: teacherErrorCount > 0 ? '#f59e0b' : '#10b981' }}>
                  {teacherErrorCount > 0
                    ? 'Review and resolve highlighted errors below before importing'
                    : 'All records valid and ready for database import'}
                </span>
              </div>

              {/* ── TOP TOOLBAR: Search, Filter Tabs, Page Size & Clear ── */}
              <div className="preview-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 15 }}>Preview Data</strong>
                  <span style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', borderRadius: 10, fontWeight: 600 }}>
                    {previewRows.length} records
                  </span>

                  {/* Filter tabs if validation errors exist */}
                  {teacherErrorCount > 0 && (
                    <div style={{ display: 'inline-flex', background: 'var(--card-subtle, #f1f5f9)', borderRadius: 6, padding: 2, fontSize: 12, marginLeft: 4 }}>
                      <button
                        type="button"
                        onClick={() => { setImportPreviewErrorFilter('all'); setImportPreviewPage(1); }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: importPreviewErrorFilter === 'all' ? 'var(--bg-card, #ffffff)' : 'transparent',
                          color: importPreviewErrorFilter === 'all' ? 'var(--text, #0f172a)' : 'var(--text-secondary, #64748b)',
                          boxShadow: importPreviewErrorFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                          fontWeight: importPreviewErrorFilter === 'all' ? 600 : 400
                        }}
                      >
                        All ({previewRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setImportPreviewErrorFilter('valid'); setImportPreviewPage(1); }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: importPreviewErrorFilter === 'valid' ? 'var(--bg-card, #ffffff)' : 'transparent',
                          color: importPreviewErrorFilter === 'valid' ? '#10b981' : 'var(--text-secondary, #64748b)',
                          boxShadow: importPreviewErrorFilter === 'valid' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                          fontWeight: importPreviewErrorFilter === 'valid' ? 600 : 400
                        }}
                      >
                        Valid ({teacherValidCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setImportPreviewErrorFilter('errors'); setImportPreviewPage(1); }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: importPreviewErrorFilter === 'errors' ? 'var(--bg-card, #ffffff)' : 'transparent',
                          color: importPreviewErrorFilter === 'errors' ? '#ef4444' : 'var(--text-secondary, #64748b)',
                          boxShadow: importPreviewErrorFilter === 'errors' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                          fontWeight: importPreviewErrorFilter === 'errors' ? 600 : 400
                        }}
                      >
                        ⚠ Errors ({teacherErrorCount})
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Search inside preview */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} style={{ position: 'absolute', left: 8, color: '#94a3b8', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Search preview..."
                      value={importPreviewSearch}
                      onChange={(e) => { setImportPreviewSearch(e.target.value); setImportPreviewPage(1); }}
                      style={{
                        padding: '5px 26px 5px 28px',
                        fontSize: 12.5,
                        border: '1px solid var(--border, #cbd5e1)',
                        borderRadius: 6,
                        width: 180,
                        background: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #0f172a)'
                      }}
                    />
                    {importPreviewSearch && (
                      <button
                        type="button"
                        onClick={() => { setImportPreviewSearch(''); setImportPreviewPage(1); }}
                        style={{
                          position: 'absolute',
                          right: 6,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                          color: '#94a3b8'
                        }}
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Rows per page selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary, #475569)' }}>
                    <span>Rows per page:</span>
                    <select
                      value={importPreviewPageSize}
                      onChange={(e) => { setImportPreviewPageSize(Number(e.target.value)); setImportPreviewPage(1); }}
                      style={{
                        padding: '4px 8px',
                        fontSize: 12.5,
                        borderRadius: 6,
                        border: '1px solid var(--border, #cbd5e1)',
                        background: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #1e293b)',
                        cursor: 'pointer'
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25 (Default)</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                      <option value={500}>500</option>
                      <option value={100000}>All ({previewRows.length})</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => { setPreviewRows([]); setImportErrors([]); setImportPreviewPage(1); setImportPreviewSearch(''); }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* ── PREVIEW TABLE ── */}
              <div className="preview-table-container" style={{ flex: 1, minHeight: 320, overflow: 'auto' }}>
                <table style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 44, textAlign: 'center' }}>#</th>
                      <th style={{ minWidth: 110 }}>Savior_No</th>
                      <th style={{ minWidth: 120 }}>First Name</th>
                      <th style={{ minWidth: 120 }}>Middle Name</th>
                      <th style={{ minWidth: 120 }}>Last Name</th>
                      <th style={{ minWidth: 150 }}>Full Name</th>
                      <th style={{ minWidth: 180 }}>Email ID</th>
                      <th style={{ minWidth: 90 }}>Gender</th>
                      <th style={{ minWidth: 110 }}>Joining Date</th>
                      <th style={{ minWidth: 130 }}>Designation</th>
                      <th style={{ minWidth: 140 }}>Class & Section</th>
                      <th style={{ minWidth: 100 }}>Status</th>
                      <th style={{ minWidth: 140 }}>Email Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTeacherPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={13} style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
                          No teachers match the current search or error filter.
                        </td>
                      </tr>
                    ) : (
                      displayedTeacherPreviewRows.map((r, i) => {
                        const rowNum = r._origRowIndex || (teacherStartIdx + i + 1);
                        const hasErr = Boolean(r._errors?.length);
                        return (
                          <tr key={teacherStartIdx + i} className={hasErr ? 'preview-row-error' : ''} style={{ background: hasErr ? 'rgba(239, 68, 68, 0.12)' : undefined, outline: hasErr ? '1px solid rgba(239, 68, 68, 0.35)' : undefined }}>
                            <td style={{ color: hasErr ? '#dc2626' : '#94a3b8', fontSize: 11, textAlign: 'center', fontWeight: hasErr ? 700 : 500 }}>
                              {hasErr ? `⚠ ${rowNum}` : rowNum}
                            </td>
                            <td style={{ color: r._errors?.some((e: any) => e.field === 'Savior_No') ? '#dc2626' : undefined }}>
                              <code>{r.saviorNo || r.employeeId}</code>
                              {r._errors?.filter((e: any) => e.field === 'Savior_No').map((e: any, j: number) => (
                                <div key={j} style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>{e.message}</div>
                              ))}
                            </td>
                            <td>{r.firstName || '—'}</td>
                            <td>{r.middleName || r.middle_name || '—'}</td>
                            <td>{r.lastName || '—'}</td>
                            <td style={{ color: r._errors?.some((e: any) => e.field === 'Full Name' || e.field === 'First Name') ? '#dc2626' : undefined }}>
                              <b>{r.name}</b>
                              {r._errors?.filter((e: any) => e.field === 'Full Name' || e.field === 'First Name').map((e: any, j: number) => (
                                <div key={j} style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>{e.message}</div>
                              ))}
                            </td>
                            <td style={{ color: r._errors?.some((e: any) => e.field === 'Email_id' || e.field === 'Email ID') ? '#dc2626' : undefined }}>
                              {r.email}
                              {r._errors?.filter((e: any) => e.field === 'Email_id' || e.field === 'Email ID').map((e: any, j: number) => (
                                <div key={j} style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>{e.message}</div>
                              ))}
                            </td>
                            <td>
                              {r.gender ? (
                                <span
                                  className={`gender-chip ${/^f/i.test(r.gender) ? 'gender-female' : /^m/i.test(r.gender) ? 'gender-male' : 'gender-other'}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '1px 7px',
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 500,
                                    background: /^f/i.test(r.gender) ? '#fdf2f8' : /^m/i.test(r.gender) ? '#f0f9ff' : '#f8fafc',
                                    color: /^f/i.test(r.gender) ? '#db2777' : /^m/i.test(r.gender) ? '#0284c7' : '#64748b',
                                    border: `1px solid ${/^f/i.test(r.gender) ? '#fbcfe8' : /^m/i.test(r.gender) ? '#bae6fd' : '#e2e8f0'}`
                                  }}
                                >
                                  {r.gender}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ color: r._errors?.some((e: any) => e.field === 'Joining Date') ? '#dc2626' : undefined }}>
                              {r.joiningDate || r.joining_date || '—'}
                              {r._errors?.filter((e: any) => e.field === 'Joining Date').map((e: any, j: number) => (
                                <div key={j} style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>{e.message}</div>
                              ))}
                            </td>
                            <td>{r.designation || 'Teacher'}</td>
                            <td>{r.class ? `${r.class} — Sec ${r.section}` : '—'}</td>
                            <td><span className="badge active">{r.status || 'Active'}</span></td>
                            <td><span className="badge pending">Pending Dispatch</span></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── PAGINATION BAR ── */}
              <div className="preview-pagination-bar">
                <div style={{ color: 'var(--text-secondary, #475569)', fontSize: 12.5 }}>
                  {filteredTeacherPreviewRows.length === 0 ? (
                    'Showing 0 records'
                  ) : (
                    <>
                      Showing <b>{teacherStartIdx + 1}</b> to <b>{teacherEndIdx}</b> of <b>{filteredTeacherPreviewRows.length}</b> records
                      {filteredTeacherPreviewRows.length !== previewRows.length && (
                        <span style={{ opacity: 0.75, marginLeft: 4 }}>(filtered from {previewRows.length} total)</span>
                      )}
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    disabled={currentTeacherImportPage <= 1}
                    onClick={() => setImportPreviewPage(1)}
                    title="First Page"
                  >
                    <ChevronsLeft size={14} /> First
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    disabled={currentTeacherImportPage <= 1}
                    onClick={() => setImportPreviewPage(p => Math.max(1, p - 1))}
                    title="Previous Page"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px', fontSize: 12.5 }}>
                    <span>Page</span>
                    <select
                      value={currentTeacherImportPage}
                      onChange={(e) => setImportPreviewPage(Number(e.target.value))}
                      style={{
                        padding: '3px 6px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid var(--border, #cbd5e1)',
                        background: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #1e293b)',
                        cursor: 'pointer'
                      }}
                    >
                      {Array.from({ length: totalTeacherImportPages }, (_, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {idx + 1}
                        </option>
                      ))}
                    </select>
                    <span>of <b>{totalTeacherImportPages}</b></span>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    disabled={currentTeacherImportPage >= totalTeacherImportPages}
                    onClick={() => setImportPreviewPage(p => Math.min(totalTeacherImportPages, p + 1))}
                    title="Next Page"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    disabled={currentTeacherImportPage >= totalTeacherImportPages}
                    onClick={() => setImportPreviewPage(totalTeacherImportPages)}
                    title="Last Page"
                  >
                    Last <ChevronsRight size={14} />
                  </button>
                </div>
              </div>

              {/* ── MODAL FOOTER ── */}
              <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setImportOpen(false); setPreviewRows([]); setImportErrors([]); setImportPreviewPage(1); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitBulkImport}
                  disabled={importing || previewRows.length === 0}
                  style={{
                    background: teacherErrorCount > 0 ? '#ef4444' : '#10b981',
                    color: '#ffffff',
                    fontWeight: 600,
                    padding: '8px 20px',
                    cursor: (importing || previewRows.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {importing
                    ? 'Importing Teachers...'
                    : teacherErrorCount > 0
                      ? `Fix ${teacherErrorCount} Error(s) Before Import`
                      : `Confirm & Import ${teacherValidCount} Teachers`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>)}

    {/* Universal Teacher Preview & Edit Modal */}
    <UniversalPreviewModal
      isOpen={teacherPreview.isOpen}
      onClose={() => setTeacherPreview(prev => ({ ...prev, isOpen: false }))}
      onEdit={() => setTeacherPreview(prev => ({ ...prev, isOpen: false }))}
      onConfirm={executeConfirmTeacherSave}
      title={teacherPreview.title}
      subtitle={teacherPreview.subtitle}
      operationType={teacherPreview.operationType}
      confirmText={teacherPreview.confirmText}
      editText="Back to Edit"
      sections={teacherPreview.sections}
      changes={teacherPreview.changes}
      summaryCards={teacherPreview.summaryCards}
      loading={teacherPreview.loading}
      error={teacherPreview.error}
    />

    {/* Universal Allocations Preview Modal */}
    <UniversalPreviewModal
      isOpen={allocPreview.isOpen}
      onClose={() => setAllocPreview(prev => ({ ...prev, isOpen: false }))}
      onEdit={() => setAllocPreview(prev => ({ ...prev, isOpen: false }))}
      onConfirm={executeConfirmAllocSave}
      title={`Confirm Teaching Allocations — ${allocTeacher?.name || 'Faculty'}`}
      subtitle="Verify assigned subjects, classes, and sections before committing"
      operationType="submit"
      confirmText="Confirm & Save Allocations"
      editText="Back to Edit"
      tableData={allocPreview.tableData}
      loading={allocPreview.loading}
      error={allocPreview.error}
    />

    {/* Destructive Confirm Modal for Single / Bulk Teacher Deletion */}
    <DestructiveConfirmModal
      isOpen={deleteTeacherDialog.isOpen}
      onClose={() => setDeleteTeacherDialog(prev => ({ ...prev, isOpen: false }))}
      onConfirm={executeConfirmDeleteTeacher}
      title={deleteTeacherDialog.isBulk ? "Confirm Bulk Faculty Deletion" : "Confirm Faculty Deactivation"}
      entityName={deleteTeacherDialog.entityName}
      entityType={deleteTeacherDialog.entityType}
      details={deleteTeacherDialog.details}
      warningMessage={deleteTeacherDialog.warningMessage}
      confirmText={deleteTeacherDialog.confirmText}
      loading={deleteTeacherDialog.loading}
      error={deleteTeacherDialog.error}
    />

    {/* ═══ EXPORT PREVIEW MODAL ═══ */}
    {exportOpen && <Modal title="Export Faculty Directory (Preview)" close={() => setExportOpen(false)}>
      <div style={{ padding: '4px 2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {selectedIds.size > 0
                ? `Exporting ${selectedIds.size} manually selected faculty record${selectedIds.size > 1 ? 's' : ''}`
                : `Exporting ${prepareExportData().length} faculty record${prepareExportData().length !== 1 ? 's' : ''} matching current filters`}
            </div>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>
              {selectedIds.size > 0
                ? 'Manual selection active across faculty directory.'
                : `Filters: Gender [${genderFilter || 'All'}], Designation [${designationFilter || 'All'}]${search ? `, Search ["${search}"]` : ''}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={prepareExportData().length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: prepareExportData().length === 0 ? '#94a3b8' : '#10b981',
                color: '#ffffff',
                cursor: prepareExportData().length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <FileSpreadsheet size={15} /> Download Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={prepareExportData().length === 0}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: prepareExportData().length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Download size={15} /> Download CSV (.csv)
            </button>
          </div>
        </div>

        <div className="preview-table-container" style={{ maxHeight: 380, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Savior_No</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Last Name</th>
                <th>Full Name</th>
                <th>Email_id</th>
                <th>Gender</th>
                <th>Joining Date</th>
                <th>Class / Allocation</th>
                <th>Status</th>
                <th>Designation</th>
                <th>Mobile</th>
              </tr>
            </thead>
            <tbody>
              {prepareExportData().slice(0, 15).map((r, i) => (
                <tr key={i}>
                  <td><code>{r['Savior_No'] || '—'}</code></td>
                  <td>{r['First Name'] || '—'}</td>
                  <td>{r['Middle Name'] || '—'}</td>
                  <td>{r['Last Name'] || '—'}</td>
                  <td><b>{r['Full Name(Automatically generated)']}</b></td>
                  <td>{r['Email_id']}</td>
                  <td>
                    {r['Gender'] ? (
                      <span className={`badge ${String(r['Gender']).toLowerCase() === 'female' ? 'role-teacher' : 'role-admin'}`} style={{ fontSize: 11 }}>
                        {r['Gender']}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{r['Joining_Date'] ? <code>{r['Joining_Date']}</code> : '—'}</td>
                  <td>{r['Class'] || '—'}</td>
                  <td><span className="badge active">{r['Status']}</span></td>
                  <td>{r['Designation']}</td>
                  <td>{r['Mobile'] ? <code>{r['Mobile']}</code> : '—'}</td>
                </tr>
              ))}
              {prepareExportData().length === 0 && (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                    No faculty records match the selected filters or manual selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {prepareExportData().length > 15 && (
          <p className="muted" style={{ fontSize: 11, margin: '8px 0 0', textAlign: 'center' }}>
            Showing first 15 of {prepareExportData().length} faculty records in preview. Full dataset will be included in the export file.
          </p>
        )}
      </div>
    </Modal>}
  </Layout>
}

/* ────── Classes ────── */
function formatClassTitle(classNumber: any, label?: string): string {
  const num = Number(classNumber);
  if (num === -1 || classNumber === '-1' || (typeof classNumber === 'string' && /l.?kg/i.test(classNumber)) || (typeof label === 'string' && /l.?kg/i.test(label))) {
    return 'Class L KG';
  }
  if (num === 0 || classNumber === '0' || (typeof classNumber === 'string' && /u.?kg/i.test(classNumber)) || (typeof label === 'string' && /u.?kg/i.test(label))) {
    return 'Class U KG';
  }
  if (!isNaN(num) && num > 0) {
    return `Class ${num}`;
  }
  if (label && !label.includes('-1') && !label.includes('Class 0')) {
    return label;
  }
  return classNumber ? `Class ${classNumber}` : 'Class';
}

function indexToSectionLabel(num: number): string {
  let label = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    num = Math.floor((num - 1) / 26);
  }
  return label;
}

function sectionLabelToIndex(label: string): number | null {
  const clean = String(label || '').trim().toUpperCase();
  if (!clean || !/^[A-Z]+$/.test(clean)) return null;
  let num = 0;
  for (let i = 0; i < clean.length; i++) {
    num = num * 26 + (clean.charCodeAt(i) - 64);
  }
  return num;
}

function Classes() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const loc = useLocation();
  const nav = useNavigate();
  const searchParams = new URLSearchParams(loc.search);
  const [activeTab, setActiveTab] = useState<'CLASSES' | 'TEMPORARY'>(
    searchParams.get('tab') === 'temporary' ? 'TEMPORARY' : 'CLASSES'
  );

  const getStoredSession = () => localStorage.getItem('attendo_academic_session') || localStorage.getItem('attendo_active_academic_year') || '';
  const getStoredYearId = () => localStorage.getItem('attendo_active_academic_year_id') || '';

  const [activeSession, setActiveSession] = useState<string>(getStoredSession);
  const [activeYearId, setActiveYearId] = useState<string>(getStoredYearId);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const tab = params.get('tab');
    if (tab === 'temporary') {
      setActiveTab('TEMPORARY');
    } else if (tab === 'mentors') {
      setActiveTab('CLASSES');
      nav('/classes', { replace: true });
    } else if (tab === 'classes') {
      setActiveTab('CLASSES');
    }
  }, [loc.search, nav]);
  const [c, setC] = useState<any[]>([]);
  const [s, setS] = useState<any[]>([]);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [addingClassId, setAddingClassId] = useState<string | null>(null);
  const [confirmRemoveSectionModal, setConfirmRemoveSectionModal] = useState<{
    classItem: any;
    section: any;
    classTitle: string;
    sectionLabel: string;
  } | null>(null);
  const [removingSection, setRemovingSection] = useState(false);

  // Class Mentors State
  const [mentors, setMentors] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [mentorError, setMentorError] = useState<string | null>(null);
  const [mentorSearch, setMentorSearch] = useState('');

  // Active Temporary Teacher Substitutions Count
  const [activeSubstitutionsCount, setActiveSubstitutionsCount] = useState<number>(0);

  const loadActiveSubstitutionsCount = useCallback(async () => {
    try {
      const res = await listAssignments({ status: 'active' });
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const now = new Date();
      const count = raw.filter((a: any) => {
        const start = new Date(a.start_at);
        const end = new Date(a.end_at);
        return (a.status === 'active' || (start <= now && end > now)) && start <= now && end > now;
      }).length;
      setActiveSubstitutionsCount(count);
    } catch (err) {
      console.error('Failed to load active substitutions count:', err);
    }
  }, []);

  const handleAssignmentsUpdated = useCallback((e?: Event) => {
    const customEvt = e as CustomEvent<{ count?: number }> | undefined;
    if (typeof customEvt?.detail?.count === 'number') {
      setActiveSubstitutionsCount(customEvt.detail.count);
    } else {
      loadActiveSubstitutionsCount();
    }
  }, [loadActiveSubstitutionsCount]);

  useEffect(() => {
    window.addEventListener('temporary-assignments-updated', handleAssignmentsUpdated);
    return () => window.removeEventListener('temporary-assignments-updated', handleAssignmentsUpdated);
  }, [handleAssignmentsUpdated]);

  // Assign / Change Modal State
  const [assignModal, setAssignModal] = useState<{
    section_id: string;
    class_id: string;
    class_number: number;
    section_name: string;
    current_teacher_id: string | null;
    is_change: boolean;
  } | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Remove Modal State
  const [removeModal, setRemoveModal] = useState<{
    section_id: string;
    class_id: string;
    class_number: number;
    section_name: string;
    teacher_name: string;
  } | null>(null);
  const [removing, setRemoving] = useState(false);

  function getSectionsForClass(classItem: any): any[] {
    const matching = s.filter(sec =>
      sec.class_id === classItem.id ||
      (classItem.class_number !== undefined && Number(sec.class_number) === Number(classItem.class_number))
    );
    return matching.sort((a, b) => {
      const idxA = sectionLabelToIndex(a.name || a.section_name || '');
      const idxB = sectionLabelToIndex(b.name || b.section_name || '');
      if (idxA !== null && idxB !== null) return idxA - idxB;
      if (idxA !== null) return -1;
      if (idxB !== null) return 1;
      return String(a.name || a.section_name || '').localeCompare(String(b.name || b.section_name || ''));
    });
  }

  function getSectionCount(classItem: any): number {
    return getSectionsForClass(classItem).length;
  }

  function getNextAvailableLabel(classSections: any[]): string {
    const existingLabels = new Set(
      classSections.map(sec => String(sec.name || sec.section_name || '').trim().toUpperCase())
    );
    let idx = 1;
    while (existingLabels.has(indexToSectionLabel(idx))) {
      idx++;
    }
    return indexToSectionLabel(idx);
  }

  function getHighestSequentialSection(classSections: any[]): any | null {
    if (!classSections || classSections.length === 0) return null;
    const sorted = [...classSections].sort((a, b) => {
      const labelA = String(a.name || a.section_name || '').trim().toUpperCase();
      const labelB = String(b.name || b.section_name || '').trim().toUpperCase();
      const idxA = sectionLabelToIndex(labelA);
      const idxB = sectionLabelToIndex(labelB);
      if (idxA !== null && idxB !== null) return idxB - idxA;
      if (idxA !== null) return -1;
      if (idxB !== null) return 1;
      return labelB.localeCompare(labelA);
    });
    return sorted[0] || null;
  }

  function toggleClassExpanded(classKey: string) {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classKey)) {
        next.delete(classKey);
      } else {
        next.add(classKey);
      }
      return next;
    });
  }

  function toggleAllClasses() {
    if (expandedClasses.size === c.length) {
      setExpandedClasses(new Set());
    } else {
      const allKeys = new Set(c.map(item => String(item.id || item.class_number)));
      setExpandedClasses(allKeys);
    }
  }

  async function load(targetYearId = activeYearId, targetSession = activeSession){
    try {
      const params: any = {};
      if (targetYearId) params.academic_year_id = targetYearId;
      if (targetSession) params.session = targetSession;

      const [cr, sr]=await Promise.all([
        api.get('/classes', { params }), 
        api.get('/sections', { params })
      ]);
      const classesData = [...(cr.data || [])].sort((a: any, b: any) => Number(a.class_number ?? 0) - Number(b.class_number ?? 0));
      const sectionsData = [...(sr.data || [])].sort((a: any, b: any) => (Number(a.class_number ?? 0) - Number(b.class_number ?? 0)) || String(a.name || '').localeCompare(String(b.name || '')));
      setC(classesData);
      setS(sectionsData);
    } catch (err) {
      console.error('Failed to load classes and sections:', err);
    }
  }

  async function loadMentors(targetYearId = activeYearId, targetSession = activeSession){
    setMentorsLoading(true);
    setMentorError(null);
    try {
      const params: any = {};
      if (targetYearId) params.academic_year_id = targetYearId;
      if (targetSession) params.session = targetSession;

      const [mRes, tRes] = await Promise.all([
        api.get('/admin/mentors', { params }),
        api.get('/teachers')
      ]);
      const rawMentors = Array.isArray(mRes.data) ? mRes.data : [];
      const rawTeachers = Array.isArray(tRes.data) ? tRes.data : (tRes.data?.data || []);

      setMentors(rawMentors);
      // Filter strictly active, non-archived teachers
      const activeTeachers = rawTeachers.filter((t: any) =>
        t && t.is_active !== false && t.status !== 'DELETED' && t.status !== 'ARCHIVED'
      );
      setTeachers(activeTeachers);
    } catch (err: any) {
      console.error('Failed to load mentors:', err);
      setMentorError(err?.response?.data?.message || 'Failed to fetch class mentor allocations.');
    } finally {
      setMentorsLoading(false);
    }
  }

  useEffect(() => {
    const s = getStoredSession();
    const y = getStoredYearId();
    load(y, s);
    loadMentors(y, s);
    loadActiveSubstitutionsCount();
  }, [loadActiveSubstitutionsCount]);

  useEffect(() => {
    const handleSessionChange = (e: any) => {
      const targetObj = typeof e?.detail === 'object' ? e.detail : null;
      const newSessionName = targetObj?.name || (typeof e?.detail === 'string' ? e.detail : '') || getStoredSession();
      const newYearId = targetObj?.id || getStoredYearId();
      setActiveSession(newSessionName);
      setActiveYearId(newYearId);
      load(newYearId, newSessionName);
      loadMentors(newYearId, newSessionName);
    };

    const handleStorage = () => {
      const s = getStoredSession();
      const y = getStoredYearId();
      setActiveSession(s);
      setActiveYearId(y);
      load(y, s);
      loadMentors(y, s);
    };

    window.addEventListener('sessionChanged', handleSessionChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('sessionChanged', handleSessionChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'TEMPORARY') {
      loadActiveSubstitutionsCount();
    }
  }, [activeTab, loadActiveSubstitutionsCount]);

  async function handleAddSectionForClass(classItem: any) {
    const classKey = String(classItem.id || classItem.class_number);
    if (addingClassId || removingSection) return;

    const classSections = getSectionsForClass(classItem);
    const nextLabel = getNextAvailableLabel(classSections);
    const targetCid = classItem.id || classKey;

    // Immediately keep/make class expanded so admin sees immediate result
    setExpandedClasses(prev => new Set(prev).add(classKey));
    setAddingClassId(classKey);

    try {
      const res = await api.post('/sections', { classId: targetCid, name: nextLabel, academic_year_id: activeYearId });
      const created = res.data;
      setS(prev => {
        const filtered = prev.filter(x =>
          !((x.class_id === created.class_id || Number(x.class_number) === Number(created.class_number)) &&
            String(x.name || x.section_name).toUpperCase() === nextLabel)
        );
        return [...filtered, created].sort((a, b) => (Number(a.class_number ?? 0) - Number(b.class_number ?? 0)) || String(a.name || '').localeCompare(String(b.name || '')));
      });
      setC(prev => prev.map(cls => {
        if (cls.id === classItem.id || (created.class_number !== undefined && Number(cls.class_number) === Number(created.class_number))) {
          return { ...cls, section_count: Math.max((cls.section_count || 1), (cls.section_count || 1) + 1) };
        }
        return cls;
      }));
      await load(activeYearId, activeSession);
      await loadMentors(activeYearId, activeSession);
    } catch(err: any){
      alert(err?.response?.data?.message || `Failed to add Section ${nextLabel} for ${formatClassTitle(classItem.class_number, classItem.label)}.`);
    } finally {
      setAddingClassId(null);
    }
  }

  function handleOpenRemoveModal(classItem: any) {
    const classSections = getSectionsForClass(classItem);
    if (classSections.length <= 1) return; // Follow minimum section count rule (minimum 1 section)
    const highest = getHighestSequentialSection(classSections);
    if (!highest) return;

    const classKey = String(classItem.id || classItem.class_number);
    setExpandedClasses(prev => new Set(prev).add(classKey));

    setConfirmRemoveSectionModal({
      classItem,
      section: highest,
      classTitle: formatClassTitle(classItem.class_number, classItem.label),
      sectionLabel: String(highest.name || highest.section_name || '').trim().toUpperCase()
    });
  }

  async function handleConfirmRemoveSection() {
    if (!confirmRemoveSectionModal) return;
    const { classItem, section, classTitle, sectionLabel } = confirmRemoveSectionModal;
    setRemovingSection(true);
    try {
      const res = await api.delete(`/sections/${section.id}`);
      if (res.data?.success === false) {
        alert(res.data?.message || `Failed to remove Section ${sectionLabel} from ${classTitle}.`);
        return;
      }
      setS(prev => prev.filter(x => x.id !== section.id));
      setC(prev => prev.map(cls => {
        if (cls.id === classItem.id || Number(cls.class_number) === Number(classItem.class_number)) {
          return { ...cls, section_count: Math.max(1, (cls.section_count || 2) - 1) };
        }
        return cls;
      }));
      setConfirmRemoveSectionModal(null);
      await load();
      await loadMentors();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || `Failed to remove Section ${sectionLabel} from ${classTitle}.`);
    } finally {
      setRemovingSection(false);
    }
  }

  // Mentor Assign Submit Handler
  async function submitMentorAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignModal || !selectedTeacherId) {
      alert('Validation Error: Please select a teacher to assign as Class Mentor.');
      return;
    }
    setAssigning(true);
    try {
      await api.post('/admin/mentors', {
        class_id: assignModal.class_id,
        section_id: assignModal.section_id,
        teacher_id: selectedTeacherId
      });
      setAssignModal(null);
      setSelectedTeacherId('');
      await loadMentors();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to assign class mentor.');
    } finally {
      setAssigning(false);
    }
  }

  // Mentor Remove Submit Handler
  async function submitMentorRemove(e: React.FormEvent) {
    e.preventDefault();
    if (!removeModal) return;
    setRemoving(true);
    try {
      await api.delete('/admin/mentors', {
        data: {
          class_id: removeModal.class_id,
          section_id: removeModal.section_id
        }
      });
      setRemoveModal(null);
      await loadMentors();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to remove class mentor.');
    } finally {
      setRemoving(false);
    }
  }

  // Combine sections with mentor details for display
  const combinedMentors = useMemo(() => {
    return s.map(sec => {
      const cls = c.find(item => item.id === sec.class_id || Number(item.class_number) === Number(sec.class_number));
      const mRec = mentors.find(m =>
        (m.section_id === sec.id || (m.section_name === sec.name && Number(m.class_number) === Number(sec.class_number)))
      );
      const teacherObj = mRec?.teacher_id ? teachers.find(t => t.id === mRec.teacher_id) : null;

      return {
        section_id: sec.id,
        section_name: sec.name || sec.section_name || 'A',
        class_id: sec.class_id || cls?.id,
        class_number: cls?.class_number ?? sec.class_number ?? 10,
        mentor_record_id: mRec?.mentor_record_id || mRec?.id || null,
        teacher_id: mRec?.teacher_id || null,
        teacher_name: teacherObj?.name || mRec?.teacher_name || null,
        teacher_email: teacherObj?.email || mRec?.teacher_email || null,
        employee_id: teacherObj?.employee_id || teacherObj?.savior_no || mRec?.employee_id || null,
        assigned_at: mRec?.assigned_at || null
      };
    }).sort((a, b) => (Number(a.class_number) - Number(b.class_number)) || String(a.section_name).localeCompare(String(b.section_name)));
  }, [s, c, mentors, teachers]);

  const unassignedCount = combinedMentors.filter(m => !m.teacher_id).length;
  const assignedCount = combinedMentors.filter(m => Boolean(m.teacher_id)).length;

  const isSearching = mentorSearch.trim().length > 0;
  const searchLower = mentorSearch.trim().toLowerCase();

  const doesSectionMatch = (sec: any, classItem: any) => {
    if (!isSearching) return true;
    const secLabel = String(sec.name || sec.section_name || 'A').toUpperCase();
    const classNum = classItem.class_number ?? 10;
    const mRec = mentors.find(m =>
      m.section_id === sec.id || (m.section_name === secLabel && Number(m.class_number) === Number(classNum))
    );
    const teacherObj = mRec?.teacher_id ? teachers.find(t => t.id === mRec.teacher_id) : null;
    const teacherName = teacherObj?.name || mRec?.teacher_name || '';
    const employeeId = teacherObj?.employee_id || teacherObj?.savior_no || mRec?.employee_id || '';
    const teacherEmail = teacherObj?.email || mRec?.teacher_email || '';

    return (
      `section ${secLabel.toLowerCase()}`.includes(searchLower) ||
      secLabel.toLowerCase() === searchLower ||
      teacherName.toLowerCase().includes(searchLower) ||
      String(employeeId).toLowerCase().includes(searchLower) ||
      teacherEmail.toLowerCase().includes(searchLower) ||
      (searchLower === 'unassigned' && !mRec?.teacher_id) ||
      (searchLower === 'assigned' && Boolean(mRec?.teacher_id))
    );
  };

  const doesClassMatch = (classItem: any) => {
    if (!isSearching) return true;
    const classTitle = formatClassTitle(classItem.class_number, classItem.label).toLowerCase();
    const classNumStr = `class ${classItem.class_number}`.toLowerCase();
    const gradeStr = `grade ${classItem.class_number}`.toLowerCase();
    if (classTitle.includes(searchLower) || classNumStr.includes(searchLower) || gradeStr.includes(searchLower) || String(classItem.class_number) === searchLower) {
      return true;
    }
    const classSections = getSectionsForClass(classItem);
    return classSections.some(sec => doesSectionMatch(sec, classItem));
  };

  const displayedClasses = isSearching ? c.filter(doesClassMatch) : c;

  return <Layout>
    <div style={{ '--text-muted': dark ? '#94a3b8' : 'var(--text-secondary, #475569)' } as React.CSSProperties}>
      <PageHead title="Classes, Sections & Teachers" sub="Manage school classes, sections, and class teacher assignments." />
    </div>

    {/* Tab Navigation */}
    <div className="student-tab-bar" style={{ marginBottom: 20, borderBottom: 'none' }}>
      <button
        type="button"
        className={`student-tab-btn as-classes-tab-btn ${activeTab === 'CLASSES' ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('CLASSES');
          nav('/classes', { replace: true });
        }}
        style={{
          color: activeTab === 'CLASSES' ? '#ffffff' : (dark ? '#cbd5e1' : '#475569'),
          backgroundColor: activeTab === 'CLASSES' ? '#2563eb' : (dark ? '#1e293b' : '#f1f5f9'),
          borderColor: activeTab === 'CLASSES' ? '#2563eb' : (dark ? '#334155' : '#e2e8f0'),
          fontWeight: 600,
        }}
      >
        Class Administration ({s.length})
      </button>
      <button
        type="button"
        className={`student-tab-btn as-classes-tab-btn ${activeTab === 'TEMPORARY' ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('TEMPORARY');
          nav('/classes?tab=temporary', { replace: true });
        }}
        style={{
          color: activeTab === 'TEMPORARY' ? '#ffffff' : (dark ? '#cbd5e1' : '#475569'),
          backgroundColor: activeTab === 'TEMPORARY' ? '#2563eb' : (dark ? '#1e293b' : '#f1f5f9'),
          borderColor: activeTab === 'TEMPORARY' ? '#2563eb' : (dark ? '#334155' : '#e2e8f0'),
          fontWeight: 600,
        }}
      >
        Teacher Substitution ({activeSubstitutionsCount})
      </button>
    </div>

    {activeTab === 'CLASSES' && (
      /* TAB 1: Class Administration Integrated View */
      <div className="as-classes-tab-content">
        {/* Dynamic Statistics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div className="panel" style={{ padding: '16px 20px', margin: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Sections</span>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0', color: 'var(--text)' }}>{combinedMentors.length}</h2>
          </div>
          <div className="panel" style={{ padding: '16px 20px', margin: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: dark ? '#10b981' : '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Teachers Assigned</span>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0', color: dark ? '#10b981' : '#047857' }}>{assignedCount}</h2>
          </div>
          <div className="panel" style={{ padding: '16px 20px', margin: 0, borderLeft: unassignedCount > 0 ? (dark ? '4px solid #f59e0b' : '4px solid #d97706') : undefined }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: unassignedCount > 0 ? (dark ? '#f59e0b' : '#b45309') : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Unassigned Sections
            </span>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0', color: unassignedCount > 0 ? (dark ? '#f59e0b' : '#b45309') : 'var(--text)' }}>
              {unassignedCount}
            </h2>
          </div>
        </div>

        {/* Search & Action Bar */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
              <Search size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search by class, section, teacher name, or employee ID..."
                value={mentorSearch}
                onChange={e => setMentorSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text)' }}
              />
              {mentorSearch && (
                <button
                  type="button"
                  onClick={() => setMentorSearch('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  await Promise.all([load(), loadMentors()]);
                }}
                disabled={mentorsLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12.5, fontWeight: 600 }}
              >
                <RefreshCw size={14} className={mentorsLoading ? 'animate-spin' : ''} />
                <span>Refresh Allocations</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={toggleAllClasses}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', fontSize: 12.5, fontWeight: 600 }}
              >
                {expandedClasses.size === c.length ? 'Collapse All' : 'Expand All'}
              </button>
            </div>
          </div>
        </div>

        {/* Classes & Sections Directory Card */}
        <div className="as-classes-management-container">
          <div className="as-classes-card">
            {/* Document Header Bar */}
            <div className="as-classes-card-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                  Classes & Sections Directory
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Manage school grades, expandable sections, sequential divisions, and assigned class teachers.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 9999,
                    background: dark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(37, 99, 235, 0.08)',
                    color: dark ? '#818cf8' : '#2563eb',
                    border: dark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(37, 99, 235, 0.2)'
                  }}
                >
                  {c.length} Classes · {s.length} Total Sections
                </span>
              </div>
            </div>

            {/* Class rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {displayedClasses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  {isSearching ? (
                    <>
                      <UserX size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                      <p>No classes or sections matching &ldquo;{mentorSearch}&rdquo;.</p>
                    </>
                  ) : (
                    <>
                      <Layers size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                      <p>No classes available.</p>
                    </>
                  )}
                </div>
              ) : (
                displayedClasses.map((classItem, idx) => {
                  const classKey = String(classItem.id || classItem.class_number);
                  const classSections = getSectionsForClass(classItem);
                  const classTitleStr = formatClassTitle(classItem.class_number, classItem.label).toLowerCase();
                  const classTitleMatched = classTitleStr.includes(searchLower) || `class ${classItem.class_number}`.includes(searchLower) || String(classItem.class_number) === searchLower;
                  const displayedSections = isSearching && !classTitleMatched
                    ? classSections.filter(sec => doesSectionMatch(sec, classItem))
                    : classSections;
                  const isExpanded = isSearching || expandedClasses.has(classKey);
                  const isAdding = addingClassId === classKey;
                  const isRemoveDisabled = classSections.length <= 1 || Boolean(addingClassId) || removingSection;
                  const nextLabel = getNextAvailableLabel(classSections);
                  const highestSec = getHighestSequentialSection(classSections);
                  const classTitle = formatClassTitle(classItem.class_number, classItem.label);

                  return (
                    <div
                      key={classItem.id || classKey}
                      style={{
                        borderBottom: idx < displayedClasses.length - 1 ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      {/* Row Header */}
                      <div
                        className={`as-class-row-header ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => toggleClassExpanded(classKey)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleClassExpanded(classKey);
                          }
                        }}
                      >
                        {/* Left: Chevron + Class Title + Section Count Pill */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                              color: 'var(--text-secondary)',
                              transition: 'transform 0.2s ease',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}
                          >
                            <ChevronDown size={15} />
                          </div>

                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                            {classTitle}
                          </span>

                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 9999,
                              background: classSections.length > 0
                                ? (dark ? 'rgba(148, 163, 184, 0.15)' : '#e2e8f0')
                                : (dark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'),
                              color: classSections.length > 0
                                ? (dark ? '#cbd5e1' : '#475569')
                                : (dark ? '#f87171' : '#dc2626')
                            }}
                          >
                            {classSections.length} {classSections.length === 1 ? 'section' : 'sections'}
                          </span>
                        </div>

                        {/* Right: Action Buttons (Add Section & Remove Section) */}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={Boolean(addingClassId) || removingSection}
                            onClick={() => handleAddSectionForClass(classItem)}
                            title={`Add next sequential section (${nextLabel})`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 14px',
                              fontSize: 12.5,
                              fontWeight: 600,
                              borderRadius: 6
                            }}
                          >
                            {isAdding ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Adding...</span>
                              </>
                            ) : (
                              <>
                                <Plus size={14} />
                                <span>Add Section</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={isRemoveDisabled}
                            onClick={() => handleOpenRemoveModal(classItem)}
                            title={
                              classSections.length === 0
                                ? 'No sections to remove'
                                : classSections.length === 1
                                  ? 'Minimum 1 section required per class'
                                  : `Remove highest section (${highestSec?.name || highestSec?.section_name})`
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '6px 12px',
                              fontSize: 12.5,
                              fontWeight: 600,
                              borderRadius: 6,
                              cursor: isRemoveDisabled ? 'not-allowed' : 'pointer',
                              opacity: isRemoveDisabled ? 0.45 : 1,
                              background: dark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.06)',
                              color: dark ? '#f87171' : '#dc2626',
                              border: dark ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(239, 68, 68, 0.2)'
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Remove Section</span>
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Section List */}
                      {isExpanded && (
                        <div className="as-nested-sections-panel">
                          {displayedSections.length === 0 ? (
                            <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontStyle: 'italic', padding: '6px 0' }}>
                              {isSearching ? 'No sections matching search criteria in this class.' : 'No sections allocated for this class. Click Add Section above to create Section A.'}
                            </div>
                          ) : (
                            <div className="as-sections-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {displayedSections.map(sec => {
                                const secLabel = String(sec.name || sec.section_name || 'A').toUpperCase();
                                const targetClassId = classItem.id || sec.class_id;
                                const classNum = classItem.class_number ?? 10;
                                const mRec = mentors.find(m =>
                                  m.section_id === sec.id || (m.section_name === secLabel && Number(m.class_number) === Number(classNum))
                                );
                                const teacherObj = mRec?.teacher_id ? teachers.find(t => t.id === mRec.teacher_id) : null;
                                const teacherName = teacherObj?.name || mRec?.teacher_name;
                                const isAssigned = Boolean(mRec?.teacher_id);

                                return (
                                  <div
                                    key={sec.id}
                                    className="as-section-row"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      flexWrap: 'wrap',
                                      gap: 14,
                                      padding: '10px 16px',
                                      borderRadius: 8,
                                      background: dark ? 'rgba(30, 41, 59, 0.7)' : 'var(--bg-card, #ffffff)',
                                      border: isAssigned
                                        ? (dark ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid #e2e8f0')
                                        : (dark ? '1px dashed rgba(245, 158, 11, 0.35)' : '1px dashed #cbd5e1')
                                    }}
                                  >
                                    {/* Left: Section Identity */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 130 }}>
                                      <span
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          width: 28,
                                          height: 28,
                                          borderRadius: '50%',
                                          background: isAssigned
                                            ? (dark ? 'rgba(37, 99, 235, 0.25)' : 'rgba(37, 99, 235, 0.1)')
                                            : (dark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.12)'),
                                          color: isAssigned
                                            ? (dark ? '#60a5fa' : '#2563eb')
                                            : (dark ? '#fbbf24' : '#d97706'),
                                          fontWeight: 700,
                                          fontSize: 13,
                                          flexShrink: 0
                                        }}
                                      >
                                        {secLabel}
                                      </span>
                                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                                        Section {secLabel}
                                      </span>
                                    </div>

                                    {/* Status Badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                      {isAssigned ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600, background: 'rgba(16, 185, 129, 0.12)', color: dark ? '#34d399' : '#047857', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                          <Check size={12} /> Assigned
                                        </span>
                                      ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600, background: 'rgba(245, 158, 11, 0.12)', color: dark ? '#fbbf24' : '#b45309', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                          <AlertTriangle size={12} /> Unassigned
                                        </span>
                                      )}
                                    </div>

                                    {/* Middle: Class Teacher Info */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        Class Teacher:
                                      </span>
                                      {isAssigned ? (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>
                                            {teacherName}
                                          </span>
                                          {(teacherObj?.employee_id || mRec?.employee_id) && (
                                            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', padding: '1px 6px', borderRadius: 4 }}>
                                              [{teacherObj?.employee_id || mRec?.employee_id}]
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: 13, color: dark ? '#fbbf24' : '#b45309', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                          <AlertTriangle size={13} style={{ flexShrink: 0 }} /> No Teacher Assigned
                                        </span>
                                      )}
                                    </div>

                                    {/* Right: Teacher Action Controls */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                      {isAssigned ? (
                                        <>
                                          <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => {
                                              setSelectedTeacherId(mRec.teacher_id);
                                              setAssignModal({
                                                section_id: sec.id,
                                                class_id: targetClassId,
                                                class_number: classNum,
                                                section_name: secLabel,
                                                current_teacher_id: mRec.teacher_id,
                                                is_change: true
                                              });
                                            }}
                                            title={`Change permanent class teacher for Class ${classNum} Section ${secLabel}`}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 5,
                                              padding: '5px 12px',
                                              fontSize: 12,
                                              fontWeight: 600,
                                              borderRadius: 6
                                            }}
                                          >
                                            <UserCheck size={13} />
                                            <span>Change Teacher</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setRemoveModal({
                                                section_id: sec.id,
                                                class_id: targetClassId,
                                                class_number: classNum,
                                                section_name: secLabel,
                                                teacher_name: teacherName || 'Teacher'
                                              });
                                            }}
                                            title={`Remove class teacher assignment for Section ${secLabel}`}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 4,
                                              padding: '5px 10px',
                                              fontSize: 12,
                                              fontWeight: 600,
                                              borderRadius: 6,
                                              background: dark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                                              color: dark ? '#f87171' : '#dc2626',
                                              border: dark ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(239, 68, 68, 0.2)',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            <Trash2 size={13} />
                                            <span>Remove Teacher</span>
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn-primary"
                                          onClick={() => {
                                            setSelectedTeacherId(teachers[0]?.id || '');
                                            setAssignModal({
                                              section_id: sec.id,
                                              class_id: targetClassId,
                                              class_number: classNum,
                                              section_name: secLabel,
                                              current_teacher_id: null,
                                              is_change: false
                                            });
                                          }}
                                          title={`Assign permanent class teacher for Class ${classNum} Section ${secLabel}`}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            padding: '5px 14px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            borderRadius: 6
                                          }}
                                        >
                                          <UserPlus size={13} />
                                          <span>Assign Teacher</span>
                                        </button>
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
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {activeTab === 'TEMPORARY' && (
      /* TAB 2: Teacher Substitution View */
      <div className="as-temporary-tab-content">
        <Suspense fallback={
          <div className="panel" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
            <p>Loading Teacher Substitution...</p>
          </div>
        }>
          <TemporaryAssignments embedded onAssignmentsChange={loadActiveSubstitutionsCount} />
        </Suspense>
      </div>
    )}

    {/* Assign / Change Mentor Modal */}
    {assignModal && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 460, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              {assignModal.is_change ? 'Change Class Teacher' : 'Assign Class Teacher'}
            </h3>
            <button type="button" onClick={() => setAssignModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }} aria-label="Close modal">
              <X size={18} />
            </button>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Target Section: <strong style={{ color: dark ? '#38bdf8' : 'var(--primary-600, #2563eb)' }}>{formatClassTitle(assignModal.class_number)} — Section {assignModal.section_name}</strong>
          </p>

          <form onSubmit={submitMentorAssign}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Select Active Faculty Member <span style={{ color: '#f43f5e' }}>*</span>
              </label>
              <select
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13.5 }}
                required
              >
                <option value="">-- Choose Faculty Member --</option>
                {teachers.map(t => {
                  const emp = t.employee_id || t.savior_no || t.employeeId || 'EMP';
                  const otherMentored = combinedMentors.filter(m => m.teacher_id === t.id && m.section_id !== assignModal.section_id);
                  const extraTag = otherMentored.length > 0 ? ` (Mentoring ${otherMentored.map(om => `${om.class_number}-${om.section_name}`).join(', ')})` : '';

                  return (
                    <option key={t.id} value={t.id}>
                      {t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim()} [{emp}]{extraTag}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Notice if teacher mentors multiple sections */}
            {selectedTeacherId && (() => {
              const otherMentored = combinedMentors.filter(m => m.teacher_id === selectedTeacherId && m.section_id !== assignModal.section_id);
              if (otherMentored.length > 0) {
                return (
                  <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 6, background: dark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(2, 132, 199, 0.08)', border: dark ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(2, 132, 199, 0.2)', color: dark ? '#38bdf8' : '#0369a1', fontSize: 12, marginBottom: 20 }}>
                    <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      This teacher currently mentors <strong>{otherMentored.map(om => `Class ${om.class_number}-${om.section_name}`).join(', ')}</strong>. Multi-section mentorship is enabled.
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setAssignModal(null)} disabled={assigning}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={assigning || !selectedTeacherId}>
                {assigning ? 'Saving...' : assignModal.is_change ? 'Update Teacher' : 'Assign Teacher'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Remove Teacher Confirmation Modal */}
    {removeModal && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 440, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Remove Class Teacher</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Class {removeModal.class_number} — Section {removeModal.section_name}</p>
            </div>
          </div>

          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
            Are you sure you want to remove <strong>{removeModal.teacher_name}</strong> as Class Teacher for <strong>Class {removeModal.class_number} Section {removeModal.section_name}</strong>? The section will remain available but unassigned.
          </p>

          <form onSubmit={submitMentorRemove} style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={() => setRemoveModal(null)} disabled={removing}>
              Cancel
            </button>
            <button type="submit" style={{ padding: '8px 16px', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }} disabled={removing}>
              {removing ? 'Removing...' : 'Confirm Removal'}
            </button>
          </form>
        </div>
      </div>
    )}

    {/* Remove Section Confirmation Modal */}
    {confirmRemoveSectionModal && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 460, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Confirm Section Removal</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {confirmRemoveSectionModal.classTitle} — Section {confirmRemoveSectionModal.sectionLabel}
              </p>
            </div>
          </div>

          <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5, marginBottom: 12 }}>
            Are you sure you want to remove <strong>Section {confirmRemoveSectionModal.sectionLabel}</strong> from <strong>{confirmRemoveSectionModal.classTitle}</strong>?
          </p>

          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 6, background: dark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.08)', border: dark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(245, 158, 11, 0.25)', color: dark ? '#fbbf24' : '#b45309', fontSize: 12, marginBottom: 20 }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              If students, attendance records, or timetable schedules depend on this section, deletion will be rejected to protect academic data integrity.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmRemoveSectionModal(null)}
              disabled={removingSection}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmRemoveSection}
              disabled={removingSection}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: removingSection ? 'not-allowed' : 'pointer',
                opacity: removingSection ? 0.7 : 1
              }}
            >
              {removingSection ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Removing...</span>
                </>
              ) : (
                <span>Confirm Removal</span>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
  </Layout>
}

/* ────── Subjects ────── */
function Subjects() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [n, setN] = useState('');
  const [adding, setAdding] = useState(false);

  const [subjectPreview, setSubjectPreview] = useState<{
    isOpen: boolean;
    name?: string;
    loading: boolean;
    error: string | null;
  }>({ isOpen: false, loading: false, error: null });

  const [deleteSubjectDialog, setDeleteSubjectDialog] = useState<{
    isOpen: boolean;
    subjectId?: string;
    subjectName?: string;
    loading: boolean;
    error: string | null;
  }>({ isOpen: false, loading: false, error: null });

  async function load() {
    try {
      const res = await api.get('/subjects');
      setRows(res.data || []);
    } catch (err) {
      console.error('Failed to load subjects:', err);
    }
  }

  useEffect(() => { load() }, []);

  function initiateAddSubject(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!n.trim()) {
      alert('Validation Error: Please enter a subject name (e.g. Economics).');
      return;
    }
    setSubjectPreview({
      isOpen: true,
      name: n.trim(),
      loading: false,
      error: null
    });
  }

  async function executeConfirmAddSubject() {
    if (!subjectPreview.name) return;
    setSubjectPreview(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await api.post('/subjects', { name: subjectPreview.name });
      const created = res.data;
      setRows(prev => [...prev, created]);
      setN('');
      setSubjectPreview(prev => ({ ...prev, isOpen: false, loading: false }));
      load();
    } catch (err: any) {
      setSubjectPreview(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || 'Could not add subject'
      }));
    }
  }

  function promptDeleteSubject(sub: any) {
    setDeleteSubjectDialog({
      isOpen: true,
      subjectId: sub.id,
      subjectName: sub.name,
      loading: false,
      error: null
    });
  }

  async function executeConfirmDeleteSubject() {
    if (!deleteSubjectDialog.subjectId) return;
    setDeleteSubjectDialog(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.delete(`/subjects/${deleteSubjectDialog.subjectId}`);
      setRows(prev => prev.filter(r => r.id !== deleteSubjectDialog.subjectId));
      setDeleteSubjectDialog(prev => ({ ...prev, isOpen: false, loading: false }));
    } catch (err: any) {
      setDeleteSubjectDialog(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || 'Could not delete subject'
      }));
    }
  }

  const [editSubjectDialog, setEditSubjectDialog] = useState<{
    isOpen: boolean;
    subjectId?: string;
    subjectName?: string;
    newName?: string;
    loading: boolean;
    error: string | null;
  }>({ isOpen: false, loading: false, error: null });

  function promptEditSubject(sub: any) {
    setEditSubjectDialog({
      isOpen: true,
      subjectId: sub.id,
      subjectName: sub.name,
      newName: sub.name,
      loading: false,
      error: null
    });
  }

  async function executeConfirmEditSubject(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!editSubjectDialog.subjectId) return;
    const trimmed = (editSubjectDialog.newName || '').trim();
    if (!trimmed) {
      setEditSubjectDialog(prev => ({ ...prev, error: 'Subject name cannot be empty' }));
      return;
    }
    setEditSubjectDialog(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await api.put(`/subjects/${editSubjectDialog.subjectId}`, { name: trimmed });
      const updated = res.data;
      setRows(prev => prev.map(r => r.id === editSubjectDialog.subjectId ? { ...r, name: updated.name || trimmed } : r));
      setEditSubjectDialog(prev => ({ ...prev, isOpen: false, loading: false }));
    } catch (err: any) {
      setEditSubjectDialog(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || 'Could not update subject'
      }));
    }
  }

  return <Layout>
    <PageHead title="Subjects" sub="Subjects used by class routines." />
    <div className="panel narrow">
      <form className="inline" onSubmit={initiateAddSubject}>
        <input placeholder="Subject name (e.g. Mathematics)" value={n} onChange={e => setN(e.target.value)} />
        <button type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add subject'}</button>
      </form>
      <div className="list">
        {rows.map(x => <div className="list-row" key={x.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px' }}>
          <b>{x.name}</b>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="table-action-btn"
              onClick={() => promptEditSubject(x)}
              title={`Edit ${x.name}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12.5,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--bg-card, #ffffff)',
                color: '#2563eb'
              }}
            >
              <Pencil size={13} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              className="table-action-btn danger"
              onClick={() => promptDeleteSubject(x)}
              title={`Delete ${x.name}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12.5
              }}
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        </div>)}
        {rows.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', padding: '16px 0' }}>No subjects added yet.</p>
        )}
      </div>
    </div>

    {/* Universal Preview Modal for Adding Subject */}
    <UniversalPreviewModal
      isOpen={subjectPreview.isOpen}
      onClose={() => setSubjectPreview(prev => ({ ...prev, isOpen: false }))}
      onEdit={() => setSubjectPreview(prev => ({ ...prev, isOpen: false }))}
      onConfirm={executeConfirmAddSubject}
      title={`Confirm Subject Creation — ${subjectPreview.name || ''}`}
      subtitle="Verify subject title before adding to academic catalog"
      operationType="create"
      confirmText="Confirm & Add Subject"
      editText="Back to Edit"
      sections={[
        {
          title: 'Subject Information',
          fields: [
            { label: 'Subject Name', value: subjectPreview.name, color: 'blue' },
            { label: 'Academic Availability', value: 'Active across all class routines', color: 'green' }
          ]
        }
      ]}
      loading={subjectPreview.loading}
      error={subjectPreview.error}
    />

    {/* Destructive Confirm Modal for Subject Deletion */}
    <DestructiveConfirmModal
      isOpen={deleteSubjectDialog.isOpen}
      onClose={() => setDeleteSubjectDialog(prev => ({ ...prev, isOpen: false }))}
      onConfirm={executeConfirmDeleteSubject}
      title={`Confirm Deletion — ${deleteSubjectDialog.subjectName || 'Subject'}`}
      entityName={deleteSubjectDialog.subjectName || ''}
      entityType="Subject"
      details={[
        { label: 'Subject Name', value: deleteSubjectDialog.subjectName || '—' },
        { label: 'Impact', value: 'Will remove subject from class routines & schedules' }
      ]}
      warningMessage="Deleting this subject will remove it from all class routines and unassign it from timetable schedules. This action cannot be reversed."
      confirmText="Confirm & Delete Subject"
      loading={deleteSubjectDialog.loading}
      error={deleteSubjectDialog.error}
    />

    {/* Edit Subject Modal */}
    {editSubjectDialog.isOpen && (
      <div
        className="modal-backdrop"
        onClick={() => !editSubjectDialog.loading && setEditSubjectDialog(prev => ({ ...prev, isOpen: false }))}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}
      >
        <div
          className="modal-content"
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: 440,
            width: '100%',
            padding: 24,
            borderRadius: 12,
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text, #1e293b)' }}>
              <Pencil size={18} color="#2563eb" /> Edit Subject
            </h3>
            <button
              type="button"
              onClick={() => setEditSubjectDialog(prev => ({ ...prev, isOpen: false }))}
              disabled={editSubjectDialog.loading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={executeConfirmEditSubject}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text, #334155)' }}>
                Subject Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Subject name (e.g. Mathematics)"
                value={editSubjectDialog.newName || ''}
                onChange={e => setEditSubjectDialog(prev => ({ ...prev, newName: e.target.value, error: null }))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                Updating the subject name will automatically reflect across all class routines and schedules.
              </p>
            </div>

            {editSubjectDialog.error && (
              <div style={{
                marginBottom: 16,
                padding: '8px 12px',
                borderRadius: 6,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: 12.5
              }}>
                {editSubjectDialog.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={editSubjectDialog.loading}
                onClick={() => setEditSubjectDialog(prev => ({ ...prev, isOpen: false }))}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'transparent'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={editSubjectDialog.loading || !editSubjectDialog.newName?.trim()}
                style={{
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  cursor: (editSubjectDialog.loading || !editSubjectDialog.newName?.trim()) ? 'not-allowed' : 'pointer',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {editSubjectDialog.loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </Layout>
}

/* ────── Routine ────── */
function Routine() {
  const { user } = useAuth(); const [rows, setRows] = useState<any[]>([]); const [c, setC] = useState<any[]>([]); const [s, setS] = useState<any[]>([]); const [sub, setSub] = useState<any[]>([]); const [t, setT] = useState<any[]>([]); const [f, setF] = useState<any>({ dayOfWeek: 1 });
  async function load() { const [a, b, d, e, g] = await Promise.all([api.get('/routines'), api.get('/classes'), api.get('/sections'), api.get('/subjects'), api.get('/teachers')]); setRows(a.data); setC(b.data); setS(d.data); setSub(e.data); setT(g.data) } useEffect(() => { load() }, []);
  async function add(e: React.FormEvent) { e.preventDefault(); try { await api.post('/routines', f); setF({ dayOfWeek: 1 }); load() } catch (e: any) { alert(e?.response?.data?.message || 'Could not create routine') } }
  async function del(id: string) { if (confirm('Delete this routine?')) { await api.delete('/routines/' + id); load() } }
  return <Layout><PageHead title="Class Routine" sub="Create section-wise teacher and time-slot schedules." /><div className="panel"><form className="routine-form" onSubmit={add}><label>Day<select value={f.dayOfWeek} onChange={e => setF({ ...f, dayOfWeek: Number(e.target.value) })}>{days.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label><label>Class<select required value={f.classId || ''} onChange={e => setF({ ...f, classId: e.target.value, sectionId: '' })}><option value="">Select</option>{c.map(x => <option key={x.id} value={x.id}>Class {x.class_number}</option>)}</select></label><label>Section<select required value={f.sectionId || ''} onChange={e => setF({ ...f, sectionId: e.target.value })}><option value="">Select</option>{s.filter(x => x.class_id === f.classId).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Subject<select required value={f.subjectId || ''} onChange={e => setF({ ...f, subjectId: e.target.value })}><option value="">Select</option>{sub.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Teacher<select required value={f.teacherId || ''} onChange={e => setF({ ...f, teacherId: e.target.value })}><option value="">Select</option>{t.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Start<input required type="time" value={f.startTime || ''} onChange={e => setF({ ...f, startTime: e.target.value })} /></label><label>End<input required type="time" value={f.endTime || ''} onChange={e => setF({ ...f, endTime: e.target.value })} /></label><label>Room<input value={f.room || ''} onChange={e => setF({ ...f, room: e.target.value })} /></label><button>Create routine</button></form></div>
    <div className="table-wrap"><table><thead><tr><th>Day</th><th>Class</th><th>Subject</th><th>Teacher</th><th>Time</th><th>Room</th><th></th></tr></thead><tbody>{rows.map(x => <tr key={x.id}><td>{days[x.day_of_week]}</td><td>{x.class_number}-{x.section_name}</td><td>{x.subject_name}</td><td>{x.teacher_name}</td><td>{fmt(x.start_time)}–{fmt(x.end_time)}</td><td>{x.room || '—'}</td><td><button className="danger" onClick={() => del(x.id)}>Delete</button></td></tr>)}</tbody></table></div></Layout>
}

/* ────── Attendance ────── */
function Attendance() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

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

  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [authorizedSections, setAuthorizedSections] = useState<any[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const getInitialAttendanceDate = () => {
    const qDate = getQueryParam('date') || getQueryParam('attendance_date');
    if (qDate) return qDate;
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toLocaleDateString('en-CA');
    }
  };
  const [attendanceDate, setAttendanceDate] = useState<string>(getInitialAttendanceDate);
  const [isEditingAttendance, setIsEditingAttendance] = useState<boolean>(false);
  const [activeRoutine, setActiveRoutine] = useState<any>(null);

  const [students, setStudents] = useState<any[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'roll-asc' | 'roll-desc' | 'name-asc' | 'name-desc'>('roll-asc');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  // Pagination & Last Fetched state (Matching School Admin Students Directory)
  const [attendancePage, setAttendancePage] = useState<number>(1);
  const [attendancePageSize, setAttendancePageSize] = useState<number>(25);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const rosterTopRef = useRef<HTMLDivElement>(null);

  // Existing session & Re-attendance state
  const [existingSession, setExistingSession] = useState<any>(null);
  const isAlreadyEdited = Boolean(
    existingSession && (
      existingSession.is_reattendance ||
      existingSession.isReattendance ||
      (Number(existingSession.reattendance_count || 0) > 0) ||
      (Number(existingSession.reattendanceCount || 0) > 0) ||
      (typeof window !== 'undefined' && (
        (selectedClassId && selectedSectionId && (
          sessionStorage.getItem(`finalized_attendance_${attendanceDate}_${selectedClassId}_${selectedSectionId}`) ||
          localStorage.getItem(`finalized_attendance_${attendanceDate}_${selectedClassId}_${selectedSectionId}`) ||
          sessionStorage.getItem(`finalized_attendance_${selectedClassId}_${selectedSectionId}`) ||
          localStorage.getItem(`finalized_attendance_${selectedClassId}_${selectedSectionId}`)
        )) ||
        (classes.length > 0 && sections.length > 0 && (() => {
          const cObj = classes.find((c: any) => String(c.id) === String(selectedClassId));
          const sObj = sections.find((s: any) => String(s.id) === String(selectedSectionId));
          if (!cObj || !sObj) return false;
          const cNum = cObj.class_number ?? cObj.classNumber;
          const sName = sObj.name ?? sObj.sectionName;
          return Boolean(
            sessionStorage.getItem(`finalized_attendance_${attendanceDate}_${cNum}_${sName}`) ||
            localStorage.getItem(`finalized_attendance_${attendanceDate}_${cNum}_${sName}`) ||
            sessionStorage.getItem(`finalized_attendance_${cNum}_${sName}`) ||
            localStorage.getItem(`finalized_attendance_${cNum}_${sName}`)
          );
        })())
      ))
    )
  );
  const canEditAttendance = Boolean(existingSession && !isAlreadyEdited);

  useEffect(() => {
    if (isAlreadyEdited) {
      setIsEditingAttendance(false);
    } else if (getQueryParam('edit') === '1' && canEditAttendance) {
      setIsEditingAttendance(true);
    }
  }, [existingSession, canEditAttendance, isAlreadyEdited]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditStatusFilter, setAuditStatusFilter] = useState<string>('ALL');
  const [exportingAudit, setExportingAudit] = useState<boolean>(false);

  const canExportAudit = ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(user?.role || '');

  const handleExportAudit = async (format: 'csv' | 'xlsx') => {
    if (!existingSession?.id) return;
    setExportingAudit(true);
    try {
      const params: any = { format };
      if (auditSearch.trim()) params.search = auditSearch.trim();
      if (auditStatusFilter !== 'ALL') params.status = auditStatusFilter;

      const res = await api.get(`/teacher/attendance/${existingSession.id}/audit-trail/export`, {
        params,
        responseType: 'blob'
      });

      let filename = `attendance-audit-session-${existingSession.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.${format}`;
      const disposition = res.headers['content-disposition'] || res.headers['Content-Disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = new Blob([res.data], {
        type: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8;'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Audit export error:', err);
      alert(err?.response?.data?.message || 'Failed to export audit trail');
    } finally {
      setExportingAudit(false);
    }
  };
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

  // Sunday / Gazetted Holiday Attendance Guard state (TC-ATT-010)
  const [calendarGuard, setCalendarGuard] = useState<{
    isInstructional: boolean;
    reason?: string;
    dayName?: string;
  } | null>(null);
  const [overrideGuard, setOverrideGuard] = useState<boolean>(false);

  useEffect(() => {
    if (!attendanceDate) return;
    setOverrideGuard(false);
    api.get(`/calendar/check-date?date=${attendanceDate}`)
      .then(res => {
        if (res.data?.success && res.data?.data) {
          setCalendarGuard(res.data.data);
        } else {
          setCalendarGuard(null);
        }
      })
      .catch(() => setCalendarGuard(null));
  }, [attendanceDate]);

  // Modals state
  const [activeModal, setActiveModal] = useState<'EARLY_DEPARTURE' | 'LATE_ARRIVAL' | 'AUDIT_LOGS' | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Helper to ensure strict HH:mm time format
  const getNowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatToStrictHHMM = (val?: string | null): string => {
    if (!val) return getNowHHMM();
    const clean = String(val).trim();
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(clean)) return clean;
    const mSec = clean.match(/^([01]?\d|2[0-3]):([0-5]\d):[0-5]\d$/);
    if (mSec) return `${String(mSec[1]).padStart(2, '0')}:${mSec[2]}`;
    const m12 = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (m12) {
      let h = parseInt(m12[1], 10);
      const m = m12[2];
      const mer = m12[3].toLowerCase();
      if (mer === 'pm' && h < 12) h += 12;
      if (mer === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${m}`;
    }
    const mSingle = clean.match(/^([0-9]):([0-5]\d)$/);
    if (mSingle) return `0${mSingle[1]}:${mSingle[2]}`;
    return getNowHHMM();
  };

  // Early departure form state
  const [depPeriod, setDepPeriod] = useState<string>('After 1st Period');
  const [depTime, setDepTime] = useState<string>(getNowHHMM);
  const [depReason, setDepReason] = useState<string>('Parent Picked Up Early');
  const [depRemarks, setDepRemarks] = useState<string>('');
  const [depNotify, setDepNotify] = useState<boolean>(true);

  // Late arrival form state
  const [arrPeriod, setArrPeriod] = useState<string>('Period 2');
  const [arrTime, setArrTime] = useState<string>(getNowHHMM);
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

  // Universal Preview State for Attendance
  const [attendancePreview, setAttendancePreview] = useState<{
    isOpen: boolean;
    isReattendance?: boolean;
    summaryCards: PreviewSummaryCard[];
    tableData?: PreviewTableData;
    title: string;
    subtitle?: string;
    confirmText: string;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    summaryCards: [],
    title: '',
    confirmText: 'Confirm & Submit Attendance',
    loading: false,
    error: null,
  });

  function initiateAttendancePreview(isReattendance = false) {
    if (calendarGuard && !calendarGuard.isInstructional && !overrideGuard) {
      alert(`Notice: Selected date (${attendanceDate}) is a declared non-instructional day (${calendarGuard.reason}). Attendance marking controls are disabled by default. Please click "Enable Marking Controls (Override)" if this is an authorized session.`);
      return;
    }
    if (!selectedClassId || !selectedSectionId) {
      alert('Validation Error: Please select both Class and Section.');
      return;
    }
    if (students.length === 0) {
      alert('Validation Error: No students enrolled in this section.');
      return;
    }

    const cObj = classes.find(c => c.id === selectedClassId);
    const sObj = sections.find(s => s.id === selectedSectionId);
    const subObj = subjects.find(s => s.id === selectedSubjectId);
    const classLabel = `Class ${cObj?.class_number ?? cObj?.classNumber ?? '—'} - Section ${sObj?.name || sObj?.sectionName || 'A'}`;

    const summaryCards: PreviewSummaryCard[] = [
      { label: 'Total Enrolled', value: students.length, color: 'purple' },
      { label: 'Present', value: presentCount, color: 'green' },
      { label: 'Absent', value: absentCount, color: 'red' },
      { label: 'Late / Left Early', value: lateCount + leftEarlyCount, color: 'amber' },
      ...(unmarkedCount > 0 ? [{ label: 'Unmarked (Default Absent)', value: unmarkedCount, color: 'blue' as const }] : []),
      { label: 'Attendance Rate', value: `${ratePct}%`, color: 'blue' },
    ];

    const headers = ['Roll', 'Student Name', 'Status', 'Notes'];
    const previewRows = students.map(s => {
      const sid = String(s.id);
      const st = studentStatusMap[sid] || studentStatusMap[s.id] || {};
      const isPres = checked[sid] ?? checked[s.id];
      let status: string = st.status || '';
      if (!status) {
        status = isPres !== undefined ? (isPres ? 'PRESENT' : 'ABSENT') : 'UNMARKED (Default ABSENT)';
      }
      const note = st.departurePeriod || st.arrivalPeriod || st.remarks || '—';
      return [
        s.roll_number || '•',
        s.name,
        status,
        note
      ];
    });

    setAttendancePreview({
      isOpen: true,
      isReattendance,
      title: isReattendance ? `Review Whole-Class Re-attendance — ${classLabel}` : `Review Daily Attendance Roster — ${classLabel}`,
      subtitle: `Date: ${attendanceDate}${subObj?.name ? ` • Subject: ${subObj.name}` : ''}`,
      confirmText: isReattendance ? 'Confirm & Save Re-attendance' : 'Confirm & Commit Attendance',
      summaryCards,
      tableData: { headers, rows: previewRows },
      loading: false,
      error: null,
    });
  }

  async function executeConfirmAttendance() {
    setAttendancePreview(prev => ({ ...prev, loading: true, error: null }));
    try {
      if (attendancePreview.isReattendance) {
        await submitWholeClassReattendance();
      } else {
        await submit();
      }
      setAttendancePreview(prev => ({ ...prev, isOpen: false, loading: false }));
    } catch (err: any) {
      setAttendancePreview(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Attendance submission failed'
      }));
    }
  }

  // Load initial reference data
  useEffect(() => {
    async function init() {
      try {
        const [cRes, sRes, subRes, rRes, authSecRes] = await Promise.all([
          api.get('/classes'),
          api.get('/sections'),
          api.get('/subjects'),
          api.get('/teacher/routine/today').catch(() => ({ data: [] })),
          api.get('/teacher/attendance/authorized-sections').catch(() => ({ data: { sections: [], schoolDate: '' } }))
        ]);

        const isTeacherRole = user?.role === 'TEACHER';
        const myAuthorized = Array.isArray(authSecRes.data?.sections) ? authSecRes.data.sections : [];
        setAuthorizedSections(myAuthorized);

        let cList = cRes.data || [];
        let sList = sRes.data || [];
        const rList = rRes.data || [];
        setRoutines(rList);

        // For teachers, strictly restrict classes and sections to assigned class mentor sections
        if (isTeacherRole && myAuthorized.length > 0) {
          const authClassIds = new Set(myAuthorized.map((a: any) => String(a.classId || a.class_id)));
          const authSecIds = new Set(myAuthorized.map((a: any) => String(a.sectionId || a.section_id)));
          cList = cList.filter((c: any) => authClassIds.has(String(c.id)));
          sList = sList.filter((s: any) => authSecIds.has(String(s.id)));
        }

        setClasses(cList);
        setSections(sList);
        setSubjects(subRes.data || []);

        const routineId = getQueryParam('routine');
        const classIdParam = getQueryParam('classId');
        const sectionIdParam = getQueryParam('sectionId');
        const subjectIdParam = getQueryParam('subjectId');
        const dateParam = getQueryParam('date') || getQueryParam('attendance_date');
        if (dateParam) setAttendanceDate(dateParam);

        let targetClassId = '';
        let targetSecId = '';
        let targetSubId = '';

        if (isTeacherRole && myAuthorized.length > 0) {
          // Strictly lock to the teacher's authorized mentor class & section
          const authSec = myAuthorized.find((a: any) =>
            (classIdParam && (String(a.classId || a.class_id) === String(classIdParam))) &&
            (sectionIdParam && (String(a.sectionId || a.section_id) === String(sectionIdParam)))
          ) || myAuthorized[0];
          targetClassId = authSec.classId || authSec.class_id;
          targetSecId = authSec.sectionId || authSec.section_id;
        } else if (routineId) {
          const matched = rList.find((r: any) => r.id === routineId);
          if (matched) {
            setActiveRoutine(matched);
            targetClassId = matched.class_id;
            targetSecId = matched.section_id;
            targetSubId = matched.subject_id;
          }
        } else if (classIdParam && sectionIdParam) {
          targetClassId = classIdParam;
          targetSecId = sectionIdParam;
          targetSubId = subjectIdParam || '';
        }

        if (!targetClassId || !targetSecId) {
          const defaultSec = myAuthorized.length > 0 ? myAuthorized[0] : null;
          if (defaultSec) {
            targetClassId = defaultSec.classId || defaultSec.class_id;
            targetSecId = defaultSec.sectionId || defaultSec.section_id;
          } else if (cList.length > 0) {
            targetClassId = cList[0].id;
          }
        }

        const validSecsForClass = sList.filter((s: any) =>
          !targetClassId || s.class_id === targetClassId || s.classId === targetClassId || String(s.class_number) === String(targetClassId)
        );
        if (!targetSecId || !validSecsForClass.some((s: any) => s.id === targetSecId)) {
          targetSecId = validSecsForClass.length > 0 ? validSecsForClass[0].id : (sList[0]?.id || '');
        }

        if (!targetSubId) {
          targetSubId = subjectIdParam || (subRes.data?.length > 0 ? subRes.data[0].id : '');
        }

        setSelectedClassId(targetClassId);
        setSelectedSectionId(targetSecId);
        setSelectedSubjectId(targetSubId);
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

        // Ensure every student in roster has normalized lookup key if record exists
        (studentList || []).forEach(s => {
          const sid = String(s.id);
          if (stMap[sid]) {
            stMap[s.id] = stMap[sid];
            chkMap[s.id] = chkMap[sid];
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
      } else if (res.data && res.data.hasAttendance === false) {
        setExistingSession(null);
        setAuditLogs([]);
        setDone(false);
        setSummary(null);
        setStudentStatusMap({});
        setChecked({});
      }
    } catch (err: any) {
      console.warn('Failed to query today attendance status:', err?.response?.data?.message || err?.message || err);
      setExistingSession(null);
      setAuditLogs([]);
      setDone(false);
      setSummary(null);
      setStudentStatusMap({});
      setChecked({});
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Helper to deduplicate student roster
  const deduplicateStudents = (list: any[]) => {
    const seen = new Set<string>();
    const result: any[] = [];
    for (const s of list) {
      const roll = String(s.roll_number || s.rollNumber || '').trim();
      const adm = String(s.admission_number || s.admissionNumber || '').trim().toLowerCase();
      const name = String(s.name || s.fullName || '').trim().toLowerCase();
      const key = adm && !adm.startsWith('adm-st-')
        ? `adm:${adm}`
        : (roll ? `roll:${roll}` : `name:${name}`);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(s);
      }
    }
    return result;
  };

  // Fetch students helper with refresh support (Matching School Admin Students Directory)
  const loadStudents = useCallback(async () => {
    if (!selectedClassId || !selectedSectionId) return;
    setLoadingStatus(true);
    setStudentStatusMap({});
    setChecked({});
    setExistingSession(null);
    setDone(false);
    setSummary(null);
    setAuditLogs([]);
    try {
      let list: any[] = [];
      const currentSessionName = localStorage.getItem('attendo_academic_session') || localStorage.getItem('attendo_active_academic_year') || '';
      const currentSessionId = localStorage.getItem('attendo_active_academic_year_id') || '';
      const sessionQuery = currentSessionId ? `?academicYearId=${currentSessionId}` : (currentSessionName ? `?session=${encodeURIComponent(currentSessionName)}` : '');

      try {
        const res = await api.get(`/teacher/students/${selectedClassId}/${selectedSectionId}${sessionQuery}`);
        list = deduplicateStudents(res.data || []);
      } catch {
        list = [];
      }
      setStudents(list);
      setLastFetchedAt(new Date());
      setAttendancePage(1);
      await checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, list);
    } finally {
      setLoadingStatus(false);
    }
  }, [selectedClassId, selectedSectionId, attendanceDate, checkTodayStatus]);

  useEffect(() => {
    loadStudents();
    const handleSessionChange = () => {
      loadStudents();
    };
    window.addEventListener('sessionChanged', handleSessionChange);
    return () => {
      window.removeEventListener('sessionChanged', handleSessionChange);
    };
  }, [loadStudents]);

  // Ensure selectedSectionId always points to a valid section of selectedClassId
  useEffect(() => {
    if (!selectedClassId || sections.length === 0) return;
    const validSecs = sections.filter(s =>
      s.class_id === selectedClassId || s.classId === selectedClassId || String(s.class_number) === String(selectedClassId)
    );
    if (validSecs.length > 0 && !validSecs.some(s => s.id === selectedSectionId)) {
      setSelectedSectionId(validSecs[0].id);
    }
  }, [selectedClassId, sections, selectedSectionId]);

  function switchRoutine(r: any) {
    setActiveRoutine(r);
    setSelectedClassId(r.class_id);
    setSelectedSectionId(r.section_id);
    setSelectedSubjectId(r.subject_id);
    setDone(false);
  }

  const selectAll = (val: boolean) => {
    if (isAlreadyEdited || (existingSession && !isEditingAttendance)) return;
    const updatedChk: Record<string, boolean> = {};
    const updatedMap: Record<string, any> = {};
    if (val) {
      students.forEach(s => {
        const sid = String(s.id);
        updatedChk[sid] = true;
        updatedChk[s.id] = true;
        updatedMap[sid] = { ...(studentStatusMap[sid] || {}), status: 'PRESENT' };
        updatedMap[s.id] = { ...(studentStatusMap[s.id] || {}), status: 'PRESENT' };
      });
    }
    setChecked(updatedChk);
    setStudentStatusMap(updatedMap);
  };

  const leftEarlyCount = students.filter(s => {
    const sid = String(s.id);
    return (studentStatusMap[sid]?.status || studentStatusMap[s.id]?.status) === 'LEFT_EARLY';
  }).length;

  const lateCount = students.filter(s => {
    const sid = String(s.id);
    return (studentStatusMap[sid]?.status || studentStatusMap[s.id]?.status) === 'LATE';
  }).length;

  const presentCount = students.filter(s => {
    const sid = String(s.id);
    const st = studentStatusMap[sid]?.status || studentStatusMap[s.id]?.status;
    if (st === 'PRESENT' || st === 'LATE') return true;
    if (st === 'LEFT_EARLY' || st === 'ABSENT') return false;
    return checked[sid] === true || checked[s.id] === true;
  }).length;

  const absentCount = students.filter(s => {
    const sid = String(s.id);
    const st = studentStatusMap[sid]?.status || studentStatusMap[s.id]?.status;
    if (st === 'ABSENT') return true;
    if (st === 'PRESENT' || st === 'LATE' || st === 'LEFT_EARLY') return false;
    return checked[sid] === false || checked[s.id] === false;
  }).length;

  const unmarkedCount = Math.max(0, students.length - presentCount - leftEarlyCount - lateCount - absentCount);
  const totalMarked = presentCount + leftEarlyCount + lateCount + absentCount;
  const ratePct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

  const filteredStudents = useMemo(() => {
    const list = students.filter(s => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (s.name || '').toLowerCase().includes(q) || String(s.roll_number || s.rollNumber || '').toLowerCase().includes(q);
    });

    return list.slice().sort((a, b) => {
      const rollA = a.roll_number ?? a.rollNumber ?? '';
      const rollB = b.roll_number ?? b.rollNumber ?? '';
      if (sortOrder === 'roll-asc') {
        return String(rollA).localeCompare(String(rollB), undefined, { numeric: true, sensitivity: 'base' }) || String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (sortOrder === 'roll-desc') {
        return String(rollB).localeCompare(String(rollA), undefined, { numeric: true, sensitivity: 'base' }) || String(b.name || '').localeCompare(String(a.name || ''));
      }
      if (sortOrder === 'name-asc') {
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (sortOrder === 'name-desc') {
        return String(b.name || '').localeCompare(String(a.name || ''));
      }
      return 0;
    });
  }, [students, search, sortOrder]);

  useEffect(() => {
    setAttendancePage(1);
  }, [search, sortOrder]);

  const totalAttendancePages = Math.max(1, Math.ceil(filteredStudents.length / attendancePageSize));
  const currentAttendancePage = Math.min(Math.max(1, attendancePage), totalAttendancePages);
  const attendanceStartIdx = filteredStudents.length === 0 ? 0 : (currentAttendancePage - 1) * attendancePageSize;
  const attendanceEndIdx = Math.min(attendanceStartIdx + attendancePageSize, filteredStudents.length);
  const displayedStudents = filteredStudents.slice(attendanceStartIdx, attendanceEndIdx);

  const scrollToRosterTop = () => {
    rosterTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // Early Departure Handler
  function openEarlyDeparture(student: any) {
    if (isAlreadyEdited) return;
    setSelectedStudent(student);
    const sid = String(student.id);
    const existing = studentStatusMap[sid] || studentStatusMap[student.id];
    setDepPeriod(existing?.departurePeriod || 'After 1st Period');
    setDepTime(formatToStrictHHMM(existing?.departureTime));
    setDepReason('Parent Picked Up Early');
    setDepRemarks(existing?.remarks || '');
    setDepNotify(true);
    setActiveModal('EARLY_DEPARTURE');
  }

  // Late Arrival Handler
  function openLateArrival(student: any) {
    if (isAlreadyEdited) return;
    setSelectedStudent(student);
    const sid = String(student.id);
    const existing = studentStatusMap[sid] || studentStatusMap[student.id];
    setArrPeriod(existing?.arrivalPeriod || 'Period 2');
    setArrTime(formatToStrictHHMM(existing?.arrivalTime));
    setArrReason('Traffic / Commute Delay');
    setArrRemarks(existing?.remarks || '');
    setArrNotify(true);
    setActiveModal('LATE_ARRIVAL');
  }

  async function submitEarlyDeparture() {
    if (!selectedStudent) return;
    const finalDepTime = formatToStrictHHMM(depTime);
    setDepTime(finalDepTime);
    setSavingAction(true);
    const sid = String(selectedStudent.id);
    const fullReason = depReason + (depRemarks ? ` (${depRemarks})` : '');
    try {
      setStudentStatusMap(prev => ({
        ...prev,
        [sid]: {
          status: 'LEFT_EARLY',
          departurePeriod: depPeriod,
          departureTime: finalDepTime,
          remarks: fullReason
        },
        [selectedStudent.id]: {
          status: 'LEFT_EARLY',
          departurePeriod: depPeriod,
          departureTime: finalDepTime,
          remarks: fullReason
        }
      }));
      setChecked(prev => ({ ...prev, [sid]: false, [selectedStudent.id]: false }));

      if (selectedClassId && selectedSectionId) {
        sessionStorage.setItem(`has_left_early_${selectedClassId}_${selectedSectionId}`, '1');
        localStorage.setItem(`has_left_early_${selectedClassId}_${selectedSectionId}`, '1');
      }
      const cObjEarly = classes.find((c: any) => String(c.id) === String(selectedClassId));
      const sObjEarly = sections.find((s: any) => String(s.id) === String(selectedSectionId));
      if (cObjEarly && sObjEarly) {
        const cNumEarly = cObjEarly.class_number ?? cObjEarly.classNumber;
        const sNameEarly = sObjEarly.name ?? sObjEarly.sectionName;
        sessionStorage.setItem(`has_left_early_${cNumEarly}_${sNameEarly}`, '1');
        localStorage.setItem(`has_left_early_${cNumEarly}_${sNameEarly}`, '1');
      }

      if (existingSession?.id) {
        const res = await api.put(`/teacher/attendance/${existingSession.id}/student/${selectedStudent.id}`, {
          status: 'LEFT_EARLY',
          departurePeriod: depPeriod,
          departureTime: finalDepTime,
          reason: fullReason,
          notifyParent: depNotify
        });
        setExistingSession(res.data.session);
        setReattendanceSuccessMsg(`✓ ${selectedStudent.name} marked as Left Early (${depPeriod}). Parent alert queued.`);
        checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
      } else {
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
    const finalArrTime = formatToStrictHHMM(arrTime);
    setArrTime(finalArrTime);
    setSavingAction(true);
    const sid = String(selectedStudent.id);
    const fullReason = arrReason + (arrRemarks ? ` (${arrRemarks})` : '');
    try {
      setStudentStatusMap(prev => ({
        ...prev,
        [sid]: {
          status: 'LATE',
          arrivalPeriod: arrPeriod,
          arrivalTime: finalArrTime,
          remarks: fullReason
        },
        [selectedStudent.id]: {
          status: 'LATE',
          arrivalPeriod: arrPeriod,
          arrivalTime: finalArrTime,
          remarks: fullReason
        }
      }));
      setChecked(prev => ({ ...prev, [sid]: true, [selectedStudent.id]: true }));

      if (existingSession?.id) {
        const res = await api.put(`/teacher/attendance/${existingSession.id}/student/${selectedStudent.id}`, {
          status: 'LATE',
          arrivalPeriod: arrPeriod,
          arrivalTime: finalArrTime,
          reason: fullReason,
          notifyParent: arrNotify
        });
        setExistingSession(res.data.session);
        setReattendanceSuccessMsg(`✓ ${selectedStudent.name} marked as Late Arrival (${arrPeriod}). Parent alert queued.`);
        checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
      } else {
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
    if (isAlreadyEdited || (existingSession && !isEditingAttendance)) return;
    const sid = String(s.id);
    setChecked(prev => ({ ...prev, [sid]: newStatus === 'PRESENT', [s.id]: newStatus === 'PRESENT' }));
    setStudentStatusMap(prev => ({
      ...prev,
      [sid]: { ...(prev[sid] || {}), status: newStatus },
      [s.id]: { ...(prev[s.id] || {}), status: newStatus }
    }));
  }

  async function submitWholeClassReattendance() {
    if (!existingSession?.id) return submit();
    setBusy(true);
    try {
      const recordsPayload = students.map(s => {
        const sid = String(s.id);
        const st = studentStatusMap[sid] || studentStatusMap[s.id] || {};
        const isPres = checked[sid] ?? checked[s.id];
        let status = st.status;
        if (!status) {
          status = isPres !== undefined ? (isPres ? 'PRESENT' : 'ABSENT') : 'ABSENT';
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

      const presCount = recordsPayload.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
      const leftEarlyCount = recordsPayload.filter(r => r.status === 'LEFT_EARLY').length;
      const absCount = recordsPayload.filter(r => r.status === 'ABSENT').length;

      const finalizedPayload = {
        finalized: true,
        date: attendanceDate,
        presentCount: presCount,
        absentCount: absCount,
        leftEarlyCount: leftEarlyCount,
        totalCount: students.length,
        submittedAt: new Date().toISOString()
      };

      if (selectedClassId && selectedSectionId) {
        sessionStorage.setItem(`finalized_att_${attendanceDate}_${selectedClassId}_${selectedSectionId}`, JSON.stringify(finalizedPayload));
        localStorage.setItem(`finalized_att_${attendanceDate}_${selectedClassId}_${selectedSectionId}`, JSON.stringify(finalizedPayload));
        sessionStorage.setItem(`finalized_attendance_${attendanceDate}_${selectedClassId}_${selectedSectionId}`, '1');
        localStorage.setItem(`finalized_attendance_${attendanceDate}_${selectedClassId}_${selectedSectionId}`, '1');
        sessionStorage.setItem(`finalized_att_${selectedClassId}_${selectedSectionId}`, JSON.stringify(finalizedPayload));
        localStorage.setItem(`finalized_att_${selectedClassId}_${selectedSectionId}`, JSON.stringify(finalizedPayload));
        sessionStorage.setItem(`finalized_attendance_${selectedClassId}_${selectedSectionId}`, '1');
        localStorage.setItem(`finalized_attendance_${selectedClassId}_${selectedSectionId}`, '1');
      }

      const cObj = classes.find((c: any) => String(c.id) === String(selectedClassId));
      const sObj = sections.find((s: any) => String(s.id) === String(selectedSectionId));
      if (cObj && sObj) {
        const cNum = cObj.class_number ?? cObj.classNumber;
        const sName = sObj.name ?? sObj.sectionName;
        sessionStorage.setItem(`finalized_att_${cNum}_${sName}`, JSON.stringify(finalizedPayload));
        localStorage.setItem(`finalized_att_${cNum}_${sName}`, JSON.stringify(finalizedPayload));
        sessionStorage.setItem(`finalized_attendance_${cNum}_${sName}`, '1');
        localStorage.setItem(`finalized_attendance_${cNum}_${sName}`, '1');
      }

      let res: any = null;
      try {
        res = await api.post(`/teacher/attendance/${existingSession.id}/reattendance`, {
          records: recordsPayload,
          reason: `Attendance edit / re-attendance by ${user?.name || 'Faculty'}`,
          notifyParents: false
        });
      } catch (err: any) {
        console.warn('Reattendance API error (using optimistic state):', err);
      }

      setExistingSession({
        ...(res?.data?.session || existingSession),
        present_count: presCount,
        presentCount: presCount,
        absent_count: absCount,
        absentCount: absCount,
        left_early_count: leftEarlyCount,
        leftEarlyCount: leftEarlyCount,
        is_reattendance: true,
        isReattendance: true,
        reattendance_count: 1,
        reattendanceCount: 1
      });
      setIsEditingAttendance(false);
      setReattendanceSuccessMsg('✓ Attendance successfully updated and finalized. Redirecting to dashboard...');
      setTimeout(() => {
        nav('/dashboard');
      }, 1200);
    } catch (e: any) {
      console.error('submitWholeClassReattendance error:', e);
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
        const sid = String(s.id);
        const st = studentStatusMap[sid] || studentStatusMap[s.id] || {};
        const isPres = checked[sid] ?? checked[s.id];
        let status = st.status;
        if (!status) {
          status = isPres !== undefined ? (isPres ? 'PRESENT' : 'ABSENT') : 'ABSENT';
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
      const presCount = recordsPayload.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
      const leftEarlyCount = recordsPayload.filter(r => r.status === 'LEFT_EARLY').length;
      const absCount = recordsPayload.filter(r => r.status === 'ABSENT').length;
      if (leftEarlyCount > 0 && selectedClassId && selectedSectionId) {
        sessionStorage.setItem(`has_left_early_${selectedClassId}_${selectedSectionId}`, String(leftEarlyCount));
        localStorage.setItem(`has_left_early_${selectedClassId}_${selectedSectionId}`, String(leftEarlyCount));
      }
      if (leftEarlyCount > 0 && cObj && sObj) {
        const cNum = cObj.class_number ?? cObj.classNumber;
        const sName = sObj.name ?? sObj.sectionName;
        sessionStorage.setItem(`has_left_early_${cNum}_${sName}`, String(leftEarlyCount));
        localStorage.setItem(`has_left_early_${cNum}_${sName}`, String(leftEarlyCount));
      }
      setSummary(res.data);
      setDone(true);
      checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
    } catch (e: any) {
      if (e?.response?.status === 409 || e?.response?.data?.code === 'DAILY_ATTENDANCE_ALREADY_SUBMITTED') {
        alert(e?.response?.data?.message || 'Attendance has already been submitted for this class and section today.');
        checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
        return;
      }
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
          {/* <button className="secondary" onClick={() => nav('/teacher-history')}>
            Session History →
          </button> */}
        </div>
      </div>



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
              {isAlreadyEdited
                ? '✓ Attendance has been submitted and edited. This session is now finalized and locked (no further edits permitted).'
                : isEditingAttendance
                ? '✏️ Attendance Edit Mode Active: Change student status between Present and Absent. Click "Submit Updated Attendance" below to finalize.'
                : 'Attendance for this class section has been submitted for today. Need to correct a mistake? Click "Edit Attendance" to update records once.'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isAlreadyEdited && !isEditingAttendance && (
              <button
                type="button"
                onClick={() => setIsEditingAttendance(true)}
                style={{ fontSize: 12.5, padding: '6px 14px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              >
                <PenLine size={14} /> Edit Attendance
              </button>
            )}
            {!isAlreadyEdited && isEditingAttendance && (
              <button
                type="button"
                onClick={() => {
                  setIsEditingAttendance(false);
                  checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
                }}
                style={{ fontSize: 12.5, padding: '6px 14px', background: 'var(--bg-subtle, #f1f5f9)', color: 'var(--text, #334155)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              >
                Cancel Edit
              </button>
            )}
            <button
              className="secondary"
              onClick={() => setActiveModal('AUDIT_LOGS')}
              style={{ fontSize: 12.5, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <HistoryIcon size={14} /> Audit Trail ({auditLogs.length})
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

      {/* Sunday / Gazetted Holiday Attendance Guard Banner (TC-ATT-010) */}
      {calendarGuard && !calendarGuard.isInstructional && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }} id="non-instructional-guard-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={22} style={{ color: '#dc2626', flexShrink: 0 }} />
            <div>
              <b style={{ color: '#b91c1c', fontSize: 13.5 }}>
                Selected date is a declared non-instructional day ({calendarGuard.reason || 'Holiday / Sunday'})
              </b>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                Selected date is a declared non-instructional day (Holiday/Sunday). Attendance marking controls disabled by default.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => setOverrideGuard(prev => !prev)}
            style={{ fontSize: 12, padding: '6px 14px', fontWeight: 600 }}
          >
            {overrideGuard ? '🔒 Lock Attendance Controls' : '🔓 Enable Marking Controls (Override)'}
          </button>
        </div>
      )}

      {/* Selectors Bar */}
      <div className="attendance-station-header">
        <div className="attendance-selectors">
          {user?.role === 'TEACHER' ? (
            <>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Class:</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 32,
                  boxSizing: 'border-box',
                  padding: '4px 12px',
                  borderRadius: 6,
                  background: 'var(--bg-subtle, #f1f5f9)',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'var(--text, #0f172a)'
                }}>
                  {currentClass
                    ? (currentClass.class_number === -1 || currentClass.class_number === '-1' ? 'Class L KG' :
                       currentClass.class_number === 0 || currentClass.class_number === '0' ? 'Class U KG' :
                       `Class ${currentClass.class_number ?? currentClass.classNumber ?? ''}`)
                    : (authorizedSections[0] ? `Class ${authorizedSections[0].classNumber}` : 'Class 2')}
                </span>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Section:</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 32,
                  boxSizing: 'border-box',
                  padding: '4px 12px',
                  borderRadius: 6,
                  background: 'var(--bg-subtle, #f1f5f9)',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'var(--text, #0f172a)'
                }}>
                  Section {currentSection?.name || currentSection?.sectionName || (authorizedSections[0] ? authorizedSections[0].sectionName : 'A')}
                </span>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Class:</span>
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
                  style={{
                    height: 32,
                    boxSizing: 'border-box',
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #cbd5e1)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text, #0f172a)',
                    background: 'var(--bg-card, #ffffff)'
                  }}
                >
                  {classes
                    .slice()
                    .sort((a, b) => {
                      const aN = Number(a.class_number ?? a.classNumber ?? 0);
                      const bN = Number(b.class_number ?? b.classNumber ?? 0);
                      return aN - bN;
                    })
                    .map(c => {
                      const num = c.class_number ?? c.classNumber;
                      const label = num === -1 || num === '-1' || /l.?kg/i.test(String(c.label || c.id || c.name)) ? 'Class L KG' :
                        num === 0 || num === '0' || /u.?kg/i.test(String(c.label || c.id || c.name)) ? 'Class U KG' :
                          num !== undefined && num !== null && !isNaN(Number(num)) ? `Class ${num}` :
                            c.name || `Class ${c.id}`;
                      return (
                        <option key={c.id} value={c.id}>{label}</option>
                      );
                    })}
                </select>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Section:</span>
                <select
                  value={selectedSectionId}
                  onChange={(e) => {
                    setSelectedSectionId(e.target.value);
                    setActiveRoutine(null);
                  }}
                  style={{
                    height: 32,
                    boxSizing: 'border-box',
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #cbd5e1)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text, #0f172a)',
                    background: 'var(--bg-card, #ffffff)'
                  }}
                >
                  {sections
                    .filter(s => !selectedClassId || s.class_id === selectedClassId || s.classId === selectedClassId || String(s.class_number) === String(selectedClassId))
                    .map(s => (
                      <option key={s.id} value={s.id}>Section {s.name || s.sectionName || s.section}</option>
                    ))}
                </select>
              </div>
            </>
          )}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Date:</span>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => {
                const newD = e.target.value;
                setAttendanceDate(newD);
                setStudentStatusMap({});
                setChecked({});
                setExistingSession(null);
                setDone(false);
                setSummary(null);
                setAuditLogs([]);
              }}
              style={{
                height: 32,
                boxSizing: 'border-box',
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text, #0f172a)',
                background: 'var(--bg-card, #ffffff)',
                outline: 'none'
              }}
            />
          </div>
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
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: 'var(--primary-600, #3b82f6)',
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
            <div style={{ background: 'var(--card-subtle, #f8fafc)', padding: 12, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted, #64748b)', marginBottom: 8 }}>
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
            <div style={{ background: 'var(--card-subtle, #f8fafc)', padding: 12, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted, #64748b)', marginBottom: 8 }}>
                Recipient Contact Addresses
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', fontWeight: emailToParents ? 600 : 400 }}>
                  <input
                    type="checkbox"
                    checked={emailToParents}
                    onChange={e => setEmailToParents(e.target.checked)}
                  />
                  <span>Send to Parent Email (Primary)</span>
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
            <div style={{ fontSize: 12.5, color: 'var(--text-muted, #64748b)' }}>
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
              background: emailResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: emailResult.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              color: emailResult.success ? '#10b981' : '#ef4444'
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
          <button
            disabled={isAlreadyEdited || Boolean(existingSession && !isEditingAttendance)}
            onClick={() => selectAll(true)}
            style={{
              fontSize: 12.5,
              padding: '6px 14px',
              opacity: (isAlreadyEdited || Boolean(existingSession && !isEditingAttendance)) ? 0.5 : 1,
              cursor: (isAlreadyEdited || Boolean(existingSession && !isEditingAttendance)) ? 'not-allowed' : 'pointer'
            }}
          >
            ✓ Select All Present
          </button>
          <button
            className="secondary"
            disabled={isAlreadyEdited || Boolean(existingSession && !isEditingAttendance)}
            onClick={() => selectAll(false)}
            style={{
              fontSize: 12.5,
              padding: '6px 14px',
              opacity: (isAlreadyEdited || Boolean(existingSession && !isEditingAttendance)) ? 0.5 : 1,
              cursor: (isAlreadyEdited || Boolean(existingSession && !isEditingAttendance)) ? 'not-allowed' : 'pointer'
            }}
          >
            ✕ Clear All
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '4px 10px'
            }}
          >
            <ArrowUpDown size={14} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Sort by:
            </span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
              title="Sort students roster"
            >
              <option value="roll-asc">Roll No. (1 → 9)</option>
              <option value="roll-desc">Roll No. (9 → 1)</option>
              <option value="name-asc">Student Name (A → Z)</option>
              <option value="name-desc">Student Name (Z → A)</option>
            </select>
          </div>

          <div style={{ width: 240 }}>
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
      </div>

      {/* Instruction Note */}
      <div className="instruction" style={{ marginBottom: 14 }}>
        <CheckCircle2 size={16} />
        <span>
          {existingSession
            ? (isAlreadyEdited
                ? 'Attendance Finalized: Attendance has been edited and locked. No further edits are permitted.'
                : isEditingAttendance
                ? 'Attendance Edit Mode Active: You can update attendance once. When finished, click "Submit Updated Attendance" to finalize.'
                : 'Re-attendance Station Active: All assigned teachers can adjust early departures (e.g. student left after 1st period), record late arrivals, or save a re-roll call.')
            : 'Check only students who are physically present. Unchecked students are marked absent and their parents will be notified.'}
        </span>
      </div>

      {/* Student List Box with Top Sub-Toolbar & Bottom Pagination Footer (Matching School Admin Directory) */}
      <div
        ref={rosterTopRef}
        style={{
          border: '1px solid var(--border, #cbd5e1)',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--bg-card, #ffffff)',
          marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        {/* Red-Circled Sub-Toolbar: Refresh, Last fetched, Rows per page selector, Showing counts */}
        <TableSubToolbar
          onRefresh={loadStudents}
          loading={loadingStatus}
          lastFetchedAt={lastFetchedAt}
          pageSize={attendancePageSize}
          onPageSizeChange={sz => { setAttendancePageSize(sz); setAttendancePage(1); scrollToRosterTop(); }}
          totalCount={students.length}
          filteredCount={filteredStudents.length}
          startIdx={attendanceStartIdx}
          endIdx={attendanceEndIdx}
          itemLabel="students"
          pageSizeOptions={[10, 25, 50, 100, 250, 500]}
        />

        {students.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '40px 20px', border: 'none', background: 'transparent' }}>
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
          <>
            <div className="attendance-list" style={{ padding: '14px 16px', margin: 0 }}>
              {displayedStudents.map((s: any) => {
                const stObj = studentStatusMap[s.id] || {};
                const rawStatus = stObj.status || (checked[s.id] !== undefined ? (checked[s.id] ? 'PRESENT' : 'ABSENT') : undefined);
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
                            : isAbsent
                              ? 'rgba(239, 68, 68, 0.04)'
                              : 'var(--bg-card)',
                      borderColor: isLeftEarly
                        ? 'rgba(245, 158, 11, 0.4)'
                        : isLate
                          ? 'rgba(37, 99, 235, 0.3)'
                          : isPresent
                            ? 'var(--border)'
                            : isAbsent
                              ? 'rgba(239, 68, 68, 0.3)'
                              : 'var(--border)',
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
                          background: isLeftEarly ? '#fef3c7' : isLate ? '#dbeafe' : isPresent ? '#eff6ff' : isAbsent ? '#fee2e2' : 'var(--bg-subtle)',
                          color: isLeftEarly ? '#b45309' : isLate ? '#1d4ed8' : isPresent ? '#2563eb' : isAbsent ? '#dc2626' : 'var(--text-muted)',
                          fontWeight: 700,
                          minWidth: 32,
                          textAlign: 'center'
                        }}
                      >
                        {s.roll_number || '•'}
                      </span>
                      <div>
                        <strong style={{ fontSize: 14, color: 'var(--text)' }}>{s.name}</strong>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {s.gender ? (
                            <span style={{
                              padding: '1px 6px',
                              borderRadius: 4,
                              fontSize: 10.5,
                              fontWeight: 600,
                              background: formatGender(s.gender) === 'Female' ? '#fdf2f8' : formatGender(s.gender) === 'Male' ? '#f0f9ff' : '#f8fafc',
                              color: formatGender(s.gender) === 'Female' ? '#db2777' : formatGender(s.gender) === 'Male' ? '#0284c7' : '#64748b',
                              border: `1px solid ${formatGender(s.gender) === 'Female' ? '#fbcfe8' : formatGender(s.gender) === 'Male' ? '#bae6fd' : '#e2e8f0'}`
                            }}>
                              {formatGender(s.gender)}
                            </span>
                          ) : null}
                          <span>{s.parent_name ? `Parent: ${s.parent_name}` : 'Parent registered'} · {s.parent_sms_number || 'Mobile on file'}</span>
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

                    {/* Right: Status Pill & Attendance Action Buttons */}
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
                                : isAbsent
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : 'rgba(100, 116, 139, 0.12)',
                          color: isLeftEarly ? '#b45309' : isLate ? '#2563eb' : isPresent ? '#059669' : isAbsent ? '#dc2626' : 'var(--text-muted)'
                        }}
                      >
                        {isLeftEarly ? '🚪 LEFT EARLY' : isLate ? '⏰ LATE' : isPresent ? '✓ PRESENT' : isAbsent ? '✕ ABSENT' : '⚪ UNMARKED'}
                      </span>

                      {/* Attendance Action Buttons */}
                      {isAlreadyEdited ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 600, padding: '4px 6px' }}>
                            (Finalized)
                          </span>
                          <button
                            type="button"
                            disabled={true}
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 5,
                              border: '1px solid var(--border)',
                              background: 'var(--bg-subtle, #f1f5f9)',
                              color: 'var(--text-muted, #94a3b8)',
                              cursor: 'not-allowed',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontWeight: 600,
                              opacity: 0.6
                            }}
                            title="Attendance has already been edited and finalized. No further edits permitted."
                          >
                            <Lock size={11} /> Edit Disabled
                          </button>
                        </div>
                      ) : Boolean(existingSession && !isEditingAttendance) ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 6px' }}>
                            (Submitted)
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsEditingAttendance(true)}
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 5,
                              border: '1px solid var(--border)',
                              background: 'var(--card)',
                              color: '#2563eb',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontWeight: 600
                            }}
                            title="Click to edit attendance (allowed once)"
                          >
                            <PenLine size={11} /> Edit
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {/* 1. Present Button */}
                          <button
                            type="button"
                            onClick={() => quickToggleStudent(s, 'PRESENT')}
                            title="Mark Present"
                            style={{
                              fontSize: 11.5,
                              padding: '5px 12px',
                              borderRadius: 6,
                              border: isPresent ? '1px solid #10b981' : '1px solid var(--border)',
                              background: isPresent ? '#10b981' : 'var(--bg-subtle)',
                              color: isPresent ? '#ffffff' : 'var(--text)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontWeight: isPresent ? 700 : 600,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            ✓ Present
                          </button>

                          {/* 2. Left Early Button */}
                          <button
                            type="button"
                            onClick={() => openEarlyDeparture(s)}
                            title="Mark student early departure"
                            style={{
                              fontSize: 11.5,
                              padding: '5px 12px',
                              borderRadius: 6,
                              border: isLeftEarly ? '1px solid #f59e0b' : '1px solid var(--border)',
                              background: isLeftEarly ? '#f59e0b' : 'var(--bg-subtle)',
                              color: isLeftEarly ? '#ffffff' : 'var(--text)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontWeight: isLeftEarly ? 700 : 600,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <DoorOpen size={13} />
                            Left Early
                          </button>

                          {/* 3. Mark Absent Button */}
                          <button
                            type="button"
                            onClick={() => quickToggleStudent(s, 'ABSENT')}
                            title="Mark Absent"
                            style={{
                              fontSize: 11.5,
                              padding: '5px 12px',
                              borderRadius: 6,
                              border: isAbsent ? '1px solid #ef4444' : '1px solid var(--border)',
                              background: isAbsent ? '#ef4444' : 'var(--bg-subtle)',
                              color: isAbsent ? '#ffffff' : 'var(--text)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontWeight: isAbsent ? 700 : 600,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            Mark Absent
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Red-Circled Bottom Pagination Footer */}
            <TablePaginationFooter
              currentPage={currentAttendancePage}
              totalPages={totalAttendancePages}
              onPageChange={p => { setAttendancePage(p); scrollToRosterTop(); }}
              startIdx={attendanceStartIdx}
              endIdx={attendanceEndIdx}
              filteredCount={filteredStudents.length}
              totalCount={students.length}
              itemLabel="students"
              onScrollToTop={scrollToRosterTop}
            />
          </>
        )}
      </div>

      {/* Bottom Submit / Re-attendance Action Bar */}
      {students.length > 0 && (
        <div className="submit-bar" style={{ marginTop: 20 }}>
          <div>
            <strong>Summary: {presentCount} Present</strong>, {absentCount} Absent
            {leftEarlyCount > 0 ? `, ${leftEarlyCount} Left Early` : ''}
            {lateCount > 0 ? `, ${lateCount} Late` : ''}
            {unmarkedCount > 0 ? `, ${unmarkedCount} Unmarked` : ` (${ratePct}% Rate)`}
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
            {existingSession && !isEditingAttendance ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={true}
                  style={{ minWidth: 190, opacity: 0.9, cursor: 'default', background: '#059669', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}
                >
                  <CheckCircle2 size={15} /> {isAlreadyEdited ? 'Attendance Finalized' : 'Attendance Submitted'}
                </button>
                {canEditAttendance && (
                  <button
                    type="button"
                    onClick={() => setIsEditingAttendance(true)}
                    style={{ minWidth: 150, background: '#2563eb', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: 13, border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
                  >
                    <PenLine size={14} /> Edit Attendance
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {existingSession && isEditingAttendance && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setIsEditingAttendance(false);
                      checkTodayStatus(selectedClassId, selectedSectionId, attendanceDate, students);
                    }}
                    style={{ fontSize: 13 }}
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => {
                    if (existingSession) {
                      submitWholeClassReattendance();
                    } else {
                      initiateAttendancePreview(false);
                    }
                  }}
                  style={{ minWidth: 180, background: existingSession ? '#2563eb' : undefined }}
                >
                  {busy ? 'Saving…' : existingSession ? '✓ Submit Updated Attendance' : 'Review & Submit Attendance'}
                </button>
              </div>
            )}
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
                Roll: {selectedStudent.roll_number || '—'} · Parent: {selectedStudent.parent_name || 'Parent'} ({selectedStudent.parent_sms_number || 'Mobile on record'})
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
                  Exact Departure Time: <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(hh:mm format)</span>
                </label>
                <input
                  type="time"
                  value={depTime}
                  onChange={(e) => setDepTime(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600 }}
                  required
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
                  <option value="Parent Picked Up Early">Parent Picked Up Early</option>
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
                <span style={{ fontWeight: 600 }}>Dispatch early departure alert to Parent (SMS & Portal)</span>
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
                Roll: {selectedStudent.roll_number || '—'} · Parent: {selectedStudent.parent_name || 'Parent'}
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
                  Arrival Time: <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(hh:mm format)</span>
                </label>
                <input
                  type="time"
                  value={arrTime}
                  onChange={(e) => setArrTime(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600 }}
                  required
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
                <span style={{ fontWeight: 600 }}>Notify Parent of Late Arrival</span>
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
      {activeModal === 'AUDIT_LOGS' && (() => {
        const filteredAuditLogs = auditLogs.filter((log: any) => {
          if (auditStatusFilter !== 'ALL') {
            const ns = (log.new_status || log.newStatus || '').toUpperCase();
            const ps = (log.previous_status || log.previousStatus || '').toUpperCase();
            if (ns !== auditStatusFilter && ps !== auditStatusFilter) return false;
          }
          if (auditSearch.trim()) {
            const q = auditSearch.toLowerCase();
            const name = (log.student_name || log.studentName || '').toLowerCase();
            const roll = (log.roll_number || log.rollNumber || '').toLowerCase();
            const reason = (log.reason || '').toLowerCase();
            const by = (log.modified_by_name || log.modifiedByName || log.changed_by_name || '').toLowerCase();
            if (!name.includes(q) && !roll.includes(q) && !reason.includes(q) && !by.includes(q)) return false;
          }
          return true;
        });

        return (
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

              {/* Filter & Export Toolbar */}
              <div style={{
                padding: '12px 24px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-subtle, #f8fafc)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search student, roll, faculty, reason..."
                      value={auditSearch}
                      onChange={e => setAuditSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        fontSize: 12.5,
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card)'
                      }}
                    />
                    {auditSearch && (
                      <button
                        onClick={() => setAuditSearch('')}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}
                      >✕</button>
                    )}
                  </div>
                  <select
                    value={auditStatusFilter}
                    onChange={e => setAuditStatusFilter(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12.5,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)'
                    }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="LEFT_EARLY">Left Early</option>
                    <option value="LATE">Late Arrival</option>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                </div>

                {canExportAudit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="secondary"
                      onClick={() => handleExportAudit('csv')}
                      disabled={exportingAudit || !existingSession?.id}
                      title="Export filtered audit logs as CSV spreadsheet"
                      style={{ fontSize: 12, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <Download size={13} />
                      {exportingAudit ? 'Exporting...' : 'Export CSV'}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => handleExportAudit('xlsx')}
                      disabled={exportingAudit || !existingSession?.id}
                      title="Export filtered audit logs as styled Excel spreadsheet (.xlsx)"
                      style={{ fontSize: 12, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(16, 185, 129, 0.08)', color: '#059669', borderColor: '#10b981' }}
                    >
                      <FileSpreadsheet size={13} />
                      {exportingAudit ? 'Exporting...' : 'Export Excel (.xlsx)'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                  Immutable historical record of all attendance submissions, re-roll calls, early departure adjustments, and late arrivals for this session.
                </p>

                {filteredAuditLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    <HistoryIcon size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {auditLogs.length === 0 ? 'No re-attendance events recorded yet' : 'No matching audit records found'}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                      {auditLogs.length === 0 ? 'Initial roll-call was submitted with no subsequent adjustments.' : 'Try adjusting your search criteria or status filter.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredAuditLogs.map((log: any, idx: number) => {
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

              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Showing <strong>{filteredAuditLogs.length}</strong> of <strong>{auditLogs.length}</strong> records
                </div>
                <button className="secondary" onClick={() => setActiveModal(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Universal Attendance Roster Preview Modal */}
      <UniversalPreviewModal
        isOpen={attendancePreview.isOpen}
        onClose={() => setAttendancePreview(prev => ({ ...prev, isOpen: false }))}
        onEdit={() => setAttendancePreview(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeConfirmAttendance}
        title={attendancePreview.title}
        subtitle={attendancePreview.subtitle}
        operationType="submit"
        confirmText={attendancePreview.confirmText}
        editText="Back to Edit Sheet"
        summaryCards={attendancePreview.summaryCards}
        tableData={attendancePreview.tableData}
        loading={attendancePreview.loading}
        error={attendancePreview.error}
      />
    </Layout>
  );
}

function formatAttendanceHistoryDate(raw: any): string {
  if (!raw) return '—';
  try {
    const str = String(raw).trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      }
    }
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    }
    return str;
  } catch {
    return String(raw);
  }
}

function formatHistoryClassLabel(classNum: any): string {
  const n = Number(classNum);
  if (n === -1 || classNum === '-1') return 'Class L KG';
  if (n === 0 || classNum === '0') return 'Class U KG';
  if (classNum !== undefined && classNum !== null && classNum !== '') return `Class ${classNum}`;
  return 'Class';
}

/* ────── History ────── */
function History() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Inspector modal state
  const [inspectedSession, setInspectedSession] = useState<any>(null);
  const [inspectedRecords, setInspectedRecords] = useState<any[]>([]);
  const [inspectedAuditLogs, setInspectedAuditLogs] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'AUDIT'>('ROSTER');
  const canExportAudit = ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(user?.role || '');

  const handleExportInspectedAudit = async (format: 'csv' | 'xlsx') => {
    if (!inspectedSession?.id) return;
    try {
      const res = await api.get(`/teacher/attendance/${inspectedSession.id}/audit-trail/export`, {
        params: { format },
        responseType: 'blob'
      });

      const cleanDate = inspectedSession.attendance_date ? String(inspectedSession.attendance_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
      let filename = `attendance-audit-session-${inspectedSession.id.slice(0, 8)}-${cleanDate}.${format}`;
      const disposition = res.headers['content-disposition'] || res.headers['Content-Disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = new Blob([res.data], {
        type: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8;'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Audit export error in History:', err);
      alert(err?.response?.data?.message || 'Failed to export audit trail');
    }
  };

  useEffect(() => {
    api.get('/teacher/attendance/history')
      .then(x => setRows(Array.isArray(x.data) ? x.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

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
                <th>Total No. of Students</th>
                <th>Present</th>
                <th>Left Early</th>
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
                  const dateStr = formatAttendanceHistoryDate(x.attendance_date);
                  const leftEarlyCount = Number(x.left_early_count || 0);
                  const lateCount = Number(x.late_count || 0);
                  const absentCount = Number(x.absent ?? (x.total - x.present));

                  return (
                    <tr key={x.id}>
                      <td><b>{dateStr}</b></td>
                      <td><span className="badge" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 600 }}>{formatHistoryClassLabel(x.class_number)}-{x.section_name}</span></td>
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
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {x.total || 0}
                        </span>
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
                            href={`#/take-attendance?classId=${x.class_id}&sectionId=${x.section_id}&date=${(x.attendance_date ? String(x.attendance_date).slice(0, 10) : '')}`}
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
                    {formatHistoryClassLabel(inspectedSession.class_number)}-{inspectedSession.section_name}
                  </span>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                    Session Inspection ({formatAttendanceHistoryDate(inspectedSession.attendance_date)})
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '4px 0' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      Total re-attendance events: <strong>{inspectedAuditLogs.length}</strong>
                    </span>
                    {canExportAudit && inspectedSession?.id && inspectedAuditLogs.length > 0 && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="secondary"
                          onClick={() => handleExportInspectedAudit('csv')}
                          style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Download size={13} /> Export CSV
                        </button>
                        <button
                          className="secondary"
                          onClick={() => handleExportInspectedAudit('xlsx')}
                          style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16, 185, 129, 0.08)', color: '#059669', borderColor: '#10b981' }}
                        >
                          <FileSpreadsheet size={13} /> Export Excel
                        </button>
                      </div>
                    )}
                  </div>
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
                href={`#/take-attendance?classId=${inspectedSession.class_id}&sectionId=${inspectedSession.section_id}&date=${(inspectedSession.attendance_date ? String(inspectedSession.attendance_date).slice(0, 10) : '')}`}
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
function NotificationCenter() {
  const { user } = useAuth();
  if (user?.role === 'SCHOOL_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [channels, setChannels] = useState<any>(null);
  const [smtp, setSmtp] = useState<any>({
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'STARTTLS',
    username: '',
    password: '',
    senderEmail: 'attendance@school.local',
    senderName: 'School Attendance Office',
    isEnabled: true
  });
  const [showPass, setShowPass] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [reviewNotifs, setReviewNotifs] = useState<any[]>([]);
  const [tab, setTab] = useState<'settings' | 'smtp' | 'templates' | 'analytics' | 'logs' | 'requests'>('settings');
  const [msg, setMsg] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [testModal, setTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState(user?.email || 'admin@demo-school.local');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
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

  async function loadReviewQueue() {
    try {
      const res = await api.get('/reviews/notifications');
      if (res.data?.success) {
        setReviewNotifs(res.data.notifications || []);
      }
    } catch { }
  }

  async function load() {
    try {
      const [a, b, c, d, e] = await Promise.all([
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
      loadReviewQueue();
    } catch { }
  }

  useEffect(() => { load() }, []);

  async function saveChannels() {
    await api.put('/notifications-v11/channels', {
      smsEnabled: channels.sms_enabled,
      whatsappEnabled: channels.whatsapp_enabled,
      emailEnabled: channels.email_enabled,
      whatsappProvider: channels.whatsapp_provider,
      whatsappApiUrl: channels.whatsapp_api_url || '',
      whatsappApiKey: channels.whatsapp_api_key || ''
    });
    setMsg('Channel delivery settings saved.');
  }

  async function saveSmtp() {
    try {
      await api.put('/notifications-v11/smtp', smtp);
      setMsg('SMTP Email server configuration saved successfully!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save SMTP settings');
    }
  }

  async function runTestEmail(e: React.FormEvent) {
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

  async function process() {
    const x = await api.post('/notifications-v11/process');
    setMsg(`Queue processed: ${x.data.sent} sent, ${x.data.failed} failed.`);
    load();
  }

  const set = (k: string, v: any) => setChannels({ ...channels, [k]: v });

  return <Layout>
    <PageHead title="Notification Center" sub="Manage SMS, WhatsApp, and SMTP Email alerts for student absences." />

    <div className="tabs">
      <button className={tab === 'settings' ? 'tab-active' : ''} onClick={() => setTab('settings')}>Channels</button>
      <button className={tab === 'smtp' ? 'tab-active' : ''} onClick={() => setTab('smtp')}>📧 SMTP Email Settings</button>
      <button className={tab === 'templates' ? 'tab-active' : ''} onClick={() => setTab('templates')}>📑 Templates & Live Preview</button>
      <button className={tab === 'analytics' ? 'tab-active' : ''} onClick={() => setTab('analytics')}>Analytics</button>
      <button className={tab === 'logs' ? 'tab-active' : ''} onClick={() => setTab('logs')}>Delivery logs</button>
      <button className={tab === 'requests' ? 'tab-active' : ''} onClick={() => setTab('requests')}>📸 Pending Approvals {reviewNotifs.length > 0 ? `(${reviewNotifs.length})` : ''}</button>
    </div>

    {msg && <div className="success" style={{ marginBottom: 16 }}>{msg}</div>}

    {/* TAB 1: GENERAL CHANNELS */}
    {tab === 'settings' && channels && (
      <div className="panel">
        <h3>Notification Channels</h3>
        <p className="muted">Configure active dispatch channels for absent notifications.</p>
        <label className="checkline">
          <input type="checkbox" checked={channels.sms_enabled} onChange={e => set('sms_enabled', e.target.checked)} /> SMS Enabled
        </label>
        <label className="checkline">
          <input type="checkbox" checked={channels.whatsapp_enabled} onChange={e => set('whatsapp_enabled', e.target.checked)} /> WhatsApp Enabled
        </label>
        <label className="checkline">
          <input type="checkbox" checked={channels.email_enabled} onChange={e => set('email_enabled', e.target.checked)} /> Email Alerts Enabled (Automatic Absent Notifications)
        </label>

        {channels.whatsapp_enabled && (
          <div style={{ marginTop: 14, padding: 14, background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
            <label>WhatsApp Provider
              <select value={channels.whatsapp_provider || 'MOCK'} onChange={e => set('whatsapp_provider', e.target.value)}>
                <option value="MOCK">MOCK (Local Sandbox)</option>
                <option value="HTTP">HTTP API Gateway</option>
              </select>
            </label>
            <label>WhatsApp API URL
              <input value={channels.whatsapp_api_url || ''} onChange={e => set('whatsapp_api_url', e.target.value)} />
            </label>
            <label>WhatsApp API Key
              <input type="password" value={channels.whatsapp_api_key || ''} onChange={e => set('whatsapp_api_key', e.target.value)} />
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
    {tab === 'smtp' && (
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
              <label>SMTP Username / Login Email <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700 }}>(e.g. notifications@school.edu)</span>
                <input
                  placeholder="e.g. notifications@school.edu"
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
                    placeholder="e.g. 16-digit App Password"
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
    {tab === 'templates' && (
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
            <span style={{ fontWeight: 700, color: 'var(--text-secondary, #475569)' }}>Subject:</span>
            <span style={{ fontWeight: 600, color: 'var(--text, #0f172a)' }}>{previewData?.subject || 'Loading preview...'}</span>
          </div>

          {/* Preview Viewport Container */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            background: 'var(--bg-muted, #e2e8f0)',
            padding: '24px 16px',
            borderRadius: 10,
            overflowX: 'auto',
            minHeight: 460
          }}>
            {previewLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--text-muted, #64748b)' }}>
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
                  border: '1px solid var(--border, #cbd5e1)',
                  borderRadius: previewDevice === 'mobile' ? 24 : 8,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  transition: 'width 0.25s ease'
                }}
              />
            ) : (
              <div style={{
                width: previewDevice === 'desktop' ? '650px' : '375px',
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: 8,
                padding: 20,
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                color: 'var(--text, #1e293b)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                transition: 'width 0.25s ease'
              }}>
                {previewData?.text || 'No plain-text version available.'}
              </div>
            )}
          </div>
        </div>

        {/* Deliverability & Email Authentication Guide */}
        <div className="panel" style={{ background: 'var(--card-subtle, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ShieldCheck size={20} color="#059669" />
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
              Institutional Email Deliverability &amp; DNS Authentication Guide
            </h4>
          </div>
          <p style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--text-secondary, #475569)', lineHeight: 1.5 }}>
            To protect your institution's domain reputation and achieve optimal inbox placement with Gmail, Microsoft 365, and institutional spam filters, configure your school domain DNS records:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: 12, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>1. SPF Record (Sender Policy)</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)', marginBottom: 4 }}>TXT record at domain root:</div>
              <code style={{ fontSize: 11, background: 'var(--card-subtle, #f1f5f9)', color: 'var(--text, #0f172a)', padding: '4px 6px', borderRadius: 4, display: 'block', wordBreak: 'break-all' }}>
                v=spf1 include:_spf.google.com ~all
              </code>
            </div>
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: 12, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>2. DKIM Signature (DomainKeys)</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)', marginBottom: 4 }}>2048-bit cryptographic key published at:</div>
              <code style={{ fontSize: 11, background: 'var(--card-subtle, #f1f5f9)', color: 'var(--text, #0f172a)', padding: '4px 6px', borderRadius: 4, display: 'block' }}>
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
          {['SMS', 'WHATSAPP'].map(ch => {
            const t = templates.find(x => x.channel === ch);
            return (
              <div className="template-box" key={ch}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <b>{ch} Template</b>
                  <span className="badge active">ACTIVE</span>
                </div>
                <textarea
                  defaultValue={t?.body || `Attendance Alert: {student_name} was absent from Class {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.`}
                  onBlur={async e => { await api.put('/notifications-v11/templates/' + ch, { body: e.target.value }); load(); }}
                />
                <small className="muted">Variables: {'{student_name}'} {'{class_name}'} {'{section}'} {'{time}'} {'{teacher_name}'} {'{enquiry_number}'}</small>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* TAB 4: ANALYTICS */}
    {tab === 'analytics' && <>
      <div className="stats">
        <Stat label="Total Alerts" value={analytics?.totals?.total ?? 0} />
        <Stat label="Delivered" value={analytics?.totals?.sent ?? 0} />
        <Stat label="Queued" value={analytics?.totals?.queued ?? 0} />
        <Stat label="Failed" value={analytics?.totals?.failed ?? 0} />
      </div>
      <div className="panel">
        <h3>Dispatch Metrics by Channel</h3>
        <div className="list">
          {analytics?.byChannel?.map((x: any, i: number) => (
            <div className="list-row" key={i}>
              <b>{x.channel}</b>
              <span>{x.status} · {x.count}</span>
            </div>
          ))}
        </div>
      </div>
    </>}

    {/* TAB 5: LOGS */}
    {tab === 'logs' && (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Admission No.</th>
              <th>Recipient / Student</th>
              <th>Channel</th>
              <th>Mail ID</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(x => (
              <tr key={x.id}>
                <td>
                  {x.admission_number ? (
                    <code style={{ fontSize: 12, fontWeight: 700, padding: '2px 6px', background: 'var(--bg, #f1f5f9)', borderRadius: 4 }}>
                      {x.admission_number}
                    </code>
                  ) : (
                    <span style={{ color: 'var(--muted, #94a3b8)' }}>—</span>
                  )}
                </td>
                <td><b>{x.recipient_name || x.student_name || '—'}</b></td>
                <td><span className="badge">{x.channel}</span></td>
                <td><code>{x.recipient}</code></td>
                <td><span className={`badge ${x.status === 'SENT' ? 'active' : 'processing'}`}>{x.status}</span></td>
                <td>{x.attempts}</td>
                <td>{x.created_at?.slice(0, 19).replace('T', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* TAB 6: PENDING APPROVAL REQUESTS */}
    {tab === 'requests' && (
      <div className="panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17 }}>Administrative Approval Requests</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
              Live queue of photo approval requests and leave applications awaiting verification.
            </p>
          </div>
          <button className="small-btn" onClick={() => loadReviewQueue()}>
            <RefreshCw size={12} /> Refresh Queue
          </button>
        </div>

        {reviewNotifs.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={32} style={{ color: '#10B981', margin: '0 auto 8px', display: 'block' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>All review queues are clear!</p>
            <span style={{ fontSize: 12.5, opacity: 0.8 }}>No pending student photo submissions or leave requests.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reviewNotifs.map((item: any) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {item.avatar ? (
                    <img
                      src={item.avatar}
                      alt={item.applicantName}
                      style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover', border: '1px solid #bfdbfe' }}
                    />
                  ) : (
                    <div style={{ width: 46, height: 46, borderRadius: 8, background: '#EFF6FF', display: 'grid', placeItems: 'center', color: '#2563EB' }}>
                      {item.type === 'PHOTO_APPROVAL' ? <Camera size={20} /> : <Calendar size={20} />}
                    </div>
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ fontSize: 14 }}>{item.applicantName}</strong>
                      <span className="badge" style={{ fontSize: 11, background: item.type === 'PHOTO_APPROVAL' ? '#EFF6FF' : '#FEF3C7', color: item.type === 'PHOTO_APPROVAL' ? '#1D4ED8' : '#92400E' }}>
                        {item.type === 'PHOTO_APPROVAL' ? 'Photo Submission' : 'Leave Request'}
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {item.message}
                    </p>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Submitted {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'recently'}
                    </span>
                  </div>
                </div>

                <a
                  href={`#${item.link}`}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: '#2563EB',
                    color: '#FFF',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  Review Request →
                </a>
              </div>
            ))}
          </div>
        )}
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
function Notifications() {
  const { user } = useAuth(); const [settings, setSettings] = useState<any>({ sms_enabled: true, provider: 'mock', sender_id: '', template: 'Dear Parent, {student_name} was absent from {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.' }); const [logs, setLogs] = useState<any[]>([]); const [busy, setBusy] = useState(false);
  async function load() { const [a, b] = await Promise.all([api.get('/notifications/settings'), api.get('/notifications/logs')]); setSettings(a.data); setLogs(b.data) } useEffect(() => { load() }, []);
  async function save() { setBusy(true); try { await api.put('/notifications/settings', { smsEnabled: settings.sms_enabled, provider: settings.provider, senderId: settings.sender_id, template: settings.template }); alert('Notification settings saved') } catch (e: any) { alert(e?.response?.data?.message || 'Save failed') } finally { setBusy(false) } }
  async function process() { setBusy(true); try { const r = await api.post('/notifications/process'); alert(`Processed ${r.data.processed}: ${r.data.sent} sent, ${r.data.failed} failed`); load() } catch (e: any) { alert('Queue processing failed') } finally { setBusy(false) } }
  return <Layout><PageHead title="Parent SMS" sub="Automatic absent notifications, templates and delivery logs." /><div className="two-col"><div className="panel"><h3>SMS settings</h3><label className="toggle"><input type="checkbox" checked={settings.sms_enabled !== false} onChange={e => setSettings({ ...settings, sms_enabled: e.target.checked })} /> Enable parent SMS</label><label>Provider<select value={settings.provider || 'mock'} onChange={e => setSettings({ ...settings, provider: e.target.value })}><option value="mock">Mock / Local testing</option><option value="http">HTTP SMS provider</option></select></label><label>Sender ID<input value={settings.sender_id || ''} onChange={e => setSettings({ ...settings, sender_id: e.target.value })} /></label><label>Message template<textarea value={settings.template || ''} onChange={e => setSettings({ ...settings, template: e.target.value })} /></label><p className="muted small">Variables: {'{student_name}'}, {'{class_name}'}, {'{section}'}, {'{time}'}, {'{teacher_name}'}, {'{enquiry_number}'}</p><div className="inline"><button disabled={busy} onClick={save}>Save settings</button><button className="secondary" disabled={busy} onClick={process}>Process queue</button></div></div><div className="panel"><h3>How it works</h3><div className="flow"><b>1. Teacher submits</b><span>Unchecked students become ABSENT.</span><b>2. System queues SMS</b><span>Parent number and class details are inserted into the template.</span><b>3. Provider sends</b><span>Mock mode works locally; HTTP mode connects to your SMS gateway.</span><b>4. Delivery is logged</b><span>Queued, processing, sent or failed status is stored.</span></div></div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Parent SMS</th><th>Status</th><th>Attempts</th><th>Message</th><th>Created</th></tr></thead><tbody>{logs.map(x => <tr key={x.id}><td>{x.student_name || '—'}</td><td>{x.parent_number}</td><td><span className={'badge ' + String(x.status).toLowerCase()}>{x.status}</span></td><td>{x.attempts}</td><td>{x.message}</td><td>{new Date(x.created_at).toLocaleString()}</td></tr>)}</tbody></table></div></Layout>
}

/* ────── Subscription (School) ────── */
function SubscriptionPage() {
  const { user } = useAuth();
  const [s, setS] = useState<any>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [subDays, setSubDays] = useState(30);
  const [msg, setMsg] = useState('');

  async function load() {
    const [a, b, c] = await Promise.all([
      api.get('/school-payment/subscription'),
      api.get('/school-payment/payments'),
      api.get('/school-payment/plans').catch(() => ({ data: [] }))
    ]);
    setS(a.data);
    setPayments(b.data);
    setAvailablePlans(c.data || []);
  }

  useEffect(() => { load() }, []);

  async function renew() {
    setBusy(true); setMsg('');
    try {
      const order = (await api.post('/school-payment/renew/order', { days: subDays, gateway: 'MOCK' })).data;
      await api.post('/school-payment/renew/mock-complete', { orderId: order.orderId, days: subDays });
      setMsg('Payment successful. Subscription renewed.');
      await load();
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Payment failed') }
    finally { setBusy(false) }
  }

  return <Layout><PageHead title="Subscription & Billing" sub="View your plan, validity, payments and renew your school subscription." />
    <div className="stats">
      <Stat label="Plan" value={s?.plan_name || '—'} />
      <Stat label="Students" value={s?.student_count ?? '—'} />
      <Stat label="Days remaining" value={s?.days_remaining ?? '—'} />
      <Stat label="Status" value={s?.computed_status || '—'} />
    </div>
    <div className="two-col">
      <div className="panel">
        <h3>Current subscription</h3>
        <div className="list">
          <div className="list-row"><b>Start</b><span>{s?.start_date?.slice(0, 10) || '—'}</span></div>
          <div className="list-row"><b>End</b><span>{s?.end_date?.slice(0, 10) || '—'}</span></div>
          <div className="list-row"><b>Student limit</b><span>{s?.max_students ?? '—'}</span></div>
          <div className="list-row"><b>Monthly plan</b><span>₹{Number(s?.price_monthly || 0).toLocaleString('en-IN')}</span></div>
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
          <select value={subDays} onChange={e => setSubDays(Number(e.target.value))}>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>365 days</option>
          </select>
        </label>
        <p className="muted">Use mock mode for local testing. If Razorpay is configured on the server, the production checkout endpoint is available.</p>
        <button disabled={busy} onClick={renew}>{busy ? 'Processing…' : `Pay & renew ${subDays} days (Test)`}</button>
        {msg && <div className="success">{msg}</div>}
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
              <div key={p.id} style={{ border: isCurrent ? '2px solid #2563eb' : '1px solid var(--border, #e2e8f0)', borderRadius: '10px', padding: '16px', background: isCurrent ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card, #ffffff)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text, #0f172a)' }}>{p.name}</h4>
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
                    <span style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text, #0f172a)' }}>₹{Number(discountedMonthly).toLocaleString('en-IN')}</span>
                    {hasDiscount && (
                      <span style={{ fontSize: '14px', textDecoration: 'line-through', color: '#94a3b8' }}>₹{Number(p.price_monthly).toLocaleString('en-IN')}</span>
                    )}
                    <span style={{ fontSize: '12px', color: '#64748b' }}>/ month</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    ₹{Number(p.price_yearly || p.price_monthly * 12).toLocaleString('en-IN')} / year
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border, #f1f5f9)', paddingTop: '10px', fontSize: '12px', color: 'var(--text-secondary, #334155)' }}>
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
          <tbody>{payments.map(p => <tr key={p.id}><td>{p.created_at?.slice(0, 19).replace('T', ' ')}</td><td>{p.provider}</td><td>₹{Number(p.amount || 0).toLocaleString('en-IN')}</td><td><span className="badge">{p.status}</span></td><td>{p.invoice_number || '—'}</td><td>{p.receipt_number || '—'} {p.invoice_id && <button className="small-btn" onClick={() => window.open(`${API_BASE_URL}/super-admin/invoices/${p.invoice_id}/receipt`, '_blank')}>Receipt</button>}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  </Layout>
}

/* ────── Invoices (Super Admin & School Admin) ────── */
function Invoices() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function load() {
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

  useEffect(() => { load() }, [user?.role]);

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
function SuperMonitor() {
  const { user } = useAuth(); const [d, setD] = useState<any>(null); const [busy, setBusy] = useState(false);
  async function load() { setD((await api.get('/super-admin/monitor')).data) }
  useEffect(() => { load() }, []);
  const m = d?.metrics || {};
  const attendance = (Number(m.today_present || 0) + Number(m.today_absent || 0));
  return <Layout><PageHead title="SaaS Monitoring" sub="Live operational view of schools, subscriptions and today's attendance." />
    <div className="stats">
      <Stat label="Schools" value={m.total_schools ?? '—'} /><Stat label="Active" value={m.active_schools ?? '—'} />
      <Stat label="Expired" value={m.expired_schools ?? '—'} /><Stat label="Students" value={m.total_students ?? '—'} />
      <Stat label="Today's sessions" value={m.today_sessions ?? '—'} /><Stat label="Revenue" value={`₹${Number(m.total_revenue || 0).toLocaleString('en-IN')}`} />
    </div>
    <div className="two-col">
      <div className="panel"><h3>Today's attendance</h3>
        <div className="list"><div className="list-row"><b>Present</b><span>{m.today_present ?? 0}</span></div><div className="list-row"><b>Absent</b><span>{m.today_absent ?? 0}</span></div><div className="list-row"><b>Recorded</b><span>{attendance}</span></div></div>
      </div>
      <div className="panel"><h3>Expiring within 7 days</h3>
        {d?.expiringSoon?.length ? <div className="list">{d.expiringSoon.map((x: any) => <div className="list-row" key={x.id}><b>{x.name}</b><span>{x.plan_name} · {x.end_date?.slice(0, 10)}</span></div>)}</div> : <p className="muted">No schools expiring in the next 7 days.</p>}
      </div>
    </div>
    <div className="panel"><div className="panel-head"><h3>Subscription operations</h3><button className="small-btn" disabled={busy} onClick={async () => { setBusy(true); try { await api.post('/super-admin/subscriptions/expire-now'); await load() } finally { setBusy(false) } }}>{busy ? 'Refreshing…' : 'Refresh expiry status'}</button></div>
      <p className="muted">Run this after a deployment or schedule the backend subscription worker to keep expired schools synchronized automatically.</p></div>
  </Layout>
}

/* ────── Payments (Super Admin & School Admin) ────── */
function Payments() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function load() {
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

  useEffect(() => { load() }, [user?.role]);

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
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ contact_number: '', address: '', website: '' });
  const [websiteError, setWebsiteError] = useState('');
  const [contactNumberError, setContactNumberError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Picture upload state
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoMsg({ type: 'error', text: 'Please select a valid image file (PNG, JPG, JPEG, WebP, SVG).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoMsg({ type: 'error', text: 'Image size exceeds the 5MB limit. Please choose a smaller picture.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setPhotoUploading(true);
      setPhotoMsg(null);
      try {
        const res = await api.post('/school-profile/photo', { photo_url: base64 });
        const uploadedUrl = res.data?.photo_url || base64;
        setProfile((prev: any) => ({ ...prev, photo_url: uploadedUrl, photoUrl: uploadedUrl }));
        if (updateUser) {
          updateUser({ photo_url: uploadedUrl, photoUrl: uploadedUrl });
        }
        setPhotoMsg({ type: 'success', text: 'School Admin profile picture uploaded and saved successfully!' });
      } catch (err: any) {
        setPhotoMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to upload profile picture' });
      } finally {
        setPhotoUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setPhotoMsg({ type: 'error', text: 'Failed to read image file.' });
    };
    reader.readAsDataURL(file);
  }

  async function handleRemovePhoto() {
    if (!confirm('Are you sure you want to remove your profile picture?')) return;
    setPhotoUploading(true);
    setPhotoMsg(null);
    try {
      await api.delete('/school-profile/photo');
      setProfile((prev: any) => ({ ...prev, photo_url: '', photoUrl: '' }));
      if (updateUser) {
        updateUser({ photo_url: '', photoUrl: '' });
      }
      setPhotoMsg({ type: 'success', text: 'Profile picture removed successfully.' });
    } catch (err: any) {
      setPhotoMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to remove picture' });
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (!currentPassword) {
      setPwMsg({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      setPwMsg({ type: 'error', text: pwCheck.message || 'Password must meet complexity requirements.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setChangingPw(true);
    try {
      const res = await api.put('/school-profile/change-password', {
        currentPassword,
        newPassword
      });
      setPwMsg({ type: 'success', text: res.data?.message || 'School Admin password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to update School Admin password' });
    } finally {
      setChangingPw(false);
    }
  }

  // Universal Preview State for School Profile
  const [profilePreview, setProfilePreview] = useState<{
    isOpen: boolean;
    sections: PreviewSectionData[];
    changes?: PreviewChangeData[];
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    sections: [],
    loading: false,
    error: null,
  });

  // Helper: Format school phone into 0343-2563500 (11-digit STD code with hyphen after 4 digits, 10-digit adds leading 0)
  function formatSchoolContactNumber(val: string): string {
    if (!val) return '';
    let digits = val.replace(/\D/g, '');
    // If 10 digits without leading 0, prepend 0 to make it 11 digits
    if (digits.length === 10 && !digits.startsWith('0')) {
      digits = '0' + digits;
    }
    digits = digits.slice(0, 11);
    if (digits.length > 4) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    if (digits.length === 4 && val.endsWith('-')) {
      return `${digits}-`;
    }
    return digits;
  }

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/school-profile');
      setProfile(res.data);
      const rawContact = res.data.contact_number || res.data.enquiry_number || res.data.phone || '';
      setForm({
        contact_number: formatSchoolContactNumber(rawContact),
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

  function initiateSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setWebsiteError('');
    setContactNumberError('');
    setAddressError('');
    if (!form.contact_number && !form.address && !form.website) {
      alert('Validation Error: Please provide at least one contact coordinate to update.');
      return;
    }

    let cleanContact = (form.contact_number || '').trim();
    if (cleanContact) {
      let digitsOnly = cleanContact.replace(/\D/g, '');
      if (digitsOnly.length === 10 && !digitsOnly.startsWith('0')) {
        digitsOnly = '0' + digitsOnly;
      }
      if (digitsOnly.length !== 11) {
        setContactNumberError('Contact number must be an 11-digit number in 0343-2563500 format.');
        setMsg({ type: 'error', text: 'Validation Error: Contact number must be an 11-digit number in 0343-2563500 format (e.g. 0343-2563500).' });
        return;
      }
      cleanContact = `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4)}`;
    }

    const cleanAddress = (form.address || '').trim();
    if (cleanAddress) {
      if (cleanAddress.length < 50 || cleanAddress.length > 1000) {
        setAddressError(`Campus physical address word limit must be between 50 to 1000 (currently: ${cleanAddress.length}).`);
        setMsg({ type: 'error', text: `Validation Error: Campus physical address word limit must be between 50 to 1000 (currently: ${cleanAddress.length}).` });
        return;
      }
    }

    let normalizedWebsite = (form.website || '').trim();
    if (normalizedWebsite) {
      // Validate: Strictly reject arbitrary plain words like 'dav', 'school', 'test', 'hello'
      const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i;
      let valid = urlPattern.test(normalizedWebsite);
      if (valid) {
        try {
          const withProto = normalizedWebsite.startsWith('http://') || normalizedWebsite.startsWith('https://')
            ? normalizedWebsite
            : `https://${normalizedWebsite}`;
          const parsed = new URL(withProto);
          valid = !!parsed.hostname && parsed.hostname.includes('.');
          normalizedWebsite = withProto;
        } catch {
          valid = false;
        }
      }

      if (!valid) {
        setWebsiteError('Please enter a valid official website URL (e.g. https://davmodeldurgapur.org or davmodeldurgapur.org). Plain words are not allowed.');
        setMsg({ type: 'error', text: 'Validation Error: Please enter a valid website link (e.g. https://davmodeldurgapur.org). Plain words are not allowed.' });
        return;
      }
    }

    const updatedForm = { ...form, contact_number: cleanContact, website: normalizedWebsite, address: cleanAddress };
    setForm(updatedForm);

    const changes = calculateChanges(
      profile,
      updatedForm,
      {
        contact_number: 'Contact / Enquiry Phone',
        website: 'Official Website',
        address: 'Physical Campus Address'
      }
    );

    const sections: PreviewSectionData[] = [
      {
        title: 'Institution Contact Coordinates',
        fields: [
          { label: 'Enquiry / Contact Number', value: updatedForm.contact_number || '—', type: 'phone' },
          { label: 'Official Website', value: updatedForm.website || '—' },
          { label: 'Campus Physical Address', value: updatedForm.address || '—', span: 2 }
        ]
      }
    ];

    setProfilePreview({
      isOpen: true,
      sections,
      changes,
      loading: false,
      error: null
    });
  }

  async function executeConfirmSaveProfile() {
    setProfilePreview(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await api.put('/school-profile', form);
      setProfile(res.data);
      setProfilePreview(prev => ({ ...prev, isOpen: false, loading: false }));
      setMsg({ type: 'success', text: 'School profile updated successfully!' });
      if (res.data?.website) {
        try {
          localStorage.setItem('attendo_school_website', res.data.website);
        } catch { }
      }
      if (updateUser && res.data?.website) {
        updateUser({ schoolWebsite: res.data.website });
      }
      window.dispatchEvent(new CustomEvent('school-profile-updated', { detail: res.data }));
    } catch (err: any) {
      setProfilePreview(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || 'Failed to update school profile'
      }));
    }
  }

  const currentPhoto = profile?.photo_url || profile?.photoUrl || user?.photo_url || user?.photoUrl || '';
  const adminName = user?.name || profile?.adminName || 'School Administrator';
  const adminInitials = adminName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'SA';

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
        <>
          {/* ── Administrator & Institutional Picture Section (Admin Only) ── */}
          <div className="panel" style={{ marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                {/* Picture Frame with Hover Overlay */}
                <div
                  style={{
                    position: 'relative',
                    width: 92,
                    height: 92,
                    borderRadius: '50%',
                    border: '3.5px solid #ffffff',
                    boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.3), 0 2px 6px rgba(0, 0, 0, 0.08)',
                    backgroundColor: '#2563eb',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #1d4ed8 100%)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to upload or change picture"
                >
                  {currentPhoto ? (
                    <img
                      src={currentPhoto}
                      alt={adminName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => {
                        setProfile((prev: any) => ({ ...prev, photo_url: '' }));
                      }}
                    />
                  ) : (
                    <div style={{ color: '#ffffff', fontWeight: 800, fontSize: 28, letterSpacing: '0.02em', userSelect: 'none' }}>
                      {adminInitials}
                    </div>
                  )}

                  {/* Camera overlay on hover */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(15, 23, 42, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s ease',
                      color: '#ffffff'
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
                  >
                    <Camera size={24} />
                  </div>
                </div>

                {/* Title & Info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 750, color: 'var(--text-color, #0f172a)' }}>
                      {adminName}
                    </h3>
                    <span className="badge active" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <ShieldCheck size={12} /> School Admin Only
                    </span>
                  </div>
                  <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                    Official administrator display picture and institutional profile badge. Only the School Admin has privileges to upload or modify this image.
                  </p>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      onChange={handlePhotoSelected}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photoUploading}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        padding: '7px 14px',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <Camera size={14} />
                      {photoUploading ? 'Uploading...' : (currentPhoto ? 'Change Picture' : 'Upload Picture')}
                    </button>

                    {currentPhoto && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={photoUploading}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 13,
                          padding: '7px 12px',
                          backgroundColor: '#fee2e2',
                          color: '#b91c1c',
                          border: '1px solid #fca5a5',
                          borderRadius: 8,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="Remove current picture"
                      >
                        <Trash2 size={13} />
                        Remove Picture
                      </button>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>
                      PNG, JPG, WebP up to 5MB
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {photoMsg && (
              <div
                className={photoMsg.type === 'success' ? 'success' : 'error'}
                style={{ marginTop: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {photoMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{photoMsg.text}</span>
              </div>
            )}
          </div>

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
              <form onSubmit={initiateSaveProfile} className="modal-form" style={{ gap: 14 }}>
                <label>
                  Enquiry / Emergency Contact Number
                  <input
                    type="tel"
                    placeholder="0343-2563500"
                    value={form.contact_number}
                    maxLength={12}
                    onKeyDown={e => {
                      // Allow navigation, control keys, and keyboard shortcuts (Ctrl/Cmd+A, C, V, X)
                      if (
                        ['Backspace', 'Tab', 'Enter', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
                        ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))
                      ) {
                        return;
                      }
                      // Block any key that is not a numeric digit
                      if (!/^[0-9]$/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onChange={e => {
                      const formatted = formatSchoolContactNumber(e.target.value);
                      setForm({ ...form, contact_number: formatted });
                      if (contactNumberError) setContactNumberError('');
                    }}
                    onBlur={() => {
                      if (form.contact_number) {
                        let digits = form.contact_number.replace(/\D/g, '');
                        if (digits.length === 10 && !digits.startsWith('0')) {
                          digits = '0' + digits;
                        }
                        if (digits.length > 4) {
                          setForm((prev: any) => ({ ...prev, contact_number: `${digits.slice(0, 4)}-${digits.slice(4, 11)}` }));
                        }
                      }
                    }}
                    style={contactNumberError ? { borderColor: '#ef4444' } : {}}
                  />
                  {contactNumberError && (
                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                      {contactNumberError}
                    </span>
                  )}
                  <span style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, display: 'block' }}>
                    Format: <code>0343-2563500</code> (11 digits: 4-digit code + 7 digits). 10-digit numbers automatically prefix 0.
                  </span>
                </label>
                <label>
                  Official School Website
                  <input
                    type="text"
                    placeholder="https://davmodeldurgapur.org"
                    value={form.website}
                    onChange={e => {
                      setForm({ ...form, website: e.target.value });
                      if (websiteError) setWebsiteError('');
                    }}
                    style={websiteError ? { borderColor: '#ef4444' } : {}}
                  />
                  {websiteError && (
                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                      {websiteError}
                    </span>
                  )}
                  <span style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, display: 'block' }}>
                    Must be a valid web link (e.g. <code>https://davmodeldurgapur.org</code> or <code>davmodeldurgapur.org</code>). Arbitrary plain words are not allowed.
                  </span>
                </label>
                <label>
                  Campus Physical Address
                  <AutoExpandingTextarea
                    minHeight={72}
                    maxHeight={360}
                    minLength={50}
                    maxLength={1000}
                    placeholder="Street, City, State, PIN (Word limit: 50 to 1000 words)"
                    value={form.address}
                    onChange={e => {
                      setForm({ ...form, address: e.target.value.slice(0, 1000) });
                      if (addressError) setAddressError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      border: '1px solid var(--border-strong, #cbd5e1)',
                      background: 'var(--bg, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      resize: 'none',
                      ...(addressError ? { borderColor: '#ef4444' } : {})
                    }}
                  />
                  {addressError && (
                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                      {addressError}
                    </span>
                  )}
                  <span style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, display: 'block' }}>
                    Word limit: 50 to 1000 words.
                  </span>
                </label>
                <button type="submit" disabled={saving} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                  Review & Update Profile
                </button>
              </form>
            </div>
          </div>

          {/* ── Email & Password Management Section ── */}
          <div className="panel" style={{ marginTop: 24 }} id="email-password-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={18} style={{ color: '#2563eb' }} />
                  Email &amp; Password
                </h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Official administrator credentials, affiliated school verification, and account security.
                </p>
              </div>
              <span className="badge active" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={14} /> BCrypt Protected
              </span>
            </div>

            {pwMsg && (
              <div className={pwMsg.type === 'success' ? 'success' : 'error'} style={{ marginBottom: 16 }}>
                {pwMsg.text}
              </div>
            )}

            <div className="two-col" style={{ gap: 20 }}>
              {/* Associated School Identity & Login Credentials */}
              <div style={{ background: 'var(--card-bg, #f8fafc)', padding: 20, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <School size={15} style={{ color: '#2563eb' }} />
                  Associated School Identity
                </h4>

                <div className="modal-form" style={{ gap: 14 }}>
                  <label>
                    Associated School Name
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={loading ? 'Loading school...' : (profile?.schoolName || profile?.name || user?.schoolName || '—')}
                      style={{
                        backgroundColor: 'var(--input-disabled-bg, #f1f5f9)',
                        color: 'var(--text-color, #0f172a)',
                        cursor: 'not-allowed',
                        fontWeight: 600
                      }}
                      id="admin-school-name"
                      title="Associated school name is automatically bound and cannot be edited manually"
                    />
                  </label>

                  <label>
                    Administrator Login Email
                    <input
                      type="email"
                      readOnly
                      disabled
                      value={user?.email || profile?.adminEmail || profile?.email || '—'}
                      style={{
                        backgroundColor: 'var(--input-disabled-bg, #f1f5f9)',
                        color: 'var(--text-color, #0f172a)',
                        cursor: 'not-allowed'
                      }}
                      id="admin-email-input"
                      title="Administrator login email"
                    />
                  </label>

                  <div className="list" style={{ marginTop: 6 }}>
                    <div className="list-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                      <b>Affiliated School Code</b>
                      <span><code>{profile?.code || (user as any)?.schoolCode || 'SCH'}</code></span>
                    </div>
                    <div className="list-row" style={{ padding: '8px 0' }}>
                      <b>Admin Profile Access</b>
                      <span><span className="badge active">Authorized School Admin</span></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password Form */}
              <div style={{ background: 'var(--card-bg, #f8fafc)', padding: 20, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <KeyRound size={15} style={{ color: '#2563eb' }} />
                  Change School Admin Password
                </h4>

                <form onSubmit={handlePasswordChange} className="modal-form" style={{ gap: 12 }}>
                  <label>
                    Current Password
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        required
                        placeholder="••••••••••••"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        style={{ width: '100%', paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowCurrentPw(s => !s)}
                        className="password-toggle-btn"
                        title={showCurrentPw ? "Hide password" : "Show password"}
                      >
                        {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <label>
                    New Password
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        required
                        placeholder="Enter new strong password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        style={{ width: '100%', paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowNewPw(s => !s)}
                        className="password-toggle-btn"
                        title={showNewPw ? "Hide password" : "Show password"}
                      >
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #64748B)', marginTop: 4, display: 'block' }}>
                      Must be at least 8 characters, with 1 Capital letter, 1 small letter, 1 number, and 1 special character.
                    </span>
                  </label>

                  <label>
                    Confirm New Password
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showConfirmPw ? 'text' : 'password'}
                        required
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        style={{ width: '100%', paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPw(s => !s)}
                        className="password-toggle-btn"
                        title={showConfirmPw ? "Hide password" : "Show password"}
                      >
                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={changingPw}
                    style={{ alignSelf: 'flex-start', marginTop: 6 }}
                  >
                    {changingPw ? 'Updating Password...' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Universal School Profile Preview Modal */}
      <UniversalPreviewModal
        isOpen={profilePreview.isOpen}
        onClose={() => setProfilePreview(prev => ({ ...prev, isOpen: false }))}
        onEdit={() => setProfilePreview(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeConfirmSaveProfile}
        title="Review Institutional Profile Updates"
        subtitle="Verify contact coordinates and physical address before updating"
        operationType="update"
        confirmText="Confirm & Save Profile"
        editText="Back to Edit"
        sections={profilePreview.sections}
        changes={profilePreview.changes}
        loading={profilePreview.loading}
        error={profilePreview.error}
      />
    </Layout>
  );
}

/* ────── Attendance Reports Route ────── */
function AttendanceReportsRoute() {
  const { user } = useAuth();
  if (user?.role === 'TEACHER') {
    return <Navigate to="/teacher/mentor-workspace?tab=REPORTS" replace />;
  }
  return <Layout><AttendanceReports /></Layout>;
}

/* ────── Super Admin Home ────── */
function SuperAdminHome() {
  return <SuperAdminModule />;
}

/* ────── Profile Redirect ────── */
function ProfileRedirect() {
  const { user } = useAuth();
  if (user?.role === 'STUDENT') return <Navigate to="/student/profile" replace />;
  if (user?.role === 'TEACHER') return <Layout><TeacherProfile /></Layout>;
  return <Navigate to="/school-profile" replace />;
}

/* ────── Route Fallback Loader ────── */
function RouteFallbackLoader() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      gap: 16
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid rgba(59, 130, 246, 0.18)',
        borderTopColor: '#2563eb',
        borderRadius: '50%',
        animation: 'spin 0.75s linear infinite'
      }} />
      <span style={{ fontSize: 13, color: 'var(--muted-text, #64748b)', fontWeight: 500, letterSpacing: '0.01em' }}>
        Loading module...
      </span>
    </div>
  );
}

/* ────── Routes ────── */
function App() {
  return (
    <Suspense fallback={<RouteFallbackLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<Navigate to="/" replace />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Guard><ProfileRedirect /></Guard>} />
        <Route path="/teacher/profile" element={<RoleGuard roles={['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><TeacherProfile /></Layout></RoleGuard>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
        <Route path="/students" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Students /></RoleGuard>} />
        <Route path="/teachers" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Teachers /></RoleGuard>} />
        <Route path="/designations" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><Designations /></Layout></RoleGuard>} />
        <Route path="/classes" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Classes /></RoleGuard>} />
        <Route path="/subjects" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Subjects /></RoleGuard>} />
        <Route path="/routine" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Routine /></RoleGuard>} />
        <Route path="/notifications" element={<RoleGuard roles={['SUPER_ADMIN']}><NotificationCenter /></RoleGuard>} />
        <Route path="/smtp-logs" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><SmtpLogs /></Layout></RoleGuard>} />
        <Route path="/take-attendance" element={<Guard><Attendance /></Guard>} />
        {/* <Route path="/teacher-history" element={<Guard><History /></Guard>} /> */}
        {/* <Route path="/attendance-history" element={<Guard><History /></Guard>} /> */}
        {/* <Route path="/history" element={<Guard><History /></Guard>} /> */}
        <Route path="/teacher-history" element={<Navigate to="/dashboard" replace />} />
        <Route path="/attendance-history" element={<Navigate to="/dashboard" replace />} />
        <Route path="/history" element={<Navigate to="/dashboard" replace />} />
        <Route path="/attendance-reports" element={<RoleGuard roles={['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']}><AttendanceReportsRoute /></RoleGuard>} />
        <Route path="/attendance-corrections" element={<RoleGuard roles={['SCHOOL_ADMIN', 'TEACHER']}><Layout><AttendanceCorrections /></Layout></RoleGuard>} />
        <Route path="/people" element={<Navigate to="/students" replace />} />
        <Route path="/academic-years" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><AcademicYears /></Layout></RoleGuard>} />
        <Route path="/calendar" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><AcademicYears defaultTab="calculator" /></Layout></RoleGuard>} />
        <Route path="/working-calendar" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><AcademicYears defaultTab="working-days" /></Layout></RoleGuard>} />
        <Route path="/holidays" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><AcademicYears defaultTab="holidays" /></Layout></RoleGuard>} />
        <Route path="/settings" element={<RoleGuard roles={['SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><AcademicYears defaultTab="working-days" /></Layout></RoleGuard>} />
        <Route path="/promotion" element={<RoleGuard roles={['SCHOOL_ADMIN']}><Layout><StudentPromotion /></Layout></RoleGuard>} />
        <Route path="/permissions" element={<RoleGuard roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']}><Layout><Permissions /></Layout></RoleGuard>} />
        <Route path="/subscription-enforcement" element={<RoleGuard roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']}><Layout><SubscriptionEnforcement /></Layout></RoleGuard>} />
        <Route path="/security" element={<RoleGuard roles={['SUPER_ADMIN']}><Layout><Security /></Layout></RoleGuard>} />
        <Route path="/backups" element={<RoleGuard roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']}><Layout><Backup /></Layout></RoleGuard>} />
        <Route path="/timetable" element={<RoleGuard roles={['SCHOOL_ADMIN', 'TEACHER']}><Layout><Timetable /></Layout></RoleGuard>} />
        <Route path="/announcements" element={<RoleGuard roles={['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><TeacherAnnouncements /></Layout></RoleGuard>} />
        <Route path="/teacher-announcements" element={<Navigate to="/announcements" replace />} />
        <Route path="/teacher/announcements" element={<Navigate to="/announcements" replace />} />
        <Route path="/offline-attendance" element={<RoleGuard roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']}><Layout><OfflineAttendance /></Layout></RoleGuard>} />
        <Route path="/analytics" element={<RoleGuard roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']}><Layout><Analytics /></Layout></RoleGuard>} />
        <Route path="/leave-applications" element={<RoleGuard roles={['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><LeaveApprove /></Layout></RoleGuard>} />
        <Route path="/photo-approvals" element={<RoleGuard roles={['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']}><Layout><PhotoApprove /></Layout></RoleGuard>} />
        <Route path="/leave-policy" element={<RoleGuard roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']}><Layout><LeavePolicy /></Layout></RoleGuard>} />
        <Route path="/admin/temporary-assignments" element={<RoleGuard roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']}><Navigate to="/classes?tab=temporary" replace /></RoleGuard>} />
        <Route path="/temporary-assignments" element={<Navigate to="/classes?tab=temporary" replace />} />
        <Route path="/leave-policies" element={<Navigate to="/leave-policy" replace />} />
        <Route path="/teacher-leave-approvals" element={<RoleGuard roles={['SUPER_ADMIN', 'SCHOOL_ADMIN']}><Layout><TeacherLeaveApprove /></Layout></RoleGuard>} />
        <Route path="/teacher/leave-request" element={<RoleGuard roles={['TEACHER']}><Layout><TeacherLeaveRequest /></Layout></RoleGuard>} />
        <Route path="/teacher/mentor-workspace" element={<RoleGuard roles={['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><ClassMentorWorkspace /></Layout></RoleGuard>} />
        <Route path="/teacher/mentor" element={<Navigate to="/teacher/mentor-workspace" replace />} />
        <Route path="/teacher/assignments" element={<RoleGuard roles={['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']}><Layout><TeacherAssignments /></Layout></RoleGuard>} />
        <Route path="/teacher-leave-request" element={<Navigate to="/teacher/leave-request" replace />} />
        <Route path="/teacher/leave" element={<Navigate to="/teacher/leave-request" replace />} />
        <Route path="/teacher/leaves" element={<Navigate to="/teacher/leave-request" replace />} />
        <Route path="/review/photos" element={<Navigate to="/photo-approvals" replace />} />
        <Route path="/review/teacher-leaves" element={<Navigate to="/teacher-leave-approvals" replace />} />
        <Route path="/review/leaves" element={<Navigate to="/leave-applications" replace />} />
        <Route path="/reviews/leaves" element={<Navigate to="/leave-applications" replace />} />
        <Route path="/review-photos" element={<Navigate to="/photo-approvals" replace />} />
        <Route path="/review-leaves" element={<Navigate to="/leave-applications" replace />} />
        <Route path="/review-teacher-leaves" element={<Navigate to="/teacher-leave-approvals" replace />} />
        <Route path="/review" element={<Navigate to="/leave-applications" replace />} />
        <Route path="/reviews" element={<Navigate to="/leave-applications" replace />} />
        <Route path="/teacher/review" element={<Navigate to="/leave-applications" replace />} />
        <Route path="/teacher/reviews" element={<Navigate to="/leave-applications" replace />} />
        <Route path="/teacher/leave-review" element={<Navigate to="/leave-applications" replace />} />
        <Route path="/communication" element={<RoleGuard roles={['SCHOOL_ADMIN']}><Layout><Communication /></Layout></RoleGuard>} />
        <Route path="/parent-communication" element={<RoleGuard roles={['PARENT']}><Layout><ParentCommunication /></Layout></RoleGuard>} />
        <Route path="/parent-portal" element={<RoleGuard roles={['PARENT']}><Layout><ParentPortal /></Layout></RoleGuard>} />
        <Route path="/super-admin/*" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminModule /></RoleGuard>} />
        <Route path="/super-admin" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminModule /></RoleGuard>} />
        <Route path="/reports" element={<RoleGuard roles={['SUPER_ADMIN']}><Navigate to="/super-admin/reports" replace /></RoleGuard>} />
        <Route path="/payments" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminModule /></RoleGuard>} />
        <Route path="/invoices" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminModule /></RoleGuard>} />
        <Route path="/school-profile" element={<RoleGuard roles={['SCHOOL_ADMIN']}><SchoolProfile /></RoleGuard>} />
        <Route path="/monitor" element={<RoleGuard roles={['SUPER_ADMIN']}><SuperAdminModule /></RoleGuard>} />
        <Route path="/subscription" element={<Navigate to="/dashboard" replace />} />
        {/* Student Portal Routes */}
        <Route path="/student/dashboard" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentDashboard /></StudentLayout></RoleGuard>} />
        <Route path="/student/attendance" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentAttendance /></StudentLayout></RoleGuard>} />
        <Route path="/student/timetable" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentTimetable /></StudentLayout></RoleGuard>} />
        <Route path="/student/homework" element={<Navigate to="/student/assignments" replace />} />
        <Route path="/student/assignments" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentAssignments /></StudentLayout></RoleGuard>} />
        <Route path="/student/exams" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentExams /></StudentLayout></RoleGuard>} />
        <Route path="/student/announcements" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentAnnouncements /></StudentLayout></RoleGuard>} />
        <Route path="/student/leave-request" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentLeaveRequest /></StudentLayout></RoleGuard>} />
        <Route path="/student/profile" element={<RoleGuard roles={['STUDENT']}><StudentLayout><StudentProfile /></StudentLayout></RoleGuard>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;