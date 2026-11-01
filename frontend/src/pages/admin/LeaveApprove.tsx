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
    <div className="student-subpage" style={{ width: '100%', paddingBottom: 40 }}>
      {/* ── Page Header (Matching screenshot style) ── */}
      <div className="student-subpage-header" style={{ marginBottom: 20 }}>
        <div className="student-subpage-title-row">
          <Link to="/dashboard" className="student-back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563EB', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginBottom: 4 }}>
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text, #0F172A)', margin: '2px 0 4px' }}>
            {isTeacher ? 'Student Leave Review' : 'Leave Review'}
          </h1>
          <p className="student-subpage-desc" style={{ fontSize: 14, color: 'var(--text-secondary, #64748B)', margin: 0 }}>
            {isTeacher
              ? 'Review and view submitted student leave applications for your mentored class-section.'
              : 'Review, evaluate, and approve submitted student leave applications.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isTeacher && (
            <button
              type="button"
              onClick={exportToExcel}
              disabled={filteredLeaves.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid rgba(16, 185, 129, 0.3)',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10B981',
                cursor: filteredLeaves.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                opacity: filteredLeaves.length === 0 ? 0.5 : 1,
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                if (filteredLeaves.length > 0) {
                  e.currentTarget.style.background = '#10B981';
                  e.currentTarget.style.color = '#FFF';
                }
              }}
              onMouseLeave={(e) => {
                if (filteredLeaves.length > 0) {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                  e.currentTarget.style.color = '#10B981';
                }
              }}
            >
              <FileSpreadsheet size={15} />
              <span>{selectedLeaveIds.size > 0 ? `Export Excel (${selectedLeaveIds.size})` : 'Export Excel'}</span>
            </button>
          )}

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
          All ({displayCounts.all})
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
          Pending ({displayCounts.pending})
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
          Seen ({displayCounts.seen || 0})
        </button>
        {!isTeacher && (
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
        )}
      </div>

      {/* Search and Role Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', minWidth: 260, flex: 1, maxWidth: 400 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder={isTeacher ? "Search by student name or reason..." : "Search by student name, roll no, reason..."}
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

        {!isTeacher && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} style={{ color: '#64748B' }} />
            <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Role:</span>
            {(['ALL', 'STUDENT', 'TEACHER'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                style={{
                  background: roleFilter === role ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                  color: roleFilter === role ? '#3b82f6' : 'var(--text-secondary, #64748B)',
                  border: roleFilter === role ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border, #E2E8F0)',
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
        )}
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
            {isTeacher && counts.all === 0
              ? 'No student leave applications found for your mentored class-section.'
              : 'No leave requests found in this category.'}
          </p>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
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
        /* Leave Cards Grid for Non-Teachers */
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
                onClick={leave.status === 'SEEN' || (isTeacher && leave.status === 'APPROVED') ? () => setViewingLeave(leave) : undefined}
                style={{
                  background: 'var(--surface, #FFFFFF)',
                  border: '1px solid var(--border, #E2E8F0)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  cursor: (leave.status === 'SEEN' || (isTeacher && leave.status === 'APPROVED')) ? 'pointer' : 'default'
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                        <Clock size={12} /> Pending Review
                      </span>
                    ) : (isTeacher || leave.status === 'SEEN') ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                        <Eye size={12} /> Seen
                      </span>
                    ) : leave.status === 'APPROVED' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                        <CheckCircle2 size={12} /> Approved
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
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
                        background: 'rgba(37, 99, 235, 0.12)',
                        color: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 700,
                        border: '1px solid rgba(59, 130, 246, 0.25)',
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
                      {!isTeacher && (
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
                              background: leave.applicant_type === 'STUDENT' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                              color: leave.applicant_type === 'STUDENT' ? '#3b82f6' : '#a855f7'
                            }}
                          >
                            {leave.applicant_type === 'STUDENT' ? <User size={11} /> : <GraduationCap size={11} />}
                            {leave.applicant_type === 'STUDENT' ? 'Student' : 'Teacher'}
                          </span>
                        </div>
                      )}

                      <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                        <PersonProfileLink kind={leave.applicant_type === 'TEACHER' ? 'teacher' : 'student'} id={leave.applicant_id} name={leave.applicant_name} person={leave as any} />
                      </h3>

                      <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748B)' }}>
                        {leave.detail || `ID: ${leave.identifier || 'N/A'}`}
                      </div>
                    </div>
                  </div>

                  {/* Dates Box */}
                  <div
                    style={{
                      background: 'var(--card-subtle, rgba(255, 255, 255, 0.04))',
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
                      <Calendar size={16} style={{ color: '#3b82f6' }} />
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)', fontWeight: 600 }}>LEAVE PERIOD</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                          {formatDate(leave.start_date)} → {formatDate(leave.end_date)}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        background: 'rgba(37, 99, 235, 0.12)',
                        color: '#3b82f6',
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
                        background: 'var(--card-subtle, rgba(255, 255, 255, 0.03))',
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
                    <div style={{ fontSize: 12, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 10px', borderRadius: 6 }}>
                      Approved {leave.reviewer_name ? `by ${leave.reviewer_name}` : ''}
                      {leave.review_notes ? ` · Note: ${leave.review_notes}` : ''}
                    </div>
                  )}

                  {leave.status === 'REJECTED' && (
                    <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: 6 }}>
                      Rejected {leave.reviewer_name ? `by ${leave.reviewer_name}` : ''}
                      {leave.review_notes ? ` · Reason: ${leave.review_notes}` : ''}
                    </div>
                  )}
                </div>

                {/* View button is only shown for PENDING leaves; in SEEN section it is hidden */}
                {(leave.status === 'PENDING' || (!isTeacher && leave.status !== 'SEEN')) && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid var(--border, #E2E8F0)',
                      background: 'var(--bg-card-footer, #FAFAFA)'
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewLeave(leave);
                      }}
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
                )}
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
              background: 'var(--bg-card, #1e293b)',
              borderRadius: 16,
              maxWidth: 520,
              width: '100%',
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border, #E2E8F0)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid var(--border, #E2E8F0)', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(37, 99, 235, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--card-subtle, rgba(255, 255, 255, 0.04))', borderRadius: 12, marginBottom: 18, border: '1px solid var(--border, #E2E8F0)' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  border: '2px solid rgba(59, 130, 246, 0.25)',
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
                    <PersonProfileLink kind={viewingLeave.applicant_type === 'TEACHER' ? 'teacher' : 'student'} id={viewingLeave.applicant_id} name={viewingLeave.applicant_name} person={viewingLeave as any} />
                  </h4>
                  {!isTeacher && (
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
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)' }}>
                  {viewingLeave.detail || 'Student'}{viewingLeave.roll_number ? ` · Roll No: ${viewingLeave.roll_number}` : ''}{viewingLeave.admission_number || viewingLeave.identifier ? ` · Adm No: ${viewingLeave.admission_number || viewingLeave.identifier}` : ''}
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {(viewingLeave.status === 'SEEN' || (isTeacher && viewingLeave.status === 'APPROVED')) ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    <Eye size={13} /> Seen
                  </span>
                ) : viewingLeave.status === 'PENDING' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    <Clock size={13} /> Pending Review
                  </span>
                ) : viewingLeave.status === 'APPROVED' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    <CheckCircle2 size={13} /> Approved
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    <XCircle size={13} /> Rejected
                  </span>
                )}
              </div>
            </div>

            {/* Leave Details Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div
                style={{
                  background: 'var(--card-subtle, rgba(255, 255, 255, 0.04))',
                  border: '1px solid var(--border, #E2E8F0)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Calendar size={18} style={{ color: '#3b82f6' }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)', fontWeight: 600 }}>REQUESTED DURATION</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                      {formatDate(viewingLeave.start_date)} → {formatDate(viewingLeave.end_date)}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    background: 'rgba(37, 99, 235, 0.12)',
                    color: '#3b82f6',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #64748B)', marginBottom: 6 }}>
                  <FileText size={13} /> REASON FOR LEAVE
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    color: 'var(--text, #334155)',
                    background: 'var(--card-subtle, rgba(255, 255, 255, 0.03))',
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
