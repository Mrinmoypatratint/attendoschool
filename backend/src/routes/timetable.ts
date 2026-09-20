import {Router,Request} from 'express';
import * as svc from '../services/timetableService';
import { demoTeachers, demoTeacherAssignments, demoSubjects } from './schoolData';
import { isSameSchool, isTestSchool } from './auth';
import {
  syncTimetablePeriodToFirestore,
  deleteTimetablePeriodFromFirestore,
  clearTimetablePeriodsFromFirestore,
  syncTimetableEntryToFirestore,
  deleteTimetableEntryFromFirestore,
  clearTimetableEntriesFromFirestore
} from '../services/firestoreSync';
const router=Router(); const u=(r:Request)=>(r as any).user;

router.use((req,res,next)=>{if(!u(req)?.schoolId&&!['SUPER_ADMIN','SCHOOL_ADMIN','TEACHER'].includes(u(req)?.role))return res.status(403).json({message:'Timetable access required'});next()});

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
      conflicts.push({ id: e.id, conflict_type: 'TEACHER_DOUBLE_BOOKED', details: `${e.teacher_name} is already assigned to ${e.subject_name} (Class ${e.class_number}-${e.section_name})` });
    } else if (classId && sectionId && e.class_id === classId && e.section_id === sectionId) {
      conflicts.push({ id: e.id, conflict_type: 'CLASS_SECTION_DOUBLE_BOOKED', details: `Class ${e.class_number}-${e.section_name} already has ${e.subject_name}` });
    } else if (roomName && e.room_name === roomName) {
      conflicts.push({ id: e.id, conflict_type: 'ROOM_DOUBLE_BOOKED', details: `Room ${e.room_name} is already booked for ${e.subject_name}` });
    }
  }
  return conflicts;
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
router.get('/periods',async(req,res)=>{
  const sid = u(req).schoolId;
  try{
    const rows = await svc.periods(sid);
    if(rows?.length) return res.json(rows);
  }catch(_e){}

  const schoolPeriods = memPeriods.filter(p => p.school_id && isSameSchool(p.school_id, sid));
  if (schoolPeriods.length > 0) return res.json(schoolPeriods);

  if (isTestSchool(sid)) {
    return res.json(memPeriods);
  }
  res.json([]);
});

