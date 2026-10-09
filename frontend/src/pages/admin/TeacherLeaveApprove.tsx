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
  Eye,
  MessageSquare,
  Paperclip,
  Image as ImageIcon,
  Download,
  ExternalLink
} from 'lucide-react';
import { api } from '../../api';

interface TeacherLeave {
  id: string;
  school_id: string;
  applicant_type: 'TEACHER';
  applicant_id: string;
  applicant_name: string;
  teacher_email?: string;
  identifier?: string;
  detail?: string;
  photo_url?: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  document_url?: string;
  document_name?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string;
  reviewer_name?: string;
  review_notes?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at?: string;
}

const LEAVE_TYPES = [
  { value: 'ALL', label: 'All Leave Types' },
  { value: 'CASUAL', label: 'Casual Leave (CL)', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'SICK', label: 'Sick / Medical Leave (SL)', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { value: 'EARNED', label: 'Earned / Privilege Leave (EL)', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { value: 'EMERGENCY', label: 'Emergency Leave', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'DUTY', label: 'Official Duty (OD)', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  { value: 'MATERNITY', label: 'Maternity / Paternity', color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8' },
  { value: 'OTHER', label: 'Other Leave', color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' }
];

export default function TeacherLeaveApprove() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [leaves, setLeaves] = useState<TeacherLeave[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Detail Modal State
  const [viewingLeave, setViewingLeave] = useState<TeacherLeave | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ url: string; name: string } | null>(null);

  // Approve Modal State
  const [approvingLeave, setApprovingLeave] = useState<TeacherLeave | null>(null);
  const [approveNotes, setApproveNotes] = useState<string>('Approved by School Administration');

  // Reject Modal State
  const [rejectingLeave, setRejectingLeave] = useState<TeacherLeave | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const openDocumentInNewTab = (dataUrl: string) => {
    try {
      if (dataUrl.startsWith('data:')) {
        const parts = dataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        return;
      }
      window.open(dataUrl, '_blank');
    } catch {
      window.open(dataUrl, '_blank');
    }
  };

  const downloadDocument = (dataUrl: string, filename: string = 'document') => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reviews/teacher-leaves');
      if (res.data?.success) {
        setLeaves(res.data.data || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err: any) {
      console.error('Failed to load faculty leave requests:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to load teacher leave applications.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleApprove = async () => {
    if (!approvingLeave) return;
    try {
      setActionLoading(approvingLeave.id);
      const res = await api.put(`/reviews/teacher-leaves/${approvingLeave.id}/approve`, {
        notes: approveNotes.trim() || 'Approved by School Administration'
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Leave request for ${approvingLeave.applicant_name} has been approved.`
        });
        setApprovingLeave(null);
        if (viewingLeave?.id === approvingLeave.id) {
          setViewingLeave((prev) => (prev ? { ...prev, status: 'APPROVED', review_notes: approveNotes } : null));
        }
        await loadLeaves();
        window.dispatchEvent(new CustomEvent('reviews-updated'));
      }
    } catch (err: any) {
      console.error('Failed to approve teacher leave:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to approve leave request.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingLeave) return;
    try {
      setActionLoading(rejectingLeave.id);
      const notes = rejectReason.trim() || 'Declined by School Administration';
      const res = await api.put(`/reviews/teacher-leaves/${rejectingLeave.id}/reject`, {
        reason: notes,
        notes
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Leave request for ${rejectingLeave.applicant_name} has been rejected.`
        });
        setRejectingLeave(null);
        setRejectReason('');
        if (viewingLeave?.id === rejectingLeave.id) {
          setViewingLeave((prev) => (prev ? { ...prev, status: 'REJECTED', review_notes: notes } : null));
        }
        await loadLeaves();
        window.dispatchEvent(new CustomEvent('reviews-updated'));
      }
    } catch (err: any) {
      console.error('Failed to reject teacher leave:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to reject leave request.' });
    } finally {
      setActionLoading(null);
    }
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const formatDate = (val: string) => {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getLeaveTypeStyle = (type: string) => {
    const norm = String(type || 'CASUAL').toUpperCase();
    const found = LEAVE_TYPES.find((t) => t.value === norm);
    if (found && found.color) {
      return found;
    }
    return {
      value: norm,
      label: norm + ' Leave',
      color: '#4B5563',
      bg: '#F3F4F6',
      border: '#E5E7EB'
    };
  };

  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      // Status Tab filter
      if (activeTab !== 'ALL' && l.status !== activeTab) {
        return false;
      }

      // Leave Type filter
      if (typeFilter !== 'ALL' && String(l.leave_type || 'CASUAL').toUpperCase() !== typeFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = l.applicant_name?.toLowerCase().includes(q);
        const emailMatch = l.teacher_email?.toLowerCase().includes(q);
        const idMatch = l.identifier?.toLowerCase().includes(q);
        const reasonMatch = l.reason?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !idMatch && !reasonMatch) return false;
      }

      return true;
    });
  }, [leaves, activeTab, typeFilter, searchQuery]);

  return (
    <div className="student-subpage" style={{ padding: '24px 28px', maxWidth: 1280, margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div className="student-subpage-header" style={{ marginBottom: 20 }}>
        <div className="student-subpage-title-row">
          <Link
            to="/dashboard"
            className="student-back-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#2563EB',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              marginBottom: 4
            }}
          >
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text, #0F172A)', margin: '2px 0 4px' }}>
            Teacher's Leave Review
          </h1>
          <p className="student-subpage-desc" style={{ fontSize: 14, color: 'var(--text-secondary, #64748B)', margin: 0 }}>
            Review, approve, or reject leave applications submitted by faculty members across all departments.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLeaves}
          className="student-btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border, #E2E8F0)',
            background: 'var(--surface, #FFF)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text, #0F172A)'
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Feedback Banner ── */}
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: 8,
            marginBottom: 16,
            background: feedback.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${feedback.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            color: feedback.type === 'success' ? '#166534' : '#991B1B',
            fontSize: 13.5
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── KPI Stat Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}
      >
        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending Review
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#B45309', marginTop: 4 }}>
              {counts.pending}
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Clock size={22} />
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Approved
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#15803D', marginTop: 4 }}>
              {counts.approved}
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#DCFCE7',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rejected
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#B91C1C', marginTop: 4 }}>
              {counts.rejected}
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#FEE2E2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <XCircle size={22} />
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Submissions
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0F172A)', marginTop: 4 }}>
              {counts.all}
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <FileText size={22} />
          </div>
        </div>
      </div>

      {/* ── Status Tab Navigation ── */}
      <div
        className="student-tab-bar"
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border, #E2E8F0)',
          marginBottom: 20
        }}
      >
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'PENDING' ? 'active' : ''}`}
          onClick={() => setActiveTab('PENDING')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '9px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'PENDING' ? '2px solid #D97706' : '2px solid transparent',
            color: activeTab === 'PENDING' ? '#D97706' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          Pending Review ({counts.pending})
        </button>
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '9px 18px',
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
          className={`student-tab-btn ${activeTab === 'APPROVED' ? 'active' : ''}`}
          onClick={() => setActiveTab('APPROVED')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '9px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'APPROVED' ? '2px solid #16A34A' : '2px solid transparent',
            color: activeTab === 'APPROVED' ? '#16A34A' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          Approved ({counts.approved})
        </button>
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'REJECTED' ? 'active' : ''}`}
          onClick={() => setActiveTab('REJECTED')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '9px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'REJECTED' ? '2px solid #DC2626' : '2px solid transparent',
            color: activeTab === 'REJECTED' ? '#DC2626' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          Rejected ({counts.rejected})
        </button>
      </div>

      {/* ── Search and Filter Controls ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}
      >
        <div style={{ position: 'relative', minWidth: 260, flex: 1, maxWidth: 400 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary, #64748B)' }} />
          <input
            type="text"
            placeholder="Search teacher, email, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: 8,
              border: '1px solid var(--border, #E2E8F0)',
              background: 'var(--surface, #FFF)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary, #64748B)' }}>
            <Filter size={14} />
            <span>Type:</span>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #E2E8F0)',
              background: 'var(--surface, #FFF)',
              fontSize: 13,
              color: 'var(--text, #0F172A)',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {LEAVE_TYPES.map((lt) => (
              <option key={lt.value} value={lt.value}>
                {lt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Leave Requests Table Card ── */}
      <div
        className="student-card"
        style={{
          background: 'var(--surface, #FFF)',
          border: '1px solid var(--border, #E2E8F0)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary, #64748B)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ margin: 0, fontSize: 14 }}>Loading leave applications...</p>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary, #64748B)' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#ECFDF5',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px'
              }}
            >
              <CheckCircle2 size={26} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #0F172A)', margin: '0 0 6px' }}>
              No Leave Requests Found
            </h3>
            <p style={{ fontSize: 13.5, margin: 0 }}>
              {activeTab === 'PENDING'
                ? 'All teacher leave requests have been reviewed.'
                : `No faculty applications currently match the selected criteria.`}
            </p>
          </div>
        ) : (
          <div className="student-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="student-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--table-header, #F8FAFC)', borderBottom: '1px solid var(--border, #E2E8F0)' }}>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    FACULTY MEMBER
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    LEAVE TYPE
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    DURATION & PERIOD
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    REASON / DETAILS
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    STATUS
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', textAlign: 'right' }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((l) => {
                  const typeObj = getLeaveTypeStyle(l.leave_type);
                  const days = calculateDays(l.start_date, l.end_date);
                  const isPending = l.status === 'PENDING';
                  const initials = (l.applicant_name || 'TC')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={l.id}
                      style={{
                        borderBottom: '1px solid var(--border, #E2E8F0)',
                        transition: 'background 0.15s'
                      }}
                    >
                      {/* Faculty Info */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {l.photo_url ? (
                            <img
                              src={l.photo_url}
                              alt={l.applicant_name}
                              style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '1px solid #BFDBFE' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                background: '#EFF6FF',
                                color: '#2563EB',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: 13,
                                flexShrink: 0
                              }}
                            >
                              {initials}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text, #0F172A)' }}>
                              {l.applicant_name}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748B)' }}>
                              {l.teacher_email || l.identifier || 'Faculty Member'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Leave Type */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 9px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            background: typeObj.bg,
                            color: typeObj.color,
                            border: `1px solid ${typeObj.border}`
                          }}
                        >
                          {typeObj.label}
                        </span>
                      </td>

                      {/* Duration & Period */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text, #0F172A)' }}>
                          {formatDate(l.start_date)} → {formatDate(l.end_date)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748B)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} />
                          <span>{days} {days === 1 ? 'Day' : 'Days'}</span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top', maxWidth: 280 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13.5,
                            color: 'var(--text, #0F172A)',
                            lineHeight: 1.45,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}
                          title={l.reason}
                        >
                          {l.reason}
                        </p>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted, #94A3B8)', marginTop: 3 }}>
                          Applied: {formatDate(l.created_at)}
                        </div>
                        {l.document_url && (
                          <div style={{ marginTop: 6 }}>
                            <button
                              type="button"
                              onClick={() => setViewingDoc({ url: l.document_url!, name: l.document_name || `${l.applicant_name} Leave Document` })}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '3px 8px',
                                borderRadius: 5,
                                border: '1px solid #BFDBFE',
                                background: '#EFF6FF',
                                color: '#1D4ED8',
                                fontSize: 11.5,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background 0.15s'
                              }}
                              title="View Supporting Document"
                            >
                              <Paperclip size={11} />
                              <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {l.document_name || 'View Document'}
                              </span>
                              <Eye size={11} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        {l.status === 'PENDING' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '4px 9px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              background: '#FEF3C7',
                              color: '#B45309',
                              border: '1px solid #FDE68A'
                            }}
                          >
                            <Clock size={12} />
                            Pending
                          </span>
                        )}
                        {l.status === 'APPROVED' && (
                          <div>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 9px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                background: '#DCFCE7',
                                color: '#15803D',
                                border: '1px solid #BBF7D0'
                              }}
                            >
                              <CheckCircle2 size={12} />
                              Approved
                            </span>
                            {l.review_notes && (
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #64748B)', marginTop: 3 }}>
                                "{l.review_notes}"
                              </div>
                            )}
                          </div>
                        )}
                        {l.status === 'REJECTED' && (
                          <div>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 9px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                background: '#FEE2E2',
                                color: '#B91C1C',
                                border: '1px solid #FECACA'
                              }}
                            >
                              <XCircle size={12} />
                              Rejected
                            </span>
                            {l.review_notes && (
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #64748B)', marginTop: 3 }}>
                                "{l.review_notes}"
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setViewingLeave(l)}
                            title="View Full Details"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid var(--border, #E2E8F0)',
                              background: 'var(--surface, #FFF)',
                              color: 'var(--text, #0F172A)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12.5,
                              fontWeight: 600
                            }}
                          >
                            <Eye size={13} />
                            <span>Details</span>
                          </button>

                          {isPending && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading === l.id}
                                onClick={() => {
                                  setApprovingLeave(l);
                                  setApproveNotes('Approved by School Administration');
                                }}
                                title="Approve Request"
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  border: 'none',
                                  background: '#16A34A',
                                  color: '#FFF',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  boxShadow: '0 1px 2px rgba(22,163,74,0.2)'
                                }}
                              >
                                <Check size={13} />
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                disabled={actionLoading === l.id}
                                onClick={() => {
                                  setRejectingLeave(l);
                                  setRejectReason('');
                                }}
                                title="Reject Request"
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  border: '1px solid #FECACA',
                                  background: '#FEF2F2',
                                  color: '#DC2626',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 12.5,
                                  fontWeight: 600
                                }}
                              >
                                <X size={13} />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── View Details Modal ── */}
      {viewingLeave && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingLeave(null);
          }}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 540,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--border, #E2E8F0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--modal-header, #F8FAFC)'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                  Faculty Leave Request Details
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary, #64748B)' }}>
                  Submitted on {formatDate(viewingLeave.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingLeave(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #64748B)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 22px' }}>
              {/* Teacher Summary Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--background, #F8FAFC)',
                  border: '1px solid var(--border, #E2E8F0)',
                  marginBottom: 16
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#2563EB',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 15
                  }}
                >
                  {(viewingLeave.applicant_name || 'TC').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text, #0F172A)' }}>
                    {viewingLeave.applicant_name}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #64748B)' }}>
                    {viewingLeave.teacher_email || viewingLeave.identifier || 'Faculty Member'}
                  </div>
                </div>
              </div>

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)' }}>LEAVE TYPE</div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        padding: '4px 9px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        ...getLeaveTypeStyle(viewingLeave.leave_type)
                      }}
                    >
                      {getLeaveTypeStyle(viewingLeave.leave_type).label}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)' }}>TOTAL DURATION</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text, #0F172A)', marginTop: 4 }}>
                    {calculateDays(viewingLeave.start_date, viewingLeave.end_date)} Days
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)' }}>FROM DATE</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text, #0F172A)', marginTop: 4 }}>
                    {formatDate(viewingLeave.start_date)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)' }}>TO DATE</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text, #0F172A)', marginTop: 4 }}>
                    {formatDate(viewingLeave.end_date)}
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)', marginBottom: 6 }}>
                  REASON FOR LEAVE
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'var(--background, #F8FAFC)',
                    border: '1px solid var(--border, #E2E8F0)',
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    color: 'var(--text, #0F172A)'
                  }}
                >
                  {viewingLeave.reason}
                </div>
              </div>

              {/* Attached Supporting Document */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)', marginBottom: 6 }}>
                  ATTACHED SUPPORTING DOCUMENT / PROOF
                </div>
                {viewingLeave.document_url ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          background: '#2563EB',
                          color: '#FFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {viewingLeave.document_url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(viewingLeave.document_url) ? (
                          <ImageIcon size={18} />
                        ) : (
                          <FileText size={18} />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1E3A8A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {viewingLeave.document_name || 'Faculty Leave Document'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#3B82F6', marginTop: 1 }}>
                          Supporting proof provided by faculty member
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setViewingDoc({ url: viewingLeave.document_url!, name: viewingLeave.document_name || `${viewingLeave.applicant_name} Leave Document` })}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#2563EB',
                          color: '#FFF',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={13} />
                        <span>View Document</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--background, #F8FAFC)',
                      border: '1px solid var(--border, #E2E8F0)',
                      fontSize: 12.5,
                      color: 'var(--text-muted, #94A3B8)',
                      fontStyle: 'italic'
                    }}
                  >
                    No supporting document attached for this request.
                  </div>
                )}
              </div>

              {/* Status & Review Info */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #E2E8F0)',
                  background: viewingLeave.status === 'APPROVED' ? '#F0FDF4' : viewingLeave.status === 'REJECTED' ? '#FEF2F2' : '#FFFBEB'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: viewingLeave.status === 'APPROVED' ? '#166534' : viewingLeave.status === 'REJECTED' ? '#991B1B' : '#92400E' }}>
                    Status: {viewingLeave.status}
                  </span>
                  {viewingLeave.reviewed_at && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #64748B)' }}>
                      Reviewed on {formatDate(viewingLeave.reviewed_at)}
                    </span>
                  )}
                </div>
                {viewingLeave.review_notes && (
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text, #0F172A)' }}>
                    Remarks: <b>{viewingLeave.review_notes}</b> ({viewingLeave.reviewer_name || 'Admin'})
                  </p>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid var(--border, #E2E8F0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 10
              }}
            >
              <button
                type="button"
                onClick={() => setViewingLeave(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #E2E8F0)',
                  background: 'var(--surface, #FFF)',
                  color: 'var(--text, #0F172A)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>

              {viewingLeave.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setApprovingLeave(viewingLeave);
                      setApproveNotes('Approved by School Administration');
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#16A34A',
                      color: '#FFF',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Approve Request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingLeave(viewingLeave);
                      setRejectReason('');
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Reject Request
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Approve Modal ── */}
      {approvingLeave && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1010,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setApprovingLeave(null);
          }}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={20} color="#16A34A" />
                <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                  Approve Faculty Leave
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setApprovingLeave(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #64748B)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 22px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--text, #0F172A)' }}>
                Are you sure you want to approve <b>{approvingLeave.applicant_name}</b>'s leave request for{' '}
                <b>{calculateDays(approvingLeave.start_date, approvingLeave.end_date)} day(s)</b> ({formatDate(approvingLeave.start_date)} to {formatDate(approvingLeave.end_date)})?
              </p>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)', marginBottom: 6 }}>
                  Approval Remarks (Optional):
                </label>
                <input
                  type="text"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Approved by School Administration"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #CBD5E1)',
                    background: 'var(--surface, #FFF)',
                    color: 'var(--text, #0F172A)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setApprovingLeave(null)}
                disabled={actionLoading === approvingLeave.id}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #CBD5E1)',
                  background: 'var(--surface, #FFF)',
                  color: 'var(--text, #0F172A)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading === approvingLeave.id}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#16A34A',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                {actionLoading === approvingLeave.id ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectingLeave && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1010,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setRejectingLeave(null);
          }}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <XCircle size={20} color="#DC2626" />
                <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                  Reject Faculty Leave Application
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingLeave(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #64748B)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 22px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--text, #0F172A)' }}>
                Please provide a rejection note or reason for declining <b>{rejectingLeave.applicant_name}</b>'s leave request:
              </p>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)', marginBottom: 6 }}>
                  Reason for Rejection <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Inadequate staffing for scheduled examinations, please reschedule..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #CBD5E1)',
                    background: 'var(--surface, #FFF)',
                    color: 'var(--text, #0F172A)',
                    fontSize: 13,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setRejectingLeave(null)}
                disabled={actionLoading === rejectingLeave.id}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #CBD5E1)',
                  background: 'var(--surface, #FFF)',
                  color: 'var(--text, #0F172A)',
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
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                {actionLoading === rejectingLeave.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Preview Modal ── */}
      {viewingDoc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingDoc(null);
          }}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border, #E2E8F0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--modal-header, #F8FAFC)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Paperclip size={18} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #0F172A)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {viewingDoc.name}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => openDocumentInNewTab(viewingDoc.url)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #CBD5E1)',
                    background: '#FFF',
                    color: 'var(--text, #0F172A)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                  title="Open in new window"
                >
                  <ExternalLink size={13} />
                  <span>Open New Tab</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadDocument(viewingDoc.url, viewingDoc.name)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#2563EB',
                    color: '#FFF',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                  title="Download File"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary, #64748B)',
                    padding: 4,
                    marginLeft: 4
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F1F5F9' }}>
              {viewingDoc.url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(viewingDoc.url) ? (
                <img
                  src={viewingDoc.url}
                  alt={viewingDoc.name}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
              ) : viewingDoc.url.startsWith('data:application/pdf') || /\.pdf$/i.test(viewingDoc.url) ? (
                <iframe
                  src={viewingDoc.url}
                  title={viewingDoc.name}
                  style={{ width: '100%', height: '65vh', border: 'none', borderRadius: 8 }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#FFF', borderRadius: 10, width: '100%', maxWidth: 420 }}>
                  <FileText size={48} color="#2563EB" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A', marginBottom: 4 }}>
                    {viewingDoc.name}
                  </div>
                  <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
                    Direct inline preview is not supported for this file type. Please open or download it to view.
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadDocument(viewingDoc.url, viewingDoc.name)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#2563EB',
                      color: '#FFF',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Download size={14} />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
