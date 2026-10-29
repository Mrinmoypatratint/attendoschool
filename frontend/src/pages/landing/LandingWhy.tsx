import React from 'react';
import {
  ClipboardCheck,
  Calendar,
  Bell,
  BarChart3,
  CheckCircle2,
  Lock,
  MessageSquare,
  ShieldCheck,
  HeartHandshake
} from 'lucide-react';

export const LandingWhy: React.FC = () => {
  return (
    <section className="lp-why-section" id="why">
      <div className="lp-container">
        {/* Section Header (Natural Editorial Heading, No AI Pill Badges) */}
        <div className="lp-section-header">
          <div className="lp-section-topic">Why AttendoSchool</div>
          <h2 className="lp-section-title">Less Paperwork. More Teaching Time.</h2>
          <p className="lp-section-subtitle">
            AttendoSchool replaces fragile manual registers with reliable gate RFID check-in and quick mobile attendance, keeping school leadership, teachers, and parents aligned.
          </p>
        </div>

        {/* Happy Parents Photo & Live SMS Callout Section */}
        <div className="lp-parents-highlight-card">
          <div className="lp-parents-photo-col">
            <img
              src="/happy_parents.jpg"
              alt="Happy Indian parents receiving school attendance SMS update"
            />
          </div>
          <div className="lp-parents-text-col">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--lp-brand-green)', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
              <HeartHandshake size={16} />
              <span>Parent Reassurance & Student Safety</span>
            </div>
            <h3 style={{ fontSize: 'clamp(20px, 2.4vw, 26px)', fontWeight: 700, color: 'var(--lp-text-primary)', margin: 0, marginBottom: 12, lineHeight: 1.3 }}>
              "The moment my phone rings at 8:15 AM, I know my child has reached school safely."
            </h3>
            <p style={{ fontSize: 14.5, color: 'var(--lp-text-secondary)', lineHeight: 1.6, margin: 0, marginBottom: 16 }}>
              At <strong>D.A.V. Public School</strong>, parents no longer have to worry about whether their child reached campus on time. When students tap their RFID card at the gate, an automated SMS confirmation is immediately delivered to the registered guardian's mobile phone.
            </p>

            {/* Masked SMS Preview Box */}
            <div className="lp-sms-preview-card">
              <div className="lp-sms-sender">
                <Bell size={13} />
                <span>OFFICIAL SMS NOTIFICATION · D.A.V. PUBLIC SCHOOL</span>
              </div>
              <div className="lp-sms-body">
                "Dear Parent, your ward <strong>Aa**av Sh**ma (Roll 10*, Class 10-A)</strong> has safely checked in at D.A.V. Public School at 08:14 AM. — AttendoSchool"
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11.5, color: '#047857', fontWeight: 500 }}>
                <CheckCircle2 size={13} />
                <span>Delivered via National SMS Gateway · Confidential student data masked (**)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Four Clean Institutional Value Pillars */}
        <div className="lp-pillars-grid">
          {/* Pillar 1 */}
          <div className="lp-pillar-card">
            <div className="lp-pillar-icon-box">
              <ClipboardCheck size={20} />
            </div>
            <h3 className="lp-pillar-title">Fast Gate & Class Roll Call</h3>
            <p className="lp-pillar-desc">
              Students tap their cards at gate readers within seconds. Teachers can also take classroom roll calls in under a minute from their phone or computer.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="lp-pillar-card">
            <div className="lp-pillar-icon-box">
              <Calendar size={20} />
            </div>
            <h3 className="lp-pillar-title">Clean School Administration</h3>
            <p className="lp-pillar-desc">
              Manage student enrollment, section allocations, academic calendars, and teacher timetables without stacks of paper registers.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="lp-pillar-card">
            <div className="lp-pillar-icon-box">
              <Bell size={20} />
            </div>
            <h3 className="lp-pillar-title">Automated Parent SMS Alerts</h3>
            <p className="lp-pillar-desc">
              Send immediate arrival confirmations, absence alerts, and urgent school notices directly to parent mobile numbers.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="lp-pillar-card">
            <div className="lp-pillar-icon-box">
              <BarChart3 size={20} />
            </div>
            <h3 className="lp-pillar-title">Official Board Reports</h3>
            <p className="lp-pillar-desc">
              Generate daily student registers, monthly percentages, and official CBSE or State board attendance sheets in one click.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
