import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen, Plus, FileText, CheckCircle2, Clock, AlertTriangle, AlertCircle,
  Loader2, RefreshCw, Send, Eye, X, Award, Search, Paperclip, Download
} from 'lucide-react';
import { api } from '../../api';

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
      const res = await api.post('/teacher/assignments', createForm);
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
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-main, #0f172a)' }}>
            <BookOpen size={28} style={{ color: '#2563eb' }} /> Teacher Assignments
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            Publish homework assignments, review student submissions, and grade work.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: '#2563eb',
            color: '#fff',
            borderRadius: 8,
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
          }}
        >
          <Plus size={18} /> Create Assignment
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="panel" style={{ padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>TOTAL PUBLISHED</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{assignments.length}</div>
        </div>
        <div className="panel" style={{ padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>SUBMISSIONS RECEIVED</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
            {assignments.reduce((acc, a) => acc + (a.submission_count || 0), 0)}
          </div>
        </div>
        <div className="panel" style={{ padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>PUBLISHING ELIGIBILITY</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#16a34a', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} /> Server Scoped & Authorized
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search assignments by title or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 14
            }}
          />
        </div>
        <button
          type="button"
          onClick={loadAssignments}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#fff',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Assignment List */}
      {loading ? (
        <div className="panel" style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
          <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p>Loading assignments...</p>
        </div>
      ) : error ? (
        <div className="panel" style={{ padding: 24, color: '#ef4444', textAlign: 'center' }}>
          <AlertCircle size={28} style={{ margin: '0 auto 12px' }} />
          <p>{error}</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="panel" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          <FileText size={36} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
          <h3>No Assignments Found</h3>
          <p style={{ fontSize: 14 }}>You haven't created any assignments yet or none match your search.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {filteredAssignments.map((asg) => (
            <div
              key={asg.id}
              className="panel"
              style={{
                padding: 20,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#e0e7ff', color: '#3730a3' }}>
                    {asg.subject_name || 'Subject'}
                  </span>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                    Class {asg.class_number || '10'} {asg.section_name ? `- ${asg.section_name}` : ''}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{asg.title}</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {asg.description}
                </p>

                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#475569', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={14} style={{ color: '#0284c7' }} />
                    <span>Due: <b>{asg.due_date}</b></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Award size={14} style={{ color: '#d97706' }} />
                    <span>Max Marks: <b>{asg.max_marks}</b></span>
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  Submissions: <b>{asg.submission_count || 0}</b>
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenSubmissions(asg)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#1e293b',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Eye size={14} /> Review & Grade
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 540, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Publish New Assignment</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {createFeedback && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: createFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  color: createFeedback.type === 'success' ? '#166534' : '#991b1b',
                  border: `1px solid ${createFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                }}
              >
                {createFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{createFeedback.message}</span>
              </div>
            )}

            {loadingOptions ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                <p>Checking mentor-authorized publishing options...</p>
              </div>
            ) : eligibleOptions.length === 0 ? (
              <div style={{ padding: 16, borderRadius: 8, background: '#fffbe3', border: '1px solid #fcd34d', color: '#b45309', fontSize: 13.5, marginBottom: 16, lineHeight: 1.5 }}>
                <AlertTriangle size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: '-3px' }} />
                <strong>No Mentor-Authorized Allocations:</strong> You do not currently have any class and subject allocations authorized for assignment publishing by the Class Mentor. Please contact your Class Mentor to authorize your subject.
              </div>
            ) : null}

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Dynamic Target Class & Section Dropdown + Subject Dropdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' }}>
                    Target Class & Section *
                  </label>
                  <select
                    required
                    disabled={loadingOptions || uniqueClassSections.length === 0}
                    value={createForm.class_id && createForm.section_id ? `${createForm.class_id}:${createForm.section_id}` : ''}
                    onChange={(e) => handleClassSectionChange(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
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
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' }}>
                    Subject *
                  </label>
                  <select
                    required
                    disabled={loadingOptions || availableSubjects.length === 0}
                    value={createForm.subject_id}
                    onChange={(e) => setCreateForm({ ...createForm, subject_id: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
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
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' }}>Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 4 Calculus Homework"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' }}>Description / Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Enter assignment details and instructions..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' }}>Due Date *</label>
                  <input
                    type="date"
                    required
                    value={createForm.due_date}
                    onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' }}>Max Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.max_marks}
                    onChange={(e) => setCreateForm({ ...createForm, max_marks: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || loadingOptions || eligibleOptions.length === 0 || !createForm.class_id || !createForm.subject_id}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: (creating || eligibleOptions.length === 0) ? '#94a3b8' : '#2563eb',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: (creating || eligibleOptions.length === 0) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submissions & Grading Modal */}
      {activeAssignment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  Submissions: {activeAssignment.title}
                </h2>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  Max Marks: <b>{activeAssignment.max_marks}</b> | Due: <b>{activeAssignment.due_date}</b>
                </span>
              </div>
              <button type="button" onClick={() => setActiveAssignment(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {gradeFeedback && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: gradeFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  color: gradeFeedback.type === 'success' ? '#166534' : '#991b1b'
                }}
              >
                {gradeFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{gradeFeedback.message}</span>
              </div>
            )}

            {/* Grading Form Modal section if submission selected */}
            {selectedSubmission ? (
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                    Grade Submission for {selectedSubmission.student_name || 'Student'} (Roll #{selectedSubmission.roll_number || '—'})
                  </h3>
                  <button type="button" onClick={() => setSelectedSubmission(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748b' }}>
                    Cancel Grading
                  </button>
                </div>

                <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, marginBottom: 12 }}>
                  <b>Submission Content:</b>
                  <p style={{ margin: '4px 0 0', color: '#334155', whiteSpace: 'pre-wrap' }}>{selectedSubmission.submission_text || 'No text provided.'}</p>

                  {selectedSubmission.attachments && selectedSubmission.attachments.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                      <b style={{ display: 'block', marginBottom: 6, color: '#334155' }}>
                        Student Attachments ({selectedSubmission.attachments.length}):
                      </b>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                padding: '6px 10px',
                                fontSize: 12
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', maxWidth: '65%' }}>
                                <Paperclip size={13} color="#64748b" />
                                <span title={att.file_name} style={{ fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {att.file_name}
                                </span>
                                <span style={{ color: '#94a3b8', fontSize: 11 }}>
                                  ({formatBytes(att.file_size)})
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {isPreviewable && (
                                  <button
                                    type="button"
                                    onClick={() => handleTeacherPreview(activeAssignment.id, selectedSubmission.id, att)}
                                    style={{
                                      border: '1px solid #cbd5e1',
                                      background: '#fff',
                                      borderRadius: 4,
                                      padding: '3px 8px',
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      color: '#334155'
                                    }}
                                  >
                                    <Eye size={12} /> Preview
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleTeacherDownload(activeAssignment.id, selectedSubmission.id, att)}
                                  style={{
                                    border: '1px solid #2563eb',
                                    background: '#eff6ff',
                                    borderRadius: 4,
                                    padding: '3px 8px',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    color: '#1d4ed8'
                                  }}
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

                <form onSubmit={handleGradeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Marks Obtained *</label>
                      <input
                        type="number"
                        min={0}
                        max={activeAssignment.max_marks}
                        required
                        value={gradeForm.marks_obtained}
                        onChange={(e) => setGradeForm({ ...gradeForm, marks_obtained: Number(e.target.value) })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Feedback / Evaluation Comments</label>
                      <input
                        type="text"
                        placeholder="e.g. Excellent solution structure!"
                        value={gradeForm.feedback}
                        onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="submit" disabled={grading} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                      {grading ? 'Saving...' : 'Save Grade'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {loadingSubmissions ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                <p>Loading student submissions...</p>
              </div>
            ) : submissionsError ? (
              <div style={{ padding: 16, color: '#ef4444', textAlign: 'center' }}>
                <p>{submissionsError}</p>
              </div>
            ) : submissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>
                <p>No student submissions received for this assignment yet.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Student</th>
                    <th style={{ padding: '10px 12px' }}>Submitted Date</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>Score</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {sub.student_name || 'Student'}
                        {sub.roll_number && <span style={{ color: '#64748b', fontWeight: 400 }}> (Roll #{sub.roll_number})</span>}
                        {sub.attachments && sub.attachments.length > 0 && (
                          <span
                            title={`${sub.attachments.length} attachment(s)`}
                            style={{
                              marginLeft: 6,
                              fontSize: 11,
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              padding: '1px 6px',
                              borderRadius: 4,
                              color: '#475569',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontWeight: 500
                            }}
                          >
                            <Paperclip size={11} /> {sub.attachments.length}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: sub.status === 'GRADED' ? '#dcfce7' : '#fef9c3',
                            color: sub.status === 'GRADED' ? '#15803d' : '#a16207'
                          }}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {sub.status === 'GRADED' ? `${sub.marks_obtained} / ${activeAssignment.max_marks}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubmission(sub);
                            setGradeForm({
                              marks_obtained: Number(sub.marks_obtained ?? 0),
                              feedback: sub.feedback || ''
                            });
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #2563eb',
                            background: '#eff6ff',
                            color: '#1d4ed8',
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
          </div>
        </div>
      )}

      {/* Teacher Attachment Preview Modal */}
      {teacherPreview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.75)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              width: 'min(900px, 95vw)',
              height: 'min(85vh, 800px)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <Paperclip size={16} color="#64748b" />
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#0f172a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {teacherPreview.fileName}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() =>
                    handleTeacherDownload(
                      teacherPreview.assignmentId,
                      teacherPreview.submissionId,
                      { file_name: teacherPreview.fileName, id: teacherPreview.attachmentId }
                    )
                  }
                  style={{
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: '#1e293b'
                  }}
                >
                  <Download size={13} /> Download
                </button>
                <button
                  type="button"
                  onClick={closeTeacherPreview}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: 4
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                background: '#0f172a08',
                overflow: 'auto'
              }}
            >
              {teacherPreview.loading ? (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Loading preview securely...</p>
                </div>
              ) : teacherPreview.error ? (
                <div style={{ textAlign: 'center', color: '#ef4444', padding: 20 }}>
                  <AlertCircle size={32} style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>{teacherPreview.error}</p>
                </div>
              ) : teacherPreview.blobUrl && teacherPreview.mimeType?.startsWith('image/') ? (
                <img
                  src={teacherPreview.blobUrl}
                  alt={teacherPreview.fileName}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }}
                />
              ) : teacherPreview.blobUrl && teacherPreview.mimeType === 'application/pdf' ? (
                <iframe
                  src={teacherPreview.blobUrl}
                  title={teacherPreview.fileName}
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
                      handleTeacherDownload(
                        teacherPreview.assignmentId,
                        teacherPreview.submissionId,
                        { file_name: teacherPreview.fileName, id: teacherPreview.attachmentId }
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

export default TeacherAssignments;
