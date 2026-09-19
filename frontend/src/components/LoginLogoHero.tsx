import React from 'react';
import { ShieldCheck, Zap, Users, GraduationCap } from 'lucide-react';

export const LoginLogoHero: React.FC = () => {
  return (
    <div className="as-logo-hero-wrapper">
      {/* Radiant ambient halo behind the logo card */}
      <div className="as-logo-hero-halo" aria-hidden="true" />

      {/* Main Frosted Brand Medallion Card */}
      <div className="as-logo-hero-card animate-fade-in">
        <div className="as-logo-img-frame">
          <img
            src="/attendo-school-logo.png"
            alt="AttendoSchool - Attendance Today, Brighter Tomorrow"
            className="as-logo-hero-img"
          />
        </div>

        {/* Live SIS Status Tag */}
        <div className="as-logo-status-tag">
          <span className="as-pulse-dot" />
          <span>Next-Gen Education Platform</span>
        </div>
      </div>

      {/* Brand Value Proposition */}
      <div className="as-logo-hero-copy">
        <h2 className="as-logo-hero-headline">
          Smart Attendance. <br />
          <span className="as-gradient-text">Brighter Tomorrow.</span>
        </h2>
        <p className="as-logo-hero-description">
          Unified campus operations, live biometric sync, and seamless multi-portal access for modern institutions.
        </p>
      </div>

      {/* Institutional Highlights */}
      <div className="as-logo-hero-pills">
        <div className="as-hero-pill">
          <Zap size={14} className="as-pill-icon blue" />
          <span>Real-time Biometrics</span>
        </div>
        <div className="as-hero-pill">
          <ShieldCheck size={14} className="as-pill-icon green" />
          <span>Dual-DB Cloud Sync</span>
        </div>
        <div className="as-hero-pill">
          <Users size={14} className="as-pill-icon purple" />
          <span>500+ Active Campuses</span>
        </div>
      </div>
    </div>
  );
};
