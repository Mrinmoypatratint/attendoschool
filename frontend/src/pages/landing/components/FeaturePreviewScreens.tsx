import React from 'react';
import {
  ClipboardCheck,
  Users,
  GraduationCap,
  Calendar,
  BarChart3,
  MessageSquare,
  Lock,
  CheckCircle2,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  Wifi
} from 'lucide-react';

interface FeaturePreviewProps {
  activeFeatureId: string;
}

export const FeaturePreviewScreens: React.FC<FeaturePreviewProps> = ({ activeFeatureId }) => {
  return (
    <div className="lp-feature-display-panel">
      {/* 1. ATTENDANCE MANAGEMENT (FEATURING REAL RFID GATE TAP PHOTO) */}
      {activeFeatureId === 'feat-attendance' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--lp-border-subtle)',
              paddingBottom: 14,
              marginBottom: 18,
              flexWrap: 'wrap',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--lp-brand-green-subtle)',
                  color: 'var(--lp-brand-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ClipboardCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
                  Morning Gate RFID Attendance
                </div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-muted)' }}>
                  Main Gate Scanner 01 · D.A.V. Public School (Sector 14)
                </div>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#047857', background: '#ECFDF5', padding: '3px 8px', borderRadius: 4 }}>
              38 / 40 Present (95.0%)
            </span>
          </div>

          {/* Photo & Telemetry Grid */}
          <div className="lp-feature-photo-grid">
            {/* Real RFID Gate Tap Photo */}
            <div className="lp-feature-photo-box">
              <img
                src="/rfid_gate_tap.jpg"
                alt="Student tapping RFID card at D.A.V. school entrance gate scanner"
              />
              <div className="lp-feature-photo-caption">
                ✓ Live Gate Scanner: Card #98** Verified at 08:14 AM
              </div>
            </div>

            {/* Live Telemetry Table with Masked Data */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11.5, color: '#B45309', fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={12} /> Student PII Masked (**) for Confidentiality
                </span>
                <span style={{ color: '#047857' }}>Auto-SMS Dispatched</span>
              </div>

              <table className="lp-flat-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Roll</th>
                    <th style={{ textAlign: 'left' }}>Student Name</th>
                    <th style={{ textAlign: 'left' }}>Gate Time</th>
                    <th style={{ textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="lp-masked-data">10*</td>
                    <td className="lp-masked-data">Aa**av Sh**ma</td>
                    <td style={{ fontFamily: 'monospace' }}>08:14 AM</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ color: '#047857', background: '#ECFDF5', padding: '2px 7px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                        ✓ Present
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="lp-masked-data">10*</td>
                    <td className="lp-masked-data">An**ya Mu*****ee</td>
                    <td style={{ fontFamily: 'monospace' }}>08:16 AM</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ color: '#047857', background: '#ECFDF5', padding: '2px 7px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                        ✓ Present
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="lp-masked-data">10*</td>
                    <td className="lp-masked-data">Ka**r S*n</td>
                    <td style={{ color: '#B91C1C' }}>—</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ color: '#B91C1C', background: '#FEF2F2', padding: '2px 7px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                        ✕ Absent (SMS Sent)
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. STUDENT INFORMATION (SIS) (FEATURING REAL COMPUTER LAB PHOTO) */}
      {activeFeatureId === 'feat-sis' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--lp-border-subtle)',
              paddingBottom: 14,
              marginBottom: 18
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--lp-brand-green-subtle)',
                  color: 'var(--lp-brand-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Users size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
                  Student Profile & Academic Records
                </div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-muted)' }}>
                  D.A.V. Student Record #DAV-2026-**29 · Class 10-A
                </div>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#047857', background: '#ECFDF5', padding: '3px 8px', borderRadius: 4 }}>
              Active Enrollment
            </span>
          </div>

          <div className="lp-feature-photo-grid">
            {/* Real Computer Lab Photo */}
            <div className="lp-feature-photo-box">
              <img
                src="/students_computer_lab.jpg"
                alt="Students working in modern D.A.V. computer lab"
              />
              <div className="lp-feature-photo-caption">
                D.A.V. Digital Lab: Centralized Academic Record Sync
              </div>
            </div>

            {/* Dossier Card with Masked PII */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 12.5 }}>
              <div style={{ background: 'var(--lp-bg-warm)', padding: 10, borderRadius: 6 }}>
                <div style={{ fontSize: 10.5, color: 'var(--lp-text-muted)', fontWeight: 600 }}>STUDENT NAME (MASKED)</div>
                <div className="lp-masked-data" style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>Aa**av Sh**ma</div>
              </div>
              <div style={{ background: 'var(--lp-bg-warm)', padding: 10, borderRadius: 6 }}>
                <div style={{ fontSize: 10.5, color: 'var(--lp-text-muted)', fontWeight: 600 }}>CLASS & SECTION</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>Class 10 - Section A (Roll 10*)</div>
              </div>
              <div style={{ background: 'var(--lp-bg-warm)', padding: 10, borderRadius: 6 }}>
                <div style={{ fontSize: 10.5, color: 'var(--lp-text-muted)', fontWeight: 600 }}>GUARDIAN CONTACT</div>
                <div className="lp-masked-data" style={{ fontWeight: 600, marginTop: 2 }}>Dr. R. Sh**ma (+91 98310 *****)</div>
              </div>
              <div style={{ background: 'var(--lp-bg-warm)', padding: 10, borderRadius: 6 }}>
                <div style={{ fontSize: 10.5, color: 'var(--lp-text-muted)', fontWeight: 600 }}>ATTENDANCE RATE</div>
                <div style={{ fontWeight: 700, color: '#047857', marginTop: 2 }}>98.4% (Eligible for Board Exams)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TEACHER & STAFF MANAGEMENT (FEATURING REAL TEACHER PHOTO) */}
      {activeFeatureId === 'feat-staff' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--lp-border-subtle)',
              paddingBottom: 14,
              marginBottom: 18
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--lp-brand-green-subtle)',
                  color: 'var(--lp-brand-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <GraduationCap size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
                  Teacher Roster & Class Mentorship
                </div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-muted)' }}>
                  D.A.V. Faculty Roster · 82 Registered Educators
                </div>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#047857', background: '#ECFDF5', padding: '3px 8px', borderRadius: 4 }}>
              78 / 82 On Duty Today
            </span>
          </div>

          <div className="lp-feature-photo-grid">
            {/* Real Teacher Photo */}
            <div className="lp-feature-photo-box">
              <img
                src="/teacher_dav.jpg"
                alt="D.A.V. school teacher in classroom with students"
              />
              <div className="lp-feature-photo-caption">
                Classroom Teacher: Dr. M. R** (Senior PGT Physics)
              </div>
            </div>

            {/* Roster Table */}
            <div>
              <table className="lp-flat-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Faculty Member</th>
                    <th style={{ textAlign: 'left' }}>Designation</th>
                    <th style={{ textAlign: 'right' }}>Assigned Class</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="lp-masked-data">Dr. M. R**</td>
                    <td>Senior PGT Physics</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#047857' }}>Class 12-B</td>
                  </tr>
                  <tr>
                    <td className="lp-masked-data">Prof. A. Ba******</td>
                    <td>HOD Mathematics</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#047857' }}>Class 10-A</td>
                  </tr>
                  <tr>
                    <td className="lp-masked-data">P. Se******</td>
                    <td>TGT English</td>
                    <td style={{ textAlign: 'right', color: 'var(--lp-text-muted)' }}>Class 9-C</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. CLASS & ROUTINE MANAGEMENT */}
      {activeFeatureId === 'feat-routine' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--lp-border-subtle)',
              paddingBottom: 14,
              marginBottom: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--lp-brand-green-subtle)',
                  color: 'var(--lp-brand-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Calendar size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
                  Weekly Class Timetable
                </div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-muted)' }}>Class 10-A · D.A.V. Weekly Period Schedule</div>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#047857', background: '#ECFDF5', padding: '3px 8px', borderRadius: 4 }}>
              Regular Schedule
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div style={{ background: 'var(--lp-bg-warm)', border: '1px solid var(--lp-border-subtle)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-brand-green)' }}>P1 · 08:30 - 09:15</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lp-text-primary)' }}>Physics Theory</div>
              <div className="lp-masked-data" style={{ fontSize: 11, color: 'var(--lp-text-muted)' }}>Dr. M. R** · Rm 20*</div>
            </div>
            <div style={{ background: 'var(--lp-bg-warm)', border: '1px solid var(--lp-border-subtle)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-brand-green)' }}>P2 · 09:15 - 10:00</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lp-text-primary)' }}>Mathematics</div>
              <div className="lp-masked-data" style={{ fontSize: 11, color: 'var(--lp-text-muted)' }}>Prof. A. Ba****** · Rm 20*</div>
            </div>
            <div style={{ background: 'var(--lp-bg-warm)', border: '1px solid var(--lp-border-subtle)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-brand-green)' }}>P3 · 10:15 - 11:00</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lp-text-primary)' }}>Chemistry Lab</div>
              <div className="lp-masked-data" style={{ fontSize: 11, color: 'var(--lp-text-muted)' }}>Dr. K. D** · Lab 2</div>
            </div>
            <div style={{ background: 'var(--lp-bg-warm)', border: '1px solid var(--lp-border-subtle)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-brand-green)' }}>P4 · 11:00 - 11:45</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lp-text-primary)' }}>English Lit</div>
              <div className="lp-masked-data" style={{ fontSize: 11, color: 'var(--lp-text-muted)' }}>P. Se****** · Rm 20*</div>
            </div>
          </div>
        </div>
      )}

      {/* 5. REPORTS & ANALYTICS */}
      {activeFeatureId === 'feat-analytics' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--lp-border-subtle)',
              paddingBottom: 14,
              marginBottom: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--lp-brand-green-subtle)',
                  color: 'var(--lp-brand-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <BarChart3 size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
                  Attendance Summary & Board Registers
                </div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-muted)' }}>D.A.V. Senior Secondary Sector 14 Campus</div>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#047857', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <FileSpreadsheet size={14} /> CBSE Excel Export Ready
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ background: 'var(--lp-bg-warm)', padding: 14, borderRadius: 8, border: '1px solid var(--lp-border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--lp-text-muted)', fontWeight: 600 }}>ANNUAL ATTENDANCE</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lp-text-primary)' }}>96.8%</div>
              <div style={{ fontSize: 11.5, color: '#047857', fontWeight: 600 }}>+1.4% improvement</div>
            </div>
            <div style={{ background: 'var(--lp-bg-warm)', padding: 14, borderRadius: 8, border: '1px solid var(--lp-border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--lp-text-muted)', fontWeight: 600 }}>CHRONIC ABSENTEEISM</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#B91C1C' }}>1.2%</div>
              <div style={{ fontSize: 11.5, color: '#047857', fontWeight: 600 }}>Follow-up active</div>
            </div>
            <div style={{ background: 'var(--lp-bg-warm)', padding: 14, borderRadius: 8, border: '1px solid var(--lp-border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--lp-text-muted)', fontWeight: 600 }}>CBSE REGISTER AUDIT</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#047857' }}>100%</div>
              <div style={{ fontSize: 11.5, color: 'var(--lp-text-muted)' }}>Form 14 Compliant</div>
            </div>
          </div>
        </div>
      )}

      {/* 6. SCHOOL COMMUNICATION */}
      {activeFeatureId === 'feat-comms' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--lp-border-subtle)',
              paddingBottom: 14,
              marginBottom: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--lp-brand-green-subtle)',
                  color: 'var(--lp-brand-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <MessageSquare size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
                  School Notices & Parent SMS Broadcast
                </div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-muted)' }}>Official Announcements & Emergency Alerts</div>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#047857', background: '#ECFDF5', padding: '3px 8px', borderRadius: 4 }}>
              SMS Gateway Active
            </span>
          </div>

          <div style={{ background: 'var(--lp-bg-warm)', padding: 14, borderRadius: 8, border: '1px solid var(--lp-border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: 'var(--lp-text-primary)' }}>Urgent: D.A.V. Morning Bus Timing & Dense Fog Protocol</span>
              <span style={{ color: 'var(--lp-text-muted)' }}>Today at 07:15 AM</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--lp-text-secondary)', lineHeight: 1.5 }}>
              "Due to dense morning fog in the NCR region, all D.A.V. school bus routes are scheduled with a 30-minute delay buffer. Classes begin promptly at 09:00 AM."
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, fontWeight: 600, color: '#047857' }}>
              <span>✓ 1,284 SMS Dispatched</span>
              <span>✓ 100% Parent Portal Sync</span>
              <span>✓ Verified Audit Log #SMS-**84</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
