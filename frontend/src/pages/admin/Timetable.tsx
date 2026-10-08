import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { Calendar, Plus, Trash2, AlertTriangle, Clock, BookOpen, Users, User, RefreshCw, ChevronDown, Check, X, Layers, GraduationCap, ClipboardCheck, Sparkles, Pencil } from 'lucide-react';

const DAYS = [
  { num: 1, name: 'Monday', short: 'Mon' },
  { num: 2, name: 'Tuesday', short: 'Tue' },
  { num: 3, name: 'Wednesday', short: 'Wed' },
  { num: 4, name: 'Thursday', short: 'Thu' },
  { num: 5, name: 'Friday', short: 'Fri' },
  { num: 6, name: 'Saturday', short: 'Sat' }
];

const STANDARD_FALLBACK_CLASSES = [
  { id: 'cls-lkg', class_number: -1, label: 'L-KG' },
  { id: 'cls-ukg', class_number: 0, label: 'U-KG' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({ id: `cls-${n}`, class_number: n, label: `Class ${n}` }))
];

const parseClassNum = (val: any): number | null => {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const str = String(val).trim();
  if (!isNaN(Number(str))) return Number(str);
  const match = str.match(/(?:class|cls)?\s*[-_]?\s*(-?\d+)/i);
  if (match) return Number(match[1]);
  return null;
};

const parseSecName = (val: any): string => {
  if (!val) return '';
  return String(val)
    .trim()
    .replace(/^section\s*[-_]?\s*/i, '')
    .trim()
    .toUpperCase();
};

