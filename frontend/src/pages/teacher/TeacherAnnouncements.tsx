import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  RotateCcw,
  MessageCircle,
  Eye,
  Filter,
  Paperclip,
  Download,
  X,
  Edit3,
  FileText,
  Maximize2,
  Minimize2,
  Trash2
} from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';
import { AnnouncementDateFilter } from '../../components/AnnouncementDateFilter';
import { UniversalPreviewModal, DestructiveConfirmModal, PreviewSectionData } from '../../components/preview';
import { PersonProfileLink } from '../../components/PersonProfileLink';

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  priority: 'EMERGENCY' | 'HIGH' | 'NORMAL';
  audience_type: string;
  status?: string;
  class_id?: string;
  section_id?: string;
  class_number?: number;
  section_name?: string;
  published_at?: string;
  created_at?: string;
  author_name?: string;
  created_by?: string;
  created_by_name?: string;
  read_at?: string | null;
  recipient_id?: string;
  recipient_count?: number;
  read_count?: number;
  reply_count?: number;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  attachment_size?: number;
}

export interface AttachedFile {
  name: string;
  size: number;
  type: string;
  data: string;
}

export interface ReplyItem {
  id: string;
  announcement_id: string;
  announcement_title?: string;
  user_id: string;
  author_name: string;
  author_role: string;
  author_email?: string;
  student_name?: string;
  student_roll?: string;
  class_name?: string;
  section_name?: string;
  reply_text: string;
  created_at: string;
}

export const STANDARD_CLASS_LIST = [
  { classNumber: -1, label: 'L-KG' },
  { classNumber: 0, label: 'U-KG' },
  { classNumber: 1, label: 'Class 1' },
  { classNumber: 2, label: 'Class 2' },
  { classNumber: 3, label: 'Class 3' },
  { classNumber: 4, label: 'Class 4' },
  { classNumber: 5, label: 'Class 5' },
  { classNumber: 6, label: 'Class 6' },
  { classNumber: 7, label: 'Class 7' },
  { classNumber: 8, label: 'Class 8' },
  { classNumber: 9, label: 'Class 9' },
  { classNumber: 10, label: 'Class 10' },
  { classNumber: 11, label: 'Class 11' },
  { classNumber: 12, label: 'Class 12' }
];

export function formatClassGrade(num?: number | null): string {
  if (num === -1) return 'L-KG';
  if (num === 0) return 'U-KG';
  if (num !== null && num !== undefined && !isNaN(Number(num))) return `Class ${num}`;
  return '';
}

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