router.post('/periods',async(req,res)=>{
  const sid = u(req).schoolId;
  try{return res.status(201).json(await svc.createPeriod(sid,req.body))}catch(_e){}
  const d = req.body;
  const newP = { id: `prd-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, school_id: sid, period_number: d.periodNumber||memPeriods.length+1, name: d.name, start_time: d.startTime, end_time: d.endTime, is_break: !!d.isBreak };
  memPeriods.push(newP);
  memPeriods.sort((a,b) => a.period_number - b.period_number);
  syncTimetablePeriodToFirestore(newP).catch(() => {});
  res.status(201).json(newP);
});
// Optional: Template periods loader (if requested by user manually)
router.post('/periods/template',async(req,res)=>{
  const sid = u(req).schoolId;
  const existing = memPeriods.filter(p => p.school_id && isSameSchool(p.school_id, sid));
  if (existing.length > 0) return res.json(existing);
  const template = [
    { id: `prd-${sid}-t1`, school_id: sid, period_number: 1, name: 'Period 1', start_time: '09:00', end_time: '09:45', is_break: false },
    { id: `prd-${sid}-t2`, school_id: sid, period_number: 2, name: 'Period 2', start_time: '09:45', end_time: '10:30', is_break: false },
    { id: `prd-${sid}-t3`, school_id: sid, period_number: 3, name: 'Short Break', start_time: '10:30', end_time: '10:45', is_break: true },
    { id: `prd-${sid}-t4`, school_id: sid, period_number: 4, name: 'Period 3', start_time: '10:45', end_time: '11:30', is_break: false },
    { id: `prd-${sid}-t5`, school_id: sid, period_number: 5, name: 'Period 4', start_time: '11:30', end_time: '12:15', is_break: false },
    { id: `prd-${sid}-t6`, school_id: sid, period_number: 6, name: 'Lunch Break', start_time: '12:15', end_time: '13:00', is_break: true },
    { id: `prd-${sid}-t7`, school_id: sid, period_number: 7, name: 'Period 5', start_time: '13:00', end_time: '13:45', is_break: false },
    { id: `prd-${sid}-t8`, school_id: sid, period_number: 8, name: 'Period 6', start_time: '13:45', end_time: '14:30', is_break: false }
  ];
  memPeriods.push(...template);
  for (const p of template) syncTimetablePeriodToFirestore(p).catch(() => {});
  res.status(201).json(template);
});
router.delete('/periods/clear',async(req,res)=>{
  const sid = u(req)?.schoolId;
  for (let i = memPeriods.length - 1; i >= 0; i--) {
    if (memPeriods[i].school_id && isSameSchool(memPeriods[i].school_id, sid)) {
      memPeriods.splice(i, 1);
    }
  }
  clearTimetablePeriodsFromFirestore(sid).catch(() => {});
  res.json({ success: true, count: 0 });
});
router.delete('/periods/:id',async(req,res)=>{
  const idx = memPeriods.findIndex(p => p.id === req.params.id);
  if (idx >= 0) memPeriods.splice(idx, 1);
  deleteTimetablePeriodFromFirestore(req.params.id).catch(() => {});
  res.json({ success: true });
});

// ── ENTRIES ──
router.get('/entries',async(req,res)=>{
  const sid = u(req).schoolId;
  try{
    const rows=await svc.listEntries(sid,req.query);
    if(rows?.length) return res.json(rows);
  }catch(_e){}

  let filtered = memEntries.filter(e => (!e.school_id && isTestSchool(sid)) || (e.school_id && isSameSchool(e.school_id, sid)));
  const q = req.query as any;
  if (q.day) filtered = filtered.filter(e => e.day_of_week === Number(q.day));
  if (q.classId) filtered = filtered.filter(e => e.class_id === q.classId);
  if (q.sectionId) filtered = filtered.filter(e => e.section_id === q.sectionId);
  if (q.teacherId) filtered = filtered.filter(e => e.teacher_id === q.teacherId || e.substitute_teacher_id === q.teacherId);
  filtered.sort((a,b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
  res.json(filtered);
});

router.post('/entries',async(req,res)=>{
  const d = req.body;

  // Try DB first
  try{return res.status(201).json(await svc.createEntry(u(req).schoolId,u(req).id,d))}catch(_e){}

  // In-memory conflict check
  const conflicts = findMemConflicts(
    Number(d.dayOfWeek), d.periodId, d.teacherId, d.classId, d.sectionId, d.roomName
  );
  if (conflicts.length) {
    return res.status(409).json({ message: `Conflict: ${conflicts.map(c=>c.details||c.conflict_type).join('; ')}`, conflicts });
  }

  // Resolve names from demo stores
  const period = memPeriods.find(p => p.id === d.periodId);
  const teacher = demoTeachers.find(t => t.id === d.teacherId);
  const subject = demoSubjects.find(s => s.id === d.subjectId);
  const altTeacher = d.altTeacherId ? demoTeachers.find(t => t.id === d.altTeacherId) : null;

  const entry = {
    id: `ent-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
    school_id: u(req).schoolId || null,
    day_of_week: Number(d.dayOfWeek),
    period_id: d.periodId,
    period_name: period?.name || 'Period',
    period_number: period?.period_number || 0,
    start_time: period?.start_time || '',
    end_time: period?.end_time || '',
    class_id: d.classId || null,
    class_number: d.classNumber || null,
    section_id: d.sectionId || null,
    section_name: d.sectionName || null,
    subject_id: d.subjectId || null,
    subject_name: subject?.name || d.subjectName || null,
    teacher_id: d.teacherId || null,
    teacher_name: teacher?.name || d.teacherName || null,
    substitute_teacher_id: d.altTeacherId || null,
    substitute_teacher_name: altTeacher?.name || null,
    room_name: d.roomName || null,
    status: 'PUBLISHED',
    notes: d.notes || null
  };
  memEntries.push(entry);
  syncTimetableEntryToFirestore(entry).catch(() => {});
  res.status(201).json(entry);
});

