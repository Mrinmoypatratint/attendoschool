import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, ArrowLeft, CheckCircle2, ShieldCheck, School, Users, Camera, Trash2, Loader2, AlertCircle, Edit3, Save, X, Clock, Calendar, Globe, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, StudentProfile as IStudentProfile } from '../../services/studentApi';
import { useAuth } from '../../hooks/useAuth';
import { validatePassword } from '../../utils/passwordPolicy';
import { formatGender } from '../../utils/gender';

function isValidDdMmYyyy(val: string): boolean {
  if (!val) return false;
  const s = val.trim();
  const match4 = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const match2 = s.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (!match4 && !match2) return false;

  const day = parseInt(match4 ? match4[1] : match2![1], 10);
  const month = parseInt(match4 ? match4[2] : match2![2], 10);
  const rawYear = parseInt(match4 ? match4[3] : match2![3], 10);
  const year = match2 ? (rawYear <= 40 ? 2000 + rawYear : 1900 + rawYear) : rawYear;

  if (day < 1 || day > 31) return false;
  if (month < 1 || month > 12) return false;
  const currentYear = new Date().getFullYear();
  if (year < 1920 || year > currentYear) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

function toDdMmYyyy(val: any): string {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
  const twoDigitMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (twoDigitMatch) {
    const yy = parseInt(twoDigitMatch[3], 10);
    const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
    return `${twoDigitMatch[1].padStart(2, '0')}-${twoDigitMatch[2].padStart(2, '0')}-${fullYear}`;
  }
  const altMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (altMatch) {
    return `${altMatch[1].padStart(2, '0')}-${altMatch[2].padStart(2, '0')}-${altMatch[3]}`;
  }
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}-${isoMatch[2].padStart(2, '0')}-${isoMatch[1]}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return s;
}

/**
 * Strict DD-MM-YYYY formatter:
 * - Day cannot exceed 31
 * - Month cannot exceed 12
 * - Automatically inserts hyphen separator after day and month
 * - Handles backspacing cleanly without separator lock
 */
function formatDobInput(rawVal: string, prevVal: string): string {
  const isDeleting = rawVal.length < prevVal.length;
  const digits = rawVal.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';

  let dayPart = '';
  let monthPart = '';
  let yearPart = '';

  // 1. DAY FORMATTING
  if (digits.length === 1) {
    // If first digit > 3 (4-9), auto-prefix with 0: e.g. typing '5' -> '05-'
    if (digits[0] > '3' && !isDeleting) {
      dayPart = `0${digits[0]}`;
      return `${dayPart}-`;
    }
    return digits;
  }

  // 2 or more day digits: clamp day <= 31
  const rawDay = parseInt(digits.slice(0, 2), 10);
  if (rawDay > 31) {
    dayPart = '31';
  } else if (digits.slice(0, 2) === '00') {
    dayPart = '01';
  } else {
    dayPart = digits.slice(0, 2);
  }

  if (digits.length === 2) {
    return isDeleting ? dayPart : `${dayPart}-`;
  }

  // 2. MONTH FORMATTING
  const remAfterDay = digits.slice(2);
  if (remAfterDay.length === 1) {
    // If first digit of month > 1 (2-9), auto-prefix with 0: e.g. typing '6' -> '06-'
    if (remAfterDay[0] > '1' && !isDeleting) {
      monthPart = `0${remAfterDay[0]}`;
      return `${dayPart}-${monthPart}-`;
    }
    return `${dayPart}-${remAfterDay}`;
  }

  // 2 or more month digits: clamp month <= 12
  const rawMonth = parseInt(remAfterDay.slice(0, 2), 10);
  if (rawMonth > 12) {
    monthPart = '12';
  } else if (remAfterDay.slice(0, 2) === '00') {
    monthPart = '01';
  } else {
    monthPart = remAfterDay.slice(0, 2);
  }

  if (remAfterDay.length === 2) {
    return isDeleting ? `${dayPart}-${monthPart}` : `${dayPart}-${monthPart}-`;
  }

  // 3. YEAR FORMATTING (up to 4 digits)
  yearPart = remAfterDay.slice(2, 6);
  return `${dayPart}-${monthPart}-${yearPart}`;
}

