import React, { useState, useEffect } from 'react';
import {
  FileCheck, ArrowLeft, Send, CheckCircle2, Clock, Paperclip, Calendar,
  Upload, X, Download, Eye, FileText, AlertCircle, Loader2, Search, Edit3, RotateCcw,
  Image
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { studentApi, Assignment, AssignmentAttachment } from '../../services/studentApi';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';

interface UploadFileItem {
  file: File;
  base64: string;
  name: string;
  size: number;
}

interface PreviewState {
  title: string;
  blobUrl: string | null;
  mimeType: string;
  fileName: string;
  assignmentId?: string;
  attachmentId?: string;
  loading: boolean;
  error: string | null;
  isLocalFile?: boolean;
}

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf', '.xlsx', '.doc', '.docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILE_COUNT = 5;

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (fileName?: string, mimeType?: string) => {
  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return <FileText size={18} color="#dc2626" />;
  }
  if (
    lowerMime.startsWith('image/') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.gif')
  ) {
    return <Image size={18} color="#2563eb" />;
  }
  if (lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) {
    return <FileText size={18} color="#2563eb" />;
  }
  if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.csv')) {
    return <FileCheck size={18} color="#16a34a" />;
  }
  return <Paperclip size={18} color="#2563eb" />;
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

export function StudentAssignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'SUBMITTED'>('ALL');
  const [activeModal, setActiveModal] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<UploadFileItem[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  useEffect(() => {
    setSearchTerm(queryParam);
  }, [queryParam]);

  // Preview Modal State
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);

  const load = () => {
    setLoading(true);
    studentApi
      .getAssignments()
      .then((res) => {
        setAssignments(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenSubmitModal = (a: Assignment) => {
    setActiveModal(a);
    setSubmissionText(a.submission_text || '');
    setSelectedFiles([]);
    setRemovedAttachmentIds([]);
    setFileError(null);
  };

  const handleToggleRemoveExistingAttachment = (attId: string) => {
    setRemovedAttachmentIds((prev) =>
      prev.includes(attId) ? prev.filter((id) => id !== attId) : [...prev, attId]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const existingCount = (activeModal?.attachments || []).filter(
      (a) => !removedAttachmentIds.includes(a.id)
    ).length;
    const existingSize = (activeModal?.attachments || [])
      .filter((a) => !removedAttachmentIds.includes(a.id))
      .reduce((sum, a) => sum + (Number(a.file_size) || 0), 0);

    const newFiles = Array.from(e.target.files);
    if (existingCount + selectedFiles.length + newFiles.length > MAX_FILE_COUNT) {
      setFileError(`You can attach a maximum of ${MAX_FILE_COUNT} files cumulatively (currently has ${existingCount} active attached).`);
      return;
    }

    let currentTotalSize = existingSize + selectedFiles.reduce((acc, f) => acc + f.size, 0);

    for (const file of newFiles) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setFileError(`File "${file.name}" has an unsupported format. Allowed: PNG, JPG, PDF, XLSX, DOC, DOCX.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setFileError(`File "${file.name}" exceeds the 10MB per-file limit.`);
        return;
      }

      currentTotalSize += file.size;
      if (currentTotalSize > MAX_TOTAL_SIZE) {
        setFileError(`Total attachment size exceeds the 25MB cumulative limit.`);
        return;
      }
    }

    // Read files into Base64
    Promise.all(
      newFiles.map(
        (file) =>
          new Promise<UploadFileItem>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                file,
                base64: reader.result as string,
                name: file.name,
                size: file.size
              });
            };
            reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
            reader.readAsDataURL(file);
          })
      )
    )
      .then((readFiles) => {
        setSelectedFiles((prev) => [...prev, ...readFiles]);
      })
      .catch((err) => {
        setFileError(err.message || 'Error processing attachments.');
      });

    // Reset input
    e.target.value = '';
  };

  const openLocalFilePreview = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewState({
      title: file.name,
      blobUrl: url,
      mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
      fileName: file.name,
      assignmentId: activeModal?.id,
      attachmentId: 'local',
      loading: false,
      error: null,
      isLocalFile: true
    });
  };

  const handleRemoveFile = (index: number) => {
    const removed = selectedFiles[index];
    if (previewState && previewState.isLocalFile && previewState.fileName === removed?.name) {
      closePreview();
    }
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal) return;

    const remainingExisting = (activeModal.attachments || []).filter(
      (a) => !removedAttachmentIds.includes(a.id)
    );

    if (!submissionText.trim() && selectedFiles.length === 0 && remainingExisting.length === 0) {
      setFileError('Please provide either submission text or at least one file attachment.');
      return;
    }

    setSubmitting(true);
    setFileError(null);
    try {
      const attachmentsPayload = selectedFiles.map((f) => ({
        fileName: f.name,
        fileData: f.base64
      }));

      await studentApi.submitAssignment(
        activeModal.id,
        submissionText,
        attachmentsPayload,
        removedAttachmentIds
      );
      setFeedbackMsg(
        activeModal.submission_status === 'PENDING'
          ? 'Assignment submitted successfully!'
          : 'Assignment updated and resubmitted successfully!'
      );
      setActiveModal(null);
      setSubmissionText('');
      setSelectedFiles([]);
      setRemovedAttachmentIds([]);
      load();
    } catch (err: any) {
      setFileError(err?.response?.data?.message || 'Failed to submit assignment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openPreview = async (assignmentId: string, att: AssignmentAttachment) => {
    const isImageOrPdf =
      att.mime_type.startsWith('image/') ||
      att.mime_type === 'application/pdf' ||
      att.file_name.endsWith('.pdf') ||
      att.file_name.endsWith('.png') ||
      att.file_name.endsWith('.jpg') ||
      att.file_name.endsWith('.jpeg');

    setPreviewState({
      title: att.file_name,
      blobUrl: null,
      mimeType: att.mime_type,
      fileName: att.file_name,
      assignmentId,
      attachmentId: att.id,
      loading: true,
      error: null
    });

    try {
      const blob = await studentApi.previewAttachment(assignmentId, att.id);
      const url = URL.createObjectURL(blob);
      setPreviewState((prev) =>
        prev
          ? {
              ...prev,
              blobUrl: url,
              loading: false,
              mimeType: blob.type || att.mime_type
            }
          : null
      );
    } catch (err: any) {
      setPreviewState((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: err?.response?.data?.message || 'Unable to load preview.'
            }
          : null
      );
    }
  };

  const closePreview = () => {
    if (previewState?.blobUrl) {
      URL.revokeObjectURL(previewState.blobUrl);
    }
    setPreviewState(null);
  };

  const handleDownload = async (assignmentId: string, att: AssignmentAttachment) => {
    try {
      await studentApi.downloadAttachment(assignmentId, att.id, att.file_name);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to download attachment.');
    }
  };

  const openTeacherDocPreview = async (
    assignmentId: string,
    fileName: string,
    mimeType?: string,
    inlineData?: string,
    attachmentId?: string
  ) => {
    setPreviewState({
      title: fileName,
      blobUrl: null,
      mimeType: mimeType || 'application/pdf',
      fileName: fileName,
      assignmentId,
      attachmentId: attachmentId || 'doc',
      loading: true,
      error: null
    });

    try {
      let url: string;
      if (inlineData && inlineData.startsWith('data:')) {
        const res = await fetch(inlineData);
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
      } else {
        const blob = await studentApi.previewAssignmentDocument(assignmentId, attachmentId === 'doc' ? undefined : attachmentId);
        url = URL.createObjectURL(blob);
      }

      setPreviewState((prev) =>
        prev
          ? {
              ...prev,
              blobUrl: url,
              loading: false,
              mimeType: mimeType || 'application/pdf'
            }
          : null
      );
    } catch (err: any) {
      setPreviewState((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: err?.response?.data?.message || 'Unable to load document preview.'
            }
          : null
      );
    }
  };

  const handleTeacherDocDownload = async (
    assignmentId: string,
    fileName: string,
    inlineData?: string,
    attachmentId?: string
  ) => {
    try {
      if (inlineData && inlineData.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = inlineData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      await studentApi.downloadAssignmentDocument(assignmentId, fileName, attachmentId === 'doc' ? undefined : attachmentId);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to download assignment document.');
    }
  };

  const handlePreviewDownload = () => {
    if (!previewState) return;
    if (previewState.isLocalFile && previewState.blobUrl) {
      const link = document.createElement('a');
      link.href = previewState.blobUrl;
      link.download = previewState.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    if (previewState.assignmentId && (previewState.attachmentId === 'doc' || previewState.attachmentId?.startsWith('doc-'))) {
      handleTeacherDocDownload(
        previewState.assignmentId,
        previewState.fileName,
        undefined,
        previewState.attachmentId === 'doc' ? undefined : previewState.attachmentId
      );
    } else if (previewState.assignmentId && previewState.attachmentId) {
      studentApi.downloadAttachment(
        previewState.assignmentId,
        previewState.attachmentId,
        previewState.fileName
      );
    }
  };

  const filtered = assignments.filter((a) => {
    if (activeTab === 'PENDING' && a.submission_status !== 'PENDING') return false;
    if (activeTab === 'SUBMITTED' && a.submission_status === 'PENDING') return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return a.title.toLowerCase().includes(q) ||
        (a.subject_name && a.subject_name.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.teacher_name && a.teacher_name.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="student-subpage">
      <div className="student-subpage-header">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title">Homework & Assignments</h1>
          <p className="student-subpage-desc">
            Class assignments, submissions, and teacher evaluations.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div className="student-alert-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={16} />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* In-Page Search & Filter Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="student-inpage-search-bar">
          <Search size={15} color="var(--text-muted, #94a3b8)" />
          <input
            type="text"
            placeholder="Filter assignments by title, subject, or teacher..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
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
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSearchParams({});
              }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {searchTerm && (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Showing <b>{filtered.length}</b> of <b>{assignments.length}</b> assignments
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="student-tab-bar">
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
        >
          All ({assignments.length})
        </button>
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'PENDING' ? 'active' : ''}`}
          onClick={() => setActiveTab('PENDING')}
        >
          Pending ({assignments.filter((a) => a.submission_status === 'PENDING').length})
        </button>
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'SUBMITTED' ? 'active' : ''}`}
          onClick={() => setActiveTab('SUBMITTED')}
        >
          Submitted ({assignments.filter((a) => a.submission_status !== 'PENDING').length})
        </button>
      </div>

      {loading ? (
        <div className="student-loading-spinner">Loading assignments...</div>
      ) : filtered.length === 0 ? (
        <div className="student-empty-state">
          <p>No assignments found in this category.</p>
        </div>
      ) : (
        <div className="student-assignment-grid">
          {filtered.map((a) => (
            <div key={a.id} className="student-assignment-card">
              <div className="assignment-card-top">
                <span className="assignment-subject-badge">{a.subject_name}</span>
                <span className={`assignment-status-badge status-${a.submission_status.toLowerCase()}`}>
                  {a.submission_status === 'RESUBMITTED'
                    ? 'Resubmitted / Awaiting Review'
                    : a.submission_status === 'OVERDUE'
                    ? 'Overdue / Late'
                    : a.submission_status}
                </span>
              </div>
              <h3 className="assignment-title">{a.title}</h3>
              <p className="assignment-desc">{a.description}</p>

              <div className="assignment-meta-row" style={{ flexWrap: 'wrap', gap: 10 }}>
                {a.teacher_name && (
                  <div className="meta-item">
                    <span style={{ fontWeight: 600, color: 'var(--text, #1e293b)' }}>Teacher: {a.teacher_name}</span>
                  </div>
                )}
                <div className="meta-item">
                  <Calendar size={14} style={{ color: '#6366f1' }} />
                  <span>Assigned: {a.assigned_date || (a.created_at ? a.created_at.slice(0, 10) : 'Today')}</span>
                </div>
                <div className="meta-item">
                  <Clock size={14} />
                  <span>Due: {a.due_date}</span>
                </div>
                {a.submitted_at && (
                  <div className="meta-item">
                    <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                    <span>Submitted: {new Date(a.submitted_at).toLocaleDateString()} {new Date(a.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {a.updated_at && a.submitted_at && new Date(a.updated_at).getTime() - new Date(a.submitted_at).getTime() > 2000 && (
                  <div className="meta-item">
                    <Clock size={14} style={{ color: '#f59e0b' }} />
                    <span>Updated: {new Date(a.updated_at).toLocaleDateString()} {new Date(a.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                <div className="meta-item">
                  <span>Max Marks: {a.max_marks}</span>
                </div>
              </div>

              {/* Teacher's Attached Documents / Reference Material */}
              {((a.document_name) || (a.teacher_attachments && a.teacher_attachments.length > 0)) && (
                <div style={{ margin: '14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 11.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted, #64748b)',
                    marginBottom: 2
                  }}>
                    Attached Documents ({(a.teacher_attachments && a.teacher_attachments.length > 0) ? a.teacher_attachments.length : (a.document_name ? 1 : 0)})
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(a.teacher_attachments && a.teacher_attachments.length > 0
                      ? a.teacher_attachments
                      : [{
                          id: 'doc',
                          file_name: a.document_name || 'Assignment_Document.pdf',
                          file_size: a.document_size || 0,
                          mime_type: a.document_mime || 'application/pdf',
                          file_data: a.document_data
                        }]
                    ).map((doc, idx) => {
                      const isPreviewable = isPreviewableFile(doc.file_name, doc.mime_type);
                      return (
                        <div
                          key={doc.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: 8,
                            backgroundColor: 'var(--card-subtle, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            gap: 12,
                            flexWrap: 'wrap'
                          }}
                        >
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
                              {getFileIcon(doc.file_name, doc.mime_type)}
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
                                {doc.file_name}
                              </div>
                              {doc.file_size > 0 && (
                                <div style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>
                                  {formatBytes(doc.file_size)}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isPreviewable && (
                              <button
                                type="button"
                                onClick={() => openTeacherDocPreview(a.id, doc.file_name, doc.mime_type, doc.file_data, doc.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '7px 14px',
                                  borderRadius: 6,
                                  backgroundColor: '#eff6ff',
                                  color: '#2563eb',
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  border: '1px solid #bfdbfe',
                                  cursor: 'pointer'
                                }}
                              >
                                <Eye size={14} /> Preview
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleTeacherDocDownload(a.id, doc.file_name, doc.file_data, doc.id)}
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
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(37,99,235,0.2)'
                              }}
                            >
                              <Download size={14} /> Download Document
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Submitted Information Box */}
              {a.submission_status !== 'PENDING' && (
                <div className="student-submission-info-box">
                  <div className="submission-header" style={{ fontWeight: 600, color: 'var(--text, #334155)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={15} color="#16a34a" /> Your Submitted Work:
                  </div>
                  {a.submission_text ? (
                    <p style={{ margin: '0 0 10px', color: 'var(--text-secondary, #475569)', whiteSpace: 'pre-wrap', fontSize: 13 }}>
                      {a.submission_text}
                    </p>
                  ) : null}

                  {/* Submitted Attachments List */}
                  {a.attachments && a.attachments.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: 6 }}>
                        Submitted Attachments ({a.attachments.length})
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {a.attachments.map((att) => {
                          const isPreviewable = isPreviewableFile(att.file_name, att.mime_type);
                          return (
                            <div
                              key={att.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderRadius: 8,
                                backgroundColor: '#ffffff',
                                border: '1px solid var(--border, #cbd5e1)',
                                gap: 10,
                                flexWrap: 'wrap'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 6,
                                  backgroundColor: '#eff6ff',
                                  color: '#2563eb',
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
                                    fontSize: 13,
                                    color: 'var(--text, #0f172a)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {att.file_name}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                                    {formatBytes(att.file_size)}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {isPreviewable && (
                                  <button
                                    type="button"
                                    onClick={() => openPreview(a.id, att)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '5px 10px',
                                      borderRadius: 6,
                                      backgroundColor: '#eff6ff',
                                      color: '#2563eb',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      border: '1px solid #bfdbfe',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Eye size={12} /> Preview
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDownload(a.id, att)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '5px 12px',
                                    borderRadius: 6,
                                    backgroundColor: '#2563eb',
                                    color: '#ffffff',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(37,99,235,0.2)'
                                  }}
                                >
                                  <Download size={12} /> Download File
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {a.submission_status === 'GRADED' && (
                <div className="assignment-graded-box">
                  <b>Grade / Score:</b> {a.marks_obtained} / {a.max_marks}
                  {a.feedback && <p className="assignment-feedback">"{a.feedback}"</p>}
                </div>
              )}

              <div className="assignment-card-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {a.submission_status === 'PENDING' ? (
                  <button
                    type="button"
                    onClick={() => handleOpenSubmitModal(a)}
                    className="student-btn-primary"
                  >
                    Submit Work
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenSubmitModal(a)}
                      className="student-btn-primary"
                      style={{ background: '#4f46e5', borderColor: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Edit3 size={14} /> Edit / Resubmit Work
                    </button>
                    <span className="assignment-submitted-notice" style={{ margin: 0 }}>
                      <CheckCircle2 size={14} /> {a.submission_status === 'GRADED' ? 'Graded' : a.submission_status === 'RESUBMITTED' ? 'Awaiting Review' : 'Submitted'}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submission Modal */}
      {activeModal && (
        <div className="student-modal-overlay">
          <div className="student-modal" style={{ width: 'min(580px, 95%)' }}>
            <div className="student-modal-header">
              <h3>{activeModal.submission_status === 'PENDING' ? `Submit: ${activeModal.title}` : `Edit / Resubmit: ${activeModal.title}`}</h3>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedFiles([]);
                  setRemovedAttachmentIds([]);
                  setFileError(null);
                }}
                className="close-btn"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="student-modal-form">
              <p className="modal-sub">
                Subject: <b>{activeModal.subject_name}</b> &nbsp;|&nbsp; Due: {activeModal.due_date}
              </p>

              {/* Informational banner if editing a graded submission */}
              {activeModal.submission_status === 'GRADED' && (
                <div style={{ margin: '8px 0 12px', padding: '10px 12px', borderRadius: 6, background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', fontSize: 12.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 2 }}>
                    <AlertCircle size={15} />
                    <span>Graded Submission Notice</span>
                  </div>
                  <span>Your current score is <b>{activeModal.marks_obtained} / {activeModal.max_marks}</b>. Submitting updated work preserves your previous evaluation history while notifying your teacher that your solution has been updated for review.</span>
                </div>
              )}

              {/* Display Teacher Attached Document if available */}
              {/* Teacher's Reference Material / Attached Documents */}
              {((activeModal.document_name) || (activeModal.teacher_attachments && activeModal.teacher_attachments.length > 0)) && (
                <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 11.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted, #64748b)',
                    marginBottom: 2
                  }}>
                    Teacher's Reference Material / Attached Documents
                  </label>
                  {(activeModal.teacher_attachments && activeModal.teacher_attachments.length > 0
                    ? activeModal.teacher_attachments
                    : [{
                        id: 'doc',
                        file_name: activeModal.document_name || 'Assignment_Document.pdf',
                        file_size: activeModal.document_size || 0,
                        mime_type: activeModal.document_mime || 'application/pdf',
                        file_data: activeModal.document_data
                      }]
                  ).map((doc, idx) => {
                    const isPreviewable = isPreviewableFile(doc.file_name, doc.mime_type);
                    return (
                      <div
                        key={doc.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 8,
                          backgroundColor: 'var(--card-subtle, #f8fafc)',
                          border: '1px solid var(--border, #cbd5e1)',
                          gap: 10,
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {getFileIcon(doc.file_name, doc.mime_type)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.file_name}
                            </div>
                            {doc.file_size > 0 && <div style={{ fontSize: 11, color: '#64748b' }}>{formatBytes(doc.file_size)}</div>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isPreviewable && (
                            <button
                              type="button"
                              onClick={() => openTeacherDocPreview(activeModal.id, doc.file_name, doc.mime_type, doc.file_data, doc.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 10px',
                                borderRadius: 6,
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                fontSize: 12,
                                fontWeight: 600,
                                border: '1px solid #bfdbfe',
                                cursor: 'pointer'
                              }}
                            >
                              <Eye size={12} /> Preview
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleTeacherDocDownload(activeModal.id, doc.file_name, doc.file_data, doc.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 12px',
                              borderRadius: 6,
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              fontSize: 12,
                              fontWeight: 600,
                              border: 'none',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(37,99,235,0.2)'
                            }}
                          >
                            <Download size={12} /> Download Document
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {fileError && (
                <div className="student-alert-error" style={{ fontSize: 12.5 }}>
                  <AlertCircle size={15} />
                  <span>{fileError}</span>
                </div>
              )}

              <label>
                <span>Submission Notes / Solution Proof:</span>
                <AutoExpandingTextarea
                  placeholder="Enter your solution notes or explanation..."
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  minHeight={70}
                  maxHeight={250}
                  style={{ width: '100%' }}
                />
              </label>

              {/* Existing Submitted Attachments (When editing) */}
              {/* Existing Submitted Attachments (When editing) */}
              {activeModal.attachments && activeModal.attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #64748b)' }}>
                      Current Submitted Attachments:
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {activeModal.attachments.filter(a => !removedAttachmentIds.includes(a.id)).length} kept / {activeModal.attachments.length} total
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activeModal.attachments.map((att) => {
                      const isRemoved = removedAttachmentIds.includes(att.id);
                      const isPreviewable = isPreviewableFile(att.file_name, att.mime_type);
                      return (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: `1px solid ${isRemoved ? '#fca5a5' : 'var(--border, #cbd5e1)'}`,
                            background: isRemoved ? '#fef2f2' : 'var(--card-subtle, #f8fafc)',
                            opacity: isRemoved ? 0.65 : 1,
                            gap: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{
                              width: 30,
                              height: 30,
                              borderRadius: 4,
                              backgroundColor: isRemoved ? '#fecaca' : '#eff6ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {getFileIcon(att.file_name, att.mime_type)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  textDecoration: isRemoved ? 'line-through' : 'none',
                                  color: isRemoved ? '#991b1b' : 'var(--text, #1e293b)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {att.file_name}
                              </div>
                              <span style={{ color: '#94a3b8', fontSize: 11 }}>
                                {formatBytes(att.file_size)}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {!isRemoved && (
                              <>
                                {isPreviewable && (
                                  <button
                                    type="button"
                                    onClick={() => openPreview(activeModal.id, att)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      padding: '3px 8px',
                                      borderRadius: 4,
                                      border: '1px solid #bfdbfe',
                                      backgroundColor: '#eff6ff',
                                      color: '#2563eb',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Eye size={11} /> Preview
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDownload(activeModal.id, att)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    border: 'none',
                                    backgroundColor: '#2563eb',
                                    color: '#ffffff',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Download size={11} /> Download
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleRemoveExistingAttachment(att.id)}
                                  style={{
                                    border: '1px solid #fecaca',
                                    borderRadius: 4,
                                    background: '#fee2e2',
                                    color: '#dc2626',
                                    padding: '3px 8px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}
                                  title="Remove attachment on resubmission"
                                >
                                  <X size={12} /> Remove
                                </button>
                              </>
                            )}
                            {isRemoved && (
                              <button
                                type="button"
                                onClick={() => handleToggleRemoveExistingAttachment(att.id)}
                                style={{
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 4,
                                  background: '#f1f5f9',
                                  color: '#334155',
                                  padding: '3px 8px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                              >
                                <RotateCcw size={11} /> Undo Remove
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Attachments Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginBottom: 2 }}>
                  Attach Document / File
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
                    title="Attach files to your submission"
                  >
                    <Paperclip size={15} color="#2563eb" />
                    <span>{selectedFiles.length > 0 ? 'Attach More Files' : 'Attach Document / File'}</span>
                    <input
                      id="assignment-file-input"
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,.pdf,.xlsx,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                      disabled={((activeModal.attachments || []).filter(a => !removedAttachmentIds.includes(a.id)).length + selectedFiles.length) >= MAX_FILE_COUNT}
                    />
                  </label>
                  <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                    {((activeModal.attachments || []).filter(a => !removedAttachmentIds.includes(a.id)).length + selectedFiles.length)} / {MAX_FILE_COUNT} files (Max 10MB each, 25MB total)
                  </span>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {selectedFiles.map((f, idx) => {
                      const isPreviewable = isPreviewableFile(f.name, f.file.type);
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 6,
                            background: 'var(--card, #ffffff)',
                            border: '1px solid var(--border, #cbd5e1)',
                            gap: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              backgroundColor: '#eff6ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {getFileIcon(f.name, f.file.type)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text, #1e293b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.name}
                              </span>
                              <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 11, marginLeft: 6 }}>
                                ({formatBytes(f.size)})
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isPreviewable && (
                              <button
                                type="button"
                                onClick={() => openLocalFilePreview(f.file)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  border: '1px solid #bfdbfe',
                                  backgroundColor: '#eff6ff',
                                  color: '#2563eb',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                title="Preview file before submitting"
                              >
                                <Eye size={11} /> Preview
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(idx)}
                              style={{
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                color: '#ef4444',
                                padding: 2,
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Remove file"
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

              <div className="modal-buttons" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedFiles([]);
                    setRemovedAttachmentIds([]);
                    setFileError(null);
                  }}
                  className="student-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="student-btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> {activeModal.submission_status === 'PENDING' ? 'Submit Assignment' : 'Resubmit Work'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewState && (
        <div className="student-preview-modal-overlay">
          <div className="student-preview-modal">
            <div className="student-preview-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <Paperclip size={16} color="var(--text-muted, #64748b)" />
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text, #0f172a)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {previewState.fileName}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={handlePreviewDownload}
                  className="student-attachment-download-btn"
                  style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600 }}
                >
                  <Download size={13} /> Download
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted, #64748b)',
                    padding: 4
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="student-preview-modal-body">
              {previewState.loading ? (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Loading preview securely...</p>
                </div>
              ) : previewState.error ? (
                <div style={{ textAlign: 'center', color: '#ef4444', padding: 20 }}>
                  <AlertCircle size={32} style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>{previewState.error}</p>
                </div>
              ) : previewState.blobUrl && previewState.mimeType.startsWith('image/') ? (
                <img
                  src={previewState.blobUrl}
                  alt={previewState.fileName}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }}
                />
              ) : previewState.blobUrl && previewState.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewState.blobUrl}
                  title={previewState.fileName}
                  style={{ width: '100%', height: '100%', border: 'none', borderRadius: 4 }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 30, color: '#475569' }}>
                  <FileText size={48} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ margin: '0 0 6px', fontSize: 16 }}>Inline preview not supported for this file type</h4>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                    Word and Excel documents can be downloaded to view with your preferred software.
                  </p>
                  <button
                    type="button"
                    onClick={handlePreviewDownload}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Download size={14} /> Download Document
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

export default StudentAssignments;