export function TeacherAnnouncements() {
  const { user } = useAuth();

  // Top Tabs: Announcements vs Threaded Replies (Matches School Admin)
  const [activeTab, setActiveTab] = useState<'announcements' | 'all-replies'>('announcements');

  // Filter Bar state: All | Sent | Receive
  const [tableFilter, setTableFilter] = useState<'ALL' | 'SENT' | 'RECEIVE'>('ALL');

  // Notices data
  const [receivedNotices, setReceivedNotices] = useState<AnnouncementItem[]>([]);
  const [sentNotices, setSentNotices] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');

  // Classes and Sections for Target Audience
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  // New Broadcast Form State (AUDIENCE TYPE is strictly 'STUDENT', priority removed)
  const [form, setForm] = useState({
    title: '',
    message: '',
    audienceType: 'STUDENT',
    classId: '',
    sectionId: ''
  });
  const [selectedSectionLetter, setSelectedSectionLetter] = useState<string>('');
  const [attachment, setAttachment] = useState<AttachedFile | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // Universal Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Detail Modal & Drawer States
  const [viewingNotice, setViewingNotice] = useState<AnnouncementItem | null>(null);
  const [isNoticeMaximized, setIsNoticeMaximized] = useState(false);
  const [selectedNoticeForReplies, setSelectedNoticeForReplies] = useState<AnnouncementItem | null>(null);
  const [noticeReplies, setNoticeReplies] = useState<ReplyItem[]>([]);
  const [loadingNoticeReplies, setLoadingNoticeReplies] = useState(false);
  const [allReplies, setAllReplies] = useState<ReplyItem[]>([]);

  // Receive Tab Filter States (from Image 2)
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'EMERGENCY' | 'HIGH' | 'UNREAD'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Reply inputs for Received notices discussion
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [replySuccessMap, setReplySuccessMap] = useState<Record<string, string>>({});
  const [repliesMap, setRepliesMap] = useState<Record<string, ReplyItem[]>>({});

  // Load Classes and Sections
  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data || [])).catch(() => {});
    api.get('/sections').then(r => setSections(r.data || [])).catch(() => {});
  }, []);

  // Map standard grade list L-KG to Class 12 to live DB class records
  const resolvedClasses = useMemo(() => {
    return STANDARD_CLASS_LIST.map(opt => {
      const found = classes.find(c => Number(c.class_number) === opt.classNumber || c.label === opt.label);
      return {
        id: found ? found.id : `cls-${opt.classNumber}`,
        classNumber: opt.classNumber,
        label: opt.label,
        realId: found?.id
      };
    });
  }, [classes]);

  const selectedClass = useMemo(() => {
    if (!form.classId) return null;
    return resolvedClasses.find(c => c.id === form.classId || String(c.classNumber) === String(form.classId)) || null;
  }, [form.classId, resolvedClasses]);

  // Find all sections belonging to the selected class
  const classSections = useMemo(() => {
    if (!selectedClass) return [];
    return sections.filter(s => {
      if (s.class_id && s.class_id === selectedClass.id) return true;
      if (s.classId && s.classId === selectedClass.id) return true;
      if (s.class_number !== undefined && Number(s.class_number) === selectedClass.classNumber) return true;
      return false;
    });
  }, [selectedClass, sections]);

  // Available section letters
  const availableSections = useMemo(() => {
    const letters = ['A', 'B', 'C', 'D'];
    return letters.map(letter => {
      const live = classSections.find(s => (s.name || s.section_name) === letter || s.letter === letter);
      return {
        letter,
        name: `Section ${letter}`,
        id: live?.id || `sec-${letter.toLowerCase()}`
      };
    });
  }, [classSections]);

  function handleClassChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setForm(prev => ({
      ...prev,
      classId: val,
      sectionId: ''
    }));
    setSelectedSectionLetter('');
  }

  function handleSectionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const letter = e.target.value;
    setSelectedSectionLetter(letter);
    const matched = availableSections.find(s => s.letter === letter);
    setForm(prev => ({
      ...prev,
      sectionId: matched ? matched.id : ''
    }));
  }

  // File Attachment Handler
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError('File size exceeds the 10MB limit.');
      return;
    }

    setAttachmentError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        data: reader.result as string
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleRemoveAttachment() {
    setAttachment(null);
    setAttachmentError(null);
  }

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

  function getAudienceBadgeText(item: AnnouncementItem): string {
    let clsLabel = '';
    if (item.class_number !== undefined && item.class_number !== null) {
      clsLabel = formatClassGrade(item.class_number);
    } else if (item.class_id) {
      const c = resolvedClasses.find(rc => rc.id === item.class_id);
      if (c) clsLabel = c.label;
    }

    let secName = item.section_name || '';
    if (!secName && item.section_id) {
      const s = sections.find(rs => rs.id === item.section_id);
      if (s) secName = s.name || s.section_name || s.letter || '';
    }

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
    return item.audience_type || 'All Students';
  }

  // ─── Edit Draft Announcement Modal State & Handlers ───
  const [editingDraft, setEditingDraft] = useState<AnnouncementItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    message: '',
    audienceType: 'STUDENT',
    classId: '',
    sectionId: ''
  });
  const [editSelectedSectionLetter, setEditSelectedSectionLetter] = useState<string>('');
  const [editAttachment, setEditAttachment] = useState<AttachedFile | null>(null);
  const [editAttachmentError, setEditAttachmentError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const editSelectedClass = useMemo(() => {
    if (!editForm.classId) return null;
    return resolvedClasses.find(c => c.id === editForm.classId || String(c.classNumber) === String(editForm.classId)) || null;
  }, [editForm.classId, resolvedClasses]);

  const editClassSections = useMemo(() => {
    if (!editSelectedClass) return [];
    return sections.filter(s => {
      if (s.class_id && s.class_id === editSelectedClass.id) return true;
      if (s.classId && s.classId === editSelectedClass.id) return true;
      if (s.class_number !== undefined && Number(s.class_number) === editSelectedClass.classNumber) return true;
      return false;
    });
  }, [editSelectedClass, sections]);

  const editAvailableSections = useMemo(() => {
    const letters = ['A', 'B', 'C', 'D'];
    return letters.map(letter => {
      const live = editClassSections.find(s => (s.name || s.section_name) === letter || s.letter === letter);
      return {
        letter,
        name: `Section ${letter}`,
        id: live?.id || `sec-${letter.toLowerCase()}`
      };
    });
  }, [editClassSections]);

  function handleEditClassChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setEditForm(prev => ({
      ...prev,
      classId: val,
      sectionId: ''
    }));
    setEditSelectedSectionLetter('');
  }

  function handleEditSectionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const letter = e.target.value;
    setEditSelectedSectionLetter(letter);
    const matched = editAvailableSections.find(s => s.letter === letter);
    setEditForm(prev => ({
      ...prev,
      sectionId: matched ? matched.id : ''
    }));
  }

  function handleEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setEditAttachmentError('File size exceeds the 10MB limit.');
      return;
    }

    setEditAttachmentError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setEditAttachment({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        data: reader.result as string
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleRemoveEditAttachment() {
    setEditAttachment(null);
    setEditAttachmentError(null);
  }

  function handleOpenEditDraft(item: AnnouncementItem) {
    setEditingDraft(item);
    setEditError(null);

    let matchedClassId = item.class_id || '';
    if (!matchedClassId && item.class_number !== undefined && item.class_number !== null) {
      const c = resolvedClasses.find(rc => rc.classNumber === Number(item.class_number));
      if (c) matchedClassId = c.id;
    }

    let secLetter = '';
    if (item.section_name) {
      secLetter = String(item.section_name).toUpperCase().trim();
    }

    let matchedSectionId = item.section_id || '';
    if (!matchedSectionId && secLetter) {
      matchedSectionId = `sec-${secLetter.toLowerCase()}`;
    }

    setEditForm({
      title: item.title || '',
      message: item.message || '',
      audienceType: 'STUDENT',
      classId: matchedClassId,
      sectionId: matchedSectionId
    });
    setEditSelectedSectionLetter(secLetter);

    if (item.attachment_url) {
      setEditAttachment({
        name: item.attachment_name || 'Attached Document',
        size: item.attachment_size || 0,
        type: item.attachment_type || '',
        data: item.attachment_url
      });
    } else {
      setEditAttachment(null);
    }
    setEditAttachmentError(null);
  }

  async function handleSaveDraftOnly() {
    if (!editingDraft) return;
    if (!editForm.title.trim()) {
      setEditError('Announcement title is required.');
      return;
    }
    if (!editForm.message.trim()) {
      setEditError('Broadcast message is required.');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const finalAudienceType = editForm.sectionId ? 'SECTION' : (editForm.classId ? 'CLASS' : 'STUDENT');
      await api.put(`/communication/announcements/${editingDraft.id}`, {
        title: editForm.title.trim(),
        message: editForm.message.trim(),
        audienceType: finalAudienceType,
        classId: editForm.classId || undefined,
        sectionId: editForm.sectionId || undefined,
        priority: 'NORMAL',
        attachment_url: editAttachment ? editAttachment.data : null,
        attachment_name: editAttachment ? editAttachment.name : null,
        attachment_type: editAttachment ? editAttachment.type : null,
        attachment_size: editAttachment ? editAttachment.size : null
      });

      setMsg(`Draft announcement "${editForm.title}" saved successfully.`);
      setTimeout(() => setMsg(''), 4000);
      setEditingDraft(null);
      loadData();
    } catch (e: any) {
      setEditError(e?.response?.data?.message || 'Unable to save draft changes.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleConfirmAndPublishDraft() {
    if (!editingDraft) return;
    if (!editForm.title.trim()) {
      setEditError('Announcement title is required.');
      return;
    }
    if (!editForm.message.trim()) {
      setEditError('Broadcast message is required.');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const finalAudienceType = editForm.sectionId ? 'SECTION' : (editForm.classId ? 'CLASS' : 'STUDENT');
      await api.put(`/communication/announcements/${editingDraft.id}`, {
        title: editForm.title.trim(),
        message: editForm.message.trim(),
        audienceType: finalAudienceType,
        classId: editForm.classId || undefined,
        sectionId: editForm.sectionId || undefined,
        priority: 'NORMAL',
        attachment_url: editAttachment ? editAttachment.data : null,
        attachment_name: editAttachment ? editAttachment.name : null,
        attachment_type: editAttachment ? editAttachment.type : null,
        attachment_size: editAttachment ? editAttachment.size : null
      });

      await api.post(`/communication/announcements/${editingDraft.id}/publish`);
      setMsg(`Announcement "${editForm.title}" published and sent to students!`);
      setTimeout(() => setMsg(''), 4000);
      setEditingDraft(null);
      loadData();
    } catch (e: any) {
      setEditError(e?.response?.data?.message || 'Unable to publish announcement.');
    } finally {
      setEditSaving(false);
    }
  }

  // Load Received and Sent notices
  async function loadData(isManual = false, from = fromDate, to = toDate) {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const params: Record<string, string> = {};
      if (from && from.trim()) params.from = from.trim();
      if (to && to.trim()) params.to = to.trim();

      const [inboxRes, allAnnRes] = await Promise.all([
        api.get('/communication/teacher/inbox', { params }).catch(() => ({ data: [] })),
        api.get('/communication/announcements').catch(() => ({ data: [] }))
      ]);

      const inboxData: AnnouncementItem[] = Array.isArray(inboxRes.data) ? inboxRes.data : [];
      setReceivedNotices(inboxData);

      // Load replies for received notices in background
      inboxData.forEach(ann => {
        loadRepliesForNotice(ann.id);
      });

      // Filter sent notices created by this teacher
      const allData: AnnouncementItem[] = Array.isArray(allAnnRes.data) ? allAnnRes.data : [];
      const teacherSent = allData.filter(a => {
        if (user?.id && (a.created_by === user.id || (a as any).author_id === user.id)) return true;
        if (user?.name && (a.author_name === user.name || a.created_by_name === user.name)) return true;
        // Notices to students created by faculty
        if (['STUDENT', 'CLASS', 'SECTION'].includes(a.audience_type) && a.created_by && a.created_by !== '00000000-0000-0000-0000-000000000021') return true;
        return false;
      });
      setSentNotices(teacherSent);

      // Load overall replies
      loadAllReplies();
    } catch (err) {
      console.error('Failed to load notices data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const pollInterval = setInterval(() => {
      loadData(false);
    }, 10000);
    const handleFocus = () => loadData(false);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleFocus);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleFocus);
    };
  }, []);

  async function loadRepliesForNotice(noticeId: string) {
    try {
      const res = await api.get(`/communication/announcements/${noticeId}/replies`);
      if (Array.isArray(res.data)) {
        setRepliesMap(prev => ({ ...prev, [noticeId]: res.data }));
      }
    } catch (_e) {}
  }

  async function loadAllReplies() {
    try {
      const res = await api.get('/communication/replies');
      if (Array.isArray(res.data)) {
        setAllReplies(res.data);
      }
    } catch (_e) {}
  }

  function handleApplyDateFilter(from: string, to: string) {
    setFromDate(from);
    setToDate(to);
    loadData(false, from, to);
  }

  function handleResetDateFilter() {
    setFromDate('');
    setToDate('');
    loadData(false, '', '');
  }

  // Mark received notice as read
  async function handleMarkRead(notice: AnnouncementItem) {
    if (notice.read_at) return;
    const targetParam = notice.id || notice.recipient_id;
    try {
      const res = await api.post(`/communication/teacher/read/${targetParam}`);
      const readAtTime = res.data?.read_at || new Date().toISOString();
      setReceivedNotices(prev =>
        prev.map(n => (n.id === notice.id ? { ...n, read_at: readAtTime } : n))
      );
      window.dispatchEvent(new Event('announcements-read'));
      window.dispatchEvent(new CustomEvent('reviews-updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (_e) {}
  }

  // Send reply to a received notice
  async function handleSendReply(noticeId: string) {
    const text = (replyInputs[noticeId] || '').trim();
    if (!text) return;

    setSubmittingReplyId(noticeId);
    try {
      const res = await api.post(`/communication/announcements/${noticeId}/reply`, {
        replyText: text
      });

      setReplyInputs(prev => ({ ...prev, [noticeId]: '' }));
      setReplySuccessMap(prev => ({ ...prev, [noticeId]: 'Reply sent successfully to administration' }));
      setTimeout(() => {
        setReplySuccessMap(prev => {
          const next = { ...prev };
          delete next[noticeId];
          return next;
        });
      }, 4000);

      if (res.data) {
        setRepliesMap(prev => ({
          ...prev,
          [noticeId]: [...(prev[noticeId] || []), res.data]
        }));
      } else {
        loadRepliesForNotice(noticeId);
      }

      const currentAnn = receivedNotices.find(a => a.id === noticeId);
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

  // Open drawer for notice replies
  async function openNoticeReplies(notice: AnnouncementItem) {
    setSelectedNoticeForReplies(notice);
    setLoadingNoticeReplies(true);
    try {
      const res = await api.get(`/communication/announcements/${notice.id}/replies`);
      setNoticeReplies(res.data || []);
    } catch (_e) {
      setNoticeReplies([]);
    } finally {
      setLoadingNoticeReplies(false);
    }
  }

  // Delete sent announcement
  async function handleDeleteAnnouncement(id: string) {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/communication/announcements/${id}`);
      setSentNotices(prev => prev.filter(x => x.id !== id));
      setMsg('Announcement deleted successfully.');
      setTimeout(() => setMsg(''), 4000);
    } catch (_e) {
      alert('Unable to delete announcement.');
    }
  }

  // Initiate Create -> Opens UniversalPreviewModal
  function handleInitiateCreate() {
    if (!form.title.trim()) {
      alert('Announcement title is required.');
      return;
    }
    if (!form.message.trim()) {
      alert('Broadcast details/message is required.');
      return;
    }
    setPreviewError(null);
    setPreviewOpen(true);
  }

  // Confirm and Publish
  async function handleConfirmAndPublish() {
    if (!form.title.trim() || !form.message.trim()) {
      setPreviewError('Title and message cannot be empty.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const finalAudienceType = form.sectionId ? 'SECTION' : (form.classId ? 'CLASS' : 'STUDENT');
      const res = await api.post('/communication/announcements', {
        title: form.title.trim(),
        message: form.message.trim(),
        audienceType: finalAudienceType,
        classId: form.classId || undefined,
        sectionId: form.sectionId || undefined,
        priority: 'NORMAL',
        publish: true,
        status: 'PUBLISHED',
        author_name: user?.name,
        created_by_name: user?.name,
        author_role: 'TEACHER',
        created_by_role: 'TEACHER',
        attachment_url: attachment ? attachment.data : undefined,
        attachment_name: attachment ? attachment.name : undefined,
        attachment_type: attachment ? attachment.type : undefined,
        attachment_size: attachment ? attachment.size : undefined
      });

      const published = res.data;
      setSentNotices(prev => [published, ...prev]);
      setPreviewOpen(false);
      setForm({
        title: '',
        message: '',
        audienceType: 'STUDENT',
        classId: '',
        sectionId: ''
      });
      setSelectedSectionLetter('');
      setAttachment(null);
      setMsg('Announcement broadcast published successfully to students!');
      setTimeout(() => setMsg(''), 5000);
      loadData();
    } catch (err: any) {
      setPreviewError(err?.response?.data?.message || err?.message || 'Failed to publish announcement.');
    } finally {
      setPreviewLoading(false);
    }
  }

  // Save as Draft
  async function handleSaveDraft() {
    if (!form.title.trim() || !form.message.trim()) {
      setPreviewError('Title and message cannot be empty.');
      return;
    }

    setDraftLoading(true);
    setPreviewError(null);
    try {
      const finalAudienceType = form.sectionId ? 'SECTION' : (form.classId ? 'CLASS' : 'STUDENT');
      const res = await api.post('/communication/announcements', {
        title: form.title.trim(),
        message: form.message.trim(),
        audienceType: finalAudienceType,
        classId: form.classId || undefined,
        sectionId: form.sectionId || undefined,
        priority: 'NORMAL',
        publish: false,
        status: 'DRAFT',
        author_name: user?.name,
        created_by_name: user?.name,
        author_role: 'TEACHER',
        created_by_role: 'TEACHER',
        attachment_url: attachment ? attachment.data : undefined,
        attachment_name: attachment ? attachment.name : undefined,
        attachment_type: attachment ? attachment.type : undefined,
        attachment_size: attachment ? attachment.size : undefined
      });

      const drafted = res.data;
      setSentNotices(prev => [drafted, ...prev]);
      setPreviewOpen(false);
      setForm({
        title: '',
        message: '',
        audienceType: 'STUDENT',
        classId: '',
        sectionId: ''
      });
      setSelectedSectionLetter('');
      setAttachment(null);
      setMsg('Announcement draft saved successfully.');
      setTimeout(() => setMsg(''), 5000);
      loadData();
    } catch (err: any) {
      setPreviewError(err?.response?.data?.message || err?.message || 'Failed to save announcement draft.');
    } finally {
      setDraftLoading(false);
    }
  }

  // Preview Modal Sections
  const previewSections: PreviewSectionData[] = [
    {
      title: 'Broadcast Scope & Delivery Target',
      fields: [
        { label: 'Audience Target', value: 'Student Portal (Students & Parents)', type: 'badge', color: 'blue' },
        ...(form.classId
          ? [
              { label: 'Target Class', value: selectedClass?.label || 'Selected Class' },
              {
                label: 'Delivery Scope',
                value: selectedSectionLetter
                  ? `Delivered to ${selectedClass?.label || 'Class'} · Section ${selectedSectionLetter} only (students & parents)`
                  : `Delivered to all students & parents of ${selectedClass?.label || 'Class'} (All Sections)`
              }
            ]
          : [
              { label: 'Target Scope', value: 'Broadcast to all students & parents school-wide across all classes' }
            ])
      ]
    },
    {
      title: 'Announcement Details',
      fields: [
        { label: 'Title', value: form.title },
        { label: 'Message Content', value: form.message },
        ...(attachment
          ? [
              {
                label: 'Attachment',
                value: `${attachment.name} (${(attachment.size / 1024).toFixed(1)} KB)`
              }
            ]
          : [])
      ]
    }
  ];

  // Filtered Received Notices
  const filteredReceived = useMemo(() => {
    return receivedNotices.filter(item => {
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
  }, [receivedNotices, searchQuery, priorityFilter]);

  // Filtered Sent Notices (Supports date range & search)
  const filteredSent = useMemo(() => {
    return sentNotices.filter(item => {
      if (fromDate && fromDate.trim()) {
        const fromTime = new Date(`${fromDate.trim()}T00:00:00`).getTime();
        const itemTime = new Date(item.published_at || item.created_at || '').getTime();
        if (!isNaN(fromTime) && !isNaN(itemTime) && itemTime < fromTime) return false;
      }
      if (toDate && toDate.trim()) {
        const toTime = new Date(`${toDate.trim()}T23:59:59.999`).getTime();
        const itemTime = new Date(item.published_at || item.created_at || '').getTime();
        if (!isNaN(toTime) && !isNaN(itemTime) && itemTime > toTime) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchMessage = (item.message || '').toLowerCase().includes(q);
        if (!matchTitle && !matchMessage) return false;
      }
      return true;
    });
  }, [sentNotices, searchQuery, fromDate, toDate]);

  // Combined notices count
  const totalNoticesCount = sentNotices.length + receivedNotices.length;
  const unreadReceivedTotal = receivedNotices.filter(n => !n.read_at).length;
  const emergencyReceivedTotal = receivedNotices.filter(n => n.priority === 'EMERGENCY').length;
  const highReceivedTotal = receivedNotices.filter(n => n.priority === 'HIGH').length;

  return (
    <div className="as-communication-page" style={{ width: '100%', maxWidth: '100%', margin: 0, padding: 0, marginTop: -8, boxSizing: 'border-box' }}>
      {/* ── Page Header Row ── */}
      <div className="as-communication-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text, #0f172a)' }}>Announcement</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
            Multi-channel institutional announcements, role-based audience broadcasts, and student notices.
          </p>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px',
          marginBottom: 16,
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 6,
          color: '#1e40af',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxSizing: 'border-box',
          width: '100%'
        }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af' }}>✕</button>
        </div>
      )}

      {/* ── New Broadcast Announcement Form (Audience: Student, Priority Removed) ── */}
          <div className="form-card as-announcement-card" style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box'
          }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: 'var(--text, #0f172a)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={18} color="#2563eb" /> New Broadcast Announcement
            </h3>

            <div style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
              <input
                placeholder="Announcement Title (e.g., Annual Science Olympiad / Faculty Meeting)"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border, #cbd5e1)',
                  backgroundColor: 'var(--bg, #ffffff)',
                  color: 'var(--text, #0f172a)',
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />

              <AutoExpandingTextarea
                placeholder="Broadcast details and instructions..."
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                minHeight={100}
                maxHeight={360}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border, #cbd5e1)',
                  backgroundColor: 'var(--bg, #ffffff)',
                  color: 'var(--text, #0f172a)',
                  fontSize: 13.5,
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />

              {/* Attachment Option Row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '2px 0 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      borderRadius: 6,
                      border: '1px dashed var(--border, #cbd5e1)',
                      backgroundColor: 'var(--card-subtle, #f8fafc)',
                      color: 'var(--text, #334155)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Attach a file to this announcement"
                  >
                    <Paperclip size={15} color="#2563eb" />
                    <span>Attach Document / File</span>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt,.zip"
                    />
                  </label>

                  {attachment ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #bfdbfe',
                      backgroundColor: '#eff6ff',
                      color: '#1e40af',
                      fontSize: 12.5,
                      maxWidth: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <Paperclip size={14} color="#2563eb" />
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                        {attachment.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#2563eb', backgroundColor: '#dbeafe', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        {(attachment.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveAttachment}
                        title="Remove attachment"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#ef4444',
                          padding: 2,
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                      Supports PDF, Word, Excel, images, or documents (max 10MB)
                    </span>
                  )}
                </div>

                {attachmentError && (
                  <div style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={13} /> {attachmentError}
                  </div>
                )}
              </div>

              {/* Audience Controls Row (Audience Type: ONLY Student, Priority Removed) */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                {/* Audience Type: Strictly Student as requested (No dropdown arrow) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 150px', minWidth: 0, maxWidth: '100%' }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>AUDIENCE TYPE</label>
                  <div
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      backgroundColor: 'var(--card-subtle, #f8fafc)',
                      color: 'var(--text, #0f172a)',
                      fontSize: 13,
                      fontWeight: 600,
                      boxSizing: 'border-box',
                      lineHeight: '19px'
                    }}
                  >
                    Student
                  </div>
                </div>

                {/* Class selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 150px', minWidth: 0, maxWidth: '100%' }}>
                  <label style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    lineHeight: 1,
                    color: form.classId ? '#3b82f6' : 'var(--text-muted, #64748b)'
                  }}>
                    <span>CLASS</span>
                  </label>
                  <select
                    value={form.classId}
                    onChange={handleClassChange}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      backgroundColor: 'var(--bg, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">All Classes</option>
                    {resolvedClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Section selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 0, maxWidth: '100%' }}>
                  <label style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    lineHeight: 1,
                    color: selectedSectionLetter ? '#3b82f6' : 'var(--text-muted, #64748b)'
                  }}>
                    <span>SECTION</span>
                  </label>
                  <select
                    value={selectedSectionLetter}
                    onChange={handleSectionChange}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      backgroundColor: 'var(--bg, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">All Sections</option>
                    {availableSections.map(s => (
                      <option key={s.letter} value={s.letter}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Submit Action */}
                <div className="announcement-btn-wrap" style={{ alignSelf: 'flex-end', marginLeft: 'auto', flex: '1 1 auto', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleInitiateCreate}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      padding: '9px 18px',
                      borderRadius: 6,
                      border: 'none',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      maxWidth: '100%',
                      boxShadow: '0 1px 3px rgba(37,99,235,0.25)'
                    }}
                  >
                    <Eye size={15} /> Preview & Save Announcement
                  </button>
                </div>
              </div>

              {/* Informative Real-time Target Audience Indicator */}
              <div style={{
                padding: '10px 14px',
                borderRadius: 6,
                backgroundColor: form.sectionId ? 'rgba(147, 51, 234, 0.12)' : form.classId ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-subtle, #f8fafc)',
                border: form.sectionId ? '1px solid rgba(147, 51, 234, 0.3)' : form.classId ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border, #e2e8f0)',
                color: form.sectionId ? '#c084fc' : form.classId ? '#60a5fa' : 'var(--text, #334155)',
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 2,
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere'
              }}>
                <span style={{ fontWeight: 700 }}>🎯 Target Audience:</span>
                {form.classId && selectedClass ? (
                  selectedSectionLetter ? (
                    <span>
                      <b>{selectedClass.label} · Section {selectedSectionLetter}</b> — Broadcast will go <b>ONLY to {selectedClass.label}-{selectedSectionLetter}</b> (students & linked parents).
                    </span>
                  ) : (
                    <span>
                      <b>{selectedClass.label} (All Sections)</b> — Broadcast will go to all students and parents in {selectedClass.label}.
                    </span>
                  )
                ) : (
                  <span><b>Student Portal (All Students)</b> — Broadcast to all registered students and parents school-wide.</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Filter Bar Header Row (All | Sent | Receive) ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #1e293b)' }}>
              {tableFilter === 'SENT' ? (
                <>My Sent Broadcasts ({sentNotices.length})</>
              ) : tableFilter === 'RECEIVE' ? (
                <>Received School Notices ({receivedNotices.length})</>
              ) : (
                <>Published & Draft Notices ({totalNoticesCount})</>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Filter size={13} /> Filter:
              </span>
              {(['ALL', 'SENT', 'RECEIVE'] as const).map(f => {
                const label = f === 'ALL' ? 'All' : f === 'SENT' ? 'Sent' : 'Recieve';
                const count = f === 'ALL' ? totalNoticesCount : f === 'SENT' ? sentNotices.length : receivedNotices.length;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTableFilter(f)}
                    style={{
                      padding: '4px 11px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: tableFilter === f ? 700 : 500,
                      backgroundColor: tableFilter === f ? 'var(--sidebar-accent, #2563eb)' : 'var(--card-subtle, #f1f5f9)',
                      color: tableFilter === f ? '#ffffff' : 'var(--text-secondary, #475569)',
                      border: '1px solid var(--border, transparent)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{label}</span>
                    <span style={{
                      fontSize: 10.5,
                      opacity: tableFilter === f ? 0.9 : 0.7,
                      backgroundColor: tableFilter === f ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                      padding: '1px 5px',
                      borderRadius: 8
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Content Area: Based on Selected Filter (All / Sent / Receive) ── */}

          {/* 1. RECEIVE TAB: Date Filter, Priority Pills, Search and Cards from Image 2 */}
          {tableFilter === 'RECEIVE' && (
            <div>
              {/* Date Filter Control from Image 2 */}
              <AnnouncementDateFilter
                fromDate={fromDate}
                toDate={toDate}
                onApply={handleApplyDateFilter}
                onReset={handleResetDateFilter}
                loading={loading || refreshing}
              />

              {/* Search & Priority Filter Controls from Image 2 */}
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
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: priorityFilter === 'ALL' ? 700 : 500,
                      backgroundColor: priorityFilter === 'ALL' ? '#2563eb' : 'var(--card-subtle, #f1f5f9)',
                      color: priorityFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary, #475569)',
                      border: '1px solid var(--border, transparent)',
                      cursor: 'pointer'
                    }}
                  >
                    All Notices ({receivedNotices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriorityFilter('UNREAD')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: priorityFilter === 'UNREAD' ? 700 : 500,
                      backgroundColor: priorityFilter === 'UNREAD' ? '#dbeafe' : 'var(--card-subtle, #f1f5f9)',
                      color: priorityFilter === 'UNREAD' ? '#1e40af' : 'var(--text-secondary, #475569)',
                      border: '1px solid var(--border, transparent)',
                      cursor: 'pointer'
                    }}
                  >
                    Unread ({unreadReceivedTotal})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriorityFilter('EMERGENCY')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: priorityFilter === 'EMERGENCY' ? 700 : 500,
                      backgroundColor: priorityFilter === 'EMERGENCY' ? '#fee2e2' : 'var(--card-subtle, #f1f5f9)',
                      color: priorityFilter === 'EMERGENCY' ? '#b91c1c' : 'var(--text-secondary, #475569)',
                      border: '1px solid var(--border, transparent)',
                      cursor: 'pointer'
                    }}
                  >
                    Emergency ({emergencyReceivedTotal})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriorityFilter('HIGH')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: priorityFilter === 'HIGH' ? 700 : 500,
                      backgroundColor: priorityFilter === 'HIGH' ? '#ffedd5' : 'var(--card-subtle, #f1f5f9)',
                      color: priorityFilter === 'HIGH' ? '#c2410c' : 'var(--text-secondary, #475569)',
                      border: '1px solid var(--border, transparent)',
                      cursor: 'pointer'
                    }}
                  >
                    High Priority ({highReceivedTotal})
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', width: 260 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)' }} />
                  <input
                    type="text"
                    placeholder="Search circulars..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      fontSize: 12.5,
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      backgroundColor: 'var(--bg, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      boxSizing: 'border-box'
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Received Notices Cards from Image 2 */}
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  Loading school circulars...
                </div>
              ) : filteredReceived.length === 0 ? (
                <div style={{
                  padding: 48,
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: 10,
                  color: 'var(--text-muted, #64748b)'
                }}>
                  <Megaphone size={32} style={{ opacity: 0.35, margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, fontSize: 14 }}>No received notices found</div>
                  <p style={{ fontSize: 12.5, margin: '4px 0 0' }}>There are no incoming notices matching your current date or filter selection.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                  {filteredReceived.map(notice => {
                    const replies = repliesMap[notice.id] || [];
                    const isUnread = !notice.read_at;

                    return (
                      <div
                        key={notice.id}
                        style={{
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          border: isUnread ? '1.5px solid #3b82f6' : '1px solid var(--border, #e2e8f0)',
                          borderRadius: 10,
                          padding: 20,
                          boxShadow: isUnread ? '0 2px 8px rgba(59, 130, 246, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                          position: 'relative'
                        }}
                      >
                        {/* Notice Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: notice.priority === 'EMERGENCY' ? '#fee2e2' : notice.priority === 'HIGH' ? '#ffedd5' : '#f1f5f9',
                              color: notice.priority === 'EMERGENCY' ? '#b91c1c' : notice.priority === 'HIGH' ? '#c2410c' : '#475569'
                            }}>
                              {notice.priority}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={13} /> {formatPublishDate(notice.published_at || notice.created_at)}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                              From: <b>{notice.author_name || 'Administration'}</b>
                            </span>
                          </div>

                          {/* Read / Unread status */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isUnread ? (
                              <button
                                type="button"
                                onClick={() => handleMarkRead(notice)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '4px 10px',
                                  borderRadius: 5,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  border: '1px solid #3b82f6',
                                  backgroundColor: '#eff6ff',
                                  color: '#1d4ed8',
                                  cursor: 'pointer'
                                }}
                              >
                                <Check size={13} /> Mark as Read
                              </button>
                            ) : (
                              <span style={{ fontSize: 11.5, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                                <CheckCircle2 size={13} /> Read
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Notice Title & Message */}
                        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                          {notice.title}
                        </h3>
                        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text, #334155)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                          {notice.message}
                        </p>

                        {/* Attachment Download if any */}
                        {notice.attachment_url && (
                          <div style={{ marginBottom: 14 }}>
                            <a
                              href={notice.attachment_url}
                              download={notice.attachment_name || 'Notice_Attachment'}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                borderRadius: 6,
                                backgroundColor: 'var(--card-subtle, #f8fafc)',
                                border: '1px solid var(--border, #cbd5e1)',
                                color: '#2563eb',
                                fontSize: 12,
                                fontWeight: 600,
                                textDecoration: 'none'
                              }}
                            >
                              <Paperclip size={13} />
                              <span>{notice.attachment_name || 'Download Attached File'}</span>
                              <Download size={13} />
                            </a>
                          </div>
                        )}

                        {/* Responses & Threaded Discussion Section */}
                        <div style={{ borderTop: '1px solid var(--border, #f1f5f9)', paddingTop: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MessageSquare size={14} color="#2563eb" />
                            <span>Responses & Discussion ({replies.length})</span>
                          </div>

                          {replies.length > 0 && (
                            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                              {replies.map(r => (
                                <div key={r.id} style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: 'var(--card-subtle, #f8fafc)', borderLeft: '3px solid #2563eb', fontSize: 12.5 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text, #0f172a)' }}>{r.author_name}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</span>
                                  </div>
                                  <div style={{ color: 'var(--text, #334155)', whiteSpace: 'pre-wrap' }}>{r.reply_text}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Quick replies & reply input box */}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                            {['👍 Acknowledged and noted.', '✅ Received, thank you.', '❓ Please clarify the scheduled timing.'].map(q => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => handleQuickReply(notice.id, q)}
                                style={{
                                  fontSize: 11.5,
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  backgroundColor: 'var(--card-subtle, #f1f5f9)',
                                  border: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text-secondary, #475569)',
                                  cursor: 'pointer'
                                }}
                              >
                                {q}
                              </button>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              placeholder="Write a response or acknowledgement to administration..."
                              value={replyInputs[notice.id] || ''}
                              onChange={e => setReplyInputs({ ...replyInputs, [notice.id]: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSendReply(notice.id);
                              }}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                fontSize: 13,
                                borderRadius: 6,
                                border: '1px solid var(--border, #cbd5e1)',
                                backgroundColor: 'var(--bg, #ffffff)',
                                color: 'var(--text, #0f172a)'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSendReply(notice.id)}
                              disabled={submittingReplyId === notice.id || !replyInputs[notice.id]?.trim()}
                              style={{
                                padding: '8px 16px',
                                borderRadius: 6,
                                border: 'none',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: (submittingReplyId === notice.id || !replyInputs[notice.id]?.trim()) ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6
                              }}
                            >
                              <Send size={13} />
                              <span>{submittingReplyId === notice.id ? 'Sending...' : 'Send Reply'}</span>
                            </button>
                          </div>

                          {replySuccessMap[notice.id] && (
                            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4, fontWeight: 500 }}>
                              ✓ {replySuccessMap[notice.id]}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. SENT TAB: School Admin Style Table for Teacher Broadcasts to Students */}
          {tableFilter === 'SENT' && (
            <div>
              {/* Date Filter Control */}
              <AnnouncementDateFilter
                fromDate={fromDate}
                toDate={toDate}
                onApply={handleApplyDateFilter}
                onReset={handleResetDateFilter}
                loading={loading || refreshing}
              />

              {/* Search bar for sent notices */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
                  Announcements broadcasted to students and parents by you ({filteredSent.length}):
                </div>
                <div style={{ position: 'relative', width: 260 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)' }} />
                  <input
                    type="text"
                    placeholder="Search my broadcasts..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      fontSize: 12.5,
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      backgroundColor: 'var(--bg, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      boxSizing: 'border-box'
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {filteredSent.length === 0 ? (
                <div style={{
                  padding: 48,
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: 10,
                  color: 'var(--text-muted, #64748b)'
                }}>
                  <Send size={32} style={{ opacity: 0.35, margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, fontSize: 14 }}>No sent broadcasts yet</div>
                  <p style={{ fontSize: 12.5, margin: '4px 0 16px' }}>
                    You have not sent any announcements yet. Use the "New Broadcast Announcement" form above to notify students.
                  </p>
                </div>
              ) : (
                <div className="table-wrap" style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, overflow: 'hidden', overflowX: 'auto', backgroundColor: 'var(--bg-card, #ffffff)', width: '100%', boxSizing: 'border-box' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 640 }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--card-subtle, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                        <th style={{ width: '25%', padding: '10px 12px', textAlign: 'left', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>TITLE</th>
                        <th style={{ width: '14%', padding: '10px 8px', textAlign: 'left', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>AUDIENCE</th>
                        <th style={{ width: '10%', padding: '10px 8px', textAlign: 'left', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>STATUS</th>
                        <th style={{ width: '14%', padding: '10px 8px', textAlign: 'left', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>PUBLISHED AT</th>
                        <th style={{ width: '8%', padding: '10px 4px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>RECIPIENTS</th>
                        <th style={{ width: '8%', padding: '10px 4px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>READ</th>
                        <th style={{ width: '7%', padding: '10px 4px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>REPLIES</th>
                        <th style={{ width: '14%', padding: '10px 12px', textAlign: 'right', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSent.map(x => {
                        let clsLabel = '';
                        if (x.class_number !== undefined && x.class_number !== null) {
                          clsLabel = formatClassGrade(x.class_number);
                        } else if (x.class_id) {
                          const c = resolvedClasses.find(rc => rc.id === x.class_id);
                          if (c) clsLabel = c.label;
                        }

                        let secName = x.section_name || '';
                        if (!secName && x.section_id) {
                          const s = availableSections.find(rs => rs.id === x.section_id);
                          if (s) secName = s.letter;
                        }

                        let audienceBadgeText = 'Students';
                        if (x.audience_type === 'SECTION') {
                          audienceBadgeText = `${clsLabel || 'Class'} · Sec ${secName || 'A'}`;
                        } else if (x.audience_type === 'CLASS') {
                          audienceBadgeText = `${clsLabel || 'Class'}`;
                        } else if (x.audience_type === 'STUDENT') {
                          audienceBadgeText = 'All Students';
                        }

                        return (
                          <tr key={x.id} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                            <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => setViewingNotice(x)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: 13,
                                    color: 'var(--text, #0f172a)',
                                    textAlign: 'left',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title="Click to view message"
                                >
                                  {x.title}
                                </button>
                                {x.attachment_url && (
                                  <span title="File attached" style={{ color: '#2563eb' }}>
                                    <Paperclip size={12} />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                              <span style={{
                                padding: '2px 7px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                backgroundColor: '#eff6ff',
                                color: '#1e40af'
                              }}>
                                {audienceBadgeText}
                              </span>
                            </td>
                            <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                              <span style={{
                                padding: '2px 7px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                backgroundColor: x.status === 'PUBLISHED' ? '#dcfce7' : '#f1f5f9',
                                color: x.status === 'PUBLISHED' ? '#15803d' : '#64748b'
                              }}>
                                {x.status || 'PUBLISHED'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 8px', verticalAlign: 'middle', fontSize: 12, color: 'var(--text-secondary, #475569)' }}>
                              <div>{formatPublishDate(x.published_at || x.created_at)}</div>
                              <div style={{ fontSize: 10.5, color: 'var(--text-muted, #94a3b8)' }}>{formatPublishTime(x.published_at || x.created_at)}</div>
                            </td>
                            <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'middle', fontSize: 11.5, color: 'var(--text-secondary, #475569)' }}>
                              {x.recipient_count || 0}
                            </td>
                            <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                              {(x.read_count || 0) > 0 ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    padding: '2px 7px',
                                    borderRadius: 4,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    backgroundColor: '#ecfdf5',
                                    color: '#047857',
                                    border: '1px solid #a7f3d0'
                                  }}
                                  title={`${x.read_count} student(s) read this announcement`}
                                >
                                  ✓ {x.read_count} Read
                                </span>
                              ) : (
                                <span style={{ fontSize: 11.5, color: 'var(--text-muted, #94a3b8)' }}>0</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                              {(x.reply_count || 0) > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => openNoticeReplies(x)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    border: '1px solid #bfdbfe',
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <MessageCircle size={11} /> {x.reply_count}
                                </button>
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>0</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                {x.status === 'DRAFT' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditDraft(x)}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 4,
                                      border: '1px solid var(--border, #cbd5e1)',
                                      backgroundColor: 'var(--bg, #ffffff)',
                                      color: '#2563eb',
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4
                                    }}
                                    title="Edit Draft Announcement"
                                  >
                                    <Edit3 size={12} /> Edit
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setViewingNotice(x)}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 4,
                                      border: '1px solid var(--border, #cbd5e1)',
                                      backgroundColor: 'var(--bg, #ffffff)',
                                      color: '#2563eb',
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4
                                    }}
                                    title="View Sent Announcement"
                                  >
                                    <Eye size={12} /> Sent
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. ALL TAB: Unified View of Both Sent and Received Notices */}
          {tableFilter === 'ALL' && (
            <div>
              {/* Date Filter Control */}
              <AnnouncementDateFilter
                fromDate={fromDate}
                toDate={toDate}
                onApply={handleApplyDateFilter}
                onReset={handleResetDateFilter}
                loading={loading || refreshing}
              />
              {/* Filter controls */}
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
                  marginBottom: 16,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setTableFilter('SENT')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      cursor: 'pointer'
                    }}
                  >
                    View Sent Broadcasts ({sentNotices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableFilter('RECEIVE')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: '#f0fdf4',
                      color: '#15803d',
                      border: '1px solid #bbf7d0',
                      cursor: 'pointer'
                    }}
                  >
                    View Received Notices ({receivedNotices.length})
                  </button>
                </div>

                <div style={{ position: 'relative', width: 260 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)' }} />
                  <input
                    type="text"
                    placeholder="Search all notices..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      fontSize: 12.5,
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      backgroundColor: 'var(--bg, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      boxSizing: 'border-box'
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Combined List Grid */}
              <div className="table-wrap" style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, overflow: 'hidden', overflowX: 'auto', backgroundColor: 'var(--bg-card, #ffffff)', width: '100%', boxSizing: 'border-box' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 640 }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--card-subtle, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                      <th style={{ width: '32%', padding: '10px 12px', textAlign: 'left', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>TITLE</th>
                      <th style={{ width: '18%', padding: '10px 8px', textAlign: 'left', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>TYPE & SCOPE</th>
                      <th style={{ width: '14%', padding: '10px 8px', textAlign: 'left', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>STATUS / SENDER</th>
                      <th style={{ width: '18%', padding: '10px 8px', textAlign: 'left', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>DATE</th>
                      <th style={{ width: '18%', padding: '10px 12px', textAlign: 'right', fontSize: 11.5, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Sent Items */}
                    {filteredSent.map(x => (
                      <tr key={`sent-${x.id}`} style={{ borderBottom: '1px solid var(--border, #f1f5f9)', backgroundColor: 'rgba(37,99,235,0.015)' }}>
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 4, backgroundColor: '#eff6ff', color: '#1d4ed8' }}>SENT</span>
                            <button
                              type="button"
                              onClick={() => setViewingNotice(x)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: 13,
                                color: 'var(--text, #0f172a)',
                                textAlign: 'left',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {x.title}
                            </button>
                            {x.attachment_url && <Paperclip size={12} color="#2563eb" />}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#1e40af' }}>
                            Students {x.class_number ? `(Class ${x.class_number})` : ''}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>
                              ✓ {x.status || 'Published'}
                            </span>
                            {(x.read_count || 0) > 0 && (
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#047857' }}>
                                ✓ {x.read_count} Read
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'middle', fontSize: 12, color: 'var(--text-secondary, #475569)' }}>
                          {formatPublishDate(x.published_at || x.created_at)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'middle' }}>
                          {x.status === 'DRAFT' ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEditDraft(x)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 4,
                                border: '1px solid var(--border, #cbd5e1)',
                                backgroundColor: 'var(--bg, #ffffff)',
                                color: '#2563eb',
                                fontSize: 11.5,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Edit Draft Announcement"
                            >
                              <Edit3 size={12} /> Edit
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setViewingNotice(x)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 4,
                                border: '1px solid var(--border, #cbd5e1)',
                                backgroundColor: 'var(--bg, #ffffff)',
                                color: '#2563eb',
                                fontSize: 11.5,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="View Sent Announcement"
                            >
                              <Eye size={12} /> Sent
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Received Items */}
                    {filteredReceived.map(x => (
                      <tr key={`recv-${x.id}`} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 4, backgroundColor: '#f0fdf4', color: '#15803d' }}>RECEIVED</span>
                            <button
                              type="button"
                              onClick={() => {
                                setTableFilter('RECEIVE');
                                handleMarkRead(x);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                fontWeight: !x.read_at ? 700 : 500,
                                fontSize: 13,
                                color: 'var(--text, #0f172a)',
                                textAlign: 'left',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {x.title}
                            </button>
                            {!x.read_at && (
                              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#2563eb', flexShrink: 0 }} />
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
                            Faculty & Staff
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary, #475569)' }}>
                            From: {x.author_name || 'Admin'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'middle', fontSize: 12, color: 'var(--text-secondary, #475569)' }}>
                          {formatPublishDate(x.published_at || x.created_at)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setTableFilter('RECEIVE');
                              handleMarkRead(x);
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid var(--border, #cbd5e1)',
                              backgroundColor: 'var(--bg, #ffffff)',
                              color: '#2563eb',
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Open Discussion
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredSent.length === 0 && filteredReceived.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                          No notices recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

      {/* ── Universal Preview Modal for Broadcast ── */}
      <UniversalPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onEdit={() => setPreviewOpen(false)}
        onConfirm={handleConfirmAndPublish}
        onSecondary={handleSaveDraft}
        title="Preview Announcement Broadcast"
        subtitle={`Target: Student Portal ${selectedClass ? `(${selectedClass.label})` : '(All Classes)'}`}
        operationType="create"
        confirmText="Confirm & Publish"
        confirmIcon={<Send size={15} />}
        secondaryText="Save as Draft"
        secondaryIcon={<FileText size={15} />}
        secondaryLoading={draftLoading}
        editText="Back to Edit Draft"
        sections={previewSections}
        loading={previewLoading}
        error={previewError}
      />

      {/* ── Viewing Notice Details Modal (Exact School Admin UI) ── */}
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
                  background: viewingNotice.status === 'PUBLISHED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                  color: viewingNotice.status === 'PUBLISHED' ? '#10b981' : '#2563eb',
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
                      backgroundColor: viewingNotice.status === 'PUBLISHED' ? '#ecfdf5' : '#f8fafc',
                      color: viewingNotice.status === 'PUBLISHED' ? '#047857' : '#64748b',
                      border: viewingNotice.status === 'PUBLISHED' ? '1px solid #a7f3d0' : '1px solid #e2e8f0'
                    }}>
                      {viewingNotice.status === 'PUBLISHED' ? <CheckCircle2 size={12} /> : <FileText size={12} />}
                      {viewingNotice.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'}
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
                  <Clock size={14} style={{ color: viewingNotice.status === 'PUBLISHED' ? '#10b981' : '#64748b' }} />
                  {viewingNotice.status === 'PUBLISHED' ? (
                    <span>
                      Published on <b>{formatPublishDate(viewingNotice.published_at || viewingNotice.created_at)}</b> at <b>{formatPublishTime(viewingNotice.published_at || viewingNotice.created_at)}</b>
                    </span>
                  ) : (
                    <span style={{ fontStyle: 'italic' }}>
                      Draft Notice · Created {formatPublishDate(viewingNotice.created_at)}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ color: 'var(--text-muted, #64748b)' }}>
                    Recipients: <strong style={{ color: 'var(--text, #0f172a)' }}>{viewingNotice.recipient_count || 0}</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted, #64748b)' }}>
                    Read: <strong style={{ color: 'var(--text, #0f172a)' }}>{viewingNotice.read_count || 0}</strong>
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
                  borderLeft: viewingNotice.status === 'PUBLISHED' ? '4px solid #10b981' : '4px solid #2563eb',
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
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border, #e2e8f0)',
              background: 'var(--card-subtle, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}>
              <div>
                {(viewingNotice.reply_count || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const notice = viewingNotice;
                      setViewingNotice(null);
                      setIsNoticeMaximized(false);
                      openNoticeReplies(notice);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid #bfdbfe',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8'
                    }}
                  >
                    <MessageCircle size={14} />
                    <span>View Threaded Replies ({viewingNotice.reply_count})</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {viewingNotice.status !== 'PUBLISHED' && (
                  <button
                    type="button"
                    onClick={() => {
                      const notice = viewingNotice;
                      setViewingNotice(null);
                      setIsNoticeMaximized(false);
                      handleOpenEditDraft(notice);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid var(--border, #cbd5e1)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      color: 'var(--text, #0f172a)'
                    }}
                  >
                    <Edit3 size={14} />
                    <span>Edit Draft</span>
                  </button>
                )}

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
        </div>
      )}

      {/* ── Threaded Replies Drawer for Specific Notice ── */}
      {selectedNoticeForReplies && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1060
        }} onClick={e => {
          if (e.target === e.currentTarget) setSelectedNoticeForReplies(null);
        }}>
          <div style={{
            width: '100%',
            maxWidth: 520,
            height: '100%',
            backgroundColor: 'var(--bg-card, #ffffff)',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--card-subtle, #f8fafc)'
            }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                  {selectedNoticeForReplies.audience_type}
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                  {selectedNoticeForReplies.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNoticeForReplies(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text, #334155)', lineHeight: 1.5, marginBottom: 16, padding: '10px 12px', borderRadius: 6, backgroundColor: 'var(--card-subtle, #f8fafc)' }}>
                {selectedNoticeForReplies.message}
              </div>

              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0f172a)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageCircle size={15} color="#2563eb" /> Threaded Responses ({noticeReplies.length})
              </h4>

              {loadingNoticeReplies ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted, #64748b)' }}>
                  Loading responses...
                </div>
              ) : noticeReplies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted, #64748b)', fontSize: 13 }}>
                  No responses received for this announcement yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {noticeReplies.map(r => (
                    <div key={r.id} style={{ padding: '10px 12px', borderRadius: 6, backgroundColor: 'var(--card-subtle, #f8fafc)', borderLeft: '3px solid #2563eb', fontSize: 12.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text, #0f172a)' }}>{r.author_name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</span>
                      </div>
                      <div style={{ color: 'var(--text, #334155)', whiteSpace: 'pre-wrap' }}>{r.reply_text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--card-subtle, #f8fafc)' }}>
              <button
                type="button"
                onClick={() => setSelectedNoticeForReplies(null)}
                style={{
                  padding: '7px 18px',
                  borderRadius: 6,
                  border: '1px solid var(--border, #cbd5e1)',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  color: 'var(--text, #0f172a)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Draft Announcement Modal ── */}
      {editingDraft && (
        <div
          style={{
            zIndex: 10050,
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={e => {
            if (e.target === e.currentTarget && !editSaving) setEditingDraft(null);
          }}
        >
          <div
            style={{
              width: 'min(640px, 95vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              background: 'var(--card-subtle, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(37, 99, 235, 0.15)',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    Edit Draft Announcement
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                    Update details, scope, or publish directly to students
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDraft(null)}
                disabled={editSaving}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editError && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{editError}</span>
                </div>
              )}

              {/* Title Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                  ANNOUNCEMENT TITLE <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Enter announcement title..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #cbd5e1)',
                    backgroundColor: 'var(--bg, #ffffff)',
                    color: 'var(--text, #0f172a)',
                    fontSize: 13.5,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Message Details Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                  BROADCAST DETAILS & INSTRUCTIONS <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <AutoExpandingTextarea
                  value={editForm.message}
                  onChange={e => setEditForm({ ...editForm, message: e.target.value })}
                  placeholder="Broadcast details, agenda, and instructions..."
                  minHeight={90}
                  maxHeight={280}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #cbd5e1)',
                    backgroundColor: 'var(--bg, #ffffff)',
                    color: 'var(--text, #0f172a)',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Attachment Option in Edit Draft */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                  ATTACHMENT
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      borderRadius: 6,
                      border: '1px dashed var(--border, #cbd5e1)',
                      backgroundColor: 'var(--card-subtle, #f8fafc)',
                      color: 'var(--text, #334155)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Attach a file to this announcement"
                  >
                    <Paperclip size={15} color="#2563eb" />
                    <span>{editAttachment ? 'Change File' : 'Attach File'}</span>
                    <input
                      type="file"
                      onChange={handleEditFileChange}
                      style={{ display: 'none' }}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt,.zip"
                    />
                  </label>

                  {editAttachment && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #bfdbfe',
                      backgroundColor: '#eff6ff',
                      color: '#1e40af',
                      fontSize: 12.5,
                      maxWidth: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <Paperclip size={14} color="#2563eb" />
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                        {editAttachment.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#2563eb', backgroundColor: '#dbeafe', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        {(editAttachment.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveEditAttachment}
                        title="Remove attachment"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#ef4444',
                          padding: 2,
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {editAttachmentError && (
                  <div style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={13} /> {editAttachmentError}
                  </div>
                )}
              </div>

              {/* Targeting Controls in Edit Modal (Audience Type: Student without arrow) */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 0 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>AUDIENCE TYPE</label>
                  <div
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      backgroundColor: 'var(--card-subtle, #f8fafc)',
                      color: 'var(--text, #0f172a)',
                      fontSize: 13,
                      fontWeight: 600,
                      boxSizing: 'border-box'
                    }}
                  >
                    Student
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 0 }}>
                  <label style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    lineHeight: 1,
                    color: editForm.classId ? '#3b82f6' : 'var(--text-muted, #64748b)'
                  }}>
                    <span>CLASS</span>
                  </label>
                  <select
                    value={editForm.classId}
                    onChange={handleEditClassChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      backgroundColor: 'var(--bg, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">All Classes</option>
                    {resolvedClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 130px', minWidth: 0 }}>
                  <label style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    lineHeight: 1,
                    color: editSelectedSectionLetter ? '#3b82f6' : 'var(--text-muted, #64748b)'
                  }}>
                    <span>SECTION</span>
                  </label>
                  <select
                    value={editSelectedSectionLetter}
                    onChange={handleEditSectionChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      backgroundColor: 'var(--bg, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">All Sections</option>
                    {editAvailableSections.map(s => (
                      <option key={s.letter} value={s.letter}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border, #e2e8f0)',
              background: 'var(--card-subtle, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10
            }}>
              <button
                type="button"
                onClick={() => setEditingDraft(null)}
                disabled={editSaving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'transparent',
                  color: 'var(--text, #334155)'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveDraftOnly}
                disabled={editSaving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'var(--bg-card, #ffffff)',
                  color: 'var(--text, #0f172a)'
                }}
              >
                <FileText size={14} />
                <span>{editSaving ? 'Saving...' : 'Save Draft Changes'}</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmAndPublishDraft}
                disabled={editSaving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 18px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  boxShadow: '0 1px 3px rgba(37,99,235,0.25)'
                }}
              >
                <Send size={14} />
                <span>{editSaving ? 'Publishing...' : 'Confirm & Publish Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherAnnouncements;
