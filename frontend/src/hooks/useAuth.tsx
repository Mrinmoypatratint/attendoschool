import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

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
  avatarUrl?: string;
};

type AuthContextType = {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
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
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function Guard({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!isAuthenticated) nav('/login', { replace: true });
  }, [isAuthenticated, nav]);
  return isAuthenticated ? <>{children}</> : null;
}

export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!user || !roles.includes(user.role)) nav('/dashboard', { replace: true });
  }, [user, roles, nav]);
  return user && roles.includes(user.role) ? <>{children}</> : null;
}
