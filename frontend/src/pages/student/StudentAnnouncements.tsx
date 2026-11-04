import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone,
  ArrowLeft,
  AlertCircle,
  Calendar,
  MessageSquare,
  Send,
  CheckCircle2,
  CornerDownRight,
  Search,
  X,
  Check,
  RotateCcw,
  Building2,
  GraduationCap,
  Paperclip,
  Download,
  Filter,
  AlertTriangle,
  Clock,
  Maximize2,
  Minimize2,
  FileText,
  Eye,
  Loader2
} from 'lucide-react';
import { api } from '../../api';
import { Link, useSearchParams } from 'react-router-dom';
import { studentApi, Announcement } from '../../services/studentApi';
import { useAuth } from '../../hooks/useAuth';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';
import { AnnouncementDateFilter } from '../../components/AnnouncementDateFilter';


export function formatPublishDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatPublishTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function getAudienceBadgeText(item: Announcement): string {
  let clsLabel = '';
  if (item.class_number !== undefined && item.class_number !== null) {
    if (Number(item.class_number) === -1) clsLabel = 'Class L KG';
    else if (Number(item.class_number) === 0) clsLabel = 'Class U KG';
    else clsLabel = `Class ${item.class_number}`;
  }

  const secName = item.section_name || '';

  if (item.audience_type === 'SECTION') {
    return `${clsLabel || 'Class'} · Sec ${secName || 'A'}`;
  } else if (item.audience_type === 'CLASS') {
    return `${clsLabel || 'Class'}`;
  } else if (item.audience_type === 'SCHOOL') {
    return 'Entire School (All)';
  } else if (item.audience_type === 'TEACHER') {
    return 'Teachers & Faculty';
  } else if (item.audience_type === 'STUDENT') {
    return 'All Students';
  } else if (item.audience_type === 'PARENTS') {
    return 'All Parents';
  }
  if (clsLabel) {
    return secName ? `${clsLabel} · Sec ${secName}` : clsLabel;
  }
  return 'School';
}

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
  const [viewingNotice, setViewingNotice] = useState<Announcement | null>(null);
  const [isNoticeMaximized, setIsNoticeMaximized] = useState(false);
  // Attachment Preview Modal State
  const [attachmentPreview, setAttachmentPreview] = useState<{
    open: boolean;
    fileName: string;
    mimeType: string;
    blobUrl: string | null;
    loading: boolean;
    error: string | null;
    noticeId?: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (attachmentPreview?.blobUrl) {
        URL.revokeObjectURL(attachmentPreview.blobUrl);
      }
    };
  }, [attachmentPreview?.blobUrl]);

  const closeAttachmentPreview = () => {
    if (attachmentPreview?.blobUrl) {
      URL.revokeObjectURL(attachmentPreview.blobUrl);
    }
    setAttachmentPreview(null);
  };

  const isPreviewableFile = (fileName?: string, mimeType?: string) => {
    const lower = (fileName || '').toLowerCase();
    const m = (mimeType || '').toLowerCase();
    return (
      m === 'application/pdf' ||
      m.startsWith('image/') ||
      lower.endsWith('.pdf') ||
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp')
    );
  };

  const resolvePreviewMime = (responseType?: string, declaredType?: string, fileName?: string): string => {
    const lowerName = (fileName || '').toLowerCase();
    const respMime = (responseType || '').toLowerCase();
    const declMime = (declaredType || '').toLowerCase();

    if (['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(respMime)) {
      return respMime;
    }
    if (['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(declMime)) {
      return declMime;
    }

    if (lowerName.endsWith('.pdf')) return 'application/pdf';
    if (lowerName.endsWith('.png')) return 'image/png';
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
    if (lowerName.endsWith('.webp')) return 'image/webp';

    return respMime || declMime || 'application/octet-stream';
  };

  const openAttachmentPreview = async (notice: { id: string; attachment_name?: string; attachment_type?: string; attachment_url?: string }) => {
    if (!notice) return;
    const currentNoticeId = notice.id;
    const fileName = notice.attachment_name || 'announcement-attachment';
    const declaredMime = notice.attachment_type || '';

    if (attachmentPreview?.blobUrl) {
      URL.revokeObjectURL(attachmentPreview.blobUrl);
    }

    setAttachmentPreview({
      open: true,
      fileName,
      mimeType: resolvePreviewMime('', declaredMime, fileName),
      blobUrl: null,
      loading: true,
      error: null,
      noticeId: currentNoticeId
    });

    try {
      // Always use the authenticated Axios client - completely avoids browser CSP connect-src violations on data: URLs
      const resp = await api.get(`/communication/announcements/${currentNoticeId}/attachment/preview`, {
        responseType: 'blob'
      });

      const blob: Blob = resp.data;
      const effectiveMime = resolvePreviewMime(blob.type, declaredMime, fileName);
      const blobUrl = URL.createObjectURL(blob);

      setAttachmentPreview((prev) => {
        if (!prev || !prev.open || prev.noticeId !== currentNoticeId) {
          URL.revokeObjectURL(blobUrl);
          return prev;
        }
        return {
          ...prev,
          blobUrl,
          loading: false,
          mimeType: effectiveMime,
          error: null
        };
      });
    } catch (err: any) {
      let errorMessage = 'Failed to load preview.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed?.message) {
            errorMessage = parsed.message;
          }
        } catch {}
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setAttachmentPreview((prev) => {
        if (!prev || !prev.open || prev.noticeId !== currentNoticeId) return prev;
        return {
          ...prev,
          loading: false,
          error: errorMessage
        };
      });
    }
  };

  const handlePreviewDownload = () => {
    if (!attachmentPreview) return;
    if (attachmentPreview.blobUrl) {
      const a = document.createElement('a');
      a.href = attachmentPreview.blobUrl;
      a.download = attachmentPreview.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (attachmentPreview.noticeId) {
      window.open(`/api/communication/announcements/${attachmentPreview.noticeId}/attachment/download`, '_blank');
    }
  };


  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && viewingNotice) {
        setViewingNotice(null);
        setIsNoticeMaximized(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingNotice]);

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
              <div key={a.id} className="student-card student-notice-card rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition-colors mb-4">
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

                    {/* School vs Teacher Badge */}
                    {isTeacherNotice(a) ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                        <GraduationCap size={12} /> Teacher: {a.author_name || 'Teacher'}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1">
                        <Building2 size={12} /> By School Admin
                      </span>
                    )}

                    <span className="notice-date text-xs text-slate-400 flex items-center gap-1">
                      <Calendar size={13} /> {new Date(a.published_at || a.created_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
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

              <h3
                className="notice-title text-[17px] font-bold text-slate-900 dark:text-slate-100 mt-2 mb-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={() => {
                  setViewingNotice(a);
                  if (!a.read_at) handleMarkRead(a);
                }}
                style={{
                  marginTop: 8,
                  cursor: 'pointer',
                  color: 'var(--text, #0f172a)',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#2563eb')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text, #0f172a)')}
                title="Click to view full announcement"
              >
                {a.title}
              </h3>
              {/* Dynamic Author Indicator */}
              <div style={{
                fontSize: 12,
                color: isTeacherNotice(a) ? '#047857' : '#1d4ed8',
                fontWeight: 600,
                marginTop: 2,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}>
                {isTeacherNotice(a) ? (
                  <>
                    <GraduationCap size={13} />
                    <span>Teacher: {a.author_name || 'Teacher'}</span>
                  </>
                ) : (
                  <>
                    <Building2 size={13} />
                    <span>By School Admin</span>
                  </>
                )}
              </div>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {isPreviewableFile(a.attachment_name, a.attachment_type) && (
                      <button
                        type="button"
                        onClick={() => openAttachmentPreview(a)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 14px',
                          borderRadius: 6,
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(37,99,235,0.08)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Eye size={14} /> Preview
                      </button>
                    )}
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
                </div>
              )}

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
    
      {/* ── Viewing Notice Details Modal (Student Portal) ── */}
      {viewingNotice && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingNotice(null);
              setIsNoticeMaximized(false);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isNoticeMaximized ? 8 : 16,
            zIndex: 1050
          }}
        >
          <div
            className="modal"
            style={{
              width: isNoticeMaximized ? 'min(1280px, 98vw)' : 'min(640px, 95vw)',
              height: isNoticeMaximized ? '94vh' : 'auto',
              maxHeight: '94vh',
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: isNoticeMaximized ? 12 : 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'width 0.2s ease, height 0.2s ease, border-radius 0.2s ease',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: isNoticeMaximized ? '16px 24px' : '18px 24px',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              background: 'var(--card-subtle, #f8fafc)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: (viewingNotice.status || 'PUBLISHED') === 'PUBLISHED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                  color: (viewingNotice.status || 'PUBLISHED') === 'PUBLISHED' ? '#10b981' : '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <MessageSquare size={22} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {/* Status Badge */}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: '#ecfdf5',
                      color: '#047857',
                      border: '1px solid #a7f3d0'
                    }}>
                      <CheckCircle2 size={12} />
                      PUBLISHED
                    </span>

                    {/* Priority Badge */}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: viewingNotice.priority === 'EMERGENCY' ? '#fee2e2' : viewingNotice.priority === 'HIGH' ? '#ffedd5' : 'var(--card-subtle, #f1f5f9)',
                      color: viewingNotice.priority === 'EMERGENCY' ? '#b91c1c' : viewingNotice.priority === 'HIGH' ? '#c2410c' : 'var(--text-secondary, #475569)'
                    }}>
                      {viewingNotice.priority === 'EMERGENCY' && <AlertTriangle size={11} />}
                      {viewingNotice.priority || 'NORMAL'}
                    </span>

                    {/* Audience Badge */}
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe'
                    }}>
                      {getAudienceBadgeText(viewingNotice)}
                    </span>
                    {/* Source / Author Badge */}
                    {isTeacherNotice(viewingNotice) ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0'
                      }}>
                        <GraduationCap size={12} />
                        Teacher: {viewingNotice.author_name || 'Teacher'}
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe'
                      }}>
                        <Building2 size={12} />
                        By School Admin
                      </span>
                    )}
                  </div>

                  <h2 style={{
                    margin: 0,
                    fontSize: isNoticeMaximized ? 20 : 17,
                    fontWeight: 700,
                    color: 'var(--text, #0f172a)',
                    lineHeight: 1.35,
                    wordBreak: 'break-word'
                  }}>
                    {viewingNotice.title}
                  </h2>
                  <div style={{
                    fontSize: 12.5,
                    color: isTeacherNotice(viewingNotice) ? '#047857' : '#1d4ed8',
                    fontWeight: 600,
                    marginTop: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}>
                    {isTeacherNotice(viewingNotice) ? (
                      <>
                        <GraduationCap size={13} />
                        <span>Teacher: {viewingNotice.author_name || 'Teacher'}</span>
                      </>
                    ) : (
                      <>
                        <Building2 size={13} />
                        <span>By School Admin</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setIsNoticeMaximized(!isNoticeMaximized)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #64748b)',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'none',
                    transition: 'color 0.15s ease'
                  }}
                  title={isNoticeMaximized ? "Restore down" : "Maximize"}
                  aria-label={isNoticeMaximized ? "Restore down" : "Maximize"}
                >
                  {isNoticeMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewingNotice(null);
                    setIsNoticeMaximized(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #64748b)',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'none',
                    transition: 'color 0.15s ease'
                  }}
                  title="Close"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: isNoticeMaximized ? '24px 32px' : '20px 24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              flex: 1
            }}>
              {/* Meta details strip */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: 'var(--card-subtle, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                fontSize: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary, #475569)' }}>
                  <Clock size={14} style={{ color: '#10b981' }} />
                  <span>
                    Published on <b>{formatPublishDate(viewingNotice.published_at || viewingNotice.created_at)}</b> at <b>{formatPublishTime(viewingNotice.published_at || viewingNotice.created_at)}</b>
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ color: 'var(--text-muted, #64748b)' }}>
                    Recipients: <strong style={{ color: 'var(--text, #0f172a)' }}>{viewingNotice.recipient_count || 1}</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted, #64748b)' }}>
                    Read: <strong style={{ color: 'var(--text, #0f172a)' }}>{viewingNotice.read_count || (viewingNotice.read_at ? 1 : 0)}</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted, #64748b)' }}>
                    Replies: <strong style={{ color: '#2563eb' }}>{viewingNotice.reply_count || 0}</strong>
                  </span>
                </div>
              </div>

              {/* Message Content Container */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted, #64748b)',
                  marginBottom: 8
                }}>
                  Announcement Message
                </label>
                <div style={{
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border, #cbd5e1)',
                  borderLeft: '4px solid #10b981',
                  borderRadius: 8,
                  padding: isNoticeMaximized ? '20px 22px' : '16px 18px',
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: 'var(--text, #1e293b)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: isNoticeMaximized ? 'calc(94vh - 360px)' : 280,
                  minHeight: isNoticeMaximized ? 260 : 'auto',
                  overflowY: 'auto'
                }}>
                  {viewingNotice.message ? (
                    viewingNotice.message
                  ) : (
                    <span style={{ color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic' }}>
                      No message content available.
                    </span>
                  )}
                </div>
              </div>

              {/* Attached Document inside Modal */}
              {viewingNotice.attachment_url && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 11.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted, #64748b)',
                    marginBottom: 8
                  }}>
                    Attached Document
                  </label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 8,
                    backgroundColor: 'var(--card-subtle, #f8fafc)',
                    border: '1px solid var(--border, #cbd5e1)',
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
                          {viewingNotice.attachment_name || 'Attached File'}
                        </div>
                        {viewingNotice.attachment_size ? (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>
                            {(viewingNotice.attachment_size / 1024).toFixed(1)} KB
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {isPreviewableFile(viewingNotice.attachment_name, viewingNotice.attachment_type) && (
                        <button
                          type="button"
                          onClick={() => openAttachmentPreview(viewingNotice)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 14px',
                            borderRadius: 6,
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(37,99,235,0.08)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Eye size={14} /> Preview
                        </button>
                      )}
                      <a
                        href={viewingNotice.attachment_url}
                        download={viewingNotice.attachment_name || 'announcement-attachment'}
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
                        <Download size={14} /> Download File
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border, #e2e8f0)',
              background: 'var(--card-subtle, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12
            }}>
              <button
                type="button"
                onClick={() => {
                  setViewingNotice(null);
                  setIsNoticeMaximized(false);
                }}
                style={{
                  padding: '8px 20px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
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
