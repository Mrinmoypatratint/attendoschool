import React from 'react';
import {
  Database,
  Wifi,
  Users,
  Smartphone,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2
} from 'lucide-react';

export const LandingFlow: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Campus Onboarding & Tenant Provisioning',
      desc: 'Our implementation team sets up your school as its own dedicated cloud tenant. Academic terms, campus details, and administrator credentials are configured securely.',
      badgeIcon: <Database size={14} />,
      badgeText: 'Dedicated Database Isolation · AES-256 Encrypted'
    },
    {
      num: '02',
      title: 'Gate RFID Hardware Deployment',
      desc: 'High-speed plug-and-play RFID scanners are connected at school entry turnstiles. Smart student and faculty identity cards are synchronized with cloud records.',
      badgeIcon: <Wifi size={14} />,
      badgeText: '13.56 MHz NFC & UHF RFID · Sub-second Gate Sync'
    },
    {
      num: '03',
      title: 'Student SIS Rosters & Class Allocations',
      desc: 'Import existing student data, roll numbers, and class sections. Assign class teachers, faculty period routines, and mentor oversight in minutes.',
      badgeIcon: <Users size={14} />,
      badgeText: 'Instant SIS Import · 36 Classrooms Mapped'
    },
    {
      num: '04',
      title: 'Morning Roll Call & Instant Parent SMS',
      desc: 'Students tap in at gate readers; teachers verify period attendance in 30 seconds from their mobile phones. Parents receive instant SMS delivery on their registered phones.',
      badgeIcon: <Smartphone size={14} />,
      badgeText: '1.8s DLT SMS Delivery · Real-Time Parent Peace of Mind'
    },
    {
      num: '05',
      title: 'One-Click CBSE & Board Reports',
      desc: 'Generate official Form 14 registers, monthly student attendance percentages, and staff duty logs ready for board inspection in Excel and PDF.',
      badgeIcon: <FileSpreadsheet size={14} />,
      badgeText: 'CBSE Form 14 Compliant · Automated Percentage Ledger'
    }
  ];

  return (
    <section className="c360-section" id="flow" style={{ background: '#FFFFFF', borderTop: '1px solid var(--color-border-muted)' }}>
      <div className="c360-container">
        {/* Section Header (Campus360 exact style) */}
        <div style={{ maxWidth: 640, marginBottom: 48, textAlign: 'left' }}>
          <span className="c360-section-tag" style={{ color: '#059669' }}>
            From Onboarding to Operations
          </span>
          <h2 className="c360-section-title">How a school goes live on AttendoSchool.</h2>
          <p className="c360-section-desc">
            A structured, reliable rollout that takes your school from paper registers to automated gate check-ins without disrupting daily academic routines.
          </p>
        </div>

        {/* 2-Column Content: Timeline Left, Campus Showcase Right */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48, alignItems: 'flex-start' }}>
          {/* 5-Step Timeline List with Connecting Line */}
          <div className="c360-flow-list">
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              return (
                <div key={step.num} className="c360-flow-step">
                  <div className="c360-flow-left-col">
                    <div className="c360-flow-num">{step.num}</div>
                    {!isLast && <div className="c360-flow-line" />}
                  </div>
                  <div className="c360-flow-content">
                    <h3 className="c360-flow-step-title">{step.title}</h3>
                    <p className="c360-flow-step-desc">{step.desc}</p>
                    <div className="c360-step-visual-card">
                      {step.badgeIcon}
                      <span>{step.badgeText}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Campus Photo & Deployment Metrics Card */}
          <div style={{ position: 'sticky', top: 100 }}>
            <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border-default)', boxShadow: 'var(--shadow-card)', background: '#FFFFFF' }}>
              <div style={{ position: 'relative', height: 260 }}>
                <img
                  src="/school_campus_hero.jpg"
                  alt="Modern school campus infrastructure and entrance"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', color: '#FFFFFF', padding: '4px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={13} style={{ color: '#38BDF8' }} />
                  <span>Campus Infrastructure</span>
                </div>
              </div>

              <div style={{ padding: 24, textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)', marginBottom: 6 }}>
                  Deployment Benchmark
                </div>
                <h4 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 16px 0', lineHeight: 1.3 }}>
                  Zero-Disruption Campus Go-Live
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: 'var(--color-marketing-bg-alt)', padding: 12, borderRadius: 10, border: '1px solid var(--color-border-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 12, fontWeight: 700 }}>
                      <Clock size={14} />
                      <span>48 Hours</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Average Full Setup</div>
                  </div>

                  <div style={{ background: 'var(--color-marketing-bg-alt)', padding: 12, borderRadius: 10, border: '1px solid var(--color-border-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontSize: 12, fontWeight: 700 }}>
                      <CheckCircle2 size={14} />
                      <span>Zero Downtime</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Daily Classes Intact</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#047857', background: '#ECFDF5', padding: '8px 12px', borderRadius: 8, border: '1px solid #A7F3D0' }}>
                  <ShieldCheck size={16} />
                  <span>Includes hardware installation, faculty training & board audit checks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
