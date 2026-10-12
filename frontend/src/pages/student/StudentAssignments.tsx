import React, { useState, useEffect } from 'react';
import { FileCheck, ArrowLeft, Send, CheckCircle2, Clock, Search, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { studentApi, Assignment } from '../../services/studentApi';

export function StudentAssignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'SUBMITTED'>('ALL');
  const [activeModal, setActiveModal] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  useEffect(() => {
    setSearchTerm(queryParam);
  }, [queryParam]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal || !submissionText.trim()) return;
    setSubmitting(true);
    try {
      await studentApi.submitAssignment(activeModal.id, submissionText);
      setFeedbackMsg('Assignment submitted successfully!');
      setActiveModal(null);
      setSubmissionText('');
      load();
    } catch {
      setFeedbackMsg('Failed to submit assignment. Please try again.');
    } finally {
      setSubmitting(false);
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border, #cbd5e1)',
          borderRadius: 8,
          padding: '6px 12px',
          flex: 1,
          maxWidth: 420
        }}>
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
          <div className="student-modal">
            <div className="student-modal-header">
              <h3>Submit: {activeModal.title}</h3>
              <button type="button" onClick={() => setActiveModal(null)} className="close-btn">×</button>
            </div>
            <form onSubmit={handleSubmit} className="student-modal-form">
              <p className="modal-sub">Subject: <b>{activeModal.subject_name}</b> &nbsp;|&nbsp; Due: {activeModal.due_date}</p>
              <label>
                <span>Your Submission Text / Notes / Solution Proof:</span>
                <textarea
                  required
                  rows={5}
                  placeholder="Enter your solution or assignment submission text here..."
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                />
              </label>
              <div className="modal-buttons">
                <button type="button" onClick={() => setActiveModal(null)} className="student-btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="student-btn-primary">
                  <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
