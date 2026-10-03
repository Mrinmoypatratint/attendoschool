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
  Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';

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
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'EMERGENCY' | 'HIGH' | 'UNREAD'>('ALL');

  // Reply state mapped by announcement id
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [replySuccessMap, setReplySuccessMap] = useState<Record<string, string>>({});
  const [repliesMap, setRepliesMap] = useState<Record<string, ReplyItem[]>>({});
  const [loadingRepliesId, setLoadingRepliesId] = useState<string | null>(null);

  async function loadNotices(isManual = false) {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.get('/communication/teacher/inbox');
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
    try {
      await api.post(`/communication/teacher/read/${notice.recipient_id || notice.id}`);
      setAnnouncements(prev =>
        prev.map(n => (n.id === notice.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
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
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* ── Top Header / Breadcrumbs ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Link
            to="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 13,
              color: 'var(--primary, #2563eb)',
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
            Announcements & Circulars
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1
              style={{
                margin: '0 0 6px',
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--text, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}
            >
              <Megaphone size={26} color="#2563eb" /> School Announcements
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted, #64748b)', maxWidth: 680 }}>
              Official school notices, faculty briefings, and interactive administration response channel for teachers.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadNotices(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: '1px solid var(--border, #cbd5e1)',
              backgroundColor: 'var(--card, #ffffff)',
              color: 'var(--text, #1e293b)',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Feed'}
          </button>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 16px',
          backgroundColor: 'var(--card, #ffffff)',
          borderRadius: 10,
          border: '1px solid var(--border, #e2e8f0)',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setPriorityFilter('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: priorityFilter === 'ALL' ? '#2563eb' : 'var(--surface-subtle, #f1f5f9)',
              color: priorityFilter === 'ALL' ? '#ffffff' : 'var(--text, #334155)',
              transition: 'all 0.15s ease'
            }}
          >
            All Notices ({announcements.length})
          </button>

          {unreadTotal > 0 && (
            <button
              type="button"
              onClick={() => setPriorityFilter('UNREAD')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: priorityFilter === 'UNREAD' ? '#0284c7' : '#e0f2fe',
                color: priorityFilter === 'UNREAD' ? '#ffffff' : '#0369a1',
                transition: 'all 0.15s ease'
              }}
            >
              Unread ({unreadTotal})
            </button>
          )}

          {emergencyTotal > 0 && (
            <button
              type="button"
              onClick={() => setPriorityFilter('EMERGENCY')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: priorityFilter === 'EMERGENCY' ? '#dc2626' : '#fee2e2',
                color: priorityFilter === 'EMERGENCY' ? '#ffffff' : '#b91c1c',
                transition: 'all 0.15s ease'
              }}
            >
              Emergency ({emergencyTotal})
            </button>
          )}

          {highTotal > 0 && (
            <button
              type="button"
              onClick={() => setPriorityFilter('HIGH')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: priorityFilter === 'HIGH' ? '#ea580c' : '#ffedd5',
                color: priorityFilter === 'HIGH' ? '#ffffff' : '#c2410c',
                transition: 'all 0.15s ease'
              }}
            >
              High Priority ({highTotal})
            </button>
          )}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', minWidth: 240 }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
          <input
            type="text"
            placeholder="Search circulars..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px 6px 32px',
              borderRadius: 6,
              border: '1px solid var(--border, #cbd5e1)',
              backgroundColor: 'var(--surface, #ffffff)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* ── Announcements Content List ── */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: '#2563eb' }} />
          Loading faculty announcements...
        </div>
      ) : filteredNotices.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: 'var(--card, #ffffff)',
            borderRadius: 12,
            border: '1px dashed var(--border, #cbd5e1)',
            color: 'var(--text-muted, #64748b)'
          }}
        >
          <Bell size={36} color="#94a3b8" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: 'var(--text, #1e293b)' }}>
            No Announcements Found
          </h3>
          <p style={{ margin: 0, fontSize: 13.5 }}>
            {searchQuery
              ? `No circulars match "${searchQuery}". Try a different keyword.`
              : 'There are currently no active notices broadcast to faculty.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {filteredNotices.map(notice => {
            const replies = repliesMap[notice.id] || [];
            const isUnread = !notice.read_at;
            const inputValue = replyInputs[notice.id] || '';
            const isSubmitting = submittingReplyId === notice.id;
            const successMsg = replySuccessMap[notice.id];

            return (
              <div
                key={notice.id}
                style={{
                  backgroundColor: 'var(--card, #ffffff)',
                  borderRadius: 12,
                  border: notice.priority === 'EMERGENCY'
                    ? '2px solid #ef4444'
                    : isUnread
                    ? '1.5px solid #3b82f6'
                    : '1px solid var(--border, #e2e8f0)',
                  boxShadow: isUnread
                    ? '0 4px 12px rgba(59, 130, 246, 0.08)'
                    : '0 1px 4px rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Notice Header Row */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border, #f1f5f9)',
                    backgroundColor: isUnread ? 'rgba(59, 130, 246, 0.03)' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {/* Priority Badge */}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 5,
                        backgroundColor:
                          notice.priority === 'EMERGENCY'
                            ? '#fee2e2'
                            : notice.priority === 'HIGH'
                            ? '#ffedd5'
                            : '#eff6ff',
                        color:
                          notice.priority === 'EMERGENCY'
                            ? '#b91c1c'
                            : notice.priority === 'HIGH'
                            ? '#c2410c'
                            : '#1d4ed8'
                      }}
                    >
                      {notice.priority}
                    </span>

                    {/* Date */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12.5,
                        color: 'var(--text-muted, #64748b)'
                      }}
                    >
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
                      <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                        From: <b>{notice.author_name}</b>
                      </span>
                    )}
                  </div>

                  {/* Read status / Mark as Read */}
                  <div>
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(notice)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: '1px solid #bfdbfe',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
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

                {/* Notice Body */}
                <div style={{ padding: '20px 20px 16px' }}>
                  <h3
                    style={{
                      margin: '0 0 10px',
                      fontSize: 17,
                      fontWeight: 700,
                      color: 'var(--text, #0f172a)',
                      lineHeight: 1.35
                    }}
                  >
                    {notice.title}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: 'var(--text, #334155)',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {notice.message}
                  </p>
                </div>

                {/* ── Threaded Discussion / Replies Section ── */}
                <div
                  style={{
                    backgroundColor: 'var(--surface-subtle, #f8fafc)',
                    borderTop: '1px solid var(--border, #e2e8f0)',
                    padding: '16px 20px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text, #1e293b)',
                      marginBottom: 12
                    }}
                  >
                    <MessageSquare size={15} color="#2563eb" />
                    <span>Responses & Discussion ({replies.length})</span>
                  </div>

                  {/* List of existing replies */}
                  {replies.length > 0 && (
                    <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                      {replies.map(rep => (
                        <div
                          key={rep.id}
                          style={{
                            backgroundColor: '#ffffff',
                            borderRadius: 8,
                            padding: '10px 14px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 4
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
                                {rep.author_name || 'Faculty Member'}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor:
                                    rep.author_role === 'SCHOOL_ADMIN' || rep.author_role === 'SUPER_ADMIN'
                                      ? '#dbeafe'
                                      : '#ecfdf5',
                                  color:
                                    rep.author_role === 'SCHOOL_ADMIN' || rep.author_role === 'SUPER_ADMIN'
                                      ? '#1d4ed8'
                                      : '#047857'
                                }}
                              >
                                {rep.author_role === 'SCHOOL_ADMIN'
                                  ? 'Admin'
                                  : rep.author_role === 'TEACHER'
                                  ? 'Faculty'
                                  : rep.author_role}
                              </span>
                            </div>

                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
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

                          <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                            {rep.reply_text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Success notification banner */}
                  {successMsg && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: '8px 12px',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        borderRadius: 6,
                        color: '#065f46',
                        fontSize: 12.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <CheckCircle2 size={15} color="#059669" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {/* ── Quick Acknowledgment Options ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Quick Replies:</span>
                    {[
                      '👍 Acknowledged and noted.',
                      '✅ Received with thanks.',
                      '📅 Will attend as scheduled.'
                    ].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleQuickReply(notice.id, tag)}
                        style={{
                          padding: '3px 9px',
                          fontSize: 11.5,
                          borderRadius: 14,
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#334155',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  {/* ── Reply Input Box ── */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <textarea
                      rows={2}
                      value={inputValue}
                      onChange={e =>
                        setReplyInputs(prev => ({
                          ...prev,
                          [notice.id]: e.target.value
                        }))
                      }
                      placeholder="Type your response, clarification, or question for administration..."
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        fontSize: 13,
                        lineHeight: 1.45,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        outline: 'none',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    />

                    <button
                      type="button"
                      disabled={isSubmitting || !inputValue.trim()}
                      onClick={() => handleSendReply(notice.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 18px',
                        borderRadius: 8,
                        border: 'none',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: inputValue.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
                        opacity: inputValue.trim() && !isSubmitting ? 1 : 0.6,
                        height: 40,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 3px rgba(37,99,235,0.2)'
                      }}
                    >
                      <Send size={14} className={isSubmitting ? 'spin' : ''} />
                      {isSubmitting ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
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
