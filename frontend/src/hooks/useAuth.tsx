import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccessCheck, AccessRestricted } from '../rbac/accessGate';
import { AUTH_EXPIRED_EVENT } from '../api';

export type Role = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

export type User = {
  id: string;
  schoolId: string | null;
  name: string;
  email: string;
  role: Role;
  studentId?: string;
  classId?: string;
  sectionId?: string;
  className?: string;
  sectionName?: string;
  rollNumber?: string;
  schoolName?: string;
  schoolCode?: string;
  avatarUrl?: string;
  photo_url?: string;
  photoUrl?: string;
  schoolPhotoUrl?: string;
  school_photo_url?: string;
  schoolWebsite?: string;
  school_website?: string;
};

type AuthContextType = {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (fields: Partial<User>) => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('attendance_user') || 'null');
    } catch {
      return null;
    }
  });

  const login = useCallback((token: string, userData: User) => {
    localStorage.setItem('attendance_token', token);
    localStorage.setItem('attendance_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('attendance_token');
    localStorage.removeItem('attendance_user');
    try {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('attendo_welcome_seen_') || key.startsWith('cached_student_dashboard')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {}
    setUser(null);
  }, []);


  const updateUser = useCallback((fields: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...fields };
      localStorage.setItem('attendance_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

type AccessProps = { permission?: string; feature?: string };

export function Guard({ children, permission, feature }: { children: ReactNode } & AccessProps) {
  const { isAuthenticated } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const check = useAccessCheck();
  useEffect(() => {
    if (!isAuthenticated) nav('/login', { replace: true });
  }, [isAuthenticated, nav]);
  if (!isAuthenticated) return null;
  // RBAC (UX only): explicit permission/feature, else derived from the path. Renders a page, never redirects.
  const verdict = check({ permission, feature, path: location.pathname });
  return verdict.allowed ? <>{children}</> : <AccessRestricted verdict={verdict} />;
}

export function RoleGuard({ roles, children, permission, feature }: { roles: Role[]; children: ReactNode } & AccessProps) {
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const check = useAccessCheck();
  useEffect(() => {
    if (!user || !roles.includes(user.role)) nav('/dashboard', { replace: true });
  }, [user, roles, nav]);
  if (!user || !roles.includes(user.role)) return null;
  const verdict = check({ permission, feature, path: location.pathname });
  return verdict.allowed ? <>{children}</> : <AccessRestricted verdict={verdict} />;
}
