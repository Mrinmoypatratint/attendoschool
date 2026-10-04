import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, ArrowLeft, CheckCircle2, ShieldCheck, School, Users, Camera, Trash2, Loader2, AlertCircle, Edit3, Save, X, Clock } from 'lucide-react';
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
        setEditGender(res?.gender || '');
        setEditDob(res?.dateOfBirth || '');
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsMsg(null);
    setSavingDetails(true);
    try {
      await studentApi.updateProfile({ gender: editGender, dateOfBirth: editDob });
      setProfile((prev) => prev ? { ...prev, gender: editGender, dateOfBirth: editDob } : null);
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

          {profile?.hasPendingPhotoApproval && (
            <div style={{
              margin: '12px 0 4px',
              background: '#FEF3C7',
              border: '1px solid #FDE68A',
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12.5,
              color: '#92400E',
              textAlign: 'left'
            }}>
              {profile?.pendingPhotoUrl && (
                <img
                  src={profile.pendingPhotoUrl}
                  alt="Pending submission"
                  style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', border: '2px solid #F59E0B', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#92400E' }}>
                  <Clock size={13} /> Photo Pending Approval
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.95, marginTop: 1, color: '#B45309' }}>
                  Your uploaded photo is waiting for administrator approval. Once approved, it will automatically become active on your profile.
                </div>
              </div>
            </div>
          )}

          {profile?.photoApprovalStatus === 'REJECTED' && (
            <div style={{
              margin: '12px 0 4px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12.5,
              color: '#991B1B',
              textAlign: 'left'
            }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <AlertCircle size={13} /> Photo Declined by Administrator
              </div>
              <div style={{ fontSize: 11.5, color: '#7F1D1D' }}>
                Reason: "{profile.photoRejectionReason || 'Photo does not meet administrative standards.'}"
              </div>
              <div style={{ fontSize: 11, color: '#991B1B', marginTop: 3 }}>
                Please upload a clear, front-facing passport-style photo.
              </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      outline: 'none',
                      backgroundColor: '#ffffff'
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
                  <input
                    type="date"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDetails(false);
                    setEditGender(profile?.gender || '');
                    setEditDob(profile?.dateOfBirth || '');
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
                <span className="detail-val">{profile?.dateOfBirth || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Gender</span>
                <span className="detail-val">{profile?.gender || 'Not Specified'}</span>
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
