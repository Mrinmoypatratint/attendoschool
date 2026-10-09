import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  ArrowLeft,
  Send,
  CheckCircle2,
  Plus,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  UserCheck,
  Info,
  X,
  Paperclip,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

export interface TeacherLeaveItem {
  id: string;
  school_id: string;
  teacher_id: string;
  teacher_name?: string;
  teacher_email?: string;
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
  { value: 'CASUAL', label: 'Casual Leave (CL)', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'SICK', label: 'Sick / Medical Leave (SL)', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { value: 'EARNED', label: 'Earned / Privilege Leave (EL)', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { value: 'EMERGENCY', label: 'Emergency Leave', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'DUTY', label: 'On Official Duty (OD)', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  { value: 'MATERNITY', label: 'Maternity / Paternity Leave', color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8' },
  { value: 'OTHER', label: 'Other Leave', color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' }
];

export default function TeacherLeaveRequest() {
  const [requests, setRequests] = useState<TeacherLeaveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [openModal, setOpenModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [reason, setReason] = useState('');
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [documentName, setDocumentName] = useState<string>('');
  const [documentSize, setDocumentSize] = useState<string>('');
  const [fileError, setFileError] = useState<string>('');
  const [previewingDoc, setPreviewingDoc] = useState<{ url: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');

    // Limit 10MB
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size exceeds the 10MB limit. Please choose a smaller document.');
      return;
    }

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    setDocumentName(file.name);
    setDocumentSize(formatBytes(file.size));

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDocumentUrl(reader.result);
      }
    };
    reader.onerror = () => {
      setFileError('Failed to read the selected file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDocument = () => {
    setDocumentUrl('');
    setDocumentName('');
    setDocumentSize('');
    setFileError('');
  };

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

  const loadMyLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reviews/teacher-leaves/my');
      if (res.data?.success) {
        setRequests(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load faculty leaves:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to load your leave history.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyLeaves();
  }, []);

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === 'PENDING').length,
      approved: requests.filter((r) => r.status === 'APPROVED').length,
      rejected: requests.filter((r) => r.status === 'REJECTED').length
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (activeTab === 'ALL') return requests;
    return requests.filter((r) => r.status === activeTab);
  }, [requests, activeTab]);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const currentDurationDays = useMemo(() => {
    return calculateDays(startDate, endDate);
  }, [startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason.trim()) {
      setFeedback({ type: 'error', message: 'Please provide start date, end date, and reason for leave.' });
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setFeedback({ type: 'error', message: 'End date cannot be prior to start date.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/reviews/teacher-leaves', {
        startDate,
        endDate,
        leaveType,
        reason: reason.trim(),
        documentUrl: documentUrl || undefined,
        documentName: documentName || undefined
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: 'Leave application submitted successfully! It has been dispatched to School Administration for review.'
        });
        setOpenModal(false);
        setStartDate('');
        setEndDate('');
        setLeaveType('CASUAL');
        setReason('');
        setDocumentUrl('');
        setDocumentName('');
        setDocumentSize('');
        setFileError('');
        await loadMyLeaves();

        // Notify app-level listeners to refresh notification badge immediately
        window.dispatchEvent(new CustomEvent('reviews-updated'));
      }
    } catch (err: any) {
      console.error('Failed to submit leave request:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to submit leave application. Please verify details and try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (val: string) => {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getLeaveTypeObj = (type: string) => {
    const norm = String(type || 'CASUAL').toUpperCase();
    return (
      LEAVE_TYPES.find((t) => t.value === norm) || {
        value: norm,
        label: norm.charAt(0) + norm.slice(1).toLowerCase() + ' Leave',
        color: '#4B5563',
        bg: '#F3F4F6',
        border: '#E5E7EB'
      }
    );
  };

  return (
    <div className="student-subpage" style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Header ── */}
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
              marginBottom: 6
            }}
          >
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text, #0F172A)', margin: '2px 0 4px' }}>
            Faculty Leave Applications
          </h1>
          <p className="student-subpage-desc" style={{ fontSize: 14, color: 'var(--text-secondary, #64748B)', margin: 0 }}>
            Submit absence requests for School Administration review and track approval status in real-time.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={loadMyLeaves}
            className="student-btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 15px',
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
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setOpenModal(true);
            }}
            className="student-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 18px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 13.5,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
            }}
          >
            <Plus size={16} />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* ── Feedback Message Banner ── */}
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: 10,
            marginBottom: 20,
            background: feedback.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${feedback.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            color: feedback.type === 'success' ? '#166534' : '#991B1B',
            fontSize: 13.5,
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease-in'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Requests
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
          All Applications ({counts.all})
        </button>
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

      {/* ── Table Card ── */}
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
        ) : filteredRequests.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary, #64748B)' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px'
              }}
            >
              <FileText size={26} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #0F172A)', margin: '0 0 6px' }}>
              No Leave Requests Found
            </h3>
            <p style={{ fontSize: 13.5, margin: '0 0 16px', maxWidth: 420, marginInline: 'auto' }}>
              {activeTab === 'ALL'
                ? "You haven't submitted any leave requests yet. Click 'Apply for Leave' above to apply."
                : `No leave applications currently match the '${activeTab.toLowerCase()}' status filter.`}
            </p>
            {activeTab === 'ALL' && (
              <button
                type="button"
                onClick={() => setOpenModal(true)}
                className="student-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                <Plus size={15} /> Apply Now
              </button>
            )}
          </div>
        ) : (
          <div className="student-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="student-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--table-header, #F8FAFC)', borderBottom: '1px solid var(--border, #E2E8F0)' }}>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    LEAVE TYPE
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    DURATION & DATES
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    REASON / DETAILS
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    APPLIED ON
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    STATUS
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase' }}>
                    ADMIN REMARKS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((r) => {
                  const typeObj = getLeaveTypeObj(r.leave_type);
                  const days = calculateDays(r.start_date, r.end_date);
                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid var(--border, #E2E8F0)',
                        transition: 'background 0.15s'
                      }}
                    >
                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 10px',
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

                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text, #0F172A)' }}>
                          {formatDate(r.start_date)} → {formatDate(r.end_date)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748B)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} />
                          <span>{days} {days === 1 ? 'Day' : 'Days'}</span>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', verticalAlign: 'top', maxWidth: 300 }}>
                        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text, #0F172A)', lineHeight: 1.45 }}>
                          {r.reason}
                        </p>
                        {r.document_url && (
                          <div style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              onClick={() => setPreviewingDoc({ url: r.document_url!, name: r.document_name || 'Attached Document' })}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 9px',
                                borderRadius: 6,
                                border: '1px solid #BFDBFE',
                                background: '#EFF6FF',
                                color: '#1D4ED8',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background 0.15s'
                              }}
                              title="View Attached Document"
                            >
                              <Paperclip size={12} />
                              <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.document_name || 'View Document'}
                              </span>
                              <Eye size={12} />
                            </button>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px', verticalAlign: 'top', fontSize: 13, color: 'var(--text-secondary, #64748B)' }}>
                        {formatDate(r.created_at)}
                      </td>

                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        {r.status === 'PENDING' && (
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
                            Pending Review
                          </span>
                        )}
                        {r.status === 'APPROVED' && (
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
                        )}
                        {r.status === 'REJECTED' && (
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
                        )}
                      </td>

                      <td style={{ padding: '14px 18px', verticalAlign: 'top', fontSize: 13 }}>
                        {r.review_notes ? (
                          <div>
                            <div style={{ color: 'var(--text, #0F172A)', fontWeight: 500, fontSize: 13 }}>
                              {r.review_notes}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #64748B)', marginTop: 2 }}>
                              By {r.reviewer_name || 'Admin'} {r.reviewed_at ? `· ${formatDate(r.reviewed_at)}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted, #94A3B8)', fontSize: 12, fontStyle: 'italic' }}>
                            Awaiting school admin action
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Apply Leave Modal ── */}
      {openModal && (
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
            if (e.target === e.currentTarget && !submitting) setOpenModal(false);
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
              overflow: 'hidden',
              animation: 'scaleUp 0.18s ease-out'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border, #E2E8F0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--modal-header, #F8FAFC)'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                  Apply for Faculty Leave
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary, #64748B)' }}>
                  This request will be sent to the School Admin for review & approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                disabled={submitting}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #64748B)',
                  padding: 4,
                  borderRadius: 6
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
              {/* Leave Type */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)', marginBottom: 6 }}>
                  Leave Type <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #CBD5E1)',
                    background: 'var(--surface, #FFF)',
                    color: 'var(--text, #0F172A)',
                    fontSize: 13.5,
                    outline: 'none'
                  }}
                >
                  {LEAVE_TYPES.map((lt) => (
                    <option key={lt.value} value={lt.value}>
                      {lt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Pickers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)', marginBottom: 6 }}>
                    From Date <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #CBD5E1)',
                      background: 'var(--surface, #FFF)',
                      color: 'var(--text, #0F172A)',
                      fontSize: 13.5,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)', marginBottom: 6 }}>
                    To Date <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={startDate || undefined}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #CBD5E1)',
                      background: 'var(--surface, #FFF)',
                      color: 'var(--text, #0F172A)',
                      fontSize: 13.5,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Duration Info Banner */}
              {currentDurationDays > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    color: '#1D4ED8',
                    fontSize: 12.5,
                    fontWeight: 600,
                    marginBottom: 16
                  }}
                >
                  <Info size={15} />
                  <span>Calculated Duration: <b>{currentDurationDays} {currentDurationDays === 1 ? 'Day' : 'Days'}</b></span>
                </div>
              )}

              {/* Reason */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)', marginBottom: 6 }}>
                  Reason for Absence <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail the purpose of leave (e.g. personal emergency, health rest, academic conference, etc.)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #CBD5E1)',
                    background: 'var(--surface, #FFF)',
                    color: 'var(--text, #0F172A)',
                    fontSize: 13.5,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Add Document (Optional) */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)' }}>
                    Add Document / Attachment <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary, #64748B)' }}>(Optional)</span>
                  </label>
                  {documentUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveDocument}
                      style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {!documentUrl ? (
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '16px 14px',
                      borderRadius: 8,
                      border: '1.5px dashed var(--border, #CBD5E1)',
                      background: 'var(--background, #F8FAFC)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Paperclip size={18} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)' }}>
                      Click to upload or attach document
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #64748B)' }}>
                      Medical certificate, application slip, or proof (PDF, PNG, JPG up to 10MB)
                    </div>
                  </label>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid #BFDBFE',
                      background: '#EFF6FF'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 6, background: '#2563EB', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {documentUrl.startsWith('data:image/') ? <ImageIcon size={17} /> : <FileText size={17} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A8A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {documentName || 'Attached Document'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#3B82F6', marginTop: 1 }}>
                          {documentSize} · Ready to submit
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setPreviewingDoc({ url: documentUrl, name: documentName || 'Document Preview' })}
                        style={{
                          padding: '5px 9px',
                          borderRadius: 6,
                          border: '1px solid #93C5FD',
                          background: '#FFF',
                          color: '#1D4ED8',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Eye size={12} />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveDocument}
                        style={{
                          padding: '5px 7px',
                          borderRadius: 6,
                          border: '1px solid #FECACA',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          cursor: 'pointer'
                        }}
                        title="Remove Document"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {fileError && (
                  <div style={{ fontSize: 12, color: '#DC2626', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={13} />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border, #E2E8F0)' }}>
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  disabled={submitting}
                  style={{
                    padding: '9px 16px',
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
                  type="submit"
                  disabled={submitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 18px',
                    borderRadius: 8,
                    background: '#2563EB',
                    color: '#FFF',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  <Send size={14} />
                  <span>{submitting ? 'Submitting Application...' : 'Submit to School Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Document Preview Modal ── */}
      {previewingDoc && (
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
            if (e.target === e.currentTarget) setPreviewingDoc(null);
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
                  {previewingDoc.name}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => openDocumentInNewTab(previewingDoc.url)}
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
                  onClick={() => downloadDocument(previewingDoc.url, previewingDoc.name)}
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
                  onClick={() => setPreviewingDoc(null)}
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
              {previewingDoc.url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(previewingDoc.url) ? (
                <img
                  src={previewingDoc.url}
                  alt={previewingDoc.name}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
              ) : previewingDoc.url.startsWith('data:application/pdf') || /\.pdf$/i.test(previewingDoc.url) ? (
                <iframe
                  src={previewingDoc.url}
                  title={previewingDoc.name}
                  style={{ width: '100%', height: '65vh', border: 'none', borderRadius: 8 }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#FFF', borderRadius: 10, width: '100%', maxWidth: 420 }}>
                  <FileText size={48} color="#2563EB" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A', marginBottom: 4 }}>
                    {previewingDoc.name}
                  </div>
                  <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
                    Direct inline preview is not supported for this file type. Please open or download it to view.
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadDocument(previewingDoc.url, previewingDoc.name)}
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
