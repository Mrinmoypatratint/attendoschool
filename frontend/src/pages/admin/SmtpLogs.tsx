import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Mail,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Eye,
  X,
  Filter,
  ArrowUpDown,
  Send,
  User,
  GraduationCap,
  Briefcase,
  EyeOff,
  Calendar,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';

export interface SmtpLogItem {
  id: string;
  school_id: string;
  attendance_session_id?: string | null;
  student_id?: string | null;
  channel: string;
  recipient: string;
  recipient_type?: string;
  template_key: string;
  subject?: string;
  message?: string;
  status: 'SENT' | 'FAILED' | 'QUEUED' | 'PROCESSING' | 'RETRYING' | 'SKIPPED' | 'UNSENT';
  attempts: number;
  max_attempts: number;
  last_error?: string | null;
  provider_message_id?: string | null;
  created_at: string;
  sent_at?: string | null;
  failed_at?: string | null;
  scheduled_at?: string | null;
  admission_number?: string;
  employee_id?: string;
  recipient_name?: string;
  student_name?: string;
  roll_number?: string;
}

export const getCurrentMonth = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function SmtpLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SmtpLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>(() => getCurrentMonth());

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Detail Modal State
  const [activeModalItem, setActiveModalItem] = useState<SmtpLogItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLogs = useCallback(async (isSilentRefresh = false) => {
    if (!isSilentRefresh) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      // Pass paginate=true for structured API response
      const res = await api.get('/notifications-v11/logs', {
        params: {
          paginate: 'true',
          limit: 300
        }
      });

      const raw = res.data;
      const list: SmtpLogItem[] = Array.isArray(raw)
        ? raw
        : (raw.logs || raw.data || []);

      setLogs(list);
    } catch (err: any) {
      console.error('[SmtpLogs] Failed to fetch delivery logs:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load SMTP email activity logs. Please verify your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const refreshTimer = window.setInterval(() => fetchLogs(true), 5000);
    return () => window.clearInterval(refreshTimer);
  }, [fetchLogs]);

  // Copy email or ID to clipboard
  const handleCopy = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(identifier);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Retry failed notification
  const handleRetry = async (logId: string) => {
    try {
      setRetryingId(logId);
      setRetryMessage(null);
      const res = await api.post(`/notifications-v11/logs/${logId}/retry`);
      if (res.data?.success) {
        setRetryMessage({ type: 'success', text: 'Email has been queued for immediate retransmission.' });
        // Refresh logs list
        fetchLogs(true);
        if (activeModalItem && activeModalItem.id === logId) {
          setActiveModalItem(prev => prev ? { ...prev, status: 'QUEUED', attempts: 0, last_error: null } : null);
        }
      }
    } catch (err: any) {
      setRetryMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to retry email transmission.' });
    } finally {
      setRetryingId(null);
    }
  };

  // Helper to extract YYYY-MM from timestamp
  const getLogMonth = useCallback((item: SmtpLogItem): string => {
    const ts = item.created_at || item.sent_at || item.scheduled_at;
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) {
      if (typeof ts === 'string' && ts.length >= 7) {
        return ts.slice(0, 7);
      }
      return '';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  // Human-readable label for selected month (e.g. "Oct 2026")
  const selectedMonthLabel = useMemo(() => {
    if (!monthFilter || monthFilter === 'ALL') return null;
    const parts = monthFilter.split('-');
    if (parts.length !== 2) return monthFilter;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const d = new Date(year, month, 1);
    if (isNaN(d.getTime())) return monthFilter;
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }, [monthFilter]);

  // Logs scoped to selected month
  const monthScopedLogs = useMemo(() => {
    if (!monthFilter || monthFilter === 'ALL') {
      return logs;
    }
    return logs.filter(item => getLogMonth(item) === monthFilter);
  }, [logs, monthFilter, getLogMonth]);

  // Metrics computation (dynamically updates when monthFilter changes)
  const metrics = useMemo(() => {
    const total = monthScopedLogs.length;
    const sent = monthScopedLogs.filter(l => l.status === 'SENT').length;
    const failed = monthScopedLogs.filter(l => l.status === 'FAILED').length;
    const queued = monthScopedLogs.filter(l => l.status === 'QUEUED' || l.status === 'PROCESSING').length;
    const retrying = monthScopedLogs.filter(l => l.status === 'RETRYING').length;
    const unsent = monthScopedLogs.filter(l => l.status === 'UNSENT' || l.status === 'SKIPPED').length;
    return { total, sent, failed, queued, retrying, unsent };
  }, [monthScopedLogs]);

  // Filtered logs (status, search query, and month)
  const filteredLogs = useMemo(() => {
    return monthScopedLogs.filter(item => {
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      // Search query filter (matches Admission No., Employee ID, Student/Recipient Name, Mail ID, Subject)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const adm = (item.admission_number || '').toLowerCase();
        const emp = (item.employee_id || '').toLowerCase();
        const name = (item.recipient_name || item.student_name || '').toLowerCase();
        const mail = (item.recipient || '').toLowerCase();
        const sub = (item.subject || '').toLowerCase();
        return adm.includes(q) || emp.includes(q) || name.includes(q) || mail.includes(q) || sub.includes(q);
      }
      return true;
    });
  }, [monthScopedLogs, statusFilter, searchQuery]);

  // Paginated slice
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

  // Export logs to Excel (all details, dynamically scoped to active filters)
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) return;

    const exportRows = filteredLogs.map((item, index) => {
      const admNumber = item.admission_number && item.admission_number.trim() !== ''
        ? item.admission_number.trim()
        : null;
      const empNumber = item.employee_id && item.employee_id.trim() !== ''
        ? item.employee_id.trim()
        : null;

      const rawType = (item.recipient_type || '').toUpperCase();
      const isTeacher = rawType === 'TEACHER' || (Boolean(empNumber) && !admNumber);
      const isStudent = rawType === 'STUDENT' || rawType === 'PARENT' || (Boolean(admNumber) && !empNumber);

      const displayedId = isTeacher
        ? (empNumber || admNumber || '—')
        : (admNumber || empNumber || '—');

      const displayName = item.recipient_name && item.recipient_name.trim() !== '—'
        ? item.recipient_name.trim()
        : (item.student_name && item.student_name.trim() !== '—' ? item.student_name.trim() : '—');

      const roleType = isTeacher ? 'Teacher' : isStudent ? 'Student' : (item.recipient_type || 'Recipient');

      const createdDateStr = item.created_at ? new Date(item.created_at).toLocaleString() : '—';
      const sentDateStr = item.sent_at ? new Date(item.sent_at).toLocaleString() : (item.failed_at ? `Failed: ${new Date(item.failed_at).toLocaleString()}` : '—');

      return {
        'SL No.': index + 1,
        'Admission / Employee ID': displayedId,
        'Student / Recipient Name': displayName,
        'Recipient Role': roleType,
        'Roll Number': item.roll_number || '—',
        'Recipient Mail ID': item.recipient || '—',
        'Delivery Status': item.status,
        'Subject / Event': item.subject || '—',
        'Template Key': item.template_key || '—',
        'Created Timestamp': createdDateStr,
        'Sent / Failure Timestamp': sentDateStr,
        'Attempts': `${item.attempts ?? 0} / ${item.max_attempts ?? 3}`,
        'Error / Diagnostic Details': item.last_error || '—',
        'Provider Message ID': item.provider_message_id || item.id
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    // Setup auto-fitted column widths for a clean Excel layout
    worksheet['!cols'] = [
      { wch: 8 },  // SL No.
      { wch: 24 }, // Admission / Employee ID
      { wch: 30 }, // Student / Recipient Name
      { wch: 18 }, // Recipient Role
      { wch: 14 }, // Roll Number
      { wch: 34 }, // Recipient Mail ID
      { wch: 16 }, // Delivery Status
      { wch: 42 }, // Subject / Event
      { wch: 24 }, // Template Key
      { wch: 24 }, // Created Timestamp
      { wch: 26 }, // Sent / Failure Timestamp
      { wch: 12 }, // Attempts
      { wch: 40 }, // Error / Diagnostic Details
      { wch: 34 }  // Provider Message ID
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SMTP Email Logs');

    const dateStr = new Date().toISOString().slice(0, 10);
    const filterTag = statusFilter !== 'ALL' ? `_${statusFilter.toLowerCase()}` : '';
    const monthTag = monthFilter !== 'ALL' ? `_${monthFilter}` : '';
    const searchTag = searchQuery.trim() ? '_search' : '';

    XLSX.writeFile(workbook, `SMTP_Email_Logs${monthTag}${filterTag}${searchTag}_${dateStr}.xlsx`);
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            background: '#dcfce7',
            color: '#15803d',
            border: '1px solid #bbf7d0'
          }}>
            <CheckCircle2 size={13} /> SENT
          </span>
        );
      case 'FAILED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            background: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #fecaca'
          }}>
            <XCircle size={13} /> FAILED
          </span>
        );
      case 'QUEUED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            background: '#dbeafe',
            color: '#1d4ed8',
            border: '1px solid #bfdbfe'
          }}>
            <Clock size={13} /> QUEUED
          </span>
        );
      case 'PROCESSING':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            background: '#ede9fe',
            color: '#6d28d9',
            border: '1px solid #ddd6fe'
          }}>
            <RefreshCw size={13} className="spin" /> PROCESSING
          </span>
        );
      case 'RETRYING':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            background: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fde68a'
          }}>
            <RotateCcw size={13} /> RETRYING
          </span>
        );
      case 'UNSENT':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            background: '#f1f5f9',
            color: '#475569',
            border: '1px solid #cbd5e1'
          }}>
            <EyeOff size={13} /> UNSENT
          </span>
        );
      case 'SKIPPED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            background: '#f1f5f9',
            color: '#64748b',
            border: '1px solid #e2e8f0'
          }}>
            <EyeOff size={13} /> SKIPPED
          </span>
        );
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 600,
            background: '#f1f5f9',
            color: '#475569',
            border: '1px solid #e2e8f0'
          }}>
            {status}
          </span>
        );
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* ── Page Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}>
              <Mail size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text, #0f172a)', letterSpacing: '-0.02em' }}>
                SMTP Email Activity Logs
              </h1>
              <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>
                School-isolated delivery audit trail. Every record dynamically reflects admission no. / employee ID, recipient name, email ID, and delivery status.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || filteredLogs.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 8,
              border: '1px solid #16a34a',
              background: '#16a34a',
              color: '#ffffff',
              cursor: loading || filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
              opacity: loading || filteredLogs.length === 0 ? 0.6 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            title={filteredLogs.length === 0 ? 'No logs to export' : `Export ${filteredLogs.length} record(s) to Excel`}
          >
            <Download size={15} />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => fetchLogs(true)}
            disabled={refreshing || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 8,
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text, #1e293b)',
              cursor: refreshing || loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} style={{ color: '#2563eb' }} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Logs'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metrics Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        marginBottom: 24
      }}>
        {/* Total Emails */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 12,
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Logs
            </span>
            <Mail size={16} color="#64748b" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0f172a)', marginTop: 6 }}>
            {loading ? '—' : metrics.total}
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
            {selectedMonthLabel ? `Logs for ${selectedMonthLabel}` : 'School records fetched'}
          </div>
        </div>

        {/* Successfully Delivered */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid #bbf7d0',
          borderRadius: 12,
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sent
            </span>
            <CheckCircle2 size={16} color="#16a34a" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#15803d', marginTop: 6 }}>
            {loading ? '—' : metrics.sent}
          </div>
          <div style={{ fontSize: 11.5, color: '#16a34a', marginTop: 2 }}>
            {selectedMonthLabel ? `Delivered in ${selectedMonthLabel}` : 'Successfully delivered'}
          </div>
        </div>

        {/* Failed Alerts */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid #fecaca',
          borderRadius: 12,
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Failed
            </span>
            <XCircle size={16} color="#dc2626" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#b91c1c', marginTop: 6 }}>
            {loading ? '—' : metrics.failed}
          </div>
          <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 2 }}>
            {selectedMonthLabel ? `Errors in ${selectedMonthLabel}` : 'Transmission errors'}
          </div>
        </div>

        {/* In Queue / Retrying */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid #bfdbfe',
          borderRadius: 12,
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Queued / Retrying
            </span>
            <Clock size={16} color="#2563eb" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1d4ed8', marginTop: 6 }}>
            {loading ? '—' : (metrics.queued + metrics.retrying)}
          </div>
          <div style={{ fontSize: 11.5, color: '#2563eb', marginTop: 2 }}>
            {selectedMonthLabel ? `Pending in ${selectedMonthLabel}` : 'Pending dispatch worker'}
          </div>
        </div>

        {/* Dummy / Unsent */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid #cbd5e1',
          borderRadius: 12,
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Unsent (Dummy)
            </span>
            <EyeOff size={16} color="#64748b" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#334155', marginTop: 6 }}>
            {loading ? '—' : metrics.unsent}
          </div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
            {selectedMonthLabel ? `Suppressed in ${selectedMonthLabel}` : 'Suppressed mock / placeholder'}
          </div>
        </div>
      </div>

      {/* ── Error Notice Banner ── */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          color: '#b91c1c'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchLogs()}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              background: '#b91c1c',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Filter & Search Toolbar ── */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 450 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by Admission No., Employee ID, Name, Mail ID..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              fontSize: 13.5,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              outline: 'none',
              background: 'var(--bg, #f8fafc)',
              color: 'var(--text, #0f172a)'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 4
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Right Controls: Month Filter + Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Month Filter */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--bg, #f8fafc)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
            title="Filter email activity logs by month"
          >
            <Calendar size={14} color="#64748b" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
              Month:
            </span>
            <input
              type="month"
              value={monthFilter === 'ALL' ? '' : monthFilter}
              onChange={(e) => {
                const val = e.target.value;
                setMonthFilter(val || 'ALL');
                setCurrentPage(1);
              }}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text, #0f172a)',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            />
            {monthFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setMonthFilter('ALL');
                  setCurrentPage(1);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 4
                }}
              >
                All Months
              </button>
            )}
          </div>

          {/* Status Filter Pill Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748b', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={13} /> Filter:
            </span>
            {[
              { key: 'ALL', label: 'All Statuses' },
              { key: 'SENT', label: 'Sent' },
              { key: 'UNSENT', label: 'Unsent' },
              { key: 'FAILED', label: 'Failed' },
              { key: 'QUEUED', label: 'Queued' },
              { key: 'RETRYING', label: 'Retrying' }
            ].map(st => {
              const isActive = statusFilter === st.key;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st.key);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: isActive ? 700 : 500,
                    border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: isActive ? '#2563eb' : '#ffffff',
                    color: isActive ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main Data Table Card ── */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {/* Table Container */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 950 }}>
            <thead>
              <tr style={{
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                color: '#475569',
                fontSize: 12.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                <th style={{ padding: '12px 18px' }}>Admission No. / Employee ID</th>
                <th style={{ padding: '12px 18px' }}>Student / Recipient Name</th>
                <th style={{ padding: '12px 18px' }}>Mail ID</th>
                <th style={{ padding: '12px 18px' }}>Status</th>
                <th style={{ padding: '12px 18px' }}>Subject / Event</th>
                <th style={{ padding: '12px 18px' }}>Timestamp</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Loading State */}
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <RefreshCw size={26} className="spin" style={{ color: '#2563eb' }} />
                      <span style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                        Fetching SMTP email logs from school database...
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty State */}
              {!loading && paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '56px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 54,
                        height: 54,
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8'
                      }}>
                        <Mail size={26} />
                      </div>
                      <div style={{ maxWidth: 420 }}>
                        <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                          {searchQuery || statusFilter !== 'ALL' || monthFilter !== 'ALL'
                            ? 'No matching email activity records'
                            : 'No SMTP email activity logs found'}
                        </h4>
                        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                          {searchQuery || statusFilter !== 'ALL' || monthFilter !== 'ALL'
                            ? 'No records match your search, status, or month filter. Try clearing filters to view all entries.'
                            : 'Automated SMTP notifications sent for student attendance absences or account invitations belonging to your school will appear here.'}
                        </p>
                      </div>
                      {(searchQuery || statusFilter !== 'ALL' || monthFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('ALL');
                            setMonthFilter('ALL');
                            setCurrentPage(1);
                          }}
                          style={{
                            marginTop: 6,
                            padding: '6px 14px',
                            fontSize: 12.5,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: '1px solid var(--border, #cbd5e1)',
                            background: 'var(--bg-card, #ffffff)',
                            color: '#2563eb',
                            cursor: 'pointer'
                          }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Record Rows */}
              {!loading && paginatedLogs.map((item) => {
                const admNumber = item.admission_number && item.admission_number.trim() !== ''
                  ? item.admission_number.trim()
                  : null;
                const empNumber = item.employee_id && item.employee_id.trim() !== ''
                  ? item.employee_id.trim()
                  : null;

                const rawType = (item.recipient_type || '').toUpperCase();
                const isTeacher = rawType === 'TEACHER' || (Boolean(empNumber) && !admNumber);
                const isStudent = rawType === 'STUDENT' || rawType === 'PARENT' || (Boolean(admNumber) && !empNumber);

                // Priority: For teachers show employee ID, for students show admission no.
                const displayedId = isTeacher
                  ? (empNumber || admNumber || null)
                  : (admNumber || empNumber || null);
                const isEmployeeBadge = isTeacher && Boolean(empNumber);

                const displayName = item.recipient_name && item.recipient_name.trim() !== '—'
                  ? item.recipient_name.trim()
                  : (item.student_name && item.student_name.trim() !== '—' ? item.student_name.trim() : null);

                const recipientType = item.recipient_type || (isTeacher ? 'TEACHER' : (displayedId ? 'STUDENT' : 'RECIPIENT'));

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border, #f1f5f9)',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, #f8fafc)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* 1. Admission No. / Employee ID */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                      {displayedId ? (
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: 12.5,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: isEmployeeBadge ? 'rgba(37, 99, 235, 0.15)' : 'var(--card-subtle, #f1f5f9)',
                          color: isEmployeeBadge ? '#3b82f6' : 'var(--text, #0f172a)',
                          border: isEmployeeBadge ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--border, #e2e8f0)',
                          display: 'inline-block'
                        }} title={isEmployeeBadge ? `Employee ID: ${displayedId}` : `Admission No: ${displayedId}`}>
                          {displayedId}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>—</span>
                      )}
                    </td>

                    {/* 2. Student / Recipient Name */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: isTeacher ? 'rgba(8, 145, 178, 0.15)' : (admNumber || isStudent ? 'rgba(37, 99, 235, 0.15)' : 'var(--card-subtle, #f1f5f9)'),
                          color: isTeacher ? '#06b6d4' : (admNumber || isStudent ? '#3b82f6' : 'var(--text-secondary, #64748b)'),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 12,
                          flexShrink: 0
                        }}>
                          {displayName ? displayName.charAt(0).toUpperCase() : <User size={14} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text, #0f172a)' }}>
                            {displayName || <span style={{ color: '#94a3b8' }}>—</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {isTeacher ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#0891b2' }}>
                                <Briefcase size={11} /> Teacher
                              </span>
                            ) : (admNumber || isStudent) ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#2563eb' }}>
                                <GraduationCap size={11} /> Student
                              </span>
                            ) : (
                              <span>{recipientType}</span>
                            )}
                            {item.roll_number && (
                              <span>· Roll: {item.roll_number}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 3. Mail ID */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <code style={{
                          fontSize: 12.5,
                          fontFamily: 'monospace',
                          color: 'var(--text, #1e293b)',
                          background: 'var(--card-subtle, #f8fafc)',
                          border: '1px solid var(--border, transparent)',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}>
                          {item.recipient}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.recipient, `email-${item.id}`)}
                          title="Copy Mail ID"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: copiedId === `email-${item.id}` ? '#16a34a' : '#94a3b8',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          {copiedId === `email-${item.id}` ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>

                    {/* 4. Current Status */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                      {renderStatusBadge(item.status)}
                    </td>

                    {/* 5. Subject / Event */}
                    <td style={{ padding: '14px 18px', maxWidth: 260 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--text, #0f172a)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }} title={item.subject || item.template_key}>
                        {item.subject || item.template_key}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                        Template: <code style={{ fontSize: 10.5 }}>{item.template_key}</code>
                      </div>
                    </td>

                    {/* 6. Timestamp */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #334155)', fontWeight: 500 }}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                        {item.created_at ? new Date(item.created_at).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        }) : ''}
                      </div>
                    </td>

                    {/* 7. Action Details */}
                    <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {/* If FAILED or RETRYING, show Quick Retry button */}
                        {(item.status === 'FAILED' || item.status === 'RETRYING') && (
                          <button
                            type="button"
                            onClick={() => handleRetry(item.id)}
                            disabled={retryingId === item.id}
                            title="Retry Delivery"
                            style={{
                              padding: '5px 9px',
                              fontSize: 11.5,
                              fontWeight: 600,
                              borderRadius: 6,
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              cursor: retryingId === item.id ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <RotateCcw size={12} className={retryingId === item.id ? 'spin' : ''} />
                            <span>{retryingId === item.id ? 'Retrying...' : 'Retry'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveModalItem(item)}
                          title="View Log Details"
                          style={{
                            padding: '5px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            background: 'var(--card-subtle, #f8fafc)',
                            color: 'var(--text-secondary, #334155)',
                            border: '1px solid var(--border, #cbd5e1)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Eye size={13} /> Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer & Pagination ── */}
        {!loading && totalItems > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#fafafa',
            fontSize: 13,
            color: '#64748b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>
                Showing <b>{startIndex + 1}</b> to <b>{Math.min(startIndex + pageSize, totalItems)}</b> of <b>{totalItems}</b> records
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    background: '#ffffff'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: safeCurrentPage === 1 ? '#94a3b8' : '#1e293b',
                  cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12.5,
                  fontWeight: 600
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <span style={{ padding: '0 8px', fontWeight: 600, color: 'var(--text, #0f172a)' }}>
                Page {safeCurrentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: safeCurrentPage === totalPages ? '#94a3b8' : '#1e293b',
                  cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12.5,
                  fontWeight: 600
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Log Details Modal ── */}
      {activeModalItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            maxWidth: 640,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            border: '1px solid #cbd5e1'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              background: 'var(--modal-header, #f8fafc)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Mail size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                  Email Delivery Log Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #64748b)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px' }}>
              {retryMessage && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  fontWeight: 500,
                  background: retryMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
                  color: retryMessage.type === 'success' ? '#15803d' : '#b91c1c',
                  border: retryMessage.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca'
                }}>
                  {retryMessage.text}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                {/* Admission No. / Employee ID */}
                {(() => {
                  const mType = (activeModalItem.recipient_type || '').toUpperCase();
                  const mIsTeacher = mType === 'TEACHER' || (Boolean(activeModalItem.employee_id) && !activeModalItem.admission_number);
                  const mId = mIsTeacher
                    ? (activeModalItem.employee_id || activeModalItem.admission_number)
                    : (activeModalItem.admission_number || activeModalItem.employee_id);
                  const mLabel = mIsTeacher ? 'Employee ID' : 'Admission No.';

                  return (
                    <div style={{ background: 'var(--card-subtle, #f8fafc)', padding: 12, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{mLabel}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0f172a)', marginTop: 4, fontFamily: 'monospace' }}>
                        {mId || '—'}
                      </div>
                    </div>
                  );
                })()}

                {/* Status */}
                <div style={{ background: 'var(--card-subtle, #f8fafc)', padding: 12, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current Status</div>
                  <div style={{ marginTop: 4 }}>
                    {renderStatusBadge(activeModalItem.status)}
                  </div>
                </div>

                {/* Recipient Name */}
                <div style={{ background: 'var(--card-subtle, #f8fafc)', padding: 12, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Recipient Name</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text, #0f172a)', marginTop: 4 }}>
                    {activeModalItem.recipient_name || activeModalItem.student_name || '—'}
                  </div>
                </div>

                {/* Mail ID */}
                <div style={{ background: 'var(--card-subtle, #f8fafc)', padding: 12, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Mail ID</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #0f172a)', marginTop: 4, wordBreak: 'break-all' }}>
                    {activeModalItem.recipient}
                  </div>
                </div>
              </div>

              {/* Dummy Recipient Banner */}
              {activeModalItem.status === 'UNSENT' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155'
                }}>
                  <EyeOff size={18} style={{ color: '#64748b', marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      External SMTP Dispatch Suppressed (Status: UNSENT)
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      This recipient has been detected as a synthetic, placeholder, or seeded demo address (e.g. <code>.local</code>, <code>admin@dav.com</code>, <code>student123@gmail.com</code>). Outbound SMTP transmission was suppressed to preserve relay quota.
                    </div>
                  </div>
                </div>
              )}

              {/* Subject */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Subject</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text, #0f172a)', background: 'var(--card-subtle, #f8fafc)', padding: 10, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                  {activeModalItem.subject || '—'}
                </div>
              </div>

              {/* Delivery Attempts & Timestamps */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'var(--card-subtle, #f8fafc)', padding: 10, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Attempts</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                    {activeModalItem.attempts} / {activeModalItem.max_attempts}
                  </div>
                </div>
                <div style={{ background: 'var(--card-subtle, #f8fafc)', padding: 10, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Created At</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                    {activeModalItem.created_at ? new Date(activeModalItem.created_at).toLocaleTimeString() : '—'}
                  </div>
                </div>
                <div style={{ background: 'var(--card-subtle, #f8fafc)', padding: 10, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Sent At</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                    {activeModalItem.sent_at ? new Date(activeModalItem.sent_at).toLocaleTimeString() : '—'}
                  </div>
                </div>
              </div>

              {/* Error Details (if present) */}
              {activeModalItem.last_error && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b91c1c', fontSize: 12.5, fontWeight: 700 }}>
                    <AlertTriangle size={15} /> Last Delivery Error
                  </div>
                  <pre style={{
                    margin: '6px 0 0',
                    fontSize: 12,
                    color: '#991b1b',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace'
                  }}>
                    {activeModalItem.last_error}
                  </pre>
                </div>
              )}

              {/* Message Body snippet */}
              {activeModalItem.message && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Message Snippet</div>
                  <div style={{
                    fontSize: 12.5,
                    color: 'var(--text, #334155)',
                    background: 'var(--card-subtle, #f8fafc)',
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border, #e2e8f0)',
                    maxHeight: 140,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {activeModalItem.message}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <div>
                <code style={{ fontSize: 11, color: '#94a3b8' }}>ID: {activeModalItem.id}</code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {(activeModalItem.status === 'FAILED' || activeModalItem.status === 'RETRYING') && (
                  <button
                    type="button"
                    onClick={() => handleRetry(activeModalItem.id)}
                    disabled={retryingId === activeModalItem.id}
                    style={{
                      padding: '7px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      cursor: retryingId === activeModalItem.id ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <RotateCcw size={13} className={retryingId === activeModalItem.id ? 'spin' : ''} />
                    <span>{retryingId === activeModalItem.id ? 'Retrying...' : 'Retry Delivery'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveModalItem(null)}
                  style={{
                    padding: '7px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 8,
                    background: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
