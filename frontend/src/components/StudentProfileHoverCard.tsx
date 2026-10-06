import React, { useState, useRef, useEffect } from 'react';
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
  X,
  Copy,
  Check,
  Hash,
  Cake,
  ExternalLink
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  const handleCopy = (text: string, key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
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
  const rawGender = student.gender ? student.gender.trim() : '';
  const genderStr = rawGender || 'Not Specified';
  const dobRaw = student.date_of_birth || student.dob || '';
  const dobStr = dobRaw && dobRaw !== '—' ? dobRaw : null;

  // Emails & parent contact
  const studentEmail = student.student_email || student.email;
  const parentName = student.parent_name || student.parentName || 'Parent / Guardian';
  const parentPhone = student.parent_sms_number || student.parent_phone || student.parentPhone;
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
          borderRadius: 6,
          padding: '2px 6px',
          margin: '-2px -6px',
          color: 'var(--text, #1e293b)',
          textDecoration: 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#2563eb';
          e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text, #1e293b)';
          e.currentTarget.style.backgroundColor = 'transparent';
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
              backgroundColor: 'rgba(15, 23, 42, 0.52)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
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
                maxWidth: 440,
                backgroundColor: '#ffffff',
                borderRadius: 20,
                boxShadow:
                  '0 25px 60px -15px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8), 0 10px 25px -5px rgba(0, 0, 0, 0.06)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                zIndex: 100000,
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                animation: 'studentProfileCardPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: 'auto',
                position: 'relative'
              }}
            >
              {/* Header Gradient Banner with Ambient Glow Orbs */}
              <div
                style={{
                  height: 74,
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #4f46e5 100%)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '14px 16px 0 16px',
                  overflow: 'hidden'
                }}
              >
                {/* Ambient Decorative Lighting */}
                <div
                  style={{
                    position: 'absolute',
                    top: -30,
                    right: 40,
                    width: 140,
                    height: 140,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.22) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: -20,
                    left: 80,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(147, 197, 253, 0.2) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }}
                />

                {/* Left Badge: Student Profile */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '0.02em',
                    background: 'rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    padding: '4px 10px',
                    borderRadius: 999,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <GraduationCap size={13} />
                  <span>Student Profile</span>
                </div>

                {/* Right Controls: Active SIS Status + Close Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#eff6ff',
                      fontWeight: 650,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'rgba(255, 255, 255, 0.16)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      padding: '4px 9px',
                      borderRadius: 999
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: '#34d399',
                        boxShadow: '0 0 6px #34d399',
                        display: 'inline-block'
                      }}
                    />
                    <span>Active SIS</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                    }}
                    title="Close profile (Esc)"
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '50%',
                      width: 26,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      padding: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.35)';
                      e.currentTarget.style.transform = 'scale(1.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Profile Avatar & Hero Section */}
              <div style={{ padding: '0 18px 14px 18px', position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    marginTop: -34,
                    marginBottom: 12
                  }}
                >
                  {/* Avatar Container with Multi-layer Shadow & Online Badge */}
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        width: 66,
                        height: 66,
                        borderRadius: '50%',
                        border: '3.5px solid #ffffff',
                        boxShadow: '0 8px 22px -3px rgba(37, 99, 235, 0.35), 0 2px 6px rgba(0, 0, 0, 0.08)',
                        backgroundColor: '#2563eb',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #1d4ed8 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 22,
                        letterSpacing: '0.04em',
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
                    {/* Active Status Badge on Avatar */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        border: '2.5px solid #ffffff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                      }}
                      title="Enrolled & Active"
                    />
                  </div>

                  {/* Roll & Admission ID Micro-Badges */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {roll !== '—' && (
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 750,
                          color: '#1d4ed8',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '3px 9px',
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: '0 1px 2px rgba(37, 99, 235, 0.05)'
                        }}
                        title="Student Roll Number"
                      >
                        <Hash size={12} color="#2563eb" />
                        <span>Roll: {roll}</span>
                      </div>
                    )}
                    {adm !== '—' && (
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 650,
                          color: '#334155',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '3px 9px',
                          borderRadius: 8,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          letterSpacing: '-0.01em',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                        }}
                        title="Official Student Admission ID"
                      >
                        {adm}
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Full Name & Academic Grouping */}
                <div style={{ marginBottom: 10 }}>
                  <h3
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#0f172a',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.25
                    }}
                  >
                    {fullName}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#4338ca',
                        backgroundColor: '#eef2ff',
                        border: '1px solid #c7d2fe',
                        padding: '2px 8px',
                        borderRadius: 6
                      }}
                    >
                      {classStr} • Section {secStr}
                    </span>

                    <span
                      style={{
                        fontSize: 11.5,
                        color: '#64748b',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Calendar size={12} color="#94a3b8" />
                      <span>{sessionStr}</span>
                    </span>
                  </div>
                </div>

                {/* Quick Attributes 2-Column Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginBottom: 12
                  }}
                >
                  {/* Gender Card */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      Gender
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            genderStr.toLowerCase() === 'female'
                              ? '#be185d'
                              : genderStr.toLowerCase() === 'male'
                              ? '#0284c7'
                              : '#334155',
                          backgroundColor:
                            genderStr.toLowerCase() === 'female'
                              ? '#fdf2f8'
                              : genderStr.toLowerCase() === 'male'
                              ? '#f0f9ff'
                              : '#f1f5f9',
                          padding: '1px 6px',
                          borderRadius: 4,
                          display: 'inline-block'
                        }}
                      >
                        {genderStr}
                      </span>
                    </div>
                  </div>

                  {/* Date of Birth Card */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Cake size={10} color="#94a3b8" />
                      <span>Date of Birth</span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: dobStr ? 650 : 500,
                        color: dobStr ? '#0f172a' : '#94a3b8',
                        fontStyle: dobStr ? 'normal' : 'italic',
                        marginTop: 2
                      }}
                    >
                      {dobStr || 'Not Recorded'}
                    </div>
                  </div>
                </div>

                {/* Contact & Family Information Cards */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '8px 10px',
                    display: 'grid',
                    gap: 6
                  }}
                >
                  {/* Student Email */}
                  {studentEmail && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px',
                        borderRadius: 6,
                        backgroundColor: '#f8fafc'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: '#eff6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Mail size={12} color="#2563eb" />
                        </div>
                        <a
                          href={`mailto:${studentEmail}`}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#1d4ed8',
                            textDecoration: 'none',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap'
                          }}
                          title={`Email student: ${studentEmail}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {studentEmail}
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleCopy(studentEmail, 'student_email', e)}
                        title="Copy student email"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 3,
                          color: copiedKey === 'student_email' ? '#16a34a' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {copiedKey === 'student_email' ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}

                  {/* Parent / Guardian Name */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 6px',
                      borderRadius: 6,
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        backgroundColor: '#f5f3ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <User size={12} color="#7c3aed" />
                    </div>
                    <div style={{ fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#64748b' }}>Parent: </span>
                      <b style={{ color: '#0f172a' }}>{parentName}</b>
                    </div>
                  </div>

                  {/* Parent Phone & Email */}
                  {((parentPhone && parentPhone !== '—') || parentEmail) && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px',
                        borderRadius: 6,
                        backgroundColor: '#f8fafc'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: '#f0fdf4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Phone size={12} color="#16a34a" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          {parentPhone && parentPhone !== '—' && (
                            <a
                              href={`tel:${parentPhone}`}
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#15803d',
                                textDecoration: 'none',
                                fontFamily: 'ui-monospace, SFMono-Regular, monospace'
                              }}
                              title={`Call parent: ${parentPhone}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {parentPhone}
                            </a>
                          )}
                          {parentEmail && (
                            <span
                              style={{
                                fontSize: 11,
                                color: '#64748b',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={parentEmail}
                            >
                              • {parentEmail}
                            </span>
                          )}
                        </div>
                      </div>

                      {parentPhone && parentPhone !== '—' && (
                        <button
                          type="button"
                          onClick={(e) => handleCopy(parentPhone, 'parent_phone', e)}
                          title="Copy parent phone number"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 3,
                            color: copiedKey === 'parent_phone' ? '#16a34a' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          {copiedKey === 'parent_phone' ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Address (if present) */}
                  {address && address.trim() && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 6px',
                        borderRadius: 6,
                        backgroundColor: '#f8fafc'
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          backgroundColor: '#fffbeb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <MapPin size={12} color="#d97706" />
                      </div>
                      <span
                        style={{
                          fontSize: 11.5,
                          color: '#475569',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={address}
                      >
                        {address}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Premium Status Stripe */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  padding: '9px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: '#64748b'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#15803d', fontWeight: 700 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      boxShadow: '0 0 0 2.5px rgba(16, 185, 129, 0.2)',
                      display: 'inline-block'
                    }}
                  />
                  <span>Enrolled Student</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4.5, color: '#475569', fontWeight: 600 }}>
                  <ShieldCheck size={13} color="#2563eb" />
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
