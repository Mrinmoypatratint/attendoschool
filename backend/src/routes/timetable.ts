import { Router, Request } from 'express';
import * as svc from '../services/timetableService';
import { demoTeachers, demoTeacherAssignments, demoSubjects, demoClasses, demoSections } from './schoolData';
import { isSameSchool, isTestSchool } from './auth';
import { collections, isFirebaseConfigured } from '../firebase';
import {
  syncTimetablePeriodToFirestore,
  deleteTimetablePeriodFromFirestore,
  clearTimetablePeriodsFromFirestore,
  syncTimetableEntryToFirestore,
  deleteTimetableEntryFromFirestore,
  clearTimetableEntriesFromFirestore
} from '../services/firestoreSync';
import { pool, isPostgresConfigured } from '../db';

const router = Router();
const u = (r: Request) => (r as any).user;

router.use((req, res, next) => {
  if (!u(req)?.schoolId && !['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(u(req)?.role)) {
    return res.status(403).json({ message: 'Timetable access required' });
  }
  next();
});

const requireAdmin = (req: Request, res: any, next: any) => {
  const role = u(req)?.role;
  if (role !== 'SCHOOL_ADMIN' && role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only school administrators can create, edit, or delete timetable records' });
  }
  next();
};

// ── Note: Frontend "Sync Timetable" & "Refresh Classes" buttons removed from UI per design ──
// ── In-Memory Timetable Store (Empty - No seed data; 100% manual entry) ──
export const memPeriods: any[] = [];
export const memEntries: any[] = [];

// ── Helper: Find conflicts in memory ──
function findMemConflicts(dayOfWeek: number, periodId: string, teacherId?: string, classId?: string, sectionId?: string, roomName?: string, excludeId?: string) {
  const conflicts: any[] = [];
  for (const e of memEntries) {
    if (e.day_of_week !== dayOfWeek || e.period_id !== periodId) continue;
    if (excludeId && e.id === excludeId) continue;
    if (e.status === 'CANCELLED') continue;
    if (teacherId && (e.teacher_id === teacherId || e.substitute_teacher_id === teacherId)) {
      conflicts.push({ id: e.id, conflict_type: 'TEACHER_DOUBLE_BOOKED', details: `${e.teacher_name || 'Teacher'} is already assigned to ${e.subject_name || 'Subject'} (Class ${e.class_number}-${e.section_name})` });
    } else if (classId && sectionId && e.class_id === classId && e.section_id === sectionId) {
      conflicts.push({ id: e.id, conflict_type: 'CLASS_SECTION_DOUBLE_BOOKED', details: `Class ${e.class_number}-${e.section_name} already has ${e.subject_name || 'a class'}` });
    } else if (roomName && e.room_name === roomName) {
      conflicts.push({ id: e.id, conflict_type: 'ROOM_DOUBLE_BOOKED', details: `Room ${e.room_name} is already booked for ${e.subject_name || 'another class'}` });
    }
  }
  return conflicts;
}

// ── Helper: Find conflicts across Firestore + memory ──
async function checkConflicts(sid: string, dayOfWeek: number, periodId: string, teacherId?: string, classId?: string, sectionId?: string, roomName?: string, excludeId?: string) {
  const memConf = findMemConflicts(dayOfWeek, periodId, teacherId, classId, sectionId, roomName, excludeId);
  if (memConf.length > 0) return memConf;

  if (isPostgresConfigured && sid) {
    try {
      const pgConf = await svc.findConflicts(sid, {
        dayOfWeek,
        periodId,
        teacherId,
        classId,
        sectionId,
        roomName,
        id: excludeId
      });
      if (pgConf && pgConf.length > 0) return pgConf;
    } catch {}
  }

  if (isFirebaseConfigured()) {
    try {
      const snap = sid
        ? await collections.timetableEntries().where('school_id', '==', sid).get()
        : await collections.timetableEntries().get();
      for (const doc of snap.docs) {
        const e = doc.data();
        const eId = e.id || doc.id;
        if (excludeId && eId === excludeId) continue;
        if (e.status === 'CANCELLED') continue;

        const docSid = e.school_id || e.schoolId;
        if (docSid && !isSameSchool(docSid, sid)) continue;
        if (Number(e.day_of_week ?? e.dayOfWeek) !== dayOfWeek) continue;
        if ((e.period_id || e.periodId) !== periodId) continue;

        const eTeacher = e.teacher_id || e.teacherId;
        const eSub = e.substitute_teacher_id || e.altTeacherId;
        const eClass = e.class_id || e.classId;
        const eSec = e.section_id || e.sectionId;
        const eRoom = e.room_name || e.roomName;

        if (teacherId && (eTeacher === teacherId || eSub === teacherId)) {
          return [{
            id: eId,
            conflict_type: 'TEACHER_DOUBLE_BOOKED',
            details: `${e.teacher_name || 'Teacher'} is already assigned to a class at this time`
          }];
        } else if (classId && sectionId && eClass === classId && eSec === sectionId) {
          return [{
            id: eId,
            conflict_type: 'CLASS_SECTION_DOUBLE_BOOKED',
            details: `Class section already has a scheduled class for this period`
          }];
        } else if (roomName && eRoom && eRoom.toLowerCase() === roomName.toLowerCase()) {
          return [{
            id: eId,
            conflict_type: 'ROOM_DOUBLE_BOOKED',
            details: `Room ${eRoom} is already booked for this period`
          }];
        }
      }
    } catch (err: any) {
      console.warn('[Timetable] Error checking Firestore conflicts:', err.message);
    }
  }
  return [];
}

// ── Helper: Check teacher period availability ──
function getTeacherAvailability(teacherId: string, dayOfWeek: number) {
  const busy = memEntries
    .filter(e => e.day_of_week === dayOfWeek && (e.teacher_id === teacherId || e.substitute_teacher_id === teacherId) && e.status !== 'CANCELLED')
    .map(e => e.period_id);
  return memPeriods
    .filter(p => !p.is_break)
    .map(p => ({ ...p, available: !busy.includes(p.id) }));
}

// ── PERIODS ──
router.get('/periods', async (req, res) => {
  const sid = u(req).schoolId;

  // 1. Try DB first (Postgres)
  try {
    const rows = await svc.periods(sid);
    if (rows?.length) return res.json(rows);
  } catch (_e) {}

  // 2. Query Firestore directly
  if (isFirebaseConfigured()) {
    try {
      const snap = sid
        ? await collections.timetablePeriods().where('school_id', '==', sid).get()
        : await collections.timetablePeriods().get();
      if (!snap.empty) {
        const list: any[] = [];
        snap.docs.forEach(doc => {
          const p = doc.data();
          if (
            (!p.school_id && !p.schoolId && isTestSchool(sid)) ||
            (p.school_id && isSameSchool(p.school_id, sid)) ||
            (p.schoolId && isSameSchool(p.schoolId, sid))
          ) {
            list.push({
              id: p.id || doc.id,
              name: p.name,
              period_number: Number(p.period_number ?? p.periodNumber ?? 0),
              periodNumber: Number(p.period_number ?? p.periodNumber ?? 0),
              start_time: p.start_time || p.startTime || '',
              end_time: p.end_time || p.endTime || '',
              startTime: p.start_time || p.startTime || '',
              endTime: p.end_time || p.endTime || '',
              is_break: Boolean(p.is_break ?? p.isBreak),
              isBreak: Boolean(p.is_break ?? p.isBreak),
              school_id: p.school_id || p.schoolId || sid,
              schoolId: p.school_id || p.schoolId || sid
            });
          }
        });
        if (list.length > 0) {
          list.sort((a, b) => a.period_number - b.period_number);
          for (const item of list) {
            const idx = memPeriods.findIndex(m => m.id === item.id);
            if (idx >= 0) memPeriods[idx] = item;
            else memPeriods.push(item);
          }
          return res.json(list);
        }
      }
    } catch (err: any) {
      console.warn('[Timetable] Error fetching periods from Firestore:', err.message);
    }
  }

  // 3. Fallback to memory
  const schoolPeriods = memPeriods.filter(p => p.school_id && isSameSchool(p.school_id, sid));
  if (schoolPeriods.length > 0) return res.json(schoolPeriods);

  if (isTestSchool(sid)) {
    return res.json(memPeriods);
  }
  res.json([]);
});

router.post('/periods', requireAdmin, async (req, res) => {
  const sid = u(req).schoolId;
  const d = req.body;

  let newP: any = null;
  try {
    newP = await svc.createPeriod(sid, d);
  } catch (_e) {}

  if (!newP) {
    const periodNum = Number(d.periodNumber || d.period_number || (memPeriods.length + 1));
    newP = {
      id: `prd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      school_id: sid,
      schoolId: sid,
      period_number: periodNum,
      periodNumber: periodNum,
      name: d.name,
      start_time: d.startTime || d.start_time || '',
      end_time: d.endTime || d.end_time || '',
      startTime: d.startTime || d.start_time || '',
      endTime: d.endTime || d.end_time || '',
      is_break: Boolean(d.isBreak || d.is_break),
      isBreak: Boolean(d.isBreak || d.is_break)
    };
  }

  const idx = memPeriods.findIndex(p => p.id === newP.id);
  if (idx >= 0) memPeriods[idx] = newP;
  else memPeriods.push(newP);
  memPeriods.sort((a, b) => (a.period_number || a.periodNumber || 0) - (b.period_number || b.periodNumber || 0));

  await syncTimetablePeriodToFirestore(newP);
  res.status(201).json(newP);
});

// Template periods loader
router.post('/periods/template', requireAdmin, async (req, res) => {
  const sid = u(req).schoolId;

  // Check if existing in Firestore first
  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.timetablePeriods().get();
      const existing: any[] = [];
      snap.docs.forEach(doc => {
        const p = doc.data();
        if ((p.school_id && isSameSchool(p.school_id, sid)) || (p.schoolId && isSameSchool(p.schoolId, sid))) {
          existing.push({
            id: p.id || doc.id,
            name: p.name,
            period_number: Number(p.period_number ?? p.periodNumber ?? 0),
            periodNumber: Number(p.period_number ?? p.periodNumber ?? 0),
            start_time: p.start_time || p.startTime || '',
            end_time: p.end_time || p.endTime || '',
            startTime: p.start_time || p.startTime || '',
            endTime: p.end_time || p.endTime || '',
            is_break: Boolean(p.is_break ?? p.isBreak),
            isBreak: Boolean(p.is_break ?? p.isBreak),
            school_id: p.school_id || p.schoolId || sid,
            schoolId: p.school_id || p.schoolId || sid
          });
        }
      });
      if (existing.length > 0) {
        existing.sort((a, b) => a.period_number - b.period_number);
        return res.json(existing);
      }
    } catch {}
  }

  const existingMem = memPeriods.filter(p => p.school_id && isSameSchool(p.school_id, sid));
  if (existingMem.length > 0) return res.json(existingMem);

  const template = [
    { id: `prd-${sid}-t1`, school_id: sid, schoolId: sid, period_number: 1, periodNumber: 1, name: 'Period 1', start_time: '09:00', end_time: '09:45', startTime: '09:00', endTime: '09:45', is_break: false, isBreak: false },
    { id: `prd-${sid}-t2`, school_id: sid, schoolId: sid, period_number: 2, periodNumber: 2, name: 'Period 2', start_time: '09:45', end_time: '10:30', startTime: '09:45', endTime: '10:30', is_break: false, isBreak: false },
    { id: `prd-${sid}-t3`, school_id: sid, schoolId: sid, period_number: 3, periodNumber: 3, name: 'Short Break', start_time: '10:30', end_time: '10:45', startTime: '10:30', endTime: '10:45', is_break: true, isBreak: true },
    { id: `prd-${sid}-t4`, school_id: sid, schoolId: sid, period_number: 4, periodNumber: 4, name: 'Period 3', start_time: '10:45', end_time: '11:30', startTime: '10:45', endTime: '11:30', is_break: false, isBreak: false },
    { id: `prd-${sid}-t5`, school_id: sid, schoolId: sid, period_number: 5, periodNumber: 5, name: 'Period 4', start_time: '11:30', end_time: '12:15', startTime: '11:30', endTime: '12:15', is_break: false, isBreak: false },
    { id: `prd-${sid}-t6`, school_id: sid, schoolId: sid, period_number: 6, periodNumber: 6, name: 'Lunch Break', start_time: '12:15', end_time: '13:00', startTime: '12:15', endTime: '13:00', is_break: true, isBreak: true },
    { id: `prd-${sid}-t7`, school_id: sid, schoolId: sid, period_number: 7, periodNumber: 7, name: 'Period 5', start_time: '13:00', end_time: '13:45', startTime: '13:00', endTime: '13:45', is_break: false, isBreak: false },
    { id: `prd-${sid}-t8`, school_id: sid, schoolId: sid, period_number: 8, periodNumber: 8, name: 'Period 6', start_time: '13:45', end_time: '14:30', startTime: '13:45', endTime: '14:30', is_break: false, isBreak: false }
  ];

  for (const p of template) {
    const idx = memPeriods.findIndex(m => m.id === p.id);
    if (idx >= 0) memPeriods[idx] = p;
    else memPeriods.push(p);
    await syncTimetablePeriodToFirestore(p);
  }
  res.status(201).json(template);
});

router.delete('/periods/clear', requireAdmin, async (req, res) => {
  const sid = u(req)?.schoolId;
  if (isPostgresConfigured && sid) {
    try {
      await pool.query('DELETE FROM timetable_periods WHERE school_id = $1', [sid]);
    } catch (err: any) {
      console.warn('[Timetable] Error clearing periods in Supabase:', err.message);
    }
  }
  for (let i = memPeriods.length - 1; i >= 0; i--) {
    if (memPeriods[i].school_id && isSameSchool(memPeriods[i].school_id, sid)) {
      memPeriods.splice(i, 1);
    }
  }
  await clearTimetablePeriodsFromFirestore(sid);
  res.json({ success: true, count: 0 });
});

router.delete('/periods/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const sid = u(req)?.schoolId;
  if (isPostgresConfigured) {
    try {
      await pool.query('DELETE FROM timetable_periods WHERE id::text = $1', [id]);
    } catch (err: any) {
      console.warn('[Timetable] Error deleting period in Supabase:', err.message);
    }
  }
  const idx = memPeriods.findIndex(p => p.id === id);
  if (idx >= 0) memPeriods.splice(idx, 1);
  await deleteTimetablePeriodFromFirestore(id);
  res.json({ success: true });
});

// ── HELPER: Fetch Timetable Entries (Firestore + Postgres + Mem) ──
async function fetchTimetableEntries(sid: string, query: any = {}) {
  // 1. Try DB first
  try {
    const rows = await svc.listEntries(sid, query);
    if (Array.isArray(rows)) return rows;
  } catch (_e) {}

  // 2. Query Firestore scoped to tenant
  if (isFirebaseConfigured()) {
    try {
      const snap = sid
        ? await collections.timetableEntries().where('school_id', '==', sid).get()
        : await collections.timetableEntries().get();
      if (!snap.empty) {

        let list: any[] = [];
        snap.docs.forEach(doc => {
          const e = doc.data();
          if (
            (!e.school_id && !e.schoolId && isTestSchool(sid)) ||
            (e.school_id && isSameSchool(e.school_id, sid)) ||
            (e.schoolId && isSameSchool(e.schoolId, sid))
          ) {
            list.push({
              id: e.id || doc.id,
              school_id: e.school_id || e.schoolId || sid,
              schoolId: e.school_id || e.schoolId || sid,
              day_of_week: Number(e.day_of_week ?? e.dayOfWeek ?? 0),
              dayOfWeek: Number(e.day_of_week ?? e.dayOfWeek ?? 0),
              period_id: e.period_id || e.periodId,
              periodId: e.period_id || e.periodId,
              period_name: e.period_name || e.periodName || '',
              period_number: Number(e.period_number ?? e.periodNumber ?? 0),
              periodNumber: Number(e.period_number ?? e.periodNumber ?? 0),
              start_time: e.start_time || e.startTime || '',
              end_time: e.end_time || e.endTime || '',
              startTime: e.start_time || e.startTime || '',
              endTime: e.end_time || e.endTime || '',
              class_id: e.class_id || e.classId || null,
              class_number: e.class_number ?? e.classNumber ?? null,
              section_id: e.section_id || e.sectionId || null,
              section_name: e.section_name || e.sectionName || null,
              subject_id: e.subject_id || e.subjectId || null,
              subject_name: e.subject_name || e.subjectName || null,
              teacher_id: e.teacher_id || e.teacherId || null,
              teacher_name: e.teacher_name || e.teacherName || null,
              substitute_teacher_id: e.substitute_teacher_id || e.altTeacherId || null,
              substitute_teacher_name: e.substitute_teacher_name || e.altTeacherName || null,
              room_name: e.room_name || e.roomName || null,
              status: e.status || 'PUBLISHED',
              notes: e.notes || null
            });
          }
        });

        if (query.day) list = list.filter(e => e.day_of_week === Number(query.day));
        if (query.classId) list = list.filter(e => e.class_id === query.classId || String(e.class_number) === String(query.classId));
        if (query.sectionId) list = list.filter(e => e.section_id === query.sectionId || String(e.section_name).toLowerCase() === String(query.sectionId).toLowerCase());
        if (query.teacherId) list = list.filter(e => e.teacher_id === query.teacherId || e.substitute_teacher_id === query.teacherId);

        list.sort((a, b) => (a.day_of_week - b.day_of_week) || (a.period_number - b.period_number));
        return list;
      }
    } catch (err: any) {
      console.warn('[Timetable] Error fetching entries from Firestore:', err.message);
    }
  }

  // 3. Fallback to memory
  let filtered = memEntries.filter(e => (!e.school_id && isTestSchool(sid)) || (e.school_id && isSameSchool(e.school_id, sid)));
  if (query.day) filtered = filtered.filter(e => e.day_of_week === Number(query.day));
  if (query.classId) filtered = filtered.filter(e => e.class_id === query.classId || String(e.class_number) === String(query.classId));
  if (query.sectionId) filtered = filtered.filter(e => e.section_id === query.sectionId || String(e.section_name).toLowerCase() === String(query.sectionId).toLowerCase());
  if (query.teacherId) filtered = filtered.filter(e => e.teacher_id === query.teacherId || e.substitute_teacher_id === query.teacherId);
  filtered.sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
  return filtered;
}

// ── ENTRIES ──
router.get('/entries', async (req, res) => {
  const sid = u(req).schoolId;
  const list = await fetchTimetableEntries(sid, req.query);
  res.json(list);
});

router.post('/entries', requireAdmin, async (req, res) => {
  const d = req.body;
  const sid = u(req).schoolId;

  // Try DB first if Postgres has configured tables
  try {
    const created = await svc.createEntry(sid, u(req).id, d);
    if (created && created.id) {
      await syncTimetableEntryToFirestore(created);
      return res.status(201).json(created);
    }
  } catch (_e) {}

  // Conflict check
  const conflicts = await checkConflicts(
    sid, Number(d.dayOfWeek), d.periodId, d.teacherId, d.classId, d.sectionId, d.roomName
  );
  if (conflicts.length) {
    return res.status(409).json({ message: `Conflict: ${conflicts.map(c => c.details || c.conflict_type).join('; ')}`, conflicts });
  }

  // Resolve period info
  let period = memPeriods.find(p => p.id === d.periodId);
  if (!period && isFirebaseConfigured()) {
    try {
      const pDoc = await collections.timetablePeriods().doc(d.periodId).get();
      if (pDoc.exists) period = pDoc.data();
    } catch {}
  }

  // Resolve names
  const teacher = demoTeachers.find(t => t.id === d.teacherId);
  const subject = demoSubjects.find(s => s.id === d.subjectId);
  const altTeacher = d.altTeacherId ? demoTeachers.find(t => t.id === d.altTeacherId) : null;

  // Resolve class and section info dynamically
  let resolvedClassNumber: number | null = d.classNumber ? Number(d.classNumber) : null;
  if (!resolvedClassNumber && d.classId) {
    const foundCls = demoClasses.find(c => c.id === d.classId || String(c.class_number) === String(d.classId));
    if (foundCls) resolvedClassNumber = Number(foundCls.class_number);
    else {
      const matchNum = String(d.classId).match(/\d+/);
      if (matchNum) resolvedClassNumber = Number(matchNum[0]);
    }
  }

  let resolvedSectionName: string | null = d.sectionName || null;
  if (!resolvedSectionName && d.sectionId) {
    const foundSec = demoSections.find(s => s.id === d.sectionId);
    if (foundSec) resolvedSectionName = foundSec.name;
    else {
      const matchSec = String(d.sectionId).match(/-([a-zA-Z])$/);
      if (matchSec) resolvedSectionName = matchSec[1].toUpperCase();
    }
  }

  const entry = {
    id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    school_id: sid || null,
    schoolId: sid || null,
    day_of_week: Number(d.dayOfWeek),
    dayOfWeek: Number(d.dayOfWeek),
    period_id: d.periodId,
    periodId: d.periodId,
    period_name: period?.name || d.periodName || 'Period',
    period_number: period?.period_number || period?.periodNumber || 0,
    start_time: period?.start_time || period?.startTime || '',
    end_time: period?.end_time || period?.endTime || '',
    startTime: period?.start_time || period?.startTime || '',
    endTime: period?.end_time || period?.endTime || '',
    class_id: d.classId || null,
    class_number: resolvedClassNumber,
    section_id: d.sectionId || null,
    section_name: resolvedSectionName || 'A',
    subject_id: d.subjectId || null,
    subject_name: subject?.name || d.subjectName || null,
    teacher_id: d.teacherId || null,
    teacher_name: teacher?.name || d.teacherName || null,
    substitute_teacher_id: d.altTeacherId || null,
    substitute_teacher_name: altTeacher?.name || d.altTeacherName || null,
    room_name: d.roomName || null,
    status: 'PUBLISHED',
    notes: d.notes || null
  };
  memEntries.push(entry);
  await syncTimetableEntryToFirestore(entry);
  res.status(201).json(entry);
});

router.delete('/entries/clear', requireAdmin, async (req, res) => {
  const sid = u(req)?.schoolId;
  if (isPostgresConfigured && sid) {
    try {
      await pool.query('DELETE FROM timetable_entries WHERE school_id = $1', [sid]);
    } catch (err: any) {
      console.warn('[Timetable] Error clearing entries in Supabase:', err.message);
    }
  }
  for (let i = memEntries.length - 1; i >= 0; i--) {
    if (memEntries[i].school_id && isSameSchool(memEntries[i].school_id, sid)) {
      memEntries.splice(i, 1);
    }
  }
  await clearTimetableEntriesFromFirestore(sid);
  res.json({ success: true, count: 0 });
});

router.delete('/entries/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const sid = u(req)?.schoolId;
  if (isPostgresConfigured) {
    try {
      await pool.query('DELETE FROM timetable_entries WHERE id::text = $1', [id]);
    } catch (err: any) {
      console.warn('[Timetable] Error deleting entry in Supabase:', err.message);
    }
  }
  const idx = memEntries.findIndex(e => e.id === id);
  if (idx >= 0) memEntries.splice(idx, 1);
  await deleteTimetableEntryFromFirestore(id);
  res.json({ success: true });
});

// ── CONFLICTS ──
router.get('/conflicts', async (req, res) => {
  try {
    return res.json(await svc.findConflicts(u(req).schoolId, req.query));
  } catch (_e) {}
  const q = req.query as any;
  const conflicts = await checkConflicts(
    u(req).schoolId,
    Number(q.dayOfWeek || q.day),
    q.periodId,
    q.teacherId,
    q.classId,
    q.sectionId,
    q.roomName,
    q.excludeId
  );
  res.json(conflicts);
});

// ── TEACHER AVAILABILITY ──
router.get('/teacher-availability/:teacherId', async (req, res) => {
  const avail = getTeacherAvailability(req.params.teacherId, Number(req.query.day || 1));
  res.json(avail);
});

// ── ROOT (alias) ──
router.get('/', async (req, res) => {
  const sid = u(req).schoolId;
  const list = await fetchTimetableEntries(sid, req.query);
  res.json(list);
});

router.post('/', requireAdmin, async (req, res) => {
  const sid = u(req).schoolId;
  const d = req.body;
  try {
    const created = await svc.createEntry(sid, u(req).id, d);
    if (created && created.id) {
      await syncTimetableEntryToFirestore(created);
      return res.status(201).json(created);
    }
  } catch (_e) {}

  const entry = {
    id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    school_id: sid,
    schoolId: sid,
    status: 'PUBLISHED',
    ...d
  };
  memEntries.push(entry);
  await syncTimetableEntryToFirestore(entry);
  res.status(201).json(entry);
});

// ── PUBLISH ──
router.post('/entries/:id/publish', requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const sid = u(req).schoolId;
  try {
    const pub = await svc.publish(sid, id);
    if (pub && pub.id) return res.json(pub);
  } catch (_e) {}
  const entry = memEntries.find(e => e.id === id);
  if (entry) {
    entry.status = 'PUBLISHED';
    await syncTimetableEntryToFirestore(entry);
  } else if (isFirebaseConfigured()) {
    try {
      await collections.timetableEntries().doc(id).set({
        status: 'PUBLISHED',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch {}
  }
  res.json(entry || { id, status: 'PUBLISHED' });
});

// ── SUBSTITUTES ──
router.post('/substitutes', requireAdmin, async (req, res) => {
  const sid = u(req).schoolId;
  try {
    const subRes = await svc.assignSubstitute(sid, u(req).id, req.body);
    if (subRes && subRes.id) return res.json(subRes);
  } catch (_e) {}
  const d = req.body;
  const entry = memEntries.find(e => e.id === d.entryId);
  const sub = demoTeachers.find(t => t.id === d.substituteTeacherId);
  const subName = sub?.name || d.substituteTeacherName || 'Substitute';
  if (entry) {
    entry.substitute_teacher_id = d.substituteTeacherId;
    entry.substitute_teacher_name = subName;
    await syncTimetableEntryToFirestore(entry);
  } else if (isFirebaseConfigured()) {
    try {
      await collections.timetableEntries().doc(d.entryId).set({
        substitute_teacher_id: d.substituteTeacherId,
        substitute_teacher_name: subName,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch {}
  }
  res.json({ id: d.entryId, substitute_teacher_id: d.substituteTeacherId, substitute_teacher_name: subName });
});

export default router;
