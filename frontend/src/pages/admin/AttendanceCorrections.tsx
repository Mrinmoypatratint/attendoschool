import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { PersonProfileLink } from '../../components/PersonProfileLink';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';

type Item = {
  id: string;
  student_name: string;
  roll: string | number;
  class_name?: string;
  section_name?: string;
  attendance_date: string;
  current_status: string;
  requested_status: string;
  reason: string;
  status: string;
  requester_name?: string;
  reviewer_name?: string;
  review_note?: string;
};

export default function AttendanceCorrections() {
  const [status, setStatus] = useState('ALL');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Modal dialog state
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    item: Item | null;
    decision: 'APPROVED' | 'REJECTED';
    note: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    item: null,
    decision: 'APPROVED',
    note: '',
    isSubmitting: false,
  });

  async function load(currentStatus = status) {
    setLoading(true);
    setMessage('');
    try {
      const params: any = {};
      if (currentStatus && currentStatus !== 'ALL') {
        params.status = currentStatus;
      }
      const r = await api.get('/attendance-corrections', { params });
      setItems(r.data || []);
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e?.message || 'Unable to load corrections');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(status);
  }, [status]);

  function openReview(item: Item, decision: 'APPROVED' | 'REJECTED') {
    setDialog({
      isOpen: true,
      item,
      decision,
      note: decision === 'APPROVED' ? 'Medical certificate / reason verified.' : '',
      isSubmitting: false,
    });
  }

  async function confirmReview(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!dialog.item) return;

    if (dialog.decision === 'REJECTED' && !dialog.note.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setDialog(prev => ({ ...prev, isSubmitting: true }));
    const targetItem = dialog.item;
    const targetDecision = dialog.decision;
    const noteText = dialog.note.trim();

    try {
      await api.post(`/attendance-corrections/${targetItem.id}/review`, {
        decision: targetDecision,
        reviewNote: noteText || undefined,
      });

      // Instantly reflect approved / rejected status in UI
      setItems(prev =>
        prev.map(x =>
          x.id === targetItem.id
            ? { ...x, status: targetDecision, review_note: noteText }
            : x
        )
      );

      setSuccessToast(
        `Correction request for ${targetItem.student_name} marked as ${targetDecision}.`
      );
      setTimeout(() => setSuccessToast(''), 4500);
      setDialog({ isOpen: false, item: null, decision: 'APPROVED', note: '', isSubmitting: false });
    } catch (err: any) {
      setMessage(err?.response?.data?.message || err?.message || 'Review failed');
      setDialog(prev => ({ ...prev, isSubmitting: false }));
    }
  }

  return (
    <div className="feature-page max-w-7xl mx-auto p-4 sm:p-6">
      <div className="feature-header flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-1">
            Attendance Corrections
          </h1>
          <p className="muted text-sm text-slate-500 dark:text-slate-400">
            Review teacher requests and keep every change auditable.
          </p>
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        >
          <option value="ALL">All Requests</option>
          <option value="PENDING">Pending Only</option>
          <option value="APPROVED">Approved Only</option>
          <option value="REJECTED">Rejected Only</option>
        </select>
      </div>

      {successToast && (
        <div className="mb-5 p-3 px-4.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 flex items-center gap-2.5 font-semibold text-sm shadow-xs">
          <span>✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {message && (
        <div className="error mb-5 p-3 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-sm">
          {message}
        </div>
      )}

      {loading ? (
        <p className="muted text-slate-500 dark:text-slate-400">Loading requests…</p>
      ) : (
        <div className="table-wrap bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                {['Student', 'Class', 'Date', 'Current', 'Requested', 'Reason', 'Requested by', 'Action'].map(h => (
                  <th key={h} className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(x => (
                <tr key={x.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 px-4">
                    <PersonProfileLink kind="student" name={x.student_name} person={x as any}>
                      <b className="text-slate-900 dark:text-white">{x.student_name}</b>
                    </PersonProfileLink>
                    <br />
                    <small className="table-sub text-slate-500 dark:text-slate-400 text-xs">Roll {x.roll}</small>
                  </td>
                  <td className="p-3 px-4 text-slate-800 dark:text-slate-200">
                    {x.class_name || '8'} / {x.section_name || 'A'}
                  </td>
                  <td className="p-3 px-4 text-slate-800 dark:text-slate-200">{String(x.attendance_date).slice(0, 10)}</td>
                  <td className="p-3 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400">
                      {x.current_status}
                    </span>
                  </td>
                  <td className="p-3 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      {x.requested_status}
                    </span>
                  </td>
                  <td className="p-3 px-4 text-slate-800 dark:text-slate-200">{x.reason}</td>
                  <td className="p-3 px-4 text-slate-800 dark:text-slate-200">{x.requester_name || 'Teacher'}</td>
                  <td className="p-3 px-4">
                    {x.status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openReview(x, 'APPROVED')}
                          className="px-3.5 py-1.5 rounded-lg border-0 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs cursor-pointer transition-colors shadow-xs"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => openReview(x, 'REJECTED')}
                          className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs cursor-pointer transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    ) : x.status === 'APPROVED' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40">
                        ✓ APPROVED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40">
                        ✕ REJECTED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={8} className="muted p-7 text-center text-slate-500 dark:text-slate-400">
                    No correction requests found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal Popup */}
      {dialog.isOpen && dialog.item && (
        <div
          className="overlay fixed inset-0 z-[10050] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => !dialog.isSubmitting && setDialog(prev => ({ ...prev, isOpen: false }))}
        >
          <div
            className="modal w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-head flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">
                {dialog.decision === 'APPROVED' ? 'Approve Attendance Correction' : 'Reject Attendance Correction'}
              </h3>
              <button
                className="close text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none bg-transparent border-0 cursor-pointer p-1"
                type="button"
                disabled={dialog.isSubmitting}
                onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
              >
                ×
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 px-4 mb-4 text-[13.5px] flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Student:</span>
                <PersonProfileLink kind="student" name={dialog.item.student_name} person={dialog.item as any}>
                  <b className="text-slate-900 dark:text-white">{dialog.item.student_name} (Roll {dialog.item.roll})</b>
                </PersonProfileLink>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Status Change:</span>
                <span>
                  <b className="text-rose-600 dark:text-rose-400">{dialog.item.current_status}</b> ➔{' '}
                  <b className="text-emerald-600 dark:text-emerald-400">{dialog.item.requested_status}</b>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Teacher's Reason:</span>
                <span className="italic max-w-[65%] text-right text-slate-700 dark:text-slate-300">
                  "{dialog.item.reason}"
                </span>
              </div>
            </div>

            <form onSubmit={confirmReview} className="modal-form flex flex-col gap-3">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex flex-col gap-1.5">
                {dialog.decision === 'APPROVED' ? 'Approval Note (Optional)' : 'Rejection Reason (Required)'}
                <AutoExpandingTextarea
                  required={dialog.decision === 'REJECTED'}
                  placeholder={
                    dialog.decision === 'APPROVED'
                      ? 'e.g. Verified parent note and updated records.'
                      : 'e.g. Missing valid medical documentation.'
                  }
                  value={dialog.note}
                  onChange={e => setDialog({ ...dialog, note: e.target.value })}
                  minHeight={65}
                  maxHeight={200}
                />
              </label>

              <div className="flex gap-3 mt-3">
                <button
                  type="button"
                  className="secondary flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold cursor-pointer disabled:cursor-not-allowed"
                  disabled={dialog.isSubmitting}
                  onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dialog.isSubmitting}
                  className={`flex-2 px-4 py-2 rounded-lg text-white text-sm font-semibold cursor-pointer disabled:cursor-not-allowed shadow-sm transition-colors ${
                    dialog.decision === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {dialog.isSubmitting
                    ? 'Processing…'
                    : dialog.decision === 'APPROVED'
                    ? '✓ Confirm Approval'
                    : '✕ Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
