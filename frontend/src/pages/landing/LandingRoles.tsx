import React, { useState } from 'react';
import {
  School,
  GraduationCap,
  UserRound,
  Check,
  ShieldCheck,
  Lock,
  Calendar,
  Users
} from 'lucide-react';

interface RoleData {
  id: string;
  tabLabel: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accentColor: string;
  bgSoft: string;
  capabilities: string[];
  photo?: string;
  sampleUi: {
    badge: string;
    kpi1Label: string;
    kpi1Value: string;
    kpi2Label: string;
    kpi2Value: string;
    note: string;
  };
}

const ROLES: RoleData[] = [
  {
    id: 'school-admin',
    tabLabel: 'School Office Admin',
    icon: <School size={16} />,
    title: 'School Office Admin',
    subtitle: 'The daily operational control center for admissions, class sections, and staff allocations.',
    accentColor: '#2563EB',
    bgSoft: 'rgba(37, 99, 235, 0.12)',
    capabilities: [
      'Student admissions, roll numbers, and Section A/B/C allocations',
      'Faculty designation hierarchy, subject allotting, and periods routine',
      'Leave approval workflows with teacher proxy substitution',
      'CBSE Form 14 registers, monthly percentages, and board reports'
    ],
    photo: '/school_office_admin.jpg',
    sampleUi: {
      badge: 'SCHOOL OPERATIONS DESK',
      kpi1Label: 'ACTIVE STUDENTS',
      kpi1Value: '1,284 Enrolled',
      kpi2Label: 'SECTIONS RUNNING',
      kpi2Value: '36 Classrooms',
      note: 'Academic Session 2026–2027 · Term 1 Prescribed Schedule'
    }
  },
  {
    id: 'teacher',
    tabLabel: 'Classroom Teacher',
    icon: <GraduationCap size={16} />,
    title: 'Classroom Teacher',
    subtitle: 'Fast morning roll call, period timetable schedule, and class mentorship.',
    accentColor: '#F59E0B',
    bgSoft: 'rgba(245, 158, 11, 0.12)',
    capabilities: [
      '30-second mobile attendance roll call for 40 students per period',
      'Class mentor overview for tracking chronic absenteeism',
      'Daily period timetable routines and room allocations',
      'Digital leave request submissions and teacher profile records'
    ],
    photo: '/teacher_dav.jpg',
    sampleUi: {
      badge: 'TEACHER WORKSPACE · PERIOD 2',
      kpi1Label: 'CLASS 10-A ROSTER',
      kpi1Value: '38 Present / 2 Absent',
      kpi2Label: 'ROLL CALL STATUS',
      kpi2Value: 'Saved & Synced',
      note: 'Mentor Class: 10-A · Dr. M. R** (PGT Physics)'
    }
  },
  {
    id: 'student-parent',
    tabLabel: 'Student & Parent',
    icon: <UserRound size={16} />,
    title: 'Student & Parent',
    subtitle: 'Real-time arrival SMS notifications, attendance percentage history, and class notices.',
    accentColor: '#059669',
    bgSoft: 'rgba(5, 150, 105, 0.12)',
    capabilities: [
      'Instant SMS alert the minute your child taps their smart card at the gate',
      'Verified daily attendance percentage to monitor board exam eligibility',
      'Weekly period routine, class schedule, and room numbers',
      'Direct school circulars, exam dates, and urgent weather advisories'
    ],
    photo: '/students_hero.jpg',
    sampleUi: {
      badge: 'STUDENT & PARENT PORTAL',
      kpi1Label: 'ANNUAL ATTENDANCE',
      kpi1Value: '98.4%',
      kpi2Label: 'BOARD ELIGIBILITY',
      kpi2Value: 'Eligible (CBSE)',
      note: 'Student: Aa**av Sh**ma (Roll 10*, Class 10-A) · PII Masked (**)'
    }
  }
];