export default function Timetable() {
  const { user } = useAuth();
  const isSchoolAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isTeacher = user?.role === 'TEACHER';

  // ── State ──
  const [periods, setPeriods] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>(STANDARD_FALLBACK_CLASSES);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [viewMode, setViewMode] = useState<'class' | 'mySchedule'>('class');

  // Filters
  const [selDay, setSelDay] = useState(() => { const d = new Date().getDay(); return d === 0 || d > 6 ? 1 : d; });
  const [selClassId, setSelClassId] = useState<string>(STANDARD_FALLBACK_CLASSES[0].id);
  const [selSectionId, setSelSectionId] = useState<string>('');

  // Add entry modal
  const [addOpen, setAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
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
        api.get('/timetable/periods').catch(() => ({ data: [] })),
        api.get('/timetable/entries').catch(() => ({ data: [] })),
        api.get('/classes').catch(() => ({ data: [] })),
        api.get('/sections').catch(() => ({ data: [] })),
        api.get('/subjects').catch(() => ({ data: [] })),
        api.get('/teachers').catch(() => ({ data: [] }))
      ]);
      if (Array.isArray(pRes.data) && pRes.data.length > 0) setPeriods(pRes.data);
      if (Array.isArray(eRes.data)) setEntries(eRes.data);
      if (Array.isArray(cRes.data) && cRes.data.length > 0) {
        setClasses(cRes.data);
        setSelClassId(prev => (prev && cRes.data.some((c: any) => c.id === prev) ? prev : cRes.data[0].id));
      }
      if (Array.isArray(sRes.data) && sRes.data.length > 0) setSections(sRes.data);
      if (Array.isArray(subRes.data)) setSubjects(subRes.data);
      if (Array.isArray(tRes.data)) setTeachers(tRes.data);
    } catch (err) {
      console.error('Timetable load error:', err);
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(true);
    const onFocus = () => { loadAll(false); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Ensure default class if not set
  useEffect(() => {
    if (classes.length > 0 && (!selClassId || !classes.some(c => c.id === selClassId))) {
      setSelClassId(classes[0].id);
    }
  }, [classes, selClassId]);

  // Teacher identity helper
  const isMyEntry = (entry: any) => {
    if (!isTeacher || !entry) return false;
    const tId = String(entry.teacher_id || entry.teacherId || '');
    const subId = String(entry.substitute_teacher_id || entry.altTeacherId || entry.substituteTeacherId || '');
    const tName = (entry.teacher_name || entry.teacherName || '').toLowerCase().trim();
    const subName = (entry.substitute_teacher_name || entry.altTeacherName || '').toLowerCase().trim();
    const uName = (user?.name || '').toLowerCase().trim();
    const uId = String(user?.id || '');
    const uTeacherId = String((user as any)?.teacher_id || '');

    if (tId && (tId === uId || (uTeacherId && tId === uTeacherId))) return true;
    if (subId && (subId === uId || (uTeacherId && subId === uTeacherId))) return true;
    if (tName && uName && (tName === uName || tName.includes(uName) || uName.includes(tName))) return true;
    if (subName && uName && (subName === uName || subName.includes(uName) || uName.includes(subName))) return true;
    return false;
  };

  // Auto-select the teacher's assigned class on initial load
  useEffect(() => {
    if (isTeacher && !hasAutoSelected && entries.length > 0 && classes.length > 0) {
      const myEntry = entries.find(e => isMyEntry(e));
      if (myEntry) {
        const cId = myEntry.class_id || myEntry.classId;
        const sId = myEntry.section_id || myEntry.sectionId;
        if (cId && classes.some(c => c.id === cId)) {
          setSelClassId(cId);
          if (sId) setSelSectionId(sId);
          if (myEntry.day_of_week) setSelDay(Number(myEntry.day_of_week));
        }
      }
      setHasAutoSelected(true);
    }
  }, [entries, isTeacher, classes, hasAutoSelected]);

  // All weekly entries assigned to the teacher
  const myWeeklyEntries = useMemo(() => {
    if (!isTeacher) return [];
    return entries
      .filter(e => isMyEntry(e))
      .sort((a, b) => (Number(a.day_of_week ?? a.dayOfWeek ?? 0) - Number(b.day_of_week ?? b.dayOfWeek ?? 0)) ||
                      (Number(a.period_number ?? a.periodNumber ?? 0) - Number(b.period_number ?? b.periodNumber ?? 0)) ||
                      (a.start_time || '').localeCompare(b.start_time || ''));
  }, [entries, isTeacher]);

  // ── Derived ──
  const selClassObj = classes.find(c => c.id === selClassId);
  const selClassNum = selClassObj?.class_number ?? selClassObj?.classNumber;
  const selClassName = selClassObj?.label || (selClassNum !== undefined && selClassNum !== null
    ? (selClassNum === -1 ? 'L-KG' : selClassNum === 0 ? 'U-KG' : `Class ${selClassNum}`)
    : (selClassObj?.name || 'Class'));
  const displayClassLabel = selClassName.toLowerCase().startsWith('class') ? selClassName : `Class ${selClassName}`;

  const filteredSections = useMemo(() => {
    let list = sections.filter(s =>
      (s.class_id && s.class_id === selClassId) ||
      (s.classId && s.classId === selClassId) ||
      (selClassNum !== undefined && selClassNum !== null && String(s.class_number ?? s.classNumber) === String(selClassNum))
    );

    // If no sections in DB yet for this class, or only Section A exists, ensure Section A & Section B are available
    if (list.length === 0) {
      return [
        { id: `${selClassId}-sec-a`, name: 'A', section_name: 'A' },
        { id: `${selClassId}-sec-b`, name: 'B', section_name: 'B' }
      ];
    }
    const hasA = list.some(s => (s.name || s.section_name || '').toUpperCase() === 'A');
    const hasB = list.some(s => (s.name || s.section_name || '').toUpperCase() === 'B');
    if (hasA && !hasB) {
      list = [...list, { id: `${selClassId}-sec-b`, name: 'B', section_name: 'B' }];
    } else if (!hasA && hasB) {
      list = [{ id: `${selClassId}-sec-a`, name: 'A', section_name: 'A' }, ...list];
    }
    return list;
  }, [sections, selClassId, selClassNum]);

  // Keep selSectionId in sync with filteredSections
  useEffect(() => {
    if (filteredSections.length > 0 && (!selSectionId || !filteredSections.some(s => s.id === selSectionId))) {
      setSelSectionId(filteredSections[0].id);
    }
  }, [filteredSections, selSectionId]);

  const currentSection = filteredSections.find(s => s.id === selSectionId) || filteredSections[0];
  const selSection = currentSection;
  const selSectionName = currentSection?.name || currentSection?.section_name || 'A';
  const teachingPeriods = useMemo(() => periods.filter(p => !(p.is_break ?? p.isBreak)), [periods]);

  const isEntryForCurrentClassAndSection = (e: any) => {
    // 1. Class Matching
    const entryClassId = e.class_id || e.classId;
    const entryClassNum = parseClassNum(e.class_number ?? e.classNumber);
    const targetClassNum = selClassNum !== undefined && selClassNum !== null ? parseClassNum(selClassNum) : parseClassNum(selClassName);

    const matchClass = (Boolean(entryClassId) && Boolean(selClassId) && entryClassId === selClassId) ||
      (entryClassNum !== null && targetClassNum !== null && entryClassNum === targetClassNum);
    if (!matchClass) return false;

    // 2. Section Matching
    const entrySecId = e.section_id || e.sectionId;
    const entrySecNorm = parseSecName(e.section_name || e.sectionName);
    const targetSecNorm = parseSecName(selSectionName || selSection?.name || selSection?.section_name);

    if (selSectionId || selSectionName) {
      const matchSecId = Boolean(entrySecId) && Boolean(selSectionId) && entrySecId === selSectionId;
      const matchSecNorm = Boolean(entrySecNorm) && Boolean(targetSecNorm) && entrySecNorm === targetSecNorm;
      if (!matchSecId && !matchSecNorm) return false;
    }
    return true;
  };

  const dayEntries = useMemo(() => {
    return entries
      .filter(e => {
        if (Number(e.day_of_week ?? e.dayOfWeek) !== selDay) return false;
        return isEntryForCurrentClassAndSection(e);
      })
      .sort((a: any, b: any) => (a.period_number ?? a.periodNumber ?? 0) - (b.period_number ?? b.periodNumber ?? 0));
  }, [entries, selDay, selClassId, selSectionId, selClassName, selSection, selClassNum, selSectionName]);

  // Centralized Helper: Normalize time strings (e.g. '09:00:00' -> '09:00')
  const normalizeTime = (t: any): string => {
    if (!t) return '';
    const str = String(t).trim();
    const parts = str.split(':');
    if (parts.length >= 2) {
      const hh = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      return `${hh}:${mm}`;
    }
    return str;
  };

  // Centralized Helper: Extract period slot number from template IDs (e.g. 'prd-abc123-t1' -> 1)
  const extractTemplatePeriodNum = (periodId: any): number | null => {
    if (!periodId) return null;
    const str = String(periodId).trim();
    const match = str.match(/[-_]t(\d+)$/i) || str.match(/[-_]p(\d+)$/i) || str.match(/t(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      return isNaN(num) ? null : num;
    }
    return null;
  };

  // Centralized Helper: Match an entry to a period using strict multi-tier fallback priority
  const findEntryForPeriod = (p: any, availableEntries: any[]): any => {
    if (!p || !Array.isArray(availableEntries) || availableEntries.length === 0) return undefined;

    const targetPid = p.id;
    const targetPNum = Number(p.period_number ?? p.periodNumber);
    const targetStart = normalizeTime(p.start_time ?? p.startTime);
    const targetEnd = normalizeTime(p.end_time ?? p.endTime);

    // 1. EXACT PERIOD ID MATCH
    const exactMatch = availableEntries.find(e => {
      const ePid = e.period_id || e.periodId;
      return Boolean(ePid) && Boolean(targetPid) && ePid === targetPid;
    });
    if (exactMatch) return exactMatch;

    // 2. PERIOD NUMBER MATCH
    if (!isNaN(targetPNum) && targetPNum > 0) {
      const numMatch = availableEntries.find(e => {
        const ePNum = Number(e.period_number ?? e.periodNumber);
        return !isNaN(ePNum) && ePNum > 0 && ePNum === targetPNum;
      });
      if (numMatch) return numMatch;
    }

    // 3. DYNAMIC START/END TIME MATCH
    if (targetStart && targetEnd) {
      const timeMatch = availableEntries.find(e => {
        const eStart = normalizeTime(e.start_time ?? e.startTime);
        const eEnd = normalizeTime(e.end_time ?? e.endTime);
        return Boolean(eStart) && Boolean(eEnd) && eStart === targetStart && eEnd === targetEnd;
      });
      if (timeMatch) return timeMatch;
    }

    // 4. TEMPLATE PERIOD ID SUFFIX MATCH
    if (!isNaN(targetPNum) && targetPNum > 0) {
      const suffixMatch = availableEntries.find(e => {
        const ePid = e.period_id || e.periodId;
        const extractedNum = extractTemplatePeriodNum(ePid);
        return extractedNum !== null && extractedNum === targetPNum;
      });
      if (suffixMatch) return suffixMatch;
    }

    return undefined;
  };

  const getEntryForPeriod = (p: any) => {
    return findEntryForPeriod(p, dayEntries);
  };

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
  function getAvailableTeachers(periodId: string, day: number, excludeEntryId?: string) {
    return teachers.map(t => ({
      ...t,
      busy: isTeacherBusy(t.id, periodId, day, excludeEntryId),
      busyWith: entries.find(e => Number(e.day_of_week ?? e.dayOfWeek) === day && (e.period_id || e.periodId) === periodId && (e.teacher_id === t.id || e.substitute_teacher_id === t.id) && e.id !== excludeEntryId)
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
    setEditingEntry(null);
    const chosenPeriod = periodId || (teachingPeriods[0]?.id || '');
    setEntryForm({
      dayOfWeek: selDay,
      periodId: chosenPeriod,
      classId: selClassId,
      classNumber: selClassNum !== undefined && selClassNum !== null ? selClassNum : selClassName,
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

  // ── Open Edit Entry Modal ──
  function openEditEntry(entry: any) {
    if (!isSchoolAdmin || !entry) return;
    setEditingEntry(entry);

    const eDay = Number(entry.day_of_week ?? entry.dayOfWeek ?? selDay);
    const ePeriodId = entry.period_id || entry.periodId || '';
    const eClassId = entry.class_id || entry.classId || selClassId;
    const eClassNum = entry.class_number ?? entry.classNumber ?? selClassNum;
    const eSectionId = entry.section_id || entry.sectionId || selSectionId;
    const eSectionName = entry.section_name || entry.sectionName || selSectionName;

    setEntryForm({
      dayOfWeek: eDay,
      periodId: ePeriodId,
      classId: eClassId,
      classNumber: eClassNum,
      sectionId: eSectionId,
      sectionName: eSectionName,
      subjectId: entry.subject_id || entry.subjectId || '',
      subjectName: entry.subject_name || entry.subjectName || '',
      teacherId: entry.teacher_id || entry.teacherId || '',
      teacherName: entry.teacher_name || entry.teacherName || '',
      altTeacherId: entry.substitute_teacher_id || entry.altTeacherId || entry.substituteTeacherId || '',
      altTeacherName: entry.substitute_teacher_name || entry.altTeacherName || '',
      roomName: entry.room_name || entry.roomName || ''
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
      const selectedPeriod = periods.find(p => p.id === entryForm.periodId);
      const payload = {
        ...entryForm,
        periodNumber: selectedPeriod?.period_number ?? selectedPeriod?.periodNumber ?? null,
        period_number: selectedPeriod?.period_number ?? selectedPeriod?.periodNumber ?? null,
        start_time: selectedPeriod?.start_time ?? selectedPeriod?.startTime ?? null,
        end_time: selectedPeriod?.end_time ?? selectedPeriod?.endTime ?? null
      };

      if (editingEntry) {
        const resp = await api.put(`/timetable/entries/${editingEntry.id}`, payload);
        if (resp.data) {
          setEntries(prev => prev.map(e => e.id === resp.data.id ? resp.data : e));
        }
        setAddOpen(false);
        setEditingEntry(null);
        setMsg({ type: 'success', text: 'Timetable entry updated!' });
      } else {
        const resp = await api.post('/timetable/entries', payload);
        if (resp.data) {
          setEntries(prev => [...prev.filter(e => e.id !== resp.data.id), resp.data]);
        }
        setAddOpen(false);
        setMsg({ type: 'success', text: 'Timetable entry created!' });
      }
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
    ? getAvailableTeachers(entryForm.periodId, entryForm.dayOfWeek, editingEntry?.id)
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

    {/* ── Teacher View Switcher (Class View vs My Schedule) ── */}
    {isTeacher && (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => setViewMode('class')}
            style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: viewMode === 'class' ? '#2563eb' : 'transparent',
              color: viewMode === 'class' ? '#fff' : 'var(--text)'
            }}
          >
            Class Timetable View
          </button>
          <button
            onClick={() => setViewMode('mySchedule')}
            style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: viewMode === 'mySchedule' ? '#2563eb' : 'transparent',
              color: viewMode === 'mySchedule' ? '#fff' : 'var(--text)',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Sparkles size={14} /> My Teaching Schedule ({myWeeklyEntries.length})
          </button>
        </div>
      </div>
    )}

    {/* ── Dedicated View: My Teaching Schedule ── */}
    {isTeacher && viewMode === 'mySchedule' ? (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>My Assigned Teaching Routine ({myWeeklyEntries.length} Periods)</h3>
            <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>
              All periods assigned to you by school administration across Monday to Saturday. Click "Take Attendance" to mark roll-call.
            </p>
          </div>
          <a
            href="#/take-attendance"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6,
              background: '#2563eb', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 600
            }}
          >
            <ClipboardCheck size={14} /> Open Attendance Station
          </a>
        </div>

        {myWeeklyEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--bg-card, #ffffff)', borderRadius: 10, border: '1px dashed var(--border)' }}>
            <Calendar size={36} style={{ color: '#2563eb', marginBottom: 10, opacity: 0.8 }} />
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>No routine periods assigned yet</p>
            <p className="muted" style={{ margin: '0 auto', maxWidth: 450, fontSize: 13 }}>
              Your school administrator has not scheduled any routine periods for your faculty account yet. You can still view the school timetable under "Class Timetable View".
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Period</th>
                  <th>Time</th>
                  <th>Class & Section</th>
                  <th>Subject</th>
                  <th>Room</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'right', width: 140 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {myWeeklyEntries.map(e => {
                  const dayName = DAYS.find(d => d.num === Number(e.day_of_week ?? e.dayOfWeek))?.name || `Day ${e.day_of_week}`;
                  const isSub = Boolean(e.substitute_teacher_id && String(e.substitute_teacher_id) === String(user?.id));
                  return (
                    <tr key={e.id} style={{ background: 'rgba(16, 185, 129, 0.03)' }}>
                      <td><b>{dayName}</b></td>
                      <td>{e.period_name || `Period ${e.period_number || 1}`}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.start_time} – {e.end_time}</td>
                      <td><span className="badge" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 700 }}>{String(e.class_number || '').toLowerCase().startsWith('class') ? e.class_number : `Class ${e.class_number}`}-{e.section_name}</span></td>
                      <td><b>{e.subject_name || '—'}</b></td>
                      <td>{e.room_name || '—'}</td>
                      <td>
                        {isSub ? (
                          <span className="badge" style={{ background: 'rgba(249,115,22,0.12)', color: '#ea580c', fontSize: 11 }}>Substitute</span>
                        ) : (
                          <span className="badge" style={{ background: '#d1fae5', color: '#065f46', fontSize: 11 }}>Faculty</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <a
                          href={`#/take-attendance?routine=${e.id}&classId=${e.class_id || e.classId}&sectionId=${e.section_id || e.sectionId}&subjectId=${e.subject_id || e.subjectId}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '6px 12px',
                            borderRadius: 6,
                            background: '#10b981',
                            color: '#fff',
                            textDecoration: 'none',
                            fontSize: 12,
                            fontWeight: 600
                          }}
                        >
                          <ClipboardCheck size={13} /> Take Attendance
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    ) : (
      <>
        {/* ── Filters: Class & Section Aligned on Same Level ── */}
        <div className="timetable-filter-pill">
          {/* Class Field */}
          <div className="timetable-filter-field">
            <span className="timetable-filter-label">
              <Layers size={16} color="#2563eb" /> Class:
            </span>
            <select
              id="timetable-class-select"
              value={selClassId}
              onChange={e => setSelClassId(e.target.value)}
              className="timetable-filter-select"
              style={{ minWidth: 160 }}
            >
              {classes.map(c => {
                const cNum = c.class_number ?? c.classNumber;
                const label = c.label || (cNum === -1 ? 'L-KG' : cNum === 0 ? 'U-KG' : cNum !== undefined ? `Class ${cNum}` : c.name || 'Class');
                return (
                  <option key={c.id} value={c.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Vertical Divider */}
          <div className="timetable-filter-divider" />

          {/* Section Field */}
          <div className="timetable-filter-field">
            <span className="timetable-filter-label">
              Section:
            </span>
            <select
              id="timetable-section-select"
              value={selSectionId}
              onChange={e => setSelSectionId(e.target.value)}
              className="timetable-filter-select"
              style={{ minWidth: 140 }}
            >
              {filteredSections.map(s => (
                <option key={s.id} value={s.id}>
                  Section {s.name || s.section_name || 'A'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Day Tabs ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
          {DAYS.map(d => (
            <button key={d.num}
              onClick={() => setSelDay(d.num)}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: selDay === d.num ? '#2563eb' : 'var(--bg-card, #ffffff)',
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
              {DAYS.find(d => d.num === selDay)?.name} — {displayClassLabel} {selSectionName ? `(Section ${selSectionName})` : ''}
            </h3>
            <span className="muted" style={{ fontSize: 12 }}>
              {teachingPeriods.filter(p => Boolean(getEntryForPeriod(p))).length} of {teachingPeriods.length} periods assigned
            </span>
          </div>

          {periods.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--bg-card, #ffffff)', borderRadius: 12, border: '1px dashed var(--border)', margin: '10px 0' }}>
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
                    style={{ background: 'var(--bg-card, #ffffff)', color: 'var(--text)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
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
                    {(isSchoolAdmin || isTeacher) && <th style={{ width: 140, textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {periods.map(p => {
                    const entry = getEntryForPeriod(p);
                    const pNum = p.period_number ?? p.periodNumber ?? '';
                    const pName = p.name || `Period ${pNum}`;
                    const pStart = p.start_time ?? p.startTime ?? '';
                    const pEnd = p.end_time ?? p.endTime ?? '';
                    const pBreak = Boolean(p.is_break ?? p.isBreak);

                    if (pBreak) {
                      return <tr key={p.id} style={{ background: 'var(--bg)', opacity: 0.7 }}>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{pNum}</td>
                        <td colSpan={6} style={{ textAlign: 'center', fontStyle: 'italic' }}>☕ {pName} ({pStart} – {pEnd})</td>
                        {(isSchoolAdmin || isTeacher) && <td></td>}
                      </tr>;
                    }
                    if (entry) {
                      const isMy = isMyEntry(entry);
                      return <tr key={p.id} style={{
                        background: isMy ? 'rgba(16, 185, 129, 0.05)' : undefined,
                        borderLeft: isMy ? '3px solid #10b981' : undefined
                      }}>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{pNum}</td>
                        <td><b>{pName}</b></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pStart} – {pEnd}</td>
                        <td><span className="badge" style={{ background: 'rgba(37,99,235,0.12)', color: '#2563eb', fontWeight: 600 }}>{entry.subject_name || '—'}</span></td>
                        <td>
                          <span style={{ fontWeight: isMy ? 700 : 500 }}>{entry.teacher_name || '—'}</span>
                          {isMy && <span className="badge" style={{ background: '#d1fae5', color: '#065f46', fontSize: 10, fontWeight: 700, marginLeft: 6 }}>Your Period</span>}
                        </td>
                        <td>{entry.substitute_teacher_name ? <span className="badge" style={{ background: 'rgba(249,115,22,0.12)', color: '#ea580c', fontSize: 11 }}>Alt: {entry.substitute_teacher_name}</span> : <span className="muted">—</span>}</td>
                        <td>{entry.room_name || '—'}</td>
                        {(isSchoolAdmin || isTeacher) && (
                          <td style={{ textAlign: 'right' }}>
                            {isSchoolAdmin && (
                              <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button className="table-action-btn" onClick={() => openEditEntry(entry)} title="Edit entry"><Pencil size={14} /></button>
                                <button className="table-action-btn danger" onClick={() => deleteEntry(entry.id)} title="Remove entry"><Trash2 size={14} /></button>
                              </div>
                            )}
                            {isTeacher && isMy && (
                              <a
                                href={`#/take-attendance?routine=${entry.id}&classId=${entry.class_id || entry.classId}&sectionId=${entry.section_id || entry.sectionId}&subjectId=${entry.subject_id || entry.subjectId}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  background: '#10b981',
                                  color: '#fff',
                                  textDecoration: 'none',
                                  fontSize: 12,
                                  fontWeight: 600
                                }}
                              >
                                <ClipboardCheck size={13} /> Take Attendance
                              </a>
                            )}
                            {isTeacher && !isMy && (
                              <span className="muted" style={{ fontSize: 12 }}>—</span>
                            )}
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
                      {(isSchoolAdmin || isTeacher) && <td></td>}
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
            <h3 style={{ margin: 0, fontSize: 16 }}>All Timetable Entries ({displayClassLabel}-{selSectionName})</h3>
            {isSchoolAdmin && entries.length > 0 && (
              <button onClick={clearAllEntries} style={{ background: 'none', border: '1px solid #fecaca', color: '#dc2626', fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Trash2 size={12} /> Clear All Entries
              </button>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Day</th><th>Period</th><th>Time</th><th>Subject</th><th>Faculty</th><th>Alt. Faculty</th><th>Room</th><th>Status</th>{(isSchoolAdmin || isTeacher) && <th style={{ textAlign: 'right', width: 140 }}>Actions</th>}</tr></thead>
              <tbody>
                {entries
                  .filter(e => isEntryForCurrentClassAndSection(e))
                  .sort((a, b) => Number(a.day_of_week ?? a.dayOfWeek ?? 0) - Number(b.day_of_week ?? b.dayOfWeek ?? 0) || (a.period_number || 0) - (b.period_number || 0))
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
                      {(isSchoolAdmin || isTeacher) && (
                        <td style={{ textAlign: 'right' }}>
                          {isTeacher && isMyEntry(e) && (
                            <a
                              href={`#/take-attendance?routine=${e.id}&classId=${e.class_id || e.classId}&sectionId=${e.section_id || e.sectionId}&subjectId=${e.subject_id || e.subjectId}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                borderRadius: 6,
                                background: '#10b981',
                                color: '#fff',
                                textDecoration: 'none',
                                fontSize: 11,
                                fontWeight: 600
                              }}
                            >
                              <ClipboardCheck size={12} /> Take Attendance
                            </a>
                          )}
                          {isSchoolAdmin && (
                            <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="table-action-btn" onClick={() => openEditEntry(e)} title="Edit entry"><Pencil size={12} /></button>
                              <button className="table-action-btn danger" onClick={() => deleteEntry(e.id)} title="Remove entry"><Trash2 size={12} /></button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                {entries.filter(e => isEntryForCurrentClassAndSection(e)).length === 0 && (
                  <tr>
                    <td colSpan={isSchoolAdmin || isTeacher ? 9 : 8} className="muted" style={{ padding: 20, textAlign: 'center' }}>
                      {isSchoolAdmin
                        ? `No routine entries for ${displayClassLabel}-${selSectionName} yet. Click "+ Assign Faculty & Subject" above to add.`
                        : `No routine entries for ${displayClassLabel}-${selSectionName} scheduled yet.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )}

    {/* ══════════ ADD ENTRY MODAL ══════════ */}
    {isSchoolAdmin && addOpen && <div className="modal-backdrop" onClick={() => { setAddOpen(false); setEditingEntry(null); }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 18 }}>{editingEntry ? 'Edit Timetable Entry' : 'Add Timetable Entry'}</h3>
          <button className="modal-close" onClick={() => { setAddOpen(false); setEditingEntry(null); }}><X size={18} /></button>
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

              {/* Class & Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Class
                  <select value={entryForm.classId} onChange={e => {
                    const targetCid = e.target.value;
                    const c = classes.find(x => x.id === targetCid);
                    const cNum = c?.class_number ?? c?.classNumber;
                    const availSec = sections.filter(s => s.class_id === targetCid || String(s.class_number) === String(cNum));
                    const selSecObj = availSec.length > 0 ? availSec[0] : (filteredSections.length > 0 ? filteredSections[0] : null);
                    setEntryForm({
                      ...entryForm,
                      classId: targetCid,
                      classNumber: cNum !== undefined && cNum !== null ? cNum : (c?.label || c?.name),
                      sectionId: selSecObj?.id || `${targetCid}-sec-a`,
                      sectionName: selSecObj?.name || selSecObj?.section_name || 'A'
                    });
                  }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                    {classes.map(c => {
                      const cNum = c.class_number ?? c.classNumber;
                      const label = c.label || (cNum === -1 ? 'L-KG' : cNum === 0 ? 'U-KG' : cNum !== undefined ? `Class ${cNum}` : c.name || 'Class');
                      return <option key={c.id} value={c.id}>{label}</option>;
                    })}
                  </select>
                </label>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Section
                  <select value={entryForm.sectionId || ''} onChange={e => {
                    const secIdVal = e.target.value;
                    const sFromSections = sections.find(x => x.id === secIdVal);
                    const sFromFiltered = filteredSections.find(x => x.id === secIdVal);
                    const sNameVal = sFromSections?.name || sFromSections?.section_name || sFromFiltered?.name || sFromFiltered?.section_name || (secIdVal.endsWith('-sec-b') ? 'B' : 'A');
                    setEntryForm({ ...entryForm, sectionId: secIdVal, sectionName: sNameVal });
                  }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                    {(() => {
                      const avail = sections.filter(s => s.class_id === entryForm.classId || String(s.class_number) === String(classes.find(c => c.id === entryForm.classId)?.class_number));
                      if (avail.length === 0) {
                        return filteredSections.map(s => (
                          <option key={s.id} value={s.id}>
                            Section {s.name || s.section_name || 'A'}
                          </option>
                        ));
                      }
                      return avail.map(s => <option key={s.id} value={s.id}>{s.name || s.section_name}</option>);
                    })()}
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
                <button onClick={() => { setAddOpen(false); setEditingEntry(null); }} style={{ background: 'var(--bg-card, #ffffff)', color: 'var(--text)', border: '1px solid var(--border)' }}>Cancel</button>
                <button onClick={saveEntry} disabled={saving}
                  style={{ background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {saving ? <><RefreshCw size={14} className="spin" /> Saving...</> : <><Check size={14} /> {editingEntry ? 'Save Changes' : 'Create Entry'}</>}
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
          <div className="table-wrap period-slots-table-wrap" style={{ marginBottom: 12, maxHeight: 260, overflowY: 'auto' }}>
            <table className="period-slots-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>#</th>
                  <th>Name</th>
                  <th style={{ width: 85 }}>Start</th>
                  <th style={{ width: 85 }}>End</th>
                  <th style={{ width: 65, textAlign: 'center' }}>Break</th>
                  <th style={{ width: 44, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {periods.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, textAlign: 'center' }}>{p.period_number ?? p.periodNumber ?? '—'}</td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.start_time ?? p.startTime ?? '—'}</td>
                    <td>{p.end_time ?? p.endTime ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{(p.is_break ?? p.isBreak) ? '☕ Yes' : 'No'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="table-action-btn danger" onClick={() => deletePeriod(p.id)} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {periods.length === 0 && (
                  <tr className="table-empty-row">
                    <td colSpan={6} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                      No periods configured yet. Enter slots manually below or click template.
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          className="period-template-btn"
                          onClick={loadTemplatePeriods}
                        >
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
