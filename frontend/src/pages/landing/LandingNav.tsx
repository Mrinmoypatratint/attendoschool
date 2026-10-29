import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MoreHorizontal,
  UserCheck,
  ArrowRight,
  Menu,
  X,
  Wifi,
  Calendar,
  MessageSquare,
  HelpCircle,
  FileCheck2,
  ShieldCheck
} from 'lucide-react';

interface LandingNavProps {
  onScrollTo: (sectionId: string) => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({ onScrollTo }) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dotMenuOpen, setDotMenuOpen] = useState(false);
  const dotMenuRef = useRef<HTMLDivElement>(null);

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dotMenuRef.current && !dotMenuRef.current.contains(e.target as Node)) {
        setDotMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (sectionId: string) => {
    onScrollTo(sectionId);
    setMobileMenuOpen(false);
    setDotMenuOpen(false);
  };

  const handleLoginClick = () => {
    navigate('/login');
    setMobileMenuOpen(false);
  };

  return (
    <header className="c360-nav-wrapper">
      <div className="c360-container c360-nav-content">
        {/* Brand Left: AttendoSchool Logo ONLY (No DAV logo in header) */}
        <div className="c360-brand-link" onClick={() => handleNavClick('top')} role="button" tabIndex={0}>
          <img
            src="/attendo-logo-transparent.png"
            alt="AttendoSchool"
            className="c360-brand-logo"
          />
          <span className="c360-brand-name">
            Attendo<span className="accent">School</span>
          </span>
        </div>

        {/* Center Navigation Links (Matching Campus360 layout) */}
        <nav className="c360-nav-links" aria-label="Main Navigation">
          <button type="button" className="c360-nav-link" onClick={() => handleNavClick('capabilities')}>
            Capabilities
          </button>
          <button type="button" className="c360-nav-link" onClick={() => handleNavClick('roles')}>
            Roles
          </button>
          <button type="button" className="c360-nav-link" onClick={() => handleNavClick('flow')}>
            How It Works
          </button>
          <button type="button" className="c360-nav-link" onClick={() => handleNavClick('trust')}>
            Trust
          </button>
        </nav>

        {/* Right Actions: 3-Dot Menu, Green Login Button & Demo CTA */}
        <div className="c360-nav-actions" ref={dotMenuRef}>
          {/* 3-DOT QUICK ACTION BUTTON & DROPDOWN */}
          <button
            type="button"
            className={`c360-dot-btn ${dotMenuOpen ? 'active' : ''}`}
            onClick={() => setDotMenuOpen(!dotMenuOpen)}
            aria-label="Quick Access Menu"
            title="Quick Options"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2.2" />
              <circle cx="12" cy="12" r="2.2" />
              <circle cx="19" cy="12" r="2.2" />
            </svg>
          </button>

          {dotMenuOpen && (
            <div className="c360-dot-menu" role="menu">
              <button
                type="button"
                className="c360-dot-item"
                onClick={() => handleNavClick('capabilities')}
              >
                <Wifi size={14} />
                <span>Live Gate RFID Scanner</span>
              </button>
              <button
                type="button"
                className="c360-dot-item"
                onClick={() => handleNavClick('roles')}
              >
                <Calendar size={14} />
                <span>Teacher Timetable & Routines</span>
              </button>
              <button
                type="button"
                className="c360-dot-item"
                onClick={() => handleNavClick('capabilities')}
              >
                <MessageSquare size={14} />
                <span>Parent SMS Alerts</span>
              </button>
              <button
                type="button"
                className="c360-dot-item"
                onClick={() => handleNavClick('trust')}
              >
                <ShieldCheck size={14} />
                <span>Data Privacy Masking (**)</span>
              </button>
              <div style={{ height: 1, background: 'var(--color-border-muted)', margin: '4px 0' }} />
              <button
                type="button"
                className="c360-dot-item"
                onClick={() => handleNavClick('demo')}
              >
                <HelpCircle size={14} />
                <span>School Implementation Support</span>
              </button>
            </div>
          )}

          {/* GREEN LOGIN BUTTON (Strict user constraint) */}
          <button
            type="button"
            className="c360-btn-login-green"
            onClick={handleLoginClick}
            id="nav-login-btn"
          >
            <UserCheck size={15} />
            <span>Portal Login</span>
          </button>

          {/* Request a Demo Button */}
          <button
            type="button"
            className="c360-btn-primary"
            onClick={() => handleNavClick('demo')}
            id="nav-demo-btn"
          >
            <span>Request a Demo</span>
            <ArrowRight size={14} />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="c360-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="c360-mobile-menu">
          <button type="button" className="c360-nav-link" onClick={() => handleNavClick('capabilities')}>
            Capabilities
          </button>
          <button type="button" className="c360-nav-link" onClick={() => handleNavClick('roles')}>
            Roles
          </button>
          <button type="button" className="c360-nav-link" onClick={() => handleNavClick('flow')}>
            How It Works
          </button>
          <button type="button" className="c360-nav-link" onClick={() => handleNavClick('trust')}>
            Trust
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              className="c360-btn-login-green"
              onClick={handleLoginClick}
              style={{ width: '100%' }}
            >
              <UserCheck size={15} />
              <span>Portal Login</span>
            </button>
            <button
              type="button"
              className="c360-btn-primary"
              onClick={() => handleNavClick('demo')}
              style={{ width: '100%' }}
            >
              <span>Request a Demo</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
