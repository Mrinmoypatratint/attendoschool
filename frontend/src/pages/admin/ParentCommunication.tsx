import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { MessageSquare, Send, CheckCircle2, CornerDownRight, Clock, AlertTriangle } from 'lucide-react';

export default function ParentCommunication() {
  const { user } = useAuth();

  if (user?.role === 'SCHOOL_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replySuccessId, setReplySuccessId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.get('/communication/parent/inbox');
      setItems(res.data || []);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Unable to load messages');
    }
  }

  async function read(id: string) {
    try {
      await api.post(`/communication/parent/read/${id}`);
      load();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Unable to mark read');
    }
  }

  async function submitReply(announcementId: string, studentId?: string) {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      await api.post(`/communication/announcements/${announcementId}/reply`, {
        replyText: replyText.trim(),
        studentId
      });
      setReplySuccessId(announcementId);
      setReplyText('');
      setActiveReplyId(null);
      setTimeout(() => setReplySuccessId(null), 4000);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Unable to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="feature-page" style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Parent Messages & Notices</h1>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Official announcements, academic notices, and direct interactive reply communication.
        </p>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', marginBottom: 16, backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', fontSize: 13 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {items.map(x => (
          <article
            key={x.recipient_id || x.id}
            style={{
              backgroundColor: '#ffffff',
              border: x.priority === 'EMERGENCY' ? '1.5px solid #ef4444' : '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  backgroundColor: x.priority === 'EMERGENCY' ? '#fee2e2' : x.priority === 'HIGH' ? '#ffedd5' : '#f1f5f9',
                  color: x.priority === 'EMERGENCY' ? '#b91c1c' : x.priority === 'HIGH' ? '#c2410c' : '#475569',
                  marginBottom: 6
                }}>
                  {x.priority === 'EMERGENCY' && <AlertTriangle size={12} />}
                  {x.priority}
                </span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{x.title}</h3>
              </div>
              <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {x.published_at ? new Date(x.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
              </span>
            </div>

            <p style={{ margin: '10px 0 16px', lineHeight: 1.6, fontSize: 14, color: '#334155', whiteSpace: 'pre-wrap' }}>
              {x.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {!x.read_at && (
                  <button
                    type="button"
                    onClick={() => read(x.recipient_id)}
                    style={{
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: 5,
                      cursor: 'pointer'
                    }}
                  >
                    Mark as Read
                  </button>
                )}
                {/* Reply Mechanism Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveReplyId(activeReplyId === x.id ? null : x.id);
                    setReplyText('');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: activeReplyId === x.id ? '#2563eb' : '#eff6ff',
                    color: activeReplyId === x.id ? '#ffffff' : '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: 5,
                    cursor: 'pointer'
                  }}
                >
                  <MessageSquare size={13} /> {activeReplyId === x.id ? 'Cancel Reply' : 'Reply'}
                </button>
              </div>

              {x.read_at && (
                <span style={{ fontSize: 11.5, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} /> Read
                </span>
              )}
            </div>

            {/* Success toast after reply */}
            {replySuccessId === x.id && (
              <div style={{ marginTop: 12, padding: '8px 12px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, color: '#047857', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} /> Reply submitted successfully to school administration.
              </div>
            )}

            {/* Inline Interactive Reply Box */}
            {activeReplyId === x.id && (
              <div style={{ marginTop: 14, backgroundColor: '#f8fafc', padding: 14, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CornerDownRight size={13} color="#2563eb" /> Write a response to school administration:
                </div>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply or acknowledgement here..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 5,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setActiveReplyId(null)}
                    style={{ padding: '6px 12px', fontSize: 12, borderRadius: 5, border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submittingReply || !replyText.trim()}
                    onClick={() => submitReply(x.id, x.student_id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 5,
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                      opacity: replyText.trim() ? 1 : 0.6
                    }}
                  >
                    <Send size={12} /> {submittingReply ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {!items.length && !msg && (
        <div style={{ padding: 40, textAlign: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#94a3b8' }}>
          No messages or announcements received yet.
        </div>
      )}
    </div>
  );
}
