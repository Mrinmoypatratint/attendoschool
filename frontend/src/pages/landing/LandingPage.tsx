import React, { useEffect, useCallback } from 'react';

import { LandingNav } from './LandingNav';
import { LandingHero } from './LandingHero';
import { LandingCapabilities } from './LandingCapabilities';
import { LandingHRMS } from './LandingHRMS';
import { LandingRoles } from './LandingRoles';
import { LandingFlow } from './LandingFlow';
import { LandingTrust } from './LandingTrust';
import { LandingDemo } from './LandingDemo';
import { LandingFooter } from './LandingFooter';
import './landing.css';

export default function LandingPage() {
  // Update document title for public landing page
  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'AttendoSchool — Smart Attendance System | Attendance Today — Brighter Tomorrow';
    return () => {
      document.title = originalTitle;
    };
  }, []);

  // Safe smooth scroll handler that preserves HashRouter state
  const handleScrollTo = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="attendo-landing">
      {/* 1. Header (Campus360 Sticky Blurred Navbar) */}
      <LandingNav onScrollTo={handleScrollTo} />

      {/* 2. Hero Section (Campus360 Ambient Radial Glow & 2-Col Grid) */}
      <LandingHero onScrollTo={handleScrollTo} />

      {/* 3. Capabilities / Bento Grid (Campus360 6 Domains & Real Photos) */}
      <LandingCapabilities />

      {/* 4. HRMS & Staff Suite Showcase (Dedicated Enterprise Portal & https://hrms.attendoschool.online/) */}
      <LandingHRMS onScrollToDemo={() => handleScrollTo('demo')} />

      {/* 5. Roles Showcase (Campus360 Stakeholder Tabs & Scoped View) */}
      <LandingRoles />

      {/* 6. How It Works (Campus360 01-05 Operational Timeline) */}
      <LandingFlow />

      {/* 7. Trust & Engineering (Campus360 Architectural Facts Grid) */}
      <LandingTrust />

      {/* 8. Final Conversion & Walkthrough (Campus360 Dark CTA & Form) */}
      <LandingDemo />

      {/* 9. Footer (Campus360 4-Column Layout, AttendoSchool Only) */}
      <LandingFooter onScrollTo={handleScrollTo} />
    </div>
  );
}
