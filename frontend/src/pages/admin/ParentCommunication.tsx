import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { MessageSquare, Send, CheckCircle2, CornerDownRight, Clock, AlertTriangle } from 'lucide-react';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';

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
    <div className="feature-page max-w-4xl mx-auto px-6 py-7">
      <div className="mb-5">
        <h1 className="m-0 text-2xl font-bold text-slate-900 dark:text-slate-100">Parent Messages &amp; Notices</h1>
        <p className="muted m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
          Official announcements, academic notices, and direct interactive reply communication.
        </p>
      </div>

      {msg && (
        <div className="px-3.5 py-2.5 mb-4 bg-red-500/10 border border-red-500/25 rounded-md text-red-500 text-xs">
          {msg}
        </div>
      )}

      <div className="grid gap-4">
        {items.map(x => (
          <article
            key={x.recipient_id || x.id}
            className={`rounded-lg p-5 shadow-sm bg-white dark:bg-slate-800 transition-colors ${
              x.priority === 'EMERGENCY'
                ? 'border-2 border-red-500'
                : 'border border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-start mb-2.5">
              <div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded mb-1.5 ${
                    x.priority === 'EMERGENCY'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                      : x.priority === 'HIGH'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                  }`}
                >
                  {x.priority === 'EMERGENCY' && <AlertTriangle size={12} />}
                  {x.priority}
                </span>
                <h3 className="m-0 text-[17px] font-bold text-slate-900 dark:text-slate-100">{x.title}</h3>
              </div>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock size={12} /> {x.published_at ? new Date(x.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
              </span>
            </div>

            <p className="my-2.5 mb-4 leading-relaxed text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
              {x.message}
            </p>

            <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-700/60 pt-3">
              <div className="flex gap-2">
                {!x.read_at && (
                  <button
                    type="button"
                    onClick={() => read(x.recipient_id)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded cursor-pointer transition-colors"
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded cursor-pointer border transition-colors ${
                    activeReplyId === x.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <MessageSquare size={13} /> {activeReplyId === x.id ? 'Cancel Reply' : 'Reply'}
                </button>
              </div>

              {x.read_at && (
                <span className="text-xs text-emerald-500 flex items-center gap-1 font-medium">
                  <CheckCircle2 size={13} /> Read
                </span>
              )}
            </div>

            {/* Success toast after reply */}
            {replySuccessId === x.id && (
              <div className="mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-md text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Reply submitted successfully to school administration.
              </div>
            )}

            {/* Inline Interactive Reply Box */}
            {activeReplyId === x.id && (
              <div className="mt-3.5 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-md border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <CornerDownRight size={13} className="text-blue-600 dark:text-blue-400" /> Write a response to school administration:
                </div>
                <AutoExpandingTextarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply or acknowledgement here..."
                  minHeight={60}
                  maxHeight={200}
                  className="w-full px-2.5 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs box-border font-sans focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setActiveReplyId(null)}
                    className="px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submittingReply || !replyText.trim()}
                    onClick={() => submitReply(x.id, x.student_id)}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-sm"
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
        <div className="p-10 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500">
          No messages or announcements received yet.
        </div>
      )}
    </div>
  );
}
