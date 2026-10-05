import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Lock,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  School,
  Camera,
  Trash2,
  Loader2,
  AlertCircle,
  GraduationCap,
  BookOpen,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Layers,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { validatePassword } from '../../utils/passwordPolicy';
import { useAuth } from '../../hooks/useAuth';

export interface ITeacherProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  employeeId: string;
  phone: string;
  address: string;
  qualification: string;
  joiningDate: string;
  photoUrl: string;
  gender: string;
  department: string;
  designation: string;
  academicSession: string;
  assignedClasses: string[];
  assignedSubjects: string[];
}

export function TeacherProfile() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ITeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit details state
  const [editing, setEditing] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editQualification, setEditQualification] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittingPw, setSubmittingPw] = useState(false);

  async function loadProfile() {
    try {
      const res = await api.get('/teacher/profile');
      if (res.data) {
        setProfile(res.data);
        setEditPhone(res.data.phone || '');
        setEditGender(res.data.gender || '');
        setEditAddress(res.data.address || '');
        setEditQualification(res.data.qualification || '');
      }
    } catch (err) {
      console.error('Failed to load teacher profile:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
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
          await api.put('/teacher/photo', { photoUrl: compressedDataUrl });
          setProfile((prev) => (prev ? { ...prev, photoUrl: compressedDataUrl } : null));
          setPhotoMsg({ type: 'success', text: 'Profile picture updated successfully!' });
        } catch (err: any) {
          setPhotoMsg({
            type: 'error',
            text: err?.response?.data?.message || 'Failed to update picture.'
          });
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
      await api.put('/teacher/photo', { photoUrl: '' });
      setProfile((prev) => (prev ? { ...prev, photoUrl: '' } : null));
      setPhotoMsg({ type: 'success', text: 'Profile picture removed.' });
    } catch (err: any) {
      setPhotoMsg({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to remove picture.'
      });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDetails(true);
    setDetailsMsg(null);
    try {
      await api.put('/teacher/profile', {
        phone: editPhone.trim(),
        address: editAddress.trim(),
        qualification: editQualification.trim(),
        gender: editGender
      });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              phone: editPhone.trim(),
              address: editAddress.trim(),
              qualification: editQualification.trim(),
              gender: editGender
            }
          : null
      );
      setEditing(false);
      setDetailsMsg({ type: 'success', text: 'Profile details updated successfully!' });
      setTimeout(() => setDetailsMsg(null), 4000);
    } catch (err: any) {
      setDetailsMsg({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to save profile details.'
      });
    } finally {
      setSavingDetails(false);
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
      const res = await api.put('/teacher/change-password', {
        currentPassword,
        newPassword
      });
      setPwMsg({ type: 'success', text: res.data?.message || 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwMsg(null), 5000);
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
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
        <Loader2 size={28} className="spin-animate" style={{ margin: '0 auto 12px', display: 'block', color: '#2563eb' }} />
        Loading teacher profile...
      </div>
    );
  }

  return (
    <div className="student-subpage" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* ── Header ── */}
      <div className="student-subpage-header" style={{ marginBottom: 24 }}>
        <div className="student-subpage-title-row">
          <Link to="/dashboard" className="student-back-link">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title">Faculty Profile & Credentials</h1>
          <p className="student-subpage-desc">
            Personal identity, academic credentials, teaching allocations, and account security.
          </p>
        </div>
      </div>

      {detailsMsg && (
        <div
          style={{
            marginBottom: 20,
            padding: '10px 16px',
            borderRadius: 8,
            backgroundColor: detailsMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: detailsMsg.type === 'success' ? '1px solid #a7f3d0' : '1px solid #fecaca',
            color: detailsMsg.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          {detailsMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{detailsMsg.text}</span>
        </div>
      )}

      {/* ── Main 3-Column Profile Layout (matching student structure) ── */}
      <div className="student-profile-layout">
        {/* 1. Hero Summary Card */}
        <div className="student-card student-profile-hero-card">
          <div className="student-profile-avatar-large">
            {profile?.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={profile.name}
                className="student-profile-avatar-img"
              />
            ) : (
              <span>{profile?.name?.charAt(0) || 'T'}</span>
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

          <h2 className="profile-hero-name">{profile?.name || 'Faculty Teacher'}</h2>
          <p className="profile-hero-role">{profile?.designation} · {profile?.department}</p>
          <div className="profile-hero-badge">
            <School size={14} />
            <span>{profile?.schoolName}</span>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: '10px 14px',
              backgroundColor: 'var(--surface-subtle, #f8fafc)',
              borderRadius: 8,
              border: '1px solid var(--border, #e2e8f0)',
              width: '100%',
              boxSizing: 'border-box',
              textAlign: 'left'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', marginBottom: 4 }}>
              Faculty ID
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
              <code>{profile?.employeeId}</code>
            </div>
          </div>
        </div>

        {/* 2. Academic & Faculty Details Card */}
        <div className="student-card student-profile-details-card">
          <div className="student-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="student-card-title-wrap">
              <User size={18} />
              <h3 className="student-card-title">Faculty & Institutional Details</h3>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
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
                <Edit3 size={13} /> Edit Contact
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSaveDetails} style={{ display: 'grid', gap: 14, marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text, #334155)' }}>
                    Contact Mobile Number:
                  </span>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91 98300 12345"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  />
                </label>

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
              </div>

              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text, #334155)' }}>
                  Highest Qualification:
                </span>
                <input
                  type="text"
                  value={editQualification}
                  onChange={(e) => setEditQualification(e.target.value)}
                  placeholder="M.Tech / M.Sc Computer Science"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text, #334155)' }}>
                  Campus / Residential Address:
                </span>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Street, City, State, PIN"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </label>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditPhone(profile?.phone || '');
                    setEditGender(profile?.gender || '');
                    setEditAddress(profile?.address || '');
                    setEditQualification(profile?.qualification || '');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: 12.5,
                    fontWeight: 600,
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
                <span className="detail-label">Employee ID</span>
                <span className="detail-val">{profile?.employeeId}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Official Email</span>
                <span className="detail-val">{profile?.email}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Mobile Number</span>
                <span className="detail-val">{profile?.phone || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Academic Session</span>
                <span className="detail-val">{profile?.academicSession}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Joining Date</span>
                <span className="detail-val">{profile?.joiningDate || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Qualification</span>
                <span className="detail-val">{profile?.qualification || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Gender</span>
                <span className="detail-val">{profile?.gender || 'Not Specified'}</span>
              </div>
              <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <span className="detail-label">Address</span>
                <span className="detail-val">{profile?.address || '—'}</span>
              </div>
            </div>
          )}

          {/* Teaching Allocations Section */}
          <div className="student-card-header" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--edu-border, #E2E8F0)' }}>
            <div className="student-card-title-wrap">
              <GraduationCap size={18} />
              <h3 className="student-card-title">Teaching Allocations & Curriculum</h3>
            </div>
          </div>

          <div className="student-details-grid">
            <div className="detail-item">
              <span className="detail-label">Assigned Classes</span>
              <span className="detail-val">
                {profile?.assignedClasses && profile.assignedClasses.length > 0
                  ? profile.assignedClasses.join(', ')
                  : 'Class 10 - Section A, Class 9 - Section B'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Subjects Taught</span>
              <span className="detail-val">
                {profile?.assignedSubjects && profile.assignedSubjects.length > 0
                  ? profile.assignedSubjects.join(', ')
                  : 'Mathematics, Computer Science'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Change Password / Account Security Card */}
        <div className="student-card student-profile-security-card">
          <div className="student-card-header">
            <div className="student-card-title-wrap">
              <Lock size={18} />
              <h3 className="student-card-title">Account Security</h3>
            </div>
            <span className="security-tag">
              <ShieldCheck size={14} /> BCrypt Protected
            </span>
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
              <span>New Password:</span>
              <input
                type="password"
                required
                placeholder="Enter new strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #64748B)', marginTop: 4, display: 'block' }}>
                Must be at least 8 characters, with 1 Capital letter, 1 small letter, 1 number, and 1 special character.
              </span>
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

            <button
              type="submit"
              disabled={submittingPw}
              className="student-btn-primary"
              style={{ marginTop: 8 }}
            >
              {submittingPw ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default TeacherProfile;
