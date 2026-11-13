import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import {
  MessageSquare,
  AlertTriangle,
  Send,
  CheckCircle2,
  X,
  Clock,
  MessageCircle,
  Eye,
  Filter,
  Edit3,
  FileText,
  Calendar,
  Paperclip,
  Download,
  Maximize2,
  Minimize2,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { UniversalPreviewModal, DestructiveConfirmModal, PreviewSectionData } from '../../components/preview';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';
import { PersonProfileLink } from '../../components/PersonProfileLink';

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  audience_type: string;
  priority: string;
  status: string;
  class_id?: string;
  section_id?: string;
  class_number?: number;
  section_name?: string;
  recipient_count: number;
  read_count: number;
  reply_count: number;
  created_at?: string;
  published_at?: string;
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

interface ReplyItem {
  id: string;
  announcement_id: string;
  announcement_title?: string;
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
  { classNumber: -1, label: 'Class L KG' },
  { classNumber: 0, label: 'Class U KG' },
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
  if (num === -1) return 'Class L KG';
  if (num === 0) return 'Class U KG';
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

export default function Communication() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [activeTab, setActiveTab] = useState<'announcements' | 'all-replies'>('announcements');
  const [form, setForm] = useState({
    title: '',
    message: '',
    audienceType: 'SCHOOL',
    priority: 'NORMAL',
    classId: '',
    sectionId: ''
  });
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('ALL');
  const [selectedNoticeForReplies, setSelectedNoticeForReplies] = useState<AnnouncementItem | null>(null);
  const [noticeReplies, setNoticeReplies] = useState<ReplyItem[]>([]);
  const [allReplies, setAllReplies] = useState<ReplyItem[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  // Universal Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Confirm publish state
  const [publishTarget, setPublishTarget] = useState<AnnouncementItem | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Edit Draft Announcement Modal State
  const [editingDraft, setEditingDraft] = useState<AnnouncementItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    message: '',
    audienceType: 'SCHOOL',
    priority: 'NORMAL',
    classId: '',
    sectionId: ''
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Click popup modal state for viewing announcement message
  const [viewingNotice, setViewingNotice] = useState<AnnouncementItem | null>(null);
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


  // File Attachment State (New Announcement)
  const [attachment, setAttachment] = useState<AttachedFile | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // File Attachment State (Edit Draft Announcement)
  const [editAttachment, setEditAttachment] = useState<AttachedFile | null>(null);
  const [editAttachmentError, setEditAttachmentError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError(`File "${file.name}" exceeds the 10MB limit.`);
      e.target.value = '';
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
    reader.onerror = () => {
      setAttachmentError(`Failed to read file "${file.name}".`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setAttachmentError(null);
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setEditAttachmentError(`File "${file.name}" exceeds the 10MB limit.`);
      e.target.value = '';
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
    reader.onerror = () => {
      setEditAttachmentError(`Failed to read file "${file.name}".`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveEditAttachment = () => {
    setEditAttachment(null);
    setEditAttachmentError(null);
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
      if (s) secName = s.name || s.section_name || '';
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
    return item.audience_type;
  }

  async function load() {
    try {
      const res = await api.get('/communication/announcements');
      setItems(res.data || []);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Unable to load announcements');
    }
  }

  async function loadAllReplies() {
    try {
      const res = await api.get('/communication/replies');
      setAllReplies(res.data || []);
    } catch (_e) {}
  }

  useEffect(() => {
    load();
    loadAllReplies();
    api.get('/classes').then(r => setClasses(r.data || [])).catch(() => {});
    api.get('/sections').then(r => setSections(r.data || [])).catch(() => {});
  }, []);

  // Map standard grade list L-KG → Class 12 to live DB class records
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

  // All unique section letters/names available for the chosen class (or school-wide if no class selected)
  const availableSections = useMemo(() => {
    const list = selectedClass ? classSections : sections;
    const seen = new Set<string>();
    const result: { letter: string; name: string; id?: string }[] = [];
    
    list.forEach(s => {
      const name = String(s.name || s.section_name || '').trim();
      const letter = name.toUpperCase();
      if (letter && !seen.has(letter)) {
        seen.add(letter);
        result.push({ letter, name: `Section ${letter}`, id: s.id });
      }
    });

    if (result.length === 0) {
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
        result.push({ letter, name: `Section ${letter}` });
      });
    }

    result.sort((a, b) => a.letter.localeCompare(b.letter));
    return result;
  }, [selectedClass, classSections, sections]);

  // Determine currently selected section letter
  const selectedSectionLetter = useMemo(() => {
    if (!form.sectionId) return '';
    const found = classSections.find(s => s.id === form.sectionId) || sections.find(s => s.id === form.sectionId);
    if (found) return String(found.name || found.section_name || '').toUpperCase();
    const m = String(form.sectionId).match(/sec-([a-z0-9]+)/i);
    if (m) return m[1].toUpperCase();
    return String(form.sectionId).toUpperCase();
  }, [form.sectionId, classSections, sections]);

  // Change Handlers with synchronized targeting logic
  function handleAudienceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === 'SCHOOL' || val === 'TEACHER' || val === 'STUDENT') {
      setForm(prev => ({ ...prev, audienceType: val, classId: '', sectionId: '' }));
    } else if (val === 'CLASS') {
      setForm(prev => ({ ...prev, audienceType: 'CLASS' }));
    }
  }

  function handleClassChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const chosenClassId = e.target.value;
    if (!chosenClassId) {
      setForm(prev => ({
        ...prev,
        classId: '',
        sectionId: '',
        audienceType: (prev.audienceType === 'CLASS' || prev.audienceType === 'SECTION') ? 'SCHOOL' : prev.audienceType
      }));
      return;
    }

    const targetClass = resolvedClasses.find(c => c.id === chosenClassId);
    const newClassSections = sections.filter(s => {
      if (s.class_id && s.class_id === chosenClassId) return true;
      if (s.classId && s.classId === chosenClassId) return true;
      if (targetClass && s.class_number !== undefined && Number(s.class_number) === targetClass.classNumber) return true;
      return false;
    });

    let newSectionId = '';
    if (selectedSectionLetter) {
      const match = newClassSections.find(s => String(s.name || s.section_name || '').toUpperCase() === selectedSectionLetter);
      newSectionId = match?.id || (chosenClassId ? `${chosenClassId}-sec-${selectedSectionLetter.toLowerCase()}` : `sec-${selectedSectionLetter.toLowerCase()}`);
    }

    setForm(prev => ({
      ...prev,
      classId: chosenClassId,
      sectionId: newSectionId,
      audienceType: prev.audienceType === 'CLASS' ? 'CLASS' : (prev.audienceType || 'CLASS')
    }));
  }

  function handleSectionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const letter = e.target.value.toUpperCase();
    if (!letter) {
      setForm(prev => ({
        ...prev,
        sectionId: ''
      }));
      return;
    }

    const target = classSections.find(s => String(s.name || s.section_name || '').toUpperCase() === letter)
      || sections.find(s => String(s.name || s.section_name || '').toUpperCase() === letter);

    const targetSecId = target?.id || (selectedClass ? `${selectedClass.id}-sec-${letter.toLowerCase()}` : `sec-${letter.toLowerCase()}`);

    setForm(prev => ({
      ...prev,
      sectionId: targetSecId
    }));
  }

  // ─── Edit Draft Synchronized Targeting Logic ───
  const editSelectedClass = useMemo(() => {
    return resolvedClasses.find(c => c.id === editForm.classId);
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

  // All unique section letters/names available for editForm
  const editAvailableSections = useMemo(() => {
    const list = editSelectedClass ? editClassSections : sections;
    const seen = new Set<string>();
    const result: { letter: string; name: string; id?: string }[] = [];
    
    list.forEach(s => {
      const name = String(s.name || s.section_name || '').trim();
      const letter = name.toUpperCase();
      if (letter && !seen.has(letter)) {
        seen.add(letter);
        result.push({ letter, name: `Section ${letter}`, id: s.id });
      }
    });

    if (result.length === 0) {
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
        result.push({ letter, name: `Section ${letter}` });
      });
    }

    result.sort((a, b) => a.letter.localeCompare(b.letter));
    return result;
  }, [editSelectedClass, editClassSections, sections]);

  const editSelectedSectionLetter = useMemo(() => {
    if (!editForm.sectionId) return '';
    const found = editClassSections.find(s => s.id === editForm.sectionId) || sections.find(s => s.id === editForm.sectionId);
    if (found) return String(found.name || found.section_name || '').toUpperCase();
    const m = String(editForm.sectionId).match(/sec-([a-z0-9]+)/i);
    if (m) return m[1].toUpperCase();
    return String(editForm.sectionId).toUpperCase();
  }, [editForm.sectionId, editClassSections, sections]);

  function handleOpenEditDraft(item: AnnouncementItem) {
    setEditingDraft(item);
    setEditError(null);

    let matchedClassId = item.class_id || '';
    if (!matchedClassId && item.class_number !== undefined) {
      const c = resolvedClasses.find(rc => rc.classNumber === Number(item.class_number));
      if (c) matchedClassId = c.id;
    }

    let matchedSectionId = item.section_id || '';
    if (!matchedSectionId && item.section_name) {
      const sLetter = String(item.section_name).toUpperCase().trim();
      matchedSectionId = `sec-${sLetter.toLowerCase()}`;
    }

    setEditForm({
      title: item.title || '',
      message: item.message || '',
      audienceType: item.audience_type || 'SCHOOL',
      priority: item.priority || 'NORMAL',
      classId: matchedClassId,
      sectionId: matchedSectionId
    });

    if (item.attachment_url) {
      setEditAttachment({
        name: item.attachment_name || 'Attachment',
        size: item.attachment_size || 0,
        type: item.attachment_type || '',
        data: item.attachment_url
      });
    } else {
      setEditAttachment(null);
    }
    setEditAttachmentError(null);
  }

  function handleEditAudienceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === 'SCHOOL' || val === 'TEACHER' || val === 'STUDENT') {
      setEditForm(prev => ({ ...prev, audienceType: val, classId: '', sectionId: '' }));
    } else if (val === 'CLASS') {
      setEditForm(prev => ({ ...prev, audienceType: 'CLASS' }));
    }
  }

  function handleEditClassChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const chosenClassId = e.target.value;
    if (!chosenClassId) {
      setEditForm(prev => ({
        ...prev,
        classId: '',
        sectionId: '',
        audienceType: (prev.audienceType === 'CLASS' || prev.audienceType === 'SECTION') ? 'SCHOOL' : prev.audienceType
      }));
      return;
    }

    const targetClass = resolvedClasses.find(c => c.id === chosenClassId);
    const newClassSections = sections.filter(s => {
      if (s.class_id && s.class_id === chosenClassId) return true;
      if (s.classId && s.classId === chosenClassId) return true;
      if (targetClass && s.class_number !== undefined && Number(s.class_number) === targetClass.classNumber) return true;
      return false;
    });

    let newSectionId = '';
    if (editSelectedSectionLetter) {
      const match = newClassSections.find(s => String(s.name || s.section_name || '').toUpperCase() === editSelectedSectionLetter);
      newSectionId = match?.id || (chosenClassId ? `${chosenClassId}-sec-${editSelectedSectionLetter.toLowerCase()}` : `sec-${editSelectedSectionLetter.toLowerCase()}`);
    }

    setEditForm(prev => ({
      ...prev,
      classId: chosenClassId,
      sectionId: newSectionId,
      audienceType: prev.audienceType === 'CLASS' ? 'CLASS' : (prev.audienceType || 'CLASS')
    }));
  }

  function handleEditSectionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const letter = e.target.value.toUpperCase();
    if (!letter) {
      setEditForm(prev => ({
        ...prev,
        sectionId: ''
      }));
      return;
    }

    const target = editClassSections.find(s => String(s.name || s.section_name || '').toUpperCase() === letter)
      || sections.find(s => String(s.name || s.section_name || '').toUpperCase() === letter);

    const targetSecId = target?.id || (editSelectedClass ? `${editSelectedClass.id}-sec-${letter.toLowerCase()}` : `sec-${letter.toLowerCase()}`);

    setEditForm(prev => ({
      ...prev,
      sectionId: targetSecId
    }));
  }

  async function handleSaveDraftOnly() {
    if (!editingDraft) return;
    if (!editForm.title.trim()) {
      setEditError('Announcement title is required.');
      return;
    }
    if (!editForm.message.trim()) {
      setEditError('Message content is required.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await api.put(`/communication/announcements/${editingDraft.id}`, {
        ...editForm,
        attachment_url: editAttachment ? editAttachment.data : null,
        attachment_name: editAttachment ? editAttachment.name : null,
        attachment_type: editAttachment ? editAttachment.type : null,
        attachment_size: editAttachment ? editAttachment.size : null
      });
      setMsg(`Draft announcement "${editForm.title}" saved successfully.`);
      setEditingDraft(null);
      load();
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
      setEditError('Message content is required.');
      return;
    }
    if (editForm.audienceType === 'CLASS' && !editForm.classId) {
      setEditError('Please select a target class (L-KG to Class 12).');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      // 1. Update draft content first
      const finalAudienceType = (editForm.audienceType === 'CLASS' && editForm.sectionId) ? 'SECTION' : editForm.audienceType;
      await api.put(`/communication/announcements/${editingDraft.id}`, {
        ...editForm,
        audienceType: finalAudienceType,
        attachment_url: editAttachment ? editAttachment.data : null,
        attachment_name: editAttachment ? editAttachment.name : null,
        attachment_type: editAttachment ? editAttachment.type : null,
        attachment_size: editAttachment ? editAttachment.size : null
      });
      // 2. Publish announcement to recipients
      await api.post(`/communication/announcements/${editingDraft.id}/publish`);
      setMsg(`Announcement "${editForm.title}" confirmed and published successfully!`);
      // Notify Teacher portal and topbar bell immediately
      window.dispatchEvent(new CustomEvent('reviews-updated'));
      window.dispatchEvent(new CustomEvent('announcements-updated'));
      try {
        localStorage.setItem('announcements_last_updated', Date.now().toString());
        localStorage.setItem('reviews_last_updated', Date.now().toString());
      } catch {}
      setEditingDraft(null);
      load();
    } catch (e: any) {
      setEditError(e?.response?.data?.message || 'Unable to publish announcement.');
    } finally {
      setEditSaving(false);
    }
  }

  // Stage 1 Validation & Preview Trigger
  function handleInitiateCreate() {
    if (!form.title.trim()) {
      alert('Announcement title is required.');
      return;
    }
    if (!form.message.trim()) {
      alert('Message content is required.');
      return;
    }
    if (form.audienceType === 'CLASS' && !form.classId) {
      alert('Please select a target class (L-KG to Class 12).');
      return;
    }
    setPreviewError(null);
    setPreviewOpen(true);
  }

  // Save Announcement as Draft Execution
  async function handleSaveDraft() {
    if (!form.title.trim() || !form.message.trim()) {
      setPreviewError('Title and message cannot be empty.');
      return;
    }

    setDraftLoading(true);
    setPreviewError(null);
    try {
      const finalAudienceType = (form.audienceType === 'CLASS' && form.sectionId) ? 'SECTION' : form.audienceType;
      await api.post('/communication/announcements', {
        ...form,
        audienceType: finalAudienceType,
        publish: false,
        status: 'DRAFT',
        attachment_url: attachment ? attachment.data : undefined,
        attachment_name: attachment ? attachment.name : undefined,
        attachment_type: attachment ? attachment.type : undefined,
        attachment_size: attachment ? attachment.size : undefined
      });
      setMsg('Announcement saved as draft successfully!');
      setForm({
        title: '',
        message: '',
        audienceType: 'SCHOOL',
        priority: 'NORMAL',
        classId: '',
        sectionId: ''
      });
      setAttachment(null);
      setAttachmentError(null);
      setPreviewOpen(false);
      load();
    } catch (e: any) {
      console.error('[Communication] Error saving draft announcement:', e);
      setPreviewError(e?.response?.data?.message || e?.message || 'Unable to save draft announcement. Please check server connection.');
    } finally {
      setDraftLoading(false);
    }
  }

  // Confirm & Publish Announcement Execution directly from Preview Modal
  async function handleConfirmAndPublish() {
    if (!form.title.trim() || !form.message.trim()) {
      setPreviewError('Title and message cannot be empty.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const finalAudienceType = (form.audienceType === 'CLASS' && form.sectionId) ? 'SECTION' : form.audienceType;
      const res = await api.post('/communication/announcements', {
        ...form,
        audienceType: finalAudienceType,
        publish: true,
        status: 'PUBLISHED',
        attachment_url: attachment ? attachment.data : undefined,
        attachment_name: attachment ? attachment.name : undefined,
        attachment_type: attachment ? attachment.type : undefined,
        attachment_size: attachment ? attachment.size : undefined
      });
      const created = res.data;

      // If backend did not auto-publish, trigger secondary publish
      if (created && created.id && created.status !== 'PUBLISHED') {
        try {
          await api.post(`/communication/announcements/${created.id}/publish`);
        } catch (_pubErr) {
          console.warn('[Communication] Secondary publish call notice');
        }
      }

      setMsg('Announcement confirmed and published successfully!');
      // Notify Teacher portal and topbar bell immediately
      window.dispatchEvent(new CustomEvent('reviews-updated'));
      window.dispatchEvent(new CustomEvent('announcements-updated'));
      try {
        localStorage.setItem('announcements_last_updated', Date.now().toString());
        localStorage.setItem('reviews_last_updated', Date.now().toString());
      } catch {}
      setForm({
        title: '',
        message: '',
        audienceType: 'SCHOOL',
        priority: 'NORMAL',
        classId: '',
        sectionId: ''
      });
      setAttachment(null);
      setAttachmentError(null);
      setPreviewOpen(false);
      load();
    } catch (e: any) {
      console.error('[Communication] Error publishing announcement:', e);
      setPreviewError(e?.response?.data?.message || e?.message || 'Unable to publish announcement. Please check server connection.');
    } finally {
      setPreviewLoading(false);
    }
  }

  // Publish Announcement Execution via Confirm Modal
  async function handleConfirmPublish() {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      await api.post(`/communication/announcements/${publishTarget.id}/publish`);
      setMsg(`Announcement "${publishTarget.title}" published and delivered to recipients!`);
      // Notify Teacher portal and topbar bell immediately
      window.dispatchEvent(new CustomEvent('reviews-updated'));
      window.dispatchEvent(new CustomEvent('announcements-updated'));
      try {
        localStorage.setItem('announcements_last_updated', Date.now().toString());
        localStorage.setItem('reviews_last_updated', Date.now().toString());
      } catch {}
      setPublishTarget(null);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Unable to publish announcement');
    } finally {
      setPublishing(false);
    }
  }

  async function openNoticeReplies(notice: AnnouncementItem) {
    setSelectedNoticeForReplies(notice);
    setLoadingReplies(true);
    try {
      const res = await api.get(`/communication/announcements/${notice.id}/replies`);
      setNoticeReplies(res.data || []);
    } catch (_e) {
      setNoticeReplies([]);
    } finally {
      setLoadingReplies(false);
    }
  }

  const selectedClassName = selectedClass?.label || 'Not Selected';
  const selectedSectionDisplay = selectedSectionLetter ? `Section ${selectedSectionLetter}` : 'All Sections';

  const previewSections: PreviewSectionData[] = [
    {
      title: 'Broadcast Scope & Delivery Target',
      fields: [
        { label: 'Audience Target', value: form.audienceType, type: 'badge', color: 'blue' },
        ...(form.audienceType === 'CLASS'
          ? [
              { label: 'Target Class', value: selectedClassName },
              {
                label: 'Delivery Scope',
                value: selectedSectionLetter
                  ? `Delivered to Class ${selectedClass?.label || 'Class'} · Section ${selectedSectionLetter} only (students & parents)`
                  : `Delivered to all students & parents of ${selectedClassName} (All Sections)`
              }
            ]
          : form.audienceType === 'TEACHER'
          ? [{ label: 'Delivery Scope', value: 'Delivered to all teachers and faculty' }]
          : form.audienceType === 'STUDENT'
          ? [{ label: 'Delivery Scope', value: 'Delivered to all students portal accounts' }]
          : [{ label: 'Delivery Scope', value: 'Delivered school-wide to students, parents, and teachers' }]),
        {
          label: 'Priority Level',
          value: form.priority,
          type: 'badge',
          color: form.priority === 'EMERGENCY' ? 'red' : form.priority === 'HIGH' ? 'amber' : 'slate'
        },
      ]
    },
    {
      title: 'Announcement Content',
      fields: [
        { label: 'Title', value: form.title },
        { label: 'Message Body', value: form.message },
        ...(attachment
          ? [
              {
                label: 'Attached Document',
                value: `${attachment.name} (${(attachment.size / 1024).toFixed(1)} KB)`
              }
            ]
          : [])
      ]
    }
  ];

  return (
    <div className="as-communication-page w-full max-w-full m-0 box-border" style={{ width: '100%', maxWidth: '100%', margin: 0, padding: '24px 24px 40px', boxSizing: 'border-box' }}>
      <Link
        to="/dashboard"
        style={{ background: 'transparent', border: 'none', padding: 0, color: '#e11d48', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}
      >
        <ArrowLeft size={16} /> <span>Dashboard</span>
      </Link>
      <div className="as-communication-header-row flex flex-wrap items-center justify-between gap-3 mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text, var(--foreground))" }}>Announcement</h1>
          <p className="muted text-xs md:text-sm text-slate-500 m-0 mt-1" style={{ margin: '4px 0 0', fontSize: 13, color: "var(--text-muted, var(--muted-foreground))" }}>
            Multi-channel institutional announcements and role-based audience broadcasts.
          </p>
        </div>
      </div>

      {msg && (
        <div className="p-2.5 px-3.5 mb-4 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs md:text-sm flex justify-between items-center w-full box-border" style={{
          padding: '10px 14px',
          marginBottom: 16,
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: "var(--primary)",
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxSizing: 'border-box',
          width: '100%'
        }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="bg-transparent border-0 cursor-pointer text-blue-800 font-bold" style={{ background: 'none', border: 'none', cursor: 'pointer', color: "var(--primary)" }}>✕</button>
        </div>
      )}

        <>
          {/* New Announcement Form */}
          <div className="form-card as-announcement-card rounded-lg border border-slate-200 bg-white p-5 mb-6 shadow-sm w-full max-w-full box-border" style={{
            backgroundColor: "var(--bg-card, var(--card))",
            border: "1px solid var(--border, var(--border))",
            borderRadius: 4,
            padding: 20,
            marginBottom: 24,
            boxShadow: 'none',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box'
          }}>
            <h3 className="text-base font-bold text-slate-900 m-0 mb-3.5 flex items-center gap-2" style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: "var(--text, var(--foreground))", display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={18} color="#e11d55" /> New Broadcast Announcement
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
                  borderRadius: 4,
                  border: "1px solid var(--border, var(--border))",
                  backgroundColor: "var(--bg, var(--card))",
                  color: "var(--text, var(--foreground))",
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
                  borderRadius: 4,
                  border: "1px solid var(--border, var(--border))",
                  backgroundColor: "var(--bg, var(--card))",
                  color: "var(--text, var(--foreground))",
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
                      borderRadius: 4,
                      border: "1px dashed var(--border, var(--border))",
                      backgroundColor: "var(--card-subtle, var(--card))",
                      color: "var(--text, var(--muted-foreground))",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Attach a file to this announcement"
                  >
                    <Paperclip size={15} color="#e11d55" />
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
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      color: "var(--primary)",
                      fontSize: 12.5,
                      maxWidth: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <Paperclip size={14} color="#e11d55" />
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                        {attachment.name}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--primary)", backgroundColor: "var(--card)", padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
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
                          color: "var(--destructive)",
                          padding: 2,
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted, var(--muted-foreground))" }}>
                      Supports PDF, Word, Excel, images, or documents (max 10MB)
                    </span>
                  )}
                </div>

                {attachmentError && (
                  <div style={{ fontSize: 12, color: "var(--destructive)", display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={13} /> {attachmentError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                {/* Extended Audience Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 0, maxWidth: '100%' }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>AUDIENCE TYPE</label>
                  <select
                    value={form.audienceType}
                    onChange={handleAudienceChange}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      backgroundColor: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="SCHOOL">SCHOOL (All)</option>
                    <option value="CLASS">CLASS (Specific Class)</option>
                    <option value="TEACHER">TEACHER (Faculty only)</option>
                    <option value="STUDENT">STUDENT (Student portal)</option>
                  </select>
                </div>

                {/* Class selector: L-KG to Class 12 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 0, maxWidth: '100%' }}>
                  <label style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    lineHeight: 1,
                    color: (form.audienceType === 'CLASS' || form.audienceType === 'SECTION') ? "var(--primary)" : "var(--text-muted, var(--muted-foreground))"
                  }}>
                    <span>CLASS</span>
                    {(form.audienceType === 'CLASS' || form.audienceType === 'SECTION') && <span style={{ color: "var(--destructive)", fontWeight: 700 }}>*</span>}
                  </label>
                  <select
                    value={form.classId}
                    onChange={handleClassChange}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: (form.audienceType === 'CLASS' || form.audienceType === 'SECTION') && !form.classId ? "1px solid var(--border)" : "1px solid var(--border, var(--border))",
                      fontSize: 13,
                      boxSizing: 'border-box',
                      backgroundColor: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))"
                    }}
                  >
                    <option value="">{form.audienceType === 'CLASS' || form.audienceType === 'SECTION' ? 'Select Class (L-KG to 12)' : 'All Classes'}</option>
                    {resolvedClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Section selector: Section A or B */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 130px', minWidth: 0, maxWidth: '100%' }}>
                  <label style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    lineHeight: 1,
                    color: form.audienceType === 'SECTION' ? "var(--primary)" : "var(--text-muted, var(--muted-foreground))"
                  }}>
                    <span>SECTION</span>
                    {form.audienceType === 'SECTION' && <span style={{ color: "var(--destructive)", fontWeight: 700 }}>*</span>}
                  </label>
                  <select
                    value={selectedSectionLetter}
                    onChange={handleSectionChange}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      fontSize: 13,
                      boxSizing: 'border-box',
                      backgroundColor: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))"
                    }}
                  >
                    <option value="">All Sections</option>
                    {availableSections.map(s => (
                      <option key={s.letter} value={s.letter}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Priority Selector with Emergency Multi-channel Callout */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 130px', minWidth: 0, maxWidth: '100%' }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>PRIORITY</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: form.priority === 'EMERGENCY' ? "1px solid var(--border)" : "1px solid var(--border, var(--border))",
                      fontSize: 13,
                      boxSizing: 'border-box',
                      backgroundColor: form.priority === 'EMERGENCY' ? "var(--secondary)" : "var(--bg, var(--card))",
                      color: form.priority === 'EMERGENCY' ? "var(--destructive)" : "var(--text, var(--foreground))",
                      fontWeight: form.priority === 'EMERGENCY' ? 700 : 500
                    }}
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="EMERGENCY">EMERGENCY (Auto-Email Broadcast)</option>
                  </select>
                </div>

                <div className="announcement-btn-wrap" style={{ alignSelf: 'flex-end', marginLeft: 'auto', flex: '1 1 auto', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleInitiateCreate}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: "var(--primary)",
                      color: "var(--background)",
                      padding: '9px 18px',
                      borderRadius: 4,
                      border: 'none',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      maxWidth: '100%'
                    }}
                  >
                    <Eye size={15} /> Preview & Save Announcement
                  </button>
                </div>
              </div>

              {/* Informative Real-time Target Audience Indicator */}
              <div style={{
                padding: '10px 14px',
                borderRadius: 4,
                backgroundColor: form.audienceType === 'SECTION' ? "var(--secondary)" : form.audienceType === 'CLASS' ? "var(--accent)" : "var(--card-subtle, var(--card))",
                border: form.audienceType === 'SECTION' ? "1px solid var(--border)" : form.audienceType === 'CLASS' ? "1px solid var(--border)" : "1px solid var(--border, var(--border))",
                color: form.audienceType === 'SECTION' ? "var(--info)" : form.audienceType === 'CLASS' ? "var(--primary)" : "var(--text, var(--muted-foreground))",
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
                {form.audienceType === 'CLASS' && selectedClass ? (
                  selectedSectionLetter ? (
                    <span>
                      <b>{selectedClass.label} · Section ${selectedSectionLetter}</b> — Broadcast will go <b>ONLY to {selectedClass.label}-{selectedSectionLetter}</b> (students and linked parents).
                    </span>
                  ) : (
                    <span>
                      <b>{selectedClass.label} (All Sections)</b> — Broadcast will go to all students and parents in {selectedClass.label}.
                    </span>
                  )
                ) : form.audienceType === 'CLASS' ? (
                  <span style={{ color: "var(--warning)" }}>
                    Please select a target <b>Class (L-KG to Class 12)</b>.
                  </span>
                ) : form.audienceType === 'TEACHER' ? (
                  <span><b>Faculty Only</b> — Visible exclusively to verified teachers.</span>
                ) : form.audienceType === 'STUDENT' ? (
                  <span><b>Student Portal</b> — Broadcast to all registered students across all classes.</span>
                ) : (
                  <span><b>Entire School (All)</b> — Broadcast to all students, parents, and faculty school-wide.</span>
                )}
              </div>

              {form.priority === 'EMERGENCY' && (
                <div style={{ fontSize: 12, color: "var(--destructive)", display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <AlertTriangle size={14} /> Emergency announcements automatically dispatch priority emails to all target audience accounts upon publication.
                </div>
              )}
            </div>
          </div>

          {/* Announcements Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
              Published & Draft Notices ({items.length})
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: "var(--text-muted, var(--muted-foreground))", display: 'flex', alignItems: 'center', gap: 4 }}>
                <Filter size={13} /> Filter:
              </span>
              {(['ALL', 'SCHOOL', 'TEACHER', 'STUDENT'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTableFilter(f)}
                  className={`announcement-filter-btn ${tableFilter === f ? 'active' : ''}`}
                >
                  <span>{f === 'ALL' ? 'All' : f}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Announcements Table */}
          <div className="table-wrap" style={{ border: "1px solid var(--border, var(--border))", borderRadius: 4, overflow: 'hidden', overflowX: 'hidden', backgroundColor: "var(--bg-card, var(--card))", width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 0 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--table-header, var(--card-subtle))', borderBottom: "1px solid var(--border, var(--border))" }}>
                  <th style={{ width: '25%', padding: '10px 12px', textAlign: 'left', fontSize: 11.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 600, boxSizing: 'border-box' }}>TITLE</th>
                  <th style={{ width: '12%', padding: '10px 8px', textAlign: 'left', fontSize: 11.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 600, boxSizing: 'border-box' }}>AUDIENCE</th>
                  <th style={{ width: '9%', padding: '10px 8px', textAlign: 'left', fontSize: 11.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 600, boxSizing: 'border-box' }}>PRIORITY</th>
                  <th style={{ width: '9%', padding: '10px 8px', textAlign: 'left', fontSize: 11.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 600, boxSizing: 'border-box' }}>STATUS</th>
                  <th style={{ width: '14%', padding: '10px 8px', textAlign: 'left', fontSize: 11.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 600, boxSizing: 'border-box' }}>PUBLISHED AT</th>
                  <th style={{ width: '7%', padding: '10px 4px', textAlign: 'center', fontSize: 11.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 600, boxSizing: 'border-box' }}>RECIPIENTS</th>
                  <th style={{ width: '6%', padding: '10px 4px', textAlign: 'center', fontSize: 11.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 600, boxSizing: 'border-box' }}>READ</th>
                  <th style={{ width: '9%', padding: '10px 4px', textAlign: 'center', fontSize: 11.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 600, boxSizing: 'border-box' }}>REPLIES</th>
                  <th style={{ width: '9%', padding: '10px 12px', textAlign: 'right', fontSize: 11.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 600, boxSizing: 'border-box' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter(x => {
                    if (tableFilter === 'ALL') return true;
                    return x.audience_type === tableFilter;
                  })
                  .map(x => {
                    // Resolve class and section names for audience badge
                    let clsLabel = '';
                    if (x.class_number !== undefined && x.class_number !== null) {
                      clsLabel = formatClassGrade(x.class_number);
                    } else if (x.class_id) {
                      const c = resolvedClasses.find(rc => rc.id === x.class_id);
                      if (c) clsLabel = c.label;
                    }

                    let secName = x.section_name || '';
                    if (!secName && x.section_id) {
                      const s = sections.find(rs => rs.id === x.section_id);
                      if (s) secName = s.name || s.section_name || '';
                    }

                    let audienceBadgeText = x.audience_type;
                    if (x.audience_type === 'SECTION') {
                      audienceBadgeText = `${clsLabel || 'Class'} · Sec ${secName || 'A'}`;
                    } else if (x.audience_type === 'CLASS') {
                      audienceBadgeText = `${clsLabel || 'Class'}`;
                    }

                    return (
                      <tr key={x.id} style={{ borderBottom: "1px solid var(--border, var(--border))" }}>
                        <td
                          style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6, maxWidth: '100%' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setViewingNotice(x);
                                setIsNoticeMaximized(false);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                textAlign: 'left',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                gap: 6,
                                cursor: 'pointer',
                                maxWidth: '100%',
                                color: 'inherit',
                                minWidth: 0,
                                flex: '0 1 auto',
                                boxShadow: 'none'
                              }}
                              title="Click to view announcement message"
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: 13,
                                  color: "var(--text, var(--foreground))",
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textAlign: 'left'
                                }}
                              >
                                {x.title}
                              </span>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  color: "var(--primary)",
                                  opacity: 0.85,
                                  flexShrink: 0
                                }}
                                title="Click to view message"
                              >
                                <Eye size={12} />
                              </span>
                            </button>

                            {x.attachment_url && (
                              <span
                                title={`Attachment: ${x.attachment_name || 'File attached'}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  backgroundColor: "var(--accent)",
                                  color: "var(--primary)",
                                  fontWeight: 500,
                                  flexShrink: 0
                                }}
                              >
                                <Paperclip size={11} />
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <span style={{
                            display: 'inline-block',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor:
                              x.audience_type === 'TEACHER' ? "var(--secondary)" :
                              x.audience_type === 'STUDENT' ? "var(--card)" :
                              x.audience_type === 'PARENTS' ? "var(--secondary)" :
                              x.audience_type === 'SECTION' ? "var(--card)" :
                              x.audience_type === 'CLASS' ? "var(--card)" : "var(--card-subtle, var(--secondary))",
                            color:
                              x.audience_type === 'TEACHER' ? "var(--success)" :
                              x.audience_type === 'STUDENT' ? "var(--primary)" :
                              x.audience_type === 'PARENTS' ? "var(--warning)" :
                              x.audience_type === 'SECTION' ? "var(--info)" :
                              x.audience_type === 'CLASS' ? "var(--info)" : "var(--text-secondary, var(--muted-foreground))",
                            border: x.audience_type === 'SECTION' ? "1px solid var(--border)" : x.audience_type === 'CLASS' ? "1px solid var(--border)" : 'none'
                          }} title={audienceBadgeText}>
                            {audienceBadgeText}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: x.priority === 'EMERGENCY' ? "var(--secondary)" : x.priority === 'HIGH' ? "var(--secondary)" : "var(--card-subtle, var(--secondary))",
                            color: x.priority === 'EMERGENCY' ? "var(--destructive)" : x.priority === 'HIGH' ? "var(--warning)" : "var(--text-secondary, var(--muted-foreground))"
                          }}>
                            {x.priority === 'EMERGENCY' && <AlertTriangle size={11} />}
                            {x.priority}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: x.status === 'PUBLISHED' ? "var(--secondary)" : "var(--card-subtle, var(--card))",
                            color: x.status === 'PUBLISHED' ? "var(--success)" : "var(--text-muted, var(--muted-foreground))"
                          }}>
                            {x.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {(() => {
                            const isPub = x.status === 'PUBLISHED';
                            const pubStamp = x.published_at || (isPub ? x.created_at : null);
                            if (isPub && pubStamp) {
                              return (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text, var(--foreground))", display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={11} style={{ color: "var(--success)" }} />
                                    {formatPublishDate(pubStamp)}
                                  </span>
                                  <span style={{ fontSize: 11, color: "var(--text-muted, var(--muted-foreground))", paddingLeft: 15 }}>
                                    {formatPublishTime(pubStamp)}
                                  </span>
                                </div>
                              );
                            }
                            return (
                              <span style={{ fontSize: 11.5, color: "var(--text-muted, var(--muted-foreground))", fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} style={{ opacity: 0.4 }} /> —
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'middle', fontSize: 12.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 500 }}>
                          {x.recipient_count || 0}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'middle', fontSize: 12.5, color: "var(--text-secondary, var(--muted-foreground))", fontWeight: 500 }}>
                          {x.read_count || 0}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            onClick={() => openNoticeReplies(x)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              backgroundColor: "var(--card-subtle, var(--card))",
                              border: "1px solid var(--border, var(--border))",
                              padding: '3px 7px',
                              borderRadius: 4,
                              fontSize: 11,
                              color: "var(--primary)",
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="View threaded parent & student replies"
                          >
                            <MessageCircle size={11} /> {x.reply_count || 0} Replies
                          </button>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {x.status !== 'PUBLISHED' ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditDraft(x)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '4px 8px',
                                  backgroundColor: "var(--primary)",
                                  color: "var(--background)",
                                  borderRadius: 4,
                                  border: 'none',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                title="Edit this draft announcement"
                              >
                                <Edit3 size={11} /> Edit
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setViewingNotice(x)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                fontSize: 11.5,
                                color: "var(--success)",
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="Click to view published message"
                            >
                              <CheckCircle2 size={13} /> Sent
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {!items.length && (
                  <tr>
                    <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: "var(--muted-foreground)" }}>
                      No announcements published yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Dedicated Popup Modal for Announcement Message & Broadcast Details */}
          {viewingNotice && (
            <div
              className="overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setViewingNotice(null);
                  setIsNoticeMaximized(false);
                }
              }}
              style={{
                zIndex: 10050,
                position: 'fixed',
                inset: 0,
                background: "var(--card)",
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isNoticeMaximized ? 8 : 16
              }}
            >
              <div
                className="modal"
                style={{
                  width: isNoticeMaximized ? 'min(1280px, 98vw)' : 'min(640px, 95vw)',
                  height: isNoticeMaximized ? '94vh' : 'auto',
                  maxHeight: '94vh',
                  background: "var(--bg-card, var(--card))",
                  border: "1px solid var(--border, var(--border))",
                  borderRadius: isNoticeMaximized ? 12 : 16,
                  boxShadow: 'none',
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
                  borderBottom: "1px solid var(--border, var(--border))",
                  background: "var(--card-subtle, var(--card))",
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: 4,
                      background: viewingNotice.status === 'PUBLISHED' ? "var(--secondary)" : "var(--accent)",
                      color: viewingNotice.status === 'PUBLISHED' ? "var(--success)" : "var(--primary)",
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
                          backgroundColor: viewingNotice.status === 'PUBLISHED' ? "var(--secondary)" : "var(--card)",
                          color: viewingNotice.status === 'PUBLISHED' ? "var(--success)" : "var(--muted-foreground)",
                          border: viewingNotice.status === 'PUBLISHED' ? "1px solid var(--border)" : "1px solid var(--border)"
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
                          backgroundColor: viewingNotice.priority === 'EMERGENCY' ? "var(--secondary)" : viewingNotice.priority === 'HIGH' ? "var(--secondary)" : "var(--card-subtle, var(--secondary))",
                          color: viewingNotice.priority === 'EMERGENCY' ? "var(--destructive)" : viewingNotice.priority === 'HIGH' ? "var(--warning)" : "var(--text-secondary, var(--muted-foreground))"
                        }}>
                          {viewingNotice.priority === 'EMERGENCY' && <AlertTriangle size={11} />}
                          {viewingNotice.priority}
                        </span>

                        {/* Audience Badge */}
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          backgroundColor: "var(--card)",
                          color: "var(--primary)",
                          border: "1px solid var(--border)"
                        }}>
                          {getAudienceBadgeText(viewingNotice)}
                        </span>
                      </div>

                      <h2 style={{
                        margin: 0,
                        fontSize: isNoticeMaximized ? 20 : 17,
                        fontWeight: 700,
                        color: "var(--text, var(--foreground))",
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
                        color: "var(--text-muted, var(--muted-foreground))",
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 4,
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
                        color: "var(--text-muted, var(--muted-foreground))",
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 4,
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
                    borderRadius: 4,
                    backgroundColor: "var(--card-subtle, var(--card))",
                    border: "1px solid var(--border, var(--border))",
                    fontSize: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: "var(--text-secondary, var(--muted-foreground))" }}>
                      <Clock size={14} style={{ color: viewingNotice.status === 'PUBLISHED' ? "var(--success)" : "var(--muted-foreground)" }} />
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
                      <span style={{ color: "var(--text-muted, var(--muted-foreground))" }}>
                        Recipients: <strong style={{ color: "var(--text, var(--foreground))" }}>{viewingNotice.recipient_count || 0}</strong>
                      </span>
                      <span style={{ color: "var(--text-muted, var(--muted-foreground))" }}>
                        Read: <strong style={{ color: "var(--text, var(--foreground))" }}>{viewingNotice.read_count || 0}</strong>
                      </span>
                      <span style={{ color: "var(--text-muted, var(--muted-foreground))" }}>
                        Replies: <strong style={{ color: "var(--primary)" }}>{viewingNotice.reply_count || 0}</strong>
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
                      color: "var(--text-muted, var(--muted-foreground))",
                      marginBottom: 8
                    }}>
                      Announcement Message
                    </label>
                    <div style={{
                      backgroundColor: "var(--bg-card, var(--card))",
                      border: "1px solid var(--border, var(--border))",
                      borderLeft: viewingNotice.status === 'PUBLISHED' ? "4px solid var(--border)" : "4px solid var(--border)",
                      borderRadius: 4,
                      padding: isNoticeMaximized ? '20px 22px' : '16px 18px',
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: "var(--text, var(--foreground))",
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: isNoticeMaximized ? 'calc(94vh - 360px)' : 280,
                      minHeight: isNoticeMaximized ? 260 : 'auto',
                      overflowY: 'auto'
                    }}>
                      {viewingNotice.message ? (
                        viewingNotice.message
                      ) : (
                        <span style={{ color: "var(--text-muted, var(--muted-foreground))", fontStyle: 'italic' }}>
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
                        color: "var(--text-muted, var(--muted-foreground))",
                        marginBottom: 8
                      }}>
                        Attached Document
                      </label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: 4,
                        backgroundColor: "var(--card-subtle, var(--card))",
                        border: "1px solid var(--border, var(--border))",
                        gap: 12,
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 4,
                            backgroundColor: "var(--card)",
                            color: "var(--primary)",
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
                              color: "var(--text, var(--foreground))",
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {viewingNotice.attachment_name || 'Attached File'}
                            </div>
                            {viewingNotice.attachment_size ? (
                              <div style={{ fontSize: 11.5, color: "var(--text-muted, var(--muted-foreground))" }}>
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
                                borderRadius: 4,
                                backgroundColor: "var(--card)",
                                color: "var(--primary)",
                                border: "1px solid var(--border)",
                                fontSize: 12.5,
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: 'none',
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
                              borderRadius: 4,
                              backgroundColor: "var(--primary)",
                              color: "var(--background)",
                              fontSize: 12.5,
                              fontWeight: 600,
                              textDecoration: 'none',
                              boxShadow: 'none'
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
                  borderTop: "1px solid var(--border, var(--border))",
                  background: "var(--card-subtle, var(--card))",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div>
                    {viewingNotice.reply_count > 0 && (
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
                          borderRadius: 4,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--card)",
                          color: "var(--primary)"
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
                          borderRadius: 4,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: "1px solid var(--border, var(--border))",
                          backgroundColor: "var(--bg-card, var(--card))",
                          color: "var(--text, var(--foreground))"
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
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: 'none',
                        backgroundColor: "var(--primary)",
                        color: "var(--background)",
                        boxShadow: 'none'
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>

      {/* ─── Threaded Replies Drawer for Specific Notice ─── */}
      {selectedNoticeForReplies && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "var(--card)",
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1000
        }}>
          <div style={{
            width: '100%',
            maxWidth: 580,
            backgroundColor: "var(--bg-card, var(--card))",
            color: "var(--text, var(--foreground))",
            height: '100%',
            overflowY: 'auto',
            padding: 24,
            boxSizing: 'border-box',
            boxShadow: 'none',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: "1px solid var(--border, var(--border))", paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  backgroundColor: "var(--card-subtle, var(--secondary))",
                  color: "var(--text-secondary, var(--muted-foreground))"
                }}>
                  {selectedNoticeForReplies.audience_type}
                </span>
                <h2 style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
                  {selectedNoticeForReplies.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNoticeForReplies(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: "var(--text-muted, var(--muted-foreground))" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Notice Message Card */}
            <div style={{ backgroundColor: "var(--card-subtle, var(--card))", padding: 14, borderRadius: 4, marginBottom: 20, fontSize: 13, color: "var(--text, var(--muted-foreground))", border: "1px solid var(--border, var(--border))" }}>
              <div style={{ fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", fontSize: 11, marginBottom: 4 }}>NOTICE BODY</div>
              {selectedNoticeForReplies.message}
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text, var(--foreground))", margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={16} color="#e11d55" /> Threaded Responses ({noticeReplies.length})
            </h3>

            {loadingReplies ? (
              <div style={{ padding: 24, textAlign: 'center', color: "var(--text-muted, var(--muted-foreground))" }}>Loading replies...</div>
            ) : noticeReplies.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: "var(--text-muted, var(--muted-foreground))", border: "1px dashed var(--border, var(--border))", borderRadius: 4 }}>
                No replies from parents or students for this notice yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14, overflowY: 'auto', flex: 1 }}>
                {noticeReplies.map(r => (
                  <div key={r.id} style={{ border: "1px solid var(--border, var(--border))", borderRadius: 4, padding: 12, backgroundColor: "var(--card-subtle, var(--card))" }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 3,
                          backgroundColor: r.author_role === 'PARENT' ? "var(--card)" : "var(--secondary)",
                          color: r.author_role === 'PARENT' ? "var(--primary)" : "var(--success)",
                          marginRight: 6
                        }}>
                          {r.author_role}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text, var(--foreground))" }}>{r.author_name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-muted, var(--muted-foreground))" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    {r.student_name && (
                      <div style={{ fontSize: 11.5, color: "var(--text-muted, var(--muted-foreground))", marginBottom: 8 }}>
                        Student: <PersonProfileLink kind="student" name={r.student_name} person={r as any} />{(r.class_name || r.section_name) ? ` (${[r.class_name, r.section_name].filter(Boolean).join(' - ')})` : ''}
                      </div>
                    )}

                    <div style={{ fontSize: 13, color: "var(--text, var(--foreground))", backgroundColor: "var(--bg-muted, var(--card))", padding: 10, borderRadius: 4 }}>
                      {r.reply_text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Universal Preview Modal for New Announcement */}
      <UniversalPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onEdit={() => setPreviewOpen(false)}
        onConfirm={handleConfirmAndPublish}
        onSecondary={handleSaveDraft}
        title="Preview Announcement Broadcast"
        subtitle={`Target: ${form.audienceType} · Priority: ${form.priority}`}
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

      {/* Confirmation Modal for Publishing Announcement */}
      <DestructiveConfirmModal
        isOpen={!!publishTarget}
        onClose={() => setPublishTarget(null)}
        onConfirm={handleConfirmPublish}
        title="Confirm Announcement Publish"
        entityName={publishTarget?.title || 'Announcement'}
        entityType="Announcement"
        warningMessage="This action will deliver notification broadcasts to all designated recipients and inboxes immediately."
        confirmText="Confirm and publish"
        loading={publishing}
        details={[
          { label: 'Audience Scope', value: publishTarget?.audience_type || '' },
          { label: 'Priority', value: publishTarget?.priority || '' }
        ]}
      />

      {/* Edit Draft Announcement Modal */}
      {editingDraft && (
        <div
          className="overlay"
          style={{
            zIndex: 10050,
            position: 'fixed',
            inset: 0,
            background: "var(--card)",
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            className="modal"
            style={{
              width: 'min(640px, 95vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: "var(--bg-card, var(--card))",
              border: "1px solid var(--border, var(--border))",
              borderRadius: 4,
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: "1px solid var(--border, var(--border))",
              background: "var(--card-subtle, var(--card))",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  background: "var(--accent)",
                  color: "var(--primary)",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
                    Edit Draft Announcement
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: "var(--text-muted, var(--muted-foreground))" }}>
                    Update details, target audience, or publish directly
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDraft(null)}
                disabled={editSaving}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: "var(--text-muted, var(--muted-foreground))", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editError && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 4,
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--destructive)",
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
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))" }}>
                  ANNOUNCEMENT TITLE <span style={{ color: "var(--destructive)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Enter announcement title..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    backgroundColor: "var(--bg, var(--card))",
                    color: "var(--text, var(--foreground))",
                    fontSize: 13.5,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Message Details Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))" }}>
                  BROADCAST DETAILS & INSTRUCTIONS <span style={{ color: "var(--destructive)" }}>*</span>
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
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    backgroundColor: "var(--bg, var(--card))",
                    color: "var(--text, var(--foreground))",
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Attachment Option in Edit Draft */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))" }}>
                  ATTACHMENT
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      borderRadius: 4,
                      border: "1px dashed var(--border, var(--border))",
                      backgroundColor: "var(--card-subtle, var(--card))",
                      color: "var(--text, var(--muted-foreground))",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Attach a file to this announcement"
                  >
                    <Paperclip size={15} color="#e11d55" />
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
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      color: "var(--primary)",
                      fontSize: 12.5,
                      maxWidth: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <Paperclip size={14} color="#e11d55" />
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                        {editAttachment.name}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--primary)", backgroundColor: "var(--card)", padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
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
                          color: "var(--destructive)",
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
                  <div style={{ fontSize: 12, color: "var(--destructive)", display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={13} /> {editAttachmentError}
                  </div>
                )}
              </div>

              {/* Targeting Controls */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 0 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>AUDIENCE TYPE</label>
                  <select
                    value={editForm.audienceType}
                    onChange={handleEditAudienceChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      backgroundColor: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="SCHOOL">SCHOOL (All)</option>
                    <option value="CLASS">CLASS (Specific Class)</option>
                    <option value="TEACHER">TEACHER (Faculty only)</option>
                    <option value="STUDENT">STUDENT (Student portal)</option>
                  </select>
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
                    color: (editForm.audienceType === 'CLASS' || editForm.audienceType === 'SECTION') ? "var(--primary)" : "var(--text-muted, var(--muted-foreground))"
                  }}>
                    <span>CLASS</span>
                    {(editForm.audienceType === 'CLASS' || editForm.audienceType === 'SECTION') && <span style={{ color: "var(--destructive)", fontWeight: 700 }}>*</span>}
                  </label>
                  <select
                    value={editForm.classId}
                    onChange={handleEditClassChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      backgroundColor: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">{editForm.audienceType === 'CLASS' || editForm.audienceType === 'SECTION' ? 'Select Class (L-KG to 12)' : 'All Classes'}</option>
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
                    color: editForm.audienceType === 'SECTION' ? "var(--primary)" : "var(--text-muted, var(--muted-foreground))"
                  }}>
                    <span>SECTION</span>
                    {editForm.audienceType === 'SECTION' && <span style={{ color: "var(--destructive)", fontWeight: 700 }}>*</span>}
                  </label>
                  <select
                    value={editSelectedSectionLetter}
                    onChange={handleEditSectionChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      backgroundColor: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))",
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 130px', minWidth: 0 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))" }}>PRIORITY</label>
                  <select
                    value={editForm.priority}
                    onChange={e => setEditForm({ ...editForm, priority: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: editForm.priority === 'EMERGENCY' ? "1px solid var(--border)" : "1px solid var(--border, var(--border))",
                      fontSize: 13,
                      boxSizing: 'border-box',
                      backgroundColor: editForm.priority === 'EMERGENCY' ? "var(--secondary)" : "var(--bg, var(--card))",
                      color: editForm.priority === 'EMERGENCY' ? "var(--destructive)" : "var(--text, var(--foreground))",
                      fontWeight: editForm.priority === 'EMERGENCY' ? 700 : 500
                    }}
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="EMERGENCY">EMERGENCY (Auto-Email Broadcast)</option>
                  </select>
                </div>
              </div>

              {editForm.priority === 'EMERGENCY' && (
                <div style={{ fontSize: 12, color: "var(--destructive)", display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> Emergency announcements automatically dispatch priority emails to all target audience accounts upon publication.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: "1px solid var(--border, var(--border))",
              background: "var(--card-subtle, var(--card))",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10
            }}>
              <button
                type="button"
                onClick={() => setEditingDraft(null)}
                disabled={editSaving}
                className="btn-secondary"
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  border: "1px solid var(--border, var(--border))",
                  background: 'transparent',
                  color: "var(--text, var(--muted-foreground))"
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
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  border: "1px solid var(--border, var(--border))",
                  background: "var(--bg-card, var(--card))",
                  color: "var(--text, var(--foreground))"
                }}
              >
                {editSaving ? 'Saving…' : 'Save as Draft'}
              </button>

              <button
                type="button"
                onClick={handleConfirmAndPublishDraft}
                disabled={editSaving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 20px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  border: 'none',
                  backgroundColor: "var(--success)",
                  color: "var(--background)",
                  boxShadow: 'none'
                }}
              >
                <Send size={14} />
                <span>{editSaving ? 'Publishing…' : 'Confirm and publish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------- IN-BROWSER ANNOUNCEMENT ATTACHMENT PREVIEW MODAL ------------------- */}
      {attachmentPreview && attachmentPreview.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: "var(--card)",
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10060,
            padding: 16
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 900,
              height: '85vh',
              background: "var(--panel, var(--card))",
              borderRadius: 4,
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: "1px solid var(--border, var(--border))"
            }}
          >
            <div style={{ padding: '14px 20px', borderBottom: "1px solid var(--border, var(--border))", display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: "var(--card-subtle, var(--card))" }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <Eye size={18} style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text, var(--foreground))", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {attachmentPreview.fileName}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={handlePreviewDownload}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    background: "var(--card)",
                    color: "var(--text, var(--foreground))",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Download size={13} /> Download File
                </button>
                <button
                  type="button"
                  onClick={closeAttachmentPreview}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: "var(--text-muted, var(--muted-foreground))", padding: 4 }}
                  aria-label="Close preview"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', background: "var(--card)", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {attachmentPreview.loading ? (
                <div style={{ textAlign: 'center', color: "var(--muted-foreground)" }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Loading preview securely...</p>
                </div>
              ) : attachmentPreview.error ? (
                <div style={{ textAlign: 'center', color: "var(--destructive)", padding: 24 }}>
                  <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>{attachmentPreview.error}</p>
                </div>
              ) : attachmentPreview.blobUrl && attachmentPreview.mimeType.startsWith('image/') ? (
                <img
                  src={attachmentPreview.blobUrl}
                  alt={attachmentPreview.fileName}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : attachmentPreview.blobUrl && (attachmentPreview.mimeType === 'application/pdf' || attachmentPreview.fileName.toLowerCase().endsWith('.pdf')) ? (
                <iframe
                  src={attachmentPreview.blobUrl}
                  title={attachmentPreview.fileName}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: "var(--background)", padding: 32 }}>
                  <FileText size={48} style={{ color: "var(--muted-foreground)", margin: '0 auto 16px' }} />
                  <h4 style={{ margin: '0 0 8px', fontSize: 16 }}>Inline preview not supported for this format</h4>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: "var(--muted-foreground)" }}>
                    Document files (.doc, .docx, .xlsx) can be downloaded directly to view on your device.
                  </p>
                  <button
                    type="button"
                    onClick={handlePreviewDownload}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 4,
                      border: 'none',
                      background: "var(--primary)",
                      color: "var(--background)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Download size={14} /> Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
