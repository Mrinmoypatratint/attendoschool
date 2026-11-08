function formatCleanDateOnly(val: unknown): string {
  if (!val) return '';
  const s = String(val).trim();
  if (!s || s === '—' || s === 'null' || s === 'undefined') return '';
  const dateOnly = s.split('T')[0].split(' ')[0].trim();
  const ymd = dateOnly.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    return `${ymd[3].padStart(2, '0')}-${ymd[2].padStart(2, '0')}-${ymd[1]}`;
  }
  const dmy = dateOnly.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}-${dmy[3]}`;
  }
  return dateOnly;
}

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap,
  Mail,
  Phone,
  BookOpen,
  MapPin,
  Briefcase,
  ShieldCheck,
  Sparkles,
  X,
  Award,
  Copy,
  Check,
  Cake,
  Calendar,
  Hash
} from 'lucide-react';

export interface TeacherHoverData {
  id?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  employee_id?: string;
  employeeId?: string;
  savior_no?: string;
  Savior_No?: string;
  designation?: string;
  mobile?: string;
  phone?: string;
  gender?: string;
  dob?: string;
  date_of_birth?: string;
  qualification?: string;
  joining_date?: string;
  joiningDate?: string;
  address?: string;
  photo_url?: string;
  photoUrl?: string;
  is_active?: boolean;
  active?: boolean;
  status?: string;
  school_name?: string;
  schoolName?: string;
  allocationsSummary?: string;
}

interface TeacherProfileHoverCardProps {
  teacher: TeacherHoverData;
  allocationsSummary?: string;
  children: React.ReactNode;
}

export function TeacherProfileHoverCard({
  teacher,
  allocationsSummary,
  children
}: TeacherProfileHoverCardProps) {
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

  // Derived teacher attributes
  const fullName = String(teacher.name || teacher.full_name || 'FACULTY MEMBER').toUpperCase();
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TC';

  const empId = teacher.employee_id || teacher.employeeId || teacher.savior_no || teacher.Savior_No || '—';
  const photo = teacher.photo_url || teacher.photoUrl;
  const designation = teacher.designation || 'Teacher';
  const email = teacher.email && teacher.email !== '—' ? teacher.email : null;
  const mobile = teacher.mobile || teacher.phone;
  const genderStr = teacher.gender && teacher.gender.trim() ? teacher.gender : 'Not Specified';
  const joiningDateRaw = teacher.joining_date || teacher.joiningDate || '';
  const joiningDateClean = formatCleanDateOnly(joiningDateRaw);
  const joiningDateStr = joiningDateClean && joiningDateClean !== '—' ? joiningDateClean : null;
  const qualification = teacher.qualification && teacher.qualification.trim() ? teacher.qualification : null;
  const address = teacher.address;
  const isActive = teacher.is_active !== undefined ? teacher.is_active : (teacher.active !== undefined ? teacher.active : teacher.status !== 'INACTIVE');
  const routine = allocationsSummary || teacher.allocationsSummary;

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
        title="Click to view faculty quick profile"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          borderRadius: 4,
          padding: '2px 6px',
          margin: '-2px -6px',
          color: 'var(--text, #282c3f)',
          textDecoration: 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#e11d55';
          e.currentTarget.style.backgroundColor = 'rgba(225, 29, 85, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text, #282c3f)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        className="teacher-name-click-trigger"
      >
        {children}
      </span>

      {isOpen &&
        createPortal(
          <div
            className="teacher-profile-backdrop"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              backgroundColor: 'rgba(28, 31, 46, 0.52)',
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
                borderRadius: 4,
                boxShadow:
                  'none',
                border: '1px solid var(--border, #eaeaec)',
                overflow: 'hidden',
                zIndex: 100000,
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                animation: 'studentProfileCardPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: 'auto',
                position: 'relative'
              }}
            >
              {/* Header Gradient Banner with Ambient Glow */}
              <div
                style={{
                  height: 74,
                  background: '#9a133c',
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
                    background: 'transparent',
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
                    background: 'transparent',
                    pointerEvents: 'none'
                  }}
                />

                {/* Left Badge: Faculty Profile */}
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
                    boxShadow: 'none'
                  }}
                >
                  <Briefcase size={13} />
                  <span>Faculty Profile</span>
                </div>

                {/* Right Controls: Faculty SIS + Close Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#ffe1e8',
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
                        backgroundColor: '#339988',
                        boxShadow: 'none',
                        display: 'inline-block'
                      }}
                    />
                    <span>Faculty SIS</span>
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
                  {/* Avatar Container with Multi-layer Shadow & Status Dot */}
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        width: 66,
                        height: 66,
                        borderRadius: '50%',
                        border: '3.5px solid var(--bg-card, #ffffff)',
                        boxShadow: 'none',
                        backgroundColor: '#e11d55',
                        background: '#e11d55',
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
                        backgroundColor: isActive ? '#03806a' : '#94969f',
                        border: '2.5px solid var(--bg-card, #ffffff)',
                        boxShadow: 'none'
                      }}
                      title={isActive ? 'Active Faculty' : 'Inactive'}
                    />
                  </div>

                  {/* ID & Status Micro-Badges */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 750,
                        color: '#c0174a',
                        backgroundColor: 'rgba(225, 29, 85, 0.15)',
                        border: '1px solid rgba(225, 29, 85, 0.3)',
                        padding: '3px 9px',
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: 'none'
                      }}
                      title="Employee ID / Savior No"
                    >
                      <Hash size={12} color="#ef5a85" />
                      <span>ID: {empId}</span>
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isActive ? '#339988' : 'var(--text-muted, #696e79)',
                        backgroundColor: isActive ? 'rgba(3, 128, 106, 0.15)' : 'var(--card-subtle, #f5f5f6)',
                        border: `1px solid ${isActive ? 'rgba(3, 128, 106, 0.3)' : 'var(--border, #eaeaec)'}`,
                        padding: '3px 8px',
                        borderRadius: 4
                      }}
                      title="Faculty Account Status"
                    >
                      {isActive ? 'ACTIVE' : 'INACTIVE'}
                    </div>
                  </div>
                </div>

                {/* Teacher Full Name & Designation */}
                <div style={{ marginBottom: 10 }}>
                  <h3
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: 18,
                      fontWeight: 800,
                      color: 'var(--text, #1c1f2e)',
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
                        color: '#e11d55',
                        backgroundColor: 'rgba(225, 29, 85, 0.14)',
                        border: '1px solid rgba(225, 29, 85, 0.3)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <GraduationCap size={13} />
                      <span>{designation}</span>
                    </span>

                    {qualification && (
                      <span
                        style={{
                          fontSize: 11.5,
                          color: '#696e79',
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Award size={12} color="#94969f" />
                        <span>{qualification}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Attributes 2-Column Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginBottom: 10
                  }}
                >
                  {/* Gender Card */}
                  <div
                    style={{
                      backgroundColor: 'var(--card-subtle, #f9f9fa)',
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: '1px solid var(--border, #eaeaec)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--text-muted, #696e79)',
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
                              ? '#ef5a85'
                              : genderStr.toLowerCase() === 'male'
                              ? '#7f8ccd'
                              : 'var(--text, #3e4152)',
                          backgroundColor:
                            genderStr.toLowerCase() === 'female'
                              ? 'rgba(225, 29, 85, 0.15)'
                              : genderStr.toLowerCase() === 'male'
                              ? 'rgba(92, 107, 192, 0.15)'
                              : 'var(--card-subtle, #f5f5f6)',
                          padding: '1px 6px',
                          borderRadius: 4,
                          display: 'inline-block'
                        }}
                      >
                        {genderStr}
                      </span>
                    </div>
                  </div>

                  {/* Joining Date Card */}
                  <div
                    style={{
                      backgroundColor: 'var(--card-subtle, #f9f9fa)',
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: '1px solid var(--border, #eaeaec)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--text-muted, #696e79)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Calendar size={10} color="#94969f" />
                      <span>Joining Date</span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: joiningDateStr ? 650 : 500,
                        color: joiningDateStr ? 'var(--text, #1c1f2e)' : 'var(--text-muted, #94969f)',
                        fontStyle: joiningDateStr ? 'normal' : 'italic',
                        marginTop: 2
                      }}
                    >
                      {joiningDateStr || 'Not Recorded'}
                    </div>
                  </div>
                </div>

                {/* Assigned Routine / Allocations Banner */}
                {routine && routine !== '—' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      backgroundColor: 'rgba(92, 107, 192, 0.12)',
                      border: '1px solid rgba(92, 107, 192, 0.25)',
                      borderRadius: 4,
                      padding: '8px 12px',
                      fontSize: 12,
                      color: '#7f8ccd',
                      marginBottom: 10
                    }}
                  >
                    <BookOpen size={14} color="#5c6bc0" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700 }}>Assigned Classes: </span>
                      <span style={{ color: '#a3abda' }}>{routine}</span>
                    </div>
                  </div>
                )}

                {/* Contact Coordinates Cards */}
                <div
                  style={{
                    backgroundColor: 'var(--card-subtle, #ffffff)',
                    border: '1px solid var(--border, #eaeaec)',
                    borderRadius: 4,
                    padding: '8px 10px',
                    display: 'grid',
                    gap: 6
                  }}
                >
                  {/* Email */}
                  {email && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px',
                        borderRadius: 4,
                        backgroundColor: 'var(--bg-card, #f9f9fa)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(225, 29, 85, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Mail size={12} color="#ef5a85" />
                        </div>
                        <a
                          href={`mailto:${email}`}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--sidebar-accent, #c0174a)',
                            textDecoration: 'none',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap'
                          }}
                          title={`Email faculty: ${email}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {email}
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleCopy(email, 'email', e)}
                        title="Copy email"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 3,
                          color: copiedKey === 'email' ? '#03806a' : 'var(--text-muted, #94969f)',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {copiedKey === 'email' ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}

                  {/* Mobile Phone */}
                  {mobile && mobile !== '—' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px',
                        borderRadius: 4,
                        backgroundColor: 'var(--bg-card, #f9f9fa)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(3, 128, 106, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Phone size={12} color="#03806a" />
                        </div>
                        <a
                          href={`tel:${mobile}`}
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#339988',
                            textDecoration: 'none',
                            fontFamily: 'ui-monospace, SFMono-Regular, monospace'
                          }}
                          title={`Call faculty: ${mobile}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {mobile}
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleCopy(mobile, 'mobile', e)}
                        title="Copy phone number"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 3,
                          color: copiedKey === 'mobile' ? '#03806a' : 'var(--text-muted, #94969f)',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {copiedKey === 'mobile' ? <Check size={12} /> : <Copy size={12} />}
                      </button>
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
                        borderRadius: 4,
                        backgroundColor: 'var(--bg-card, #f9f9fa)'
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(233, 162, 59, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <MapPin size={12} color="#e9a23b" />
                      </div>
                      <span
                        style={{
                          fontSize: 11.5,
                          color: 'var(--text-secondary, #535766)',
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
                  backgroundColor: 'var(--card-subtle, #f9f9fa)',
                  borderTop: '1px solid var(--border, #eaeaec)',
                  padding: '9px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'var(--text-muted, #696e79)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isActive ? '#02604f' : '#696e79', fontWeight: 700 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: isActive ? '#03806a' : '#94969f',
                      boxShadow: isActive ? '0 0 0 2.5px rgba(3, 128, 106, 0.2)' : 'none',
                      display: 'inline-block'
                    }}
                  />
                  <span>{isActive ? 'Active Faculty Member' : 'Deactivated Account'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4.5, color: '#535766', fontWeight: 600 }}>
                  <ShieldCheck size={13} color="#e11d55" />
                  <span>Verified Staff Record</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default TeacherProfileHoverCard;
