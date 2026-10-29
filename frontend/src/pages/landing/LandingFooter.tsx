import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  Mail,
  ShieldCheck,
  Lock,
  X,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

interface LandingFooterProps {
  onScrollTo: (sectionId: string) => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onScrollTo }) => {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | null>(null);

  const handleNav = (id: string) => {
    onScrollTo(id);
  };

  return (
    <footer className="c360-footer">
      <div className="c360-container">
        {/* Brand Top (AttendoSchool Only, No DAV Logo in footer) */}
        <div className="c360-footer-top">
          <div className="c360-brand-link" onClick={() => handleNav('top')} role="button" tabIndex={0}>
            <img
              src="/attendo-logo-transparent.png"
              alt="AttendoSchool"
              className="c360-brand-logo"
            />
            <span className="c360-brand-name">
              Attendo<span className="accent">School</span>
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-secondary)', maxWidth: 460 }}>
            Attendance Today — Brighter Tomorrow. The unified operating system for smart school attendance, timetable management, and cloud school administration.
          </p>
        </div>

        {/* 4-Column Navigation Grid (Campus360 exact layout) */}
        <nav aria-label="Footer Navigation" className="c360-footer-nav-grid">
          {/* Col 1: Features */}
          <div>
            <div className="c360-footer-col-title">Features</div>
            <ul className="c360-footer-col-links">
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('capabilities')}>
                  Gate RFID Attendance
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('capabilities')}>
                  30-Second Mobile Roll Call
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('capabilities')}>
                  Student SIS Records
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('capabilities')}>
                  CBSE Form 14 Registers
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('capabilities')}>
                  Parent Arrival SMS Alerts
                </button>
              </li>
            </ul>
          </div>

          {/* Col 2: Company & Compliance */}
          <div>
            <div className="c360-footer-col-title">Company</div>
            <ul className="c360-footer-col-links">
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('top')}>
                  About AttendoSchool
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('demo')}>
                  Pricing &amp; Hardware
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('demo')}>
                  Contact Campus Team
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => setActiveModal('privacy')}>
                  Data Privacy &amp; Masking (**)
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => setActiveModal('terms')}>
                  Institutional Terms
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Platform & Portals */}
          <div>
            <div className="c360-footer-col-title">Platform</div>
            <ul className="c360-footer-col-links">
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('capabilities')}>
                  Capabilities
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('roles')}>
                  Role Access
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('flow')}>
                  How It Works
                </button>
              </li>
              <li>
                <button type="button" className="c360-footer-link" onClick={() => handleNav('trust')}>
                  Trust &amp; Engineering
                </button>
              </li>
              <li>
                {/* GREEN LOGIN LINK */}
                <button
                  type="button"
                  className="c360-footer-link"
                  onClick={() => navigate('/login')}
                  style={{ color: '#059669', fontWeight: 700 }}
                >
                  Portal Login →
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Talk to us (Matching Campus360) */}
          <div>
            <div className="c360-footer-col-title">Talk to us</div>
            <ul className="c360-footer-col-links">
              <li>
                <button
                  type="button"
                  className="c360-footer-link"
                  onClick={() => handleNav('demo')}
                  style={{ color: 'var(--color-primary)', fontWeight: 700 }}
                >
                  Book a demo
                </button>
              </li>
              <li>
                <a href="tel:+911126168800" className="c360-footer-link">
                  +91 11 2616 8800
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/919876543210?text=Hello%20AttendoSchool%20team,%20we%20are%20interested%20in%20smart%20RFID%20attendance%20for%20our%20school."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="c360-footer-link"
                >
                  WhatsApp Support
                </a>
              </li>
              <li>
                <a href="mailto:support@attendoschool.online" className="c360-footer-link">
                  support@attendoschool.online
                </a>
              </li>
            </ul>
          </div>
        </nav>

        {/* Footer Bottom */}
        <div className="c360-footer-bottom">
          <span>© 2026 AttendoSchool. All rights reserved.</span>
          <div style={{ display: 'flex', gap: 20 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={14} style={{ color: '#059669' }} />
              <span>CBSE Compliant Format</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Lock size={14} style={{ color: '#059669' }} />
              <span>Student PII Masked (**)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {activeModal === 'privacy' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 600,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: 32,
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)'
              }}
            >
              <X size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: '#059669' }}>
              <Lock size={22} />
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Student Privacy &amp; PII Confidentiality Policy
              </h3>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              AttendoSchool is designed in compliance with the Digital Personal Data Protection (DPDP) Act and international child data protection principles.
            </p>
            <ul style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--color-text-secondary)', paddingLeft: 20, marginBottom: 20 }}>
              <li><strong>Public Demonstration Masking:</strong> All student names, guardian contact numbers, roll numbers, and RFID UID tags in demonstration dashboards are systematically masked with asterisks (e.g. <code>Aa**av Sh**ma</code>, <code>+91 98310 *****</code>) to prevent unauthorized disclosure.</li>
              <li><strong>Database-Level Isolation:</strong> Each school branch functions inside an isolated tenant database partition with Postgres Row-Level Security.</li>
              <li><strong>Role-Scoped Permissions:</strong> Faculty members have strictly scoped visibility to their assigned periods and classes.</li>
            </ul>
            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                className="c360-btn-primary"
                onClick={() => setActiveModal(null)}
              >
                Close Privacy Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {activeModal === 'terms' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 600,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: 32,
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)'
              }}
            >
              <X size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: 'var(--color-primary)' }}>
              <ShieldCheck size={22} />
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Institutional Service Terms
              </h3>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              AttendoSchool provides software-as-a-service (SaaS) and smart gate reader integrations for recognized schools and academic institutions.
            </p>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              Hardware units installed at school campus turnstiles operate over encrypted WebSocket and TLS connections with continuous heartbeat telemetry.
            </p>
            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                className="c360-btn-primary"
                onClick={() => setActiveModal(null)}
              >
                Close Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
