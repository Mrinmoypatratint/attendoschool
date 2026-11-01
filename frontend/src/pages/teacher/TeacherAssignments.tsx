import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen, Plus, FileText, CheckCircle2, Clock, AlertTriangle, AlertCircle,
  Loader2, RefreshCw, Send, Eye, X, Award, Search, Paperclip, Download, Upload,
  Maximize2, Minimize2, Edit, Trash2, Calendar, Check, FileCheck
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

export function TeacherAssignments() {
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
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

  // 1. Load Published Assignments
  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/teacher/assignments?scope=all');
      setAssignments(Array.isArray(res.data) ? res.data : []);
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
            const lbl = row.class_label || (num === -1 ? 'L-KG' : num === 0 ? 'U-KG' : `Class ${num}`);
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
        const lbl = c.label || c.name || (num === -1 ? 'L-KG' : num === 0 ? 'U-KG' : `Class ${num}`);
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

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesSearch =
        searchQuery === '' ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.section_name && a.section_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesClass = filterClass === '' || a.class_id === filterClass;
      return matchesSearch && matchesClass;
    });
  }, [assignments, searchQuery, filterClass]);

  return (
    <div style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '0 0 40px 0', fontFamily: 'inherit' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
            Assignment Management
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted, #64748b)' }}>
            Create and publish assignments across any class or section, manage existing tasks, and review submissions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={loadAssignments}
            title="Refresh assignments"
            style={{
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--card, #ffffff)',
              color: 'var(--text, #1e293b)',
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
              borderRadius: 8,
              border: 'none',
              background: '#4f46e5',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
            }}
          >
            <Plus size={16} /> Create Assignment
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="panel"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          padding: 16,
          borderRadius: 10,
          background: 'var(--panel, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          marginBottom: 20
        }}
      >
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted, #94a3b8)' }} />
          <input
            type="text"
            placeholder="Search assignments by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: 8,
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--card, #ffffff)',
              color: 'var(--text, #0f172a)',
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
              borderRadius: 8,
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--card, #ffffff)',
              color: 'var(--text, #0f172a)',
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
        className="panel"
        style={{
          borderRadius: 12,
          background: 'var(--panel, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
            Published Assignments ({filteredAssignments.length})
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
            <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px', color: '#4f46e5' }} />
            <p style={{ margin: 0, fontSize: 14 }}>Loading published assignments...</p>
          </div>
        ) : error ? (
          <div style={{ padding: 36, textAlign: 'center', color: '#dc2626' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: '0 0 12px', fontSize: 14 }}>{error}</p>
            <button
              type="button"
              onClick={loadAssignments}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #dc2626',
                background: '#fee2e2',
                color: '#b91c1c',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
            <BookOpen size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--text, #1e293b)' }}>No Assignments Found</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14 }}>Create and publish your first assignment to get started.</p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <Plus size={14} style={{ display: 'inline', marginRight: 6 }} /> Create Assignment
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--card-subtle, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Assignment Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Class & Section</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Assigned Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Due Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textAlign: 'center' }}>Attachments</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Published On</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((asg) => {
                  const attCount = asg.attachment_count ?? (Array.isArray(asg.attachments) ? asg.attachments.length : (asg.document_name ? 1 : 0));
                  const classDisplay = asg.class_number !== undefined
                    ? (asg.class_number === -1 ? 'L-KG' : asg.class_number === 0 ? 'U-KG' : `Class ${asg.class_number}`)
                    : 'Class';
                  const sectionDisplay = asg.section_name ? `Sec ${asg.section_name}` : 'All Sections';
                  const pubDate = asg.created_at ? new Date(asg.created_at).toLocaleDateString() : 'N/A';

                  return (
                    <tr
                      key={asg.id}
                      style={{ borderBottom: '1px solid var(--border, #f1f5f9)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-subtle, #f8fafc)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text, #0f172a)', marginBottom: 2 }}>{asg.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {asg.description}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, background: '#e0e7ff', color: '#4338ca', fontSize: 12, fontWeight: 600 }}>
                          {classDisplay} • {sectionDisplay}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text, #334155)', whiteSpace: 'nowrap' }}>
                        <Calendar size={13} style={{ display: 'inline', marginRight: 4, color: '#64748b' }} />
                        {asg.assigned_date || (asg.created_at ? asg.created_at.slice(0, 10) : 'N/A')}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text, #334155)', whiteSpace: 'nowrap' }}>
                        <Clock size={13} style={{ display: 'inline', marginRight: 4, color: '#d97706' }} />
                        <span style={{ fontWeight: 600 }}>{asg.due_date}</span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {attCount > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', fontSize: 12, fontWeight: 600 }}>
                            <Paperclip size={12} /> {attCount}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary, #64748b)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {pubDate}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            title="View Assignment"
                            onClick={() => setViewAssignment(asg)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid var(--border, #cbd5e1)',
                              background: 'var(--card, #ffffff)',
                              color: 'var(--text, #1e293b)',
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

                          <button
                            type="button"
                            title="Edit Assignment"
                            onClick={() => handleOpenEdit(asg)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid var(--border, #cbd5e1)',
                              background: 'var(--card, #ffffff)',
                              color: '#0284c7',
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
                              borderRadius: 6,
                              border: '1px solid #fecaca',
                              background: '#fff1f2',
                              color: '#e11d48',
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

                          <button
                            type="button"
                            title="Review Submissions"
                            onClick={() => handleOpenSubmissions(asg)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid #c7d2fe',
                              background: '#eef2ff',
                              color: '#4338ca',
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
            background: 'rgba(15, 23, 42, 0.65)',
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
              background: 'var(--panel, #ffffff)',
              borderRadius: 14,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border, #cbd5e1)'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={20} style={{ color: '#4f46e5' }} />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text, #0f172a)' }}>Create Assignment</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsCreateMaximized(!isCreateMaximized)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
                >
                  {isCreateMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handlePublishAssignment} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: 20, gap: 16 }}>
              {createError && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} />
                  <span>{createError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                  Assignment Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 4 Practice Questions"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #cbd5e1)',
                    background: 'var(--card, #ffffff)',
                    color: 'var(--text, #0f172a)',
                    fontSize: 14
                  }}
                  required
                />
              </div>

              {/* Target Class and Section */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                    Select Class <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={createForm.class_id}
                    onChange={(e) => setCreateForm({ ...createForm, class_id: e.target.value, section_id: '' })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      background: 'var(--card, #ffffff)',
                      color: 'var(--text, #0f172a)',
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
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                    Select Section
                  </label>
                  <select
                    value={createForm.section_id}
                    onChange={(e) => setCreateForm({ ...createForm, section_id: e.target.value })}
                    disabled={!createForm.class_id}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      background: createForm.class_id ? 'var(--card, #ffffff)' : 'var(--card-subtle, #f1f5f9)',
                      color: 'var(--text, #0f172a)',
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
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                    Assigned Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={createForm.assigned_date}
                    onChange={(e) => setCreateForm({ ...createForm, assigned_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      background: 'var(--card, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      fontSize: 14
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                    Submission Deadline (Due Date) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={createForm.due_date}
                    onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      background: 'var(--card, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      fontSize: 14
                    }}
                    required
                  />
                </div>
              </div>

              {/* Detailed Instructions / Description */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
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
                    borderRadius: 8,
                    border: '1px solid var(--border, #cbd5e1)',
                    background: 'var(--card, #ffffff)',
                    color: 'var(--text, #0f172a)',
                    fontSize: 14,
                    lineHeight: 1.5
                  }}
                />
              </div>

              {/* Upload Multiple Attachments */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 4 }}>
                  Attachments (PDF, JPG, PNG, DOCX, XLSX)
                </label>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                  Upload up to 5 files. Max 10MB per file, 25MB total.
                </p>

                <div
                  style={{
                    border: '2px dashed var(--border, #cbd5e1)',
                    borderRadius: 8,
                    padding: '16px 20px',
                    textAlign: 'center',
                    background: 'var(--card-subtle, #f8fafc)',
                    cursor: 'pointer'
                  }}
                  onClick={() => document.getElementById('create-file-input')?.click()}
                >
                  <Upload size={24} style={{ color: '#6366f1', margin: '0 auto 8px' }} />
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)' }}>
                    Click to select files or browse
                  </p>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Supports PDF, JPG, PNG, DOC, DOCX</span>
                  <input
                    id="create-file-input"
                    type="file"
                    multiple
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
                </div>

                {/* Pre-Publish Attachment List */}
                {createFiles.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {createFiles.map((fileItem, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: 'var(--card, #ffffff)',
                          border: '1px solid var(--border, #e2e8f0)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          <Paperclip size={14} style={{ color: '#4f46e5', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fileItem.name}
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>
                            ({formatBytes(fileItem.size)})
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {(fileItem.mimeType.startsWith('image/') || fileItem.mimeType === 'application/pdf') && (
                            <button
                              type="button"
                              onClick={() => openPreview(fileItem.name, fileItem.mimeType, fileItem.blobUrl)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 4,
                                border: '1px solid var(--border, #cbd5e1)',
                                background: 'transparent',
                                color: '#0284c7',
                                fontSize: 12,
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
                              padding: '4px 6px',
                              borderRadius: 4,
                              border: 'none',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              fontSize: 12,
                              cursor: 'pointer'
                            }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTop: '1px solid var(--border, #e2e8f0)' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #cbd5e1)',
                    background: 'transparent',
                    color: 'var(--text, #334155)',
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
                    borderRadius: 8,
                    border: 'none',
                    background: '#4f46e5',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 2px 4px rgba(79,70,229,0.3)'
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
            background: 'rgba(15, 23, 42, 0.65)',
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
              background: 'var(--panel, #ffffff)',
              borderRadius: 14,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border, #cbd5e1)'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={20} style={{ color: '#0284c7' }} />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text, #0f172a)' }}>Assignment Details</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewAssignment(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#e0e7ff', color: '#4338ca', display: 'inline-block', marginBottom: 8 }}>
                  Class {viewAssignment.class_number ?? ''} {viewAssignment.section_name ? `• Section ${viewAssignment.section_name}` : '• All Sections'}
                </span>
                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                  {viewAssignment.title}
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, padding: 12, borderRadius: 8, background: 'var(--card-subtle, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', fontSize: 13 }}>
                <div>
                  <span style={{ display: 'block', color: '#64748b', fontSize: 11, fontWeight: 600 }}>ASSIGNED DATE</span>
                  <span style={{ fontWeight: 600, color: 'var(--text, #1e293b)' }}>
                    {viewAssignment.assigned_date || (viewAssignment.created_at ? viewAssignment.created_at.slice(0, 10) : 'N/A')}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', color: '#64748b', fontSize: 11, fontWeight: 600 }}>DUE DATE</span>
                  <span style={{ fontWeight: 600, color: '#d97706' }}>
                    {viewAssignment.due_date}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', color: '#64748b', fontSize: 11, fontWeight: 600 }}>PUBLISHED ON</span>
                  <span style={{ fontWeight: 600, color: 'var(--text, #1e293b)' }}>
                    {viewAssignment.created_at ? new Date(viewAssignment.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', color: '#64748b', fontSize: 11, fontWeight: 600 }}>MAX MARKS</span>
                  <span style={{ fontWeight: 600, color: 'var(--text, #1e293b)' }}>
                    {viewAssignment.max_marks || 100}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #64748b)', marginBottom: 6 }}>
                  INSTRUCTIONS
                </label>
                <div style={{ padding: 14, borderRadius: 8, background: 'var(--card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14, color: 'var(--text, #1e293b)' }}>
                  {viewAssignment.description || 'No instructions provided.'}
                </div>
              </div>

              {/* Attachments List */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #64748b)', marginBottom: 6 }}>
                  ATTACHMENTS ({Array.isArray(viewAssignment.attachments) ? viewAssignment.attachments.length : (viewAssignment.document_name ? 1 : 0)})
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
                    ).map((att, idx) => (
                      <div
                        key={att.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: 'var(--card, #ffffff)',
                          border: '1px solid var(--border, #e2e8f0)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          <Paperclip size={16} style={{ color: '#0284c7', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #0f172a)' }}>
                            {att.file_name}
                          </span>
                          {att.file_size ? (
                            <span style={{ fontSize: 11, color: '#64748b' }}>({formatBytes(att.file_size)})</span>
                          ) : null}
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => openPreview(att.file_name, att.mime_type, null, viewAssignment.id, att.id)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid var(--border, #cbd5e1)',
                              background: 'transparent',
                              color: '#0284c7',
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Eye size={13} /> Preview Attachment
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadAttachment(viewAssignment.id, att.file_name, att.id)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid var(--border, #cbd5e1)',
                              background: 'transparent',
                              color: 'var(--text, #334155)',
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Download size={13} /> Download Attachment
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', margin: 0 }}>
                    No attachments uploaded.
                  </p>
                )}
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setViewAssignment(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'var(--card-subtle, #f8fafc)',
                  color: 'var(--text, #1e293b)',
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
            background: 'rgba(15, 23, 42, 0.65)',
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
              background: 'var(--panel, #ffffff)',
              borderRadius: 14,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border, #cbd5e1)'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit size={20} style={{ color: '#0284c7' }} />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text, #0f172a)' }}>Edit Assignment</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditAssignment(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: 20, gap: 16 }}>
              {editError && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} />
                  <span>{editError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                  Assignment Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #cbd5e1)',
                    background: 'var(--card, #ffffff)',
                    color: 'var(--text, #0f172a)',
                    fontSize: 14
                  }}
                  required
                />
              </div>

              {/* Target Class and Section */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                    Select Class <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={editForm.class_id}
                    onChange={(e) => setEditForm({ ...editForm, class_id: e.target.value, section_id: '' })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      background: 'var(--card, #ffffff)',
                      color: 'var(--text, #0f172a)',
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
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                    Select Section
                  </label>
                  <select
                    value={editForm.section_id}
                    onChange={(e) => setEditForm({ ...editForm, section_id: e.target.value })}
                    disabled={!editForm.class_id}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      background: editForm.class_id ? 'var(--card, #ffffff)' : 'var(--card-subtle, #f1f5f9)',
                      color: 'var(--text, #0f172a)',
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
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                    Assigned Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={editForm.assigned_date}
                    onChange={(e) => setEditForm({ ...editForm, assigned_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      background: 'var(--card, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      fontSize: 14
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                    Submission Deadline (Due Date) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      background: 'var(--card, #ffffff)',
                      color: 'var(--text, #0f172a)',
                      fontSize: 14
                    }}
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                  Description / Instructions
                </label>
                <AutoExpandingTextarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  minHeight={80}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #cbd5e1)',
                    background: 'var(--card, #ffffff)',
                    color: 'var(--text, #0f172a)',
                    fontSize: 14,
                    lineHeight: 1.5
                  }}
                />
              </div>

              {/* Existing Attachments */}
              {editExistingAtts.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 6 }}>
                    Current Attachments
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {editExistingAtts.map((att) => {
                      const isMarked = editRemovedIds.includes(att.id || '');
                      return (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: isMarked ? '#fee2e2' : 'var(--card-subtle, #f8fafc)',
                            border: `1px solid ${isMarked ? '#fca5a5' : 'var(--border, #e2e8f0)'}`,
                            opacity: isMarked ? 0.6 : 1
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                            <Paperclip size={14} style={{ color: '#0284c7' }} />
                            <span style={{ fontSize: 13, textDecoration: isMarked ? 'line-through' : 'none', color: isMarked ? '#991b1b' : 'var(--text, #0f172a)' }}>
                              {att.file_name}
                            </span>
                            {att.file_size ? <span style={{ fontSize: 11, color: '#64748b' }}>({formatBytes(att.file_size)})</span> : null}
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            {isMarked ? (
                              <button
                                type="button"
                                onClick={() => setEditRemovedIds((prev) => prev.filter((id) => id !== att.id))}
                                style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: '#e0e7ff', color: '#4338ca', fontSize: 12, cursor: 'pointer' }}
                              >
                                Undo
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditRemovedIds((prev) => [...prev, att.id || ''])}
                                style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: '#fee2e2', color: '#b91c1c', fontSize: 12, cursor: 'pointer' }}
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
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 4 }}>
                  Add New Attachments
                </label>
                <div
                  style={{
                    border: '2px dashed var(--border, #cbd5e1)',
                    borderRadius: 8,
                    padding: '14px 20px',
                    textAlign: 'center',
                    background: 'var(--card-subtle, #f8fafc)',
                    cursor: 'pointer'
                  }}
                  onClick={() => document.getElementById('edit-file-input')?.click()}
                >
                  <Upload size={20} style={{ color: '#6366f1', margin: '0 auto 6px' }} />
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)' }}>
                    Select new files to attach
                  </p>
                  <input
                    id="edit-file-input"
                    type="file"
                    multiple
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
                </div>

                {editNewFiles.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {editNewFiles.map((fileItem, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: 'var(--card, #ffffff)',
                          border: '1px solid var(--border, #e2e8f0)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Paperclip size={13} style={{ color: '#16a34a' }} />
                          <span style={{ fontSize: 13, color: 'var(--text, #0f172a)' }}>{fileItem.name}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>({formatBytes(fileItem.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (fileItem.blobUrl) URL.revokeObjectURL(fileItem.blobUrl);
                            setEditNewFiles((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#b91c1c' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTop: '1px solid var(--border, #e2e8f0)' }}>
                <button
                  type="button"
                  onClick={() => setEditAssignment(null)}
                  disabled={savingEdit}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #cbd5e1)',
                    background: 'transparent',
                    color: 'var(--text, #334155)',
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
                    borderRadius: 8,
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
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
            background: 'rgba(15, 23, 42, 0.65)',
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
              background: 'var(--panel, #ffffff)',
              borderRadius: 14,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              padding: 24,
              border: '1px solid var(--border, #cbd5e1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 10, borderRadius: '50%', background: '#fee2e2', color: '#b91c1c' }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                Delete Assignment
              </h3>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text, #334155)', lineHeight: 1.5 }}>
              Are you sure you want to delete <b>{deleteTarget.title}</b>?
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#b91c1c', lineHeight: 1.4 }}>
              This will permanently remove the assignment, all associated attachments from storage, and all student submissions. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'transparent',
                  color: 'var(--text, #334155)',
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
                  borderRadius: 8,
                  border: 'none',
                  background: '#e11d48',
                  color: '#ffffff',
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
            background: 'rgba(15, 23, 42, 0.75)',
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
              background: 'var(--panel, #ffffff)',
              borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border, #cbd5e1)'
            }}
          >
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <Eye size={18} style={{ color: '#0284c7' }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      background: 'var(--card-subtle, #f8fafc)',
                      color: 'var(--text, #1e293b)',
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
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewState.loading ? (
                <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
                  <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Loading preview securely...</p>
                </div>
              ) : previewState.error ? (
                <div style={{ textAlign: 'center', color: '#f87171', padding: 24 }}>
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
                <div style={{ textAlign: 'center', color: '#e2e8f0', padding: 32 }}>
                  <FileText size={48} style={{ color: '#94a3b8', margin: '0 auto 16px' }} />
                  <h4 style={{ margin: '0 0 8px', fontSize: 16 }}>Inline preview not supported for this format</h4>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#94a3b8' }}>
                    Document files (.doc, .docx, .xlsx) can be downloaded directly to view on your device.
                  </p>
                  {previewState.assignmentId && (
                    <button
                      type="button"
                      onClick={() => downloadAttachment(previewState.assignmentId!, previewState.fileName, previewState.attachmentId)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#0284c7',
                        color: '#ffffff',
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
            background: 'rgba(15, 23, 42, 0.65)',
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
              background: 'var(--panel, #ffffff)',
              borderRadius: 14,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border, #cbd5e1)'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                  Student Submissions: {submissionsAsg.title}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                  Due: {submissionsAsg.due_date} | Total Submissions: {submissions.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSubmissionsAsg(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {loadingSubs ? (
                <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  <Loader2 size={28} className="spin" style={{ margin: '0 auto 8px', color: '#4f46e5' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Loading student submissions...</p>
                </div>
              ) : submissions.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: 14 }}>No students have submitted work for this assignment yet.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--card-subtle, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                      <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Student</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Submitted At</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Status</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Score</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                        <td style={{ padding: '12px' }}>
                          <PersonProfileLink kind="student" id={sub.student_id} name={sub.student_name || 'Student'}>
                            <span style={{ fontWeight: 600, color: 'var(--text, #0f172a)' }}>{sub.student_name || 'Student'}</span>
                          </PersonProfileLink>
                          {sub.roll_number && (
                            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>
                              (Roll: {sub.roll_number})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary, #64748b)' }}>
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              background: sub.status === 'GRADED' ? '#dcfce7' : '#fef3c7',
                              color: sub.status === 'GRADED' ? '#15803d' : '#b45309'
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
                              borderRadius: 6,
                              border: '1px solid var(--border, #cbd5e1)',
                              background: 'var(--card, #ffffff)',
                              color: '#4f46e5',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {sub.status === 'GRADED' ? 'Edit Grade' : 'Grade'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Sub-form to Grade selected submission */}
              {gradingSub && (
                <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: 'var(--card-subtle, #f8fafc)', border: '1px solid var(--border, #cbd5e1)' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    Grade Submission: {gradingSub.student_name}
                  </h4>
                  {gradingSub.submission_text && (
                    <div style={{ marginBottom: 12, padding: 10, borderRadius: 6, background: '#ffffff', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>SUBMISSION TEXT:</span>
                      {gradingSub.submission_text}
                    </div>
                  )}

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
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
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
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: 13
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setGradingSub(null)}
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer', fontSize: 12 }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingGrade}
                        style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                      >
                        {savingGrade ? 'Saving...' : 'Save Grade'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSubmissionsAsg(null)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
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
