import React from 'react';
import {
  Shield,
  School,
  GraduationCap,
  UserCheck,
  CheckCircle2,
  Lock,
  Calendar,
  Clock,
  ArrowRight
} from 'lucide-react';

export type RoleKey = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT';

export interface RoleData {
  key: RoleKey;
  label: string;
  badge: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  capabilities: string[];
  photo?: string;
}

export const ROLES: RoleData[] = [
  {
    key: 'SUPER_ADMIN',
    label: 'Trust & Admin',
    badge: 'Central Administration',
    icon: <Shield size={18} />,
    title: 'Multi-Campus & Trust Leadership',
    description:
      'Designed for school trusts, educational societies, and central administrators overseeing multiple branches. Manage branch configurations, administrative permissions, and centralized student enrollment metrics.',
    capabilities: [
      'Manage multiple school campuses under one organization',
      'Role-based permissions for campus administrators',
      'Centralized student and staff enrollment totals',
      'System-wide notification and audit logs'
    ]
  },
  {
    key: 'SCHOOL_ADMIN',
    label: 'School Admin',
    badge: 'Campus Office',
    icon: <School size={18} />,
    title: 'Daily Campus Administration',
    description:
      'The central workspace for the principal and school administrative office. Manage student admissions, section allocations, faculty designations, timetable schedules, and official board attendance registers.',
    capabilities: [
      'Academic session calendar and term holidays',
      'Student admissions, roll numbers, and class sections',
      'Teacher subject allotments and class routines',
      'Staff leave approvals and official board registers'
    ]
  },
  {
    key: 'TEACHER',
    label: 'Teacher',
    badge: 'Classroom Teacher',
    icon: <GraduationCap size={18} />,
    title: 'Fast Roll Call & Classroom Tools',
    description:
      'Built for daily classroom speed. Mark 40 students present in under 30 seconds from your smartphone or tablet, view your daily teaching schedule, and track attendance trends.',
    capabilities: [
      '30-second mobile attendance roll call',
      'Class mentor overview for assigned students',
      'Daily period timetable and room allocations',
      'Digital leave applications and approvals'
    ],
    photo: '/teacher_dav.jpg'
  },
  {
    key: 'STUDENT',
    label: 'Student & Parent',
    badge: 'Students & Parents',
    icon: <UserCheck size={18} />,
    title: 'Attendance History & Daily Routines',
    description:
      'Provides students and parents a direct, transparent view into daily attendance percentages, upcoming timetable routines, and official school notices.',
    capabilities: [
      'Verified daily attendance percentage',
      'Daily period timetable and subject schedule',
      'Homework assignments and submission details',
      'Official school circulars and exam schedules'
    ],
    photo: '/students_hero.jpg'
  }
];

interface RolePortalScreensProps {
  activeRole: RoleKey;
  onSelectRole: (role: RoleKey) => void;
}

