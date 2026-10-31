import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MoreHorizontal,
  UserCheck,
  ArrowRight,
  Menu,
  X,
  Sparkles,
  Briefcase,
  Users,
  Workflow,
  ShieldCheck,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface LandingNavProps {
  onScrollTo: (sectionId: string) => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({ onScrollTo }) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dotMenuOpen, setDotMenuOpen] = useState(false);
  const dotMenuRef = useRef<HTMLDivElement>(null);

  // Close 3-dot menu on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dotMenuRef.current && !dotMenuRef.current.contains(e.target as Node)) {
        setDotMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDotMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleNavClick = (sectionId: string) => {
    onScrollTo(sectionId);
    setMobileMenuOpen(false);
    setDotMenuOpen(false);
  };

  const handleLoginClick = () => {
    navigate('/login');
    setMobileMenuOpen(false);
    setDotMenuOpen(false);
  };

  const navSections = [
    {
      id: 'capabilities',
      title: 'Capabilities',
      desc: 'Bento Grid, RFID Telemetry & CBSE Form 14',
      badge: 'Campus360',
      badgeClass: 'badge-blue',
      icon: Sparkles,
      iconColor: '#0284C7',
      iconBg: '#EFF6FF'
    },
    {
      id: 'hrms',
      title: 'HRMS & Staff',
      desc: 'Faculty Biometrics, Payroll & Leave Suite',
      badge: 'Live Suite',
      badgeClass: 'badge-green',
      icon: Briefcase,
      iconColor: '#059669',
      iconBg: '#ECFDF5'
    },
    {
      id: 'roles',
      title: 'Roles & Workspaces',
      desc: 'Super Admin, Principal, Teacher & Student',
      badge: 'Multi-Role',
      badgeClass: 'badge-purple',
      icon: Users,
      iconColor: '#7C3AED',
      iconBg: '#F5F3FF'
    },
    {
      id: 'flow',
      title: 'How It Works',
      desc: '01–05 Live Gate Turnstile to Instant Alert Flow',
      badge: 'Automated',
      badgeClass: 'badge-amber',
      icon: Workflow,
      iconColor: '#D97706',
      iconBg: '#FFFBEB'
    },
    {
      id: 'trust',
      title: 'Trust & Security',
      desc: 'CBSE & State Board Masking, 99.9% Cloud SLA',
      badge: 'Encrypted',
      badgeClass: 'badge-blue',
      icon: ShieldCheck,
      iconColor: '#2563EB',
      iconBg: '#EFF6FF'
    }
  ];

  return (
    <header className="c360-nav-wrapper">
      <div className="c360-container c360-nav-content">
        {/* Brand Left: AttendoSchool Logo */}
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

        {/* Right Actions Area */}
        <div className="c360-nav-actions" ref={dotMenuRef}>
          {/* HRMS PORTAL BUTTON (Redirects to https://hrms.attendoschool.online/) */}
          <a
            href="https://hrms.attendoschool.online/"
            target="_blank"
            rel="noopener noreferrer"
            className="c360-btn-hrms"
            id="nav-hrms-btn"
            title="Launch AttendoSchool HRMS & Staff Portal"
          >
            <Briefcase size={14} />
            <span>HRMS Portal</span>
            <ExternalLink size={12} />
          </a>

          {/* GREEN LOGIN BUTTON */}
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

          {/* 3-DOT CORNER MENU BUTTON (In top right side corner) */}
          <button
            type="button"
            className={`c360-dot-btn ${dotMenuOpen ? 'active' : ''}`}
            onClick={() => setDotMenuOpen(!dotMenuOpen)}
            aria-label="Navigation & Sections Menu"
            aria-expanded={dotMenuOpen}
            title={dotMenuOpen ? 'Close Menu' : 'Explore Sections & Quick Access'}
            id="nav-dots-menu-btn"
          >
            <MoreHorizontal size={20} />
          </button>

          {/* ATTRACTIVE 3-DOT FLOATING POPOVER */}
          {dotMenuOpen && (
            <div className="c360-dot-menu" role="menu" aria-label="AttendoSchool Sections Navigation">
              {/* Header Label */}
              <div className="c360-dot-menu-header">
                <span className="c360-dot-menu-title">EXPLORE SECTIONS</span>
                <span className="c360-dot-menu-badge">5 Sections</span>
              </div>

              {/* 5 Core Navigation Sections (Moved from Center Navbar) */}
              <div className="c360-dot-items-list">
                {navSections.map(item => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="c360-dot-nav-item"
                      onClick={() => handleNavClick(item.id)}
                    >
                      <div className="c360-dot-nav-icon" style={{ background: item.iconBg, color: item.iconColor }}>
                        <IconComp size={18} />
                      </div>
                      <div className="c360-dot-nav-text">
                        <div className="c360-dot-nav-top">
                          <span className="c360-dot-nav-title">{item.title}</span>
                          <span className={`c360-dot-pill ${item.badgeClass}`}>{item.badge}</span>
                        </div>
                        <span className="c360-dot-nav-desc">{item.desc}</span>
                      </div>
                      <ChevronRight size={15} className="c360-dot-nav-arrow" />
                    </button>
                  );
                })}
              </div>

              {/* Sleek Divider */}
              <div className="c360-dot-divider" />

              {/* Quick Actions Footer */}
              <div className="c360-dot-menu-header">
                <span className="c360-dot-menu-title">QUICK ACCESS</span>
              </div>

              <div className="c360-dot-quick-grid">
                <a
                  href="https://hrms.attendoschool.online/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="c360-dot-quick-link"
                >
                  <Briefcase size={13} style={{ color: '#0284C7' }} />
                  <span>HRMS</span>
                  <ExternalLink size={10} style={{ opacity: 0.55 }} />
                </a>

                <button
                  type="button"
                  className="c360-dot-quick-link"
                  onClick={handleLoginClick}
                >
                  <UserCheck size={13} style={{ color: '#059669' }} />
                  <span>Login</span>
                </button>

                <button
                  type="button"
                  className="c360-dot-quick-link highlight"
                  onClick={() => handleNavClick('demo')}
                >
                  <ArrowRight size={13} style={{ color: '#2563EB' }} />
                  <span>Demo</span>
                </button>
              </div>
            </div>
          )}

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
          <button type="button" className="c360-nav-link" onClick={() => handleNavClick('hrms')}>
            HRMS &amp; Staff Suite
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
            <a
              href="https://hrms.attendoschool.online/"
              target="_blank"
              rel="noopener noreferrer"
              className="c360-btn-hrms"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Briefcase size={14} />
              <span>Open HRMS Portal (hrms.attendoschool.online)</span>
              <ExternalLink size={13} />
            </a>
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

