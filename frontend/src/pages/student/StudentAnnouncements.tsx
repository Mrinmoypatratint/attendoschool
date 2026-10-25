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
          <Link to="/student/dashboard" className="student-back-link">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title">School Announcements</h1>
          <p className="student-subpage-desc">
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="student-inpage-search-bar">
          <Search size={15} color="var(--text-muted, #94a3b8)" />
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
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              width: '100%',
              color: 'var(--text)'
            }}
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => {
                setSearchFilter('');
                setSearchParams({});
              }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {searchFilter && (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Showing <b>{displayedAnnouncements.length}</b> of <b>{announcements.length}</b> announcements
          </div>
        )}
      </div>

      {loading ? (
        <div className="student-loading-spinner">Loading announcements...</div>
      ) : displayedAnnouncements.length === 0 ? (
        <div className="student-empty-state">
          <p>
            {searchFilter
              ? `No announcements matched "${searchFilter}".`
              : fromDate || toDate
              ? `No announcements found for the selected date range (${fromDate || 'Any'} to ${toDate || 'Today'}).`
              : 'No announcements at this time.'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            {searchFilter && (
              <button 
                type="button" 
                onClick={() => { setSearchFilter(''); setSearchParams({}); }}
                style={{ padding: '6px 14px', fontSize: 12.5, borderRadius: 6, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Show all announcements
              </button>
            )}
            {(fromDate || toDate) && (
              <button 
                type="button" 
                onClick={handleResetDateFilter}
                style={{ padding: '6px 14px', fontSize: 12.5, borderRadius: 6, background: 'var(--surface-subtle, #f1f5f9)', color: 'var(--text, #1e293b)', border: '1px solid var(--border, #cbd5e1)', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <RotateCcw size={13} />
                Reset Date Filter
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="student-announcements-feed">
          {displayedAnnouncements.map((a) => {
            const isUnread = !a.read_at;
            return (
              <div key={a.id} className="student-card student-notice-card" style={{ marginBottom: 16 }}>
                <div className="notice-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div className="notice-badge-group" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className={`notice-priority-badge priority-${a.priority.toLowerCase()}`}>
                      {a.priority}
                    </span>
                    <span className="notice-date">
                      <Calendar size={13} /> {new Date(a.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {a.author_name && <span className="notice-author" style={{ marginLeft: 2 }}>By: <b>{a.author_name}</b></span>}
                  </div>

                  {/* Read status / Mark as Read */}
                  <div>
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(a)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: '1px solid var(--border-focus, #3b82f6)',
                          backgroundColor: 'rgba(37, 99, 235, 0.12)',
                          color: 'var(--sidebar-accent, #3b82f6)',
                          cursor: 'pointer'
                        }}
                      >
                        <Check size={13} /> Mark as Read
                      </button>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: '#059669'
                        }}
                      >
                        <CheckCircle2 size={13} /> Read
                      </span>
                    )}
                  </div>
                </div>

              <h3 className="notice-title" style={{ marginTop: 8 }}>{a.title}</h3>
              <p className="notice-body" style={{ whiteSpace: 'pre-wrap' }}>{a.message}</p>

              {/* Reply Action Row — Hidden for Student profile, available only for School Admin / Teacher */}
              {!isStudent && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveReplyId(activeReplyId === a.id ? null : a.id);
                        setReplyText('');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: '1px solid var(--border-strong, #cbd5e1)',
                        backgroundColor: activeReplyId === a.id ? '#2563eb' : 'var(--card-bg, #ffffff)',
                        color: activeReplyId === a.id ? '#ffffff' : 'var(--text, #1e293b)',
                        cursor: 'pointer'
                      }}
                    >
                      <MessageSquare size={13} />
                      {activeReplyId === a.id ? 'Cancel' : 'Reply'}
                    </button>
                  </div>

                  {/* Success Notification */}
                  {replySuccessId === a.id && (
                    <div className="student-notice-reply-success" style={{
                      marginTop: 10,
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <CheckCircle2 size={14} /> Your response was submitted to school administration.
                    </div>
                  )}

                  {/* Inline Interactive Reply Box */}
                  {activeReplyId === a.id && (
                    <div className="student-notice-reply-box">
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CornerDownRight size={13} color="#2563eb" /> Send reply to school administrator:
                      </div>
                      <AutoExpandingTextarea
                        minHeight={38}
                        maxHeight={160}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your response or question regarding this notice..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 5,
                          fontSize: 13,
                          lineHeight: 1.45,
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => setActiveReplyId(null)}
                          className="student-notice-reply-cancel-btn"
                          style={{ padding: '5px 12px', fontSize: 12, borderRadius: 5, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={submittingReply || !replyText.trim()}
                          onClick={() => handleReplySubmit(a.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 14px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 5,
                            border: 'none',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                            opacity: replyText.trim() ? 1 : 0.6
                          }}
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