export const RolePortalScreens: React.FC<RolePortalScreensProps> = ({ activeRole, onSelectRole }) => {
  const currentRole = ROLES.find(r => r.key === activeRole) || ROLES[1];

  return (
    <div>
      {/* 4 Accessible Role Tabs */}
      <div className="lp-role-tab-bar">
        {ROLES.map(role => {
          const isActive = role.key === activeRole;
          return (
            <button
              key={role.key}
              type="button"
              onClick={() => onSelectRole(role.key)}
              className={`lp-role-tab-btn ${isActive ? 'active' : ''}`}
            >
              <span>{role.icon}</span>
              <span>{role.label}</span>
            </button>
          );
        })}
      </div>

      {/* Clean Flat Role Panel */}
      <div className="lp-role-panel-clean">
        {/* Info Column */}
        <div className="lp-role-panel-info">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--lp-brand-green)', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            {currentRole.icon}
            <span>{currentRole.badge}</span>
          </div>

          <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--lp-text-primary)', margin: '0 0 10px 0', lineHeight: 1.3 }}>
            {currentRole.title}
          </h3>

          <p style={{ fontSize: 14.5, color: 'var(--lp-text-secondary)', lineHeight: 1.6, margin: '0 0 18px 0' }}>
            {currentRole.description}
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentRole.capabilities.map((cap, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--lp-text-secondary)', fontWeight: 500 }}>
                <CheckCircle2 size={16} style={{ color: 'var(--lp-brand-green)', flexShrink: 0 }} />
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Visual / Screenshot Column */}
        <div className="lp-role-panel-visual">
          {currentRole.photo && (
            <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 14, border: '1px solid var(--lp-border-subtle)', maxHeight: 200 }}>
              <img
                src={currentRole.photo}
                alt={currentRole.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}

          {/* Role UI Preview */}
          {activeRole === 'SUPER_ADMIN' && (
            <div style={{ background: 'var(--lp-bg-warm)', padding: 14, borderRadius: 8, border: '1px solid var(--lp-border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                INSTITUTIONS CLUSTER OVERVIEW
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#FFFFFF', borderRadius: 6, marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>D.A.V. Public School (Sector 14)</div>
                  <div style={{ fontSize: 11, color: 'var(--lp-text-muted)' }}>1,284 Students · 82 Faculty · Tenant ID: #DAV-**01</div>
                </div>
                <span style={{ fontSize: 11, color: '#047857', fontWeight: 600 }}>Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#FFFFFF', borderRadius: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>D.A.V. Centenary Public School</div>
                  <div style={{ fontSize: 11, color: 'var(--lp-text-muted)' }}>960 Students · 64 Faculty · Tenant ID: #DAV-**02</div>
                </div>
                <span style={{ fontSize: 11, color: '#047857', fontWeight: 600 }}>Active</span>
              </div>
            </div>
          )}

          {activeRole === 'SCHOOL_ADMIN' && (
            <div style={{ background: 'var(--lp-bg-warm)', padding: 14, borderRadius: 8, border: '1px solid var(--lp-border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                CAMPUS OPERATIONS · D.A.V. PUBLIC SCHOOL
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
                <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--lp-text-muted)', fontWeight: 600 }}>TODAY'S ATTENDANCE</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lp-brand-green)' }}>96.8%</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--lp-text-muted)', fontWeight: 600 }}>FACULTY ACTIVE</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)' }}>78 / 82</div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--lp-text-secondary)', background: '#FFFFFF', padding: '6px 10px', borderRadius: 6 }}>
                Academic Session: <strong>2026–2027</strong> · Active School Routine
              </div>
            </div>
          )}

          {activeRole === 'TEACHER' && (
            <div style={{ background: 'var(--lp-bg-warm)', padding: 14, borderRadius: 8, border: '1px solid var(--lp-border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                TEACHER WORKSPACE · PERIOD 2
              </div>
              <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 6, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--lp-text-muted)' }}>Class 10-A · Physics Lab</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lp-text-primary)', marginTop: 2 }}>
                  38 Students Present · Roll Call Complete
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 11, background: '#ECFDF5', color: '#047857', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
                  ✓ Attendance Saved
                </span>
                <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
                  Class Mentor Active
                </span>
              </div>
            </div>
          )}

          {activeRole === 'STUDENT' && (
            <div style={{ background: 'var(--lp-bg-warm)', padding: 14, borderRadius: 8, border: '1px solid var(--lp-border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                STUDENT & PARENT PORTAL · ROLL 10*
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--lp-text-muted)', fontWeight: 600 }}>ATTENDANCE RATE</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lp-brand-green)' }}>98.4%</div>
                  <div style={{ fontSize: 10.5, color: '#047857', fontWeight: 600 }}>Exam Eligible</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--lp-text-muted)', fontWeight: 600 }}>HOMEWORK TASKS</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lp-brand-blue)' }}>2 Active</div>
                  <div style={{ fontSize: 10.5, color: 'var(--lp-text-muted)' }}>Due Tomorrow</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
