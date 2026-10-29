import React, { useState } from 'react';
import {
  Layers,
  Radar,
  Wifi,
  CalendarCheck2,
  FileCheck2,
  MessagesSquare,
  Lock,
  CheckCircle2,
  Bell,
  HeartHandshake,
  ArrowRight
} from 'lucide-react';

export const LandingCapabilities: React.FC = () => {
  return (
    <section className="c360-section" id="capabilities">
      <div className="c360-container">
        {/* Section Header (Campus360 exact styling) */}
        <div style={{ maxWidth: 640, marginBottom: 48, textAlign: 'left' }}>
          <span className="c360-section-tag">The Connected School</span>
          <h2 className="c360-section-title">Six capability domains. One system of record.</h2>
          <p className="c360-section-desc">
            AttendoSchool unifies gate check-in, classroom roll call, academic scheduling, and parent communication on one real-time cloud backbone.
          </p>
        </div>

        {/* Bento Grid (Matching Campus360 layout) */}
        <div className="c360-bento-grid">
          {/* Card 1: 2x2 Big Card — One Real-Time Source of Truth */}
          <div className="c360-bento-card c360-bento-col2-row2">
            <div>
              <div className="c360-bento-top">
                <div className="c360-bento-icon" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                  <Layers size={22} />
                </div>
                <span className="c360-bento-pill" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                  Shared &amp; Live
                </span>
              </div>

              <h3 className="c360-bento-title" style={{ fontSize: 22 }}>
                One real-time source of truth
              </h3>
              <p className="c360-bento-desc" style={{ maxWidth: 480, marginBottom: 18 }}>
                Attendance recorded at the entrance turnstile, a classroom roll call marked 30 seconds ago, an absence confirmed — every role sees the same live numbers instead of yesterday's paper register exports.
              </p>
            </div>

            {/* Visual: Live Attendance Roster Preview with Masked Data (**) */}
            <div style={{ background: 'var(--color-marketing-bg)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', border: '1px solid var(--color-border-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11.5, color: '#047857', fontWeight: 700 }}>
                <span>CLASS 10-A · MORNING GATE SCAN STREAM</span>
                <span>38 / 40 Present (95.0%)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)', fontSize: 11 }}>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>Aa**av Sh**ma</div>
                  <div style={{ color: '#047857', fontWeight: 600 }}>08:14 AM · Present</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)', fontSize: 11 }}>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>Pr**ha Pa**el</div>
                  <div style={{ color: '#047857', fontWeight: 600 }}>08:16 AM · Present</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)', fontSize: 11 }}>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>Ro**n Ve**a</div>
                  <div style={{ color: '#B45309', fontWeight: 600 }}>08:29 AM · Late</div>
                </div>
                <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)', fontSize: 11 }}>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>An**ya Gu**a</div>
                  <div style={{ color: '#B91C1C', fontWeight: 600 }}>Absent · SMS Sent</div>
                </div>
              </div>

              {/* Grade-wise Attendance Comparison Horizontal Bars */}
              <div className="c360-grade-list">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live Campus Grade Breakdown
                </div>
                <div className="c360-grade-row">
                  <span className="c360-grade-lbl">Class 12</span>
                  <div className="c360-grade-bar-track"><div className="c360-grade-bar-fill" style={{ width: '98.2%' }} /></div>
                  <span className="c360-grade-pct">98.2%</span>
                </div>
                <div className="c360-grade-row">
                  <span className="c360-grade-lbl">Class 10</span>
                  <div className="c360-grade-bar-track"><div className="c360-grade-bar-fill" style={{ width: '97.5%' }} /></div>
                  <span className="c360-grade-pct">97.5%</span>
                </div>
                <div className="c360-grade-row">
                  <span className="c360-grade-lbl">Class 8</span>
                  <div className="c360-grade-bar-track"><div className="c360-grade-bar-fill" style={{ width: '96.8%' }} /></div>
                  <span className="c360-grade-pct">96.8%</span>
                </div>
                <div className="c360-grade-row">
                  <span className="c360-grade-lbl">Class 9</span>
                  <div className="c360-grade-bar-track"><div className="c360-grade-bar-fill" style={{ width: '94.2%', background: 'linear-gradient(90deg, #F59E0B, #D97706)' }} /></div>
                  <span className="c360-grade-pct" style={{ color: '#D97706' }}>94.2%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: 2x1 Span — Early Warning & Chronic Absenteeism Detection */}
          <div className="c360-bento-card c360-bento-col2">
            <div>
              <div className="c360-bento-top">
                <div className="c360-bento-icon" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>
                  <Radar size={22} />
                </div>
                <span className="c360-bento-pill" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>
                  Early Warning
                </span>
              </div>

              <h3 className="c360-bento-title">Chronic absenteeism detection</h3>
              <p className="c360-bento-desc">
                Automated threshold alerts flag slipping student attendance before it threatens board exam eligibility — reviewed and actioned by the Class Teacher and Principal.
              </p>
            </div>

            {/* 14-Day Trajectory Graph with CBSE 75% Statutory Line */}
            <div className="c360-risk-chart-box">
              <div className="c360-risk-threshold-label">
                <span>Student: Ro**n Ve**a (Class 10-A) · 14-Day Trajectory</span>
                <span style={{ color: '#DC2626', fontWeight: 800 }}>71.4% (Below 75%)</span>
              </div>
              <svg viewBox="0 0 340 50" className="c360-sparkline-svg">
                {/* 75% Threshold Line */}
                <line x1="0" y1="26" x2="340" y2="26" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="4 3" />
                <text x="338" y="22" fill="#EF4444" fontSize="9" fontWeight="700" textAnchor="end">75% CBSE Board Floor</text>
                {/* Declining Student Line */}
                <path d="M 0 10 Q 50 12 100 16 T 200 24 T 270 34 T 340 40" fill="none" stroke="#DC2626" strokeWidth="2.5" />
                <circle cx="340" cy="40" r="4" fill="#DC2626" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#92400E', marginTop: 4 }}>
                <span>Day 01: 88.0%</span>
                <span>Day 07: 81.2%</span>
                <span style={{ color: '#DC2626', fontWeight: 700 }}>Today: 71.4% (Auto-Notice Sent to Parent)</span>
              </div>
            </div>
          </div>

          {/* Card 3: 1x2 Row Span — Zero-touch RFID Gate Attendance (With Real Photo & Telemetry) */}
          <div className="c360-bento-card c360-bento-row2">
            <div>
              <div className="c360-bento-top">
                <div className="c360-bento-icon" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                  <Wifi size={22} />
                </div>
                <span className="c360-bento-pill" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                  Smart RFID
                </span>
              </div>

              {/* Real RFID Gate Tap Photo with Telemetry Overlay */}
              <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-default)', margin: '10px 0', height: 160 }}>
                <img
                  src="/rfid_gate_tap.jpg"
                  alt="Student tapping RFID card at school entrance gate turnstile"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '4px 8px', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700 }}>
                  <span style={{ color: '#34D399' }}>● 1,238 / 1,284 Taps</span>
                  <span>Latency: 380ms</span>
                </div>
              </div>

              <h3 className="c360-bento-title">Zero-touch gate check-in</h3>
              <p className="c360-bento-desc">
                High-speed RFID readers at campus gates log student arrival in under 1 second, instantly notifying parents via SMS.
              </p>
            </div>
          </div>

          {/* Card 4: 1x1 — 30-Second Mobile Roll Call with 1-Tap Toggle Preview */}
          <div className="c360-bento-card">
            <div>
              <div className="c360-bento-top">
                <div className="c360-bento-icon" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                  <CalendarCheck2 size={22} />
                </div>
                <span className="c360-bento-pill" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                  No Paper
                </span>
              </div>
              <h3 className="c360-bento-title">30-second mobile roll call</h3>
              <p className="c360-bento-desc">
                One tap from any faculty smartphone or tablet marks full classroom attendance without paper registers.
              </p>
            </div>

            {/* 1-Tap Classroom Roster Chip Grid */}
            <div className="c360-roster-chips-grid">
              <div className="c360-roster-chip">
                <span>Aa**av S.</span>
                <span className="c360-status-badge p">P</span>
              </div>
              <div className="c360-roster-chip">
                <span>Di**ya S.</span>
                <span className="c360-status-badge p">P</span>
              </div>
              <div className="c360-roster-chip">
                <span>Ka**an V.</span>
                <span className="c360-status-badge l">L</span>
              </div>
              <div className="c360-roster-chip">
                <span>Ro**n V.</span>
                <span className="c360-status-badge a">A</span>
              </div>
            </div>
          </div>

          {/* Card 5: 1x1 — CBSE Form 14 Registers with Official Table Preview */}
          <div className="c360-bento-card">
            <div>
              <div className="c360-bento-top">
                <div className="c360-bento-icon" style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#059669' }}>
                  <FileCheck2 size={22} />
                </div>
                <span className="c360-bento-pill" style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#059669' }}>
                  Board Ready
                </span>
              </div>
              <h3 className="c360-bento-title">CBSE Form 14 registers</h3>
              <p className="c360-bento-desc">
                Official attendance percentages, student registers, and board-compliant exports generated in 1 click.
              </p>
            </div>

            {/* CBSE Form 14 Sample Table Preview */}
            <div className="c360-table-box">
              <div className="c360-table-row header">
                <span>Roll · Student</span>
                <span>Days · %</span>
                <span>Status</span>
              </div>
              <div className="c360-table-row">
                <span style={{ fontWeight: 600 }}>101 · Aa**av</span>
                <span>212 / 218</span>
                <span style={{ color: '#047857', fontWeight: 800 }}>97.2%</span>
              </div>
              <div className="c360-table-row">
                <span style={{ fontWeight: 600 }}>102 · Pr**ha</span>
                <span>208 / 218</span>
                <span style={{ color: '#047857', fontWeight: 800 }}>95.4%</span>
              </div>
            </div>
          </div>

          {/* Card 6: 1x1 — Verified Parent SMS Alerts with DLT Speed Badge */}
          <div className="c360-bento-card">
            <div>
              <div className="c360-bento-top">
                <div className="c360-bento-icon" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB' }}>
                  <MessagesSquare size={22} />
                </div>
                <span className="c360-bento-pill" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB' }}>
                  One Channel
                </span>
              </div>
              <h3 className="c360-bento-title">Parent SMS notifications</h3>
              <p className="c360-bento-desc">
                Direct carrier SMS alerts to parent mobile phones immediately when their child enters the campus.
              </p>
            </div>

            <div style={{ background: 'rgba(37, 99, 235, 0.06)', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(37, 99, 235, 0.18)', fontSize: 11, marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1D4ED8', marginBottom: 2 }}>
                <span>DLT National Gateway</span>
                <span>1.8s avg</span>
              </div>
              <div style={{ color: '#475569', fontSize: 10.5 }}>
                Jio · Airtel · Vi · BSNL Enterprise Route
              </div>
            </div>
          </div>
        </div>

        {/* Happy Parents Spotlight (Preserving user's requirement with authentic photo) */}
        <div style={{ marginTop: 40, borderRadius: 'var(--radius-2xl)', background: '#FFFFFF', border: '1px solid var(--color-border-default)', padding: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, alignItems: 'center', textAlign: 'left' }}>
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: 260, border: '1px solid var(--color-border-default)' }}>
            <img
              src="/happy_parents.jpg"
              alt="Happy Indian parents receiving student attendance SMS update"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', marginBottom: 10 }}>
              <HeartHandshake size={16} />
              <span>Parent Peace of Mind</span>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 12px 0', lineHeight: 1.3 }}>
              "The instant my phone buzzes at 8:15 AM, I know my child is safe at school."
            </h3>
            <p style={{ fontSize: 14.5, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              Parents no longer have to worry about morning transit delays or unconfirmed arrivals. When students tap their RFID card at the school gate, an automated SMS confirmation is dispatched immediately to the registered guardian's mobile number.
            </p>
            <div style={{ background: 'var(--color-marketing-bg)', padding: '12px 14px', borderRadius: 8, borderLeft: '3px solid #059669', fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                "Dear Parent, your ward Aa**av Sh**ma (Roll 10*, Class 10-A) checked in safely at 08:14 AM. — AttendoSchool"
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Delivered via National SMS Gateway · Confidential data masked (**)
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
