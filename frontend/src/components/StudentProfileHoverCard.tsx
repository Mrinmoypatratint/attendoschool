import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap,
  Mail,
  Phone,
  Calendar,
  MapPin,
  User,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react';

export interface StudentHoverData {
  id?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  roll_number?: string | number;
  rollNumber?: string | number;
  admission_number?: string;
  admissionNumber?: string;
  class_number?: number | string;
  class_id?: string;
  class_name?: string;
  class_label?: string;
  className?: string;
  section_name?: string;
  sectionName?: string;
  section?: string;
  session?: string;
  session_name?: string;
  academic_year_id?: string;
  academic_session?: string;
  academicSession?: string;
  gender?: string;
  date_of_birth?: string;
  dob?: string;
  student_email?: string;
  email?: string;
  parent_name?: string;
  parentName?: string;
  parent_sms_number?: string;
  parent_phone?: string;
  parentPhone?: string;
  parent_email?: string;
  parentEmail?: string;
  address?: string;
  photo_url?: string;
  photoUrl?: string;
  school_name?: string;
  schoolName?: string;
}

interface StudentProfileHoverCardProps {
  student: StudentHoverData;
  activeSession?: string;
  children: React.ReactNode;
}

export function StudentProfileHoverCard({
  student,
  activeSession,
  children
}: StudentProfileHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  // Close when pressing Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Derived student attributes
  const fullName = student.name || 'Student';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST';

  const roll = student.roll_number ?? student.rollNumber ?? '—';
  const adm = student.admission_number || student.admissionNumber || '—';
  const photo = student.photo_url || student.photoUrl;

  // Class label
  const cNum = Number(student.class_number);
  const cId = String(student.class_id || '');
  let classStr = 'Class 1';
  if (cNum === -1 || /l.?kg/i.test(cId)) classStr = 'L-KG';
  else if (cNum === 0 || /u.?kg/i.test(cId)) classStr = 'U-KG';
  else if (!isNaN(cNum) && cNum > 0) classStr = `Class ${cNum}`;
  else if (student.class_label || student.class_name || student.className) {
    const raw = String(student.class_label || student.class_name || student.className);
    classStr = raw.startsWith('Class') ? raw : `Class ${raw}`;
  }

  // Section label
  const rawSec = String(student.section_name || student.sectionName || student.section || 'A').trim();
  const secStr = rawSec.replace(/^section\s*/i, '').trim() || 'A';

  // Session
  const sessionStr =
    student.session ||
    student.session_name ||
    student.academic_session ||
    student.academicSession ||
    activeSession ||
    '2025–2026 Academic Session';

  // Gender & DOB
  const genderStr = student.gender && student.gender.trim() ? student.gender : 'Not Specified';
  const dobStr = student.date_of_birth || student.dob || '—';

  // Emails & parent contact
  const studentEmail = student.student_email || student.email;
  const parentName = student.parent_name || student.parentName || 'Parent / Guardian';
  const parentPhone = student.parent_sms_number || student.parent_phone || student.parentPhone || '—';
  const parentEmail = student.parent_email || student.parentEmail;
  const address = student.address;

  return (
    <>
      <span
        ref={triggerRef}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e as any);
          }
        }}
        role="button"
        tabIndex={0}
        title="Click to view student quick profile"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          borderRadius: 4,
          padding: '2px 4px',
          margin: '-2px -4px',
          color: 'var(--text, #1e293b)',
          textDecoration: 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#2563eb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text, #1e293b)';
        }}
        className="student-name-click-trigger"
      >
        {children}
      </span>

      {isOpen &&
        createPortal(
          <div
            className="student-profile-backdrop"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
          >
            <div
              ref={cardRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 420,
                backgroundColor: '#ffffff',
                borderRadius: 16,
                boxShadow:
                  '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(203, 213, 225, 0.9)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                zIndex: 100000,
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                animation: 'studentProfileCardPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: 'auto'
              }}
            >
            {/* Header Gradient Banner */}
            <div
              style={{
                height: 52,
                background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px'
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#eff6ff',
                  letterSpacing: '0.02em',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(4px)',
                  padding: '3px 8px',
                  borderRadius: 999
                }}
              >
                <GraduationCap size={12} />
                <span>Student Profile</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    color: '#dbeafe',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Sparkles size={11} color="#93c5fd" />
                  <span>Active SIS</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  title="Close profile"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    padding: 0
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.35)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Profile Avatar & Hero Section */}
            <div style={{ padding: '0 14px 10px 14px', position: 'relative' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  marginTop: -28,
                  marginBottom: 10
                }}
              >
                {/* Blue Avatar with Initials / Photo */}
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    border: '3px solid #ffffff',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
                    backgroundColor: '#2563eb',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 20,
                    letterSpacing: '0.02em',
                    overflow: 'hidden',
                    position: 'relative',
                    flexShrink: 0
                  }}
                >
                  <span style={{ position: 'absolute', userSelect: 'none' }}>{initials}</span>
                  {photo && (
                    <img
                      src={photo}
                      alt={fullName}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: 'relative',
                        zIndex: 1
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>

                {/* Roll & Adm Badges */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#1d4ed8',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontFamily: 'monospace'
                    }}
                    title="Student Roll Number"
                  >
                    Roll: {roll}
                  </div>
                  {adm !== '—' && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#475569',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        padding: '2px 7px',
                        borderRadius: 6,
                        fontFamily: 'monospace'
                      }}
                      title="Admission Number"
                    >
                      {adm}
                    </div>
                  )}
                </div>
              </div>

              {/* Student Name */}
              <div style={{ marginBottom: 4 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15.5,
                    fontWeight: 700,
                    color: '#0f172a',
                    lineHeight: 1.2
                  }}
                >
                  {fullName}
                </h3>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#2563eb',
                    marginTop: 2
                  }}
                >
                  {classStr} • Section {secStr}
                </div>
              </div>

              {/* Session Tag */}
              <div
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Calendar size={11.5} color="#94a3b8" />
                <span>{sessionStr}</span>
              </div>

              {/* Divider */}
              <div style={{ height: 1, backgroundColor: '#f1f5f9', margin: '8px 0' }} />

              {/* Personal Details 2-Column Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px 10px',
                  backgroundColor: '#f8fafc',
                  padding: '9px 11px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  marginBottom: 10
                }}
              >
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Gender
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: genderStr === 'Female' ? '#ec4899' : genderStr === 'Male' ? '#0284c7' : '#334155',
                      marginTop: 1
                    }}
                  >
                    {genderStr}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Date of Birth
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', marginTop: 1 }}>
                    {dobStr}
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div style={{ display: 'grid', gap: 6, fontSize: 11.5, color: '#334155' }}>
                {studentEmail && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                    <Mail size={13} color="#2563eb" style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        color: '#0f172a'
                      }}
                      title={studentEmail}
                    >
                      {studentEmail}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                  <User size={13} color="#64748b" style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Parent: <b>{parentName}</b>
                  </span>
                </div>

                {parentPhone && parentPhone !== '—' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Phone size={13} color="#16a34a" style={{ flexShrink: 0 }} />
                    <code
                      style={{
                        fontSize: 11,
                        background: '#f1f5f9',
                        padding: '1px 5px',
                        borderRadius: 4,
                        color: '#0f172a'
                      }}
                    >
                      {parentPhone}
                    </code>
                    {parentEmail && (
                      <span style={{ fontSize: 10.5, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        • {parentEmail}
                      </span>
                    )}
                  </div>
                )}

                {address && address.trim() && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <MapPin size={13} color="#ea580c" style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        color: '#475569'
                      }}
                      title={address}
                    >
                      {address}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Status Stripe */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 10.5,
                color: '#64748b'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a', fontWeight: 600 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#16a34a',
                    display: 'inline-block'
                  }}
                />
                Enrolled Student
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
                <ShieldCheck size={12} color="#2563eb" />
                <span>Verified Record</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default StudentProfileHoverCard;
