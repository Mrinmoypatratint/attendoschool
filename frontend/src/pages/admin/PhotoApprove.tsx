import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Camera,
  Maximize2,
  Check,
  X,
  User,
  GraduationCap,
  AlertTriangle
} from 'lucide-react';
import { api } from '../../api';

interface PhotoRequest {
  id: string;
  school_id: string;
  applicant_type: 'STUDENT' | 'TEACHER';
  applicant_id: string;
  applicant_name: string;
  identifier?: string;
  detail?: string;
  current_photo_url?: string | null;
  photo_url: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  created_at: string;
}

export default function PhotoApprove() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED'>('PENDING');
  const [photos, setPhotos] = useState<PhotoRequest[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'TEACHER'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Lightbox Preview Modal State
  const [previewPhoto, setPreviewPhoto] = useState<PhotoRequest | null>(null);

  // Reject Modal State
  const [rejectingPhoto, setRejectingPhoto] = useState<PhotoRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reviews/photos');
      if (res.data?.success) {
        setPhotos(res.data.data || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err: any) {
      console.error('Failed to load photo approval requests:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to load photo requests.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  const handleApprove = async (photo: PhotoRequest) => {
    try {
      setActionLoading(photo.id);
      const res = await api.put(`/reviews/photos/${photo.id}/approve`, {
        photo_url: photo.photo_url
      });
      if (res.data?.success) {
        setFeedback({ type: 'success', message: `Photo for ${photo.applicant_name} has been approved.` });
        if (previewPhoto?.id === photo.id) setPreviewPhoto(null);
        await loadPhotos();
      }
    } catch (err: any) {
      console.error('Failed to approve photo:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to approve photo.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingPhoto) return;
    try {
      setActionLoading(rejectingPhoto.id);
      const res = await api.put(`/reviews/photos/${rejectingPhoto.id}/reject`, {
        reason: rejectReason.trim() || 'Photo does not meet administrative standards.'
      });
      if (res.data?.success) {
        setFeedback({ type: 'success', message: `Photo for ${rejectingPhoto.applicant_name} has been rejected.` });
        setRejectingPhoto(null);
        setRejectReason('');
        if (previewPhoto?.id === rejectingPhoto.id) setPreviewPhoto(null);
        await loadPhotos();
      }
    } catch (err: any) {
      console.error('Failed to reject photo:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to reject photo.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Filter photos based on active tab, role, and search query
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      // Tab filter
      if (activeTab === 'PENDING' && p.status !== 'PENDING') return false;
      if (activeTab === 'APPROVED' && p.status !== 'APPROVED') return false;

      // Role filter
      if (roleFilter !== 'ALL' && p.applicant_type !== roleFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.applicant_name?.toLowerCase().includes(q);
        const idMatch = p.identifier?.toLowerCase().includes(q);
        const detailMatch = p.detail?.toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !detailMatch) return false;
      }

      return true;
    });
  }, [photos, activeTab, roleFilter, searchQuery]);

  return (
    <div className="student-subpage" style={{ padding: '24px 28px', maxWidth: 1280, margin: '0 auto' }}>
      {/* ── Page Header (Matching screenshot style) ── */}
      <div className="student-subpage-header" style={{ marginBottom: 20 }}>
        <div className="student-subpage-title-row">
          <Link to="/dashboard" className="student-back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563EB', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginBottom: 4 }}>
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text, #0F172A)', margin: '2px 0 4px' }}>
            Photo Approve
          </h1>
          <p className="student-subpage-desc" style={{ fontSize: 14, color: 'var(--text-secondary, #64748B)', margin: 0 }}>
            Review, verify, and approve submitted student and staff profile photographs.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPhotos}
          className="student-btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border, #E2E8F0)', background: 'var(--surface, #FFF)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 16,
            background: feedback.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${feedback.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            color: feedback.type === 'success' ? '#166534' : '#991B1B',
            fontSize: 13.5
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── 3 Tabs (Exactly matching user screenshot) ── */}
      <div className="student-tab-bar" style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border, #E2E8F0)', marginBottom: 20 }}>
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 16px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'ALL' ? '2px solid #2563EB' : '2px solid transparent',
            color: activeTab === 'ALL' ? '#2563EB' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          All ({counts.all})
        </button>
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'PENDING' ? 'active' : ''}`}
          onClick={() => setActiveTab('PENDING')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 16px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'PENDING' ? '2px solid #2563EB' : '2px solid transparent',
            color: activeTab === 'PENDING' ? '#2563EB' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          Pending ({counts.pending})
        </button>
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'APPROVED' ? 'active' : ''}`}
          onClick={() => setActiveTab('APPROVED')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 16px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'APPROVED' ? '2px solid #2563EB' : '2px solid transparent',
            color: activeTab === 'APPROVED' ? '#2563EB' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          Approved ({counts.approved})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', minWidth: 260, flex: 1, maxWidth: 400 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search by name, roll no, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 8,
              border: '1px solid var(--border, #E2E8F0)',
              background: 'var(--surface, #FFF)',
              fontSize: 13,
              color: 'var(--text, #0F172A)'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} style={{ color: '#64748B' }} />
          <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Role:</span>
          {(['ALL', 'STUDENT', 'TEACHER'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              style={{
                background: roleFilter === role ? '#EFF6FF' : 'transparent',
                color: roleFilter === role ? '#2563EB' : 'var(--text-secondary, #64748B)',
                border: roleFilter === role ? '1px solid #BFDBFE' : '1px solid var(--border, #E2E8F0)',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {role === 'ALL' ? 'All Roles' : role === 'STUDENT' ? 'Students' : 'Teachers'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B', fontSize: 14 }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: 12, display: 'inline-block', color: '#2563EB' }} />
          <div>Loading photo approval requests...</div>
        </div>
      ) : filteredPhotos.length === 0 ? (
        /* Empty state matching the user's screenshot */
        <div className="student-empty-state" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary, #64748B)', fontSize: 14, background: 'var(--surface, #FFF)', border: '1px dashed var(--border, #E2E8F0)', borderRadius: 12 }}>
          <Camera size={36} style={{ color: '#CBD5E1', marginBottom: 12 }} />
          <p style={{ margin: 0, fontWeight: 500, fontSize: 15, color: 'var(--text, #334155)' }}>
            No photo submissions found in this category.
          </p>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
            {activeTab === 'PENDING' ? 'All submitted student and staff photos have been processed.' : 'No photo records to display.'}
          </p>
        </div>
      ) : (
        /* Photos Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20
          }}
        >
          {filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              style={{
                background: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--border, #E2E8F0)',
                borderRadius: 14,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'box-shadow 0.2s, transform 0.2s'
              }}
            >
              {/* Header: Status and Date */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border, #E2E8F0)',
                  background: 'var(--bg-card-header, #FAFAFA)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {photo.status === 'PENDING' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                      <Clock size={12} /> Pending Review
                    </span>
                  ) : photo.status === 'APPROVED' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#DCFCE7', color: '#166534', padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                      <CheckCircle2 size={12} /> Approved
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEE2E2', color: '#991B1B', padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                      <XCircle size={12} /> Rejected
                    </span>
                  )}
                </div>

                <span style={{ fontSize: 11.5, color: '#64748B' }}>
                  {photo.created_at ? new Date(photo.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>

              {/* Photo & Person Details */}
              <div style={{ padding: 16, display: 'flex', gap: 14, flex: 1 }}>
                {/* Photo Thumbnail with Zoom */}
                <div
                  style={{
                    position: 'relative',
                    width: 100,
                    height: 100,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#F1F5F9',
                    flexShrink: 0,
                    border: '1px solid var(--border, #E2E8F0)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPreviewPhoto(photo)}
                  title="Click to view full photo"
                >
                  <img
                    src={photo.photo_url}
                    alt={photo.applicant_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as any).src = 'https://via.placeholder.com/150?text=No+Photo';
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.3)',
                      opacity: 0,
                      transition: 'opacity 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFF'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                  >
                    <Maximize2 size={18} />
                  </div>
                </div>

                {/* Candidate Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: photo.applicant_type === 'STUDENT' ? '#EFF6FF' : '#F3E8FF',
                        color: photo.applicant_type === 'STUDENT' ? '#1D4ED8' : '#7E22CE'
                      }}
                    >
                      {photo.applicant_type === 'STUDENT' ? <User size={11} /> : <GraduationCap size={11} />}
                      {photo.applicant_type === 'STUDENT' ? 'Student' : 'Teacher'}
                    </span>
                  </div>

                  <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--text, #0F172A)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {photo.applicant_name}
                  </h3>

                  {photo.identifier && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748B)' }}>
                      ID / Adm: <strong style={{ color: 'var(--text, #334155)' }}>{photo.identifier}</strong>
                    </div>
                  )}

                  {photo.detail && (
                    <div style={{ fontSize: 12, color: '#64748B' }}>
                      {photo.detail}
                    </div>
                  )}

                  {photo.current_photo_url && (
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Current:</span>
                      <img
                        src={photo.current_photo_url}
                        alt="Current"
                        style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '1px solid #CBD5E1' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Status details / Rejection reason */}
              {photo.status === 'REJECTED' && photo.rejection_reason && (
                <div style={{ margin: '0 16px 12px', padding: '8px 12px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA', fontSize: 12, color: '#991B1B' }}>
                  <strong>Reason:</strong> {photo.rejection_reason}
                </div>
              )}

              {photo.status === 'APPROVED' && photo.reviewed_by_name && (
                <div style={{ margin: '0 16px 12px', fontSize: 11.5, color: '#166534', background: '#F0FDF4', padding: '6px 10px', borderRadius: 6 }}>
                  Approved by {photo.reviewed_by_name} {photo.reviewed_at ? `on ${new Date(photo.reviewed_at).toLocaleDateString()}` : ''}
                </div>
              )}

              {/* Action Buttons for PENDING */}
              {photo.status === 'PENDING' && (
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '12px 16px',
                    borderTop: '1px solid var(--border, #E2E8F0)',
                    background: 'var(--bg-card-footer, #FAFAFA)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleApprove(photo)}
                    disabled={actionLoading === photo.id}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: '#16A34A',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: actionLoading === photo.id ? 0.7 : 1,
                      transition: 'background 0.15s'
                    }}
                  >
                    <Check size={15} />
                    <span>{actionLoading === photo.id ? 'Approving...' : 'Approve'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRejectingPhoto(photo);
                      setRejectReason('');
                    }}
                    disabled={actionLoading === photo.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: 'transparent',
                      color: '#DC2626',
                      border: '1px solid #FCA5A5',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <X size={15} />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Photo Preview Lightbox Modal ── */}
      {previewPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              borderRadius: 16,
              maxWidth: 520,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border, #E2E8F0)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #0F172A)' }}>{previewPhoto.applicant_name}</h3>
                <span style={{ fontSize: 12, color: '#64748B' }}>{previewPhoto.detail || previewPhoto.identifier}</span>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 20, textAlign: 'center', background: '#F8FAFC' }}>
              <img
                src={previewPhoto.photo_url}
                alt={previewPhoto.applicant_name}
                style={{
                  maxHeight: 360,
                  maxWidth: '100%',
                  borderRadius: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  objectFit: 'contain'
                }}
              />
            </div>

            {previewPhoto.status === 'PENDING' && (
              <div style={{ display: 'flex', gap: 12, padding: 16, borderTop: '1px solid var(--border, #E2E8F0)', justifyContent: 'flex-end', background: 'var(--surface, #FFF)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingPhoto(previewPhoto);
                    setRejectReason('');
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #FCA5A5', color: '#DC2626', background: '#FFF', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  <X size={15} /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(previewPhoto)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', color: '#FFF', background: '#16A34A', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  <Check size={15} /> Approve Photo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Reject Reason Dialog Modal ── */}
      {rejectingPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 20
          }}
          onClick={() => setRejectingPhoto(null)}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: 22,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#991B1B' }}>
              Reject Photo Submission
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748B' }}>
              Please provide a reason for rejecting the photograph for <strong>{rejectingPhoto.applicant_name}</strong>.
            </p>

            {/* Quick Reason Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {[
                'Blurry / Low Resolution',
                'Not Formal Portrait',
                'Face Not Clearly Visible',
                'Incorrect Background'
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setRejectReason(chip)}
                  style={{
                    background: rejectReason === chip ? '#FEE2E2' : '#F1F5F9',
                    color: rejectReason === chip ? '#991B1B' : '#475569',
                    border: '1px solid transparent',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11.5,
                    cursor: 'pointer'
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason or guidance for re-upload..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #E2E8F0)',
                background: 'var(--surface, #FFF)',
                color: 'var(--text, #0F172A)',
                fontSize: 13,
                resize: 'none',
                marginBottom: 16
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setRejectingPhoto(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #E2E8F0)',
                  background: 'transparent',
                  color: '#64748B',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoading === rejectingPhoto.id}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: actionLoading === rejectingPhoto.id ? 0.7 : 1
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
