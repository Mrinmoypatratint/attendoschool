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
  FileSpreadsheet,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { PersonProfileLink } from '../../components/PersonProfileLink';

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
  roll_number?: string;
  admission_number?: string;
  class_number?: number | string;
  class_name?: string;
  section_name?: string;
  leave_count?: number;
  total_leave_days?: number;
}

// Pure helper functions
function calculateDays(start: string, end: string) {
  if (!start || !end) return 1;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
}

function formatDate(d: string) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStudentClass(leave: LeaveRequest) {
  if (leave.class_number !== undefined && leave.class_number !== null && String(leave.class_number).trim() !== '') {
    const num = Number(leave.class_number);
    if (num === -1) return 'Class L KG';
    if (num === 0) return 'Class U KG';
    return `Class ${num}`;
  }
  if (leave.class_name) return leave.class_name;
  if (leave.detail) {
    const match = leave.detail.match(/Class\s+[^-\s]+/i);
    if (match) return match[0];
  }
  return '—';
}

function getStudentSection(leave: LeaveRequest) {
  if (leave.section_name) return leave.section_name;
  if (leave.detail && leave.detail.includes('-')) {
    const parts = leave.detail.split('-');
    if (parts.length > 1) return parts[parts.length - 1].trim();
  }
  return '—';
}

export default function LeaveApprove() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'SEEN' | 'APPROVED'>('PENDING');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, seen: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'TEACHER'>(isTeacher ? 'STUDENT' : 'ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedLeaveIds, setSelectedLeaveIds] = useState<Set<string>>(new Set());

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



  const studentLeavesCountMap = useMemo(() => {
    const map = new Map<string, { count: number; totalDays: number }>();
    leaves.forEach((l) => {
      if (l.applicant_type === 'STUDENT' && l.applicant_id) {
        const d = calculateDays(l.start_date, l.end_date);
        const curr = map.get(l.applicant_id) || { count: 0, totalDays: 0 };
        map.set(l.applicant_id, {
          count: curr.count + 1,
          totalDays: curr.totalDays + d
        });
      }
    });
    return map;
  }, [leaves]);



  // Filter leaves based on active tab, role, and search
  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      // In teacher portal, only show student leave applications
      if (isTeacher && l.applicant_type !== 'STUDENT') return false;

      // Tab filter
      if (activeTab === 'PENDING' && l.status !== 'PENDING') return false;
      if (activeTab === 'SEEN') {
        if (isTeacher) {
          if (l.status !== 'SEEN' && l.status !== 'APPROVED') return false;
        } else {
          if (l.status !== 'SEEN') return false;
        }
      }
      if (activeTab === 'APPROVED' && l.status !== 'APPROVED') return false;

      // Role filter (only for non-teachers)
      if (!isTeacher && roleFilter !== 'ALL' && l.applicant_type !== roleFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = l.applicant_name?.toLowerCase().includes(q);
        const idMatch = l.identifier?.toLowerCase().includes(q);
        const reasonMatch = l.reason?.toLowerCase().includes(q);
        const rollMatch = l.roll_number?.toLowerCase().includes(q);
        const admMatch = l.admission_number?.toLowerCase().includes(q);
        const classMatch = getStudentClass(l).toLowerCase().includes(q);
        const secMatch = getStudentSection(l).toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !reasonMatch && !rollMatch && !admMatch && !classMatch && !secMatch) return false;
      }

      return true;
    });
  }, [leaves, activeTab, roleFilter, searchQuery, isTeacher]);

  const displayCounts = useMemo(() => {
    if (!isTeacher) return counts;
    const studentList = leaves.filter(l => l.applicant_type === 'STUDENT');
    const all = studentList.length;
    const pending = studentList.filter(l => l.status === 'PENDING').length;
    const seen = studentList.filter(l => l.status === 'SEEN' || l.status === 'APPROVED').length;
    return { all, pending, seen, approved: 0, rejected: 0 };
  }, [isTeacher, counts, leaves]);