export const LandingRoles: React.FC = () => {
  const [activeRoleId, setActiveRoleId] = useState<string>('school-admin');
  const currentRole = ROLES.find(r => r.id === activeRoleId) || ROLES[0];

  return (
    <section className="c360-section c360-roles-section" id="roles">
      <div className="c360-container">
        {/* Section Header (Campus360 exact style) */}
        <div style={{ maxWidth: 640, marginBottom: 40, textAlign: 'left' }}>
          <span className="c360-section-tag" style={{ color: 'var(--color-secondary)' }}>
            Built for Every Stakeholder
          </span>
          <h2 className="c360-section-title">Campus roles. One access hierarchy.</h2>
          <p className="c360-section-desc" style={{ marginBottom: 32 }}>
            Every role operates within dedicated permissions, isolated session boundaries, and tailored tools. Select a role below to explore their dashboard view.
          </p>
        </div>

        {/* Role Tab Pills (Campus360 exact style) */}
        <div className="c360-role-tabs" role="tablist" aria-label="AttendoSchool Roles">
          {ROLES.map(role => {
            const isActive = role.id === activeRoleId;
            return (
              <button
                key={role.id}
                type="button"
                className={`c360-role-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveRoleId(role.id)}
                role="tab"
                aria-selected={isActive}
              >
                <span>{role.icon}</span>
                <span>{role.tabLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Role Panel Card */}
        <div className="c360-role-panel">
          <div className="c360-role-panel-grid">
            {/* Left: Info and Capability Checklist */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: currentRole.bgSoft,
                    color: currentRole.accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {currentRole.id === 'school-admin' && <School size={26} />}
                  {currentRole.id === 'teacher' && <GraduationCap size={26} />}
                  {currentRole.id === 'student-parent' && <UserRound size={26} />}
                </div>
                <div>
                  <h3 className="c360-role-title" style={{ margin: 0 }}>
                    {currentRole.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                    {currentRole.subtitle}
                  </p>
                </div>
              </div>

              <ul className="c360-role-checklist">
                {currentRole.capabilities.map((cap, i) => (
                  <li key={i} className="c360-role-check-item">
                    <span className="c360-role-check-icon" style={{ background: currentRole.bgSoft, color: currentRole.accentColor }}>
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Authentic Workflow Photo & Sample Data View (Confidential **) */}
            <div>
              {currentRole.photo && (
                <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: 180, marginBottom: 16, border: '1px solid var(--color-border-default)' }}>
                  <img
                    src={currentRole.photo}
                    alt={currentRole.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              )}

              <div style={{ background: 'var(--color-marketing-bg)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid var(--color-border-default)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>
                  {currentRole.sampleUi.badge}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border-muted)' }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>{currentRole.sampleUi.kpi1Label}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: currentRole.accentColor, marginTop: 2 }}>{currentRole.sampleUi.kpi1Value}</div>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border-muted)' }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>{currentRole.sampleUi.kpi2Label}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>{currentRole.sampleUi.kpi2Value}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', background: '#FFFFFF', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border-muted)', marginBottom: 12 }}>
                  {currentRole.sampleUi.note}
                </div>

                {/* Role-Specific Telemetry Visualizations */}
                {currentRole.id === 'super-admin' && (
                  <div className="c360-donut-widget">
                    <div className="c360-donut-svg-wrap">
                      <svg viewBox="0 0 36 36" className="c360-donut-svg">
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#E2E8F0" strokeWidth="3.2" />
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#059669" strokeWidth="3.2" strokeDasharray="96.4 3.6" strokeDashoffset="0" />
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F59E0B" strokeWidth="3.2" strokeDasharray="2.4 97.6" strokeDashoffset="-96.4" />
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#EF4444" strokeWidth="3.2" strokeDasharray="1.2 98.8" strokeDashoffset="-98.8" />
                      </svg>
                      <div className="c360-donut-center-text">
                        <span>96.4%</span>
                        <span className="c360-donut-center-sub">Live</span>
                      </div>
                    </div>
                    <div className="c360-donut-legend">
                      <div className="c360-legend-item">
                        <span><span className="c360-legend-dot" style={{ background: '#059669' }} />Present</span>
                        <strong style={{ color: '#059669' }}>96.4%</strong>
                      </div>
                      <div className="c360-legend-item">
                        <span><span className="c360-legend-dot" style={{ background: '#F59E0B' }} />Sanctioned Leave</span>
                        <strong>2.4%</strong>
                      </div>
                      <div className="c360-legend-item">
                        <span><span className="c360-legend-dot" style={{ background: '#EF4444' }} />Unexcused</span>
                        <strong style={{ color: '#DC2626' }}>1.2%</strong>
                      </div>
                    </div>
                  </div>
                )}

                {currentRole.id === 'school-admin' && (
                  <div style={{ background: '#FFFFFF', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--color-border-muted)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Wing-Wise Enrollment Capacity
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Primary Wing (Class 1–5)</span>
                        <strong style={{ color: '#047857' }}>97.8% (420/430)</strong>
                      </div>
                      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden' }}>
                        <div style={{ width: '97.8%', height: '100%', background: '#059669', borderRadius: 9999 }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span>Middle Wing (Class 6–8)</span>
                        <strong style={{ color: '#0284C7' }}>96.2% (385/400)</strong>
                      </div>
                      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden' }}>
                        <div style={{ width: '96.2%', height: '100%', background: '#0284C7', borderRadius: 9999 }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span>Senior Secondary (Class 9–12)</span>
                        <strong style={{ color: '#2563EB' }}>95.4% (479/502)</strong>
                      </div>
                      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden' }}>
                        <div style={{ width: '95.4%', height: '100%', background: '#2563EB', borderRadius: 9999 }} />
                      </div>
                    </div>
                  </div>
                )}

                {currentRole.id === 'teacher' && (
                  <div style={{ background: '#FFFFFF', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--color-border-muted)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                      <span>Today's Class 10-A Schedule</span>
                      <span style={{ color: '#059669' }}>● 3 / 4 Marked</span>
                    </div>
                    <div className="c360-timetable-visual">
                      <div className="c360-timetable-cell">
                        <div className="c360-period-num">Period 01</div>
                        <div className="c360-period-subject">Mathematics</div>
                        <div className="c360-period-stat">✓ 97.5% Marked</div>
                      </div>
                      <div className="c360-timetable-cell">
                        <div className="c360-period-num">Period 02</div>
                        <div className="c360-period-subject">English Lit</div>
                        <div className="c360-period-stat">✓ 95.0% Marked</div>
                      </div>
                      <div className="c360-timetable-cell">
                        <div className="c360-period-num">Period 03</div>
                        <div className="c360-period-subject">Physics Lab</div>
                        <div className="c360-period-stat">✓ 100% Marked</div>
                      </div>
                    </div>
                  </div>
                )}

                {currentRole.id === 'student-parent' && (
                  <div style={{ background: '#FFFFFF', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--color-border-muted)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Monthly Attendance Heatmap (October)
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#047857' }}>
                        22 / 23 Days (95.6%)
                      </span>
                    </div>
                    <div className="c360-heatmap-row">
                      {Array.from({ length: 24 }).map((_, idx) => (
                        <div
                          key={idx}
                          className={`c360-heatmap-dot ${idx === 7 || idx === 14 || idx === 21 ? 'holiday' : idx === 18 ? 'leave' : 'highlight'}`}
                          title={`Day ${idx + 1}`}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--color-text-muted)', marginTop: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10B981' }} /> Present (21)
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FDE68A' }} /> Sanctioned (1)
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#E2E8F0' }} /> Weekend/Holiday (3)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
