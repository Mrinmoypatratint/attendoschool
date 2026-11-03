import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Calendar,
  Send,
  CheckCircle2,
  CornerDownRight,
  MessageSquare,
  AlertTriangle,
  Search,
  RefreshCw,
  Clock,
  ArrowLeft,
  Check,
  ShieldAlert,
  Bell,
  RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';
import { AnnouncementDateFilter } from '../../components/AnnouncementDateFilter';

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  priority: 'EMERGENCY' | 'HIGH' | 'NORMAL';
  audience_type: string;
  published_at: string;
  created_at: string;
  author_name?: string;
  read_at?: string | null;
  recipient_id?: string;
  reply_count?: number;
}

export interface ReplyItem {
  id: string;
  announcement_id: string;
  user_id: string;
  author_name: string;
  author_role: string;
  reply_text: string;
  created_at: string;
}

export function TeacherAnnouncements() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'EMERGENCY' | 'HIGH' | 'UNREAD'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Reply state mapped by announcement id
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [replySuccessMap, setReplySuccessMap] = useState<Record<string, string>>({});
  const [repliesMap, setRepliesMap] = useState<Record<string, ReplyItem[]>>({});
  const [loadingRepliesId, setLoadingRepliesId] = useState<string | null>(null);

  async function loadNotices(isManual = false, from = fromDate, to = toDate) {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const params: Record<string, string> = {};
      if (from && from.trim()) params.from = from.trim();
      if (to && to.trim()) params.to = to.trim();

      const res = await api.get('/communication/teacher/inbox', { params });
      const data = Array.isArray(res.data) ? res.data : [];
      setAnnouncements(data);

      // Load replies for all announcements in background
      data.forEach((ann: AnnouncementItem) => {
        loadRepliesForNotice(ann.id);
      });
    } catch (err) {
      console.error('Failed to load teacher notices:', err);
      setAnnouncements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleApplyDateFilter(from: string, to: string) {
    setFromDate(from);
    setToDate(to);
    loadNotices(false, from, to);
  }

  function handleResetDateFilter() {
    setFromDate('');
    setToDate('');
    loadNotices(false, '', '');
  }

  async function loadRepliesForNotice(noticeId: string) {
    try {
      const res = await api.get(`/communication/announcements/${noticeId}/replies`);
      if (Array.isArray(res.data)) {
        setRepliesMap(prev => ({ ...prev, [noticeId]: res.data }));
      }
    } catch (_e) {}
  }

  useEffect(() => {
    loadNotices();
  }, []);

  async function handleMarkRead(notice: AnnouncementItem) {
    if (notice.read_at) return;
    const targetParam = notice.id || notice.recipient_id;
    try {
      const res = await api.post(`/communication/teacher/read/${targetParam}`);
      const readAtTime = res.data?.read_at || new Date().toISOString();
      setAnnouncements(prev =>
        prev.map(n => (n.id === notice.id ? { ...n, read_at: readAtTime } : n))
      );
      window.dispatchEvent(new Event('announcements-read'));
      window.dispatchEvent(new Event('storage'));
    } catch (_e) {}
  }

  async function handleSendReply(noticeId: string) {
    const text = (replyInputs[noticeId] || '').trim();
    if (!text) return;

    setSubmittingReplyId(noticeId);
    try {
      const res = await api.post(`/communication/announcements/${noticeId}/reply`, {
        replyText: text
      });

      // Clear input and show success notification
      setReplyInputs(prev => ({ ...prev, [noticeId]: '' }));
      setReplySuccessMap(prev => ({ ...prev, [noticeId]: 'Reply sent successfully to administration' }));
      setTimeout(() => {
        setReplySuccessMap(prev => {
          const next = { ...prev };
          delete next[noticeId];
          return next;
        });
      }, 4000);

      // Optimistically add to replies or reload
      if (res.data) {
        setRepliesMap(prev => ({
          ...prev,
          [noticeId]: [...(prev[noticeId] || []), res.data]
        }));
      } else {
        loadRepliesForNotice(noticeId);
      }

      // Mark the announcement as read when replying
      const currentAnn = announcements.find(a => a.id === noticeId);
      if (currentAnn && !currentAnn.read_at) {
        handleMarkRead(currentAnn);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Unable to submit reply. Please try again.');
    } finally {
      setSubmittingReplyId(null);
    }
  }

  function handleQuickReply(noticeId: string, quickText: string) {
    setReplyInputs(prev => ({
      ...prev,
      [noticeId]: quickText
    }));
  }

  // Filtered announcements
  const filteredNotices = announcements.filter(item => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchMessage = (item.message || '').toLowerCase().includes(q);
      const matchAuthor = (item.author_name || '').toLowerCase().includes(q);
      if (!matchTitle && !matchMessage && !matchAuthor) return false;
    }

    if (priorityFilter === 'EMERGENCY') return item.priority === 'EMERGENCY';
    if (priorityFilter === 'HIGH') return item.priority === 'HIGH';
    if (priorityFilter === 'UNREAD') return !item.read_at;

    return true;
  });

  const unreadTotal = announcements.filter(n => !n.read_at).length;
  const emergencyTotal = announcements.filter(n => n.priority === 'EMERGENCY').length;
  const highTotal = announcements.filter(n => n.priority === 'HIGH').length;

  return (
    <div className="w-full pb-16">
      {/* ── Top Header / Breadcrumbs ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 no-underline font-semibold hover:underline"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <span className="text-slate-400 text-xs">/</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Announcements &amp; Circulars
          </span>
        </div>

        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="m-0 mb-1.5 text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Megaphone size={26} className="text-blue-600" /> School Announcements
            </h1>
            <p className="m-0 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Official school notices, faculty briefings, and interactive administration response channel for teachers.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadNotices(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Feed'}
          </button>
        </div>
      </div>

      {/* ── Date Filter Control ── */}
      <AnnouncementDateFilter
        fromDate={fromDate}
        toDate={toDate}
        onApply={handleApplyDateFilter}
        onReset={handleResetDateFilter}
        loading={loading || refreshing}
      />

      {/* ── Search & Filter Controls ── */}
      <div className="flex justify-between items-center flex-wrap gap-3 p-3 px-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-5 shadow-sm">
        {/* Filter Pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setPriorityFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none transition-colors ${
              priorityFilter === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
            }`}
          >
            All Notices ({announcements.length})
          </button>

          {unreadTotal > 0 && (
            <button
              type="button"
              onClick={() => setPriorityFilter('UNREAD')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none transition-colors ${
                priorityFilter === 'UNREAD'
                  ? 'bg-sky-600 text-white'
                  : 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
              }`}
            >
              Unread ({unreadTotal})
            </button>
          )}

          {emergencyTotal > 0 && (
            <button
              type="button"
              onClick={() => setPriorityFilter('EMERGENCY')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none transition-colors ${
                priorityFilter === 'EMERGENCY'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 hover:bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
              }`}
            >
              Emergency ({emergencyTotal})
            </button>
          )}

          {highTotal > 0 && (
            <button
              type="button"
              onClick={() => setPriorityFilter('HIGH')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none transition-colors ${
                priorityFilter === 'HIGH'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
              }`}
            >
              High Priority ({highTotal})
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search size={14} className="text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search circulars..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full py-1.5 pl-8 pr-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500 box-border"
          />
        </div>
      </div>

      {/* ── Announcements Content List ── */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-3 block text-blue-600" />
          Loading faculty announcements...
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400">
          <Bell size={36} className="text-slate-400 mx-auto mb-3 block opacity-60" />
          <h3 className="m-0 mb-1.5 text-base font-bold text-slate-800 dark:text-slate-200">
            No Announcements Found
          </h3>
          <p className="m-0 text-xs text-slate-500">
            {searchQuery
              ? `No circulars match "${searchQuery}". Try a different keyword.`
              : fromDate || toDate
              ? `No announcements found for the selected date range (${fromDate || 'Any'} to ${toDate || 'Today'}).`
              : 'There are currently no active notices broadcast to faculty.'}
          </p>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={handleResetDateFilter}
              className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md border-none bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm transition-colors"
            >
              <RotateCcw size={13} />
              Reset Date Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5">
          {filteredNotices.map(notice => {
            const replies = repliesMap[notice.id] || [];
            const isUnread = !notice.read_at;
            const inputValue = replyInputs[notice.id] || '';
            const isSubmitting = submittingReplyId === notice.id;
            const successMsg = replySuccessMap[notice.id];

            return (
              <div
                key={notice.id}
                className={`bg-white dark:bg-slate-800 rounded-xl overflow-hidden transition-all ${
                  notice.priority === 'EMERGENCY'
                    ? 'border-2 border-red-500 shadow-md'
                    : isUnread
                    ? 'border border-blue-500 shadow-md shadow-blue-500/5'
                    : 'border border-slate-200 dark:border-slate-700 shadow-sm'
                }`}
              >
                {/* Notice Header Row */}
                <div
                  className={`p-4 px-5 border-b border-slate-100 dark:border-slate-700/60 flex justify-between items-center flex-wrap gap-2.5 ${
                    isUnread ? 'bg-blue-50/40 dark:bg-blue-950/20' : 'bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Priority Badge */}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        notice.priority === 'EMERGENCY'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                          : notice.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                      }`}
                    >
                      {notice.priority}
                    </span>

                    {/* Date */}
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar size={13} />
                      {notice.published_at
                        ? new Date(notice.published_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })
                        : 'Notice'}
                    </span>

                    {/* Author */}
                    {notice.author_name && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        From: <b className="text-slate-800 dark:text-slate-200">{notice.author_name}</b>
                      </span>
                    )}
                  </div>

                  {/* Read status / Mark as Read */}
                  <div>
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(notice)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-blue-400 dark:border-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 cursor-pointer transition-colors"
                      >
                        <Check size={13} /> Mark as Read
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={13} /> Read
                      </span>
                    )}
                  </div>
                </div>

                {/* Notice Body */}
                <div className="p-5 pb-4">
                  <h3 className="m-0 mb-2.5 text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {notice.title}
                  </h3>

                  <p className="m-0 text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                    {notice.message}
                  </p>
                </div>

                {/* ── Threaded Discussion / Replies Section ── */}
                <div className="bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/60 p-4 px-5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">
                    <MessageSquare size={15} className="text-blue-600" />
                    <span>Responses &amp; Discussion ({replies.length})</span>
                  </div>

                  {/* List of existing replies */}
                  {replies.length > 0 && (
                    <div className="grid gap-2.5 mb-3.5">
                      {replies.map(rep => (
                        <div
                          key={rep.id}
                          className="bg-white dark:bg-slate-800 rounded-lg p-3 px-3.5 border border-slate-200 dark:border-slate-700 shadow-xs"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {rep.author_name || 'Faculty Member'}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  rep.author_role === 'SCHOOL_ADMIN' || rep.author_role === 'SUPER_ADMIN'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                }`}
                              >
                                {rep.author_role === 'SCHOOL_ADMIN'
                                  ? 'Admin'
                                  : rep.author_role === 'TEACHER'
                                  ? 'Faculty'
                                  : rep.author_role}
                              </span>
                            </div>

                            <span className="text-[11px] text-slate-400">
                              {rep.created_at
                                ? new Date(rep.created_at).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : ''}
                            </span>
                          </div>

                          <p className="m-0 text-xs text-slate-700 dark:text-slate-300 leading-normal whitespace-pre-wrap">
                            {rep.reply_text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Success notification banner */}
                  {successMsg && (
                    <div className="mb-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-md text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {/* ── Quick Acknowledgment Options (Hidden for Student profile, available for Admin & Teacher) ── */}
                  {!isStudent && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                      <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-semibold">Quick Replies:</span>
                      {[
                        '👍 Acknowledged and noted.',
                        '✅ Received with thanks.',
                        '📅 Will attend as scheduled.'
                      ].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleQuickReply(notice.id, tag)}
                          className="px-2.5 py-1 text-[11.5px] rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── Reply Input Box (Hidden for Student profile, available for Admin & Teacher) ── */}
                  {!isStudent && (
                    <div className="flex gap-2 items-start">
                      <AutoExpandingTextarea
                        minHeight={40}
                        maxHeight={180}
                        value={inputValue}
                        onChange={e =>
                          setReplyInputs(prev => ({
                            ...prev,
                            [notice.id]: e.target.value
                          }))
                        }
                        placeholder="Type your response, clarification, or question for administration..."
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-sans outline-none focus:ring-1 focus:ring-blue-500"
                      />

                      <button
                        type="button"
                        disabled={isSubmitting || !inputValue.trim()}
                        onClick={() => handleSendReply(notice.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer h-10 whitespace-nowrap shadow-sm transition-colors"
                      >
                        <Send size={14} className={isSubmitting ? 'animate-spin' : ''} />
                        {isSubmitting ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TeacherAnnouncements;