export function StudentProfile() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<IStudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittingPw, setSubmittingPw] = useState(false);

  // Profile details editing state
  const [editingDetails, setEditingDetails] = useState(false);
  const [editGender, setEditGender] = useState('');
  const [editDob, setEditDob] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    studentApi
      .getProfile()
      .then((res) => {
        setProfile(res);
        setEditGender(formatGender(res?.gender) || '');
        setEditDob(toDdMmYyyy(res?.dateOfBirth));
        if (res?.photoUrl) {
          updateUser({ photoUrl: res.photoUrl, avatarUrl: res.photoUrl, photo_url: res.photoUrl });
          window.dispatchEvent(new CustomEvent('student-photo-updated', { detail: { photoUrl: res.photoUrl } }));
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
    const handleProfileUpdated = (e: any) => {
      if (e.detail?.website !== undefined) {
        setProfile((prev: IStudentProfile | null) => prev ? { ...prev, schoolWebsite: e.detail.website, school_website: e.detail.website, website: e.detail.website } : prev);
      }
    };
    window.addEventListener('school-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('school-profile-updated', handleProfileUpdated);
  }, [updateUser]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsMsg(null);

    const cleanDob = editDob.trim();
    if (cleanDob && !isValidDdMmYyyy(cleanDob)) {
      setDetailsMsg({
        type: 'error',
        text: 'Invalid Date of Birth. Please enter a valid date strictly in DD-MM-YYYY format (Day: 01–31, Month: 01–12).'
      });
      return;
    }

    const normalizedDob = toDdMmYyyy(cleanDob);
    setSavingDetails(true);
    try {
      await studentApi.updateProfile({ gender: editGender, dateOfBirth: normalizedDob });
      setProfile((prev) => prev ? { ...prev, gender: editGender, dateOfBirth: normalizedDob } : null);
      setEditDob(normalizedDob);
      setDetailsMsg({ type: 'success', text: 'Personal details updated successfully!' });
      setEditingDetails(false);
    } catch (err: any) {
      setDetailsMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to update details.' });
    } finally {
      setSavingDetails(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoMsg({ type: 'error', text: 'Please select a valid image file (PNG, JPG, WebP).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoMsg({ type: 'error', text: 'Image file size must be less than 5MB.' });
      return;
    }

    setPhotoMsg(null);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        setUploadingPhoto(true);
        try {
          const res = await studentApi.updatePhoto(compressedDataUrl);
          setProfile((prev) => prev ? {
            ...prev,
            pendingPhotoUrl: compressedDataUrl,
            hasPendingPhotoApproval: true,
            photoApprovalStatus: 'PENDING',
            photoRejectionReason: null
          } : null);
          setPhotoMsg({
            type: 'success',
            text: res.message || 'Photo submitted for review! It will appear on your profile once approved by the administrator.'
          });
        } catch (err: any) {
          setPhotoMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to submit picture for review.' });
        } finally {
          setUploadingPhoto(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      img.src = uploadEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    setPhotoMsg(null);
    setUploadingPhoto(true);
    try {
      await studentApi.updatePhoto('');
      setProfile((prev) => prev ? {
        ...prev,
        photoUrl: '',
        pendingPhotoUrl: null,
        hasPendingPhotoApproval: false,
        photoApprovalStatus: 'NONE',
        photoRejectionReason: null
      } : null);
      updateUser({ photoUrl: undefined, avatarUrl: undefined, photo_url: undefined });
      window.dispatchEvent(new CustomEvent('student-photo-updated', { detail: { photoUrl: '' } }));
      setPhotoMsg({ type: 'success', text: 'Profile picture removed.' });
    } catch (err: any) {
      setPhotoMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to remove picture.' });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);

    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      setPwMsg({ type: 'error', text: pwCheck.message || 'Password must meet complexity requirements.' });
      return;
    }

    setSubmittingPw(true);
    try {
      const res = await studentApi.changePassword(currentPassword, newPassword);
      setPwMsg({ type: 'success', text: res.message || 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwMsg({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to change password. Verify current password.'
      });
    } finally {
      setSubmittingPw(false);
    }
  };

  if (loading) {
    return <div className="student-loading-spinner">Loading student profile...</div>;
  }

  // Safeguard: Ensure email never shows @greenwood.local for TINT or non-Greenwood schools
  const displayEmail = (() => {
    const rawEmail = profile?.email || user?.email || '';
    const schoolStr = `${profile?.schoolName || ''} ${user?.schoolName || ''}`.toLowerCase();
    const isTint = schoolStr.includes('techno') || schoolStr.includes('tint');

    if (isTint && rawEmail.toLowerCase().includes('greenwood.local')) {
      return (user?.email && !user.email.toLowerCase().includes('greenwood.local'))
        ? user.email
        : 'dhardhuran689@gmail.com';
    }
    return rawEmail || '—';
  })();

  return (
    <div className="student-subpage">
      <div className="student-subpage-header">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title">Student Profile & Credentials</h1>
          <p className="student-subpage-desc">
            Personal identity, enrollment records, and account security.
          </p>
        </div>
      </div>

      <div className="student-profile-layout">
        {/* Profile Card Summary */}
        <div className="student-card student-profile-hero-card">
          <div className="student-profile-avatar-large">
            {profile?.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={profile.name}
                className="student-profile-avatar-img"
              />
            ) : (
              <span>{profile?.name?.charAt(0) || 'S'}</span>
            )}
            {uploadingPhoto && (
              <div className="student-avatar-loading-overlay">
                <Loader2 size={24} className="spin-animate" />
              </div>
            )}
          </div>

          {/* Upload / Change Picture action buttons */}
          <div className="student-avatar-actions">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />
            <button
              type="button"
              className="student-avatar-btn-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              title={profile?.photoUrl ? 'Click to change profile picture' : 'Click to upload picture'}
            >
              <Camera size={14} />
              <span>{profile?.photoUrl ? 'Change Picture' : 'Upload Picture'}</span>
            </button>
            {profile?.photoUrl && (
              <button
                type="button"
                className="student-avatar-btn-remove"
                onClick={handleRemovePhoto}
                disabled={uploadingPhoto}
                title="Remove picture"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {photoMsg && (
            <div className={`student-photo-notice ${photoMsg.type}`}>
              {photoMsg.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              <span>{photoMsg.text}</span>
            </div>
          )}

          {profile?.hasPendingPhotoApproval && (
            <div className="student-profile-pending-banner">
              {profile?.pendingPhotoUrl && (
                <img
                  src={profile.pendingPhotoUrl}
                  alt="Pending submission"
                  style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', border: '2px solid #F59E0B', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} /> Photo Pending Approval
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.95, marginTop: 1 }}>
                  Your uploaded photo is waiting for teacher approval. Once approved, it will automatically become active on your profile.
                </div>
              </div>
            </div>
          )}

          {profile?.photoApprovalStatus === 'REJECTED' && (
            <div className="student-profile-rejected-banner">
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <AlertCircle size={13} /> Photo Declined by Administrator
              </div>
              <div style={{ fontSize: 11.5 }}>
                Reason: "{profile.photoRejectionReason || 'Photo does not meet administrative standards.'}"
              </div>
              <div style={{ fontSize: 11, marginTop: 3 }}>
                Please upload a clear, front-facing passport-style photo.
              </div>
            </div>
          )}

          <h2 className="profile-hero-name">{String(profile?.name || 'STUDENT').toUpperCase()}</h2>
          <p className="profile-hero-role">{profile?.className} - Section {profile?.sectionName}</p>
          <div 
            className="profile-hero-badge"
            onClick={() => {
              const site = profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website;
              if (site) {
                window.open(site, '_blank', 'noopener,noreferrer');
              }
            }}
            style={{ 
              cursor: (profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website) ? 'pointer' : 'default'
            }}
            title={(profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website) ? `Visit Official Website: ${profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website}` : profile?.schoolName}
          >
            <School size={14} />
            <span>{profile?.schoolName}</span>
            {(profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website) && (
              <ExternalLink size={12} style={{ marginLeft: 4, opacity: 0.8 }} />
            )}
          </div>
        </div>

        {/* Academic & Personal Details */}
        <div className="student-card student-profile-details-card">
          <div className="student-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="student-card-title-wrap">
              <User size={18} />
              <h3 className="student-card-title">Academic & Institutional Details</h3>
            </div>
            {!editingDetails && (
              <button
                type="button"
                onClick={() => setEditingDetails(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border, #cbd5e1)',
                  backgroundColor: 'var(--card, #ffffff)',
                  color: 'var(--text, #1e293b)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Edit3 size={13} /> Edit Personal Details
              </button>
            )}
          </div>

          {detailsMsg && (
            <div
              style={{
                marginBottom: 16,
                padding: '8px 14px',
                borderRadius: 6,
                backgroundColor: detailsMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
                border: detailsMsg.type === 'success' ? '1px solid #a7f3d0' : '1px solid #fecaca',
                color: detailsMsg.type === 'success' ? '#065f46' : '#991b1b',
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {detailsMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{detailsMsg.text}</span>
            </div>
          )}

          {editingDetails ? (
            <form onSubmit={handleSaveDetails} style={{ display: 'grid', gap: 14, marginTop: 12 }}>
              <div className="student-edit-grid">
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text, #334155)' }}>
                    Gender:
                  </span>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border-strong, #cbd5e1)',
                      fontSize: 13,
                      outline: 'none',
                      backgroundColor: 'var(--card-bg, #ffffff)',
                      color: 'var(--text, #0f172a)'
                    }}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text, #334155)' }}>
                    Date of Birth:
                  </span>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="DD-MM-YYYY (e.g. 15-06-2008)"
                      maxLength={10}
                      value={editDob}
                      onChange={(e) => {
                        const formatted = formatDobInput(e.target.value, editDob);
                        setEditDob(formatted);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 34px 8px 12px',
                        borderRadius: 6,
                        border: `1px solid ${editDob && !isValidDdMmYyyy(editDob) ? '#ef4444' : 'var(--border-strong, #cbd5e1)'}`,
                        fontSize: 13,
                        outline: 'none',
                        backgroundColor: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #0f172a)',
                        boxSizing: 'border-box'
                      }}
                    />
                    <input
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      title="Choose from calendar picker"
                      style={{
                        position: 'absolute',
                        right: 8,
                        width: 24,
                        height: 24,
                        opacity: 0,
                        cursor: 'pointer',
                        zIndex: 2
                      }}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [y, m, d] = e.target.value.split('-');
                          setEditDob(`${d}-${m}-${y}`);
                        }
                      }}
                    />
                    <Calendar
                      size={16}
                      style={{
                        position: 'absolute',
                        right: 10,
                        color: '#64748b',
                        pointerEvents: 'none'
                      }}
                    />
                  </div>
                  {editDob && !isValidDdMmYyyy(editDob) && (
                    <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                      Strict format required: DD-MM-YYYY (e.g. 15-06-2008)
                    </span>
                  )}
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDetails(false);
                    setEditGender(formatGender(profile?.gender) || '');
                    setEditDob(profile?.dateOfBirth ? toDdMmYyyy(profile.dateOfBirth) : '');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    backgroundColor: 'transparent',
                    color: 'var(--text, #475569)',
                    fontSize: 12.5,
                    cursor: 'pointer'
                  }}
                >
                  <X size={13} /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDetails}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 16px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Save size={13} /> {savingDetails ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="student-details-grid">
              <div className="detail-item">
                <span className="detail-label">Roll Number</span>
                <span className="detail-val">{profile?.rollNumber}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Admission Number</span>
                <span className="detail-val">{profile?.admissionNumber}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Class & Section</span>
                <span className="detail-val">{profile?.className} - Section {profile?.sectionName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Academic Session</span>
                <span className="detail-val">{profile?.academicSession}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Student Email</span>
                <span className="detail-val">{displayEmail}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Date of Birth</span>
                <span className="detail-val">{profile?.dateOfBirth ? toDdMmYyyy(profile.dateOfBirth) : '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Gender</span>
                <span className="detail-val">{formatGender(profile?.gender) || 'Not Specified'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Official School Website</span>
                <span className="detail-val">
                  {(profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website) ? (
                    <a
                      href={profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        color: '#2563eb',
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}
                      title="Open official school website in new tab"
                    >
                      <Globe size={13} />
                      <span style={{ textDecoration: 'underline' }}>{profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website}</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Not Configured</span>
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="student-card-header" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--edu-border, #E2E8F0)' }}>
            <div className="student-card-title-wrap">
              <Users size={18} />
              <h3 className="student-card-title">Parent Contact</h3>
            </div>
          </div>

          <div className="student-details-grid">
            <div className="detail-item">
              <span className="detail-label">Parent Name</span>
              <span className="detail-val">{profile?.parentName}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Emergency SMS Mobile</span>
              <span className="detail-val">{profile?.parentPhone}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Registered Parent Email</span>
              <span className="detail-val">{profile?.parentEmail}</span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="student-card student-profile-security-card">
          <div className="student-card-header">
            <div className="student-card-title-wrap">
              <Lock size={18} />
              <h3 className="student-card-title">Account Security</h3>
            </div>
            <span className="security-tag"><ShieldCheck size={14} /> BCrypt Protected</span>
          </div>

          {pwMsg && (
            <div className={`student-alert-${pwMsg.type}`} style={{ marginBottom: 16 }}>
              {pwMsg.type === 'success' && <CheckCircle2 size={16} />}
              <span>{pwMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="student-form-vertical">
            <label>
              <span>Current Password:</span>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: 38, boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={showCurrentPw ? 'Hide password' : 'Show password'}
                  aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                >
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label>
              <span>New Password:</span>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  placeholder="Enter new strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: 38, boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={showNewPw ? 'Hide password' : 'Show password'}
                  aria-label={showNewPw ? 'Hide password' : 'Show password'}
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #64748B)', marginTop: 4, display: 'block' }}>
                Must be at least 8 characters, with 1 Capital letter, 1 small letter, 1 number, and 1 special character.
              </span>
            </label>

            <label>
              <span>Confirm New Password:</span>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  required
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: 38, boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={showConfirmPw ? 'Hide password' : 'Show password'}
                  aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <button type="submit" disabled={submittingPw} className="student-btn-primary" style={{ marginTop: 8 }}>
              {submittingPw ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
