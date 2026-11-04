import React, { useEffect, useState } from 'react';
import { listAssignments, endAssignment } from '../services/temporaryAssignmentApi';
import { AlertCircle, AlertTriangle, Clock, CheckCircle2, History, Loader2, RefreshCw, X } from 'lucide-react';
import { useToast } from './Toast';

interface Assignment {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  teacher_email?: string;
  class_id: string;
  class_number?: number;
  section_id: string | null;
  section_name?: string;
  start_at: string;
  end_at: string;
  status: 'active' | 'future' | 'past';
}

interface Props {
  onAssignmentsChange?: () => void;
}

export default function TemporaryAssignmentTable({ onAssignmentsChange }: Props = {}) {
  const { addToast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom End Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    id: string;
    teacherName: string;
    className: string;
    sectionName: string;
  } | null>(null);
  const [endingLoading, setEndingLoading] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAssignments();
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setAssignments(raw);
      const now = new Date();
      const activeCount = raw.filter((a: any) => {
        const start = new Date(a.start_at);
        const end = new Date(a.end_at);
        return (a.status === 'active' || (start <= now && end > now)) && start <= now && end > now;
      }).length;
      window.dispatchEvent(new CustomEvent('temporary-assignments-updated', { detail: { count: activeCount } }));
      if (onAssignmentsChange) onAssignmentsChange();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load temporary assignments');
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Handle closing modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmModal && !endingLoading) {
        setConfirmModal(null);
        setEndError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmModal, endingLoading]);

  const openEndModal = (a: Assignment) => {
    const teacherDisplay = a.teacher_name || a.teacher_id || 'Substitute Teacher';
    const classDisplay = a.class_number ? `Class ${a.class_number}` : (a.class_id ? `Class ID: ${a.class_id}` : 'Assigned Class');
    const sectionDisplay = a.section_name ? `Section ${a.section_name}` : (a.section_id ? `Section ID: ${a.section_id}` : 'All Sections');

    setConfirmModal({
      id: a.id,
      teacherName: teacherDisplay,
      className: classDisplay,
      sectionName: sectionDisplay,
    });
    setEndError(null);
  };

  const handleConfirmEnd = async () => {
    if (!confirmModal || endingLoading) return;
    setEndingLoading(true);
    setEndError(null);
    try {
      await endAssignment(confirmModal.id);
      const teacherName = confirmModal.teacherName;
      setConfirmModal(null);
      await load();
      const successMsg = `Temporary assignment for ${teacherName} ended successfully. Attendance access revoked.`;
      addToast(successMsg, 'success');
      setToastNotice({ type: 'success', message: successMsg });
      setTimeout(() => {
        setToastNotice(prev => (prev?.message === successMsg ? null : prev));
      }, 5000);
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || 'Failed to end temporary assignment. Please try again.';
      setEndError(errorMsg);
    } finally {
      setEndingLoading(false);
    }
  };

  return (
    <div className="panel p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
            Teacher Substitution Roster
          </h3>
          <p className="mt-1 m-0 text-xs text-slate-500 dark:text-slate-400">
            Active and upcoming substitute teacher allocations with date boundaries.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer transition-colors"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* In-app Toast / Feedback Notice */}
      {toastNotice && (
        <div className={`flex items-center justify-between gap-2 p-3 rounded-lg text-xs mb-4 border ${
          toastNotice.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25'
        }`}>
          <div className="flex items-center gap-2">
            {toastNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toastNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            className="bg-transparent border-0 text-current cursor-pointer p-0.5"
            aria-label="Dismiss notice"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25 text-xs mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="btn-secondary text-xs px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600"
            onClick={load}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 px-5 text-slate-500 dark:text-slate-400">
          <Loader2 size={24} className="animate-spin mx-auto mb-2" />
          <p className="text-xs">Loading teacher substitutions...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-10 px-5 text-slate-500 dark:text-slate-400">
          <History size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold">No teacher substitutions found.</p>
          <p className="text-xs mt-1">Create a substitute assignment above when a substitute teacher is needed.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full border-collapse text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                <th className="px-3.5 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Substitute Teacher</th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Class &amp; Section</th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Start Time</th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-600 dark:text-slate-400">End Time</th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                <th className="px-3.5 py-2.5 font-semibold text-slate-600 dark:text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                return (
                  <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {a.teacher_name || a.teacher_id}
                      </div>
                      {a.teacher_email && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {a.teacher_email}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {a.class_number ? `Class ${a.class_number}` : `Class ID: ${a.class_id}`}
                      {a.section_name ? ` — Section ${a.section_name}` : a.section_id ? ` — Section ID: ${a.section_id}` : ''}
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 dark:text-slate-400">
                      {new Date(a.start_at).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 dark:text-slate-400">
                      {new Date(a.end_at).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3">
                      {a.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : a.status === 'future' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                          <Clock size={12} /> Scheduled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/25">
                          Ended
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      {a.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => openEndModal(a)}
                          className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-md border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 cursor-pointer transition-colors"
                        >
                          End Now
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Custom Confirmation Modal for Ending Assignment */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !endingLoading) {
              setConfirmModal(null);
              setEndError(null);
            }
          }}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
                    End Temporary Assignment?
                  </h3>
                  <p className="mt-0.5 m-0 text-xs text-slate-500 dark:text-slate-400">
                    Early termination of substitute teaching privileges
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!endingLoading) {
                    setConfirmModal(null);
                    setEndError(null);
                  }
                }}
                disabled={endingLoading}
                className="bg-transparent border-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded disabled:cursor-not-allowed"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Details */}
            <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3.5">
              Are you sure you want to end the temporary assignment for:
            </p>

            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5 mb-4 text-xs md:text-sm">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Substitute Teacher:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{confirmModal.teacherName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Class:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{confirmModal.className}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Section:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{confirmModal.sectionName}</span>
                </div>
              </div>
            </div>

            {/* Warning Callout */}
            <div className={`flex gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs leading-normal ${endError ? 'mb-3' : 'mb-5'}`}>
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Ending this assignment will <strong>immediately revoke</strong> the teacher&apos;s temporary attendance access for this class and section.
              </span>
            </div>

            {/* Error message inside modal if API fails */}
            {endError && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs mb-4">
                <AlertCircle size={15} className="shrink-0" />
                <span>{endError}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                onClick={() => {
                  setConfirmModal(null);
                  setEndError(null);
                }}
                disabled={endingLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEnd}
                disabled={endingLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60 transition-colors shadow-sm"
              >
                {endingLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Ending Assignment...</span>
                  </>
                ) : (
                  <span>Yes, End Assignment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
