import React, { useState, useEffect } from 'react';
import { Megaphone, ArrowLeft, AlertCircle, Calendar, MessageSquare, Send, CheckCircle2, CornerDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, Announcement } from '../../services/studentApi';
import { useAuth } from '../../hooks/useAuth';

export function StudentAnnouncements() {
  const { user } = useAuth();
  const isStudent = !user || user.role === 'STUDENT';
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replySuccessId, setReplySuccessId] = useState<string | null>(null);

  function load() {
    studentApi
      .getAnnouncements()
      .then((res) => {
        setAnnouncements(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function handleReplySubmit(id: string) {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      await studentApi.replyToAnnouncement(id, replyText.trim());
      setReplySuccessId(id);
      setReplyText('');
      setActiveReplyId(null);
      setTimeout(() => setReplySuccessId(null), 4000);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Unable to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  }

  return (
    <div className="student-subpage">
      <div className="student-subpage-header">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title">School Announcements</h1>
          <p className="student-subpage-desc">
            Official circulars, student portal broadcasts, and interactive notice response channel.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="student-loading-spinner">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="student-empty-state">
          <p>No announcements at this time.</p>
        </div>
      ) : (
        <div className="student-announcements-feed">
          {announcements.map((a) => (
            <div key={a.id} className="student-card student-notice-card" style={{ marginBottom: 16 }}>
              <div className="notice-header">
                <div className="notice-badge-group">
                  <span className={`notice-priority-badge priority-${a.priority.toLowerCase()}`}>
                    {a.priority}
                  </span>
                  <span className="notice-date">
                    <Calendar size={13} /> {new Date(a.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {a.author_name && <span className="notice-author">By: {a.author_name}</span>}
              </div>

              <h3 className="notice-title" style={{ marginTop: 8 }}>{a.title}</h3>
              <p className="notice-body" style={{ whiteSpace: 'pre-wrap' }}>{a.message}</p>

              {/* Reply Action Row — Hidden for Student profile, available only for School Admin / Teacher */}
              {!isStudent && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveReplyId(activeReplyId === a.id ? null : a.id);
                        setReplyText('');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        backgroundColor: activeReplyId === a.id ? '#2563eb' : '#ffffff',
                        color: activeReplyId === a.id ? '#ffffff' : '#1e293b',
                        cursor: 'pointer'
                      }}
                    >
                      <MessageSquare size={13} />
                      {activeReplyId === a.id ? 'Cancel' : 'Reply'}
                    </button>
                  </div>

                  {/* Success Notification */}
                  {replySuccessId === a.id && (
                    <div style={{
                      marginTop: 10,
                      padding: '8px 12px',
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: 6,
                      color: '#065f46',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <CheckCircle2 size={14} /> Your response was submitted to school administration.
                    </div>
                  )}

                  {/* Inline Interactive Reply Box */}
                  {activeReplyId === a.id && (
                    <div style={{ marginTop: 12, backgroundColor: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CornerDownRight size={13} color="#2563eb" /> Send reply to school administrator:
                      </div>
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your response or question regarding this notice..."
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
                          style={{ padding: '5px 12px', fontSize: 12, borderRadius: 5, border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={submittingReply || !replyText.trim()}
                          onClick={() => handleReplySubmit(a.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 14px',
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
                          <Send size={12} /> {submittingReply ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
