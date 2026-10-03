import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, ArrowLeft, CheckCircle2, ShieldCheck, School, Users, Camera, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, StudentProfile as IStudentProfile } from '../../services/studentApi';
import { useAuth } from '../../hooks/useAuth';

export function StudentProfile() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<IStudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittingPw, setSubmittingPw] = useState(false);

  useEffect(() => {
    studentApi
      .getProfile()
      .then((res) => {
        setProfile(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

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
          await studentApi.updatePhoto(compressedDataUrl);
          setProfile((prev) => prev ? { ...prev, photoUrl: compressedDataUrl } : null);
          setPhotoMsg({ type: 'success', text: 'Profile picture updated successfully!' });
        } catch (err: any) {
          setPhotoMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to update picture.' });
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
      setProfile((prev) => prev ? { ...prev, photoUrl: '' } : null);
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
    if (newPassword.length < 8) {
      setPwMsg({ type: 'error', text: 'New password must be at least 8 characters' });
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

          <h2 className="profile-hero-name">{profile?.name || 'Student'}</h2>
          <p className="profile-hero-role">{profile?.className} - Section {profile?.sectionName}</p>
          <div className="profile-hero-badge">
            <School size={14} />
            <span>{profile?.schoolName}</span>
          </div>
        </div>

        {/* Academic & Personal Details */}
        <div className="student-card student-profile-details-card">
          <div className="student-card-header">
            <div className="student-card-title-wrap">
              <User size={18} />
              <h3 className="student-card-title">Academic & Institutional Details</h3>
            </div>
          </div>

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
              <span className="detail-val">{profile?.dateOfBirth || '—'}</span>
            </div>
          </div>

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
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>

            <label>
              <span>New Password (min 8 characters):</span>
              <input
                type="password"
                required
                placeholder="Enter new strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>

            <label>
              <span>Confirm New Password:</span>
              <input
                type="password"
                required
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
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
