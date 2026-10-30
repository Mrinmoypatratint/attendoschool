export function formatDobOnly(val: unknown): string {
  if (!val) return '';
  const s = String(val).trim();
  if (!s || s === '—' || s === 'null' || s === 'undefined') return '';
  // Strip ISO time part (T...) or space-separated time
  const dateOnly = s.split('T')[0].split(' ')[0].trim();
  // If YYYY-MM-DD, convert to standard DD-MM-YYYY
  const ymd = dateOnly.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    return `${ymd[3].padStart(2, '0')}-${ymd[2].padStart(2, '0')}-${ymd[1]}`;
  }
  // If already DD-MM-YYYY
  const dmy = dateOnly.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}-${dmy[3]}`;
  }
  return dateOnly;
}

import { api } from '../api';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatGender } from '../utils/gender';
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
  const [studentData, setStudentData] = useState<StudentHoverData>(student);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStudentData(student);
  }, [student]);

  // When card opens, if essential fields are missing, fetch fresh details
  useEffect(() => {
    if (!isOpen) return;
    const studentId = studentData.id || (studentData as any).student_id || (studentData as any).studentId;
    const isMissingDetails = 
      (!studentData.admission_number && !studentData.admissionNumber && !(studentData as any).admission_no) ||
      (!studentData.email && !studentData.student_email) ||
      (!studentData.gender);

    if (isMissingDetails && studentId) {
      api.get('/people/students/' + studentId).then(({ data }) => {
        if (data) {
          setStudentData(prev => ({ ...prev, ...data }));
        }
      }).catch(() => {
        api.get('/students/' + studentId).then(({ data }) => {
          if (data) {
            setStudentData(prev => ({ ...prev, ...data }));
          }
        }).catch(() => {});
      });
    }
  }, [isOpen, studentData.id, (studentData as any).student_id, (studentData as any).studentId]);

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
  const fullName = String(studentData.name || 'STUDENT').toUpperCase();
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST';

  const roll = studentData.roll_number ?? studentData.rollNumber ?? (studentData as any).roll ?? (studentData as any).roll_no ?? (studentData as any).rollNo ?? '—';
  const adm = studentData.admission_number || studentData.admissionNumber || (studentData as any).admission_no || (studentData as any).admissionNo || (studentData as any).adm_no || (studentData as any).admNo || '—';
  const photo = studentData.photo_url || studentData.photoUrl;

  // Class label
  const cNum = Number(studentData.class_number);
  const cId = String(studentData.class_id || '');
  let classStr = 'Class 1';
  if (cNum === -1 || /l.?kg/i.test(cId)) classStr = 'L-KG';
  else if (cNum === 0 || /u.?kg/i.test(cId)) classStr = 'U-KG';
  else if (!isNaN(cNum) && cNum > 0) classStr = 'Class ' + cNum;
  else if (studentData.class_label || studentData.class_name || studentData.className) {
    const raw = String(studentData.class_label || studentData.class_name || studentData.className);
    classStr = raw.startsWith('Class') ? raw : ('Class ' + raw);
  }

  // Section label
  const rawSec = String(studentData.section_name || studentData.sectionName || studentData.section || 'A').trim();
  const secStr = rawSec.replace(/^section\s*/i, '').trim() || 'A';

  // Session
  const sessionStr =
    studentData.session ||
    studentData.session_name ||
    studentData.academic_session ||
    studentData.academicSession ||
    activeSession ||
    '2026–2027 Academic Session';

  // Gender & DOB
  const genderStr = formatGender(studentData.gender || (studentData as any).sex) || 'Not Specified';
  const dobRaw = studentData.date_of_birth || studentData.dob || (studentData as any).birth_date || '';
  const dobClean = formatDobOnly(dobRaw);
  const dobStr = dobClean && dobClean !== '—' ? dobClean : null;

  // Emails & parent contact
  const studentEmail = studentData.student_email || studentData.email || (studentData as any).user_email;
  const parentName = studentData.parent_name || studentData.parentName || (studentData as any).father_name || (studentData as any).mother_name || (studentData as any).guardian_name || 'Parent / Guardian';
  const parentPhone = studentData.parent_sms_number || studentData.parent_phone || studentData.parentPhone || (studentData as any).parent_whatsapp || (studentData as any).parent_whatsapp_no || (studentData as any).phone || (studentData as any).father_phone || (studentData as any).mother_phone;
  const parentEmail = studentData.parent_email || studentData.parentEmail;
  const address = studentData.address;

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
                backgroundColor: 'var(--bg-card, #ffffff)',
                borderRadius: 20,
                boxShadow:
                  '0 25px 60px -15px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8), 0 10px 25px -5px rgba(0, 0, 0, 0.06)',
                border: '1px solid var(--border, #e2e8f0)',
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
                        border: '3.5px solid var(--bg-card, #ffffff)',
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
                        border: '2.5px solid var(--bg-card, #ffffff)',
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
                          color: '#3b82f6',
                          backgroundColor: 'rgba(37, 99, 235, 0.12)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          padding: '3px 9px',
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: '0 1px 2px rgba(37, 99, 235, 0.05)'
                        }}
                        title="Student Roll Number"
                      >
                        <Hash size={12} color="#3b82f6" />
                        <span>Roll: {roll}</span>
                      </div>
                    )}
                    {adm !== '—' && (
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 650,
                          color: 'var(--text, #334155)',
                          backgroundColor: 'var(--card-subtle, #f8fafc)',
                          border: '1px solid var(--border, #e2e8f0)',
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
                      color: 'var(--text, #0f172a)',
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
                        color: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        padding: '2px 8px',
                        borderRadius: 6
                      }}
                    >
                      {classStr} • Section {secStr}
                    </span>

                    <span
                      style={{
                        fontSize: 11.5,
                        color: 'var(--text-muted, #64748b)',
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
                      backgroundColor: 'var(--card-subtle, #f8fafc)',
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border, #e2e8f0)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--text-muted, #64748b)',
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
                              ? '#ec4899'
                              : genderStr.toLowerCase() === 'male'
                              ? '#3b82f6'
                              : 'var(--text, #334155)',
                          backgroundColor:
                            genderStr.toLowerCase() === 'female'
                              ? 'rgba(236, 72, 153, 0.12)'
                              : genderStr.toLowerCase() === 'male'
                              ? 'rgba(59, 130, 246, 0.12)'
                              : 'var(--bg-card, #f1f5f9)',
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
                      backgroundColor: 'var(--card-subtle, #f8fafc)',
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border, #e2e8f0)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--text-muted, #64748b)',
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
                        color: dobStr ? 'var(--text, #0f172a)' : 'var(--text-muted, #94a3b8)',
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
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border, #e2e8f0)',
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
                        backgroundColor: 'var(--card-subtle, #f8fafc)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(37, 99, 235, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Mail size={12} color="#3b82f6" />
                        </div>
                        <a
                          href={`mailto:${studentEmail}`}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#3b82f6',
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
                          color: copiedKey === 'student_email' ? '#10b981' : '#94a3b8',
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
                      backgroundColor: 'var(--card-subtle, #f8fafc)'
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(139, 92, 246, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <User size={12} color="#8b5cf6" />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #334155)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-muted, #64748b)' }}>Parent: </span>
                      <b style={{ color: 'var(--text, #0f172a)' }}>{parentName}</b>
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
                        backgroundColor: 'var(--card-subtle, #f8fafc)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Phone size={12} color="#10b981" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          {parentPhone && parentPhone !== '—' && (
                            <a
                              href={`tel:${parentPhone}`}
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#10b981',
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
                                color: 'var(--text-muted, #64748b)',
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
                            color: copiedKey === 'parent_phone' ? '#10b981' : '#94a3b8',
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
                        backgroundColor: 'var(--card-subtle, #f8fafc)'
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <MapPin size={12} color="#f59e0b" />
                      </div>
                      <span
                        style={{
                          fontSize: 11.5,
                          color: 'var(--text-secondary, #475569)',
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
                  backgroundColor: 'var(--card-subtle, #f8fafc)',
                  borderTop: '1px solid var(--border, #e2e8f0)',
                  padding: '9px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'var(--text-muted, #64748b)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontWeight: 700 }}>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: 4.5, color: 'var(--text-muted, #475569)', fontWeight: 600 }}>
                  <ShieldCheck size={13} color="#3b82f6" />
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
