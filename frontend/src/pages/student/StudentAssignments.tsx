import React, { useState, useEffect } from 'react';
import {
  FileCheck, ArrowLeft, Send, CheckCircle2, Clock, Paperclip,
  Upload, X, Download, Eye, FileText, AlertCircle, Loader2, Search
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
  assignmentId: string;
  attachmentId: string;
  loading: boolean;
  error: string | null;
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const newFiles = Array.from(e.target.files);
    if (selectedFiles.length + newFiles.length > MAX_FILE_COUNT) {
      setFileError(`You can attach a maximum of ${MAX_FILE_COUNT} files.`);
      return;
    }

    let currentTotalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

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
        setFileError(`Total attachment size exceeds the 25MB limit.`);
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

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal) return;
    if (!submissionText.trim() && selectedFiles.length === 0) {
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

      await studentApi.submitAssignment(activeModal.id, submissionText, attachmentsPayload);
      setFeedbackMsg('Assignment submitted successfully!');
      setActiveModal(null);
      setSubmissionText('');
      setSelectedFiles([]);
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
                  {a.submission_status}
                </span>
              </div>
              <h3 className="assignment-title">{a.title}</h3>
              <p className="assignment-desc">{a.description}</p>

              <div className="assignment-meta-row">
                <div className="meta-item">
                  <Clock size={14} />
                  <span>Due: {a.due_date}</span>
                </div>
                <div className="meta-item">
                  <span>Max Marks: {a.max_marks}</span>
                </div>
              </div>

              {/* Submitted Information Box */}
              {a.submission_status !== 'PENDING' && (
                <div className="student-submission-info-box">
                  <div className="submission-header" style={{ fontWeight: 600, color: 'var(--text, #334155)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} color="#16a34a" /> Your Submission:
                  </div>
                  {a.submission_text ? (
                    <p style={{ margin: '0 0 8px', color: 'var(--text-secondary, #475569)', whiteSpace: 'pre-wrap', fontSize: 12.5 }}>
                      {a.submission_text}
                    </p>
                  ) : null}

                  {/* Attachments List */}
                  {a.attachments && a.attachments.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                        Attachments ({a.attachments.length}):
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                        {a.attachments.map((att) => {
                          const isPreviewable =
                            att.mime_type.startsWith('image/') ||
                            att.mime_type === 'application/pdf' ||
                            att.file_name.endsWith('.pdf') ||
                            att.file_name.endsWith('.png') ||
                            att.file_name.endsWith('.jpg') ||
                            att.file_name.endsWith('.jpeg');

                          return (
                            <div
                              key={att.id}
                              className="student-attachment-card-item"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                                <Paperclip size={13} color="var(--text-muted, #64748b)" />
                                <span title={att.file_name} className="file-name" style={{ fontWeight: 500, color: 'var(--text, #1e293b)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {att.file_name}
                                </span>
                                <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 11 }}>
                                  ({formatBytes(att.file_size)})
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {isPreviewable && (
                                  <button
                                    type="button"
                                    onClick={() => openPreview(a.id, att)}
                                    className="student-attachment-preview-btn"
                                  >
                                    <Eye size={12} /> Preview
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDownload(a.id, att)}
                                  className="student-attachment-download-btn"
                                >
                                  <Download size={12} /> Download
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

              <div className="assignment-card-actions">
                {a.submission_status === 'PENDING' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(a);
                      setSubmissionText('');
                      setSelectedFiles([]);
                      setFileError(null);
                    }}
                    className="student-btn-primary"
                  >
                    Submit Work
                  </button>
                ) : (
                  <span className="assignment-submitted-notice">
                    <CheckCircle2 size={14} /> Submitted
                  </span>
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
              <h3>Submit: {activeModal.title}</h3>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedFiles([]);
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

              {/* Attachments Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Attachments (Max 5 files, 10MB each, 25MB total):
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {selectedFiles.length} / {MAX_FILE_COUNT} files
                  </span>
                </div>

                <div
                  className="student-file-dropzone"
                  onClick={() => document.getElementById('assignment-file-input')?.click()}
                >
                  <input
                    id="assignment-file-input"
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.pdf,.xlsx,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    disabled={selectedFiles.length >= MAX_FILE_COUNT}
                  />
                  <Upload size={22} color="var(--text-muted, #64748b)" style={{ margin: '0 auto 6px' }} />
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)' }}>
                    Click to select files
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                    PDF, PNG, JPG, XLSX, DOC, DOCX up to 10MB each
                  </p>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {selectedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="student-selected-file-item"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <FileText size={14} color="#3b82f6" />
                          <span style={{ fontWeight: 500, color: 'var(--text, #1e293b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.name}
                          </span>
                          <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 11 }}>
                            ({formatBytes(f.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            padding: 2
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-buttons" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedFiles([]);
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
                      <Send size={14} /> Submit Assignment
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
                  onClick={() =>
                    studentApi.downloadAttachment(
                      previewState.assignmentId,
                      previewState.attachmentId,
                      previewState.fileName
                    )
                  }
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
                    onClick={() =>
                      studentApi.downloadAttachment(
                        previewState.assignmentId,
                        previewState.attachmentId,
                        previewState.fileName
                      )
                    }
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
