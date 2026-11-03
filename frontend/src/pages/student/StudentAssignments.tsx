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
    if (previewState.attachmentId === 'doc' || previewState.attachmentId.startsWith('doc-')) {
      handleTeacherDocDownload(
        previewState.assignmentId,
        previewState.fileName,
        undefined,
        previewState.attachmentId === 'doc' ? undefined : previewState.attachmentId
      );
    } else {
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
          <Link to="/student/dashboard" className="student-back-link inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 mb-1">Homework &amp; Assignments</h1>
          <p className="student-subpage-desc text-xs text-slate-500 dark:text-slate-400 m-0">
            Class assignments, submissions, and teacher evaluations.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div className="student-alert-success mb-4 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* In-Page Search & Filter Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="student-inpage-search-bar flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1 min-w-[240px]">
          <Search size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
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
            className="border-none outline-none bg-transparent text-xs w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSearchParams({});
              }}
              className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex p-0"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {searchTerm && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing <b className="text-slate-900 dark:text-slate-100">{filtered.length}</b> of <b className="text-slate-900 dark:text-slate-100">{assignments.length}</b> assignments
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="student-tab-bar flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-5">
        <button
          type="button"
          className={`student-tab-btn px-4 py-2 text-xs font-semibold rounded-t-md transition-colors cursor-pointer border-b-2 ${
            activeTab === 'ALL'
              ? 'active border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('ALL')}
        >
          All ({assignments.length})
        </button>
        <button
          type="button"
          className={`student-tab-btn px-4 py-2 text-xs font-semibold rounded-t-md transition-colors cursor-pointer border-b-2 ${
            activeTab === 'PENDING'
              ? 'active border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('PENDING')}
        >
          Pending ({assignments.filter((a) => a.submission_status === 'PENDING').length})
        </button>
        <button
          type="button"
          className={`student-tab-btn px-4 py-2 text-xs font-semibold rounded-t-md transition-colors cursor-pointer border-b-2 ${
            activeTab === 'SUBMITTED'
              ? 'active border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('SUBMITTED')}
        >
          Submitted ({assignments.filter((a) => a.submission_status !== 'PENDING').length})
        </button>
      </div>

      {loading ? (
        <div className="student-loading-spinner py-12 text-center text-slate-500 dark:text-slate-400 text-sm">Loading assignments...</div>
      ) : filtered.length === 0 ? (
        <div className="student-empty-state p-10 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm">
          <p className="m-0">No assignments found in this category.</p>
        </div>
      ) : (
        <div className="student-assignment-grid grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((a) => (
            <div key={a.id} className="student-assignment-card rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="assignment-card-top flex items-center justify-between mb-2">
                  <span className="assignment-subject-badge text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">{a.subject_name}</span>
                  <span className={`assignment-status-badge status-${a.submission_status.toLowerCase()} text-[11px] font-bold px-2 py-0.5 rounded ${
                    a.submission_status === 'PENDING'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                      : a.submission_status === 'GRADED'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  }`}>
                    {a.submission_status}
                  </span>
                </div>
                <h3 className="assignment-title text-base font-bold text-slate-900 dark:text-slate-100 mt-1 mb-1">{a.title}</h3>
                <p className="assignment-desc text-xs text-slate-600 dark:text-slate-400 mb-3">{a.description}</p>

                <div className="assignment-meta-row flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-3">
                  <div className="meta-item flex items-center gap-1">
                    <Clock size={14} />
                    <span>Due: {a.due_date}</span>
                  </div>
                  <div className="meta-item">
                    <span>Max Marks: {a.max_marks}</span>
                  </div>
                </div>

                {/* Teacher's Attached Document / Material Section */}
                {((a.document_name) || (a.teacher_attachments && a.teacher_attachments.length > 0)) && (
                  <div className="my-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                        <FileText size={14} className="text-sky-600 dark:text-sky-400" />
                        Assignment Document / Worksheet:
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Teacher Material
                      </span>
                    </div>

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
                      const isPreviewable =
                        (doc.mime_type && (doc.mime_type.startsWith('image/') || doc.mime_type === 'application/pdf')) ||
                        doc.file_name.endsWith('.pdf') ||
                        doc.file_name.endsWith('.png') ||
                        doc.file_name.endsWith('.jpg') ||
                        doc.file_name.endsWith('.jpeg');

                      return (
                        <div
                          key={doc.id || idx}
                          className="flex items-center justify-between p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 gap-2"
                        >
                          <div className="flex items-center gap-2 overflow-hidden max-w-[60%]">
                            <Paperclip size={13} className="text-sky-600 shrink-0" />
                            <span
                              title={doc.file_name}
                              className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate"
                            >
                              {doc.file_name}
                            </span>
                            {doc.file_size > 0 && (
                              <span className="text-[11px] text-slate-500 shrink-0">
                                ({formatBytes(doc.file_size)})
                              </span>
                            )}
                          </div>

                          <div className="flex gap-1.5 shrink-0">
                            {isPreviewable && (
                              <button
                                type="button"
                                onClick={() => openTeacherDocPreview(a.id, doc.file_name, doc.mime_type, doc.file_data, doc.id)}
                                className="student-attachment-preview-btn px-2 py-1 text-[11.5px] rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 cursor-pointer inline-flex items-center gap-1 transition-colors"
                              >
                                <Eye size={12} /> Preview
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleTeacherDocDownload(a.id, doc.file_name, doc.file_data, doc.id)}
                              className="student-attachment-download-btn px-2 py-1 text-[11.5px] rounded bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 cursor-pointer inline-flex items-center gap-1 transition-colors"
                            >
                              <Download size={12} /> Download
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Submitted Information Box */}
                {a.submission_status !== 'PENDING' && (
                  <div className="student-submission-info-box mt-3 p-3 rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                    <div className="submission-header font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5 text-xs">
                      <CheckCircle2 size={14} className="text-emerald-600" /> Your Submission:
                    </div>
                    {a.submission_text ? (
                      <p className="m-0 mb-2 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                        {a.submission_text}
                      </p>
                    ) : null}

                    {/* Attachments List */}
                    {a.attachments && a.attachments.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Attachments ({a.attachments.length}):
                        </span>
                        <div className="flex flex-col gap-1.5 mt-1.5">
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
                                className="student-attachment-card-item flex items-center justify-between p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                              >
                                <div className="flex items-center gap-1.5 overflow-hidden max-w-[65%]">
                                  <Paperclip size={13} className="text-slate-500 shrink-0" />
                                  <span title={att.file_name} className="file-name font-medium text-xs text-slate-800 dark:text-slate-200 truncate">
                                    {att.file_name}
                                  </span>
                                  <span className="text-slate-400 text-[11px] shrink-0">
                                    ({formatBytes(att.file_size)})
                                  </span>
                                </div>
                                <div className="flex gap-1.5">
                                  {isPreviewable && (
                                    <button
                                      type="button"
                                      onClick={() => openPreview(a.id, att)}
                                      className="student-attachment-preview-btn px-2 py-0.5 text-xs rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 cursor-pointer inline-flex items-center gap-1 transition-colors"
                                    >
                                      <Eye size={12} /> Preview
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDownload(a.id, att)}
                                    className="student-attachment-download-btn px-2 py-0.5 text-xs rounded bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 cursor-pointer inline-flex items-center gap-1 transition-colors"
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
                  <div className="assignment-graded-box mt-3 p-3 rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 text-xs text-purple-900 dark:text-purple-200">
                    <b>Grade / Score:</b> {a.marks_obtained} / {a.max_marks}
                    {a.feedback && <p className="assignment-feedback m-0 mt-1 italic text-slate-600 dark:text-slate-400">"{a.feedback}"</p>}
                  </div>
                )}
              </div>

              <div className="assignment-card-actions mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
                {a.submission_status === 'PENDING' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(a);
                      setSubmissionText('');
                      setSelectedFiles([]);
                      setFileError(null);
                    }}
                    className="student-btn-primary px-3.5 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors shadow-sm"
                  >
                    Submit Work
                  </button>
                ) : (
                  <span className="assignment-submitted-notice inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
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
        <div className="student-modal-overlay fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="student-modal bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-[580px] p-6 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
            <div className="student-modal-header flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-4">
              <h3 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">Submit: {activeModal.title}</h3>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedFiles([]);
                  setFileError(null);
                }}
                className="close-btn text-2xl leading-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer border-none bg-transparent"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="student-modal-form space-y-4">
              <p className="modal-sub m-0 text-xs text-slate-500 dark:text-slate-400">
                Subject: <b className="text-slate-700 dark:text-slate-300">{activeModal.subject_name}</b> &nbsp;|&nbsp; Due: {activeModal.due_date}
              </p>

              {/* Display Teacher Attached Document if available */}
              {(activeModal.document_name || (activeModal.teacher_attachments && activeModal.teacher_attachments.length > 0)) && (
                <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 flex flex-col gap-1.5 mb-2.5">
                  <span className="text-xs font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                    <FileText size={13} className="text-sky-600" />
                    Teacher's Reference Material / Questions:
                  </span>
                  {(activeModal.teacher_attachments && activeModal.teacher_attachments.length > 0
                    ? activeModal.teacher_attachments
                    : [{
                        id: 'doc',
                        file_name: activeModal.document_name || 'Assignment_Document.pdf',
                        file_size: activeModal.document_size || 0,
                        mime_type: activeModal.document_mime || 'application/pdf',
                        file_data: activeModal.document_data
                      }]
                  ).map((doc, idx) => (
                    <div
                      key={doc.id || idx}
                      className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden max-w-[65%]">
                        <Paperclip size={12} className="text-sky-600" />
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {doc.file_name}
                        </span>
                        {doc.file_size > 0 && <span className="text-slate-500">({formatBytes(doc.file_size)})</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => openTeacherDocPreview(activeModal.id, doc.file_name, doc.mime_type, doc.file_data, doc.id)}
                          className="student-attachment-preview-btn px-2 py-0.5 text-[11px] rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 cursor-pointer inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye size={11} /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTeacherDocDownload(activeModal.id, doc.file_name, doc.file_data, doc.id)}
                          className="student-attachment-download-btn px-2 py-0.5 text-[11px] rounded bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 cursor-pointer inline-flex items-center gap-1 transition-colors"
                        >
                          <Download size={11} /> Get File
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {fileError && (
                <div className="student-alert-error p-2.5 rounded bg-red-500/10 border border-red-500/25 text-red-500 text-xs flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{fileError}</span>
                </div>
              )}

              <label className="block">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Submission Notes / Solution Proof:</span>
                <AutoExpandingTextarea
                  placeholder="Enter your solution notes or explanation..."
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  minHeight={70}
                  maxHeight={250}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-sans outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>

              {/* Attachments Section */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Attachments (Max 5 files, 10MB each, 25MB total):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {selectedFiles.length} / {MAX_FILE_COUNT} files
                  </span>
                </div>

                <div
                  className="student-file-dropzone border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 rounded-lg p-5 text-center cursor-pointer bg-slate-50 dark:bg-slate-900/50 transition-colors"
                  onClick={() => document.getElementById('assignment-file-input')?.click()}
                >
                  <input
                    id="assignment-file-input"
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.pdf,.xlsx,.doc,.docx"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={selectedFiles.length >= MAX_FILE_COUNT}
                  />
                  <Upload size={22} className="text-slate-400 mx-auto mb-1.5" />
                  <p className="m-0 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Click to select files
                  </p>
                  <p className="m-0 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    PDF, PNG, JPG, XLSX, DOC, DOCX up to 10MB each
                  </p>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    {selectedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="student-selected-file-item flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <FileText size={14} className="text-blue-500 shrink-0" />
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {f.name}
                          </span>
                          <span className="text-slate-400 text-[11px] shrink-0">
                            ({formatBytes(f.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="border-none bg-transparent cursor-pointer text-red-500 hover:text-red-700 p-0.5"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-buttons flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedFiles([]);
                    setFileError(null);
                  }}
                  className="student-btn-secondary px-3.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="student-btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 cursor-pointer transition-colors shadow-sm"
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
        <div className="student-preview-modal-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="student-preview-modal bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="student-preview-modal-header flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 overflow-hidden">
                <Paperclip size={16} className="text-slate-400 shrink-0" />
                <h3 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {previewState.fileName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreviewDownload}
                  className="student-attachment-download-btn px-2.5 py-1.5 text-xs font-semibold rounded bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download size={13} /> Download
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="student-preview-modal-body flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-100/50 dark:bg-slate-900/50">
              {previewState.loading ? (
                <div className="text-center text-slate-500">
                  <Loader2 size={32} className="animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="m-0 text-sm">Loading preview securely...</p>
                </div>
              ) : previewState.error ? (
                <div className="text-center text-red-500 p-5">
                  <AlertCircle size={32} className="mx-auto mb-2" />
                  <p className="m-0 text-sm">{previewState.error}</p>
                </div>
              ) : previewState.blobUrl && previewState.mimeType.startsWith('image/') ? (
                <img
                  src={previewState.blobUrl}
                  alt={previewState.fileName}
                  className="max-w-full max-h-full object-contain rounded"
                />
              ) : previewState.blobUrl && previewState.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewState.blobUrl}
                  title={previewState.fileName}
                  className="w-full h-full border-none rounded"
                />
              ) : (
                <div className="text-center p-8 text-slate-600 dark:text-slate-400">
                  <FileText size={48} className="text-slate-400 mx-auto mb-3" />
                  <h4 className="m-0 mb-1.5 text-base font-bold text-slate-900 dark:text-slate-100">Inline preview not supported for this file type</h4>
                  <p className="m-0 mb-4 text-xs text-slate-500">
                    Word and Excel documents can be downloaded to view with your preferred software.
                  </p>
                  <button
                    type="button"
                    onClick={handlePreviewDownload}
                    className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-sm transition-colors"
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
