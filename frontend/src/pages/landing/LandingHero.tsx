import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  UserCheck,
  CalendarCheck2,
  Users,
  Bell,
  Lock,
  Radar,
  CheckCircle2,
  Clock,
  Activity,
  BarChart3,
  TrendingUp
} from 'lucide-react';

interface LandingHeroProps {
  onScrollTo: (sectionId: string) => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onScrollTo }) => {
  const navigate = useNavigate();

  return (
    <section className="c360-hero-section" id="top">
      {/* Campus360 Ambient Radial Glows */}
      <div className="c360-hero-glow-1" aria-hidden="true" />
      <div className="c360-hero-glow-2" aria-hidden="true" />

      <div className="c360-container">
        <div className="c360-hero-grid">
          {/* Left Column: Natural Copywriting & Action Row */}
          <div>
            <span className="c360-hero-badge">
              Smart School Attendance & Academic ERP
            </span>

            <h1 className="c360-hero-title">
              The unified operating system for a{' '}
              <span className="gradient-text">modern school</span>.
            </h1>

            <p className="c360-hero-subtitle">
              AttendoSchool replaces paper registers, chaotic morning gate roll calls, scattered spreadsheets, and fragmented WhatsApp groups with one real-time, role-scoped, board-compliant system of record.
            </p>

            {/* CTAs with GREEN LOGIN BUTTON */}
            <div className="c360-hero-cta-row">
              <button
                type="button"
                className="c360-btn-primary c360-hero-btn-lg"
                onClick={() => onScrollTo('demo')}
                id="hero-book-demo-btn"
              >
                <span>Request a Demo</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="c360-btn-login-green c360-hero-btn-lg"
                onClick={() => navigate('/login')}
                id="hero-login-btn"
              >
                <UserCheck size={17} />
                <span>Portal Login</span>
              </button>

              <button
                type="button"
                className="c360-hero-explore-link"
                onClick={() => onScrollTo('capabilities')}
              >
                <span>Explore the platform</span>
                <ArrowUpRight size={16} />
              </button>
            </div>

            {/* 4-Stat Metric Row (Matching Campus360) */}
            <div className="c360-stats-row">
              <div className="c360-stat-item">
                <div className="num">04</div>
                <div className="lbl">Role-based portals</div>
              </div>
              <div className="c360-stat-item">
                <div className="num">06</div>
                <div className="lbl">Capability domains</div>
              </div>
              <div className="c360-stat-item">
                <div className="num">RFID</div>
                <div className="lbl">Instant Gate Sync</div>
              </div>
              <div className="c360-stat-item">
                <div className="num">DPDP</div>
                <div className="lbl">Confidential Masking (**)</div>
              </div>
            </div>
          </div>

          {/* Right Column: Campus360 Interactive Sample View Card */}
          <div>
            <div className="c360-sample-card">
              {/* Window Header */}
              <div className="c360-card-header">
                <div className="c360-dots-wrap">
                  <span className="c360-dot red" />
                  <span className="c360-dot yellow" />
                  <span className="c360-dot green" />
                </div>
                <span className="c360-card-header-tag">Sample Live View · Gate 01</span>
              </div>

              {/* 2-Column Metrics */}
              <div className="c360-metric-pair">
                <div className="c360-metric-box">
                  <div className="c360-metric-icon-wrap" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                    <CalendarCheck2 size={16} />
                  </div>
                  <div className="c360-metric-label">Today's attendance</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>96.4%</span>
                    <span style={{ fontSize: 11, color: '#047857', fontWeight: 600 }}>Active</span>
                  </div>
                  <div className="c360-metric-bar-bg">
                    <div className="c360-metric-bar-fill" style={{ width: '96.4%', background: 'var(--color-primary)' }} />
                  </div>
                </div>

                <div className="c360-metric-box">
                  <div className="c360-metric-icon-wrap" style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#059669' }}>
                    <Users size={16} />
                  </div>
                  <div className="c360-metric-label">Enrolled students</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>1,284</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Verified</span>
                  </div>
                  <div className="c360-metric-bar-bg">
                    <div className="c360-metric-bar-fill" style={{ width: '92%', background: '#059669' }} />
                  </div>
                </div>
              </div>

              {/* Weekly Attendance 5-Day Mini Bar Chart */}
              <div className="c360-chart-box">
                <div className="c360-chart-header">
                  <div className="c360-chart-title">
                    <BarChart3 size={13} style={{ color: '#059669' }} />
                    <span>Weekly Campus Attendance Rate</span>
                  </div>
                  <span className="c360-chart-badge" style={{ background: '#ECFDF5', color: '#047857' }}>
                    Avg: 96.2%
                  </span>
                </div>
                <div className="c360-weekly-bars">
                  <div className="c360-bar-col">
                    <span className="c360-bar-val">95.8%</span>
                    <div className="c360-bar-track"><div className="c360-bar-fill" style={{ height: '88%' }} /></div>
                    <span className="c360-bar-day">Mon</span>
                  </div>
                  <div className="c360-bar-col">
                    <span className="c360-bar-val">97.1%</span>
                    <div className="c360-bar-track"><div className="c360-bar-fill" style={{ height: '94%' }} /></div>
                    <span className="c360-bar-day">Tue</span>
                  </div>
                  <div className="c360-bar-col">
                    <span className="c360-bar-val">96.3%</span>
                    <div className="c360-bar-track"><div className="c360-bar-fill" style={{ height: '90%' }} /></div>
                    <span className="c360-bar-day">Wed</span>
                  </div>
                  <div className="c360-bar-col">
                    <span className="c360-bar-val" style={{ color: '#059669', fontWeight: 800 }}>96.4%</span>
                    <div className="c360-bar-track"><div className="c360-bar-fill active" style={{ height: '92%' }} /></div>
                    <span className="c360-bar-day" style={{ color: '#059669', fontWeight: 800 }}>Thu · Live</span>
                  </div>
                  <div className="c360-bar-col">
                    <span className="c360-bar-val">95.5%</span>
                    <div className="c360-bar-track"><div className="c360-bar-fill" style={{ height: '86%' }} /></div>
                    <span className="c360-bar-day">Fri</span>
                  </div>
                </div>
              </div>

              {/* Real-Time Check-In Stream with Masked Data (**) */}
              <div className="c360-feed-box">
                <div className="c360-feed-header">
                  <span>Recent Gate Turnstile Scans</span>
                  <span style={{ fontSize: 10.5, color: 'var(--color-primary)', fontWeight: 600 }}>Live Feed</span>
                </div>

                <div className="c360-feed-item">
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                      Aa**av Sh**ma
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Roll 10* · Class 10-A · Card #RF-88**
                    </div>
                  </div>
                  <span style={{ color: '#047857', background: '#ECFDF5', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                    ✓ 08:14 AM
                  </span>
                </div>

                <div className="c360-feed-item">
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                      Pr**ha Pa**el
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Roll 10* · Class 10-A · Card #RF-89**
                    </div>
                  </div>
                  <span style={{ color: '#047857', background: '#ECFDF5', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                    ✓ 08:16 AM
                  </span>
                </div>
              </div>

              {/* Morning Gate Velocity Area Chart */}
              <div className="c360-chart-box" style={{ marginTop: 0, marginBottom: 12 }}>
                <div className="c360-chart-header">
                  <div className="c360-chart-title">
                    <Activity size={13} style={{ color: 'var(--color-primary)' }} />
                    <span>Morning Turnstile Velocity</span>
                  </div>
                  <span className="c360-chart-badge">Peak: 142 scans/min</span>
                </div>
                <svg viewBox="0 0 320 46" className="c360-sparkline-svg">
                  <defs>
                    <linearGradient id="gateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284C7" stopOpacity="0.30" />
                      <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="36" x2="320" y2="36" stroke="rgba(15,23,42,0.06)" strokeDasharray="3 3" />
                  <path d="M 0 42 Q 40 40 80 34 T 160 8 T 240 24 T 320 38 L 320 46 L 0 46 Z" fill="url(#gateGrad)" />
                  <path d="M 0 42 Q 40 40 80 34 T 160 8 T 240 24 T 320 38" fill="none" stroke="#0284C7" strokeWidth="2.5" />
                  <circle cx="160" cy="8" r="4" fill="#0284C7" stroke="#FFFFFF" strokeWidth="2" />
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  <span>07:30 AM</span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>08:00 AM (Morning Bell)</span>
                  <span>08:30 AM</span>
                </div>
              </div>

              {/* Risk Detection / Callout Strip */}
              <div className="c360-callout-strip">
                <div className="c360-callout-icon">
                  <Radar size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>
                    Parent SMS Dispatcher Active
                  </div>
                  <div style={{ fontSize: 11, color: '#047857' }}>
                    Verified carrier delivery · Sub-second latency
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
