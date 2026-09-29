import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  MessageSquare,
  AlertTriangle,
  Send,
  CheckCircle2,
  X,
  Clock,
  MessageCircle,
  Eye
} from 'lucide-react';
import { UniversalPreviewModal, DestructiveConfirmModal, PreviewSectionData } from '../../components/preview';

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  audience_type: string;
  priority: string;
  status: string;
  class_id?: string;
  section_id?: string;
  recipient_count: number;
  read_count: number;
  reply_count: number;
  created_at?: string;
  published_at?: string;
}

interface ReplyItem {
  id: string;
  announcement_id: string;
  announcement_title?: string;
  author_name: string;
  author_role: string;
  author_email?: string;
  student_name?: string;
  student_roll?: string;
  class_name?: string;
  section_name?: string;
  reply_text: string;
  created_at: string;
}

export default function Communication() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [activeTab, setActiveTab] = useState<'announcements' | 'all-replies'>('announcements');
  const [form, setForm] = useState({
    title: '',
    message: '',
    audienceType: 'SCHOOL',
    priority: 'NORMAL',
    classId: '',
    sectionId: ''
  });
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [selectedNoticeForReplies, setSelectedNoticeForReplies] = useState<AnnouncementItem | null>(null);
  const [noticeReplies, setNoticeReplies] = useState<ReplyItem[]>([]);
  const [allReplies, setAllReplies] = useState<ReplyItem[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  // Universal Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Confirm publish state
  const [publishTarget, setPublishTarget] = useState<AnnouncementItem | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function load() {
    try {
      const res = await api.get('/communication/announcements');
      setItems(res.data || []);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Unable to load announcements');
    }
  }

  async function loadAllReplies() {
    try {
      const res = await api.get('/communication/replies');
      setAllReplies(res.data || []);
    } catch (_e) {}
  }

  useEffect(() => {
    load();
    loadAllReplies();
    api.get('/classes').then(r => setClasses(r.data || [])).catch(() => {});
    api.get('/sections').then(r => setSections(r.data || [])).catch(() => {});
  }, []);

  // Stage 1 Validation & Preview Trigger
  function handleInitiateCreate() {
    if (!form.title.trim()) {
      alert('Announcement title is required.');
      return;
    }
    if (!form.message.trim()) {
      alert('Message content is required.');
      return;
    }
    if ((form.audienceType === 'CLASS' || form.audienceType === 'SECTION') && !form.classId) {
      alert('Please select a target class for class-scoped announcements.');
      return;
    }
    if (form.audienceType === 'SECTION' && !form.sectionId) {
      alert('Please select a target section.');
      return;
    }
    setPreviewError(null);
    setPreviewOpen(true);
  }

  // Stage 2 Confirmation & Commit
  async function handleConfirmCreate() {
    if (!form.title.trim() || !form.message.trim()) {
      setPreviewError('Title and message cannot be empty.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      await api.post('/communication/announcements', form);
      setMsg('Announcement saved successfully!');
      setForm({
        title: '',
        message: '',
        audienceType: 'SCHOOL',
        priority: 'NORMAL',
        classId: '',
        sectionId: ''
      });
      setPreviewOpen(false);
      load();
    } catch (e: any) {
      setPreviewError(e?.response?.data?.message || 'Unable to save announcement');
    } finally {
      setPreviewLoading(false);
    }
  }

  // Publish Announcement Execution via Confirm Modal
  async function handleConfirmPublish() {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      await api.post(`/communication/announcements/${publishTarget.id}/publish`);
      setMsg(`Announcement "${publishTarget.title}" published and delivered to recipients!`);
      setPublishTarget(null);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Unable to publish announcement');
    } finally {
      setPublishing(false);
    }
  }

  async function openNoticeReplies(notice: AnnouncementItem) {
    setSelectedNoticeForReplies(notice);
    setLoadingReplies(true);
    try {
      const res = await api.get(`/communication/announcements/${notice.id}/replies`);
      setNoticeReplies(res.data || []);
    } catch (_e) {
      setNoticeReplies([]);
    } finally {
      setLoadingReplies(false);
    }
  }

  const selectedClassName = classes.find(c => c.id === form.classId)?.label || form.classId;
  const selectedSectionName = sections.find(s => s.id === form.sectionId)?.name || form.sectionId;

  const previewSections: PreviewSectionData[] = [
    {
      title: 'Broadcast Scope & Urgency',
      fields: [
        { label: 'Audience Target', value: form.audienceType, type: 'badge', color: 'blue' },
        ...(form.audienceType === 'CLASS' || form.audienceType === 'SECTION'
          ? [{ label: 'Target Class', value: selectedClassName || 'Not Selected' }]
          : []),
        ...(form.audienceType === 'SECTION'
          ? [{ label: 'Target Section', value: selectedSectionName || 'Not Selected' }]
          : []),
        {
          label: 'Priority Level',
          value: form.priority,
          type: 'badge',
          color: form.priority === 'EMERGENCY' ? 'red' : form.priority === 'HIGH' ? 'amber' : 'slate'
        },
      ]
    },
    {
      title: 'Announcement Content',
      fields: [
        { label: 'Title', value: form.title },
        { label: 'Message Body', value: form.message },
      ]
    }
  ];

  return (
    <div className="feature-page" style={{ padding: '24px 28px', maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Communication Center</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Multi-channel institutional announcements, role-based audience broadcasts, and threaded replies.
          </p>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: 8, backgroundColor: '#f1f5f9', padding: 4, borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'announcements' ? '#ffffff' : 'transparent',
              color: activeTab === 'announcements' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'announcements' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Announcements
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('all-replies');
              loadAllReplies();
            }}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'all-replies' ? '#ffffff' : 'transparent',
              color: activeTab === 'all-replies' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'all-replies' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Threaded Replies ({allReplies.length})
          </button>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px',
          marginBottom: 16,
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 6,
          color: '#1e40af',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af' }}>✕</button>
        </div>
      )}

      {activeTab === 'announcements' ? (
        <>
          {/* New Announcement Form */}
          <div className="form-card" style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={18} color="#2563eb" /> New Broadcast Announcement
            </h3>

            <div style={{ display: 'grid', gap: 12 }}>
              <input
                placeholder="Announcement Title (e.g., Annual Science Olympiad / Faculty Meeting)"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />

              <textarea
                placeholder="Broadcast details and instructions..."
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                style={{
                  width: '100%',
                  minHeight: 110,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13.5,
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Extended Audience Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>AUDIENCE TYPE</label>
                  <select
                    value={form.audienceType}
                    onChange={e => setForm({ ...form, audienceType: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, minWidth: 140 }}
                  >
                    <option value="SCHOOL">SCHOOL (All)</option>
                    <option value="TEACHER">TEACHER (Faculty only)</option>
                    <option value="STUDENT">STUDENT (Student portal)</option>
                    <option value="PARENTS">PARENTS</option>
                    <option value="CLASS">CLASS</option>
                    <option value="SECTION">SECTION</option>
                  </select>
                </div>

                {/* Class selector if CLASS or SECTION */}
                {(form.audienceType === 'CLASS' || form.audienceType === 'SECTION') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>CLASS</label>
                    <select
                      value={form.classId}
                      onChange={e => setForm({ ...form, classId: e.target.value })}
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, minWidth: 120 }}
                    >
                      <option value="">Select Class</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.label || c.name || `Class ${c.class_number}`}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Section selector if SECTION */}
                {form.audienceType === 'SECTION' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>SECTION</label>
                    <select
                      value={form.sectionId}
                      onChange={e => setForm({ ...form, sectionId: e.target.value })}
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, minWidth: 110 }}
                    >
                      <option value="">Select Section</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name || s.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Priority Selector with Emergency Multi-channel Callout */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>PRIORITY</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: form.priority === 'EMERGENCY' ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: 13,
                      backgroundColor: form.priority === 'EMERGENCY' ? '#fef2f2' : '#ffffff',
                      color: form.priority === 'EMERGENCY' ? '#b91c1c' : '#0f172a',
                      fontWeight: form.priority === 'EMERGENCY' ? 700 : 500
                    }}
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="EMERGENCY">EMERGENCY (Auto-Email Broadcast)</option>
                  </select>
                </div>

                <div style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={handleInitiateCreate}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      padding: '9px 20px',
                      borderRadius: 6,
                      border: 'none',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Eye size={15} /> Preview & Save Announcement
                  </button>
                </div>
              </div>

              {form.priority === 'EMERGENCY' && (
                <div style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <AlertTriangle size={14} /> Emergency announcements automatically dispatch priority emails to all target audience accounts upon publication.
                </div>
              )}
            </div>
          </div>

          {/* Announcements Table */}
          <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>TITLE</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>AUDIENCE</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>PRIORITY</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>RECIPIENTS</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>READ</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>REPLIES</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, color: '#475569', fontWeight: 600 }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {items.map(x => (
                  <tr key={x.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a' }}>{x.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {x.message}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11.5,
                        fontWeight: 600,
                        backgroundColor:
                          x.audience_type === 'TEACHER' ? '#f0fdf4' :
                          x.audience_type === 'STUDENT' ? '#eff6ff' :
                          x.audience_type === 'PARENTS' ? '#fef3c7' : '#f1f5f9',
                        color:
                          x.audience_type === 'TEACHER' ? '#166534' :
                          x.audience_type === 'STUDENT' ? '#1e40af' :
                          x.audience_type === 'PARENTS' ? '#92400e' : '#334155'
                      }}>
                        {x.audience_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11.5,
                        fontWeight: 700,
                        backgroundColor: x.priority === 'EMERGENCY' ? '#fee2e2' : x.priority === 'HIGH' ? '#ffedd5' : '#f1f5f9',
                        color: x.priority === 'EMERGENCY' ? '#b91c1c' : x.priority === 'HIGH' ? '#c2410c' : '#475569'
                      }}>
                        {x.priority === 'EMERGENCY' && <AlertTriangle size={12} />}
                        {x.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11.5,
                        fontWeight: 600,
                        backgroundColor: x.status === 'PUBLISHED' ? '#ecfdf5' : '#f8fafc',
                        color: x.status === 'PUBLISHED' ? '#047857' : '#64748b'
                      }}>
                        {x.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#334155' }}>{x.recipient_count || 0}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#334155' }}>{x.read_count || 0}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        type="button"
                        onClick={() => openNoticeReplies(x)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          padding: '4px 10px',
                          borderRadius: 5,
                          fontSize: 12,
                          color: '#2563eb',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="View threaded parent & student replies"
                      >
                        <MessageCircle size={13} /> {x.reply_count || 0} Replies
                      </button>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {x.status !== 'PUBLISHED' ? (
                        <button
                          type="button"
                          onClick={() => setPublishTarget(x)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '5px 12px',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            borderRadius: 5,
                            border: 'none',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Send size={12} /> Publish
                        </button>
                      ) : (
                        <span style={{ fontSize: 11.5, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={13} /> Sent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                      No announcements published yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Administrator Console: Threaded Replies Grouped by Notice */
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>
            Threaded parent and student responses grouped across all published notices:
          </div>
          {allReplies.map(r => (
            <div
              key={r.id}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 18,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 4,
                    backgroundColor: r.author_role === 'PARENT' ? '#eff6ff' : '#f0fdf4',
                    color: r.author_role === 'PARENT' ? '#1d4ed8' : '#15803d',
                    marginRight: 8
                  }}>
                    {r.author_role}
                  </span>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{r.author_name}</span>
                  {r.author_email && <span style={{ fontSize: 12, color: '#64748b', marginLeft: 6 }}>({r.author_email})</span>}
                </div>
                <span style={{ fontSize: 11.5, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} /> {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                </span>
              </div>

              {/* Linked Student academic placement context */}
              {r.student_name && (
                <div style={{ fontSize: 12.5, color: '#475569', backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: 4, marginBottom: 10 }}>
                  Linked Student: <b>{r.student_name}</b> · {r.class_name || 'Class 10'} - {r.section_name || 'A'} (Roll #{r.student_roll || '-'})
                </div>
              )}

              {/* Reply message */}
              <div style={{ fontSize: 13.5, color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-wrap', backgroundColor: '#f8fafc', padding: 12, borderRadius: 6, borderLeft: '3px solid #2563eb' }}>
                {r.reply_text}
              </div>

              {r.announcement_title && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: '#64748b' }}>
                  In response to notice: <b>{r.announcement_title}</b>
                </div>
              )}
            </div>
          ))}
          {!allReplies.length && (
            <div style={{ padding: 40, textAlign: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#94a3b8' }}>
              No threaded replies received from parents or students yet.
            </div>
          )}
        </div>
      )}

      {/* ─── Threaded Replies Drawer for Specific Notice ─── */}
      {selectedNoticeForReplies && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1000
        }}>
          <div style={{
            width: '100%',
            maxWidth: 580,
            backgroundColor: '#ffffff',
            height: '100%',
            overflowY: 'auto',
            padding: 24,
            boxSizing: 'border-box',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  backgroundColor: '#f1f5f9',
                  color: '#475569'
                }}>
                  {selectedNoticeForReplies.audience_type}
                </span>
                <h2 style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {selectedNoticeForReplies.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNoticeForReplies(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Notice Message Card */}
            <div style={{ backgroundColor: '#f8fafc', padding: 14, borderRadius: 6, marginBottom: 20, fontSize: 13, color: '#334155', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, color: '#64748b', fontSize: 11, marginBottom: 4 }}>NOTICE BODY</div>
              {selectedNoticeForReplies.message}
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={16} color="#2563eb" /> Threaded Responses ({noticeReplies.length})
            </h3>

            {loadingReplies ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading replies...</div>
            ) : noticeReplies.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 6 }}>
                No replies from parents or students for this notice yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14, overflowY: 'auto', flex: 1 }}>
                {noticeReplies.map(r => (
                  <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 3,
                          backgroundColor: r.author_role === 'PARENT' ? '#eff6ff' : '#f0fdf4',
                          color: r.author_role === 'PARENT' ? '#1d4ed8' : '#15803d',
                          marginRight: 6
                        }}>
                          {r.author_role}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{r.author_name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    {r.student_name && (
                      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 8 }}>
                        Student: {r.student_name} ({r.class_name || 'Class 10'} - {r.section_name || 'A'})
                      </div>
                    )}

                    <div style={{ fontSize: 13, color: '#1e293b', backgroundColor: '#f8fafc', padding: 10, borderRadius: 5 }}>
                      {r.reply_text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Universal Preview Modal for New Announcement */}
      <UniversalPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onEdit={() => setPreviewOpen(false)}
        onConfirm={handleConfirmCreate}
        title="Preview Announcement Broadcast"
        subtitle={`Target: ${form.audienceType} · Priority: ${form.priority}`}
        operationType="create"
        confirmText="Confirm & Save Announcement"
        editText="Back to Edit Draft"
        sections={previewSections}
        loading={previewLoading}
        error={previewError}
      />

      {/* Confirmation Modal for Publishing Announcement */}
      <DestructiveConfirmModal
        isOpen={!!publishTarget}
        onClose={() => setPublishTarget(null)}
        onConfirm={handleConfirmPublish}
        title="Confirm Announcement Broadcast"
        entityName={publishTarget?.title || 'Announcement'}
        entityType="Announcement"
        warningMessage="This action will deliver notification broadcasts to all designated recipients and inboxes immediately."
        confirmText="Confirm & Broadcast"
        loading={publishing}
        details={[
          { label: 'Audience Scope', value: publishTarget?.audience_type || '' },
          { label: 'Priority', value: publishTarget?.priority || '' }
        ]}
      />
    </div>
  );
}
