import React, { useEffect, useState } from 'react';
import { api } from './api';

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
    <div className="feature-page" style={{ padding: '24px 32px' }}>
      <div className="feature-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 6px' }}>Attendance Corrections</h1>
          <p className="muted" style={{ margin: 0, color: 'var(--text-secondary, #94a3b8)' }}>
            Review teacher requests and keep every change auditable.
          </p>
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border, #242b3d)',
            background: 'var(--bg-card, #131722)',
            color: 'var(--text, #f1f5f9)',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <option value="ALL">All Requests</option>
          <option value="PENDING">Pending Only</option>
          <option value="APPROVED">Approved Only</option>
          <option value="REJECTED">Rejected Only</option>
        </select>
      </div>

      {successToast && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34d399',
            padding: '12px 18px',
            borderRadius: 10,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 600,
            fontSize: '0.92rem',
          }}
        >
          <span>✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {message && <div className="error" style={{ marginBottom: 20 }}>{message}</div>}

      {loading ? (
        <p className="muted">Loading requests…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Student', 'Class', 'Date', 'Current', 'Requested', 'Reason', 'Requested by', 'Action'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(x => (
                <tr key={x.id}>
                  <td>
                    <b>{x.student_name}</b>
                    <br />
                    <small className="table-sub" style={{ color: 'var(--text-secondary, #94a3b8)' }}>Roll {x.roll}</small>
                  </td>
                  <td>
                    {x.class_name || '8'} / {x.section_name || 'A'}
                  </td>
                  <td>{String(x.attendance_date).slice(0, 10)}</td>
                  <td>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                      }}
                    >
                      {x.current_status}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa',
                      }}
                    >
                      {x.requested_status}
                    </span>
                  </td>
                  <td>{x.reason}</td>
                  <td>{x.requester_name || 'Teacher'}</td>
                  <td>
                    {x.status === 'PENDING' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => openReview(x, 'APPROVED')}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#4f46e5',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => openReview(x, 'REJECTED')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#f87171',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : x.status === 'APPROVED' ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          borderRadius: 9999,
                          fontSize: '11px',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                        }}
                      >
                        ✓ APPROVED
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          borderRadius: 9999,
                          fontSize: '11px',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                        }}
                      >
                        ✕ REJECTED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={8} className="muted" style={{ padding: 28, textAlign: 'center' }}>
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
        <div className="overlay" onClick={() => !dialog.isSubmitting && setDialog(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <h3>
                {dialog.decision === 'APPROVED' ? 'Approve Attendance Correction' : 'Reject Attendance Correction'}
              </h3>
              <button
                className="close"
                type="button"
                disabled={dialog.isSubmitting}
                onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
              >
                ×
              </button>
            </div>

            <div
              style={{
                background: 'var(--gray-50)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginBottom: 18,
                fontSize: '13.5px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Student:</span>
                <b>{dialog.item.student_name} (Roll {dialog.item.roll})</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status Change:</span>
                <span>
                  <b style={{ color: 'var(--rose-600)' }}>{dialog.item.current_status}</b> ➔{' '}
                  <b style={{ color: 'var(--emerald-600)' }}>{dialog.item.requested_status}</b>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Teacher's Reason:</span>
                <span style={{ fontStyle: 'italic', maxWidth: '65%', textAlign: 'right' }}>
                  "{dialog.item.reason}"
                </span>
              </div>
            </div>

            <form onSubmit={confirmReview} className="modal-form">
              <label>
                {dialog.decision === 'APPROVED' ? 'Approval Note (Optional)' : 'Rejection Reason (Required)'}
                <textarea
                  rows={3}
                  required={dialog.decision === 'REJECTED'}
                  placeholder={
                    dialog.decision === 'APPROVED'
                      ? 'e.g. Verified parent note and updated records.'
                      : 'e.g. Missing valid medical documentation.'
                  }
                  value={dialog.note}
                  onChange={e => setDialog({ ...dialog, note: e.target.value })}
                />
              </label>

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  className="secondary"
                  disabled={dialog.isSubmitting}
                  onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dialog.isSubmitting}
                  style={{
                    flex: 2,
                    background: dialog.decision === 'APPROVED' ? 'var(--emerald-600)' : 'var(--rose-600)',
                  }}
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

