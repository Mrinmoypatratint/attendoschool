import React, { useState } from 'react';
import {
  Briefcase,
  ExternalLink,
  Users,
  Clock,
  FileText,
  CalendarCheck,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Laptop,
  Layers,
  Award,
  DollarSign,
  UserCheck,
  Lock
} from 'lucide-react';

interface LandingHRMSProps {
  onScrollToDemo?: () => void;
}

export const LandingHRMS: React.FC<LandingHRMSProps> = ({ onScrollToDemo }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'payroll' | 'attendance' | 'substitute'>('overview');
  const hrmsUrl = 'https://hrms.attendoschool.online/';

  return (
    <section className="c360-hrms-section" id="hrms">
      <div className="c360-container">
        {/* Section Header */}
        <div className="c360-section-header">
          <div className="c360-badge-pill">
            <Briefcase size={14} />
            <span>Dedicated Staff &amp; Faculty Ecosystem</span>
          </div>
          <h2 className="c360-section-title">
            AttendoSchool <span className="text-gradient">HRMS &amp; Staff Suite</span>
          </h2>
          <p className="c360-section-desc">
            A comprehensive, cloud-native Human Resource Management System tailored for K-12 schools, CBSE/ICSE institutions, and multi-campus educational societies.
          </p>
        </div>

        {/* Top Feature Bar & Direct Redirect CTA */}
        <div className="c360-hrms-cta-strip">
          <div className="c360-hrms-strip-info">
            <div className="c360-hrms-strip-pulse" />
            <div>
              <strong>Live Institutional Portal:</strong> Access staff attendance, automated payroll, multi-tier leave approval, and recruitment pipelines at{' '}
              <a href={hrmsUrl} target="_blank" rel="noopener noreferrer" className="c360-hrms-link-inline">
                hrms.attendoschool.online
                <ExternalLink size={12} style={{ marginLeft: 3, verticalAlign: 'middle' }} />
              </a>
            </div>
          </div>
          <a
            href={hrmsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="c360-btn-hrms-primary"
            id="hrms-section-launch-btn"
          >
            <span>Open HRMS Portal</span>
            <ExternalLink size={15} />
          </a>
        </div>

        {/* Interactive Showcase Container with Real UI Mockup */}
        <div className="c360-hrms-showcase-card">
          {/* Mockup Browser Window Header */}
          <div className="c360-browser-header">
            <div className="c360-browser-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <div className="c360-browser-address-bar">
              <Lock size={12} className="lock-icon" />
              <span className="domain">https://hrms.attendoschool.online</span>
              <span className="path">/faculty/overview</span>
            </div>
            <div className="c360-browser-badge">
              <span className="status-indicator" />
              Cloud Live Sync
            </div>
          </div>

          {/* Module Selector Tabs */}
          <div className="c360-hrms-tabs">
            <button
              type="button"
              className={`c360-hrms-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Laptop size={15} />
              <span>HRMS Command Dashboard</span>
            </button>
            <button
              type="button"
              className={`c360-hrms-tab ${activeTab === 'payroll' ? 'active' : ''}`}
              onClick={() => setActiveTab('payroll')}
            >
              <DollarSign size={15} />
              <span>Automated School Payroll</span>
            </button>
            <button
              type="button"
              className={`c360-hrms-tab ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              <Clock size={15} />
              <span>Biometric Gate Sync</span>
            </button>
            <button
              type="button"
              className={`c360-hrms-tab ${activeTab === 'substitute' ? 'active' : ''}`}
              onClick={() => setActiveTab('substitute')}
            >
              <CalendarCheck size={15} />
              <span>Substitute Teacher Engine</span>
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="c360-hrms-tab-content">
            {/* TAB 1: OVERVIEW DASHBOARD */}
            {activeTab === 'overview' && (
              <div className="c360-hrms-view-grid">
                <div className="c360-hrms-visual-frame">
                  <img
                    src="/hrms-preview.jpg"
                    alt="AttendoSchool HRMS Faculty & Staff Dashboard"
                    className="c360-hrms-preview-img"
                    loading="lazy"
                  />
                  <div className="c360-hrms-img-overlay">
                    <a
                      href={hrmsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="c360-btn-preview-hover"
                    >
                      <Briefcase size={15} />
                      <span>Launch Live HRMS Application</span>
                      <ArrowRight size={15} />
                    </a>
                  </div>
                </div>

                <div className="c360-hrms-details-panel">
                  <div className="c360-hrms-panel-badge">
                    <Sparkles size={13} />
                    Enterprise Feature Highlights
                  </div>
                  <h3 className="c360-hrms-panel-title">Centralized Faculty &amp; Staff Intelligence</h3>
                  <p className="c360-hrms-panel-desc">
                    Eliminate disparate spreadsheets, punch cards, and manual leave registers. AttendoSchool HRMS brings teachers, laboratory staff, and administrative personnel into one cohesive institutional ledger.
                  </p>

                  <div className="c360-hrms-feature-bullets">
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Biometric Gate Hardware Integration:</strong> Real-time punch in/out sync from Essl, ZKTeco, and RFID turnstiles.
                      </div>
                    </div>
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Multi-Tier Institutional Approvals:</strong> Head of Department (HOD) &rarr; Vice Principal &rarr; Principal leave authorization workflows.
                      </div>
                    </div>
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Data Confidentiality Masking (**):</strong> Full role-based access control protecting salary figures, personal Aadhaar/PAN, and teacher dossiers.
                      </div>
                    </div>
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Institutional Service Books:</strong> Complete digital archiving of qualifications, CBSE teacher training hours, and performance ratings.
                      </div>
                    </div>
                  </div>

                  <div className="c360-hrms-actions-row">
                    <a
                      href={hrmsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="c360-btn-primary"
                    >
                      <span>Explore HRMS at hrms.attendoschool.online</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PAYROLL & SALARY SLIPS */}
            {activeTab === 'payroll' && (
              <div className="c360-hrms-view-grid">
                <div className="c360-hrms-visual-frame">
                  <img
                    src="/hrms-payroll.jpg"
                    alt="School HRMS Automated Salary Slip and Biometric Summary"
                    className="c360-hrms-preview-img"
                    loading="lazy"
                  />
                  <div className="c360-hrms-img-overlay">
                    <a
                      href={hrmsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="c360-btn-preview-hover"
                    >
                      <DollarSign size={15} />
                      <span>Review Payroll Engine in Portal</span>
                      <ArrowRight size={15} />
                    </a>
                  </div>
                </div>

                <div className="c360-hrms-details-panel">
                  <div className="c360-hrms-panel-badge">
                    <DollarSign size={13} />
                    CBSE &amp; Institutional Compliance
                  </div>
                  <h3 className="c360-hrms-panel-title">Automated Payroll &amp; Verified Payslips</h3>
                  <p className="c360-hrms-panel-desc">
                    Attendance-linked payroll processing computes accurate monthly allowances, EPF deductions, ESIC contributions, and Professional Tax in seconds.
                  </p>

                  <div className="c360-hrms-feature-bullets">
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>7th Pay Commission Ready:</strong> Configurable pay matrices for PGT, TGT, PRT, and non-teaching personnel with basic pay + DA scalers.
                      </div>
                    </div>
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Automated Loss of Pay (LOP):</strong> Automatic leave balance reconciliation ensures unexcused absences adjust payroll without manual clerical calculation.
                      </div>
                    </div>
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Digital PDF Salary Slips:</strong> Teachers download signed payslips with QR verification directly from their smartphone app or staff portal.
                      </div>
                    </div>
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Bank Batch NEFT/RTGS Exports:</strong> Pre-formatted salary payment registers compatible with HDFC, SBI, ICICI, and Axis institutional banking.
                      </div>
                    </div>
                  </div>

                  <div className="c360-hrms-actions-row">
                    <a
                      href={hrmsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="c360-btn-primary"
                    >
                      <span>Open Payroll Module</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BIOMETRIC GATE SYNC */}
            {activeTab === 'attendance' && (
              <div className="c360-hrms-view-grid">
                <div className="c360-hrms-interactive-box">
                  <div className="c360-hrms-box-header">
                    <div>
                      <div className="c360-hrms-box-title">Live Biometric Attendance Feed</div>
                      <div className="c360-hrms-box-subtitle">Hardware Station #04 — Senior Wing Gate Turnstile</div>
                    </div>
                    <span className="c360-pill-status-online">
                      <span className="live-dot" /> 24 Devices Connected
                    </span>
                  </div>

                  <div className="c360-hrms-table-wrapper">
                    <table className="c360-hrms-table">
                      <thead>
                        <tr>
                          <th>Faculty / Staff</th>
                          <th>Department</th>
                          <th>Gate Punch In</th>
                          <th>Status</th>
                          <th>Verification</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <div className="c360-staff-cell">
                              <span className="staff-avatar">RN</span>
                              <div>
                                <div className="staff-name">Dr. R** N**</div>
                                <div className="staff-id">EID-1042</div>
                              </div>
                            </div>
                          </td>
                          <td>Mathematics (Senior)</td>
                          <td><span className="time-badge">07:44:12 AM</span></td>
                          <td><span className="badge-present">On Time</span></td>
                          <td><span className="verify-badge"><ShieldCheck size={12} /> RFID Gate 02</span></td>
                        </tr>
                        <tr>
                          <td>
                            <div className="c360-staff-cell">
                              <span className="staff-avatar avatar-blue">SP</span>
                              <div>
                                <div className="staff-name">Mrs. S** P**</div>
                                <div className="staff-id">EID-1088</div>
                              </div>
                            </div>
                          </td>
                          <td>Physics &amp; Robotics</td>
                          <td><span className="time-badge">07:48:05 AM</span></td>
                          <td><span className="badge-present">On Time</span></td>
                          <td><span className="verify-badge"><ShieldCheck size={12} /> Facial Biometric</span></td>
                        </tr>
                        <tr>
                          <td>
                            <div className="c360-staff-cell">
                              <span className="staff-avatar avatar-purple">AK</span>
                              <div>
                                <div className="staff-name">Mr. A** K**</div>
                                <div className="staff-id">EID-1104</div>
                              </div>
                            </div>
                          </td>
                          <td>Physical Education</td>
                          <td><span className="time-badge">07:35:10 AM</span></td>
                          <td><span className="badge-present">On Time</span></td>
                          <td><span className="verify-badge"><ShieldCheck size={12} /> Gate Turnstile</span></td>
                        </tr>
                        <tr>
                          <td>
                            <div className="c360-staff-cell">
                              <span className="staff-avatar avatar-amber">MC</span>
                              <div>
                                <div className="staff-name">Dr. M** C**</div>
                                <div className="staff-id">EID-1019</div>
                              </div>
                            </div>
                          </td>
                          <td>English Literature</td>
                          <td><span className="time-badge">—</span></td>
                          <td><span className="badge-duty">On Duty (CBSE)</span></td>
                          <td><span className="verify-badge">Approved Slip #412</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="c360-hrms-box-footer">
                    <span>* Institutional security: Employee surname and Aadhaar identifiers are masked (**) in public views.</span>
                  </div>
                </div>

                <div className="c360-hrms-details-panel">
                  <div className="c360-hrms-panel-badge">
                    <Clock size={13} />
                    Zero Human Intervention
                  </div>
                  <h3 className="c360-hrms-panel-title">Hardware-Level Biometric Accuracy</h3>
                  <p className="c360-hrms-panel-desc">
                    Biometric events instantly update both the school administrative ledger and the teacher’s mobile app. Late arrivals trigger automated WhatsApp notifications to the administration desk.
                  </p>

                  <div className="c360-hrms-feature-bullets">
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Sub-Second Gate Turnstile Punch:</strong> Supports contactless UHF RFID cards, fingerprint scanners, and AI facial recognition cameras.
                      </div>
                    </div>
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Offline Sync Resilience:</strong> Device records cache locally during network outages and sync automatically when internet connectivity restores.
                      </div>
                    </div>
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Geofenced Mobile Punch:</strong> For sports instructors, bus escorts, and off-campus examination duty invigilators.
                      </div>
                    </div>
                  </div>

                  <div className="c360-hrms-actions-row">
                    <a
                      href={hrmsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="c360-btn-primary"
                    >
                      <span>View Live Biometrics in HRMS</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: SUBSTITUTE TEACHER ENGINE */}
            {activeTab === 'substitute' && (
              <div className="c360-hrms-view-grid">
                <div className="c360-hrms-interactive-box">
                  <div className="c360-hrms-box-header">
                    <div>
                      <div className="c360-hrms-box-title">Automated Timetable Substitute Roster</div>
                      <div className="c360-hrms-box-subtitle">Daily Academic Coverage Engine &bull; Period 3 to Period 7</div>
                    </div>
                    <span className="c360-pill-status-online">
                      100% Coverage Maintained
                    </span>
                  </div>

                  <div className="c360-hrms-sub-cards">
                    <div className="c360-sub-card">
                      <div className="sub-card-top">
                        <span className="period-pill">Period 3 &bull; 10:15 AM</span>
                        <span className="class-pill">Class X-A &bull; Room 304</span>
                      </div>
                      <div className="sub-card-body">
                        <div className="sub-arrow-flow">
                          <div>
                            <span className="sub-role">Absent Faculty:</span>
                            <div className="sub-teacher absent">Mr. V** S** (Medical Leave)</div>
                            <span className="sub-subject">Physics Lab</span>
                          </div>
                          <ChevronRight size={20} className="arrow-icon" />
                          <div>
                            <span className="sub-role">Auto-Assigned Substitute:</span>
                            <div className="sub-teacher assigned">Mrs. T** D** (Free Period)</div>
                            <span className="sub-subject">Qualified Physics TGT</span>
                          </div>
                        </div>
                      </div>
                      <div className="sub-card-status">
                        <CheckCircle2 size={14} /> SMS Notification sent to Substitute Teacher &bull; Accepted
                      </div>
                    </div>

                    <div className="c360-sub-card">
                      <div className="sub-card-top">
                        <span className="period-pill">Period 5 &bull; 12:40 PM</span>
                        <span className="class-pill">Class VIII-C &bull; Room 208</span>
                      </div>
                      <div className="sub-card-body">
                        <div className="sub-arrow-flow">
                          <div>
                            <span className="sub-role">Absent Faculty:</span>
                            <div className="sub-teacher absent">Dr. R** B** (Casual Leave)</div>
                            <span className="sub-subject">Sanskrit &amp; Hindi</span>
                          </div>
                          <ChevronRight size={20} className="arrow-icon" />
                          <div>
                            <span className="sub-role">Auto-Assigned Substitute:</span>
                            <div className="sub-teacher assigned">Mr. K** J** (Library In-Charge)</div>
                            <span className="sub-subject">Activity Supervision</span>
                          </div>
                        </div>
                      </div>
                      <div className="sub-card-status">
                        <CheckCircle2 size={14} /> Timetable updated on Teacher App &amp; Class Board
                      </div>
                    </div>
                  </div>
                </div>

                <div className="c360-hrms-details-panel">
                  <div className="c360-hrms-panel-badge">
                    <CalendarCheck size={13} />
                    Zero Unsupervised Classrooms
                  </div>
                  <h3 className="c360-hrms-panel-title">Smart Timetable Substitution</h3>
                  <p className="c360-hrms-panel-desc">
                    When a faculty member applies for leave, the system cross-references the master institutional timetable and automatically schedules subject-qualified substitute teachers who have free periods.
                  </p>

                  <div className="c360-hrms-feature-bullets">
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Subject-Affinity Matching:</strong> Prioritizes teachers from the same department so syllabus continuity is never broken.
                      </div>
                    </div>
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Fair Workload Distribution:</strong> Tracks substitute duty counts to ensure equitable period allocation across faculty members.
                      </div>
                    </div>
                    <div className="c360-hrms-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <div>
                        <strong>Instant Mobile Push Alerts:</strong> Teachers receive an instant app alert with room number, syllabus topic, and student roll register.
                      </div>
                    </div>
                  </div>

                  <div className="c360-hrms-actions-row">
                    <a
                      href={hrmsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="c360-btn-primary"
                    >
                      <span>Explore Substitution Engine</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4 Feature Pillars Grid */}
        <div className="c360-hrms-pillars-grid">
          <div className="c360-pillar-card">
            <div className="pillar-icon bg-cyan">
              <Users size={22} />
            </div>
            <h4>Faculty &amp; Staff Directory</h4>
            <p>Comprehensive digital profiles with academic degrees, police verification, contract records, and performance ratings.</p>
            <a href={hrmsUrl} target="_blank" rel="noopener noreferrer" className="pillar-link">
              <span>Directory Portal</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="c360-pillar-card">
            <div className="pillar-icon bg-emerald">
              <DollarSign size={22} />
            </div>
            <h4>Payroll &amp; 7th Pay Scales</h4>
            <p>Automated salary generation, EPF compliance, bank transfer rosters, and tax deduction certificates.</p>
            <a href={hrmsUrl} target="_blank" rel="noopener noreferrer" className="pillar-link">
              <span>Payroll Specs</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="c360-pillar-card">
            <div className="pillar-icon bg-blue">
              <CalendarCheck size={22} />
            </div>
            <h4>Multi-Tier Leave Workflow</h4>
            <p>Casual, medical, maternity, and study leave applications with automated balance tracking and principal approval.</p>
            <a href={hrmsUrl} target="_blank" rel="noopener noreferrer" className="pillar-link">
              <span>Leave Engine</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="c360-pillar-card">
            <div className="pillar-icon bg-purple">
              <Award size={22} />
            </div>
            <h4>Teacher Recruitment &amp; ATS</h4>
            <p>Streamlined teacher hiring pipelines: online job applications, demo lecture scoring, and digital appointment letters.</p>
            <a href={hrmsUrl} target="_blank" rel="noopener noreferrer" className="pillar-link">
              <span>Hiring Pipeline</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Bottom Institutional Assurance Banner */}
        <div className="c360-hrms-banner">
          <div className="c360-hrms-banner-text">
            <h3>Modernize your school’s human resource management today</h3>
            <p>Directly integrated with the AttendoSchool student attendance and timetable network.</p>
          </div>
          <div className="c360-hrms-banner-actions">
            <a
              href={hrmsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="c360-btn-white"
            >
              <Briefcase size={15} />
              <span>Visit hrms.attendoschool.online</span>
              <ExternalLink size={14} />
            </a>
            {onScrollToDemo && (
              <button
                type="button"
                className="c360-btn-outline-white"
                onClick={onScrollToDemo}
              >
                <span>Request Guided Demo</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
