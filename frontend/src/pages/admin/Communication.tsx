import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../api';
import {
  MessageSquare,
  AlertTriangle,
  Send,
  CheckCircle2,
  X,
  Clock,
  MessageCircle,
  Eye,
  Filter
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
  class_number?: number;
  section_name?: string;
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

export const STANDARD_CLASS_LIST = [
  { classNumber: -1, label: 'L-KG' },
  { classNumber: 0, label: 'U-KG' },
  { classNumber: 1, label: 'Class 1' },
  { classNumber: 2, label: 'Class 2' },
  { classNumber: 3, label: 'Class 3' },
  { classNumber: 4, label: 'Class 4' },
  { classNumber: 5, label: 'Class 5' },
  { classNumber: 6, label: 'Class 6' },
  { classNumber: 7, label: 'Class 7' },
  { classNumber: 8, label: 'Class 8' },
  { classNumber: 9, label: 'Class 9' },
  { classNumber: 10, label: 'Class 10' },
  { classNumber: 11, label: 'Class 11' },
  { classNumber: 12, label: 'Class 12' }
];

export function formatClassGrade(num?: number | null): string {
  if (num === -1) return 'L-KG';
  if (num === 0) return 'U-KG';
  if (num !== null && num !== undefined && !isNaN(Number(num))) return `Class ${num}`;
  return '';
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
  const [tableFilter, setTableFilter] = useState<string>('ALL');
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

  // Map standard grade list L-KG → Class 12 to live DB class records
  const resolvedClasses = useMemo(() => {
    return STANDARD_CLASS_LIST.map(opt => {
      const found = classes.find(c => Number(c.class_number) === opt.classNumber || c.label === opt.label);
      return {
        id: found ? found.id : `cls-${opt.classNumber}`,
        classNumber: opt.classNumber,
        label: opt.label,
        realId: found?.id
      };
    });
  }, [classes]);

  const selectedClass = useMemo(() => {
    if (!form.classId) return null;
    return resolvedClasses.find(c => c.id === form.classId || String(c.classNumber) === String(form.classId)) || null;
  }, [form.classId, resolvedClasses]);

  // Find all sections belonging to the selected class
  const classSections = useMemo(() => {
    if (!selectedClass) return [];
    return sections.filter(s => {
      if (s.class_id && s.class_id === selectedClass.id) return true;
      if (s.classId && s.classId === selectedClass.id) return true;
      if (s.class_number !== undefined && Number(s.class_number) === selectedClass.classNumber) return true;
      return false;
    });
  }, [selectedClass, sections]);

  const secA = useMemo(() => {
    return classSections.find(s => String(s.name || s.section_name || '').toUpperCase() === 'A');
  }, [classSections]);

  const secB = useMemo(() => {
    return classSections.find(s => String(s.name || s.section_name || '').toUpperCase() === 'B');
  }, [classSections]);

  // Determine currently selected section letter ('A' | 'B' | '')
  const selectedSectionLetter = useMemo(() => {
    if (!form.sectionId) return '';
    if (secA && (form.sectionId === secA.id || form.sectionId === 'sec-a')) return 'A';
    if (secB && (form.sectionId === secB.id || form.sectionId === 'sec-b')) return 'B';
    const found = classSections.find(s => s.id === form.sectionId);
    if (found) return String(found.name || found.section_name || 'A').toUpperCase();
    return '';
  }, [form.sectionId, secA, secB, classSections]);

  // Change Handlers with synchronized targeting logic
  function handleAudienceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === 'SCHOOL' || val === 'TEACHER' || val === 'STUDENT' || val === 'PARENTS') {
      setForm(prev => ({ ...prev, audienceType: val, classId: '', sectionId: '' }));
    } else if (val === 'CLASS') {
      setForm(prev => ({ ...prev, audienceType: 'CLASS', sectionId: '' }));
    } else if (val === 'SECTION') {
      setForm(prev => ({ ...prev, audienceType: 'SECTION' }));
    }
  }

  function handleClassChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const chosenClassId = e.target.value;
    if (!chosenClassId) {
      setForm(prev => ({
        ...prev,
        classId: '',
        sectionId: '',
        audienceType: (prev.audienceType === 'CLASS' || prev.audienceType === 'SECTION') ? 'SCHOOL' : prev.audienceType
      }));
      return;
    }

    const targetClass = resolvedClasses.find(c => c.id === chosenClassId);
    const newClassSections = sections.filter(s => {
      if (s.class_id && s.class_id === chosenClassId) return true;
      if (s.classId && s.classId === chosenClassId) return true;
      if (targetClass && s.class_number !== undefined && Number(s.class_number) === targetClass.classNumber) return true;
      return false;
    });

    let newSectionId = '';
    if (selectedSectionLetter === 'A') {
      const a = newClassSections.find(s => String(s.name || s.section_name || '').toUpperCase() === 'A');
      newSectionId = a?.id || 'sec-a';
    } else if (selectedSectionLetter === 'B') {
      const b = newClassSections.find(s => String(s.name || s.section_name || '').toUpperCase() === 'B');
      newSectionId = b?.id || 'sec-b';
    }

    setForm(prev => ({
      ...prev,
      classId: chosenClassId,
      sectionId: newSectionId,
      audienceType: newSectionId ? 'SECTION' : (prev.audienceType === 'SECTION' ? 'SECTION' : 'CLASS')
    }));
  }

  function handleSectionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const letter = e.target.value;
    if (!letter) {
      setForm(prev => ({
        ...prev,
        sectionId: '',
        audienceType: prev.classId ? 'CLASS' : prev.audienceType
      }));
      return;
    }

    let targetSecId = '';
    if (letter === 'A') {
      targetSecId = secA?.id || (selectedClass ? `${selectedClass.id}-sec-a` : 'sec-a');
    } else if (letter === 'B') {
      targetSecId = secB?.id || (selectedClass ? `${selectedClass.id}-sec-b` : 'sec-b');
    }

    setForm(prev => ({
      ...prev,
      sectionId: targetSecId,
      audienceType: 'SECTION'
    }));
  }

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
    if (form.audienceType === 'CLASS' && !form.classId) {
      alert('Please select a target class (L-KG to Class 12).');
      return;
    }
    if (form.audienceType === 'SECTION' && (!form.classId || !form.sectionId)) {
      alert('Please select both Class (L-KG to 12) and Section (Section A or B).');
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

  const selectedClassName = selectedClass?.label || 'Not Selected';
  const selectedSectionDisplay = selectedSectionLetter ? `Section ${selectedSectionLetter}` : 'All Sections (A & B)';

  const previewSections: PreviewSectionData[] = [
    {
      title: 'Broadcast Scope & Delivery Target',
      fields: [
        { label: 'Audience Target', value: form.audienceType, type: 'badge', color: 'blue' },
        ...(form.audienceType === 'CLASS' || form.audienceType === 'SECTION'
          ? [{ label: 'Target Class', value: selectedClassName }]
          : []),
        ...(form.audienceType === 'SECTION'
          ? [
              { label: 'Target Section', value: selectedSectionDisplay },
              { label: 'Delivery Scope', value: `Strictly delivered to Class ${selectedClass?.classNumber === -1 ? 'L-KG' : selectedClass?.classNumber === 0 ? 'U-KG' : selectedClass?.classNumber}-${selectedSectionLetter} only (students & parents)` }
            ]
          : form.audienceType === 'CLASS'
          ? [{ label: 'Delivery Scope', value: `Delivered to all students & parents of ${selectedClassName}` }]
          : form.audienceType === 'TEACHER'
          ? [{ label: 'Delivery Scope', value: 'Delivered to all teachers and faculty' }]
          : form.audienceType === 'STUDENT'
          ? [{ label: 'Delivery Scope', value: 'Delivered to all students portal accounts' }]
          : form.audienceType === 'PARENTS'
          ? [{ label: 'Delivery Scope', value: 'Delivered to all parents portal accounts' }]
          : [{ label: 'Delivery Scope', value: 'Delivered school-wide to students, parents, and teachers' }]),
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
                    onChange={handleAudienceChange}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, minWidth: 155 }}
                  >
                    <option value="SCHOOL">SCHOOL (All)</option>
                    <option value="CLASS">CLASS (Specific Class)</option>
                    <option value="SECTION">SECTION (Class + Section)</option>
                    <option value="TEACHER">TEACHER (Faculty only)</option>
                    <option value="STUDENT">STUDENT (Student portal)</option>
                    <option value="PARENTS">PARENTS</option>
                  </select>
                </div>

                {/* Class selector: L-KG to Class 12 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: (form.audienceType === 'CLASS' || form.audienceType === 'SECTION') ? '#2563eb' : '#64748b'
                  }}>
                    CLASS {(form.audienceType === 'CLASS' || form.audienceType === 'SECTION') && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <select
                    value={form.classId}
                    onChange={handleClassChange}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: (form.audienceType === 'CLASS' || form.audienceType === 'SECTION') && !form.classId ? '1px solid #f87171' : '1px solid #cbd5e1',
                      fontSize: 13,
                      minWidth: 140,
                      backgroundColor: (form.audienceType === 'CLASS' || form.audienceType === 'SECTION') ? '#ffffff' : '#f8fafc'
                    }}
                  >
                    <option value="">{form.audienceType === 'CLASS' || form.audienceType === 'SECTION' ? 'Select Class (L-KG to 12)' : 'All Classes'}</option>
                    {resolvedClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Section selector: Section A or B */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: form.audienceType === 'SECTION' ? '#2563eb' : '#64748b'
                  }}>
                    SECTION {form.audienceType === 'SECTION' && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <select
                    value={selectedSectionLetter}
                    onChange={handleSectionChange}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: form.audienceType === 'SECTION' && !form.sectionId ? '1px solid #f87171' : '1px solid #cbd5e1',
                      fontSize: 13,
                      minWidth: 130,
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="">{form.audienceType === 'SECTION' ? 'Select Section (A / B)' : 'All Sections (A & B)'}</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                  </select>
                </div>

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

              {/* Informative Real-time Target Audience Indicator */}
              <div style={{
                padding: '10px 14px',
                borderRadius: 6,
                backgroundColor: form.audienceType === 'SECTION' ? '#f5f3ff' : form.audienceType === 'CLASS' ? '#f0f9ff' : '#f8fafc',
                border: form.audienceType === 'SECTION' ? '1px solid #ddd6fe' : form.audienceType === 'CLASS' ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                color: form.audienceType === 'SECTION' ? '#5b21b6' : form.audienceType === 'CLASS' ? '#0369a1' : '#334155',
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 2
              }}>
                <span style={{ fontWeight: 700 }}>🎯 Target Audience:</span>
                {form.audienceType === 'SECTION' && selectedClass && selectedSectionLetter ? (
                  <span>
                    <b>{selectedClass.label} · Section {selectedSectionLetter}</b> — The message will go <b>ONLY to {selectedClass.label}-{selectedSectionLetter}</b> (students and linked parents).
                  </span>
                ) : form.audienceType === 'SECTION' && selectedClass ? (
                  <span style={{ color: '#d97706' }}>
                    <b>{selectedClass.label}</b> selected. Please choose <b>Section A or Section B</b> to target that specific section.
                  </span>
                ) : form.audienceType === 'SECTION' ? (
                  <span style={{ color: '#d97706' }}>
                    Please select a <b>Class (L-KG to 12)</b> and <b>Section (A or B)</b>.
                  </span>
                ) : form.audienceType === 'CLASS' && selectedClass ? (
                  <span>
                    <b>{selectedClass.label} (All Sections)</b> — The message will go to all students and parents in {selectedClass.label}.
                  </span>
                ) : form.audienceType === 'CLASS' ? (
                  <span style={{ color: '#d97706' }}>
                    Please select a target <b>Class (L-KG to Class 12)</b>.
                  </span>
                ) : form.audienceType === 'TEACHER' ? (
                  <span><b>Faculty Only</b> — Visible exclusively to verified teachers.</span>
                ) : form.audienceType === 'STUDENT' ? (
                  <span><b>Student Portal</b> — Broadcast to all registered students across all classes.</span>
                ) : form.audienceType === 'PARENTS' ? (
                  <span><b>Parents Portal</b> — Broadcast to all parent accounts.</span>
                ) : (
                  <span><b>Entire School (All)</b> — Broadcast to all students, parents, and faculty school-wide.</span>
                )}
              </div>

              {form.priority === 'EMERGENCY' && (
                <div style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <AlertTriangle size={14} /> Emergency announcements automatically dispatch priority emails to all target audience accounts upon publication.
                </div>
              )}
            </div>
          </div>

          {/* Announcements Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              Published & Draft Notices ({items.length})
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Filter size={13} /> Filter:
              </span>
              {(['ALL', 'SCHOOL', 'CLASS', 'SECTION', 'TEACHER', 'STUDENT'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTableFilter(f)}
                  style={{
                    padding: '3px 9px',
                    borderRadius: 4,
                    fontSize: 11.5,
                    fontWeight: tableFilter === f ? 700 : 500,
                    backgroundColor: tableFilter === f ? '#2563eb' : '#f1f5f9',
                    color: tableFilter === f ? '#ffffff' : '#475569',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {f === 'ALL' ? 'All' : f}
                </button>
              ))}
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
                {items
                  .filter(x => {
                    if (tableFilter === 'ALL') return true;
                    return x.audience_type === tableFilter;
                  })
                  .map(x => {
                    // Resolve class and section names for audience badge
                    let clsLabel = '';
                    if (x.class_number !== undefined && x.class_number !== null) {
                      clsLabel = formatClassGrade(x.class_number);
                    } else if (x.class_id) {
                      const c = resolvedClasses.find(rc => rc.id === x.class_id);
                      if (c) clsLabel = c.label;
                    }

                    let secName = x.section_name || '';
                    if (!secName && x.section_id) {
                      const s = sections.find(rs => rs.id === x.section_id);
                      if (s) secName = s.name || s.section_name || '';
                    }

                    let audienceBadgeText = x.audience_type;
                    if (x.audience_type === 'SECTION') {
                      audienceBadgeText = `${clsLabel || 'Class'} · Sec ${secName || 'A'}`;
                    } else if (x.audience_type === 'CLASS') {
                      audienceBadgeText = `${clsLabel || 'Class'}`;
                    }

                    return (
                      <tr key={x.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a' }}>{x.title}</div>
                          <div style={{ fontSize: 12, color: '#64748b', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {x.message}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11.5,
                            fontWeight: 600,
                            backgroundColor:
                              x.audience_type === 'TEACHER' ? '#f0fdf4' :
                              x.audience_type === 'STUDENT' ? '#eff6ff' :
                              x.audience_type === 'PARENTS' ? '#fef3c7' :
                              x.audience_type === 'SECTION' ? '#f5f3ff' :
                              x.audience_type === 'CLASS' ? '#f0f9ff' : '#f1f5f9',
                            color:
                              x.audience_type === 'TEACHER' ? '#166534' :
                              x.audience_type === 'STUDENT' ? '#1e40af' :
                              x.audience_type === 'PARENTS' ? '#92400e' :
                              x.audience_type === 'SECTION' ? '#6b21a8' :
                              x.audience_type === 'CLASS' ? '#0369a1' : '#334155',
                            border: x.audience_type === 'SECTION' ? '1px solid #ddd6fe' : x.audience_type === 'CLASS' ? '1px solid #bae6fd' : 'none'
                          }}>
                            {audienceBadgeText}
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
                );
              })}
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
