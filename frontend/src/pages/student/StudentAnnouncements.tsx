import React, { useState, useEffect, useMemo } from 'react';
import { Megaphone, ArrowLeft, AlertCircle, Calendar, MessageSquare, Send, CheckCircle2, CornerDownRight, Search, X, Check, RotateCcw, Building2, GraduationCap, Paperclip, Download, Filter } from 'lucide-react';
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

  // Source Filter: 'ALL' | 'SCHOOL' | 'TEACHER'
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'SCHOOL' | 'TEACHER'>('ALL');
  // Selected Teacher Name
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>('ALL');

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

  function isTeacherNotice(a: Announcement): boolean {
    if (a.author_role === 'TEACHER' || a.created_by_role === 'TEACHER') return true;
    const author = (a.author_name || '').toLowerCase();
    if (author.includes('school admin') || author.includes('dav admin') || author.includes('administration') || author.includes('principal') || author.includes('management')) {
      return false;
    }
    const role = (a.author_role || a.created_by_role || '').toUpperCase();
    if (['SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return false;
    }
    if (a.author_name && !author.includes('admin') && !author.includes('administration')) {
      return true;
    }
    return false;
  }

  const teacherNames = useMemo(() => {
    const set = new Set<string>();
    announcements.forEach(a => {
      if (isTeacherNotice(a) && a.author_name && a.author_name.trim()) {
        set.add(a.author_name.trim());
      }
    });
    return Array.from(set).sort();
  }, [announcements]);

  const schoolCount = useMemo(() => announcements.filter(a => !isTeacherNotice(a)).length, [announcements]);
  const teacherCount = useMemo(() => announcements.filter(a => isTeacherNotice(a)).length, [announcements]);

  const displayedAnnouncements = useMemo(() => {
    return announcements.filter(a => {
      const isTeacher = isTeacherNotice(a);
      // Source Filter
      if (sourceFilter === 'SCHOOL' && isTeacher) return false;
      if (sourceFilter === 'TEACHER') {
        if (!isTeacher) return false;
        if (selectedTeacherName !== 'ALL' && a.author_name !== selectedTeacherName) return false;
      }

      // Search Query Filter
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesTitle = a.title?.toLowerCase().includes(q);
        const matchesMessage = a.message?.toLowerCase().includes(q);
        const matchesAuthor = a.author_name?.toLowerCase().includes(q);
        const matchesPriority = a.priority?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMessage && !matchesAuthor && !matchesPriority) {
          return false;
        }
      }

      return true;
    });
  }, [announcements, sourceFilter, selectedTeacherName, searchFilter]);

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

      {/* Source Filter Options: All, School, Teacher (with Teacher Name selector) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
        padding: '10px 14px',
        borderRadius: 8,
        backgroundColor: 'var(--card-subtle, #f8fafc)',
        border: '1px solid var(--border, #e2e8f0)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #475569)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Filter size={13} /> Filter:
          </span>

          {/* ALL */}
          <button
            type="button"
            onClick={() => {
              setSourceFilter('ALL');
              setSelectedTeacherName('ALL');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: sourceFilter === 'ALL' ? '1px solid #2563eb' : '1px solid var(--border, #cbd5e1)',
              backgroundColor: sourceFilter === 'ALL' ? '#2563eb' : 'var(--bg-card, #ffffff)',
              color: sourceFilter === 'ALL' ? '#ffffff' : 'var(--text, #0f172a)',
              boxShadow: sourceFilter === 'ALL' ? '0 1px 3px rgba(37,99,235,0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            All <span style={{
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 10,
              backgroundColor: sourceFilter === 'ALL' ? 'rgba(255,255,255,0.25)' : 'var(--card-subtle, #f1f5f9)',
              color: sourceFilter === 'ALL' ? '#ffffff' : 'var(--text-muted, #64748b)'
            }}>{announcements.length}</span>
          </button>

          {/* SCHOOL */}
          <button
            type="button"
            onClick={() => {
              setSourceFilter('SCHOOL');
              setSelectedTeacherName('ALL');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: sourceFilter === 'SCHOOL' ? '1px solid #2563eb' : '1px solid var(--border, #cbd5e1)',
              backgroundColor: sourceFilter === 'SCHOOL' ? '#2563eb' : 'var(--bg-card, #ffffff)',
              color: sourceFilter === 'SCHOOL' ? '#ffffff' : 'var(--text, #0f172a)',
              boxShadow: sourceFilter === 'SCHOOL' ? '0 1px 3px rgba(37,99,235,0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Building2 size={13} />
            School <span style={{
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 10,
              backgroundColor: sourceFilter === 'SCHOOL' ? 'rgba(255,255,255,0.25)' : 'var(--card-subtle, #f1f5f9)',
              color: sourceFilter === 'SCHOOL' ? '#ffffff' : 'var(--text-muted, #64748b)'
            }}>{schoolCount}</span>
          </button>

          {/* TEACHER */}
          <button
            type="button"
            onClick={() => setSourceFilter('TEACHER')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: sourceFilter === 'TEACHER' ? '1px solid #2563eb' : '1px solid var(--border, #cbd5e1)',
              backgroundColor: sourceFilter === 'TEACHER' ? '#2563eb' : 'var(--bg-card, #ffffff)',
              color: sourceFilter === 'TEACHER' ? '#ffffff' : 'var(--text, #0f172a)',
              boxShadow: sourceFilter === 'TEACHER' ? '0 1px 3px rgba(37,99,235,0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <GraduationCap size={14} />
            Teacher <span style={{
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 10,
              backgroundColor: sourceFilter === 'TEACHER' ? 'rgba(255,255,255,0.25)' : 'var(--card-subtle, #f1f5f9)',
              color: sourceFilter === 'TEACHER' ? '#ffffff' : 'var(--text-muted, #64748b)'
            }}>{teacherCount}</span>
          </button>
        </div>

        {/* Specific Teacher Name Filter */}
        {sourceFilter === 'TEACHER' && teacherNames.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
              Teacher:
            </label>
            <select
              value={selectedTeacherName}
              onChange={(e) => setSelectedTeacherName(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 12.5,
                border: '1px solid var(--border, #cbd5e1)',
                backgroundColor: 'var(--bg-card, #ffffff)',
                color: 'var(--text, #0f172a)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Teachers ({teacherCount})</option>
              {teacherNames.map(name => {
                const count = announcements.filter(a => isTeacherNotice(a) && a.author_name === name).length;
                return (
                  <option key={name} value={name}>{name} ({count})</option>
                );
              })}
            </select>
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
                  <div className="notice-badge-group" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`notice-priority-badge priority-${a.priority.toLowerCase()}`}>
                      {a.priority}
                    </span>

                    {/* School vs Teacher Badge */}
                    {isTeacherNotice(a) ? (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <GraduationCap size={12} /> Teacher
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <Building2 size={12} /> School
                      </span>
                    )}

                    <span className="notice-date">
                      <Calendar size={13} /> {new Date(a.published_at || a.created_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
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

              {/* Document / File Attachment */}
              {a.attachment_url && (
                <div style={{
                  marginTop: 14,
                  padding: '12px 16px',
                  borderRadius: 8,
                  backgroundColor: 'var(--card-subtle, #f8fafc)',
                  border: '1px solid var(--border, #cbd5e1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Paperclip size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: 13.5,
                        color: 'var(--text, #0f172a)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {a.attachment_name || 'Attached Document'}
                      </div>
                      {a.attachment_size ? (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>
                          {(a.attachment_size / 1024).toFixed(1)} KB
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <a
                    href={a.attachment_url}
                    download={a.attachment_name || 'announcement-attachment'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      borderRadius: 6,
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      fontSize: 12.5,
                      fontWeight: 600,
                      textDecoration: 'none',
                      boxShadow: '0 1px 2px rgba(37,99,235,0.2)'
                    }}
                  >
                    <Download size={14} /> Download Document
                  </a>
                </div>
              )}

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
