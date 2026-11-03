import React, { useState, useEffect } from 'react';
import { FileText, ArrowLeft, Send, CheckCircle2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, LeaveRequest } from '../../services/studentApi';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';

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

  const formatDate = (val: string) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="student-subpage max-w-6xl mx-auto p-4 sm:p-6">
      <div className="student-subpage-header flex justify-between items-center mb-6 flex-wrap gap-4">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-2">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title text-2xl font-bold text-slate-900 dark:text-white m-0 mb-1">Leave Applications</h1>
          <p className="student-subpage-desc text-sm text-slate-500 dark:text-slate-400 m-0">
            Submit absence leave requests for teacher and administration approval.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpenModal(true)}
          className="student-btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm cursor-pointer shadow-sm transition-colors"
        >
          <Plus size={16} /> Apply for Leave
        </button>
      </div>

      {feedbackMsg && (
        <div className="student-alert-success flex items-center gap-2.5 p-3 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 text-sm font-semibold mb-5">
          <CheckCircle2 size={16} />
          <span>{feedbackMsg}</span>
        </div>
      )}

      <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
        <div className="student-card-header flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="student-card-title-wrap flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <FileText size={18} />
            <h3 className="student-card-title text-base font-bold text-slate-900 dark:text-white m-0">Submitted Leave History</h3>
          </div>
        </div>

        {loading ? (
          <div className="student-loading-spinner py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading leave history...</div>
        ) : requests.length === 0 ? (
          <div className="student-empty-state py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            <p>No leave applications on record.</p>
          </div>
        ) : (
          <div className="student-table-wrap overflow-x-auto">
            <table className="student-table w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">FROM DATE</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">TO DATE</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">REASON</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 px-4 font-semibold text-slate-900 dark:text-white">{formatDate(r.start_date)}</td>
                    <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{formatDate(r.end_date)}</td>
                    <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{r.reason}</td>
                    <td className="p-3.5 px-4">
                      <span className={`student-status-badge status-${r.status.toLowerCase()} inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        r.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : r.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          : r.status === 'SEEN'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {r.status === 'SEEN' ? 'Seen' : r.status === 'PENDING' ? 'Pending' : r.status === 'APPROVED' ? 'Approved' : r.status === 'REJECTED' ? 'Rejected' : r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Modal */}
      {openModal && (
        <div className="student-modal-overlay fixed inset-0 z-[10050] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="student-modal w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
            <div className="student-modal-header flex justify-between items-center pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">Apply for Student Leave</h3>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="close-btn text-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 leading-none bg-transparent border-0 cursor-pointer p-1"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="student-modal-form flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <span>From Date:</span>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <span>To Date:</span>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <span>Reason for Absence:</span>
                <AutoExpandingTextarea
                  required
                  minHeight={46}
                  maxHeight={200}
                  placeholder="Explain the reason for leave (medical, family event, competition, etc.)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="modal-buttons flex items-center justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="student-btn-secondary px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="student-btn-primary inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
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
