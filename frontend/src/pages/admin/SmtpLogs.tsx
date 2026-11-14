import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  Download,
  ArrowLeft
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
            background: "var(--secondary)",
            color: "var(--success)",
            border: "1px solid var(--border)"
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
            background: "var(--secondary)",
            color: "var(--destructive)",
            border: "1px solid var(--border)"
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
            background: "var(--card)",
            color: "var(--primary)",
            border: "1px solid var(--border)"
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
            background: "var(--secondary)",
            color: "var(--info)",
            border: "1px solid var(--border)"
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
            background: "var(--secondary)",
            color: "var(--warning)",
            border: "1px solid var(--border)"
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
            background: "var(--secondary)",
            color: "var(--muted-foreground)",
            border: "1px solid var(--border)"
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
            background: "var(--secondary)",
            color: "var(--muted-foreground)",
            border: "1px solid var(--border)"
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
            background: "var(--secondary)",
            color: "var(--muted-foreground)",
            border: "1px solid var(--border)"
          }}>
            {status}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-none m-0 pb-10" style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '24px 24px 40px', boxSizing: 'border-box' }}>
      <Link
        to="/dashboard"
        style={{ background: 'transparent', border: 'none', padding: 0, color: '#e11d48', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}
      >
        <ArrowLeft size={16} /> <span>Dashboard</span>
      </Link>
      {/* ── Page Header ── */}
      <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Mail size={22} />
            </div>
            <div>
              <h1 className="m-0 text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                SMTP Email Activity Logs
              </h1>
              <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                School-isolated delivery audit trail. Every record dynamically reflects admission no. / employee ID, recipient name, email ID, and delivery status.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || filteredLogs.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-emerald-600 bg-emerald-600 text-white transition-all shadow-xs ${
              loading || filteredLogs.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-emerald-700'
            }`}
            title={filteredLogs.length === 0 ? 'No logs to export' : `Export ${filteredLogs.length} record(s) to Excel`}
          >
            <Download size={15} />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => fetchLogs(true)}
            disabled={refreshing || loading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all shadow-xs ${
              refreshing || loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60'
            }`}
          >
            <RefreshCw size={15} className={`${refreshing ? 'spin' : ''} text-blue-600 dark:text-blue-400`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Logs'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
        {/* Total Emails */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Logs
            </span>
            <Mail size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {loading ? '—' : metrics.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {selectedMonthLabel ? `Logs for ${selectedMonthLabel}` : 'School records fetched'}
          </div>
        </div>

        {/* Successfully Delivered */}
        <div className="bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Sent
            </span>
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1.5">
            {loading ? '—' : metrics.sent}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
            {selectedMonthLabel ? `Delivered in ${selectedMonthLabel}` : 'Successfully delivered'}
          </div>
        </div>

        {/* Failed Alerts */}
        <div className="bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/80 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Failed
            </span>
            <XCircle size={16} className="text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-400 mt-1.5">
            {loading ? '—' : metrics.failed}
          </div>
          <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
            {selectedMonthLabel ? `Errors in ${selectedMonthLabel}` : 'Transmission errors'}
          </div>
        </div>

        {/* In Queue / Retrying */}
        <div className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800/80 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Queued / Retrying
            </span>
            <Clock size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-1.5">
            {loading ? '—' : (metrics.queued + metrics.retrying)}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
            {selectedMonthLabel ? `Pending in ${selectedMonthLabel}` : 'Pending dispatch worker'}
          </div>
        </div>

        {/* Dummy / Unsent */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Unsent (Dummy)
            </span>
            <EyeOff size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-700 dark:text-slate-200 mt-1.5">
            {loading ? '—' : metrics.unsent}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {selectedMonthLabel ? `Suppressed in ${selectedMonthLabel}` : 'Suppressed mock / placeholder'}
          </div>
        </div>
      </div>

      {/* ── Error Notice Banner ── */}
      {error && (
        <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3 px-4 mb-5 text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} />
            <span className="text-xs font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchLogs()}
            className="py-1 px-2.5 text-xs font-semibold bg-rose-600 text-white border-0 rounded-md cursor-pointer hover:bg-rose-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Filter & Search Toolbar ── */}
      <div style={{
        background: "var(--bg-card, var(--card))",
        border: "1px solid var(--border, var(--border))",
        borderRadius: 4,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        boxShadow: 'none'
      }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 450 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: "var(--muted-foreground)" }} />
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
              borderRadius: 4,
              border: "1px solid var(--border)",
              outline: 'none',
              background: "var(--bg, var(--card))",
              color: "var(--text, var(--foreground))"
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
                color: "var(--muted-foreground)",
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
              borderRadius: 4,
              border: "1px solid var(--border, var(--border))",
              background: "var(--bg, var(--card))",
              boxShadow: 'none'
            }}
            title="Filter email activity logs by month"
          >
            <Calendar size={14} color="#696e79" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary, var(--muted-foreground))" }}>
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
                color: "var(--text, var(--foreground))",
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
                  color: "var(--primary)",
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
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted-foreground)", marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
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
                    borderRadius: 4,
                    fontSize: 12.5,
                    fontWeight: isActive ? 700 : 500,
                    border: isActive ? "1px solid var(--border)" : "1px solid var(--border)",
                    background: isActive ? "var(--primary)" : "var(--card)",
                    color: isActive ? "var(--background)" : "var(--muted-foreground)",
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
        background: "var(--bg-card, var(--card))",
        border: "1px solid var(--border, var(--border))",
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: 'none'
      }}>
        {/* Table Container */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 950 }}>
            <thead>
              <tr style={{
                background: "var(--card)",
                borderBottom: "1px solid var(--border)",
                color: "var(--muted-foreground)",
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
                      <RefreshCw size={26} className="spin" style={{ color: "var(--primary)" }} />
                      <span style={{ fontSize: 14, color: "var(--muted-foreground)", fontWeight: 500 }}>
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
                        background: "var(--secondary)",
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: "var(--muted-foreground)"
                      }}>
                        <Mail size={26} />
                      </div>
                      <div style={{ maxWidth: 420 }}>
                        <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
                          {searchQuery || statusFilter !== 'ALL' || monthFilter !== 'ALL'
                            ? 'No matching email activity records'
                            : 'No SMTP email activity logs found'}
                        </h4>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
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
                            borderRadius: 4,
                            border: "1px solid var(--border, var(--border))",
                            background: "var(--bg-card, var(--card))",
                            color: "var(--primary)",
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
                      borderBottom: "1px solid var(--border, var(--border))",
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, #f9f9fa)')}
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
                          borderRadius: 4,
                          background: isEmployeeBadge ? "var(--accent)" : "var(--card-subtle, var(--secondary))",
                          color: isEmployeeBadge ? "var(--primary)" : "var(--text, var(--foreground))",
                          border: isEmployeeBadge ? "1px solid var(--border)" : "1px solid var(--border, var(--border))",
                          display: 'inline-block'
                        }} title={isEmployeeBadge ? `Employee ID: ${displayedId}` : `Admission No: ${displayedId}`}>
                          {displayedId}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted-foreground)", fontSize: 13, fontWeight: 500 }}>—</span>
                      )}
                    </td>

                    {/* 2. Student / Recipient Name */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: isTeacher ? "var(--secondary)" : (admNumber || isStudent ? "var(--accent)" : "var(--card-subtle, var(--secondary))"),
                          color: isTeacher ? "var(--info)" : (admNumber || isStudent ? "var(--primary)" : "var(--text-secondary, var(--muted-foreground))"),
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
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text, var(--foreground))" }}>
                            {displayName || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {isTeacher ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: "var(--info)" }}>
                                <Briefcase size={11} /> Teacher
                              </span>
                            ) : (admNumber || isStudent) ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: "var(--primary)" }}>
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
                          color: "var(--text, var(--foreground))",
                          background: "var(--card-subtle, var(--card))",
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
                            color: copiedId === `email-${item.id}` ? "var(--success)" : "var(--muted-foreground)",
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
                        color: "var(--text, var(--foreground))",
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }} title={item.subject || item.template_key}>
                        {item.subject || item.template_key}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
                        Template: <code style={{ fontSize: 10.5 }}>{item.template_key}</code>
                      </div>
                    </td>

                    {/* 6. Timestamp */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 500 }}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
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
                              borderRadius: 4,
                              background: "var(--secondary)",
                              color: "var(--destructive)",
                              border: "1px solid var(--border)",
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
                            borderRadius: 4,
                            background: "var(--card-subtle, var(--card))",
                            color: "var(--text-secondary, var(--muted-foreground))",
                            border: "1px solid var(--border, var(--border))",
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
            borderTop: "1px solid var(--border)",
            background: "var(--card)",
            fontSize: 13,
            color: "var(--muted-foreground)"
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
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    fontSize: 12.5,
                    background: "var(--card)"
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
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: safeCurrentPage === 1 ? "var(--muted-foreground)" : "var(--foreground)",
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

              <span style={{ padding: '0 8px', fontWeight: 600, color: "var(--text, var(--foreground))" }}>
                Page {safeCurrentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                style={{
                  padding: '5px 10px',
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: safeCurrentPage === totalPages ? "var(--muted-foreground)" : "var(--foreground)",
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
          background: "var(--card)",
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: "var(--card)",
            borderRadius: 4,
            maxWidth: 640,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'none',
            border: "1px solid var(--border)"
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: "1px solid var(--border, var(--border))",
              background: "var(--modal-header, var(--card))"
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Mail size={20} color="#e11d55" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
                  Email Delivery Log Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: "var(--text-muted, var(--muted-foreground))",
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
                  borderRadius: 4,
                  marginBottom: 16,
                  fontSize: 13,
                  fontWeight: 500,
                  background: retryMessage.type === 'success' ? "var(--secondary)" : "var(--secondary)",
                  color: retryMessage.type === 'success' ? "var(--success)" : "var(--destructive)",
                  border: retryMessage.type === 'success' ? "1px solid var(--border)" : "1px solid var(--border)"
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
                    <div style={{ background: "var(--card-subtle, var(--card))", padding: 12, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted-foreground)", textTransform: 'uppercase' }}>{mLabel}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text, var(--foreground))", marginTop: 4, fontFamily: 'monospace' }}>
                        {mId || '—'}
                      </div>
                    </div>
                  );
                })()}

                {/* Status */}
                <div style={{ background: "var(--card-subtle, var(--card))", padding: 12, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted-foreground)", textTransform: 'uppercase' }}>Current Status</div>
                  <div style={{ marginTop: 4 }}>
                    {renderStatusBadge(activeModalItem.status)}
                  </div>
                </div>

                {/* Recipient Name */}
                <div style={{ background: "var(--card-subtle, var(--card))", padding: 12, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted-foreground)", textTransform: 'uppercase' }}>Recipient Name</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text, var(--foreground))", marginTop: 4 }}>
                    {activeModalItem.recipient_name || activeModalItem.student_name || '—'}
                  </div>
                </div>

                {/* Mail ID */}
                <div style={{ background: "var(--card-subtle, var(--card))", padding: 12, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted-foreground)", textTransform: 'uppercase' }}>Mail ID</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginTop: 4, wordBreak: 'break-all' }}>
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
                  borderRadius: 4,
                  marginBottom: 16,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--muted-foreground)"
                }}>
                  <EyeOff size={18} style={{ color: "var(--muted-foreground)", marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                      External SMTP Dispatch Suppressed (Status: UNSENT)
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                      This recipient has been detected as a synthetic, placeholder, or seeded demo address (e.g. <code>.local</code>, <code>admin@dav.com</code>, <code>student123@gmail.com</code>). Outbound SMTP transmission was suppressed to preserve relay quota.
                    </div>
                  </div>
                </div>
              )}

              {/* Subject */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: 'uppercase', marginBottom: 4 }}>Subject</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text, var(--foreground))", background: "var(--card-subtle, var(--card))", padding: 10, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
                  {activeModalItem.subject || '—'}
                </div>
              </div>

              {/* Delivery Attempts & Timestamps */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                <div style={{ background: "var(--card-subtle, var(--card))", padding: 10, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Attempts</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                    {activeModalItem.attempts} / {activeModalItem.max_attempts}
                  </div>
                </div>
                <div style={{ background: "var(--card-subtle, var(--card))", padding: 10, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Created At</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                    {activeModalItem.created_at ? new Date(activeModalItem.created_at).toLocaleTimeString() : '—'}
                  </div>
                </div>
                <div style={{ background: "var(--card-subtle, var(--card))", padding: 10, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Sent At</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                    {activeModalItem.sent_at ? new Date(activeModalItem.sent_at).toLocaleTimeString() : '—'}
                  </div>
                </div>
              </div>

              {/* Error Details (if present) */}
              {activeModalItem.last_error && (
                <div style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: 14,
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: "var(--destructive)", fontSize: 12.5, fontWeight: 700 }}>
                    <AlertTriangle size={15} /> Last Delivery Error
                  </div>
                  <pre style={{
                    margin: '6px 0 0',
                    fontSize: 12,
                    color: "var(--destructive)",
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: 'uppercase', marginBottom: 4 }}>Message Snippet</div>
                  <div style={{
                    fontSize: 12.5,
                    color: "var(--text, var(--muted-foreground))",
                    background: "var(--card-subtle, var(--card))",
                    padding: 12,
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
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
              borderTop: "1px solid var(--border)",
              background: "var(--card)"
            }}>
              <div>
                <code style={{ fontSize: 11, color: "var(--muted-foreground)" }}>ID: {activeModalItem.id}</code>
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
                      borderRadius: 4,
                      background: "var(--primary)",
                      color: "var(--background)",
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
                    borderRadius: 4,
                    background: "var(--card)",
                    color: "var(--muted-foreground)",
                    border: "1px solid var(--border)",
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
