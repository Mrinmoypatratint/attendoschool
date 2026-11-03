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
    return <div className="student-loading-spinner py-12 text-center text-slate-500 text-sm">Loading student profile...</div>;
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
          <Link to="/student/dashboard" className="student-back-link inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 mb-1">Student Profile &amp; Credentials</h1>
          <p className="student-subpage-desc text-xs text-slate-500 dark:text-slate-400 m-0">
            Personal identity, enrollment records, and account security.
          </p>
        </div>
      </div>

      <div className="student-profile-layout grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card Summary */}
        <div className="student-card student-profile-hero-card rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm flex flex-col items-center text-center">
          <div className="student-profile-avatar-large relative w-24 h-24 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-3xl font-bold border-2 border-slate-200 dark:border-slate-700">
            {profile?.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={profile.name}
                className="student-profile-avatar-img w-full h-full object-cover"
              />
            ) : (
              <span>{profile?.name?.charAt(0) || 'S'}</span>
            )}
            {uploadingPhoto && (
              <div className="student-avatar-loading-overlay absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                <Loader2 size={24} className="animate-spin" />
              </div>
            )}
          </div>

          {/* Upload / Change Picture action buttons */}
          <div className="student-avatar-actions flex items-center gap-2 mt-4">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            <button
              type="button"
              className="student-avatar-btn-upload inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-pointer transition-colors"
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
                className="student-avatar-btn-remove p-1.5 text-xs rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 cursor-pointer transition-colors"
                onClick={handleRemovePhoto}
                disabled={uploadingPhoto}
                title="Remove picture"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {photoMsg && (
            <div className={`student-photo-notice ${photoMsg.type} mt-3 px-3 py-2 rounded-md text-xs flex items-center gap-1.5 ${
              photoMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 border border-red-500/25 text-red-500'
            }`}>
              {photoMsg.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              <span>{photoMsg.text}</span>
            </div>
          )}

          {profile?.hasPendingPhotoApproval && (
            <div className="student-profile-pending-banner mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center gap-3 text-left">
              {profile?.pendingPhotoUrl && (
                <img
                  src={profile.pendingPhotoUrl}
                  alt="Pending submission"
                  className="w-9 h-9 rounded-md object-cover border-2 border-amber-500 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs flex items-center gap-1">
                  <Clock size={13} /> Photo Pending Approval
                </div>
                <div className="text-[11.5px] opacity-90 mt-0.5">
                  Your uploaded photo is waiting for teacher approval. Once approved, it will automatically become active on your profile.
                </div>
              </div>
            </div>
          )}

          {profile?.photoApprovalStatus === 'REJECTED' && (
            <div className="student-profile-rejected-banner mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-left">
              <div className="font-bold text-xs flex items-center gap-1 mb-0.5">
                <AlertCircle size={13} /> Photo Declined by Administrator
              </div>
              <div className="text-[11.5px]">
                Reason: "{profile.photoRejectionReason || 'Photo does not meet administrative standards.'}"
              </div>
              <div className="text-[11px] mt-1 text-slate-500">
                Please upload a clear, front-facing passport-style photo.
              </div>
            </div>
          )}

          <h2 className="profile-hero-name text-lg font-bold text-slate-900 dark:text-slate-100 mt-4 mb-0.5">{profile?.name || 'Student'}</h2>
          <p className="profile-hero-role text-xs text-slate-500 dark:text-slate-400 m-0 mb-3">{profile?.className} - Section {profile?.sectionName}</p>
          <div 
            className="profile-hero-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-semibold"
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
              <ExternalLink size={12} className="ml-1 opacity-80" />
            )}
          </div>
        </div>

        {/* Academic & Personal Details */}
        <div className="student-card student-profile-details-card rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div className="student-card-header flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <div className="student-card-title-wrap flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <User size={18} className="text-blue-600" />
              <h3 className="student-card-title text-base font-bold m-0">Academic &amp; Institutional Details</h3>
            </div>
            {!editingDetails && (
              <button
                type="button"
                onClick={() => setEditingDetails(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                <Edit3 size={13} /> Edit Personal Details
              </button>
            )}
          </div>

          {detailsMsg && (
            <div
              className={`my-3 p-3 rounded-md text-xs flex items-center gap-2 ${
                detailsMsg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/25 text-red-500'
              }`}
            >
              {detailsMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{detailsMsg.text}</span>
            </div>
          )}

          {editingDetails ? (
            <form onSubmit={handleSaveDetails} className="grid gap-3.5 mt-3">
              <div className="student-edit-grid grid grid-cols-1 gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Gender:
                  </span>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Date of Birth:
                  </span>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="DD-MM-YYYY (e.g. 15-06-2008)"
                      maxLength={10}
                      value={editDob}
                      onChange={(e) => {
                        const formatted = formatDobInput(e.target.value, editDob);
                        setEditDob(formatted);
                      }}
                      className={`w-full px-3 py-2 pr-9 rounded-md text-xs outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                        editDob && !isValidDdMmYyyy(editDob)
                          ? 'border border-red-500'
                          : 'border border-slate-300 dark:border-slate-600 focus:ring-1 focus:ring-blue-500'
                      }`}
                    />
                    <input
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      title="Choose from calendar picker"
                      className="absolute right-2 w-6 h-6 opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        if (e.target.value) {
                          const [y, m, d] = e.target.value.split('-');
                          setEditDob(`${d}-${m}-${y}`);
                        }
                      }}
                    />
                    <Calendar
                      size={16}
                      className="absolute right-2.5 text-slate-400 pointer-events-none"
                    />
                  </div>
                  {editDob && !isValidDdMmYyyy(editDob) && (
                    <span className="text-red-500 text-[11px] font-medium mt-0.5">
                      Strict format required: DD-MM-YYYY (e.g. 15-06-2008)
                    </span>
                  )}
                </label>
              </div>

              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDetails(false);
                    setEditGender(formatGender(profile?.gender) || '');
                    setEditDob(profile?.dateOfBirth ? toDdMmYyyy(profile.dateOfBirth) : '');
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent text-slate-600 dark:text-slate-300 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={13} /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDetails}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-white bg-blue-600 hover:bg-blue-700 text-xs font-semibold cursor-pointer disabled:opacity-60 transition-colors shadow-sm"
                >
                  <Save size={13} /> {savingDetails ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="student-details-grid grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3">
              <div className="detail-item">
                <span className="detail-label block text-[11px] font-medium text-slate-400">Roll Number</span>
                <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">{profile?.rollNumber}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label block text-[11px] font-medium text-slate-400">Admission Number</span>
                <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">{profile?.admissionNumber}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label block text-[11px] font-medium text-slate-400">Class &amp; Section</span>
                <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">{profile?.className} - Section {profile?.sectionName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label block text-[11px] font-medium text-slate-400">Academic Session</span>
                <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">{profile?.academicSession}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label block text-[11px] font-medium text-slate-400">Student Email</span>
                <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">{displayEmail}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label block text-[11px] font-medium text-slate-400">Date of Birth</span>
                <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">{profile?.dateOfBirth ? toDdMmYyyy(profile.dateOfBirth) : '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label block text-[11px] font-medium text-slate-400">Gender</span>
                <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">{formatGender(profile?.gender) || 'Not Specified'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label block text-[11px] font-medium text-slate-400">Official School Website</span>
                <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">
                  {(profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website) ? (
                    <a
                      href={profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                      title="Open official school website in new tab"
                    >
                      <Globe size={13} />
                      <span className="underline">{profile?.schoolWebsite || (profile as any)?.school_website || (profile as any)?.website}</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-slate-400">Not Configured</span>
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="student-card-header mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/60">
            <div className="student-card-title-wrap flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Users size={18} className="text-blue-600" />
              <h3 className="student-card-title text-base font-bold m-0">Parent Contact</h3>
            </div>
          </div>

          <div className="student-details-grid grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3">
            <div className="detail-item">
              <span className="detail-label block text-[11px] font-medium text-slate-400">Parent Name</span>
              <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">{profile?.parentName}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label block text-[11px] font-medium text-slate-400">Emergency SMS Mobile</span>
              <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">{profile?.parentPhone}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label block text-[11px] font-medium text-slate-400">Registered Parent Email</span>
              <span className="detail-val font-semibold text-xs text-slate-900 dark:text-slate-100">{profile?.parentEmail}</span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="student-card student-profile-security-card rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div className="student-card-header flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700/60 mb-4">
            <div className="student-card-title-wrap flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Lock size={18} className="text-blue-600" />
              <h3 className="student-card-title text-base font-bold m-0">Account Security</h3>
            </div>
            <span className="security-tag inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"><ShieldCheck size={14} /> BCrypt Protected</span>
          </div>

          {pwMsg && (
            <div className={`student-alert-${pwMsg.type} mb-4 p-3 rounded-md text-xs flex items-center gap-2 ${
              pwMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 border border-red-500/25 text-red-500'
            }`}>
              {pwMsg.type === 'success' && <CheckCircle2 size={16} />}
              <span>{pwMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="student-form-vertical space-y-3.5">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Current Password:</span>
              <div className="relative w-full">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 hover:text-slate-600 cursor-pointer p-1 flex items-center justify-center"
                  title={showCurrentPw ? 'Hide password' : 'Show password'}
                  aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                >
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">New Password:</span>
              <div className="relative w-full">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  placeholder="Enter new strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 hover:text-slate-600 cursor-pointer p-1 flex items-center justify-center"
                  title={showNewPw ? 'Hide password' : 'Show password'}
                  aria-label={showNewPw ? 'Hide password' : 'Show password'}
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                Must be at least 8 characters, with 1 Capital letter, 1 small letter, 1 number, and 1 special character.
              </span>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirm New Password:</span>
              <div className="relative w-full">
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  required
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 hover:text-slate-600 cursor-pointer p-1 flex items-center justify-center"
                  title={showConfirmPw ? 'Hide password' : 'Show password'}
                  aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <button type="submit" disabled={submittingPw} className="student-btn-primary w-full py-2 text-xs font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 cursor-pointer transition-colors shadow-sm mt-2">
              {submittingPw ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