router.delete('/entries/clear',async(req,res)=>{
  memEntries.length = 0;
  clearTimetableEntriesFromFirestore(u(req)?.schoolId).catch(() => {});
  res.json({ success: true, count: 0 });
});

router.delete('/entries/:id',async(req,res)=>{
  const idx = memEntries.findIndex(e => e.id === req.params.id);
  if (idx >= 0) memEntries.splice(idx, 1);
  deleteTimetableEntryFromFirestore(req.params.id).catch(() => {});
  res.json({ success: true });
});

// ── CONFLICTS ──
router.get('/conflicts',async(req,res)=>{try{return res.json(await svc.findConflicts(u(req).schoolId,req.query))}catch(_e){}
  const q = req.query as any;
  const conflicts = findMemConflicts(Number(q.dayOfWeek||q.day), q.periodId, q.teacherId, q.classId, q.sectionId, q.roomName, q.excludeId);
  res.json(conflicts);
});

// ── TEACHER AVAILABILITY ──
router.get('/teacher-availability/:teacherId',async(req,res)=>{
  const avail = getTeacherAvailability(req.params.teacherId, Number(req.query.day || 1));
  res.json(avail);
});

// ── ROOT (alias) ──
router.get('/',async(req,res)=>{try{const rows=await svc.listEntries(u(req).schoolId,req.query);if(rows?.length) return res.json(rows);}catch(_e){}
  let filtered = [...memEntries];
  const q = req.query as any;
  if (q.day) filtered = filtered.filter(e => e.day_of_week === Number(q.day));
  if (q.classId) filtered = filtered.filter(e => e.class_id === q.classId);
  if (q.sectionId) filtered = filtered.filter(e => e.section_id === q.sectionId);
  if (q.teacherId) filtered = filtered.filter(e => e.teacher_id === q.teacherId || e.substitute_teacher_id === q.teacherId);
  filtered.sort((a,b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
  res.json(filtered);
});
router.post('/',async(req,res)=>{try{return res.status(201).json(await svc.createEntry(u(req).schoolId,u(req).id,req.body))}catch(_e){}
  res.status(201).json({ id: `ent-${Date.now()}`, school_id: u(req).schoolId, status: 'PUBLISHED', ...req.body });
});

// ── PUBLISH ──
router.post('/entries/:id/publish',async(req,res)=>{try{return res.json(await svc.publish(u(req).schoolId,req.params.id))}catch(_e){}
  const entry = memEntries.find(e => e.id === req.params.id);
  if (entry) {
    entry.status = 'PUBLISHED';
    syncTimetableEntryToFirestore(entry).catch(() => {});
  }
  res.json(entry || { id: req.params.id, status: 'PUBLISHED' });
});

// ── SUBSTITUTES ──
router.post('/substitutes',async(req,res)=>{try{return res.json(await svc.assignSubstitute(u(req).schoolId,u(req).id,req.body))}catch(_e){}
  const d = req.body;
  const entry = memEntries.find(e => e.id === d.entryId);
  if (entry) {
    const sub = demoTeachers.find(t => t.id === d.substituteTeacherId);
    entry.substitute_teacher_id = d.substituteTeacherId;
    entry.substitute_teacher_name = sub?.name || 'Substitute';
    syncTimetableEntryToFirestore(entry).catch(() => {});
  }
  res.json({ id: d.entryId, substitute_teacher_id: d.substituteTeacherId });
});

export default router;
