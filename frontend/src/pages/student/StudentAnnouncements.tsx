import React, { useState, useEffect } from 'react';
import { Megaphone, ArrowLeft, AlertCircle, Calendar, MessageSquare, Send, CheckCircle2, CornerDownRight, Search, X, Check, RotateCcw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { studentApi, Announcement } from '../../services/studentApi';
import { useAuth } from '../../hooks/useAuth';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';
import { AnnouncementDateFilter } from '../../components/AnnouncementDateFilter';

export function StudentAnnouncements() {
  const { user } = useAuth();
  const isStudent = !user || user.role === 'STUDENT';
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || searchParams.get('search') || '';
  const [searchFilter, setSearchFilter] = useState(queryParam);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replySuccessId, setReplySuccessId] = useState<string | null>(null);

  useEffect(() => {
    setSearchFilter(queryParam);
  }, [queryParam]);

  function load(from = fromDate, to = toDate) {
    setLoading(true);
    studentApi
      .getAnnouncements(from || undefined, to || undefined)
      .then((res) => {
        setAnnouncements(Array.isArray(res) ? res : []);
        setLoading(false);
      })
      .catch(() => {
        setAnnouncements([]);
        setLoading(false);
      });
  }

  function handleApplyDateFilter(from: string, to: string) {
    setFromDate(from);
    setToDate(to);
    load(from, to);
  }

  function handleResetDateFilter() {
    setFromDate('');
    setToDate('');
    load('', '');
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMarkRead(notice: Announcement) {
    if (notice.read_at) return;
    const targetParam = String(notice.id || notice.recipient_id || '');
    if (!targetParam) return;
    try {
      const res = await studentApi.markAnnouncementRead(targetParam);
      const readAtTime = (res as any)?.read_at || (res as any)?.data?.read_at || new Date().toISOString();
      setAnnouncements(prev =>
        prev.map(n => (n.id === notice.id ? { ...n, read_at: readAtTime } : n))
      );
      try {
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('cached_student_dashboard_')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch {}
      window.dispatchEvent(new Event('announcements-read'));
      window.dispatchEvent(new Event('storage'));
    } catch (_e) {
      setAnnouncements(prev =>
        prev.map(n => (n.id === notice.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    }
  }

  async function handleReplySubmit(id: string) {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      await studentApi.replyToAnnouncement(id, replyText.trim());
      setReplySuccessId(id);
      setReplyText('');
      setActiveReplyId(null);
      setTimeout(() => setReplySuccessId(null), 4000);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Unable to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  }

  const displayedAnnouncements = announcements.filter(a => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q) || (a.author_name && a.author_name.toLowerCase().includes(q)) || a.priority.toLowerCase().includes(q);
  });

  return (
    <div className="student-subpage">
      <div className="student-subpage-header">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 mb-1">School Announcements</h1>
          <p className="student-subpage-desc text-xs text-slate-500 dark:text-slate-400 m-0">
            Official circulars, student portal broadcasts, and interactive notice response channel.
          </p>
        </div>
      </div>

      {/* Date Range Filter */}
      <AnnouncementDateFilter
        fromDate={fromDate}
        toDate={toDate}
        onApply={handleApplyDateFilter}
        onReset={handleResetDateFilter}
        loading={loading}
      />

      {/* Search & In-Page Filter Bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="student-inpage-search-bar flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1 min-w-[240px]">
          <Search size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Filter announcements by title, keyword, or author..."
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value);
              if (e.target.value.trim()) {
                setSearchParams({ q: e.target.value.trim() });
              } else {
                setSearchParams({});
              }
            }}
            className="border-none outline-none bg-transparent text-xs w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => {
                setSearchFilter('');
                setSearchParams({});
              }}
              className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex p-0"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {searchFilter && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing <b className="text-slate-900 dark:text-slate-100">{displayedAnnouncements.length}</b> of <b className="text-slate-900 dark:text-slate-100">{announcements.length}</b> announcements
          </div>
        )}
      </div>

      {loading ? (
        <div className="student-loading-spinner py-12 text-center text-slate-500 dark:text-slate-400 text-sm">Loading announcements...</div>
      ) : displayedAnnouncements.length === 0 ? (
        <div className="student-empty-state p-10 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm">
          <p className="m-0 mb-3">
            {searchFilter
              ? `No announcements matched "${searchFilter}".`
              : fromDate || toDate
              ? `No announcements found for the selected date range (${fromDate || 'Any'} to ${toDate || 'Today'}).`
              : 'No announcements at this time.'}
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            {searchFilter && (
              <button 
                type="button" 
                onClick={() => { setSearchFilter(''); setSearchParams({}); }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white border-none cursor-pointer transition-colors shadow-sm"
              >
                Show all announcements
              </button>
            )}
            {(fromDate || toDate) && (
              <button 
                type="button" 
                onClick={handleResetDateFilter}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 cursor-pointer inline-flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={13} />
                Reset Date Filter
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="student-announcements-feed space-y-4">
          {displayedAnnouncements.map((a) => {
            const isUnread = !a.read_at;
            return (
              <div key={a.id} className="student-card student-notice-card rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition-colors">
                <div className="notice-header flex items-center justify-between flex-wrap gap-2.5">
                  <div className="notice-badge-group flex items-center gap-2.5 flex-wrap">
                    <span className={`notice-priority-badge priority-${a.priority.toLowerCase()} text-[11px] font-bold px-2 py-0.5 rounded ${
                      a.priority === 'EMERGENCY'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                        : a.priority === 'HIGH'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                    }`}>
                      {a.priority}
                    </span>
                    <span className="notice-date text-xs text-slate-400 flex items-center gap-1">
                      <Calendar size={13} /> {new Date(a.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {a.author_name && <span className="notice-author text-xs text-slate-500 dark:text-slate-400 ml-0.5">By: <b className="text-slate-800 dark:text-slate-200">{a.author_name}</b></span>}
                  </div>

                  {/* Read status / Mark as Read */}
                  <div>
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(a)}
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

                <h3 className="notice-title text-[17px] font-bold text-slate-900 dark:text-slate-100 mt-2 mb-1.5">{a.title}</h3>
                <p className="notice-body text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap m-0">{a.message}</p>

                {/* Reply Action Row — Hidden for Student profile, available only for School Admin / Teacher */}
                {!isStudent && (
                  <>
                    <div className="flex justify-end mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReplyId(activeReplyId === a.id ? null : a.id);
                          setReplyText('');
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded border cursor-pointer transition-colors ${
                          activeReplyId === a.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        <MessageSquare size={13} />
                        {activeReplyId === a.id ? 'Cancel' : 'Reply'}
                      </button>
                    </div>

                    {/* Success Notification */}
                    {replySuccessId === a.id && (
                      <div className="student-notice-reply-success mt-2.5 px-3 py-2 rounded-md text-xs flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={14} /> Your response was submitted to school administration.
                      </div>
                    )}

                    {/* Inline Interactive Reply Box */}
                    {activeReplyId === a.id && (
                      <div className="student-notice-reply-box mt-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-700">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <CornerDownRight size={13} className="text-blue-600 dark:text-blue-400" /> Send reply to school administrator:
                        </div>
                        <AutoExpandingTextarea
                          minHeight={38}
                          maxHeight={160}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your response or question regarding this notice..."
                          className="w-full px-2.5 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs box-border font-sans outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => setActiveReplyId(null)}
                            className="student-notice-reply-cancel-btn px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={submittingReply || !replyText.trim()}
                            onClick={() => handleReplySubmit(a.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-sm"
                          >
                            <Send size={12} /> {submittingReply ? 'Sending...' : 'Send'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
