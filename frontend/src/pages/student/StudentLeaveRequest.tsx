import React, { useState, useEffect } from 'react';
import { FileText, ArrowLeft, Send, CheckCircle2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, LeaveRequest } from '../../services/studentApi';

export function StudentLeaveRequest() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const load = () => {
    setLoading(true);
    studentApi
      .getLeaveRequests()
      .then((res) => {
        setRequests(res);
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
    if (!startDate || !endDate || !reason) return;
    setSubmitting(true);
    try {
      await studentApi.createLeaveRequest({ startDate, endDate, reason });
      setFeedbackMsg('Leave application submitted successfully!');
      setOpenModal(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      load();
    } catch {
      setFeedbackMsg('Failed to submit leave application. Please check dates.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="student-subpage">
      <div className="student-subpage-header">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title">Leave Applications</h1>
          <p className="student-subpage-desc">
            Submit absence leave requests for teacher and administration approval.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpenModal(true)}
          className="student-btn-primary"
        >
          <Plus size={16} /> Apply for Leave
        </button>
      </div>

      {feedbackMsg && (
        <div className="student-alert-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={16} />
          <span>{feedbackMsg}</span>
        </div>
      )}

      <div className="student-card">
        <div className="student-card-header">
          <div className="student-card-title-wrap">
            <FileText size={18} />
            <h3 className="student-card-title">Submitted Leave History</h3>
          </div>
        </div>

        {loading ? (
          <div className="student-loading-spinner">Loading leave history...</div>
        ) : requests.length === 0 ? (
          <div className="student-empty-state">
            <p>No leave applications on record.</p>
          </div>
        ) : (
          <div className="student-table-wrap">
            <table className="student-table">
              <thead>
                <tr>
                  <th>FROM DATE</th>
                  <th>TO DATE</th>
                  <th>REASON</th>
                  <th>STATUS</th>
                  <th>REVIEW REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.start_date}</td>
                    <td>{r.end_date}</td>
                    <td>{r.reason}</td>
                    <td>
                      <span className={`student-status-badge status-${r.status.toLowerCase()}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{r.review_notes || 'Pending faculty review'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Modal */}
      {openModal && (
        <div className="student-modal-overlay">
          <div className="student-modal">
            <div className="student-modal-header">
              <h3>Apply for Student Leave</h3>
              <button type="button" onClick={() => setOpenModal(false)} className="close-btn">×</button>
            </div>
            <form onSubmit={handleSubmit} className="student-modal-form">
              <label>
                <span>From Date:</span>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label>
                <span>To Date:</span>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
              <label>
                <span>Reason for Absence:</span>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain the reason for leave (medical, family event, competition, etc.)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="modal-buttons">
                <button type="button" onClick={() => setOpenModal(false)} className="student-btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="student-btn-primary">
                  <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
