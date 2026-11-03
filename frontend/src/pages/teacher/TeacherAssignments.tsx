import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen, Plus, FileText, CheckCircle2, Clock, AlertTriangle, AlertCircle,
  Loader2, RefreshCw, Send, Eye, X, Award, Search, Paperclip, Download, Upload,
  Maximize2, Minimize2
} from 'lucide-react';
import { api } from '../../api';
import { PersonProfileLink } from '../../components/PersonProfileLink';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';

interface AssignmentRecord {
  id: string;
  school_id: string;
  class_id: string;
  section_id: string | null;
  subject_id: string;
  subject_name?: string;
  class_number?: number;
  section_name?: string;
  teacher_id: string;
  title: string;
  description: string;
  due_date: string;
  max_marks: number;
  submission_count?: number;
  created_at?: string;
  document_url?: string;
  document_name?: string;
  document_size?: number;
  document_mime?: string;
  document_data?: string;
  attachments?: Array<{
    id?: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    file_data?: string;
    storage_key?: string;
  }>;
}

interface UploadDocItem {
  file: File;
  base64: string;
  name: string;
  size: number;
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

interface EligibleOption {
  class_id: string;
  class_number: number;
  section_id: string;
  section_name: string;
  subject_id: string;
  subject_name: string;
}

export function TeacherAssignments() {
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');

  // Eligible Options State for Assignment Creation
  const [eligibleOptions, setEligibleOptions] = useState<EligibleOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Create Assignment Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    class_id: '',
    section_id: '',
    subject_id: '',
    title: '',
    description: '',
    due_date: '',
    max_marks: 100
  });
  const [creating, setCreating] = useState(false);
  const [createFeedback, setCreateFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadDocItem[]>([]);
  const [uploadDocError, setUploadDocError] = useState<string | null>(null);
  const [isCreateModalMaximized, setIsCreateModalMaximized] = useState(false);
  const [isSubmissionsMaximized, setIsSubmissionsMaximized] = useState(false);

  const handleTeacherFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadDocError(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const newFiles = Array.from(e.target.files);
    if (uploadedDocuments.length + newFiles.length > 5) {
      setUploadDocError('You can attach a maximum of 5 document files.');
      return;
    }

    const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.pdf', '.xlsx', '.doc', '.docx'];
    const MAX_SZ = 10 * 1024 * 1024; // 10MB

    for (const f of newFiles) {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        setUploadDocError(`File "${f.name}" has an unsupported format. Allowed: PDF, DOC, DOCX, XLSX, PNG, JPG.`);
        return;
      }
      if (f.size > MAX_SZ) {
        setUploadDocError(`File "${f.name}" exceeds the 10MB limit.`);
        return;
      }
    }

    Promise.all(
      newFiles.map(file => new Promise<UploadDocItem>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          file,
          base64: reader.result as string,
          name: file.name,
          size: file.size
        });
        reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
        reader.readAsDataURL(file);
      }))
    ).then(readFiles => {
      setUploadedDocuments(prev => [...prev, ...readFiles]);
    }).catch(err => {
      setUploadDocError(err.message || 'Error processing document attachment.');
    });

    e.target.value = '';
  };

  const handleRemoveDoc = (index: number) => {
    setUploadedDocuments(prev => prev.filter((_, i) => i !== index));
    setUploadDocError(null);
  };

  // Submissions & Grading Drawer State
  const [activeAssignment, setActiveAssignment] = useState<AssignmentRecord | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  // Active Grade Modal/Selection
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [gradeForm, setGradeForm] = useState({ marks_obtained: 0, feedback: '' });
  const [grading, setGrading] = useState(false);
  const [gradeFeedback, setGradeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Teacher Attachment Preview State
  const [teacherPreview, setTeacherPreview] = useState<{
    isOpen: boolean;
    fileName: string;
    blobUrl: string | null;
    mimeType: string;
    assignmentId: string;
    submissionId: string;
    attachmentId: string;
    loading: boolean;
    error: string | null;
  } | null>(null);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleTeacherPreview = async (assignmentId: string, submissionId: string, att: any) => {
    setTeacherPreview({
      isOpen: true,
      fileName: att.file_name,
      blobUrl: null,
      mimeType: att.mime_type,
      assignmentId,
      submissionId,
      attachmentId: att.id,
      loading: true,
      error: null
    });

    try {
      const res = await api.get(`/teacher/assignments/${assignmentId}/submissions/${submissionId}/attachments/${att.id}/preview`, {
        responseType: 'blob'
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      setTeacherPreview((prev) =>
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
      setTeacherPreview((prev) =>
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

  const handleTeacherDownload = async (assignmentId: string, submissionId: string, att: any) => {
    try {
      const res = await api.get(`/teacher/assignments/${assignmentId}/submissions/${submissionId}/attachments/${att.id}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: (res.headers['content-type'] as string) || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = att.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to download attachment.');
    }
  };

  const closeTeacherPreview = () => {
    if (teacherPreview?.blobUrl) {
      URL.revokeObjectURL(teacherPreview.blobUrl);
    }
    setTeacherPreview(null);
  };

  // 1. Fetch Teacher Assignments
  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/teacher/assignments');
      setAssignments(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to fetch assignments:', err);
      setError(err?.response?.data?.message || 'Unable to load teacher assignments.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Mentor-Authorized Eligible Options for Publishing
  const loadEligibleOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const res = await api.get('/teacher/assignments/eligible-options');
      const options: EligibleOption[] = Array.isArray(res.data) ? res.data : [];
      setEligibleOptions(options);

      if (options.length > 0) {
        setCreateForm(prev => ({
          ...prev,
          class_id: options[0].class_id,
          section_id: options[0].section_id,
          subject_id: options[0].subject_id
        }));
      } else {
        setCreateForm(prev => ({
          ...prev,
          class_id: '',
          section_id: '',
          subject_id: ''
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch eligible assignment publishing options:', err);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setCreateFeedback(null);
    loadEligibleOptions();
  };

  // 3. Derived Unique Class & Section Options
  const uniqueClassSections = useMemo(() => {
    const map = new Map<string, { class_id: string; class_number: number; section_id: string; section_name: string }>();
    eligibleOptions.forEach(opt => {
      const key = `${opt.class_id}:${opt.section_id}`;
      if (!map.has(key)) {
        map.set(key, {
          class_id: opt.class_id,
          class_number: opt.class_number,
          section_id: opt.section_id,
          section_name: opt.section_name
        });
      }
    });
    return Array.from(map.values());
  }, [eligibleOptions]);

  // 4. Available Subjects for currently selected Class & Section
  const availableSubjects = useMemo(() => {
    if (!createForm.class_id || !createForm.section_id) return [];
    return eligibleOptions.filter(
      opt => opt.class_id === createForm.class_id && opt.section_id === createForm.section_id
    );
  }, [eligibleOptions, createForm.class_id, createForm.section_id]);

  // 5. Handle Class & Section Selection Change
  const handleClassSectionChange = (val: string) => {
    if (!val) {
      setCreateForm(prev => ({ ...prev, class_id: '', section_id: '', subject_id: '' }));
      return;
    }
    const [cId, sId] = val.split(':');
    const subs = eligibleOptions.filter(opt => opt.class_id === cId && opt.section_id === sId);
    const nextSubId = subs.length > 0 ? subs[0].subject_id : '';

    setCreateForm(prev => ({
      ...prev,
      class_id: cId,
      section_id: sId,
      subject_id: nextSubId
    }));
  };

  // 6. Fetch Submissions for Selected Assignment
  const loadSubmissions = useCallback(async (assignmentId: string) => {
    setLoadingSubmissions(true);
    setSubmissionsError(null);
    try {
      const res = await api.get(`/teacher/assignments/${assignmentId}/submissions`);
      setSubmissions(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to load submissions:', err);
      setSubmissionsError(err?.response?.data?.message || 'Unable to load student submissions.');
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  const handleOpenSubmissions = (asg: AssignmentRecord) => {
    setActiveAssignment(asg);
    setSelectedSubmission(null);
    setGradeFeedback(null);
    loadSubmissions(asg.id);
  };

  // 7. Handle Create Assignment Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.class_id || !createForm.section_id || !createForm.subject_id || !createForm.title.trim() || !createForm.due_date) return;
    setCreating(true);
    setCreateFeedback(null);

    try {
      const payload = {
        ...createForm,
        attachments: uploadedDocuments.map(d => ({
          fileName: d.name,
          fileData: d.base64,
          size: d.size
        })),
        document_name: uploadedDocuments[0]?.name || null,
        document_data: uploadedDocuments[0]?.base64 || null,
        document_size: uploadedDocuments[0]?.size || null
      };

      const res = await api.post('/teacher/assignments', payload);
      setCreateFeedback({
        type: 'success',
        message: res.data?.message || 'Assignment published successfully!'
      });
      setCreateForm(prev => ({
        ...prev,
        title: '',
        description: '',
        due_date: '',
        max_marks: 100
      }));
      setUploadedDocuments([]);
      setUploadDocError(null);
      loadAssignments();
      setTimeout(() => setShowCreateModal(false), 1200);
    } catch (err: any) {
      setCreateFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to publish assignment.'
      });
    } finally {
      setCreating(false);
    }
  };

  // 8. Handle Grade Submission
  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment || !selectedSubmission) return;
    setGrading(true);
    setGradeFeedback(null);

    try {
      await api.put(`/teacher/assignments/${activeAssignment.id}/submissions/${selectedSubmission.id}/grade`, {
        marks_obtained: gradeForm.marks_obtained,
        feedback: gradeForm.feedback
      });

      setGradeFeedback({
        type: 'success',
        message: `Grade saved for ${selectedSubmission.student_name || 'Student'}!`
      });
      setSelectedSubmission(null);
      loadSubmissions(activeAssignment.id);
    } catch (err: any) {
      setGradeFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to submit grade.'
      });
    } finally {
      setGrading(false);
    }
  };

  // Filtered List
  const filteredAssignments = assignments.filter(a => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(term) ||
      (a.subject_name && a.subject_name.toLowerCase().includes(term)) ||
      (a.description && a.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="w-full pb-16">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold m-0 flex items-center gap-2.5 text-slate-900 dark:text-slate-100">
            <BookOpen size={28} className="text-blue-600" /> Teacher Assignments
          </h1>
          <p className="m-0 mt-1 text-slate-500 dark:text-slate-400 text-sm">
            Publish homework assignments, review student submissions, and grade work.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg border-none font-semibold cursor-pointer shadow-md shadow-blue-600/20 text-xs transition-colors"
        >
          <Plus size={18} /> Create Assignment
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="panel p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">TOTAL PUBLISHED</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{assignments.length}</div>
        </div>
        <div className="panel p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">SUBMISSIONS RECEIVED</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {assignments.reduce((acc, a) => acc + (a.submission_count || 0), 0)}
          </div>
        </div>
        <div className="panel p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">PUBLISHING ELIGIBILITY</div>
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1.5">
            <CheckCircle2 size={16} /> Server Scoped &amp; Authorized
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-5 flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search assignments by title or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 pl-9 pr-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={loadAssignments}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1.5 text-xs font-semibold shadow-xs transition-colors"
        >
          <RefreshCw size={14} className={`text-blue-600 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Assignment List */}
      {loading ? (
        <div className="panel p-12 text-center text-slate-400">
          <Loader2 size={28} className="animate-spin mx-auto mb-3 text-blue-600" />
          <p className="m-0 text-xs">Loading assignments...</p>
        </div>
      ) : error ? (
        <div className="panel p-6 text-red-500 text-center">
          <AlertCircle size={28} className="mx-auto mb-3" />
          <p className="m-0 text-xs font-semibold">{error}</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="panel p-10 text-center text-slate-500 dark:text-slate-400">
          <FileText size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <h3 className="m-0 mb-1 text-base font-bold text-slate-900 dark:text-slate-100">No Assignments Found</h3>
          <p className="m-0 text-xs text-slate-500">You haven't created any assignments yet or none match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssignments.map((asg) => (
            <div
              key={asg.id}
              className="panel p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {asg.subject_name || 'Subject'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Class {asg.class_number || '10'} {asg.section_name ? `- ${asg.section_name}` : ''}
                  </span>
                </div>
                <h3 className="m-0 mb-2 text-base font-bold text-slate-900 dark:text-slate-100">{asg.title}</h3>
                <p className="m-0 mb-4 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {asg.description}
                </p>

                <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-400 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock size={14} className="text-sky-600" />
                    <span>Due: <b>{asg.due_date}</b></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Award size={14} className="text-amber-600" />
                    <span>Max Marks: <b>{asg.max_marks}</b></span>
                  </div>
                </div>

                {/* Attached Document indicator */}
                {(asg.document_name || (asg.attachments && asg.attachments.length > 0)) && (
                  <div className="flex items-center gap-1.5 mb-3.5 px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 w-fit text-xs">
                    <Paperclip size={13} className="text-sky-600" />
                    <span className="font-semibold text-sky-800 dark:text-sky-300">
                      {asg.document_name || asg.attachments?.[0]?.file_name || 'Attached Document'}
                    </span>
                    {(asg.document_size || asg.attachments?.[0]?.file_size) && (
                      <span className="text-slate-400 text-[11px]">
                        ({formatBytes(asg.document_size || asg.attachments?.[0]?.file_size)})
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Submissions: <b className="text-slate-900 dark:text-slate-100">{asg.submission_count || 0}</b>
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenSubmissions(asg)}
                  className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                >
                  <Eye size={14} /> Review &amp; Grade
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <div
          className={`fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-[1000] transition-all ${
            isCreateModalMaximized ? 'p-2' : 'p-4'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !creating) {
              setShowCreateModal(false);
              setUploadedDocuments([]);
              setUploadDocError(null);
            }
          }}
        >
          <div
            className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden transition-all ${
              isCreateModalMaximized
                ? 'w-[97vw] max-w-6xl h-[94vh] rounded-lg'
                : 'w-full max-w-xl max-h-[min(92vh,750px)] rounded-xl'
            }`}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                  <BookOpen size={17} />
                </div>
                <h2 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
                  Publish New Assignment
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalMaximized(!isCreateModalMaximized)}
                  className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded px-2.5 py-1 cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1 text-xs font-semibold transition-colors"
                  title={isCreateModalMaximized ? 'Restore normal window size' : 'Maximize to full screen'}
                >
                  {isCreateModalMaximized ? (
                    <>
                      <Minimize2 size={14} />
                      <span>Restore</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 size={14} />
                      <span>Maximize</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setUploadedDocuments([]);
                    setUploadDocError(null);
                  }}
                  className="border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 p-1 flex items-center justify-center"
                  title="Close"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              {/* Scrollable Form Body - Guarantees everything fits smoothly on screen */}
              <div className="p-5 overflow-y-auto flex-1 min-h-0">
                {createFeedback && (
                  <div
                    className={`p-3 rounded-lg mb-3.5 text-xs font-medium flex items-center gap-2 ${
                      createFeedback.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25'
                        : 'bg-red-500/10 text-red-500 border border-red-500/25'
                    }`}
                  >
                    {createFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{createFeedback.message}</span>
                  </div>
                )}

                {loadingOptions ? (
                  <div className="text-center py-6 px-4 text-slate-400 text-xs">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="m-0">Checking mentor-authorized publishing options...</p>
                  </div>
                ) : eligibleOptions.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs mb-3.5 leading-relaxed">
                    <AlertTriangle size={17} className="inline mr-2 align-[-3px]" />
                    <strong>No Mentor-Authorized Allocations:</strong> You do not currently have any class and subject allocations authorized for assignment publishing by the Class Mentor. Please contact your Class Mentor to authorize your subject.
                  </div>
                ) : null}

                {/* Form fields: 2 columns in maximized mode, clean stacked flow in normal mode */}
                <div className={`gap-3.5 ${isCreateModalMaximized ? 'grid grid-cols-2' : 'flex flex-col'}`}>
                  {/* Left Column / Primary Info */}
                  <div className="flex flex-col gap-3">
                    {/* Dynamic Target Class & Section Dropdown + Subject Dropdown */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                          Target Class &amp; Section *
                        </label>
                        <select
                          required
                          disabled={loadingOptions || uniqueClassSections.length === 0}
                          value={createForm.class_id && createForm.section_id ? `${createForm.class_id}:${createForm.section_id}` : ''}
                          onChange={(e) => handleClassSectionChange(e.target.value)}
                          className="w-full py-1.5 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        >
                          {uniqueClassSections.length === 0 ? (
                            <option value="">No authorized classes</option>
                          ) : (
                            uniqueClassSections.map(cs => (
                              <option key={`${cs.class_id}:${cs.section_id}`} value={`${cs.class_id}:${cs.section_id}`}>
                                Class {cs.class_number} — Section {cs.section_name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                          Subject *
                        </label>
                        <select
                          required
                          disabled={loadingOptions || availableSubjects.length === 0}
                          value={createForm.subject_id}
                          onChange={(e) => setCreateForm({ ...createForm, subject_id: e.target.value })}
                          className="w-full py-1.5 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        >
                          {availableSubjects.length === 0 ? (
                            <option value="">No authorized subjects</option>
                          ) : (
                            availableSubjects.map(sub => (
                              <option key={sub.subject_id} value={sub.subject_id}>
                                {sub.subject_name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                        Title *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Chapter 4 Calculus Homework"
                        value={createForm.title}
                        onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                        className="w-full py-1.5 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                        Description / Instructions
                      </label>
                      <AutoExpandingTextarea
                        placeholder="Enter assignment details and instructions..."
                        value={createForm.description}
                        onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                        minHeight={isCreateModalMaximized ? 120 : 60}
                        maxHeight={260}
                        className="w-full py-1.5 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-sans"
                      />
                    </div>
                  </div>

                  {/* Right Column / Schedule & Attachments */}
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                          Due Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={createForm.due_date}
                          onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                          className="w-full py-1.5 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                          Max Marks
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={createForm.max_marks}
                          onFocus={e => e.target.select()}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (/^0\d/.test(val)) {
                              val = val.replace(/^0+/, '');
                              e.target.value = val;
                            }
                            setCreateForm({ ...createForm, max_marks: val === '' ? ('' as any) : Number(val) });
                          }}
                          className="w-full py-1.5 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                        />
                      </div>
                    </div>

                    {/* Document Upload Section */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Paperclip size={14} className="text-sky-600" />
                          Upload Document / Study Material <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
                        </label>
                        {uploadedDocuments.length > 0 && (
                          <span className="text-[11px] text-slate-400">
                            {uploadedDocuments.length} / 5 files attached
                          </span>
                        )}
                      </div>

                      {uploadDocError && (
                        <div className="p-2 rounded bg-red-500/10 text-red-500 text-xs mb-2 flex items-center gap-1.5 border border-red-500/25">
                          <AlertCircle size={14} />
                          <span>{uploadDocError}</span>
                        </div>
                      )}

                      <div
                        onClick={() => document.getElementById('teacher-assignment-doc-input')?.click()}
                        className={`border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-sky-500 rounded-lg text-center cursor-pointer bg-slate-50 dark:bg-slate-900/50 transition-colors flex flex-col items-center justify-center gap-1 ${
                          isCreateModalMaximized ? 'p-6' : 'p-3'
                        }`}
                      >
                        <input
                          id="teacher-assignment-doc-input"
                          type="file"
                          multiple
                          accept=".png,.jpg,.jpeg,.pdf,.xlsx,.doc,.docx"
                          className="hidden"
                          onChange={handleTeacherFileChange}
                          disabled={uploadedDocuments.length >= 5}
                        />
                        <div className="w-7 h-7 rounded-full bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600">
                          <Upload size={15} />
                        </div>
                        <p className="m-0 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Click or drop document files here
                        </p>
                        <p className="m-0 text-[11px] text-slate-400">
                          PDF, DOC, DOCX, XLSX, PNG, JPG (Max 10MB per file)
                        </p>
                      </div>

                      {/* Attached Documents List */}
                      {uploadedDocuments.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-2">
                          {uploadedDocuments.map((doc, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-1.5 px-2.5 rounded bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-xs"
                            >
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                <FileText size={14} className="text-sky-600 shrink-0" />
                                <span className={`font-medium text-slate-900 dark:text-slate-100 truncate ${isCreateModalMaximized ? 'max-w-md' : 'max-w-[260px]'}`}>
                                  {doc.name}
                                </span>
                                <span className="text-slate-400 text-[11px]">
                                  ({formatBytes(doc.size)})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDoc(idx)}
                                className="border-none bg-transparent cursor-pointer text-red-500 hover:text-red-700 p-0.5 flex"
                                title="Remove file"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Modal Footer - Always visible on screen, never cut off */}
              <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setUploadedDocuments([]);
                    setUploadDocError(null);
                  }}
                  className="px-3.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold cursor-pointer text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || loadingOptions || eligibleOptions.length === 0 || !createForm.class_id || !createForm.subject_id}
                  className="px-4 py-1.5 rounded-md border-none text-white font-semibold cursor-pointer inline-flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  {creating ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submissions & Grading Modal */}
      {activeAssignment && (
        <div className={`fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-[1000] transition-all ${isSubmissionsMaximized ? 'p-2' : 'p-4'}`}>
          <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-y-auto text-slate-900 dark:text-slate-100 shadow-2xl transition-all ${
            isSubmissionsMaximized
              ? 'w-[97vw] max-w-7xl h-[94vh] rounded-lg p-5'
              : 'w-full max-w-3xl max-h-[min(92vh,800px)] rounded-xl p-6'
          }`}>
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <div>
                <h2 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">
                  Submissions: {activeAssignment.title}
                </h2>
                <span className="text-xs text-slate-500">
                  Max Marks: <b>{activeAssignment.max_marks}</b> | Due: <b>{activeAssignment.due_date}</b>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsSubmissionsMaximized(!isSubmissionsMaximized)}
                  className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded px-2.5 py-1 cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1 text-xs font-semibold transition-colors"
                  title={isSubmissionsMaximized ? 'Restore standard window size' : 'Maximize to full screen'}
                >
                  {isSubmissionsMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span>{isSubmissionsMaximized ? 'Restore' : 'Maximize'}</span>
                </button>
                <button type="button" onClick={() => setActiveAssignment(null)} className="border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 p-1 rounded">
                  <X size={20} />
                </button>
              </div>
            </div>

            {gradeFeedback && (
              <div
                className={`p-3 rounded-lg mb-4 text-xs font-medium flex items-center gap-2 ${
                  gradeFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25'
                    : 'bg-red-500/10 text-red-500 border border-red-500/25'
                }`}
              >
                {gradeFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{gradeFeedback.message}</span>
              </div>
            )}

            {/* Grading Form Modal section if submission selected */}
            {selectedSubmission ? (
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100">
                    Grade Submission for <PersonProfileLink kind="student" id={selectedSubmission.student_id} name={selectedSubmission.student_name || 'Student'} person={selectedSubmission as any} /> (Roll #{selectedSubmission.roll_number || '—'})
                  </h3>
                  <button type="button" onClick={() => setSelectedSubmission(null)} className="border-none bg-transparent cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                    Cancel Grading
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-xs mb-3">
                  <b className="text-slate-900 dark:text-slate-100">Submission Content:</b>
                  <p className="m-0 mt-1 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{selectedSubmission.submission_text || 'No text provided.'}</p>

                  {selectedSubmission.attachments && selectedSubmission.attachments.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60">
                      <b className="block mb-1.5 text-slate-700 dark:text-slate-300">
                        Student Attachments ({selectedSubmission.attachments.length}):
                      </b>
                      <div className="flex flex-col gap-1.5">
                        {selectedSubmission.attachments.map((att) => {
                          const isPreviewable =
                            att.mime_type?.startsWith('image/') ||
                            att.mime_type === 'application/pdf' ||
                            att.file_name.endsWith('.pdf') ||
                            att.file_name.endsWith('.png') ||
                            att.file_name.endsWith('.jpg') ||
                            att.file_name.endsWith('.jpeg');

                          return (
                            <div
                              key={att.id}
                              className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded p-1.5 px-2.5 text-xs"
                            >
                              <div className="flex items-center gap-1.5 overflow-hidden max-w-[65%]">
                                <Paperclip size={13} className="text-slate-400 shrink-0" />
                                <span title={att.file_name} className="font-medium text-slate-800 dark:text-slate-200 truncate">
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
                                    onClick={() => handleTeacherPreview(activeAssignment.id, selectedSubmission.id, att)}
                                    className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded px-2 py-0.5 cursor-pointer text-[11px] inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                                  >
                                    <Eye size={12} /> Preview
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleTeacherDownload(activeAssignment.id, selectedSubmission.id, att)}
                                  className="border border-blue-500 bg-blue-50 dark:bg-blue-950/40 rounded px-2 py-0.5 cursor-pointer text-[11px] inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
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

                <form onSubmit={handleGradeSubmit} className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">Marks Obtained *</label>
                      <input
                        type="number"
                        min={0}
                        max={activeAssignment.max_marks}
                        required
                        value={gradeForm.marks_obtained}
                        onFocus={e => e.target.select()}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (/^0\d/.test(val)) {
                            val = val.replace(/^0+/, '');
                            e.target.value = val;
                          }
                          setGradeForm({ ...gradeForm, marks_obtained: val === '' ? ('' as any) : Number(val) });
                        }}
                        className="w-full py-1.5 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">Feedback / Evaluation Comments</label>
                      <input
                        type="text"
                        placeholder="e.g. Excellent solution structure!"
                        value={gradeForm.feedback}
                        onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                        className="w-full py-1.5 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5">
                    <button type="submit" disabled={grading} className="px-4 py-1.5 rounded-md border-none bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer text-xs shadow-sm transition-colors">
                      {grading ? 'Saving...' : 'Save Grade'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {loadingSubmissions ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                <p className="m-0">Loading student submissions...</p>
              </div>
            ) : submissionsError ? (
              <div className="p-4 text-red-500 text-center text-xs font-semibold">
                <p className="m-0">{submissionsError}</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <p className="m-0">No student submissions received for this assignment yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="p-2.5 px-3 text-slate-500 dark:text-slate-400 font-semibold">Student</th>
                      <th className="p-2.5 px-3 text-slate-500 dark:text-slate-400 font-semibold">Submitted Date</th>
                      <th className="p-2.5 px-3 text-slate-500 dark:text-slate-400 font-semibold">Status</th>
                      <th className="p-2.5 px-3 text-slate-500 dark:text-slate-400 font-semibold">Score</th>
                      <th className="p-2.5 px-3 text-slate-500 dark:text-slate-400 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          <PersonProfileLink kind="student" id={sub.student_id} name={sub.student_name || 'Student'} person={sub as any} />
                          {sub.roll_number && <span className="text-slate-400 font-normal"> (Roll #{sub.roll_number})</span>}
                          {sub.attachments && sub.attachments.length > 0 && (
                            <span
                              title={`${sub.attachments.length} attachment(s)`}
                              className="ml-1.5 text-[11px] bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 font-medium"
                            >
                              <Paperclip size={11} /> {sub.attachments.length}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 px-3 text-slate-500">
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-2.5 px-3">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                              sub.status === 'GRADED'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          {sub.status === 'GRADED' ? `${sub.marks_obtained} / ${activeAssignment.max_marks}` : '—'}
                        </td>
                        <td className="p-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubmission(sub);
                              setGradeForm({
                                marks_obtained: Number(sub.marks_obtained ?? 0),
                                feedback: sub.feedback || ''
                              });
                            }}
                            className="px-2.5 py-1 rounded border border-blue-500 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-semibold cursor-pointer transition-colors"
                          >
                            {sub.status === 'GRADED' ? 'Edit Grade' : 'Grade'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Teacher Attachment Preview Modal */}
      {teacherPreview && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[1100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 overflow-hidden">
                <Paperclip size={16} className="text-slate-400 shrink-0" />
                <h3 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {teacherPreview.fileName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleTeacherDownload(
                      teacherPreview.assignmentId,
                      teacherPreview.submissionId,
                      { file_name: teacherPreview.fileName, id: teacherPreview.attachmentId }
                    )
                  }
                  className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 rounded px-2.5 py-1 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <Download size={13} /> Download
                </button>
                <button
                  type="button"
                  onClick={closeTeacherPreview}
                  className="border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 bg-slate-100/50 dark:bg-slate-900/50 overflow-auto">
              {teacherPreview.loading ? (
                <div className="text-center text-slate-500">
                  <Loader2 size={32} className="animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="m-0 text-sm">Loading preview securely...</p>
                </div>
              ) : teacherPreview.error ? (
                <div className="text-center text-red-500 p-5">
                  <AlertCircle size={32} className="mx-auto mb-2" />
                  <p className="m-0 text-sm">{teacherPreview.error}</p>
                </div>
              ) : teacherPreview.blobUrl && teacherPreview.mimeType?.startsWith('image/') ? (
                <img
                  src={teacherPreview.blobUrl}
                  alt={teacherPreview.fileName}
                  className="max-w-full max-h-full object-contain rounded"
                />
              ) : teacherPreview.blobUrl && teacherPreview.mimeType === 'application/pdf' ? (
                <iframe
                  src={teacherPreview.blobUrl}
                  title={teacherPreview.fileName}
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
                    onClick={() =>
                      handleTeacherDownload(
                        teacherPreview.assignmentId,
                        teacherPreview.submissionId,
                        { file_name: teacherPreview.fileName, id: teacherPreview.attachmentId }
                      )
                    }
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

export default TeacherAssignments;
