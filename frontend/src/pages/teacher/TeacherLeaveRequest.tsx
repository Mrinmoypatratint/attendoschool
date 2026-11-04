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
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';

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

export default function TeacherLeaveRequest() {
  const [requests, setRequests] = useState<TeacherLeaveItem[]>([]);
  const [configuredPolicies, setConfiguredPolicies] = useState<any[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [openModal, setOpenModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('');
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

  const loadLeavePolicies = async () => {
    try {
      setPoliciesLoading(true);
      const res = await api.get('/leave-policies');
      const list = res.data?.data || res.data || [];
      if (Array.isArray(list)) {
        const active = list.filter((p: any) => {
          if (p.is_active === false) return false;
          const audience = String(p.applicable_to || 'ALL').toUpperCase();
          return audience === 'ALL' || audience === 'TEACHER';
        });
        setConfiguredPolicies(active);
        if (active.length > 0) {
          const firstVal = (active[0].code || active[0].name).toUpperCase().replace(/\s+/g, '_');
          setLeaveType(firstVal);
        } else {
          setLeaveType('');
        }
      }
    } catch (_err) {
      // Fallback
    } finally {
      setPoliciesLoading(false);
    }
  };

  useEffect(() => {
    loadMyLeaves();
    loadLeavePolicies();
  }, []);

  const dynamicLeaveTypes = useMemo(() => {
    return configuredPolicies.map((p) => {
      const val = (p.code || p.name).toUpperCase().replace(/\s+/g, '_');
      const cycle = p.accrual_cycle === 'HALF_YEARLY' ? 'Half-Year' : 'Year';
      const label = p.code ? `${p.name} (${p.code})` : p.name;
      return {
        value: val,
        code: p.code,
        name: p.name,
        label: `${label} — ${p.days_count} Days / ${cycle}`,
        color: p.accrual_cycle === 'YEARLY' ? '#3b82f6' : '#8b5cf6',
        bg: p.accrual_cycle === 'YEARLY' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(139, 92, 246, 0.12)',
        border: p.accrual_cycle === 'YEARLY' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(139, 92, 246, 0.25)'
      };
    });
  }, [configuredPolicies]);

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

  const matchesPolicy = (rawType: string, policy: { name: string; code?: string }) => {
    if (!rawType || !policy) return false;
    const rawUpper = rawType.toUpperCase().trim();
    const pCodeUpper = (policy.code || '').toUpperCase().trim();
    const pNameUpper = (policy.name || '').toUpperCase().trim();

    if (pCodeUpper && rawUpper === pCodeUpper) return true;
    if (pNameUpper && rawUpper === pNameUpper) return true;

    const normalize = (s: string) => s.replace(/[^A-Z0-9]/gi, '').toUpperCase().replace(/LEAVE/g, '');
    const rawNorm = normalize(rawType);
    const pCodeNorm = normalize(policy.code || '');
    const pNameNorm = normalize(policy.name || '');

    if (pCodeNorm && rawNorm === pCodeNorm) return true;
    if (pNameNorm && rawNorm === pNameNorm) return true;

    if ((rawNorm === 'CASUAL' || rawNorm === 'CL') && (pCodeNorm === 'CL' || pNameNorm.includes('CASUAL'))) return true;
    if ((rawNorm === 'SICK' || rawNorm === 'SL') && (pCodeNorm === 'SL' || pNameNorm.includes('SICK'))) return true;
    if ((rawNorm === 'EARNED' || rawNorm === 'EL') && (pCodeNorm === 'EL' || pNameNorm.includes('EARNED'))) return true;
    if ((rawNorm === 'HALFPAY' || rawNorm === 'HPL') && (pCodeNorm === 'HPL' || pNameNorm.includes('HALFPAY'))) return true;
    if ((rawNorm === 'MATERNITY' || rawNorm === 'ML') && (pCodeNorm === 'ML' || pNameNorm.includes('MATERNITY'))) return true;

    if (rawNorm && pNameNorm && (pNameNorm.startsWith(rawNorm) || rawNorm.startsWith(pNameNorm))) {
      return true;
    }
    return false;
  };

  const leaveBalances = useMemo(() => {
    // Dynamic leave policies configured by school admin, with fallback to standard defaults
    const policies = configuredPolicies.length > 0
      ? configuredPolicies.map((p) => ({
          key: (p.code || p.name).toUpperCase().trim(),
          name: p.name,
          code: (p.code || p.name).toLowerCase().trim(),
          allowedDays: Number(p.days_count) || 0
        }))
      : [
          { key: 'CL', name: 'Casual Leave', code: 'cl', allowedDays: 14 },
          { key: 'EL', name: 'Earned Leave', code: 'el', allowedDays: 10 },
          { key: 'SL', name: 'Sick Leave', code: 'sl', allowedDays: 10 },
          { key: 'HPL', name: 'Half Pay Leave', code: 'hpl', allowedDays: 20 }
        ];

    return policies.map((p) => {
      let approvedDays = 0;
      let pendingDays = 0;

      requests.forEach((r) => {
        if (matchesPolicy(r.leave_type, p)) {
          const days = calculateDays(r.start_date, r.end_date);
          if (r.status === 'APPROVED') {
            approvedDays += days;
          } else if (r.status === 'PENDING') {
            pendingDays += days;
          }
        }
      });

      return {
        ...p,
        approvedDays,
        pendingDays
      };
    });
  }, [configuredPolicies, requests]);

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
        setLeaveType(dynamicLeaveTypes[0]?.value || '');
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
    const norm = String(type || '').trim().toUpperCase();
    const dynamicFound = dynamicLeaveTypes.find((t: any) =>
      t.value === norm ||
      (t.code && t.code.toUpperCase() === norm) ||
      (t.name && t.name.toUpperCase().replace(/\s+/g, '_') === norm)
    );
    if (dynamicFound) {
      return dynamicFound;
    }
    const cleanLabel = norm.toUpperCase().endsWith('LEAVE')
      ? norm.charAt(0) + norm.slice(1).toLowerCase()
      : norm;
    return {
      value: norm || 'LEAVE',
      label: cleanLabel || 'Leave',
      color: '#4B5563',
      bg: '#F3F4F6',
      border: '#E5E7EB'
    };
  };

  return (
    <div className="student-subpage w-full pb-16">
      {/* ── Header ── */}
      <div className="student-subpage-header mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="student-subpage-title-row">
          <Link
            to="/dashboard"
            className="student-back-link inline-flex items-center gap-1.5 text-blue-600 font-semibold text-xs no-underline mb-1.5 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title text-2xl font-extrabold text-slate-900 dark:text-white my-1">
            Faculty Leave Applications
          </h1>
          <p className="student-subpage-desc text-sm text-slate-500 dark:text-slate-400 m-0">
            Submit absence requests for School Administration review and track approval status in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadMyLeaves}
            className="student-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
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
            className="student-btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-sm cursor-pointer shadow-sm hover:shadow transition-all"
          >
            <Plus size={16} />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* ── Feedback Message Banner ── */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 px-4 rounded-xl mb-5 text-sm font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="bg-transparent border-0 cursor-pointer text-inherit p-0.5 hover:opacity-75 transition-opacity"
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
            borderRadius: 14,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 116,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-secondary, #475569)', letterSpacing: '-0.01em' }}>
            Total Requests
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--text, #0F172A)', lineHeight: 1 }}>
              {counts.all}
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: 'rgba(37, 99, 235, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FileText size={22} />
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 14,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 116,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: '#f59e0b', letterSpacing: '-0.01em' }}>
            Pending Review
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>
              {counts.pending}
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Clock size={22} />
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 14,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 116,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: '#10b981', letterSpacing: '-0.01em' }}>
            Approved
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#059669', lineHeight: 1 }}>
              {counts.approved}
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 14,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 116,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: '#ef4444', letterSpacing: '-0.01em' }}>
            Rejected
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>
              {counts.rejected}
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <XCircle size={22} />
            </div>
          </div>
        </div>

        {/* ── Pending Leave Card (Dynamic Admin Policies & Approved Counts) ── */}
        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pending Leave
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)', marginTop: 2 }}>
                Entitlement & Usage
              </div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(124, 58, 237, 0.12)',
                color: '#7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Calendar size={20} />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: leaveBalances.length > 4 ? '1fr 1fr' : '1fr',
              gap: '4px 16px'
            }}
          >
            {leaveBalances.map((item) => (
              <div
                key={item.key}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}
                title={`${item.name}: ${item.approvedDays} approved out of ${item.allowedDays} allowed days`}
              >
                <span style={{ textTransform: 'lowercase', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>
                  {item.code.toLowerCase()}
                </span>
                <span style={{ color: 'var(--text-secondary, #94A3B8)', margin: '0 6px' }}>-</span>
                <span style={{ color: item.approvedDays > 0 ? '#15803D' : 'var(--text, #0F172A)', fontWeight: 800 }}>
                  {item.approvedDays}/{item.allowedDays}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Status Tab Navigation ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '2px solid var(--border, #e2e8f0)',
          marginBottom: 16
        }}
        className="overflow-x-auto pb-px"
      >
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ALL' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'ALL' ? '#4f46e5' : 'var(--text-secondary, #64748b)',
            fontWeight: activeTab === 'ALL' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          className="hover:text-slate-900 dark:hover:text-slate-100"
        >
          <FileText size={18} />
          <span>All Applications</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: activeTab === 'ALL' ? '#e0e7ff' : 'var(--card-subtle, #f1f5f9)',
              color: activeTab === 'ALL' ? '#4338ca' : '#64748b',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {counts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PENDING')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'PENDING' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'PENDING' ? '#4f46e5' : 'var(--text-secondary, #64748b)',
            fontWeight: activeTab === 'PENDING' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          className="hover:text-slate-900 dark:hover:text-slate-100"
        >
          <Clock size={18} />
          <span>Pending Review</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: activeTab === 'PENDING' ? '#e0e7ff' : 'var(--card-subtle, #f1f5f9)',
              color: activeTab === 'PENDING' ? '#4338ca' : '#64748b',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {counts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('APPROVED')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'APPROVED' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'APPROVED' ? '#4f46e5' : 'var(--text-secondary, #64748b)',
            fontWeight: activeTab === 'APPROVED' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          className="hover:text-slate-900 dark:hover:text-slate-100"
        >
          <CheckCircle2 size={18} />
          <span>Approved</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: activeTab === 'APPROVED' ? '#e0e7ff' : 'var(--card-subtle, #f1f5f9)',
              color: activeTab === 'APPROVED' ? '#4338ca' : '#64748b',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {counts.approved}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REJECTED')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'REJECTED' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'REJECTED' ? '#4f46e5' : 'var(--text-secondary, #64748b)',
            fontWeight: activeTab === 'REJECTED' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          className="hover:text-slate-900 dark:hover:text-slate-100"
        >
          <XCircle size={18} />
          <span>Rejected</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: activeTab === 'REJECTED' ? '#e0e7ff' : 'var(--card-subtle, #f1f5f9)',
              color: activeTab === 'REJECTED' ? '#4338ca' : '#64748b',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {counts.rejected}
          </span>
        </button>
      </div>

      {/* ── Table Card ── */}
      <div className="student-card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 px-5 text-center text-slate-500 dark:text-slate-400">
            <RefreshCw size={24} className="spin mx-auto mb-3 block" />
            <p className="m-0 text-sm">Loading leave applications...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 px-5 text-center text-slate-500 dark:text-slate-400">
            <div className="w-13 h-13 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3.5">
              <FileText size={26} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 mb-1.5">
              No Leave Requests Found
            </h3>
            <p className="text-sm m-0 mb-4 max-w-md mx-auto">
              {activeTab === 'ALL'
                ? "You haven't submitted any leave requests yet. Click 'Apply for Leave' above to apply."
                : `No leave applications currently match the '${activeTab.toLowerCase()}' status filter.`}
            </p>
            {activeTab === 'ALL' && (
              <button
                type="button"
                onClick={() => setOpenModal(true)}
                className="student-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-sm transition-colors"
              >
                <Plus size={15} /> Apply Now
              </button>
            )}
          </div>
        ) : (
          <div className="student-table-wrap overflow-x-auto">
            <table className="student-table w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-4.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    LEAVE TYPE
                  </th>
                  <th className="py-3 px-4.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    DURATION & DATES
                  </th>
                  <th className="py-3 px-4.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    REASON / DETAILS
                  </th>
                  <th className="py-3 px-4.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    APPLIED ON
                  </th>
                  <th className="py-3 px-4.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    STATUS
                  </th>
                  <th className="py-3 px-4.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    ADMIN REMARKS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                {filteredRequests.map((r) => {
                  const typeObj = getLeaveTypeObj(r.leave_type);
                  const days = calculateDays(r.start_date, r.end_date);
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-750/50 transition-colors"
                    >
                      <td className="py-3.5 px-4.5 align-top">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold"
                          style={{
                            background: typeObj.bg,
                            color: typeObj.color,
                            border: `1px solid ${typeObj.border}`
                          }}
                        >
                          {typeObj.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4.5 align-top">
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">
                          {formatDate(r.start_date)} → {formatDate(r.end_date)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar size={12} />
                          <span>{days} {days === 1 ? 'Day' : 'Days'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4.5 align-top max-w-xs">
                        <p className="m-0 text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
                          {r.reason}
                        </p>
                        {r.document_url && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => setPreviewingDoc({ url: r.document_url!, name: r.document_name || 'Attached Document' })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-semibold cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                              title="View Attached Document"
                            >
                              <Paperclip size={12} />
                              <span className="max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                                {r.document_name || 'View Document'}
                              </span>
                              <Eye size={12} />
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4.5 align-top text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(r.created_at)}
                      </td>

                      <td className="py-3.5 px-4.5 align-top">
                        {r.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <Clock size={12} />
                            Pending Review
                          </span>
                        )}
                        {r.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 size={12} />
                            Approved
                          </span>
                        )}
                        {r.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <XCircle size={12} />
                            Rejected
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4.5 align-top text-xs">
                        {r.review_notes ? (
                          <div>
                            <div className="text-slate-900 dark:text-white font-medium text-xs">
                              {r.review_notes}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              By {r.reviewer_name || 'Admin'} {r.reviewed_at ? `· ${formatDate(r.reviewed_at)}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">
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
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setOpenModal(false);
          }}
        >
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-4.5 px-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/70">
              <div>
                <h3 className="m-0 text-base font-bold text-slate-900 dark:text-white">
                  Apply for Faculty Leave
                </h3>
                <p className="m-0 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  This request will be sent to the School Admin for review & approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                disabled={submitting}
                className="bg-transparent border-0 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 px-6">
              {!policiesLoading && dynamicLeaveTypes.length === 0 && (
                <div className="p-2.5 px-3.5 rounded-lg mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>No leave policies have been configured by the School Admin yet. Please contact your school administrator to configure leave policies.</span>
                </div>
              )}

              {/* Leave Type */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                  Leave Type <span className="text-rose-600">*</span>
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  required
                  disabled={dynamicLeaveTypes.length === 0}
                  className={`w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors ${
                    dynamicLeaveTypes.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                >
                  {policiesLoading ? (
                    <option value="" disabled>Loading leave policies...</option>
                  ) : dynamicLeaveTypes.length === 0 ? (
                    <option value="" disabled>No leave policy created by school admin</option>
                  ) : (
                    dynamicLeaveTypes.map((lt) => (
                      <option key={lt.value} value={lt.value}>
                        {lt.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-2 gap-3.5 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                    From Date <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min="1900-01-01"
                    max="9999-12-31"
                    value={startDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parts = val.split('-');
                      if (parts[0] && parts[0].length > 4) {
                        parts[0] = parts[0].slice(0, 4);
                        setStartDate(parts.join('-'));
                      } else {
                        setStartDate(val);
                      }
                    }}
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                    To Date <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={startDate || '1900-01-01'}
                    max="9999-12-31"
                    value={endDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parts = val.split('-');
                      if (parts[0] && parts[0].length > 4) {
                        parts[0] = parts[0].slice(0, 4);
                        setEndDate(parts.join('-'));
                      } else {
                        setEndDate(val);
                      }
                    }}
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Duration Info Banner */}
              {currentDurationDays > 0 && (
                <div className="flex items-center gap-2 p-2 px-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-4">
                  <Info size={15} />
                  <span>Calculated Duration: <b>{currentDurationDays} {currentDurationDays === 1 ? 'Day' : 'Days'}</b></span>
                </div>
              )}

              {/* Reason */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                  Reason for Absence <span className="text-rose-600">*</span>
                </label>
                <AutoExpandingTextarea
                  required
                  minHeight={46}
                  maxHeight={200}
                  placeholder="Detail the purpose of leave (e.g. personal emergency, health rest, academic conference, etc.)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm leading-relaxed outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Add Document (Optional) */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-900 dark:text-white">
                    Add Document / Attachment <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(Optional)</span>
                  </label>
                  {documentUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveDocument}
                      className="bg-transparent border-0 text-rose-600 text-xs font-semibold cursor-pointer p-0 hover:text-rose-700 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {!documentUrl ? (
                  <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-1.5 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors">
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Paperclip size={18} />
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      Click to upload or attach document
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                      Medical certificate, application slip, or proof (PDF, PNG, JPG up to 10MB)
                    </div>
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8.5 h-8.5 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                        {documentUrl.startsWith('data:image/') ? <ImageIcon size={17} /> : <FileText size={17} />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-blue-900 dark:text-blue-200 truncate">
                          {documentName || 'Attached Document'}
                        </div>
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                          {documentSize} · Ready to submit
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewingDoc({ url: documentUrl, name: documentName || 'Document Preview' })}
                        className="px-2.5 py-1.5 rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 text-xs font-semibold cursor-pointer inline-flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Eye size={12} />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveDocument}
                        className="p-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 cursor-pointer hover:bg-rose-500/20 transition-colors"
                        title="Remove Document"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {fileError && (
                  <div className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={13} />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || dynamicLeaveTypes.length === 0 || !leaveType}
                  className={`inline-flex items-center gap-1.5 px-4.5 py-2 rounded-lg font-semibold text-xs transition-colors ${
                    submitting || dynamicLeaveTypes.length === 0 || !leaveType
                      ? 'bg-slate-400 dark:bg-slate-700 text-white cursor-not-allowed opacity-60'
                      : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm'
                  }`}
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
          className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewingDoc(null);
          }}
        >
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 px-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip size={18} className="text-blue-600" />
                <h3 className="m-0 text-sm font-bold text-slate-900 dark:text-white truncate">
                  {previewingDoc.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDocumentInNewTab(previewingDoc.url)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                  title="Open in new window"
                >
                  <ExternalLink size={13} />
                  <span>Open New Tab</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadDocument(previewingDoc.url, previewingDoc.name)}
                  className="px-3 py-1.5 rounded-lg border-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Download File"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewingDoc(null)}
                  className="bg-transparent border-0 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 ml-1"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 flex justify-center items-center bg-slate-100 dark:bg-slate-900/60">
              {previewingDoc.url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(previewingDoc.url) ? (
                <img
                  src={previewingDoc.url}
                  alt={previewingDoc.name}
                  className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-md"
                />
              ) : previewingDoc.url.startsWith('data:application/pdf') || /\.pdf$/i.test(previewingDoc.url) ? (
                <iframe
                  src={previewingDoc.url}
                  title={previewingDoc.name}
                  className="w-full h-[65vh] border-0 rounded-lg"
                />
              ) : (
                <div className="text-center p-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl w-full max-w-sm">
                  <FileText size={48} className="text-blue-600 mx-auto mb-3 block" />
                  <div className="font-bold text-base text-slate-900 dark:text-white mb-1">
                    {previewingDoc.name}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Direct inline preview is not supported for this file type. Please open or download it to view.
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadDocument(previewingDoc.url, previewingDoc.name)}
                    className="px-4 py-2 rounded-lg border-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
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
