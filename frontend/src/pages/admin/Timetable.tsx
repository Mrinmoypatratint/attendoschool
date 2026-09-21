import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { Calendar, Plus, Trash2, AlertTriangle, Clock, BookOpen, Users, User, RefreshCw, ChevronDown, Check, X, Layers, GraduationCap } from 'lucide-react';

const DAYS = [
  { num: 1, name: 'Monday', short: 'Mon' },
  { num: 2, name: 'Tuesday', short: 'Tue' },
  { num: 3, name: 'Wednesday', short: 'Wed' },
  { num: 4, name: 'Thursday', short: 'Thu' },
  { num: 5, name: 'Friday', short: 'Fri' },
  { num: 6, name: 'Saturday', short: 'Sat' }
];

export default function Timetable() {
  const { user } = useAuth();
  const isSchoolAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN';

  // ── State ──
  const [periods, setPeriods] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selDay, setSelDay] = useState(() => { const d = new Date().getDay(); return d === 0 || d > 6 ? 1 : d; });
  const [selClassId, setSelClassId] = useState('');
  const [selSectionId, setSelSectionId] = useState('');

  // Add entry modal
  const [addOpen, setAddOpen] = useState(false);
  const [entryForm, setEntryForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [msg, setMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  // Add period modal
  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState({ name: 'Period', periodNumber: 1, startTime: '09:00', endTime: '09:45', isBreak: false });

  // ── Load all data ──
  async function loadAll(initial = false) {
    if (initial) setLoading(true);
    try {
      const [pRes, eRes, cRes, sRes, subRes, tRes] = await Promise.all([
        api.get('/timetable/periods'),
        api.get('/timetable/entries'),
        api.get('/classes'),
        api.get('/sections'),
        api.get('/subjects'),
        api.get('/teachers')
      ]);
      if (Array.isArray(pRes.data)) setPeriods(pRes.data);
      if (Array.isArray(eRes.data)) setEntries(eRes.data);
      if (Array.isArray(cRes.data)) setClasses(cRes.data);
      if (Array.isArray(sRes.data)) setSections(sRes.data);
      if (Array.isArray(subRes.data)) setSubjects(subRes.data);
      if (Array.isArray(tRes.data)) setTeachers(tRes.data);
    } catch (err) {
      console.error('Timetable load error:', err);
    } finally {
      if (initial) setLoading(false);
    }
  }
  useEffect(() => { loadAll(true); }, []);

  // Set default class/section when data loads
  useEffect(() => {
    if (classes.length > 0 && !selClassId) setSelClassId(classes[0].id);
  }, [classes]);
  useEffect(() => {
    const avail = sections.filter(s => s.class_id === selClassId || String(s.class_number) === String(classes.find(c=>c.id===selClassId)?.class_number));
    if (avail.length > 0 && !avail.find(s => s.id === selSectionId)) setSelSectionId(avail[0].id);
  }, [selClassId, sections]);

  // ── Derived ──
  const selClassName = classes.find(c => c.id === selClassId)?.class_number || '';
  const selSectionName = sections.find(s => s.id === selSectionId)?.name || '';
  const filteredSections = sections.filter(s => s.class_id === selClassId || String(s.class_number) === String(selClassName));
  const teachingPeriods = useMemo(() => periods.filter(p => !(p.is_break ?? p.isBreak)), [periods]);

  const dayEntries = useMemo(() => {
    return entries
      .filter(e => (Number(e.day_of_week ?? e.dayOfWeek) === selDay) && (e.class_id || e.classId) === selClassId && (e.section_id || e.sectionId) === selSectionId)
      .sort((a: any, b: any) => (a.period_number ?? a.periodNumber ?? 0) - (b.period_number ?? b.periodNumber ?? 0));
  }, [entries, selDay, selClassId, selSectionId]);

  // Map period_id to entry for grid display
  const periodEntryMap = useMemo(() => {
    const m: Record<string, any> = {};
    dayEntries.forEach(e => {
      const pid = e.period_id || e.periodId;
      if (pid) m[pid] = e;
    });
    return m;
  }, [dayEntries]);

  // ── Check teacher busy status for a period ──
  function isTeacherBusy(teacherId: string, periodId: string, day: number, excludeEntryId?: string) {
    return entries.some(e =>
      Number(e.day_of_week ?? e.dayOfWeek) === day &&
      (e.period_id || e.periodId) === periodId &&
      (e.teacher_id === teacherId || e.substitute_teacher_id === teacherId) &&
      e.status !== 'CANCELLED' &&
      e.id !== excludeEntryId
    );
  }

  // ── Available teachers for a given period/day ──
  function getAvailableTeachers(periodId: string, day: number) {
    return teachers.map(t => ({
      ...t,
      busy: isTeacherBusy(t.id, periodId, day),
      busyWith: entries.find(e => Number(e.day_of_week ?? e.dayOfWeek) === day && (e.period_id || e.periodId) === periodId && e.teacher_id === t.id)
    }));
  }

  // ── Add Period ──
  async function addPeriod() {
    if (!isSchoolAdmin) return;
    try {
      const res = await api.post('/timetable/periods', periodForm);
      if (res.data && res.data.id) {
        setPeriods(prev => [...prev.filter(p => p.id !== res.data.id), res.data].sort((a,b) => (a.period_number ?? a.periodNumber ?? 0) - (b.period_number ?? b.periodNumber ?? 0)));
      }
      setMsg({ type: 'success', text: `Period slot "${periodForm.name}" created!` });
      const nextNum = (periodForm.periodNumber || periods.length) + 1;
      setPeriodForm({
        name: `Period ${nextNum}`,
        periodNumber: nextNum,
        startTime: periodForm.endTime || '10:00',
        endTime: '',
        isBreak: false
      });
      loadAll(false);
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Failed to create period' });
    }
  }

  // ── Template Periods ──
  async function loadTemplatePeriods() {
    if (!isSchoolAdmin) return;
    try {
      const res = await api.post('/timetable/periods/template');
      if (Array.isArray(res.data)) {
        setPeriods(res.data);
      }
      setMsg({ type: 'success', text: 'Loaded 6 standard periods and breaks. You can now manually assign entries.' });
      loadAll(false);
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Failed to load period template' });
    }
  }

  // ── Clear All Periods ──
  async function clearAllPeriods() {
    if (!isSchoolAdmin) return;
    if (!confirm('Clear all period slots? All timetable entries will also be removed.')) return;
    try {
      await api.delete('/timetable/periods/clear');
      await api.delete('/timetable/entries/clear');
      setPeriods([]);
      setEntries([]);
      setMsg({ type: 'success', text: 'All period slots and timetable entries cleared.' });
      loadAll(false);
    } catch {}
  }

  // ── Clear All Entries ──
  async function clearAllEntries() {
    if (!isSchoolAdmin) return;
    if (!confirm('Clear all timetable routine entries? Period time slots will be preserved.')) return;
    try {
      await api.delete('/timetable/entries/clear');
      setEntries([]);
      setMsg({ type: 'success', text: 'All timetable entries cleared.' });
      loadAll(false);
    } catch {}
  }

  // ── Delete Period ──
  async function deletePeriod(id: string) {
    if (!isSchoolAdmin) return;
    if (!confirm('Delete this period slot? Existing entries for this period will be orphaned.')) return;
    try {
      await api.delete(`/timetable/periods/${id}`);
      setPeriods(prev => prev.filter(p => p.id !== id));
      loadAll(false);
    } catch {}
  }

  // ── Open Add Entry Modal ──
  function openAddEntry(periodId?: string) {
    if (!isSchoolAdmin) return;
    const chosenPeriod = periodId || (teachingPeriods[0]?.id || '');
    setEntryForm({
      dayOfWeek: selDay,
      periodId: chosenPeriod,
      classId: selClassId,
      classNumber: selClassName,
      sectionId: selSectionId,
      sectionName: selSectionName,
      subjectId: '',
      teacherId: '',
      altTeacherId: '',
      altTeacherName: '',
      roomName: ''
    });
    setConflicts([]);
    setAddOpen(true);
  }

  // ── Save Entry ──
  async function saveEntry() {
    if (!isSchoolAdmin) return;
    if (!entryForm.periodId || !entryForm.subjectId || !entryForm.teacherId) {
      setMsg({ type: 'error', text: 'Period, Subject, and Teacher are required.' });
      return;
    }
    setSaving(true);
    try {
      const resp = await api.post('/timetable/entries', entryForm);
      if (resp.data) {
        setEntries(prev => [...prev.filter(e => e.id !== resp.data.id), resp.data]);
      }
      setAddOpen(false);
      setMsg({ type: 'success', text: 'Timetable entry created!' });
      loadAll(false);
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setConflicts(e.response.data.conflicts || []);
        setMsg({ type: 'error', text: e.response.data.message || 'Scheduling conflict detected!' });
      } else {
        setMsg({ type: 'error', text: e?.response?.data?.message || 'Failed to save entry' });
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Delete Entry ──
  async function deleteEntry(id: string) {
    if (!isSchoolAdmin) return;
    if (!confirm('Remove this timetable entry?')) return;
    try {
      await api.delete(`/timetable/entries/${id}`);
      setEntries(prev => prev.filter(e => e.id !== id));
      setMsg({ type: 'success', text: 'Entry removed.' });
      loadAll(false);
    } catch {}
  }

  // ── Available teachers for the add-entry form ──
  const formAvailableTeachers = entryForm.periodId
    ? getAvailableTeachers(entryForm.periodId, entryForm.dayOfWeek)
    : teachers.map(t => ({ ...t, busy: false }));

  const formAltTeachers = formAvailableTeachers.filter(t => t.id !== entryForm.teacherId);

  if (loading) return <div className="feature-page"><p className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading timetable data...</p></div>;

  return <div className="feature-page">
    {/* ── Header ── */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
      <div>
        <p className="eyebrow">{isSchoolAdmin ? 'TIMETABLE MANAGEMENT' : 'CLASS TIMETABLE'}</p>
        <h1 style={{ margin: 0, fontSize: 24 }}>Weekly Class Timetable</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {isSchoolAdmin
            ? 'Create and manage class-wise, period-wise timetable with faculty assignment and conflict detection.'
            : 'View class-wise, period-wise schedule with assigned subjects and faculty.'}
        </p>
      </div>
      {isSchoolAdmin && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setPeriodForm({ name: `Period ${periods.length + 1}`, periodNumber: periods.length + 1, startTime: '09:00', endTime: '09:45', isBreak: false }); setPeriodOpen(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Clock size={16} /> Manage Periods
          </button>
          <button onClick={() => openAddEntry()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff' }}
          >
            <Plus size={16} /> Add Entry
          </button>
        </div>
      )}
    </div>

    {/* ── Toast ── */}
    {msg && (
      <div style={{
        padding: '10px 14px', marginBottom: 14, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        background: msg.type === 'error' ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${msg.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
        color: msg.type === 'error' ? '#991b1b' : '#166534', fontSize: 13
      }}>
        <span>{msg.text}</span>
        <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit' }}>×</button>
      </div>
    )}

    {/* ── Filters: Class, Section, Day ── */}
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
        <Layers size={14} /> Class:
        <select value={selClassId} onChange={e => setSelClassId(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
          {classes.map(c => <option key={c.id} value={c.id}>Class {c.class_number}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
        Section:
        <select value={selSectionId} onChange={e => setSelSectionId(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
          {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
    </div>

    {/* ── Day Tabs ── */}
    <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
      {DAYS.map(d => (
        <button key={d.num}
          onClick={() => setSelDay(d.num)}
          style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            background: selDay === d.num ? '#2563eb' : 'var(--card)',
            color: selDay === d.num ? '#fff' : 'var(--text)',
            boxShadow: selDay === d.num ? '0 2px 8px rgba(37,99,235,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'all 0.15s ease'
          }}
        >{d.name}</button>
      ))}
    </div>

    {/* ── Period Grid for Selected Day ── */}
    <div className="panel" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>
          <Calendar size={16} style={{ marginRight: 6 }} />
          {DAYS.find(d => d.num === selDay)?.name} — Class {selClassName} Section {selSectionName}
        </h3>
        <span className="muted" style={{ fontSize: 12 }}>{dayEntries.length} of {teachingPeriods.length} periods assigned</span>
      </div>

      {periods.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--card)', borderRadius: 12, border: '1px dashed var(--border)', margin: '10px 0' }}>
          <Clock size={40} style={{ color: '#2563eb', marginBottom: 12, opacity: 0.9 }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>No Period Slots Configured</h3>
          <p className="muted" style={{ margin: '0 auto 20px', maxWidth: 500, fontSize: 13, lineHeight: 1.6 }}>
            {isSchoolAdmin
              ? 'This timetable is completely clean with no seed data. All periods and subject routines are entered manually by the administrator.'
              : 'No timetable period slots have been configured by the school administration yet.'}
          </p>
          {isSchoolAdmin && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => { setPeriodForm({ name: 'Period 1', periodNumber: 1, startTime: '09:00', endTime: '09:45', isBreak: false }); setPeriodOpen(true); }}
                style={{ background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
                <Plus size={16} /> Add First Period Slot
              </button>
              <button onClick={loadTemplatePeriods}
                style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
                ⚡ Load Standard 6-Period Template (Optional)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Period</th>
                <th>Time</th>
                <th>Subject</th>
                <th>Faculty</th>
                <th>Alt. Faculty</th>
                <th>Room</th>
                {isSchoolAdmin && <th style={{ width: 80, textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {periods.map(p => {
                const entry = periodEntryMap[p.id];
                const pNum = p.period_number ?? p.periodNumber ?? '';
                const pName = p.name || `Period ${pNum}`;
                const pStart = p.start_time ?? p.startTime ?? '';
                const pEnd = p.end_time ?? p.endTime ?? '';
                const pBreak = Boolean(p.is_break ?? p.isBreak);

                if (pBreak) {
                  return <tr key={p.id} style={{ background: 'var(--bg)', opacity: 0.7 }}>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{pNum}</td>
                    <td colSpan={6} style={{ textAlign: 'center', fontStyle: 'italic' }}>☕ {pName} ({pStart} – {pEnd})</td>
                    {isSchoolAdmin && <td></td>}
                  </tr>;
                }
                if (entry) {
                  return <tr key={p.id}>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{pNum}</td>
                    <td><b>{pName}</b></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pStart} – {pEnd}</td>
                    <td><span className="badge" style={{ background: 'rgba(37,99,235,0.12)', color: '#2563eb', fontWeight: 600 }}>{entry.subject_name || '—'}</span></td>
                    <td><span style={{ fontWeight: 600 }}>{entry.teacher_name || '—'}</span></td>
                    <td>{entry.substitute_teacher_name ? <span className="badge" style={{ background: 'rgba(249,115,22,0.12)', color: '#ea580c', fontSize: 11 }}>Alt: {entry.substitute_teacher_name}</span> : <span className="muted">—</span>}</td>
                    <td>{entry.room_name || '—'}</td>
                    {isSchoolAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <button className="table-action-btn danger" onClick={() => deleteEntry(entry.id)} title="Remove entry"><Trash2 size={14} /></button>
                      </td>
                    )}
                  </tr>;
                }
                return <tr key={p.id} style={{ opacity: 0.7 }}>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{pNum}</td>
                  <td><b>{pName}</b></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pStart} – {pEnd}</td>
                  <td colSpan={4} style={{ textAlign: 'center' }}>
                    {isSchoolAdmin ? (
                      <button onClick={() => openAddEntry(p.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 14px', borderRadius: 6, border: '1px dashed #2563eb', background: 'rgba(37,99,235,0.06)', cursor: 'pointer', color: '#2563eb', fontWeight: 600 }}
                      >
                        <Plus size={13} /> Assign Faculty & Subject
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>Unassigned</span>
                    )}
                  </td>
                  {isSchoolAdmin && <td></td>}
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* ── All Entries Overview ── */}
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>All Timetable Entries (Class {selClassName}-{selSectionName})</h3>
        {isSchoolAdmin && entries.length > 0 && (
          <button onClick={clearAllEntries} style={{ background: 'none', border: '1px solid #fecaca', color: '#dc2626', fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Trash2 size={12} /> Clear All Entries
          </button>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Day</th><th>Period</th><th>Time</th><th>Subject</th><th>Faculty</th><th>Alt. Faculty</th><th>Room</th><th>Status</th></tr></thead>
          <tbody>
            {entries
              .filter(e => e.class_id === selClassId && e.section_id === selSectionId)
              .sort((a, b) => a.day_of_week - b.day_of_week || (a.period_number || 0) - (b.period_number || 0))
              .map(e => (
                <tr key={e.id}>
                  <td>{DAYS.find(d => d.num === e.day_of_week)?.short || e.day_of_week}</td>
                  <td>{e.period_name || '—'}</td>
                  <td style={{ fontSize: 12 }}>{e.start_time} – {e.end_time}</td>
                  <td><b>{e.subject_name || '—'}</b></td>
                  <td>{e.teacher_name || '—'}</td>
                  <td>{e.substitute_teacher_name || '—'}</td>
                  <td>{e.room_name || '—'}</td>
                  <td><span className={`badge ${e.status === 'PUBLISHED' ? 'sent' : 'queued'}`}>{e.status}</span></td>
                </tr>
              ))}
            {entries.filter(e => e.class_id === selClassId && e.section_id === selSectionId).length === 0 && (
              <tr>
                <td colSpan={8} className="muted" style={{ padding: 20, textAlign: 'center' }}>
                  {isSchoolAdmin
                    ? `No routine entries for Class ${selClassName}-${selSectionName} yet. Click "+ Assign Faculty & Subject" above to add.`
                    : `No routine entries for Class ${selClassName}-${selSectionName} scheduled yet.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    {/* ══════════ ADD ENTRY MODAL ══════════ */}
    {isSchoolAdmin && addOpen && <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 18 }}>Add Timetable Entry</h3>
          <button className="modal-close" onClick={() => setAddOpen(false)}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {teachingPeriods.length === 0 ? (
            <div style={{ padding: '14px 16px', borderRadius: 8, background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', fontSize: 13 }}>
              <strong>⚠️ No period slots configured</strong>
              <p style={{ margin: '6px 0 10px', fontSize: 12, lineHeight: 1.5 }}>You must define period time slots before assigning faculty and subjects.</p>
              <button onClick={() => { setAddOpen(false); setPeriodOpen(true); }}
                style={{ fontSize: 12, padding: '6px 12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                Configure Period Slots Now →
              </button>
            </div>
          ) : (
            <>
              {/* Day */}
              <label style={{ fontSize: 13, fontWeight: 600 }}>Day of Week
                <select value={entryForm.dayOfWeek} onChange={e => setEntryForm({ ...entryForm, dayOfWeek: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                  {DAYS.map(d => <option key={d.num} value={d.num}>{d.name}</option>)}
                </select>
              </label>

              {/* Period */}
              <label style={{ fontSize: 13, fontWeight: 600 }}>Period Slot *
                <select value={entryForm.periodId} onChange={e => setEntryForm({ ...entryForm, periodId: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                  <option value="">— Select Period —</option>
                  {teachingPeriods.map(p => {
                    const pid = p.id;
                    const pNum = p.period_number ?? p.periodNumber ?? '';
                    const pName = p.name || `Period ${pNum}`;
                    const pStart = p.start_time ?? p.startTime ?? '';
                    const pEnd = p.end_time ?? p.endTime ?? '';
                    const taken = entries.some(ent => (Number(ent.day_of_week ?? ent.dayOfWeek) === entryForm.dayOfWeek) && ((ent.period_id || ent.periodId) === pid) && ((ent.class_id || ent.classId) === entryForm.classId) && ((ent.section_id || ent.sectionId) === entryForm.sectionId));
                    return <option key={pid} value={pid} disabled={taken}>{pName} ({pStart}–{pEnd}){taken ? ' ✘ Taken' : ''}</option>;
                  })}
                </select>
              </label>

              {/* Class & Section (read-only context) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Class
                  <select value={entryForm.classId} onChange={e => { const c = classes.find(x=>x.id===e.target.value); setEntryForm({ ...entryForm, classId: e.target.value, classNumber: c?.class_number }); }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                    {classes.map(c => <option key={c.id} value={c.id}>Class {c.class_number}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Section
                  <select value={entryForm.sectionId} onChange={e => { const s = sections.find(x=>x.id===e.target.value); setEntryForm({ ...entryForm, sectionId: e.target.value, sectionName: s?.name }); }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                    {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              </div>

              {/* Subject */}
              <label style={{ fontSize: 13, fontWeight: 600 }}><BookOpen size={13} style={{ marginRight: 4 }} />Subject *
                <select value={entryForm.subjectId} onChange={e => setEntryForm({ ...entryForm, subjectId: e.target.value, subjectName: subjects.find(s=>s.id===e.target.value)?.name })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                  <option value="">— Select Subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>

              {/* Faculty (with availability) */}
              <label style={{ fontSize: 13, fontWeight: 600 }}><GraduationCap size={13} style={{ marginRight: 4 }} />Faculty (Teacher) *
                <select value={entryForm.teacherId} onChange={e => setEntryForm({ ...entryForm, teacherId: e.target.value, teacherName: teachers.find(t=>t.id===e.target.value)?.name })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                  <option value="">— Select Teacher —</option>
                  {formAvailableTeachers.map(t => (
                    <option key={t.id} value={t.id} disabled={t.busy}>
                      {t.name} ({t.employee_id}){t.busy ? ` ✘ Busy: ${t.busyWith?.subject_name || 'Occupied'}` : ' ✓ Available'}
                    </option>
                  ))}
                </select>
              </label>

              {/* Alternative Faculty */}
              <label style={{ fontSize: 13, fontWeight: 600 }}><Users size={13} style={{ marginRight: 4 }} />Alternative Faculty (Optional)
                <select value={entryForm.altTeacherId || ''} onChange={e => {
                  const altT = teachers.find(t => t.id === e.target.value);
                  setEntryForm({ ...entryForm, altTeacherId: e.target.value || null, altTeacherName: altT?.name || null });
                }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                  <option value="">— No Alternative —</option>
                  {formAltTeachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.employee_id}){t.busy ? ' ⚠ Currently Busy' : ' ✓ Available'}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                  Alternative faculty can substitute when the primary teacher is unavailable.
                </span>
              </label>

              {/* Room */}
              <label style={{ fontSize: 13, fontWeight: 600 }}>Room / Lab
                <input value={entryForm.roomName || ''} onChange={e => setEntryForm({ ...entryForm, roomName: e.target.value })}
                  placeholder="e.g. Room 101, Lab 2" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }} />
              </label>

              {/* Conflict warnings */}
              {conflicts.length > 0 && (
                <div style={{ padding: 10, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12 }}>
                  <AlertTriangle size={14} style={{ color: '#dc2626', marginRight: 4 }} />
                  <b>Scheduling Conflicts:</b>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {conflicts.map((c, i) => <li key={i}>{c.details || c.conflict_type}</li>)}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button onClick={() => setAddOpen(false)} style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}>Cancel</button>
                <button onClick={saveEntry} disabled={saving}
                  style={{ background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {saving ? <><RefreshCw size={14} className="spin" /> Saving...</> : <><Check size={14} /> Create Entry</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>}

    {/* ══════════ PERIOD MANAGEMENT MODAL ══════════ */}
    {isSchoolAdmin && periodOpen && <div className="modal-backdrop" onClick={() => setPeriodOpen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 18 }}>Period Slots</h3>
          <button className="modal-close" onClick={() => setPeriodOpen(false)}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {/* Existing Periods */}
          <div className="table-wrap" style={{ marginBottom: 12, maxHeight: 260, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Start</th><th>End</th><th>Break</th><th></th></tr></thead>
              <tbody>
                {periods.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.period_number ?? p.periodNumber ?? '—'}</td>
                    <td>{p.name}</td>
                    <td>{p.start_time ?? p.startTime ?? '—'}</td>
                    <td>{p.end_time ?? p.endTime ?? '—'}</td>
                    <td>{(p.is_break ?? p.isBreak) ? '☕ Yes' : 'No'}</td>
                    <td><button className="table-action-btn danger" onClick={() => deletePeriod(p.id)} title="Delete"><Trash2 size={13} /></button></td>
                  </tr>
                ))}
                {periods.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ padding: 20, textAlign: 'center' }}>
                      No periods configured yet. Enter slots manually below or click template.
                      <div style={{ marginTop: 8 }}>
                        <button onClick={loadTemplatePeriods} style={{ fontSize: 12, padding: '4px 10px', background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                          ⚡ Load Standard 6 Periods
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {periods.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <button onClick={clearAllPeriods} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Trash2 size={12} /> Clear All Period Slots
              </button>
            </div>
          )}

          {/* Add new period form */}
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Add New Period Slot</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 8, marginBottom: 8 }}>
            <input value={periodForm.name} onChange={e => setPeriodForm({ ...periodForm, name: e.target.value })} placeholder="Slot Name (e.g. Period 1)" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }} />
            <input type="number" value={periodForm.periodNumber} onChange={e => setPeriodForm({ ...periodForm, periodNumber: +e.target.value })} placeholder="#" style={{ padding: '6px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, textAlign: 'center' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 10 }}>
            <input type="time" value={periodForm.startTime} onChange={e => setPeriodForm({ ...periodForm, startTime: e.target.value })} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }} />
            <input type="time" value={periodForm.endTime} onChange={e => setPeriodForm({ ...periodForm, endTime: e.target.value })} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={periodForm.isBreak} onChange={e => setPeriodForm({ ...periodForm, isBreak: e.target.checked })} /> Break
            </label>
          </div>
          <button onClick={addPeriod} style={{ width: '100%', background: '#2563eb', color: '#fff' }}>Add Period Slot</button>
        </div>
      </div>
    </div>}
  </div>;
}
