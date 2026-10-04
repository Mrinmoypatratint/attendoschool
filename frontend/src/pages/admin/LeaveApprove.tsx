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
  FileText
} from 'lucide-react';
import { api } from '../../api';

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
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string;
  reviewer_name?: string;
  review_notes?: string;
  created_at: string;
}

export default function LeaveApprove() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED'>('PENDING');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'TEACHER'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reject Modal State
  const [rejectingLeave, setRejectingLeave] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

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

  const handleApprove = async (leave: LeaveRequest) => {
    try {
      setActionLoading(leave.id);
      const res = await api.put(`/reviews/leaves/${leave.id}/approve`, {
        notes: 'Approved by School Administration'
      });
      if (res.data?.success) {
        setFeedback({ type: 'success', message: `Leave request for ${leave.applicant_name} has been approved.` });
        await loadLeaves();
      }
    } catch (err: any) {
      console.error('Failed to approve leave:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to approve leave request.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingLeave) return;
    try {
      setActionLoading(rejectingLeave.id);
      const res = await api.put(`/reviews/leaves/${rejectingLeave.id}/reject`, {
        reason: rejectReason.trim() || 'Leave request declined by School Administration.'
      });
      if (res.data?.success) {
        setFeedback({ type: 'success', message: `Leave request for ${rejectingLeave.applicant_name} has been rejected.` });
        setRejectingLeave(null);
        setRejectReason('');
        await loadLeaves();
      }
    } catch (err: any) {
      console.error('Failed to reject leave:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to reject leave.' });
    } finally {
      setActionLoading(null);
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
            Leave Applications
          </h1>
          <p className="student-subpage-desc" style={{ fontSize: 14, color: 'var(--text-secondary, #64748B)', margin: 0 }}>
            Review, evaluate, and approve submitted student and staff leave applications.
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

                {/* Actions for PENDING */}
                {leave.status === 'PENDING' && (
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
                      onClick={() => handleApprove(leave)}
                      disabled={actionLoading === leave.id}
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
                        opacity: actionLoading === leave.id ? 0.7 : 1,
                        transition: 'background 0.15s'
                      }}
                    >
                      <Check size={15} />
                      <span>{actionLoading === leave.id ? 'Approving...' : 'Approve'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRejectingLeave(leave);
                        setRejectReason('');
                      }}
                      disabled={actionLoading === leave.id}
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
            );
          })}
        </div>
      )}

      {/* ── Reject Reason Dialog Modal ── */}
      {rejectingLeave && (
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
          onClick={() => setRejectingLeave(null)}
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
              Decline Leave Request
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748B' }}>
              Please specify the reason for declining leave for <strong>{rejectingLeave.applicant_name}</strong>.
            </p>

            {/* Quick Reason Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {[
                'Medical Certificate Required',
                'Examinations in Progress',
                'Exceeded Allowed Leave Days',
                'Insufficient Notice Given'
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
              placeholder="Enter rejection explanation or instructions..."
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
                onClick={() => setRejectingLeave(null)}
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
                disabled={actionLoading === rejectingLeave.id}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: actionLoading === rejectingLeave.id ? 0.7 : 1
                }}
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
