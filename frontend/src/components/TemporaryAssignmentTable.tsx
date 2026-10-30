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
    <div className="panel" style={{ padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            Teacher Substitution Roster
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Active and upcoming substitute teacher allocations with date boundaries.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={load}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* In-app Toast / Feedback Notice */}
      {toastNotice && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '12px 16px',
          borderRadius: 8,
          background: toastNotice.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: toastNotice.type === 'success' ? '#10b981' : '#ef4444',
          border: `1px solid ${toastNotice.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.25)'}`,
          marginBottom: 16,
          fontSize: 13
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {toastNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toastNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
            aria-label="Dismiss notice"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          marginBottom: 16,
          fontSize: 13
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button type="button" className="btn-secondary" onClick={load} style={{ fontSize: 12, padding: '4px 10px' }}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          <p style={{ fontSize: 13 }}>Loading teacher substitutions...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
          <History size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <p style={{ fontSize: 13.5, fontWeight: 500 }}>No teacher substitutions found.</p>
          <p style={{ fontSize: 12, margin: '4px 0 0' }}>Create a substitute assignment above when a substitute teacher is needed.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-strong)', background: 'rgba(0,0,0,0.02)' }}>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Substitute Teacher</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Class & Section</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Start Time</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>End Time</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {a.teacher_name || a.teacher_id}
                      </div>
                      {a.teacher_email && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          {a.teacher_email}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--text)' }}>
                      {a.class_number ? `Class ${a.class_number}` : `Class ID: ${a.class_id}`}
                      {a.section_name ? ` — Section ${a.section_name}` : a.section_id ? ` — Section ID: ${a.section_id}` : ''}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                      {new Date(a.start_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                      {new Date(a.end_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {a.status === 'active' ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 9px',
                          borderRadius: 9999,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : a.status === 'future' ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 9px',
                          borderRadius: 9999,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: 'rgba(59, 130, 246, 0.12)',
                          color: '#3b82f6',
                          border: '1px solid rgba(59, 130, 246, 0.3)'
                        }}>
                          <Clock size={12} /> Scheduled
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 9px',
                          borderRadius: 9999,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: 'rgba(148, 163, 184, 0.12)',
                          color: 'var(--text-secondary)',
                          border: '1px solid rgba(148, 163, 184, 0.3)'
                        }}>
                          Ended
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {a.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => openEndModal(a)}
                          style={{
                            padding: '4px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            cursor: 'pointer'
                          }}
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !endingLoading) {
              setConfirmModal(null);
              setEndError(null);
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-strong, #e2e8f0)',
              borderRadius: 12,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              padding: 24,
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0
                }}>
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    End Temporary Assignment?
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-secondary, #64748b)' }}>
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
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary, #64748b)',
                  cursor: endingLoading ? 'not-allowed' : 'pointer',
                  padding: 4,
                  display: 'flex',
                  borderRadius: 4
                }}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Details */}
            <p style={{ fontSize: 13.5, color: 'var(--text, #1e293b)', lineHeight: 1.5, margin: '0 0 14px' }}>
              Are you sure you want to end the temporary assignment for:
            </p>

            <div style={{
              background: 'rgba(0, 0, 0, 0.03)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: 13
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary, #64748b)', fontWeight: 500 }}>Substitute Teacher:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text, #0f172a)' }}>{confirmModal.teacherName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary, #64748b)', fontWeight: 500 }}>Class:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text, #0f172a)' }}>{confirmModal.className}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary, #64748b)', fontWeight: 500 }}>Section:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text, #0f172a)' }}>{confirmModal.sectionName}</span>
                </div>
              </div>
            </div>

            {/* Warning Callout */}
            <div style={{
              display: 'flex',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#dc2626',
              fontSize: 12.5,
              lineHeight: 1.45,
              marginBottom: endError ? 12 : 20
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Ending this assignment will <strong>immediately revoke</strong> the teacher&apos;s temporary attendance access for this class and section.
              </span>
            </div>

            {/* Error message inside modal if API fails */}
            {endError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                marginBottom: 16,
                fontSize: 12.5
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{endError}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setConfirmModal(null);
                  setEndError(null);
                }}
                disabled={endingLoading}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEnd}
                disabled={endingLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 18px',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: endingLoading ? 'not-allowed' : 'pointer',
                  opacity: endingLoading ? 0.75 : 1
                }}
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
