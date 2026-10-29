import React, { useState } from 'react';
import {
  ClipboardCheck,
  Users,
  GraduationCap,
  Calendar,
  BarChart3,
  MessageSquare
} from 'lucide-react';
import { FeaturePreviewScreens } from './components/FeaturePreviewScreens';

interface FeatureItem {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const FEATURES: FeatureItem[] = [
  { id: 'feat-attendance', title: 'Student & Gate Attendance', icon: <ClipboardCheck size={17} /> },
  { id: 'feat-sis', title: 'Student Records (SIS)', icon: <Users size={17} /> },
  { id: 'feat-staff', title: 'Teachers & Staff', icon: <GraduationCap size={17} /> },
  { id: 'feat-routine', title: 'Timetable & Routines', icon: <Calendar size={17} /> },
  { id: 'feat-analytics', title: 'Reports & Registers', icon: <BarChart3 size={17} /> },
  { id: 'feat-comms', title: 'Parent SMS & Notices', icon: <MessageSquare size={17} /> }
];

export const LandingFeatures: React.FC = () => {
  const [activeFeatureId, setActiveFeatureId] = useState<string>('feat-attendance');

  return (
    <section className="lp-features-section" id="features">
      <div className="lp-container">
        {/* Section Header (Natural Editorial Heading, No AI Pill Badges) */}
        <div className="lp-section-header">
          <div className="lp-section-topic">Platform Modules</div>
          <h2 className="lp-section-title">Built for Everyday School Operations</h2>
          <p className="lp-section-subtitle">
            Manage daily gate check-ins, classroom attendance, teacher schedules, and student records without switching between different systems. Select a module below to see it in action.
          </p>
        </div>

        {/* Feature Tab Strip */}
        <div className="lp-features-tab-strip" role="tablist">
          {FEATURES.map(feat => {
            const isActive = feat.id === activeFeatureId;
            return (
              <button
                key={feat.id}
                type="button"
                className={`lp-feat-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveFeatureId(feat.id)}
                role="tab"
                aria-selected={isActive}
              >
                <span>{feat.icon}</span>
                <span>{feat.title}</span>
              </button>
            );
          })}
        </div>

        {/* High-Precision Flat Display Screen */}
        <FeaturePreviewScreens activeFeatureId={activeFeatureId} />
      </div>
    </section>
  );
};
