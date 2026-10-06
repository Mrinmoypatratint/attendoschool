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
  const fullName = teacher.name || teacher.full_name || 'Faculty Member';
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
  const dobRaw = teacher.dob || teacher.date_of_birth || '';
  const dobStr = dobRaw && dobRaw !== '—' ? dobRaw : null;
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
          borderRadius: 6,
          padding: '2px 6px',
          margin: '-2px -6px',
          color: 'var(--text, #1e293b)',
          textDecoration: 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#4f46e5';
          e.currentTarget.style.backgroundColor = 'rgba(79, 70, 229, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text, #1e293b)';
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
              {/* Header Gradient Banner with Ambient Glow */}
              <div
                style={{
                  height: 74,
                  background: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 55%, #6366f1 100%)',
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
                    background: 'radial-gradient(circle, rgba(199, 210, 254, 0.2) 0%, transparent 70%)',
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
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
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
                      color: '#e0e7ff',
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
                        border: '3.5px solid #ffffff',
                        boxShadow: '0 8px 22px -3px rgba(79, 70, 229, 0.35), 0 2px 6px rgba(0, 0, 0, 0.08)',
                        backgroundColor: '#4f46e5',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 55%, #3730a3 100%)',
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
                        backgroundColor: isActive ? '#10b981' : '#94a3b8',
                        border: '2.5px solid #ffffff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
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
                        color: '#4338ca',
                        backgroundColor: '#eef2ff',
                        border: '1px solid #c7d2fe',
                        padding: '3px 9px',
                        borderRadius: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 1px 2px rgba(79, 70, 229, 0.05)'
                      }}
                      title="Employee ID / Savior No"
                    >
                      <Hash size={12} color="#4f46e5" />
                      <span>ID: {empId}</span>
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isActive ? '#15803d' : '#64748b',
                        backgroundColor: isActive ? '#f0fdf4' : '#f1f5f9',
                        border: `1px solid ${isActive ? '#bbf7d0' : '#e2e8f0'}`,
                        padding: '3px 8px',
                        borderRadius: 8
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
                        borderRadius: 6,
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
                          color: '#64748b',
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Award size={12} color="#94a3b8" />
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

                {/* Assigned Routine / Allocations Banner */}
                {routine && routine !== '—' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      backgroundColor: '#faf5ff',
                      border: '1px solid #e9d5ff',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 12,
                      color: '#6b21a8',
                      marginBottom: 10
                    }}
                  >
                    <BookOpen size={14} color="#9333ea" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700 }}>Assigned Classes: </span>
                      <span style={{ color: '#581c87' }}>{routine}</span>
                    </div>
                  </div>
                )}

                {/* Contact Coordinates Cards */}
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
                  {/* Email */}
                  {email && (
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
                            backgroundColor: '#eef2ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Mail size={12} color="#4f46e5" />
                        </div>
                        <a
                          href={`mailto:${email}`}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#4338ca',
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
                          color: copiedKey === 'email' ? '#16a34a' : '#94a3b8',
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
                        <a
                          href={`tel:${mobile}`}
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#15803d',
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
                          color: copiedKey === 'mobile' ? '#16a34a' : '#94a3b8',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isActive ? '#15803d' : '#64748b', fontWeight: 700 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: isActive ? '#10b981' : '#94a3b8',
                      boxShadow: isActive ? '0 0 0 2.5px rgba(16, 185, 129, 0.2)' : 'none',
                      display: 'inline-block'
                    }}
                  />
                  <span>{isActive ? 'Active Faculty Member' : 'Deactivated Account'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4.5, color: '#475569', fontWeight: 600 }}>
                  <ShieldCheck size={13} color="#4f46e5" />
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
