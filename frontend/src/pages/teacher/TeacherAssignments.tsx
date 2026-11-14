import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  ArrowLeft, BookOpen, GraduationCap, Plus, FileText, CheckCircle2, Clock, AlertTriangle, AlertCircle,
  Loader2, RefreshCw, Send, Eye, X, Award, Search, Paperclip, Download, Upload,
  Maximize2, Minimize2, Edit, Trash2, Calendar, Check, FileCheck, Image
} from 'lucide-react';
import { api } from '../../api';
import { PersonProfileLink } from '../../components/PersonProfileLink';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';

interface AssignmentAttachmentItem {
  id?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_data?: string;
  storage_key?: string;
  file_url?: string;
  uploaded_at?: string;
}

interface AssignmentRecord {
  id: string;
  school_id: string;
  class_id: string;
  section_id: string | null;
  subject_id?: string | null;
  subject_name?: string;
  class_number?: number;
  section_name?: string;
  teacher_id: string;
  teacher_name?: string;
  title: string;
  description: string;
  assigned_date: string;
  due_date: string;
  max_marks: number;
  submission_count?: number;
  attachment_count?: number;
  created_at?: string;
  updated_at?: string;
  document_url?: string;
  document_name?: string;
  document_size?: number;
  document_mime?: string;
  document_data?: string;
  storage_key?: string | null;
  attachments?: AssignmentAttachmentItem[];
  is_owner?: boolean;
}

interface UploadDocItem {
  file: File;
  base64: string;
  name: string;
  size: number;
  mimeType: string;
  blobUrl?: string;
}

interface StudentSubmission {
  id: string;
  school_id: string;
  assignment_id: string;
  student_id: string;
  student_name?: string;
  roll_number?: string;
  admission_number?: string;
  status: string;
  submitted_at: string;
  submission_text: string;
  marks_obtained?: number | null;
  feedback?: string | null;
  attachments?: Array<{
    id: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    created_at?: string;
  }>;
}

interface ClassOption {
  id: string;
  class_number: number;
  label: string;
}

interface SectionOption {
  id: string;
  class_id: string;
  name: string;
}

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf', '.xlsx', '.doc', '.docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILE_COUNT = 5;

const formatBytes = (bytes?: number | null) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export function formatAssignmentDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const s = String(dateStr).trim();
  if (!s || s === 'N/A') return '—';
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    if (s.includes('T') || s.includes(':')) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Kolkata'
        });
      }
    }
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
}

const getFileIcon = (fileName?: string, mimeType?: string) => {
  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return <FileText size={18} color="#d32f2f" />;
  }
  if (
    lowerMime.startsWith('image/') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.gif')
  ) {
    return <Image size={18} color="#e11d55" />;
  }
  if (lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) {
    return <FileText size={18} color="#e11d55" />;
  }
  if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.csv')) {
    return <FileCheck size={18} color="#03806a" />;
  }
  return <Paperclip size={18} color="#e11d55" />;
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
    lower.endsWith('.webp') ||
    lower.endsWith('.gif')
  );
};

