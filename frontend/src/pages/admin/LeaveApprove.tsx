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
        if (!nameMatch && !idMatch && !reasonMatch) return false;
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
              ? 'Review, evaluate, and approve submitted student leave applications for your mentored class-section.'
              : 'Review, evaluate, and approve submitted student leave applications.'}
          </p>
        </div>

        <button
          type="button"
          onClick={loadLeaves}
          className="student-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
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

      {/* ── Tabs ── */}
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
            activeTab === 'SEEN'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 active'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('SEEN')}
        >
          Seen ({displayCounts.seen || 0})
        </button>
        {!isTeacher && (
          <button
            type="button"
            className={`student-tab-btn px-4 py-2 text-sm font-semibold cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'APPROVED'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 active'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            onClick={() => setActiveTab('APPROVED')}
          >
            Approved ({counts.approved})
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
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {viewingLeave.detail || `Admission No: ${viewingLeave.identifier || 'N/A'}`}
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
