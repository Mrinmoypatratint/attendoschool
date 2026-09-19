import React from 'react';
import {
  Building2, School, GraduationCap, BookOpen,
  CheckCircle2, AlertCircle, ShieldCheck, Activity,
  Users, BarChart3, Clock, Sparkles, Zap, QrCode,
  Flame, Calendar, Award, ChevronRight, MessageSquare
} from 'lucide-react';

export type LoginOption = 'ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT';

interface LoginDynamicPreviewProps {
  activeRole: LoginOption;
  onSelectRole: (role: LoginOption) => void;
}

export const LoginDynamicPreview: React.FC<LoginDynamicPreviewProps> = ({
  activeRole,
  onSelectRole
}) => {
  return (
    <div className="as-preview-showcase-container">
      {/* Top Brand & Badge */}
      <div className="as-preview-header">
        <div className="as-preview-brand">
          <div className="as-preview-logo-wrap">
            <img src="/attendo-school-logo.png" alt="AttendoSchool" className="as-preview-logo" />
          </div>
          <div>
            <div className="as-preview-brand-title">
              AttendoSchool <span className="as-preview-badge-live">v0.11</span>
            </div>
            <div className="as-preview-brand-sub">Next-Gen Education Operating System</div>
          </div>
        </div>

        <div className="as-preview-telemetry-pill">
          <span className="as-preview-pulse-dot" />
          <span>Live SIS Sync Active</span>
        </div>
      </div>

      {/* Interactive Role Switcher Tabs */}
      <div className="as-preview-role-tabs">
        {[
          { id: 'ADMIN' as LoginOption, label: 'Super Admin', icon: Building2 },
          { id: 'SCHOOL_ADMIN' as LoginOption, label: 'Principal', icon: School },
          { id: 'TEACHER' as LoginOption, label: 'Faculty', icon: GraduationCap },
          { id: 'STUDENT' as LoginOption, label: 'Student', icon: BookOpen },
        ].map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeRole === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`as-preview-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectRole(tab.id)}
            >
              <TabIcon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Dynamic Stage Display based on activeRole */}
      <div className="as-preview-stage-wrapper">
        {activeRole === 'ADMIN' && (
          <div className="as-preview-card admin-theme animate-fade-in">
            <div className="as-card-top-bar">
              <div className="as-portal-badge admin">
                <Building2 size={13} />
                <span>Platform Control Center</span>
              </div>
              <span className="as-card-chip success">99.98% SLA</span>
            </div>

            <h3 className="as-card-title">Super Administrator Global Command</h3>
            <p className="as-card-sub">
              Cross-campus intelligence, licensing tiers, and real-time database telemetry.
            </p>

            {/* Metric counters */}
            <div className="as-stage-kpi-grid">
              <div className="as-stage-kpi">
                <span className="as-stage-kpi-num">524</span>
                <span className="as-stage-kpi-lbl">Active Campuses</span>
              </div>
              <div className="as-stage-kpi">
                <span className="as-stage-kpi-num">182.4K</span>
                <span className="as-stage-kpi-lbl">Enrolled Students</span>
              </div>
              <div className="as-stage-kpi">
                <span className="as-stage-kpi-num">99.4%</span>
                <span className="as-stage-kpi-lbl">Biometric Uptime</span>
              </div>
            </div>

            {/* Weekly Attendance Trend Visualization */}
            <div className="as-mini-chart-box">
              <div className="as-mini-chart-header">
                <span>National Attendance Pulse</span>
                <span className="as-mini-chart-stat">+3.2% vs last week</span>
              </div>
              <div className="as-bars-row">
                {[
                  { day: 'Mon', val: 96 },
                  { day: 'Tue', val: 98 },
                  { day: 'Wed', val: 95 },
                  { day: 'Thu', val: 99 },
                  { day: 'Fri', val: 97 },
                ].map(bar => (
                  <div key={bar.day} className="as-bar-col">
                    <div className="as-bar-track">
                      <div className="as-bar-fill" style={{ height: `${bar.val}%` }} />
                    </div>
                    <span className="as-bar-label">{bar.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Database Sync Footer */}
            <div className="as-card-footer-nodes">
              <div className="as-node-item">
                <span className="as-dot-green" />
                <span>Primary: Cloud Firestore</span>
              </div>
              <div className="as-node-item">
                <span className="as-dot-blue" />
                <span>Relational: PostgreSQL Dual-Standby</span>
              </div>
            </div>
          </div>
        )}

        {activeRole === 'SCHOOL_ADMIN' && (
          <div className="as-preview-card school-theme animate-fade-in">
            <div className="as-card-top-bar">
              <div className="as-portal-badge school">
                <School size={13} />
                <span>Greenwood International (GIS001)</span>
              </div>
              <span className="as-card-chip verified">CBSE Affiliated</span>
            </div>

            <h3 className="as-card-title">School Executive & Operations Hub</h3>
            <p className="as-card-sub">
              Live campus roll-call, staff deployment, and automated parent communication.
            </p>

            {/* Attendance Progress Ring Mockup */}
            <div className="as-rollcall-meter-card">
              <div className="as-meter-circle">
                <span className="as-meter-num">96.4%</span>
                <span className="as-meter-sub">Present Today</span>
              </div>
              <div className="as-meter-breakdown">
                <div className="as-breakdown-row">
                  <span className="as-bd-dot green" />
                  <span>Present Students:</span>
                  <strong>2,362</strong>
                </div>
                <div className="as-breakdown-row">
                  <span className="as-bd-dot red" />
                  <span>Unexcused Absences:</span>
                  <strong>88</strong>
                </div>
                <div className="as-breakdown-row">
                  <span className="as-bd-dot blue" />
                  <span>Faculty On Duty:</span>
                  <strong>118 / 120</strong>
                </div>
              </div>
            </div>

            {/* Quick Action Simulation */}
            <div className="as-action-alert-box">
              <div className="as-action-alert-left">
                <MessageSquare size={16} className="as-icon-alert" />
                <div>
                  <strong>Parent Notification Center</strong>
                  <span>88 WhatsApp / SMS alerts dispatched at 09:15 AM</span>
                </div>
              </div>
              <span className="as-badge-pill success">Delivered</span>
            </div>
          </div>
        )}

        {activeRole === 'TEACHER' && (
          <div className="as-preview-card teacher-theme animate-fade-in">
            <div className="as-card-top-bar">
              <div className="as-portal-badge teacher">
                <GraduationCap size={13} />
                <span>Class 10-A · Mathematics</span>
              </div>
              <span className="as-card-chip period">Period 3 (Ongoing)</span>
            </div>

            <h3 className="as-card-title">Smart Faculty Roll-Call Console</h3>
            <p className="as-card-sub">
              1-tap bulk attendance, live biometric sync, and instant absent follow-ups.
            </p>

            {/* Student Roster Simulator */}
            <div className="as-roster-simulator">
              <div className="as-roster-row">
                <div className="as-roster-student">
                  <div className="as-student-avatar">AS</div>
                  <div>
                    <strong className="as-student-name">Aarav Sharma</strong>
                    <span className="as-student-id">Roll 01 · CBSE 2025</span>
                  </div>
                </div>
                <span className="as-status-badge present">
                  <CheckCircle2 size={12} /> Biometric Present
                </span>
              </div>

              <div className="as-roster-row">
                <div className="as-roster-student">
                  <div className="as-student-avatar purple">AS</div>
                  <div>
                    <strong className="as-student-name">Ananya Sen</strong>
                    <span className="as-student-id">Roll 02 · CBSE 2025</span>
                  </div>
                </div>
                <span className="as-status-badge present">
                  <QrCode size={12} /> Mobile QR Verified
                </span>
              </div>

              <div className="as-roster-row">
                <div className="as-roster-student">
                  <div className="as-student-avatar amber">DR</div>
                  <div>
                    <strong className="as-student-name">Devansh Roy</strong>
                    <span className="as-student-id">Roll 03 · CBSE 2025</span>
                  </div>
                </div>
                <span className="as-status-badge absent">
                  <AlertCircle size={12} /> Absent (SMS Sent)
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="as-teacher-action-bar">
              <div className="as-action-chip">
                <Zap size={13} />
                <span>1-Tap Mark All</span>
              </div>
              <div className="as-action-chip">
                <QrCode size={13} />
                <span>Class QR Code</span>
              </div>
              <div className="as-action-chip">
                <Clock size={13} />
                <span>Submit Register</span>
              </div>
            </div>
          </div>
        )}

        {activeRole === 'STUDENT' && (
          <div className="as-preview-card student-theme animate-fade-in">
            <div className="as-card-top-bar">
              <div className="as-portal-badge student">
                <BookOpen size={13} />
                <span>Rohan Sharma (Roll 25)</span>
              </div>
              <span className="as-card-chip streak">🔥 24 Day Streak</span>
            </div>

            <h3 className="as-card-title">Student Learning & Routine Hub</h3>
            <p className="as-card-sub">
              Personalized attendance tracking, today's lecture schedule, and grade reports.
            </p>

            {/* Attendance Streak Banner */}
            <div className="as-student-streak-card">
              <div className="as-streak-icon-box">
                <Flame size={24} />
              </div>
              <div className="as-streak-info">
                <div className="as-streak-title">Outstanding Attendance Streak</div>
                <div className="as-streak-stats">
                  <strong>96.8% Overall</strong> · 0 Unexcused Leaves · Scholar Badge
                </div>
              </div>
            </div>

            {/* Today's Schedule Card */}
            <div className="as-student-routine-list">
              <div className="as-routine-item completed">
                <span className="as-routine-time">09:00 AM</span>
                <div className="as-routine-details">
                  <strong>Advanced Mathematics</strong>
                  <span>Period 1 · Prof. Sen (Attended)</span>
                </div>
                <CheckCircle2 size={15} className="as-routine-check" />
              </div>

              <div className="as-routine-item active">
                <span className="as-routine-time">10:30 AM</span>
                <div className="as-routine-details">
                  <strong>Physics Laboratory</strong>
                  <span>Period 2 · Room 302 · In Progress</span>
                </div>
                <span className="as-pulse-badge">Live</span>
              </div>

              <div className="as-routine-item upcoming">
                <span className="as-routine-time">01:15 PM</span>
                <div className="as-routine-details">
                  <strong>Computer Science</strong>
                  <span>Period 4 · Lab B</span>
                </div>
                <ChevronRight size={15} style={{ color: '#94a3b8' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Micro Highlights */}
      <div className="as-preview-micro-highlights">
        <div className="as-micro-pill">
          <Sparkles size={13} style={{ color: '#f59e0b' }} />
          <span>Realtime Biometric & QR Mobile Roll-Call</span>
        </div>
        <div className="as-micro-pill">
          <ShieldCheck size={13} style={{ color: '#10b981' }} />
          <span>Zero Data Loss (Firestore + PostgreSQL)</span>
        </div>
      </div>
    </div>
  );
};
