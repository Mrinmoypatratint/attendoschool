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
  Calendar,
  Check,
  X,
  User,
  GraduationCap,
  AlertTriangle,
  FileText,
  Eye
} from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';

interface LeaveRequest {
  id: string;
  school_id: string;
  applicant_type: 'STUDENT' | 'TEACHER';
  applicant_id: string;
  applicant_name: string;
  identifier?: string;
  detail?: string;
  photo_url?: string | null;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'SEEN' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string;
  reviewer_name?: string;
  review_notes?: string;
  created_at: string;
}

export default function LeaveApprove() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'SEEN' | 'APPROVED'>('PENDING');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, seen: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'TEACHER'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // View Details Modal State
  const [viewingLeave, setViewingLeave] = useState<LeaveRequest | null>(null);

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reviews/leaves');
      if (res.data?.success) {
        setLeaves(res.data.data || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err: any) {
      console.error('Failed to load leave requests:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to load leave applications.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleViewLeave = async (leave: LeaveRequest) => {
    const isPending = leave.status === 'PENDING';
    const updatedLeave: LeaveRequest = isPending
      ? { ...leave, status: 'SEEN', review_notes: 'Seen by Faculty' }
      : leave;

    setViewingLeave(updatedLeave);

    if (isPending) {
      setLeaves((prev) =>
        prev.map((l) =>
          l.id === leave.id ? { ...l, status: 'SEEN', review_notes: 'Seen by Faculty' } : l
        )
      );
      setCounts((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        seen: (prev.seen || 0) + 1
      }));
      try {
        await api.put(`/reviews/leaves/${leave.id}/seen`);
      } catch (err) {
        console.error('Failed to mark leave as seen on server:', err);
      } finally {
        window.dispatchEvent(new CustomEvent('reviews-updated'));
      }
    }
  };

  // Calculate day difference
  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  // Format date helper
  const formatDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Filter leaves based on active tab, role, and search
  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      // Tab filter
      if (activeTab === 'PENDING' && l.status !== 'PENDING') return false;
      if (activeTab === 'SEEN' && l.status !== 'SEEN') return false;
      if (activeTab === 'APPROVED' && l.status !== 'APPROVED') return false;

      // Role filter
      if (roleFilter !== 'ALL' && l.applicant_type !== roleFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = l.applicant_name?.toLowerCase().includes(q);
        const idMatch = l.identifier?.toLowerCase().includes(q);
        const reasonMatch = l.reason?.toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !reasonMatch) return false;
      }

      return true;
    });
  }, [leaves, activeTab, roleFilter, searchQuery]);

  return (
    <div className="student-subpage" style={{ padding: '24px 28px', maxWidth: 1280, margin: '0 auto' }}>
      {/* ── Page Header (Matching screenshot style) ── */}
      <div className="student-subpage-header" style={{ marginBottom: 20 }}>
        <div className="student-subpage-title-row">
          <Link to="/dashboard" className="student-back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563EB', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginBottom: 4 }}>
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text, #0F172A)', margin: '2px 0 4px' }}>
            Leave Review
          </h1>
          <p className="student-subpage-desc" style={{ fontSize: 14, color: 'var(--text-secondary, #64748B)', margin: 0 }}>
            Review, evaluate, and approve submitted student leave applications.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLeaves}
          className="student-btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border, #E2E8F0)', background: 'var(--surface, #FFF)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback Banner */}
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

      {/* ── Tabs ── */}
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
          className={`student-tab-btn ${activeTab === 'SEEN' ? 'active' : ''}`}
          onClick={() => setActiveTab('SEEN')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 16px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'SEEN' ? '2px solid #2563EB' : '2px solid transparent',
            color: activeTab === 'SEEN' ? '#2563EB' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          Seen ({counts.seen || 0})
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

      {/* Search and Role Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', minWidth: 260, flex: 1, maxWidth: 400 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search by student name, roll no, reason..."
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
          <div>Loading leave applications...</div>
        </div>
      ) : filteredLeaves.length === 0 ? (
        /* Empty State matching user's screenshot */
        <div className="student-empty-state" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary, #64748B)', fontSize: 14, background: 'var(--surface, #FFF)', border: '1px dashed var(--border, #E2E8F0)', borderRadius: 12 }}>
          <Calendar size={36} style={{ color: '#CBD5E1', marginBottom: 12 }} />
          <p style={{ margin: 0, fontWeight: 500, fontSize: 15, color: 'var(--text, #334155)' }}>
            No leave requests found in this category.
          </p>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
            {activeTab === 'PENDING' ? 'No pending leave applications awaiting approval.' : 'No leave records to display.'}
          </p>
        </div>
      ) : (
        /* Leave Cards Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 20
          }}
        >
          {filteredLeaves.map((leave) => {
            const numDays = calculateDays(leave.start_date, leave.end_date);
            return (
              <div
                key={leave.id}
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
                {/* Header: Status and Submission Time */}
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
                    {leave.status === 'PENDING' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                        <Clock size={12} /> Pending Review
                      </span>
                    ) : leave.status === 'SEEN' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF2FF', color: '#4338CA', padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                        <Eye size={12} /> Seen
                      </span>
                    ) : leave.status === 'APPROVED' ? (
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
                    Submitted {leave.created_at ? new Date(leave.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </span>
                </div>

                {/* Candidate Info */}
                <div style={{ padding: '16px 16px 12px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: '#EFF6FF',
                        color: '#2563EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 700,
                        border: '1px solid #DBEAFE',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                    >
                      {leave.photo_url ? (
                        <img src={leave.photo_url} alt={leave.applicant_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        leave.applicant_name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
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
                            background: leave.applicant_type === 'STUDENT' ? '#EFF6FF' : '#F3E8FF',
                            color: leave.applicant_type === 'STUDENT' ? '#1D4ED8' : '#7E22CE'
                          }}
                        >
                          {leave.applicant_type === 'STUDENT' ? <User size={11} /> : <GraduationCap size={11} />}
                          {leave.applicant_type === 'STUDENT' ? 'Student' : 'Teacher'}
                        </span>
                      </div>

                      <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                        {leave.applicant_name}
                      </h3>

                      <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748B)' }}>
                        {leave.detail || `ID: ${leave.identifier || 'N/A'}`}
                      </div>
                    </div>
                  </div>

                  {/* Dates Box */}
                  <div
                    style={{
                      background: 'var(--gray-50, #F8FAFC)',
                      border: '1px solid var(--border, #E2E8F0)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={16} style={{ color: '#2563EB' }} />
                      <div>
                        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>LEAVE PERIOD</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                          {formatDate(leave.start_date)} → {formatDate(leave.end_date)}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        background: '#DBEAFE',
                        color: '#1E40AF',
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: 6
                      }}
                    >
                      {numDays} {numDays === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>

                  {/* Reason Box */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                      <FileText size={12} /> REASON
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text, #334155)',
                        background: 'var(--surface, #FFF)',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border, #E2E8F0)',
                        lineHeight: 1.45
                      }}
                    >
                      {leave.reason}
                    </div>
                  </div>

                  {/* Approval / Rejection Notes */}
                  {leave.status === 'APPROVED' && (
                    <div style={{ fontSize: 12, color: '#166534', background: '#F0FDF4', padding: '6px 10px', borderRadius: 6 }}>
                      Approved {leave.reviewer_name ? `by ${leave.reviewer_name}` : ''}
                      {leave.review_notes ? ` · Note: ${leave.review_notes}` : ''}
                    </div>
                  )}

                  {leave.status === 'REJECTED' && (
                    <div style={{ fontSize: 12, color: '#991B1B', background: '#FEF2F2', padding: '6px 10px', borderRadius: 6 }}>
                      Rejected {leave.reviewer_name ? `by ${leave.reviewer_name}` : ''}
                      {leave.review_notes ? ` · Reason: ${leave.review_notes}` : ''}
                    </div>
                  )}
                </div>

                {/* Single View Button replacing Approve and Reject buttons */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid var(--border, #E2E8F0)',
                    background: 'var(--bg-card-footer, #FAFAFA)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleViewLeave(leave)}
                    style={{
                      width: '100%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      background: '#2563EB',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: 8,
                      padding: '9px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                  >
                    <Eye size={15} />
                    <span>View</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── View Application Details Modal ── */}
      {viewingLeave && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 20
          }}
          onClick={() => setViewingLeave(null)}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              borderRadius: 16,
              maxWidth: 520,
              width: '100%',
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border, #E2E8F0)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid var(--border, #E2E8F0)', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                    Leave Application Details
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #64748B)' }}>
                    Submitted {viewingLeave.created_at ? new Date(viewingLeave.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingLeave(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 22,
                  lineHeight: 1,
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                ×
              </button>
            </div>

            {/* Applicant Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--gray-50, #F8FAFC)', borderRadius: 12, marginBottom: 18, border: '1px solid var(--border, #E2E8F0)' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  border: '2px solid #DBEAFE',
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                {viewingLeave.photo_url ? (
                  <img src={viewingLeave.photo_url} alt={viewingLeave.applicant_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  viewingLeave.applicant_name.charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                    {viewingLeave.applicant_name}
                  </h4>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: viewingLeave.applicant_type === 'STUDENT' ? '#EFF6FF' : '#F3E8FF',
                      color: viewingLeave.applicant_type === 'STUDENT' ? '#1D4ED8' : '#7E22CE'
                    }}
                  >
                    {viewingLeave.applicant_type === 'STUDENT' ? 'Student' : 'Teacher'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)' }}>
                  {viewingLeave.detail || `Admission No: ${viewingLeave.identifier || 'N/A'}`}
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {viewingLeave.status === 'SEEN' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#EEF2FF', color: '#4338CA', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    <Eye size={13} /> Seen
                  </span>
                ) : viewingLeave.status === 'PENDING' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FEF3C7', color: '#92400E', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    <Clock size={13} /> Pending Review
                  </span>
                ) : viewingLeave.status === 'APPROVED' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#DCFCE7', color: '#166534', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    <CheckCircle2 size={13} /> Approved
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FEE2E2', color: '#991B1B', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    <XCircle size={13} /> Rejected
                  </span>
                )}
              </div>
            </div>

            {/* Leave Details Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div
                style={{
                  background: 'var(--gray-50, #F8FAFC)',
                  border: '1px solid var(--border, #E2E8F0)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Calendar size={18} style={{ color: '#2563EB' }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>REQUESTED DURATION</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                      {formatDate(viewingLeave.start_date)} → {formatDate(viewingLeave.end_date)}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    background: '#DBEAFE',
                    color: '#1E40AF',
                    fontSize: 12.5,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 8
                  }}
                >
                  {calculateDays(viewingLeave.start_date, viewingLeave.end_date)} {calculateDays(viewingLeave.start_date, viewingLeave.end_date) === 1 ? 'Day' : 'Days'}
                </span>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>
                  <FileText size={13} /> REASON FOR LEAVE
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    color: 'var(--text, #334155)',
                    background: 'var(--surface, #FFF)',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border, #E2E8F0)',
                    lineHeight: 1.5,
                    minHeight: 60
                  }}
                >
                  {viewingLeave.reason}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--border, #E2E8F0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#16A34A', fontWeight: 600 }}>
                <CheckCircle2 size={16} />
                <span>Marked as Seen in Student Portal</span>
              </div>
              <button
                type="button"
                onClick={() => setViewingLeave(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2563EB',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