const toggleSelectLeave = (id: string) => {
    setSelectedLeaveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllVisibleSelected = filteredLeaves.length > 0 && filteredLeaves.every((l) => selectedLeaveIds.has(l.id));
  const isSomeVisibleSelected = filteredLeaves.some((l) => selectedLeaveIds.has(l.id)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedLeaveIds((prev) => {
        const next = new Set(prev);
        filteredLeaves.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedLeaveIds((prev) => {
        const next = new Set(prev);
        filteredLeaves.forEach((l) => next.add(l.id));
        return next;
      });
    }
  };

  const clearSelection = () => {
    setSelectedLeaveIds(new Set());
  };

  const exportToExcel = () => {
    try {
      const targetLeaves = selectedLeaveIds.size > 0
        ? filteredLeaves.filter((l) => selectedLeaveIds.has(l.id))
        : filteredLeaves;

      if (targetLeaves.length === 0) {
        setFeedback({ type: 'error', message: 'No student leave applications available to export.' });
        return;
      }

      const rows = targetLeaves.map((leave, index) => {
        const days = calculateDays(leave.start_date, leave.end_date);
        const className = getStudentClass(leave);
        const sectionName = getStudentSection(leave);
        const rollNo = leave.roll_number || '—';
        const admNo = leave.admission_number || leave.identifier || '—';
        const studentStats = studentLeavesCountMap.get(leave.applicant_id);
        const countLeaves = leave.leave_count !== undefined ? Number(leave.leave_count) : (studentStats?.count || 1);
        const totalDays = leave.total_leave_days !== undefined ? Number(leave.total_leave_days) : (studentStats?.totalDays || days);

        return {
          'SL No.': index + 1,
          'Student Name': leave.applicant_name,
          'Class': className,
          'Section': sectionName,
          'Roll No': rollNo,
          'Admission No': admNo,
          'Leave Start Date': leave.start_date ? formatDate(leave.start_date) : '—',
          'Leave End Date': leave.end_date ? formatDate(leave.end_date) : '—',
          'Duration (Days)': days,
          'Total Leave Count': `${countLeaves} (${totalDays}d)`,
          'Reason': leave.reason || '—',
          'Status': leave.status,
          'Applied Date': leave.created_at ? formatDate(leave.created_at) : '—',
          'Reviewed By': leave.reviewer_name || (leave.status === 'SEEN' ? 'Seen by Faculty' : '—')
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);

      ws['!cols'] = [
        { wch: 8 },  // SL No.
        { wch: 22 }, // Student Name
        { wch: 12 }, // Class
        { wch: 10 }, // Section
        { wch: 12 }, // Roll No
        { wch: 16 }, // Admission No
        { wch: 16 }, // Start Date
        { wch: 16 }, // End Date
        { wch: 16 }, // Duration (Days)
        { wch: 18 }, // Total Leave Count
        { wch: 34 }, // Reason
        { wch: 14 }, // Status
        { wch: 16 }, // Applied Date
        { wch: 20 }, // Reviewed By
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Student Leave Applications');

      const dateStr = new Date().toISOString().slice(0, 10);
      const suffix = selectedLeaveIds.size > 0 ? `_${selectedLeaveIds.size}_Selected_Students` : '_All';
      const filename = `Student_Leave_Applications_${dateStr}${suffix}.xlsx`;

      XLSX.writeFile(wb, filename);

      setFeedback({
        type: 'success',
        message: selectedLeaveIds.size > 0
          ? `Exported ${selectedLeaveIds.size} selected student leave application(s) to Excel.`
          : `Exported ${targetLeaves.length} student leave application(s) to Excel.`
      });
    } catch (err: any) {
      console.error('Failed to export to Excel:', err);
      setFeedback({ type: 'error', message: 'Failed to export leave applications to Excel.' });
    }
  };


  return (
    <div className="student-subpage w-full pb-10">
      {/* ── Page Header (Matching screenshot style) ── */}
      <div className="student-subpage-header mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="student-subpage-title-row">
          <Link to="/dashboard" className="student-back-link inline-flex items-center gap-1.5 text-blue-600 font-semibold text-xs no-underline mb-1 hover:text-blue-700 transition-colors">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title text-2xl font-extrabold text-slate-900 dark:text-white my-1">
            {isTeacher ? 'Student Leave Review' : 'Leave Review'}
          </h1>
          <p className="student-subpage-desc text-sm text-slate-500 dark:text-slate-400 m-0">
            {isTeacher
              ? 'Review and view submitted student leave applications for your mentored class-section.'
              : 'Review, evaluate, and approve submitted student leave applications.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isTeacher && (
            <button
              type="button"
              onClick={exportToExcel}
              disabled={filteredLeaves.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs cursor-pointer hover:bg-emerald-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <FileSpreadsheet size={15} />
              <span>{selectedLeaveIds.size > 0 ? `Export Excel (${selectedLeaveIds.size})` : 'Export Excel'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadLeaves}
            className="student-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
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

      {/* ── Status Tab Navigation ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '2px solid var(--border, #e2e8f0)',
          marginBottom: 16,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        className="no-scrollbar pb-px [&::-webkit-scrollbar]:hidden"
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
          <span>All</span>
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
            {displayCounts.all}
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
          <span>Pending</span>
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
            {displayCounts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SEEN')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'SEEN' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'SEEN' ? '#4f46e5' : 'var(--text-secondary, #64748b)',
            fontWeight: activeTab === 'SEEN' ? 700 : 500,
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
          <Eye size={18} />
          <span>Seen</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: activeTab === 'SEEN' ? '#e0e7ff' : 'var(--card-subtle, #f1f5f9)',
              color: activeTab === 'SEEN' ? '#4338ca' : '#64748b',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {displayCounts.seen || 0}
          </span>
        </button>

        {!isTeacher && (
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
        )}
      </div>

      {/* Search and Role Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="relative min-w-[260px] flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={isTeacher ? "Search by student name or reason..." : "Search by student name, roll no, reason..."}
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
          <div>Loading leave applications...</div>
        </div>
      ) : filteredLeaves.length === 0 ? (
        /* Empty State matching user's screenshot */
        <div className="student-empty-state text-center py-16 px-5 text-slate-500 dark:text-slate-400 text-sm bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Calendar size={36} className="text-slate-300 dark:text-slate-600 mb-3 mx-auto" />
          <p className="m-0 font-medium text-base text-slate-700 dark:text-slate-300">
            {isTeacher && counts.all === 0
              ? 'No student leave applications found for your mentored class-section.'
              : 'No leave requests found in this category.'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isTeacher && counts.all === 0
              ? 'Leave review duties are routed exclusively to assigned class mentors.'
              : activeTab === 'PENDING' ? 'No pending leave applications awaiting approval.' : 'No leave records to display.'}
          </p>
        </div>
      ) : isTeacher ? (
        /* ── Teacher Portal Table Format (Student Name, Class, Section, Roll No, Adm No, Duration, Leave Count, Leave Reason, Status, Actions) ── */
        <div>
          {selectedLeaveIds.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: 'rgba(37, 99, 235, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 10,
                marginBottom: 14,
                fontSize: 13,
                color: '#3B82F6'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedLeaveIds.size}</span>
                <span>student application(s) selected</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={exportToExcel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#2563EB',
                    color: '#FFF',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} />
                  <span>Download Selected Excel</span>
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'transparent',
                    color: 'var(--text-secondary, #94A3B8)',
                    border: '1px solid var(--border, #334155)',
                    padding: '5px 12px',
                    borderRadius: 6,
                    fontSize: 12.5,
                    cursor: 'pointer'
                  }}
                >
                  <X size={13} />
                  <span>Clear Selection</span>
                </button>
              </div>
            </div>
          )}

          <div className="student-table-wrap" style={{ width: '100%', overflowX: 'auto', background: 'var(--surface, #1e293b)', borderRadius: 12, border: '1px solid var(--border, #334155)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <table className="student-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: 'var(--table-header, rgba(255, 255, 255, 0.03))', borderBottom: '1px solid var(--border, #334155)' }}>
                <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeVisibleSelected;
                      }}
                      onChange={toggleSelectAllVisible}
                      title={isAllVisibleSelected ? 'Deselect all visible applications' : 'Select all visible applications for export'}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563EB', margin: 0, flexShrink: 0 }}
                    />
                    <span>STUDENT NAME</span>
                  </div>
                </th>
                <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', minWidth: 90 }}>
                  CLASS
                </th>
                <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', minWidth: 80 }}>
                  SECTION
                </th>
                <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', minWidth: 90 }}>
                  ROLL NO
                </th>
                <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', minWidth: 100 }}>
                  ADM NO
                </th>
                <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', minWidth: 140 }}>
                  DURATION
                </th>
                <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', minWidth: 110 }}>
                  LEAVE COUNT
                </th>
                <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', minWidth: 160 }}>
                  LEAVE REASON
                </th>
                <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', minWidth: 90 }}>
                  STATUS
                </th>
                <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', textAlign: 'right', minWidth: 90 }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.map((leave) => {
                const days = calculateDays(leave.start_date, leave.end_date);
                const className = getStudentClass(leave);
                const sectionName = getStudentSection(leave);
                const rollNo = leave.roll_number || '—';
                const admNo = leave.admission_number || leave.identifier || '—';
                const studentStats = studentLeavesCountMap.get(leave.applicant_id);
                const countLeaves = leave.leave_count !== undefined ? Number(leave.leave_count) : (studentStats?.count || 1);
                const totalDays = leave.total_leave_days !== undefined ? Number(leave.total_leave_days) : (studentStats?.totalDays || days);

                return (
                  <tr
                    key={leave.id}
                    style={{
                      background: selectedLeaveIds.has(leave.id) ? 'rgba(37, 99, 235, 0.08)' : undefined,
                      borderBottom: '1px solid var(--border, #334155)',
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* Student Name & Checkbox */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={selectedLeaveIds.has(leave.id)}
                          onChange={() => toggleSelectLeave(leave.id)}
                          title={`Select ${leave.applicant_name}`}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563EB', margin: 0, flexShrink: 0 }}
                        />
                        {leave.photo_url ? (
                          <img
                            src={leave.photo_url}
                            alt={leave.applicant_name}
                            style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid #BFDBFE', flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: selectedLeaveIds.has(leave.id) ? '#DBEAFE' : 'rgba(37, 99, 235, 0.12)',
                              color: '#3B82F6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 13,
                              flexShrink: 0,
                              border: selectedLeaveIds.has(leave.id) ? '1px solid #3B82F6' : '1px solid rgba(59, 130, 246, 0.25)'
                            }}
                          >
                            {(leave.applicant_name || 'ST').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text, #0F172A)' }}>
                            <PersonProfileLink kind="student" id={leave.applicant_id} name={leave.applicant_name} person={leave as any} />
                          </div>
                          {leave.identifier && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)' }}>
                              ID: {leave.identifier}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Class */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text, #0F172A)' }}>
                        {className}
                      </span>
                    </td>

                    {/* Section */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 11.5,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(37, 99, 235, 0.1)',
                          color: '#3B82F6',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          display: 'inline-block'
                        }}
                      >
                        {sectionName}
                      </span>
                    </td>

                    {/* Roll No */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text, #0F172A)' }}>
                        {rollNo}
                      </span>
                    </td>

                    {/* Adm No */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary, #64748B)' }}>
                        {admNo}
                      </span>
                    </td>

                    {/* Duration */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text, #0F172A)' }}>
                        {formatDate(leave.start_date)} → {formatDate(leave.end_date)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} />
                        <span>{days} {days === 1 ? 'Day' : 'Days'}</span>
                      </div>
                    </td>

                    {/* Leave Count */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: countLeaves > 1 ? '#2563EB' : 'var(--text-secondary, #64748B)',
                          background: countLeaves > 1 ? 'rgba(37, 99, 235, 0.1)' : 'var(--surface-muted, #F1F5F9)',
                          border: `1px solid ${countLeaves > 1 ? 'rgba(37, 99, 235, 0.25)' : 'var(--border, #E2E8F0)'}`,
                          padding: '3px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title={`${countLeaves} total leave request(s) (${totalDays} total day(s))`}
                      >
                        <FileText size={11} />
                        <span>{countLeaves} {countLeaves === 1 ? 'Leave' : 'Leaves'} ({totalDays}d)</span>
                      </span>
                    </td>

                    {/* Leave Reason */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <div style={{ maxWidth: 220 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text, #0F172A)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                          {leave.reason || '—'}
                        </div>
                        {leave.created_at && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)', marginTop: 2 }}>
                            Applied: {formatDate(leave.created_at)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      {leave.status === 'PENDING' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                          <Clock size={11} /> Pending
                        </span>
                      ) : (leave.status === 'SEEN' || isTeacher) ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                          <Eye size={11} /> Seen
                        </span>
                      ) : leave.status === 'APPROVED' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                          <CheckCircle2 size={11} /> Approved
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                          <XCircle size={11} /> Rejected
                        </span>
                      )}
                    </td>

                    {/* Actions - View Only */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleViewLeave(leave)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: 'rgba(37, 99, 235, 0.12)',
                          color: '#3B82F6',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: 6,
                          padding: '5px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#2563EB';
                          e.currentTarget.style.color = '#FFF';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(37, 99, 235, 0.12)';
                          e.currentTarget.style.color = '#3B82F6';
                        }}
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      ) : (
        /* Leave Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLeaves.map((leave) => {
            const numDays = calculateDays(leave.start_date, leave.end_date);
            return (
              <div
                key={leave.id}
                onClick={leave.status === 'SEEN' || (isTeacher && leave.status === 'APPROVED') ? () => setViewingLeave(leave) : undefined}
                className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-xs hover:shadow-md transition-all ${
                  (leave.status === 'SEEN' || (isTeacher && leave.status === 'APPROVED')) ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                {/* Header: Status and Submission Time */}
                <div className="flex items-center justify-between p-3 px-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
                  <div className="flex items-center gap-1.5">
                    {leave.status === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 py-0.5 px-2 rounded-full text-xs font-bold">
                        <Clock size={12} /> Pending Review
                      </span>
                    ) : (isTeacher || leave.status === 'SEEN') ? (
                      <span className="inline-flex items-center gap-1 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 py-0.5 px-2 rounded-full text-xs font-bold">
                        <Eye size={12} /> Seen
                      </span>
                    ) : leave.status === 'APPROVED' ? (
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
                    Submitted {leave.created_at ? new Date(leave.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </span>
                </div>

                {/* Candidate Info */}
                <div className="p-4 flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-base font-bold border border-blue-200 dark:border-blue-800 overflow-hidden shrink-0">
                      {leave.photo_url ? (
                        <img src={leave.photo_url} alt={leave.applicant_name} className="w-full h-full object-cover" />
                      ) : (
                        leave.applicant_name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {!isTeacher && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold py-0.5 px-1.5 rounded ${
                              leave.applicant_type === 'STUDENT'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            {leave.applicant_type === 'STUDENT' ? <User size={11} /> : <GraduationCap size={11} />}
                            {leave.applicant_type === 'STUDENT' ? 'Student' : 'Teacher'}
                          </span>
                        </div>
                      )}

                      <h3 className="m-0 mt-0.5 text-sm font-bold text-slate-900 dark:text-white truncate">
                        <PersonProfileLink kind={leave.applicant_type === 'TEACHER' ? 'teacher' : 'student'} id={leave.applicant_id} name={leave.applicant_name} person={leave as any} />
                      </h3>

                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {leave.detail || `ID: ${leave.identifier || 'N/A'}`}
                      </div>
                    </div>
                  </div>

                  {/* Dates Box */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 px-3 flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">LEAVE PERIOD</div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {formatDate(leave.start_date)} → {formatDate(leave.end_date)}
                        </div>
                      </div>
                    </div>

                    <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold py-1 px-2 rounded-md">
                      {numDays} {numDays === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>

                  {/* Reason Box */}
                  <div className="mb-3">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      <FileText size={12} /> REASON
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-900/40 p-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 leading-relaxed line-clamp-3">
                      {leave.reason}
                    </div>
                  </div>

                  {/* Approval / Rejection Notes */}
                  {leave.status === 'APPROVED' && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-1.5 px-2.5 rounded-md">
                      Approved {leave.reviewer_name ? `by ${leave.reviewer_name}` : ''}
                      {leave.review_notes ? ` · Note: ${leave.review_notes}` : ''}
                    </div>
                  )}

                  {leave.status === 'REJECTED' && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 p-1.5 px-2.5 rounded-md">
                      Rejected {leave.reviewer_name ? `by ${leave.reviewer_name}` : ''}
                      {leave.review_notes ? ` · Reason: ${leave.review_notes}` : ''}
                    </div>
                  )}
                </div>

                {/* View button is only shown for PENDING leaves; in SEEN section it is hidden */}
                {(leave.status === 'PENDING' || (!isTeacher && leave.status !== 'SEEN')) && (
                  <div className="p-3 px-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewLeave(leave);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-lg py-2 px-4 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                    >
                      <Eye size={15} />
                      <span>View</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── View Application Details Modal ── */}
      {viewingLeave && (
        <div
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center z-50 p-5"
          onClick={() => setViewingLeave(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-700 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="m-0 text-base font-bold text-slate-900 dark:text-white">
                    Leave Application Details
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Submitted {viewingLeave.created_at ? new Date(viewingLeave.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingLeave(null)}
                className="bg-transparent border-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-xl leading-none p-1"
              >
                ×
              </button>
            </div>

            {/* Applicant Profile */}
            <div className="flex items-center gap-3.5 p-3 px-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl mb-4 border border-slate-200 dark:border-slate-700">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-bold border-2 border-blue-200 dark:border-blue-800 overflow-hidden shrink-0">
                {viewingLeave.photo_url ? (
                  <img src={viewingLeave.photo_url} alt={viewingLeave.applicant_name} className="w-full h-full object-cover" />
                ) : (
                  viewingLeave.applicant_name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="m-0 text-sm font-bold text-slate-900 dark:text-white">
                    <PersonProfileLink kind={viewingLeave.applicant_type === 'TEACHER' ? 'teacher' : 'student'} id={viewingLeave.applicant_id} name={viewingLeave.applicant_name} person={viewingLeave as any} />
                  </h4>
                  {!isTeacher && (
                    <span
                      className={`text-[11px] font-bold py-0.5 px-2 rounded-full ${
                        viewingLeave.applicant_type === 'STUDENT'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      }`}
                    >
                      {viewingLeave.applicant_type === 'STUDENT' ? 'Student' : 'Teacher'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {viewingLeave.detail || 'Student'}{viewingLeave.roll_number ? ` · Roll No: ${viewingLeave.roll_number}` : ''}{viewingLeave.admission_number || viewingLeave.identifier ? ` · Adm No: ${viewingLeave.admission_number || viewingLeave.identifier}` : ''}
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {(viewingLeave.status === 'SEEN' || (isTeacher && viewingLeave.status === 'APPROVED')) ? (
                  <span className="inline-flex items-center gap-1 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 py-1 px-2.5 rounded-full text-xs font-bold">
                    <Eye size={13} /> Seen
                  </span>
                ) : viewingLeave.status === 'PENDING' ? (
                  <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 py-1 px-2.5 rounded-full text-xs font-bold">
                    <Clock size={13} /> Pending Review
                  </span>
                ) : viewingLeave.status === 'APPROVED' ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 py-1 px-2.5 rounded-full text-xs font-bold">
                    <CheckCircle2 size={13} /> Approved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 py-1 px-2.5 rounded-full text-xs font-bold">
                    <XCircle size={13} /> Rejected
                  </span>
                )}
              </div>
            </div>

            {/* Leave Details Box */}
            <div className="flex flex-col gap-3.5 mb-5">
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 px-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">REQUESTED DURATION</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatDate(viewingLeave.start_date)} → {formatDate(viewingLeave.end_date)}
                    </div>
                  </div>
                </div>
                <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold py-1 px-2.5 rounded-md">
                  {calculateDays(viewingLeave.start_date, viewingLeave.end_date)} {calculateDays(viewingLeave.start_date, viewingLeave.end_date) === 1 ? 'Day' : 'Days'}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  <FileText size={13} /> REASON FOR LEAVE
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-900/40 p-3 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed min-h-[60px]">
                  {viewingLeave.reason}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3.5 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 size={16} />
                <span>Marked as Seen in Student Portal</span>
              </div>
              <button
                type="button"
                onClick={() => setViewingLeave(null)}
                className="py-2 px-4.5 rounded-lg border-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-xs transition-colors"
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
