import React from 'react';
import {
  Lock,
  ScanEye,
  ShieldCheck,
  FileCheck2
} from 'lucide-react';

export const LandingTrust: React.FC = () => {
  return (
    <section className="c360-section" id="trust" style={{ background: 'var(--color-marketing-bg-alt)', borderTop: '1px solid var(--color-border-muted)' }}>
      <div className="c360-container">
        {/* Section Header (Campus360 exact style) */}
        <div style={{ maxWidth: 680, marginBottom: 48, textAlign: 'left' }}>
          <span className="c360-section-tag">Trust, Structurally Enforced</span>
          <h2 className="c360-section-title">Engineering facts, not marketing claims.</h2>
          <p className="c360-section-desc">
            We would rather demonstrate the platform architecture than invent testimonials. Here is how AttendoSchool safeguards your institution.
          </p>
        </div>

        {/* 4 Architectural Cards (Campus360 exact grid) */}
        <div className="c360-trust-grid">
          {/* Fact 1 */}
          <div className="c360-trust-card">
            <div className="c360-trust-icon-box">
              <Lock size={22} />
            </div>
            <h3 className="c360-trust-title">Student Data Privacy &amp; PII Masking (**)</h3>
            <p className="c360-trust-desc">
              Sensitive student records, parent phone numbers, and RFID identifiers are masked with ** in shared views and public previews to ensure strict minor confidentiality.
            </p>
            <div style={{ marginTop: 14, background: '#F8FAFC', border: '1px solid var(--color-border-default)', borderRadius: 8, padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', color: '#0F172A' }}>
              <span style={{ color: '#059669', fontWeight: 700 }}>DPDP Act · </span>
              Aa**av Sh**ma · +91 98310 *****
            </div>
          </div>

          {/* Fact 2 */}
          <div className="c360-trust-card">
            <div className="c360-trust-icon-box">
              <ScanEye size={22} />
            </div>
            <h3 className="c360-trust-title">Database-level tenant isolation</h3>
            <p className="c360-trust-desc">
              Every institution runs in an isolated tenant partition. Records from one school branch never bleed across boundaries, enforced at the database query layer.
            </p>
            <div style={{ marginTop: 14, background: '#F8FAFC', border: '1px solid var(--color-border-default)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#0284C7', fontWeight: 600 }}>
              <span>Tenant DB Partition · Zero Cross-School Bleed</span>
            </div>
          </div>

          {/* Fact 3 */}
          <div className="c360-trust-card">
            <div className="c360-trust-icon-box">
              <ShieldCheck size={22} />
            </div>
            <h3 className="c360-trust-title">Role-scoped, not just role-labeled</h3>
            <p className="c360-trust-desc">
              A teacher's queries are strictly bound to their assigned classes. A student's portal queries are scoped to their personal record. Scoping is enforced in the backend logic.
            </p>
            <div style={{ marginTop: 14, background: '#F8FAFC', border: '1px solid var(--color-border-default)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#059669', fontWeight: 600 }}>
              <span>SQL Row-Level Security · Role-Bound Scopes</span>
            </div>
          </div>

          {/* Fact 4 */}
          <div className="c360-trust-card">
            <div className="c360-trust-icon-box">
              <FileCheck2 size={22} />
            </div>
            <h3 className="c360-trust-title">Append-only where it counts</h3>
            <p className="c360-trust-desc">
              Attendance registers, gate scan timestamps, and correction logs are maintained as permanent audit trails—nothing is silently overwritten before board inspections.
            </p>
            <div style={{ marginTop: 14, background: '#F8FAFC', border: '1px solid var(--color-border-default)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>
              <span>Audit Log Hash: #9842 · Immutable Record</span>
            </div>
          </div>
        </div>

        {/* Academic Infrastructure Photo Banner */}
        <div style={{ marginTop: 32, borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--color-border-default)', position: 'relative', height: 200 }}>
          <img
            src="/educational_library.jpg"
            alt="School library academic environment"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.90) 0%, rgba(15, 23, 42, 0.50) 60%, transparent 100%)', display: 'flex', alignItems: 'center', padding: '0 36px' }}>
            <div style={{ maxWidth: 520, textAlign: 'left', color: '#FFFFFF' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#38BDF8', marginBottom: 6 }}>
                Academic Heritage &amp; Modern Accountability
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px 0', lineHeight: 1.3 }}>
                Trusted by modern schools for daily statutory governance.
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
                AttendoSchool provides the audit trails and automated registers necessary to satisfy education department and board criteria effortlessly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
