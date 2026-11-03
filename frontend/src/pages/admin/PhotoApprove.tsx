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
import { useAuth } from '../../hooks/useAuth';
import { PersonProfileLink } from '../../components/PersonProfileLink';

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
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [photos, setPhotos] = useState<PhotoRequest[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'TEACHER'>(isTeacher ? 'STUDENT' : 'ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const cleanIdentifier = (identifier?: string) => {
    if (!identifier) return '';
    return identifier
      .replace(/Roll:\s*[^·•\n\r|]+\s*[·•|]\s*/gi, '')
      .replace(/[·•|]\s*Roll:\s*[^·•\n\r|]+/gi, '')
      .replace(/Roll:\s*[^·•\n\r|]+/gi, '')
      .trim();
  };

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
        window.dispatchEvent(new CustomEvent('reviews-updated'));
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
        reason: rejectReason.trim() || 'Photo does not meet standards.'
      });
      if (res.data?.success) {
        setFeedback({ type: 'success', message: `Photo for ${rejectingPhoto.applicant_name} has been rejected.` });
        setRejectingPhoto(null);
        setRejectReason('');
        if (previewPhoto?.id === rejectingPhoto.id) setPreviewPhoto(null);
        window.dispatchEvent(new CustomEvent('reviews-updated'));
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
      // In teacher portal, only show student photos
      if (isTeacher && p.applicant_type !== 'STUDENT') return false;

      // Tab filter
      if (activeTab === 'PENDING' && p.status !== 'PENDING') return false;
      if (activeTab === 'APPROVED' && p.status !== 'APPROVED') return false;
      if (activeTab === 'REJECTED' && p.status !== 'REJECTED') return false;

      // Role filter (only for admin)
      if (!isTeacher && roleFilter !== 'ALL' && p.applicant_type !== roleFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.applicant_name?.toLowerCase().includes(q);
        const idMatch = (isTeacher ? cleanIdentifier(p.identifier) : p.identifier)?.toLowerCase().includes(q);
        const detailMatch = p.detail?.toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !detailMatch) return false;
      }

      return true;
    });
  }, [photos, activeTab, roleFilter, searchQuery, isTeacher]);

  const displayCounts = useMemo(() => {
    if (!isTeacher) return counts;
    const studentList = photos.filter(p => p.applicant_type === 'STUDENT');
    const all = studentList.length;
    const pending = studentList.filter(p => p.status === 'PENDING').length;
    const approved = studentList.filter(p => p.status === 'APPROVED').length;
    const rejected = studentList.filter(p => p.status === 'REJECTED').length;
    return { all, pending, approved, rejected };
  }, [isTeacher, counts, photos]);

  return (
    <div className="student-subpage w-full max-w-none m-0 pb-10" style={{ width: '100%', paddingBottom: 40 }}>
      {/* ── Page Header (Matching screenshot style) ── */}
      <div className="student-subpage-header mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="student-subpage-title-row">
          <Link to="/dashboard" className="student-back-link inline-flex items-center gap-1.5 text-blue-600 font-semibold text-xs no-underline mb-1 hover:text-blue-700 transition-colors">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title text-2xl font-extrabold text-slate-900 dark:text-white my-1">
            {isTeacher ? 'Student Photo Approvals' : 'Photo Approve'}
          </h1>
          <p className="student-subpage-desc text-sm text-slate-500 dark:text-slate-400 m-0">
            {isTeacher
              ? 'Review, verify, and approve submitted student profile photographs for your mentored class-section.'
              : 'Review, verify, and approve submitted student and staff profile photographs.'}
          </p>
        </div>

        <button
          type="button"
          onClick={loadPhotos}
          className="student-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-2.5 px-4 rounded-xl mb-4 text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="bg-transparent border-0 cursor-pointer text-inherit p-0.5 hover:opacity-75 transition-opacity"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── 3 Tabs (Exactly matching user screenshot) ── */}
      <div className="student-tab-bar flex gap-1.5 border-b border-slate-200 dark:border-slate-700 mb-5 overflow-x-auto pb-px">
        <button
          type="button"
          className={`student-tab-btn px-4 py-2 text-sm font-semibold cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'ALL'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 active'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('ALL')}
        >
          All ({displayCounts.all})
        </button>
        <button
          type="button"
          className={`student-tab-btn px-4 py-2 text-sm font-semibold cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'PENDING'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 active'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('PENDING')}
        >
          Pending ({displayCounts.pending})
        </button>
        <button
          type="button"
          className={`student-tab-btn px-4 py-2 text-sm font-semibold cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'APPROVED'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 active'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('APPROVED')}
        >
          Approved ({displayCounts.approved})
        </button>
        <button
          type="button"
          className={`student-tab-btn px-4 py-2 text-sm font-semibold cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'REJECTED'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400 active'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('REJECTED')}
        >
          Rejected ({displayCounts.rejected})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="relative min-w-[260px] flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={isTeacher ? "Search by name or ID..." : "Search by name, roll no, or ID..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 pl-9 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {!isTeacher && (
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <span className="text-sm text-slate-500 font-medium">Role:</span>
            {(['ALL', 'STUDENT', 'TEACHER'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`py-1 px-2.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  roleFilter === role
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {role === 'ALL' ? 'All Roles' : role === 'STUDENT' ? 'Students' : 'Teachers'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="text-center py-16 px-5 text-slate-500 text-sm">
          <RefreshCw size={24} className="spin mb-3 inline-block text-blue-600" />
          <div>Loading photo approval requests...</div>
        </div>
      ) : filteredPhotos.length === 0 ? (
        /* Empty state matching the user's screenshot */
        <div className="student-empty-state text-center py-16 px-5 text-slate-500 dark:text-slate-400 text-sm bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Camera size={36} className="text-slate-300 dark:text-slate-600 mb-3 mx-auto" />
          <p className="m-0 font-medium text-base text-slate-700 dark:text-slate-300">
            {isTeacher && counts.all === 0
              ? 'No student photo approval requests found for your mentored class-section.'
              : 'No photo submissions found in this category.'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isTeacher && counts.all === 0
              ? 'Photo approval duties are routed exclusively to assigned class mentors.'
              : activeTab === 'PENDING'
              ? (isTeacher ? 'All submitted student photos have been processed.' : 'All submitted student and staff photos have been processed.')
              : activeTab === 'REJECTED'
              ? 'No rejected photo requests found.'
              : activeTab === 'APPROVED'
              ? 'No approved photo records to display.'
              : 'No photo records to display.'}
          </p>
        </div>
      ) : (
        /* Photos Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-xs hover:shadow-md transition-all"
            >
              {/* Header: Status and Date */}
              <div className="flex items-center justify-between p-3 px-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
                <div className="flex items-center gap-1.5">
                  {photo.status === 'PENDING' ? (
                    <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 py-0.5 px-2 rounded-full text-xs font-bold">
                      <Clock size={12} /> Pending Review
                    </span>
                  ) : photo.status === 'APPROVED' ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 py-0.5 px-2 rounded-full text-xs font-bold">
                      <CheckCircle2 size={12} /> Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 py-0.5 px-2 rounded-full text-xs font-bold">
                      <XCircle size={12} /> Rejected
                    </span>
                  )}
                </div>

                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {photo.created_at ? new Date(photo.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>

              {/* Photo & Person Details */}
              <div className="p-4 flex gap-3.5 flex-1">
                {/* Photo Thumbnail with Zoom */}
                <div
                  className="relative w-25 h-25 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 shrink-0 border border-slate-200 dark:border-slate-700 cursor-pointer group"
                  onClick={() => setPreviewPhoto(photo)}
                  title="Click to view full photo"
                >
                  <img
                    src={photo.photo_url}
                    alt={photo.applicant_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as any).src = 'https://via.placeholder.com/150?text=No+Photo';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Maximize2 size={18} />
                  </div>
                </div>

                {/* Candidate Info */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  {!isTeacher && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold py-0.5 px-1.5 rounded ${
                          photo.applicant_type === 'STUDENT'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                            : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                        }`}
                      >
                        {photo.applicant_type === 'STUDENT' ? <User size={11} /> : <GraduationCap size={11} />}
                        {photo.applicant_type === 'STUDENT' ? 'Student' : 'Teacher'}
                      </span>
                    </div>
                  )}

                  <h3 className="m-0 mt-0.5 text-sm font-bold text-slate-900 dark:text-white truncate">
                    <PersonProfileLink kind={photo.applicant_type === 'TEACHER' ? 'teacher' : 'student'} id={photo.applicant_id} name={photo.applicant_name} person={photo as any} />
                  </h3>

                  {isTeacher ? (
                    cleanIdentifier(photo.identifier) ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Adm: <strong className="text-slate-700 dark:text-slate-300">{cleanIdentifier(photo.identifier).replace(/^Adm:\s*/i, '')}</strong>
                      </div>
                    ) : null
                  ) : (
                    photo.identifier && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        ID / Adm: <strong className="text-slate-700 dark:text-slate-300">{photo.identifier}</strong>
                      </div>
                    )
                  )}

                  {photo.detail && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {photo.detail}
                    </div>
                  )}

                  {photo.current_photo_url && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Current:</span>
                      <img
                        src={photo.current_photo_url}
                        alt="Current"
                        className="w-5.5 h-5.5 rounded-full object-cover border border-slate-300 dark:border-slate-600"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Status details / Rejection reason */}
              {photo.status === 'REJECTED' && photo.rejection_reason && (
                <div className="mx-4 mb-3 p-2 px-3 bg-rose-500/10 rounded-lg border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400">
                  <strong>Reason:</strong> {photo.rejection_reason}
                </div>
              )}

              {photo.status === 'APPROVED' && photo.reviewed_by_name && (
                <div className="mx-4 mb-3 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-1.5 px-2.5 rounded-md">
                  Approved by {photo.reviewed_by_name} {photo.reviewed_at ? `on ${new Date(photo.reviewed_at).toLocaleDateString()}` : ''}
                </div>
              )}

              {/* Action Buttons for PENDING */}
              {photo.status === 'PENDING' && (
                <div className="flex gap-2.5 p-3 px-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
                  <button
                    type="button"
                    onClick={() => handleApprove(photo)}
                    disabled={actionLoading === photo.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0 rounded-lg py-2 px-3 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
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
                    className="inline-flex items-center justify-center gap-1.5 bg-transparent text-rose-600 dark:text-rose-400 border border-rose-500/40 hover:bg-rose-500/10 rounded-lg py-2 px-3.5 text-xs font-semibold cursor-pointer transition-colors"
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
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-5"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 px-4.5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="m-0 text-base font-bold text-slate-900 dark:text-white">
                  <PersonProfileLink kind={previewPhoto.applicant_type === 'TEACHER' ? 'teacher' : 'student'} id={previewPhoto.applicant_id} name={previewPhoto.applicant_name} person={previewPhoto as any} />
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {previewPhoto.detail || (isTeacher ? cleanIdentifier(previewPhoto.identifier) : previewPhoto.identifier)}
                </span>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="bg-transparent border-0 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 text-center bg-slate-100 dark:bg-slate-900/50">
              <img
                src={previewPhoto.photo_url}
                alt={previewPhoto.applicant_name}
                className="max-h-90 max-w-full rounded-xl shadow-md object-contain mx-auto"
              />
            </div>

            {previewPhoto.status === 'PENDING' && (
              <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700 justify-end bg-white dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingPhoto(previewPhoto);
                    setRejectReason('');
                  }}
                  className="inline-flex items-center gap-1.5 py-2 px-4 rounded-lg border border-rose-500/40 text-rose-600 dark:text-rose-400 bg-transparent font-semibold text-xs cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <X size={15} /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(previewPhoto)}
                  className="inline-flex items-center gap-1.5 py-2 px-4.5 rounded-lg border-0 text-white bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs cursor-pointer shadow-xs transition-colors"
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
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-5"
          onClick={() => setRejectingPhoto(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 mb-2 text-base font-bold text-rose-600">
              Reject Photo Submission
            </h3>
            <p className="m-0 mb-3.5 text-xs text-slate-500 dark:text-slate-400">
              Please provide a reason for rejecting the photograph for <strong className="text-slate-800 dark:text-slate-200">{rejectingPhoto.applicant_name}</strong>.
            </p>

            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
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
                  className={`py-1 px-2 rounded-md text-xs cursor-pointer transition-colors ${
                    rejectReason === chip
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/35'
                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-200/60'
                  }`}
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
              className="w-full py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs resize-none mb-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectingPhoto(null)}
                className="py-2 px-3.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent text-slate-600 dark:text-slate-400 font-semibold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoading === rejectingPhoto.id}
                className="py-2 px-4 rounded-lg border-0 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs cursor-pointer shadow-xs transition-colors"
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