function clampTo4DigitYear(val: string): string {
  if (!val) return '';
  const parts = val.split('-');
  if (parts[0] && parts[0].length > 4) {
    parts[0] = parts[0].slice(0, 4);
    return parts.join('-');
  }
  return val;
}
export function TeacherAssignments() {
  const { user } = useAuth();

  // Two-Section Dashboard State: 'published' = Published by Me, 'mentored' = My Mentored Class
  const [activeTab, setActiveTab] = useState<'published' | 'mentored'>('published');
  const [publishedAssignments, setPublishedAssignments] = useState<AssignmentRecord[]>([]);
  const [mentoredAssignments, setMentoredAssignments] = useState<AssignmentRecord[]>([]);
  const [mentorInfo, setMentorInfo] = useState<{
    has_mentor_class: boolean;
    mentored_classes: Array<{
      mentor_record_id: string;
      class_id: string;
      section_id: string;
      class_number: number;
      class_label: string;
      section_name: string;
      display_name: string;
    }>;
  }>({
    has_mentor_class: false,
    mentored_classes: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');

  // School Classes & Sections Options
  const [classesList, setClassesList] = useState<ClassOption[]>([]);
  const [sectionsList, setSectionsList] = useState<SectionOption[]>([]);

  // Create Assignment Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreateMaximized, setIsCreateMaximized] = useState(false);
  const [createForm, setCreateForm] = useState({
    class_id: '',
    section_id: '',
    title: '',
    description: '',
    assigned_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    max_marks: 100
  });
  const [createFiles, setCreateFiles] = useState<UploadDocItem[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // View Assignment Modal State
  const [viewAssignment, setViewAssignment] = useState<AssignmentRecord | null>(null);

  // Edit Assignment Modal State
  const [editAssignment, setEditAssignment] = useState<AssignmentRecord | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    class_id: '',
    section_id: '',
    assigned_date: '',
    due_date: '',
    max_marks: 100
  });
  const [editExistingAtts, setEditExistingAtts] = useState<AssignmentAttachmentItem[]>([]);
  const [editRemovedIds, setEditRemovedIds] = useState<string[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<UploadDocItem[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Assignment Modal State
  const [deleteTarget, setDeleteTarget] = useState<AssignmentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Attachment In-Browser Preview Modal State
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    fileName: string;
    mimeType: string;
    blobUrl: string | null;
    loading: boolean;
    error: string | null;
    assignmentId?: string;
    attachmentId?: string;
  } | null>(null);

  // Submissions Modal State
  const [submissionsAsg, setSubmissionsAsg] = useState<AssignmentRecord | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [gradingSub, setGradingSub] = useState<StudentSubmission | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState<string>('');
  const [savingGrade, setSavingGrade] = useState(false);

  // 1. Load Published and Mentored Class Assignments
  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [pubRes, mentRes, infoRes] = await Promise.all([
        api.get('/teacher/assignments/my-published'),
        api.get('/teacher/assignments/my-mentored'),
        api.get('/teacher/assignments/mentor-info').catch(() => ({ data: { has_mentor_class: false, mentored_classes: [] } }))
      ]);
      setPublishedAssignments(Array.isArray(pubRes.data) ? pubRes.data : []);
      setMentoredAssignments(Array.isArray(mentRes.data) ? mentRes.data : []);
      if (infoRes?.data) {
        setMentorInfo(infoRes.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Load School Classes & Sections Options
  const loadSchoolOptions = useCallback(async () => {
    try {
      const res = await api.get('/teacher/assignments/eligible-options');
      if (Array.isArray(res.data) && res.data.length > 0) {
        const cMap = new Map<string, ClassOption>();
        const sMap = new Map<string, SectionOption>();

        res.data.forEach((row: any) => {
          if (row.class_id && !cMap.has(row.class_id)) {
            const num = Number(row.class_number ?? 1);
            const lbl = row.class_label || (num === -1 ? 'Class L KG' : num === 0 ? 'Class U KG' : `Class ${num}`);
            cMap.set(row.class_id, {
              id: row.class_id,
              class_number: num,
              label: lbl
            });
          }
          if (row.section_id && !sMap.has(row.section_id)) {
            sMap.set(row.section_id, {
              id: row.section_id,
              class_id: row.class_id,
              name: row.section_name || 'A'
            });
          }
        });

        const sortedClasses = Array.from(cMap.values()).sort((a, b) => a.class_number - b.class_number);
        setClassesList(sortedClasses);
        setSectionsList(Array.from(sMap.values()));
        return;
      }
    } catch (_err) {}

    // Fallback: query /classes and /sections
    try {
      const [clsRes, secRes] = await Promise.all([
        api.get('/classes').catch(() => ({ data: [] })),
        api.get('/sections').catch(() => ({ data: [] }))
      ]);

      const clsArr = Array.isArray(clsRes.data) ? clsRes.data : [];
      const secArr = Array.isArray(secRes.data) ? secRes.data : [];

      const mappedClasses: ClassOption[] = clsArr.map((c: any) => {
        const num = Number(c.class_number ?? c.classNumber ?? 1);
        const lbl = c.label || c.name || (num === -1 ? 'Class L KG' : num === 0 ? 'Class U KG' : `Class ${num}`);
        return {
          id: c.id,
          class_number: num,
          label: lbl
        };
      }).sort((a: ClassOption, b: ClassOption) => a.class_number - b.class_number);

      const mappedSections: SectionOption[] = secArr.map((s: any) => ({
        id: s.id,
        class_id: s.class_id || s.classId,
        name: s.section_name || s.name || 'A'
      }));

      setClassesList(mappedClasses);
      setSectionsList(mappedSections);
    } catch (_e) {}
  }, []);

  useEffect(() => {
    loadAssignments();
    loadSchoolOptions();
  }, [loadAssignments, loadSchoolOptions]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      createFiles.forEach((f) => f.blobUrl && URL.revokeObjectURL(f.blobUrl));
      editNewFiles.forEach((f) => f.blobUrl && URL.revokeObjectURL(f.blobUrl));
      if (previewState?.blobUrl) {
        URL.revokeObjectURL(previewState.blobUrl);
      }
    };
  }, [createFiles, editNewFiles, previewState]);

  // Available sections for chosen class
  const availableSectionsForCreate = useMemo(() => {
    if (!createForm.class_id) return [];
    return sectionsList.filter((s) => s.class_id === createForm.class_id);
  }, [sectionsList, createForm.class_id]);

  const availableSectionsForEdit = useMemo(() => {
    if (!editForm.class_id) return [];
    return sectionsList.filter((s) => s.class_id === editForm.class_id);
  }, [sectionsList, editForm.class_id]);

  // File Upload Handlers
  const handleFileSelection = (
    e: React.ChangeEvent<HTMLInputElement>,
    currentCount: number,
    existingSize: number,
    onSuccess: (newItems: UploadDocItem[]) => void,
    onError: (msg: string) => void
  ) => {
    onError('');
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    if (currentCount + files.length > MAX_FILE_COUNT) {
      onError(`You can attach a maximum of ${MAX_FILE_COUNT} files.`);
      return;
    }

    let runningSize = existingSize;

    for (const file of files) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        onError(`File "${file.name}" has an unsupported format. Allowed: PNG, JPG, JPEG, PDF, DOC, DOCX, XLSX.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        onError(`File "${file.name}" exceeds the 10MB per-file limit.`);
        return;
      }
      runningSize += file.size;
      if (runningSize > MAX_TOTAL_SIZE) {
        onError('Total attachment size exceeds the 25MB limit.');
        return;
      }
    }

    Promise.all(
      files.map(
        (file) =>
          new Promise<UploadDocItem>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              const blobUrl = URL.createObjectURL(file);
              resolve({
                file,
                base64,
                name: file.name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
                blobUrl
              });
            };
            reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
            reader.readAsDataURL(file);
          })
      )
    )
      .then((items) => {
        onSuccess(items);
      })
      .catch((err) => {
        onError(err.message || 'Error processing attachments.');
      });

    e.target.value = '';
  };

  // Preview an attachment (supports local blob or remote secure preview)
  const openPreview = async (fileName: string, mimeType: string, blobUrl?: string | null, assignmentId?: string, attachmentId?: string) => {
    if (blobUrl) {
      setPreviewState({
        open: true,
        fileName,
        mimeType,
        blobUrl,
        loading: false,
        error: null,
        assignmentId,
        attachmentId
      });
      return;
    }

    setPreviewState({
      open: true,
      fileName,
      mimeType,
      blobUrl: null,
      loading: true,
      error: null,
      assignmentId,
      attachmentId
    });

    if (assignmentId) {
      try {
        const res = await api.get(`/teacher/assignments/${assignmentId}/document/preview`, {
          params: attachmentId ? { attachmentId } : undefined,
          responseType: 'blob'
        });
        const url = URL.createObjectURL(res.data);
        setPreviewState((prev) => (prev ? { ...prev, blobUrl: url, loading: false } : null));
      } catch (err: any) {
        setPreviewState((prev) => (prev ? { ...prev, loading: false, error: err?.response?.data?.message || 'Failed to load preview.' } : null));
      }
    }
  };

  const closePreview = () => {
    if (previewState?.blobUrl && !createFiles.some(f => f.blobUrl === previewState.blobUrl) && !editNewFiles.some(f => f.blobUrl === previewState.blobUrl)) {
      URL.revokeObjectURL(previewState.blobUrl);
    }
    setPreviewState(null);
  };

  const downloadAttachment = async (assignmentId: string, fileName: string, attachmentId?: string) => {
    try {
      const res = await api.get(`/teacher/assignments/${assignmentId}/document/download`, {
        params: attachmentId ? { attachmentId } : undefined,
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: (res.headers['content-type'] as string) || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to download attachment.');
    }
  };

  const openSubAttachmentPreview = async (
    assignmentId: string,
    submissionId: string,
    attachmentId: string,
    fileName: string,
    mimeType: string
  ) => {
    setPreviewState({
      open: true,
      fileName,
      mimeType,
      blobUrl: null,
      loading: true,
      error: null,
      assignmentId
    });
    try {
      const res = await api.get(
        `/teacher/assignments/${assignmentId}/submissions/${submissionId}/attachments/${attachmentId}/preview`,
        { responseType: 'blob' }
      );
      const objectUrl = URL.createObjectURL(res.data);
      setPreviewState((prev) => (prev ? { ...prev, blobUrl: objectUrl, loading: false } : null));
    } catch (_e) {
      setPreviewState((prev) => (prev ? { ...prev, loading: false, error: 'Failed to load attachment preview.' } : null));
    }
  };

  const downloadSubAttachment = async (
    assignmentId: string,
    submissionId: string,
    attachmentId: string,
    fileName: string
  ) => {
    try {
      const res = await api.get(
        `/teacher/assignments/${assignmentId}/submissions/${submissionId}/attachments/${attachmentId}/download`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to download student attachment.');
    }
  };

  // 3. Create & Publish Assignment Submission
  const handlePublishAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createForm.title.trim()) {
      setCreateError('Please enter an assignment title.');
      return;
    }
    if (!createForm.class_id) {
      setCreateError('Please select a target class.');
      return;
    }
    if (!createForm.due_date) {
      setCreateError('Please choose a submission deadline.');
      return;
    }

    setCreating(true);
    try {
      const attachmentsPayload = createFiles.map((f) => ({
        fileName: f.name,
        fileData: f.base64,
        size: f.size,
        mimeType: f.mimeType
      }));

      await api.post('/teacher/assignments', {
        class_id: createForm.class_id,
        section_id: createForm.section_id || null,
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        assigned_date: createForm.assigned_date,
        due_date: createForm.due_date,
        max_marks: Number(createForm.max_marks || 100),
        attachments: attachmentsPayload
      });

      setShowCreateModal(false);
      setCreateForm({
        class_id: '',
        section_id: '',
        title: '',
        description: '',
        assigned_date: new Date().toISOString().slice(0, 10),
        due_date: '',
        max_marks: 100
      });
      setCreateFiles([]);
      loadAssignments();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Failed to publish assignment.');
    } finally {
      setCreating(false);
    }
  };

  // 4. Open Edit Modal
  const handleOpenEdit = (asg: AssignmentRecord) => {
    setEditAssignment(asg);
    setEditForm({
      title: asg.title,
      description: asg.description,
      class_id: asg.class_id,
      section_id: asg.section_id || '',
      assigned_date: asg.assigned_date || (asg.created_at ? asg.created_at.slice(0, 10) : ''),
      due_date: asg.due_date,
      max_marks: asg.max_marks || 100
    });

    let existing: AssignmentAttachmentItem[] = [];
    if (Array.isArray(asg.attachments) && asg.attachments.length > 0) {
      existing = asg.attachments;
    } else if (asg.document_name) {
      existing = [{
        id: 'doc-0',
        file_name: asg.document_name,
        file_size: asg.document_size || 0,
        mime_type: asg.document_mime || 'application/pdf',
        storage_key: asg.storage_key || undefined
      }];
    }
    setEditExistingAtts(existing);
    setEditRemovedIds([]);
    setEditNewFiles([]);
    setEditError(null);
  };

  // 5. Save Assignment Edits
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAssignment) return;
    setEditError(null);

    if (!editForm.title.trim()) {
      setEditError('Please enter an assignment title.');
      return;
    }
    if (!editForm.class_id) {
      setEditError('Please select a target class.');
      return;
    }
    if (!editForm.due_date) {
      setEditError('Please choose a submission deadline.');
      return;
    }

    setSavingEdit(true);
    try {
      const newAttsPayload = editNewFiles.map((f) => ({
        fileName: f.name,
        fileData: f.base64,
        size: f.size,
        mimeType: f.mimeType
      }));

      await api.put(`/teacher/assignments/${editAssignment.id}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        class_id: editForm.class_id,
        section_id: editForm.section_id || null,
        assigned_date: editForm.assigned_date,
        due_date: editForm.due_date,
        max_marks: Number(editForm.max_marks || 100),
        removedAttachmentIds: editRemovedIds,
        newAttachments: newAttsPayload
      });

      setEditAssignment(null);
      loadAssignments();
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Failed to update assignment.');
    } finally {
      setSavingEdit(false);
    }
  };

  // 6. Delete Assignment
  const handleDeleteAssignment = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/teacher/assignments/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadAssignments();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete assignment.');
    } finally {
      setDeleting(false);
    }
  };

  // 7. Submissions Review
  const handleOpenSubmissions = async (asg: AssignmentRecord) => {
    setSubmissionsAsg(asg);
    setLoadingSubs(true);
    try {
      const res = await api.get(`/teacher/assignments/${asg.id}/submissions`);
      setSubmissions(Array.isArray(res.data) ? res.data : []);
    } catch (_e) {
      setSubmissions([]);
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionsAsg || !gradingSub) return;
    setSavingGrade(true);
    try {
      await api.put(`/teacher/assignments/${submissionsAsg.id}/submissions/${gradingSub.id}/grade`, {
        marks_obtained: gradeScore,
        feedback: gradeFeedback
      });
      setGradingSub(null);
      handleOpenSubmissions(submissionsAsg);
      loadAssignments();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save grade.');
    } finally {
      setSavingGrade(false);
    }
  };

  // Active list based on selected tab: Section 1 (Published by Me) vs Section 2 (My Mentored Class)
  const currentList = activeTab === 'published' ? publishedAssignments : mentoredAssignments;

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return currentList.filter((a) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.teacher_name && a.teacher_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.subject_name && a.subject_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.section_name && a.section_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesClass = filterClass === '' || a.class_id === filterClass;
      return matchesSearch && matchesClass;
    });
  }, [currentList, searchQuery, filterClass]);

  return (
    <div className="teacher-assignments-page" style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '24px 24px 48px', fontFamily: 'inherit', boxSizing: 'border-box' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div>
          <Link
            to="/dashboard"
            className="student-back-link inline-flex items-center gap-1.5 text-xs font-semibold mb-2"
            style={{ color: '#e11d48', textDecoration: 'none' }}
          >
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
            Assignment Management
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={loadAssignments}
            title="Refresh assignments"
            style={{
              padding: '9px 14px',
              borderRadius: 4,
              border: "1px solid var(--border, var(--border))",
              background: "var(--bg, var(--card))",
              color: "var(--text, var(--foreground))",
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '9px 16px',
              borderRadius: 4,
              border: 'none',
              background: "var(--primary)",
              color: "var(--background)",
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'none'
            }}
          >
            <Plus size={16} /> Create Assignment
          </button>
        </div>
      </div>

      {/* Two-Section Switcher: SECTION 1 (Published by Me) vs SECTION 2 (My Mentored Class) */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: "2px solid var(--border, var(--border))",
          marginBottom: 16
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('published')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'published' ? "3px solid var(--border)" : '3px solid transparent',
            color: activeTab === 'published' ? "var(--primary)" : "var(--text-secondary, var(--muted-foreground))",
            fontWeight: activeTab === 'published' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease'
          }}
        >
          <BookOpen size={18} />
          <span>Published by Me</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: activeTab === 'published' ? "var(--card)" : "var(--card-subtle, var(--secondary))",
              color: activeTab === 'published' ? "var(--primary)" : "var(--muted-foreground)",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {publishedAssignments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mentored')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'mentored' ? "3px solid var(--border)" : '3px solid transparent',
            color: activeTab === 'mentored' ? "var(--primary)" : "var(--text-secondary, var(--muted-foreground))",
            fontWeight: activeTab === 'mentored' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease'
          }}
        >
          <GraduationCap size={18} />
          <span>My Mentored Class</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: activeTab === 'mentored' ? "var(--card)" : "var(--card-subtle, var(--secondary))",
              color: activeTab === 'mentored' ? "var(--primary)" : "var(--muted-foreground)",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {mentoredAssignments.length}
          </span>
        </button>
      </div>

      {/* Context Banner */}
      {activeTab === 'published' ? (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 4,
            background: "var(--card-subtle, var(--card))",
            border: "1px solid var(--border, var(--border))",
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: "var(--text-secondary, var(--muted-foreground))"
          }}
        >
          <BookOpen size={16} color="#e11d55" />
          <span>
            Showing assignments published by <strong>you</strong> across all classes. You have full edit, delete, and submission grading permissions.
          </span>
        </div>
      ) : (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 4,
            background: mentorInfo.has_mentor_class ? "var(--secondary)" : "var(--card)",
            border: mentorInfo.has_mentor_class ? "1px solid var(--border)" : "1px solid var(--border)",
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: mentorInfo.has_mentor_class ? "var(--success)" : "var(--warning)"
          }}
        >
          <GraduationCap size={16} color={mentorInfo.has_mentor_class ? '#03806a' : '#b8781c'} />
          <span>
            {mentorInfo.has_mentor_class ? (
              <>
                Showing assignments published for your mentored class (
                <strong>
                  {mentorInfo.mentored_classes.map((c) => c.display_name).join(', ')}
                </strong>
                ) by all teachers. Assignments created by other teachers are read-only.
              </>
            ) : (
              <>
                You are not currently assigned as a class mentor to any section. Mentor assignments are configured by school administrators.
              </>
            )}
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        className="panel as-assignment-panel"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          padding: 16,
          borderRadius: 4,
          background: "var(--bg-card, var(--card))",
          border: "1px solid var(--border, var(--border))",
          marginBottom: 20
        }}
      >
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: "var(--text-muted, var(--muted-foreground))" }} />
          <input
            type="text"
            placeholder="Search assignments by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: 4,
              border: "1px solid var(--border, var(--border))",
              background: "var(--bg, var(--card))",
              color: "var(--text, var(--foreground))",
              fontSize: 13
            }}
          />
        </div>

        <div style={{ flex: '0 1 200px' }}>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 4,
              border: "1px solid var(--border, var(--border))",
              background: "var(--bg, var(--card))",
              color: "var(--text, var(--foreground))",
              fontSize: 13
            }}
          >
            <option value="">All Classes</option>
            {classesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content: Published Assignments Table */}
      <div
        className="panel as-assignment-panel"
        style={{
          borderRadius: 4,
          background: "var(--bg-card, var(--card))",
          border: "1px solid var(--border, var(--border))",
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: "1px solid var(--border, var(--border))", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
            {activeTab === 'published' ? 'Assignments Published by Me' : 'Mentored Class Assignments'} ({filteredAssignments.length})
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: "var(--text-muted, var(--muted-foreground))" }}>
            <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px', color: "var(--primary)" }} />
            <p style={{ margin: 0, fontSize: 14 }}>Loading published assignments...</p>
          </div>
        ) : error ? (
          <div style={{ padding: 36, textAlign: 'center', color: "var(--destructive)" }}>
            <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: '0 0 12px', fontSize: 14 }}>{error}</p>
            <button
              type="button"
              onClick={loadAssignments}
              style={{
                padding: '8px 16px',
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--secondary)",
                color: "var(--destructive)",
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : filteredAssignments.length === 0 ? (
          activeTab === 'published' ? (
            <div style={{ padding: 48, textAlign: 'center', color: "var(--text-muted, var(--muted-foreground))" }}>
              <BookOpen size={40} style={{ margin: '0 auto 12px', opacity: 0.5, color: "var(--primary)" }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: "var(--text, var(--foreground))" }}>No Assignments Published by You</h3>
              <p style={{ margin: '0 0 16px', fontSize: 14 }}>Create and publish your first assignment across any class or section.</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: 'none',
                  background: "var(--primary)",
                  color: "var(--background)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} style={{ display: 'inline', marginRight: 6 }} /> Create Assignment
              </button>
            </div>
          ) : !mentorInfo.has_mentor_class ? (
            <div style={{ padding: 48, textAlign: 'center', color: "var(--text-muted, var(--muted-foreground))" }}>
              <GraduationCap size={40} style={{ margin: '0 auto 12px', opacity: 0.5, color: "var(--warning)" }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: "var(--text, var(--foreground))" }}>No Mentored Class Assigned</h3>
              <p style={{ margin: '0 0 16px', fontSize: 14, maxWidth: 440, marginInline: 'auto' }}>
                You are not currently assigned as a class mentor to any section. Mentor assignments are configured by school administrators.
              </p>
            </div>
          ) : (
            <div style={{ padding: 48, textAlign: 'center', color: "var(--text-muted, var(--muted-foreground))" }}>
              <BookOpen size={40} style={{ margin: '0 auto 12px', opacity: 0.5, color: "var(--success)" }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: "var(--text, var(--foreground))" }}>No Assignments for Mentored Class</h3>
              <p style={{ margin: '0 0 16px', fontSize: 14 }}>
                No assignments have been published for {mentorInfo.mentored_classes.map((c) => c.display_name).join(', ')} yet.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: 'none',
                  background: "var(--primary)",
                  color: "var(--background)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} style={{ display: 'inline', marginRight: 6 }} /> Create Assignment
              </button>
            </div>
          )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="as-assignment-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--card-subtle, var(--card))", borderBottom: "1px solid var(--border, var(--border))" }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", minWidth: 200 }}>Assignment Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", minWidth: 140 }}>Class & Section</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", minWidth: 130 }}>Assigned Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", minWidth: 130 }}>Due Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", textAlign: 'center', minWidth: 110 }}>Attachments</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", minWidth: 130 }}>Published On</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", textAlign: 'right', minWidth: 320 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((asg) => {
                  const attCount = asg.attachment_count ?? (Array.isArray(asg.attachments) ? asg.attachments.length : (asg.document_name ? 1 : 0));
                  const classDisplay = asg.class_number !== undefined
                    ? (asg.class_number === -1 ? 'Class L KG' : asg.class_number === 0 ? 'Class U KG' : `Class ${asg.class_number}`)
                    : 'Class';
                  const sectionDisplay = asg.section_name ? `Sec ${asg.section_name}` : 'All Sections';
                  const pubDate = formatAssignmentDate(asg.created_at);

                  return (
                    <tr
                      key={asg.id}
                      style={{ borderBottom: "1px solid var(--border, var(--border))", transition: 'background 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-subtle, #f9f9fa)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 2 }}>{asg.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary, var(--muted-foreground))", maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                          {asg.description}
                        </div>
                        {activeTab === 'mentored' && (
                          <div>
                            {asg.is_owner ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 4, background: "var(--card)", color: "var(--primary)", fontSize: 11, fontWeight: 600 }}>
                                Published by You
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 4, background: "var(--secondary)", color: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}>
                                By: {asg.teacher_name || 'Other Teacher'} (Read-Only)
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 4, background: "var(--accent)", color: "var(--primary)", fontSize: 12, fontWeight: 600 }}>
                          {classDisplay} • {sectionDisplay}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: "var(--text, var(--muted-foreground))", whiteSpace: 'nowrap' }}>
                        <Calendar size={13} style={{ display: 'inline', marginRight: 4, color: "var(--muted-foreground)" }} />
                        {formatAssignmentDate(asg.assigned_date || asg.created_at)}
                      </td>
                      <td style={{ padding: '14px 16px', color: "var(--text, var(--muted-foreground))", whiteSpace: 'nowrap' }}>
                        <Clock size={13} style={{ display: 'inline', marginRight: 4, color: "var(--warning)" }} />
                        <span style={{ fontWeight: 600 }}>{formatAssignmentDate(asg.due_date)}</span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {attCount > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: "var(--secondary)", color: "var(--primary-400, var(--info))", fontSize: 12, fontWeight: 600 }}>
                            <Paperclip size={12} /> {attCount}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted, var(--muted-foreground))", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', color: "var(--text-secondary, var(--muted-foreground))", fontSize: 12, whiteSpace: 'nowrap' }}>
                        {pubDate}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            title="View Assignment"
                            onClick={() => setViewAssignment(asg)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 4,
                              border: "1px solid var(--border, var(--border))",
                              background: "var(--bg, var(--card))",
                              color: "var(--text, var(--foreground))",
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              fontWeight: 500
                            }}
                          >
                            <Eye size={13} /> View
                          </button>

                          {/* Only author can Edit or Delete */}
                          {asg.is_owner && (
                            <>
                              <button
                                type="button"
                                title="Edit Assignment"
                                onClick={() => handleOpenEdit(asg)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 4,
                                  border: "1px solid var(--border, var(--border))",
                                  background: "var(--bg, var(--card))",
                                  color: "var(--info)",
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 12,
                                  fontWeight: 500
                                }}
                              >
                                <Edit size={13} /> Edit
                              </button>

                              <button
                                type="button"
                                title="Delete Assignment"
                                onClick={() => setDeleteTarget(asg)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 4,
                                  border: "1px solid var(--border)",
                                  background: "var(--secondary)",
                                  color: "var(--destructive)",
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 12,
                                  fontWeight: 500
                                }}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            title="Review Submissions"
                            onClick={() => handleOpenSubmissions(asg)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 4,
                              border: "1px solid var(--border)",
                              background: "var(--accent)",
                              color: "var(--primary)",
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          >
                            <FileCheck size={13} /> Submissions ({asg.submission_count || 0})
                          </button>
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

      {/* ------------------- CREATE ASSIGNMENT MODAL ------------------- */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: "var(--card)",
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: isCreateMaximized ? '95vw' : '680px',
              maxHeight: isCreateMaximized ? '95vh' : '90vh',
              background: "var(--bg-card, var(--card))",
              borderRadius: 4,
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: "1px solid var(--border, var(--border))"
            }}
          >
            {/* Modal Header */}
            <div className="as-assignment-modal-header" style={{ padding: '16px 20px', borderBottom: "1px solid var(--border, var(--border))", background: "var(--card-subtle, var(--card))", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={20} style={{ color: "var(--primary)" }} />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text, var(--foreground))" }}>Create Assignment</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsCreateMaximized(!isCreateMaximized)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: "var(--text-muted, var(--muted-foreground))" }}
                >
                  {isCreateMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: "var(--text-muted, var(--muted-foreground))" }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handlePublishAssignment} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: 20, gap: 16 }}>
              {createError && (
                <div style={{ padding: '10px 14px', borderRadius: 4, background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--destructive)", fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} />
                  <span>{createError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                  Assignment Title <span style={{ color: "var(--destructive)" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 4 Practice Questions"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    background: "var(--bg, var(--card))",
                    color: "var(--text, var(--foreground))",
                    fontSize: 14
                  }}
                  required
                />
              </div>

              {/* Target Class and Section */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                    Select Class <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <select
                    value={createForm.class_id}
                    onChange={(e) => setCreateForm({ ...createForm, class_id: e.target.value, section_id: '' })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      background: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 14
                    }}
                    required
                  >
                    <option value="">-- Choose Class --</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                    Select Section
                  </label>
                  <select
                    value={createForm.section_id}
                    onChange={(e) => setCreateForm({ ...createForm, section_id: e.target.value })}
                    disabled={!createForm.class_id}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      background: createForm.class_id ? "var(--card, var(--card))" : "var(--card-subtle, var(--secondary))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 14
                    }}
                  >
                    <option value="">All Sections (Whole Class)</option>
                    {availableSectionsForCreate.map((s) => (
                      <option key={s.id} value={s.id}>
                        Section {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assignment Date and Due Date */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                    Assigned Date <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    type="date"
                    min="1900-01-01"
                    max="9999-12-31"
                    value={createForm.assigned_date}
                    onChange={(e) => setCreateForm({ ...createForm, assigned_date: clampTo4DigitYear(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      background: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 14
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                    Submission Deadline (Due Date) <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    type="date"
                    min="1900-01-01"
                    max="9999-12-31"
                    value={createForm.due_date}
                    onChange={(e) => setCreateForm({ ...createForm, due_date: clampTo4DigitYear(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      background: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 14
                    }}
                    required
                  />
                </div>
              </div>

              {/* Detailed Instructions / Description */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                  Detailed Instructions / Description
                </label>
                <AutoExpandingTextarea
                  placeholder="Provide instructions, reading references, submission requirements..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  minHeight={80}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    background: "var(--bg, var(--card))",
                    color: "var(--text, var(--foreground))",
                    fontSize: 14,
                    lineHeight: 1.5
                  }}
                />
              </div>

              {/* Attach Document / File */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                  Attach Document / File
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
                    title="Attach files to this assignment"
                  >
                    <Paperclip size={15} color="#e11d55" />
                    <span>{createFiles.length > 0 ? 'Attach More Files' : 'Attach Document / File'}</span>
                    <input
                      id="create-file-input"
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) =>
                        handleFileSelection(
                          e,
                          createFiles.length,
                          createFiles.reduce((acc, f) => acc + f.size, 0),
                          (newItems) => setCreateFiles((prev) => [...prev, ...newItems]),
                          (msg) => setCreateError(msg)
                        )
                      }
                    />
                  </label>
                  <span style={{ fontSize: 12, color: "var(--text-muted, var(--muted-foreground))" }}>
                    {createFiles.length > 0
                      ? `${createFiles.length}/5 files selected (${formatBytes(createFiles.reduce((acc, f) => acc + f.size, 0))})`
                      : 'Supports PDF, JPG, PNG, DOCX, XLSX (up to 5 files, max 10MB each)'}
                  </span>
                </div>

                {/* Pre-Publish Attachment List */}
                {createFiles.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {createFiles.map((fileItem, idx) => {
                      const isPreviewable = isPreviewableFile(fileItem.name, fileItem.mimeType);
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 4,
                            background: "var(--card, var(--card))",
                            border: "1px solid var(--border, var(--border))",
                            gap: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: 4,
                              backgroundColor: "var(--card)",
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {getFileIcon(fileItem.name, fileItem.mimeType)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--text, var(--foreground))",
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {fileItem.name}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                                {formatBytes(fileItem.size)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {isPreviewable && (
                              <button
                                type="button"
                                onClick={() => openPreview(fileItem.name, fileItem.mimeType, fileItem.blobUrl)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 4,
                                  border: "1px solid var(--border)",
                                  background: "var(--card)",
                                  color: "var(--primary)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <Eye size={12} /> Preview
                              </button>
                            )}
                            <button
                              type="button"
                              title="Remove attachment"
                              onClick={() => {
                                if (fileItem.blobUrl) URL.revokeObjectURL(fileItem.blobUrl);
                                setCreateFiles((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: "var(--destructive)",
                                padding: 4,
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="as-assignment-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 20px', margin: '0 -20px -20px -20px', borderTop: "1px solid var(--border, var(--border))", background: "var(--card-subtle, var(--card))" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    background: "var(--bg, var(--card))",
                    color: "var(--text, var(--muted-foreground))",
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 4,
                    border: 'none',
                    background: "var(--primary)",
                    color: "var(--background)",
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: 'none'
                  }}
                >
                  {creating ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------- VIEW ASSIGNMENT MODAL ------------------- */}
      {viewAssignment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: "var(--card)",
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              background: "var(--bg-card, var(--card))",
              borderRadius: 4,
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: "1px solid var(--border, var(--border))"
            }}
          >
            <div className="as-assignment-modal-header" style={{ padding: '16px 20px', borderBottom: "1px solid var(--border, var(--border))", background: "var(--card-subtle, var(--card))", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={20} style={{ color: "var(--info)" }} />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text, var(--foreground))" }}>Assignment Details</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewAssignment(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: "var(--text-muted, var(--muted-foreground))" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: "var(--accent)", color: "var(--primary)", display: 'inline-block', marginBottom: 8 }}>
                  Class {viewAssignment.class_number ?? ''} {viewAssignment.section_name ? `• Section ${viewAssignment.section_name}` : '• All Sections'}
                </span>
                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
                  {viewAssignment.title}
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, padding: 12, borderRadius: 4, background: "var(--card-subtle, var(--card))", border: "1px solid var(--border, var(--border))", fontSize: 13 }}>
                <div>
                  <span style={{ display: 'block', color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}>ASSIGNED DATE</span>
                  <span style={{ fontWeight: 600, color: "var(--text, var(--foreground))" }}>
                    {formatAssignmentDate(viewAssignment.assigned_date || viewAssignment.created_at)}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}>DUE DATE</span>
                  <span style={{ fontWeight: 600, color: "var(--warning)" }}>
                    {formatAssignmentDate(viewAssignment.due_date)}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}>PUBLISHED ON</span>
                  <span style={{ fontWeight: 600, color: "var(--text, var(--foreground))" }}>
                    {formatAssignmentDate(viewAssignment.created_at)}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', color: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}>MAX MARKS</span>
                  <span style={{ fontWeight: 600, color: "var(--text, var(--foreground))" }}>
                    {viewAssignment.max_marks || 100}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--muted-foreground))", marginBottom: 6 }}>
                  INSTRUCTIONS
                </label>
                <div style={{ padding: 14, borderRadius: 4, background: "var(--bg, var(--card))", border: "1px solid var(--border, var(--border))", whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14, color: "var(--text, var(--foreground))" }}>
                  {viewAssignment.description || 'No instructions provided.'}
                </div>
              </div>

              {/* Attachments List */}
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
                  Attached Documents ({Array.isArray(viewAssignment.attachments) ? viewAssignment.attachments.length : (viewAssignment.document_name ? 1 : 0)})
                </label>

                {((Array.isArray(viewAssignment.attachments) && viewAssignment.attachments.length > 0) || viewAssignment.document_name) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(Array.isArray(viewAssignment.attachments) && viewAssignment.attachments.length > 0
                      ? viewAssignment.attachments
                      : [{
                          id: 'doc-0',
                          file_name: viewAssignment.document_name || 'attachment.pdf',
                          file_size: viewAssignment.document_size || 0,
                          mime_type: viewAssignment.document_mime || 'application/pdf'
                        }]
                    ).map((att, idx) => {
                      const isPreviewable = isPreviewableFile(att.file_name, att.mime_type);
                      return (
                        <div
                          key={att.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: 4,
                            backgroundColor: "var(--card-subtle, var(--card))",
                            border: "1px solid var(--border, var(--border))",
                            gap: 12,
                            flexWrap: 'wrap'
                          }}
                        >
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
                              {getFileIcon(att.file_name, att.mime_type)}
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
                                {att.file_name}
                              </div>
                              {att.file_size ? (
                                <div style={{ fontSize: 11.5, color: "var(--text-muted, var(--muted-foreground))" }}>
                                  {formatBytes(att.file_size)}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isPreviewable && (
                              <button
                                type="button"
                                onClick={() => openPreview(att.file_name, att.mime_type, null, viewAssignment.id, att.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '7px 14px',
                                  borderRadius: 4,
                                  backgroundColor: "var(--card)",
                                  color: "var(--primary)",
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  border: "1px solid var(--border)",
                                  cursor: 'pointer'
                                }}
                              >
                                <Eye size={14} /> Preview
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => downloadAttachment(viewAssignment.id, att.file_name, att.id)}
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
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: 'none'
                              }}
                            >
                              <Download size={14} /> Download File
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--text-muted, var(--muted-foreground))", fontStyle: 'italic', margin: 0 }}>
                    No attachments uploaded.
                  </p>
                )}
              </div>
            </div>

            <div className="as-assignment-modal-footer" style={{ padding: '14px 20px', borderTop: "1px solid var(--border, var(--border))", background: "var(--card-subtle, var(--card))", display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setViewAssignment(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: "1px solid var(--border, var(--border))",
                  background: "var(--card-subtle, var(--card))",
                  color: "var(--text, var(--foreground))",
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

      {/* ------------------- EDIT ASSIGNMENT MODAL ------------------- */}
      {editAssignment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: "var(--card)",
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              background: "var(--bg-card, var(--card))",
              borderRadius: 4,
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: "1px solid var(--border, var(--border))"
            }}
          >
            <div className="as-assignment-modal-header" style={{ padding: '16px 20px', borderBottom: "1px solid var(--border, var(--border))", background: "var(--card-subtle, var(--card))", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit size={20} style={{ color: "var(--info)" }} />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text, var(--foreground))" }}>Edit Assignment</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditAssignment(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: "var(--text-muted, var(--muted-foreground))" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: 20, gap: 16 }}>
              {editError && (
                <div style={{ padding: '10px 14px', borderRadius: 4, background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--destructive)", fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} />
                  <span>{editError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                  Assignment Title <span style={{ color: "var(--destructive)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    background: "var(--bg, var(--card))",
                    color: "var(--text, var(--foreground))",
                    fontSize: 14
                  }}
                  required
                />
              </div>

              {/* Target Class and Section */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                    Select Class <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <select
                    value={editForm.class_id}
                    onChange={(e) => setEditForm({ ...editForm, class_id: e.target.value, section_id: '' })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      background: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 14
                    }}
                    required
                  >
                    <option value="">-- Choose Class --</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                    Select Section
                  </label>
                  <select
                    value={editForm.section_id}
                    onChange={(e) => setEditForm({ ...editForm, section_id: e.target.value })}
                    disabled={!editForm.class_id}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      background: editForm.class_id ? "var(--card, var(--card))" : "var(--card-subtle, var(--secondary))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 14
                    }}
                  >
                    <option value="">All Sections (Whole Class)</option>
                    {availableSectionsForEdit.map((s) => (
                      <option key={s.id} value={s.id}>
                        Section {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned Date and Due Date */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                    Assigned Date <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    type="date"
                    min="1900-01-01"
                    max="9999-12-31"
                    value={editForm.assigned_date}
                    onChange={(e) => setEditForm({ ...editForm, assigned_date: clampTo4DigitYear(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      background: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 14
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                    Submission Deadline (Due Date) <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    type="date"
                    min="1900-01-01"
                    max="9999-12-31"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm({ ...editForm, due_date: clampTo4DigitYear(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      background: "var(--bg, var(--card))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 14
                    }}
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                  Description / Instructions
                </label>
                <AutoExpandingTextarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  minHeight={80}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    background: "var(--bg, var(--card))",
                    color: "var(--text, var(--foreground))",
                    fontSize: 14,
                    lineHeight: 1.5
                  }}
                />
              </div>

              {/* Existing Attachments */}
              {editExistingAtts.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                    Current Attachments
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {editExistingAtts.map((att) => {
                      const isMarked = editRemovedIds.includes(att.id || '');
                      const isPreviewable = isPreviewableFile(att.file_name, att.mime_type);
                      return (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 4,
                            background: isMarked ? "var(--secondary)" : "var(--card-subtle, var(--card))",
                            border: `1px solid ${isMarked ? "var(--border)" : "var(--border, var(--border))"}`,
                            opacity: isMarked ? 0.6 : 1,
                            gap: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: 4,
                              backgroundColor: isMarked ? "var(--secondary)" : "var(--card)",
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {getFileIcon(att.file_name, att.mime_type)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{
                                fontSize: 13,
                                fontWeight: 600,
                                textDecoration: isMarked ? 'line-through' : 'none',
                                color: isMarked ? "var(--destructive)" : "var(--text, var(--foreground))",
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {att.file_name}
                              </div>
                              {att.file_size ? (
                                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                                  {formatBytes(att.file_size)}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {!isMarked && isPreviewable && editAssignment && (
                              <button
                                type="button"
                                onClick={() => openPreview(att.file_name, att.mime_type, null, editAssignment.id, att.id)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  border: "1px solid var(--border)",
                                  background: "var(--card)",
                                  color: "var(--primary)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <Eye size={12} /> Preview
                              </button>
                            )}
                            {isMarked ? (
                              <button
                                type="button"
                                onClick={() => setEditRemovedIds((prev) => prev.filter((id) => id !== att.id))}
                                style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: "var(--accent)", color: "var(--primary)", fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                              >
                                Undo
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditRemovedIds((prev) => [...prev, att.id || ''])}
                                style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: "var(--secondary)", color: "var(--destructive)", fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add New Attachments */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: "var(--text, var(--foreground))", marginBottom: 6 }}>
                  Attach Document / File
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
                    title="Attach new files"
                  >
                    <Paperclip size={15} color="#e11d55" />
                    <span>Attach Document / File</span>
                    <input
                      id="edit-file-input"
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) =>
                        handleFileSelection(
                          e,
                          editExistingAtts.filter((a) => !editRemovedIds.includes(a.id || '')).length + editNewFiles.length,
                          editNewFiles.reduce((acc, f) => acc + f.size, 0),
                          (newItems) => setEditNewFiles((prev) => [...prev, ...newItems]),
                          (msg) => setEditError(msg)
                        )
                      }
                    />
                  </label>
                  <span style={{ fontSize: 12, color: "var(--text-muted, var(--muted-foreground))" }}>
                    {editNewFiles.length > 0
                      ? `${editNewFiles.length} new file(s) selected`
                      : 'Upload additional files (max 5 total cumulative).'}
                  </span>
                </div>

                {/* New Files List */}
                {editNewFiles.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {editNewFiles.map((fileItem, idx) => {
                      const isPreviewable = isPreviewableFile(fileItem.name, fileItem.mimeType);
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: 4,
                            background: "var(--card, var(--card))",
                            border: "1px solid var(--border, var(--border))",
                            gap: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              backgroundColor: "var(--card)",
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {getFileIcon(fileItem.name, fileItem.mimeType)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text, var(--foreground))", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {fileItem.name}
                              </span>
                              <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 6 }}>
                                ({formatBytes(fileItem.size)})
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {isPreviewable && (
                              <button
                                type="button"
                                onClick={() => openPreview(fileItem.name, fileItem.mimeType, fileItem.blobUrl)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  border: "1px solid var(--border)",
                                  background: "var(--card)",
                                  color: "var(--primary)",
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                              >
                                <Eye size={11} /> Preview
                              </button>
                            )}
                            <button
                              type="button"
                              title="Remove attachment"
                              onClick={() => {
                                if (fileItem.blobUrl) URL.revokeObjectURL(fileItem.blobUrl);
                                setEditNewFiles((prev) => prev.filter((_, i) => i !== idx));
                              }}
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="as-assignment-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 20px', margin: '0 -20px -20px -20px', borderTop: "1px solid var(--border, var(--border))", background: "var(--card-subtle, var(--card))" }}>
                <button
                  type="button"
                  onClick={() => setEditAssignment(null)}
                  disabled={savingEdit}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    background: "var(--bg, var(--card))",
                    color: "var(--text, var(--muted-foreground))",
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 4,
                    border: 'none',
                    background: "var(--info)",
                    color: "var(--background)",
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  {savingEdit ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------- DELETE ASSIGNMENT CONFIRMATION DIALOG ------------------- */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: "var(--card)",
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: "var(--bg-card, var(--card))",
              borderRadius: 4,
              boxShadow: 'none',
              padding: 24,
              border: "1px solid var(--border, var(--border))"
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 10, borderRadius: '50%', background: "var(--secondary)", color: "var(--destructive)" }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
                Delete Assignment
              </h3>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: 14, color: "var(--text, var(--muted-foreground))", lineHeight: 1.5 }}>
              Are you sure you want to delete <b>{deleteTarget.title}</b>?
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: "var(--destructive)", lineHeight: 1.4 }}>
              This will permanently remove the assignment, all associated attachments from storage, and all student submissions. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: "1px solid var(--border, var(--border))",
                  background: 'transparent',
                  color: "var(--text, var(--muted-foreground))",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAssignment}
                disabled={deleting}
                style={{
                  padding: '8px 18px',
                  borderRadius: 4,
                  border: 'none',
                  background: "var(--destructive)",
                  color: "var(--background)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------- IN-BROWSER ATTACHMENT PREVIEW MODAL ------------------- */}
      {previewState && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: "var(--card)",
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 900,
              height: '85vh',
              background: "var(--bg-card, var(--card))",
              borderRadius: 4,
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: "1px solid var(--border, var(--border))"
            }}
          >
            <div className="as-assignment-modal-header" style={{ padding: '14px 20px', borderBottom: "1px solid var(--border, var(--border))", background: "var(--card-subtle, var(--card))", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <Eye size={18} style={{ color: "var(--info)" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text, var(--foreground))", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewState.fileName}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {previewState.assignmentId && (
                  <button
                    type="button"
                    onClick={() => downloadAttachment(previewState.assignmentId!, previewState.fileName, previewState.attachmentId)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      background: "var(--card-subtle, var(--card))",
                      color: "var(--text, var(--foreground))",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Download size={13} /> Download Attachment
                  </button>
                )}
                <button
                  type="button"
                  onClick={closePreview}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: "var(--text-muted, var(--muted-foreground))" }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', background: "var(--card)", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewState.loading ? (
                <div style={{ textAlign: 'center', color: "var(--muted-foreground)" }}>
                  <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Loading preview securely...</p>
                </div>
              ) : previewState.error ? (
                <div style={{ textAlign: 'center', color: "var(--destructive)", padding: 24 }}>
                  <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>{previewState.error}</p>
                </div>
              ) : previewState.blobUrl && previewState.mimeType.startsWith('image/') ? (
                <img
                  src={previewState.blobUrl}
                  alt={previewState.fileName}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : previewState.blobUrl && previewState.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewState.blobUrl}
                  title={previewState.fileName}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: "var(--background)", padding: 32 }}>
                  <FileText size={48} style={{ color: "var(--muted-foreground)", margin: '0 auto 16px' }} />
                  <h4 style={{ margin: '0 0 8px', fontSize: 16 }}>Inline preview not supported for this format</h4>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: "var(--muted-foreground)" }}>
                    Document files (.doc, .docx, .xlsx) can be downloaded directly to view on your device.
                  </p>
                  {previewState.assignmentId && (
                    <button
                      type="button"
                      onClick={() => downloadAttachment(previewState.assignmentId!, previewState.fileName, previewState.attachmentId)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 4,
                        border: 'none',
                        background: "var(--info)",
                        color: "var(--background)",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Download size={14} /> Download Document
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------- REVIEW & GRADE SUBMISSIONS MODAL ------------------- */}
      {submissionsAsg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: "var(--card)",
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 840,
              maxHeight: '90vh',
              background: "var(--bg-card, var(--card))",
              borderRadius: 4,
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: "1px solid var(--border, var(--border))"
            }}
          >
            <div className="as-assignment-modal-header" style={{ padding: '16px 20px', borderBottom: "1px solid var(--border, var(--border))", background: "var(--card-subtle, var(--card))", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
                  Student Submissions: {submissionsAsg.title}
                </h3>
                <span style={{ fontSize: 12, color: "var(--text-muted, var(--muted-foreground))" }}>
                  Due: {formatAssignmentDate(submissionsAsg.due_date)} | Total Submissions: {submissions.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSubmissionsAsg(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: "var(--text-muted, var(--muted-foreground))" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {loadingSubs ? (
                <div style={{ padding: 36, textAlign: 'center', color: "var(--text-muted, var(--muted-foreground))" }}>
                  <Loader2 size={28} className="spin" style={{ margin: '0 auto 8px', color: "var(--primary)" }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Loading student submissions...</p>
                </div>
              ) : submissions.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: "var(--text-muted, var(--muted-foreground))" }}>
                  <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: 14 }}>No students have submitted work for this assignment yet.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: "var(--card-subtle, var(--card))", borderBottom: "1px solid var(--border, var(--border))" }}>
                      <th style={{ padding: '10px 12px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))" }}>Student</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))" }}>Submitted At</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))" }}>Status</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))" }}>Score</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600, color: "var(--text-muted, var(--muted-foreground))", textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id} style={{ borderBottom: "1px solid var(--border, var(--border))" }}>
                        <td style={{ padding: '12px' }}>
                          <PersonProfileLink kind="student" id={sub.student_id} name={sub.student_name || 'Student'}>
                            <span style={{ fontWeight: 600, color: "var(--text, var(--foreground))" }}>{sub.student_name || 'Student'}</span>
                          </PersonProfileLink>
                          {sub.roll_number && (
                            <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 6 }}>
                              (Roll: {sub.roll_number})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: "var(--text-secondary, var(--muted-foreground))" }}>
                          {sub.submitted_at ? formatAssignmentDate(sub.submitted_at) : '—'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              background: sub.status === 'GRADED' ? "var(--secondary)" : "var(--secondary)",
                              color: sub.status === 'GRADED' ? "var(--success)" : "var(--warning)"
                            }}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>
                          {sub.marks_obtained !== undefined && sub.marks_obtained !== null ? `${sub.marks_obtained} / ${submissionsAsg.max_marks || 100}` : '—'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setGradingSub(sub);
                              setGradeScore(sub.marks_obtained ?? 0);
                              setGradeFeedback(sub.feedback || '');
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 4,
                              border: "1px solid var(--border, var(--border))",
                              background: "var(--bg, var(--card))",
                              color: "var(--primary)",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {submissionsAsg.is_owner ? (sub.status === 'GRADED' ? 'Edit Grade' : 'Grade') : 'View Work'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Sub-form to Grade selected submission */}
              {gradingSub && (
                <div style={{ marginTop: 20, padding: 16, borderRadius: 4, background: "var(--card-subtle, var(--card))", border: "1px solid var(--border, var(--border))" }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
                    Grade Submission: {gradingSub.student_name}
                  </h4>
                  {gradingSub.submission_text && (
                    <div style={{ marginBottom: 12, padding: 10, borderRadius: 4, background: "var(--bg, var(--card))", border: "1px solid var(--border, var(--border))", fontSize: 13, color: "var(--text, var(--muted-foreground))" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", display: 'block', marginBottom: 4 }}>SUBMISSION TEXT:</span>
                      {gradingSub.submission_text}
                    </div>
                  )}

                  {gradingSub.attachments && gradingSub.attachments.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: "var(--muted-foreground)", display: 'block', marginBottom: 6 }}>
                        SUBMITTED ATTACHMENTS ({gradingSub.attachments.length})
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {gradingSub.attachments.map((att) => {
                          const isPreviewable = isPreviewableFile(att.file_name, att.mime_type);
                          return (
                            <div
                              key={att.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderRadius: 4,
                                backgroundColor: "var(--card)",
                                border: "1px solid var(--border, var(--border))",
                                gap: 10
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 4,
                                  backgroundColor: "var(--card)",
                                  color: "var(--primary)",
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {getFileIcon(att.file_name, att.mime_type)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {att.file_name}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                                    {formatBytes(att.file_size)}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {isPreviewable && (
                                  <button
                                    type="button"
                                    onClick={() => openSubAttachmentPreview(submissionsAsg.id, gradingSub.id, att.id, att.file_name, att.mime_type)}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: 4,
                                      border: "1px solid var(--border)",
                                      backgroundColor: "var(--card)",
                                      color: "var(--primary)",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4
                                    }}
                                  >
                                    <Eye size={13} /> Preview
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => downloadSubAttachment(submissionsAsg.id, gradingSub.id, att.id, att.file_name)}
                                  style={{
                                    padding: '5px 12px',
                                    borderRadius: 4,
                                    border: 'none',
                                    backgroundColor: "var(--primary)",
                                    color: "var(--background)",
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
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {submissionsAsg.is_owner ? (
                    <form onSubmit={handleGradeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: '0 0 140px' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                          Score (Max {submissionsAsg.max_marks || 100})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={submissionsAsg.max_marks || 100}
                          value={gradeScore}
                          onChange={(e) => setGradeScore(Number(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 4,
                            border: "1px solid var(--border, var(--border))",
                            background: "var(--bg, var(--card))",
                            color: "var(--text, var(--foreground))",
                            fontSize: 13
                          }}
                          required
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                          Teacher Feedback
                        </label>
                        <input
                          type="text"
                          placeholder="Optional feedback for student..."
                          value={gradeFeedback}
                          onChange={(e) => setGradeFeedback(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 4,
                            border: "1px solid var(--border, var(--border))",
                            background: "var(--bg, var(--card))",
                            color: "var(--text, var(--foreground))",
                            fontSize: 13
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setGradingSub(null)}
                        style={{ padding: '6px 12px', borderRadius: 4, border: "1px solid var(--border)", background: 'transparent', cursor: 'pointer', fontSize: 12 }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingGrade}
                        style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: "var(--success)", color: "var(--background)", fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                      >
                        {savingGrade ? 'Saving...' : 'Save Grade'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 4, background: "var(--card)", border: "1px solid var(--border)", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                      Read-only: Only the assignment author ({submissionsAsg.teacher_name || 'Author'}) can submit or modify grades.
                    </span>
                    <button
                      type="button"
                      onClick={() => setGradingSub(null)}
                      style={{ padding: '6px 12px', borderRadius: 4, border: "1px solid var(--border)", background: "var(--card)", cursor: 'pointer', fontSize: 12 }}
                    >
                      Close
                    </button>
                  </div>
                )}
                </div>
              )}
            </div>

            <div className="as-assignment-modal-footer" style={{ padding: '12px 20px', borderTop: "1px solid var(--border, var(--border))", background: "var(--card-subtle, var(--card))", display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSubmissionsAsg(null)}
                style={{ padding: '8px 16px', borderRadius: 4, border: "1px solid var(--border, var(--border))", background: "var(--bg, var(--card))", color: "var(--text, var(--foreground))", cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
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

export default TeacherAssignments;
