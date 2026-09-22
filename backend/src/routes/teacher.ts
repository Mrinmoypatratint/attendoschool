import { queueAbsentNotifications } from '../services/notificationService';
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { queueAbsentSms } from '../services/smsService';
import { demoStudents, demoClasses, demoSections, demoSubjects } from './schoolData';
import { syncAttendanceToFirestore } from '../services/firestoreSync';
import { isSameSchool, isTestSchool } from './auth';
import { collections, isFirebaseConfigured } from '../firebase';
import { memEntries } from './timetable';

export interface MemAttendanceSession {
  id: string;
  school_id: string;
  schoolId: string;
  class_id: string;
  classId: string;
  class_number: number;
  classNumber: number;
  section_id: string;
  sectionId: string;
  section_name: string;
  sectionName: string;
  subject_id: string | null;
  subjectId: string | null;
  subject_name: string;
  subjectName: string;
  attendance_date: string;
  attendanceDate: string;
  start_time: string;
  startTime: string;
  end_time: string;
  endTime: string;
  teacher_id: string;
  teacherId: string;
  takenBy: string;
  teacher_name?: string;
  teacherName?: string;
  total_count?: number;
  totalCount?: number;
  present_count?: number;
  presentCount?: number;
  absent_count?: number;
  absentCount?: number;
  created_at?: string;
  createdAt?: string;
}

export interface MemAttendanceRecord {
  id: string;
  sessionId: string;
  attendance_session_id: string;
  attendanceSessionId: string;
  studentId: string;
  student_id: string;
  studentName?: string;
  student_name?: string;
  rollNumber?: string;
  roll_number?: string;
  schoolId: string;
  school_id: string;
  classId: string;
  class_id: string;
  sectionId: string;
  section_id: string;
  attendanceDate: string;
  attendance_date: string;
  status: 'PRESENT' | 'ABSENT';
  is_present: boolean;
  isPresent: boolean;
  remarks?: string;
  createdAt?: string;
}

export const memAttendanceSessions: MemAttendanceSession[] = [];
export const memAttendanceRecords: MemAttendanceRecord[] = [];

const r = Router();
const teacher = [requireAuth, requireRoles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')];

/**
 * Helper: Resolve all identifiers, names, and emails associated with a teacher user
 */
async function resolveTeacherIdentities(user: any): Promise<{ ids: string[]; names: string[]; emails: string[] }> {
  const ids: string[] = user.id ? [String(user.id)] : [];
  const names: string[] = user.name ? [String(user.name).toLowerCase().trim()] : [];
  const emails: string[] = user.email ? [String(user.email).toLowerCase().trim()] : [];

  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.teachers().get();
      snap.docs.forEach(doc => {
        const d = doc.data();
        const docEmail = (d.email || '').toLowerCase().trim();
        const docName = (d.name || d.fullName || '').toLowerCase().trim();
        const docUserId = String(d.user_id || d.userId || '');

        const matches =
          doc.id === user.id ||
          (user.email && docEmail === user.email.toLowerCase().trim()) ||
          (user.name && docName === user.name.toLowerCase().trim()) ||
          (docUserId && docUserId === user.id);

        if (matches) {
          if (!ids.includes(doc.id)) ids.push(doc.id);
          if (docUserId && !ids.includes(docUserId)) ids.push(docUserId);
          if (docName && !names.includes(docName)) names.push(docName);
          if (docEmail && !emails.includes(docEmail)) emails.push(docEmail);
        }
      });
    } catch (err: any) {
      console.warn('[Teacher] Error resolving teacher identities from Firestore:', err.message);
    }
  }
  return { ids, names, emails };
}

/**
 * Helper: Check if a timetable entry belongs to the teacher
 */
function matchesTeacher(e: any, identities: { ids: string[]; names: string[]; emails: string[] }): boolean {
  const eTeacherId = String(e.teacher_id || e.teacherId || '');
  const eSubId = String(e.substitute_teacher_id || e.altTeacherId || '');
  const eTeacherName = String(e.teacher_name || e.teacherName || '').toLowerCase().trim();
  const eSubName = String(e.substitute_teacher_name || e.altTeacherName || '').toLowerCase().trim();

  if (eTeacherId && identities.ids.includes(eTeacherId)) return true;
  if (eSubId && identities.ids.includes(eSubId)) return true;
  if (eTeacherName && identities.names.some(n => n && (eTeacherName === n || eTeacherName.includes(n) || n.includes(eTeacherName)))) return true;
  if (eSubName && identities.names.some(n => n && (eSubName === n || eSubName.includes(n) || n.includes(eSubName)))) return true;

  return false;
}

// ── GET /api/teacher/routine/today ──
// Returns timetable routine entries for today matching the teacher (or all today routines for admins)
r.get('/routine/today', ...teacher, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;
  const isTeacher = req.user!.role === 'TEACHER';
  const now = new Date();
  const rawDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayParam = req.query.day ? Number(req.query.day) : null;
  const targetDay = dayParam !== null ? dayParam : (rawDay === 0 ? 1 : rawDay);

  const identities = isTeacher ? await resolveTeacherIdentities(req.user) : { ids: [], names: [], emails: [] };

  // 1. Try DB first (Postgres)
  try {
    let q;
    if (isTeacher) {
      q = await pool.query(
        `SELECT e.id, e.class_id, e.section_id, e.subject_id, e.teacher_id,
                e.start_time, e.end_time, e.day_of_week, e.room_name AS room,
                c.class_number, s.name AS section_name, sub.name AS subject_name,
                p.name AS period_name, p.period_number
         FROM timetable_entries e
         LEFT JOIN timetable_periods p ON p.id = e.period_id
         LEFT JOIN classes c ON c.id = e.class_id
         LEFT JOIN sections s ON s.id = e.section_id
         LEFT JOIN subjects sub ON sub.id = e.subject_id
         WHERE e.school_id = $1 AND e.day_of_week = $2
           AND (e.teacher_id = $3 OR e.substitute_teacher_id = $3)
           AND e.status = 'PUBLISHED'
         ORDER BY e.start_time, p.period_number`,
        [sid, targetDay, req.user!.id]
      );
    } else {
      q = await pool.query(
        `SELECT e.id, e.class_id, e.section_id, e.subject_id, e.teacher_id,
                e.start_time, e.end_time, e.day_of_week, e.room_name AS room,
                c.class_number, s.name AS section_name, sub.name AS subject_name,
                p.name AS period_name, p.period_number
         FROM timetable_entries e
         LEFT JOIN timetable_periods p ON p.id = e.period_id
         LEFT JOIN classes c ON c.id = e.class_id
         LEFT JOIN sections s ON s.id = e.section_id
         LEFT JOIN subjects sub ON sub.id = e.subject_id
         WHERE e.school_id = $1 AND e.day_of_week = $2
           AND e.status = 'PUBLISHED'
         ORDER BY e.start_time, p.period_number`,
        [sid, targetDay]
      );
    }
    if (q?.rowCount && q.rows.length > 0) {
      return res.json(q.rows);
    }
  } catch (_e) {}

  // 2. Query Cloud Firestore timetable_entries!
  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.timetableEntries().get();
      if (!snap.empty) {
        const routines: any[] = [];
        snap.docs.forEach(doc => {
          const e = doc.data();
          const docSid = e.school_id || e.schoolId;
          if (docSid && !isSameSchool(docSid, sid)) return;
          if (!docSid && !isTestSchool(sid)) return;

          const entryDay = Number(e.day_of_week ?? e.dayOfWeek);
          if (entryDay !== targetDay) return;
          if (e.status === 'CANCELLED') return;

          if (isTeacher && !matchesTeacher(e, identities)) {
            return;
          }

          routines.push({
            id: e.id || doc.id,
            timetable_entry_id: e.id || doc.id,
            class_id: e.class_id || e.classId,
            class_number: Number(e.class_number ?? e.classNumber ?? 8),
            section_id: e.section_id || e.sectionId,
            section_name: e.section_name || e.sectionName || 'A',
            subject_id: e.subject_id || e.subjectId,
            subject_name: e.subject_name || e.subjectName || 'Subject',
            period_id: e.period_id || e.periodId,
            period_name: e.period_name || e.periodName || 'Period',
            period_number: Number(e.period_number ?? e.periodNumber ?? 1),
            start_time: e.start_time || e.startTime || '09:00',
            end_time: e.end_time || e.endTime || '09:45',
            room: e.room_name || e.roomName || e.room || '',
            room_name: e.room_name || e.roomName || e.room || '',
            teacher_id: e.teacher_id || e.teacherId,
            teacher_name: e.teacher_name || e.teacherName,
            day_of_week: entryDay
          });
        });

        if (routines.length > 0) {
          routines.sort((a, b) => a.period_number - b.period_number || a.start_time.localeCompare(b.start_time));
          return res.json(routines);
        }
      }
    } catch (err: any) {
      console.warn('[Teacher] Error querying timetable_entries from Firestore:', err.message);
    }
  }

  // 3. Fallback to in-memory memEntries
  const memList = memEntries.filter(e => {
    const docSid = e.school_id || e.schoolId;
    if (docSid && !isSameSchool(docSid, sid)) return false;
    if (Number(e.day_of_week ?? e.dayOfWeek) !== targetDay) return false;
    if (isTeacher && !matchesTeacher(e, identities)) return false;
    return true;
  }).map(e => ({
    id: e.id,
    timetable_entry_id: e.id,
    class_id: e.class_id,
    class_number: e.class_number || 8,
    section_id: e.section_id,
    section_name: e.section_name || 'A',
    subject_id: e.subject_id,
    subject_name: e.subject_name || 'Subject',
    period_id: e.period_id,
    period_name: e.period_name || 'Period',
    period_number: e.period_number || 1,
    start_time: e.start_time || '09:00',
    end_time: e.end_time || '09:45',
    room: e.room_name || '',
    room_name: e.room_name || '',
    teacher_id: e.teacher_id,
    teacher_name: e.teacher_name,
    day_of_week: e.day_of_week
  }));

  if (memList.length > 0) {
    memList.sort((a, b) => a.period_number - b.period_number || a.start_time.localeCompare(b.start_time));
    return res.json(memList);
  }

  // 4. Test school default seed fallback
  if (isTestSchool(sid)) {
    return res.json([
      { id: 'rout-gw-1', day_of_week: targetDay, class_number: 10, section_name: 'A', class_id: 'cls-gw-10', section_id: 'sec-gw-10-A', subject_id: 'sub-math', subject_name: 'Mathematics', teacher_name: req.user!.name || 'Rahul Sen', start_time: '09:00', end_time: '09:45', room: 'Room 101' },
      { id: 'rout-gw-2', day_of_week: targetDay, class_number: 10, section_name: 'A', class_id: 'cls-gw-10', section_id: 'sec-gw-10-A', subject_id: 'sub-sci', subject_name: 'Science', teacher_name: req.user!.name || 'Rahul Sen', start_time: '10:00', end_time: '10:45', room: 'Lab 2' }
    ]);
  }

  res.json([]);
});

// ── GET /api/teacher/routine/week ──
// Returns all weekly timetable routines for this teacher (across all days)
r.get('/routine/week', ...teacher, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;
  const isTeacher = req.user!.role === 'TEACHER';
  const identities = isTeacher ? await resolveTeacherIdentities(req.user) : { ids: [], names: [], emails: [] };

  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.timetableEntries().get();
      if (!snap.empty) {
        const routines: any[] = [];
        snap.docs.forEach(doc => {
          const e = doc.data();
          const docSid = e.school_id || e.schoolId;
          if (docSid && !isSameSchool(docSid, sid)) return;
          if (e.status === 'CANCELLED') return;

          if (isTeacher && !matchesTeacher(e, identities)) return;

          routines.push({
            id: e.id || doc.id,
            timetable_entry_id: e.id || doc.id,
            class_id: e.class_id || e.classId,
            class_number: Number(e.class_number ?? e.classNumber ?? 8),
            section_id: e.section_id || e.sectionId,
            section_name: e.section_name || e.sectionName || 'A',
            subject_id: e.subject_id || e.subjectId,
            subject_name: e.subject_name || e.subjectName || 'Subject',
            period_id: e.period_id || e.periodId,
            period_name: e.period_name || e.periodName || 'Period',
            period_number: Number(e.period_number ?? e.periodNumber ?? 1),
            start_time: e.start_time || e.startTime || '09:00',
            end_time: e.end_time || e.endTime || '09:45',
            room: e.room_name || e.roomName || e.room || '',
            room_name: e.room_name || e.roomName || e.room || '',
            teacher_id: e.teacher_id || e.teacherId,
            teacher_name: e.teacher_name || e.teacherName,
            day_of_week: Number(e.day_of_week ?? e.dayOfWeek)
          });
        });

        routines.sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
        return res.json(routines);
      }
    } catch {}
  }
  res.json([]);
});

// ── Helper: Matches student to class and section flexibly ──
function matchesStudentClassAndSection(s: any, classTarget: string, secTarget: string): boolean {
  const targetClassNum = parseInt(String(classTarget).replace(/\D/g, ''), 10);
  const sClassId = String(s.class_id || s.classId || '');
  const sClassNum = parseInt(String(s.class_number ?? s.classNumber ?? s.className ?? '').replace(/\D/g, ''), 10);

  const matchClass =
    (sClassId && (sClassId === classTarget || sClassId.endsWith(`-${targetClassNum}`))) ||
    (!isNaN(targetClassNum) && !isNaN(sClassNum) && targetClassNum === sClassNum) ||
    String(s.class_number) === classTarget ||
    String(s.className) === classTarget;

  if (!matchClass) return false;

  const cleanSecTarget = String(secTarget || '').replace(/section/i, '').replace(/sec/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const sSecId = String(s.section_id || s.sectionId || '').toLowerCase();
  const sSecName = String(s.section_name || s.sectionName || s.section || '').replace(/section/i, '').replace(/sec/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  const matchSec =
    !cleanSecTarget ||
    sSecId === secTarget.toLowerCase() ||
    (sSecName && (sSecName === cleanSecTarget || cleanSecTarget.endsWith(sSecName) || sSecName.endsWith(cleanSecTarget)));

  return Boolean(matchSec);
}

// ── GET /api/teacher/classes/:classId/:sectionId/students & /api/teacher/students/:classId/:sectionId & /api/teacher/students ──
const getStudentsHandler = async (req: AuthRequest, res: any) => {
  const sid = req.user!.schoolId;
  const classParam = String(req.params.classId || req.query.classId || req.query.class_id || req.query.class_number || '');
  const secId = String(req.params.sectionId || req.query.sectionId || req.query.section_id || req.query.section_name || '');
  const secParam = secId.toLowerCase();

  // 1. Check PostgreSQL if enabled
  if (process.env.USE_POSTGRES === 'true') {
    try {
      const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classParam);
      const isSecUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(secId);
      const classNum = parseInt(classParam.replace(/\D/g, ''), 10) || 10;
      const cleanSec = secParam.replace(/section\s*/i, '').trim();

      const q = await pool.query(
        `SELECT id, name, roll_number, admission_number, parent_sms_number, email AS student_email, parent_email
         FROM students
         WHERE school_id=$1
           AND (${isClassUuid ? 'class_id=$2' : 'FALSE'} OR class_id IN (SELECT id FROM classes WHERE school_id=$1 AND class_number=$3))
           AND (${isSecUuid ? 'section_id=$4' : 'FALSE'} OR section_id IN (SELECT id FROM sections WHERE school_id=$1 AND LOWER(name)=$5))
           AND is_active
         ORDER BY roll_number`,
        [sid, isClassUuid ? classParam : '00000000-0000-0000-0000-000000000000', classNum, isSecUuid ? secId : '00000000-0000-0000-0000-000000000000', cleanSec]
      );
      if (q.rowCount && q.rows.length > 0) return res.json(q.rows);
    } catch {}
  }

  // 2. Check Cloud Firestore
  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.students().get();
      if (!snap.empty) {
        const list = snap.docs.map(d => ({
          id: d.id,
          name: d.data().fullName || d.data().name || 'Student',
          roll_number: d.data().rollNumber || d.data().roll_number || '1',
          admission_number: d.data().admissionNumber || d.data().admission_number || `ADM-${d.id}`,
          parent_sms_number: d.data().parentPhone || d.data().parent_sms_number || '',
          student_email: d.data().email || d.data().student_email || '',
          parent_email: d.data().parentEmail || d.data().parent_email || '',
          ...d.data()
        })).filter((s: any) => {
          if (s.is_active === false || s.status === 'DELETED') return false;
          const matchSchool = (s.school_id && isSameSchool(s.school_id, sid)) || (s.schoolId && isSameSchool(s.schoolId, sid));
          if (!matchSchool) return false;

          return matchesStudentClassAndSection(s, classParam, secId);
        });

        if (list.length > 0) {
          list.sort((a: any, b: any) => String(a.roll_number || a.rollNumber || '').localeCompare(String(b.roll_number || b.rollNumber || ''), undefined, { numeric: true }));
          return res.json(list);
        }
      }
    } catch {}
  }

  // 3. Fallback for test school
  if (isTestSchool(sid)) {
    const filtered = demoStudents.filter(s =>
      matchesStudentClassAndSection(s, classParam, secId)
    );
    return res.json(filtered.length ? filtered : demoStudents);
  }

  res.json([]);
};

r.get('/classes/:classId/:sectionId/students', ...teacher, getStudentsHandler);
r.get('/students/:classId/:sectionId', ...teacher, getStudentsHandler);
r.get('/students', ...teacher, getStudentsHandler);

// ── POST /api/teacher/attendance ──
r.post('/attendance', ...teacher, async (req: AuthRequest, res) => {
  const x = req.body;
  const schoolId = req.user!.schoolId!;

  const classId = x.classId || x.class_id;
  const sectionId = x.sectionId || x.section_id;
  const attendanceDate = x.attendanceDate || x.attendance_date || x.date || new Date().toISOString().slice(0, 10);
  const startTime = x.startTime || x.start_time || '09:00:00';
  const endTime = x.endTime || x.end_time || '09:45:00';

  if (!classId || !sectionId) {
    return res.status(400).json({ message: 'Attendance session data is incomplete: classId and sectionId are required' });
  }

  x.classId = classId;
  x.sectionId = sectionId;
  x.attendanceDate = attendanceDate;
  x.startTime = startTime;
  x.endTime = endTime;

  const presentSet = new Set<string>(Array.isArray(x.presentStudentIds) ? x.presentStudentIds.map(String) : []);
  const usePostgres = process.env.USE_POSTGRES === 'true';

  let sessionId = 'sess-' + Date.now();
  let sessionSavedInDb = false;
  let finalRecords: any[] = [];
  let finalClassNum = Number(x.classNumber ?? x.class_number ?? (String(x.classId).match(/\d+/)?.[0] || 10));
  let finalSecName = String(x.sectionName || x.section_name || 'A').replace(/section\s*/i, '').trim() || 'A';
  let finalSubName = String(x.subjectName || x.subject_name || 'General');

  // 1. Try PostgreSQL if explicitly enabled
  if (usePostgres) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        let teacherId = req.user!.id;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherId);
        if (!isUuid) {
          const uRes = await client.query('SELECT id FROM users WHERE school_id = $1 AND (email = $2 OR role = $3) LIMIT 1', [schoolId, req.user!.email, req.user!.role]);
          teacherId = uRes.rows[0]?.id || '00000000-0000-0000-0000-000000000021';
        }

        let classId = x.classId;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)) {
          const classNum = parseInt(String(classId).replace(/\D/g, ''), 10) || finalClassNum || 10;
          let cRes = await client.query('SELECT id, class_number FROM classes WHERE school_id = $1 AND class_number = $2 LIMIT 1', [schoolId, classNum]);
          if (!cRes.rowCount) {
            cRes = await client.query('INSERT INTO classes(school_id, class_number) VALUES($1, $2) RETURNING id, class_number', [schoolId, classNum]).catch(() => ({ rowCount: 0, rows: [] } as any));
          }
          if (cRes.rows[0]?.id) {
            classId = cRes.rows[0].id;
            finalClassNum = cRes.rows[0].class_number;
          }
        }

        let sectionId = x.sectionId;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sectionId)) {
          let sRes = await client.query('SELECT id, name FROM sections WHERE school_id = $1 AND class_id = $2 AND LOWER(name) = LOWER($3) LIMIT 1', [schoolId, classId, finalSecName]);
          if (!sRes.rowCount) {
            sRes = await client.query('INSERT INTO sections(school_id, class_id, name) VALUES($1, $2, $3) RETURNING id, name', [schoolId, classId, finalSecName]).catch(() => ({ rowCount: 0, rows: [] } as any));
          }
          if (sRes.rows[0]?.id) {
            sectionId = sRes.rows[0].id;
            finalSecName = sRes.rows[0].name;
          }
        }

        let subjectId = x.subjectId || null;
        if (subjectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectId)) {
          const subRes = await client.query('SELECT id, name FROM subjects WHERE school_id = $1 LIMIT 1', [schoolId]);
          subjectId = subRes.rows[0]?.id || null;
          if (subRes.rows[0]?.name) finalSubName = subRes.rows[0].name;
        }

        const duplicate = await client.query(
          `SELECT id FROM attendance_sessions
           WHERE school_id=$1 AND class_id=$2 AND section_id=$3 AND attendance_date=$4`,
          [schoolId, classId, sectionId, x.attendanceDate]
        );

        if (duplicate.rowCount) {
          sessionId = duplicate.rows[0].id;
          await client.query('DELETE FROM attendance_records WHERE attendance_session_id = $1', [sessionId]);
        } else {
          const session = (await client.query(
            `INSERT INTO attendance_sessions
             (school_id,class_id,section_id,subject_id,teacher_id,attendance_date,start_time,end_time,class_number,section_name,subject_name)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
            [schoolId, classId, sectionId, subjectId, teacherId, x.attendanceDate, x.startTime, x.endTime, finalClassNum, finalSecName, finalSubName]
          )).rows[0];
          sessionId = session.id;
        }

        // Fetch students enrolled in this section in Postgres
        const students = (await client.query(
          `SELECT id, name, roll_number FROM students WHERE school_id=$1 AND class_id=$2 AND section_id=$3 AND is_active`,
          [schoolId, classId, sectionId]
        )).rows;

        if (students.length > 0) {
          for (const st of students) {
            const isPres = presentSet.has(String(st.id)) || presentSet.has(String(st.roll_number));
            const status = isPres ? 'PRESENT' : 'ABSENT';
            await client.query(
              `INSERT INTO attendance_records(attendance_session_id,student_id,is_present,status)
               VALUES($1,$2,$3,$4)`, [sessionId, st.id, isPres, status]
            );
            finalRecords.push({
              student_id: st.id,
              studentId: st.id,
              studentName: st.name,
              rollNumber: st.roll_number,
              is_present: isPres,
              status
            });
          }

          const presCount = finalRecords.filter(r => r.is_present).length;
          const absCount = finalRecords.length - presCount;
          await client.query(
            `UPDATE attendance_sessions SET present_count=$1, absent_count=$2, total_count=$3 WHERE id=$4`,
            [presCount, absCount, finalRecords.length, sessionId]
          ).catch(() => {});

          await client.query('COMMIT');
          sessionSavedInDb = true;

          queueAbsentSms(sessionId).catch(() => {});
          queueAbsentNotifications(sessionId).catch(() => {});
        } else {
          await client.query('ROLLBACK');
        }
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (_dbErr) {
      // Proceed to Firestore fallback
    }
  }

  // 2. Direct Cloud Firestore & in-memory fallback
  if (!sessionSavedInDb) {
    if (Array.isArray(x.records) && x.records.length > 0) {
      finalRecords = x.records.map((r: any) => {
        const isPres = r.status === 'PRESENT' || r.isPresent === true || r.is_present === true || presentSet.has(String(r.studentId || r.id));
        return {
          student_id: String(r.studentId || r.student_id || r.id),
          studentId: String(r.studentId || r.student_id || r.id),
          studentName: r.studentName || r.name || 'Student',
          rollNumber: String(r.rollNumber || r.roll_number || ''),
          is_present: isPres,
          status: isPres ? 'PRESENT' : 'ABSENT',
          remarks: r.remarks || ''
        };
      });
    } else {
      let studentPool: any[] = [];
      if (Array.isArray(x.studentIds) && x.studentIds.length > 0) {
        studentPool = x.studentIds.map((id: string) => ({ id }));
      } else if (isFirebaseConfigured()) {
        try {
          const snap = await collections.students().get();
          if (!snap.empty) {
            studentPool = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((s: any) => {
              if (s.is_active === false || s.status === 'DELETED') return false;
              const matchSchool = (s.school_id && isSameSchool(s.school_id, schoolId)) || (s.schoolId && isSameSchool(s.schoolId, schoolId));
              if (!matchSchool) return false;
              return matchesStudentClassAndSection(s, String(x.classId), String(x.sectionId));
            });
          }
        } catch {}
      }

      if (studentPool.length === 0) {
        const schoolMatched = demoStudents.filter(s => s.school_id && isSameSchool(s.school_id, schoolId));
        const targetStudents = (isTestSchool(schoolId) ? demoStudents : schoolMatched).filter(s =>
          matchesStudentClassAndSection(s, String(x.classId), String(x.sectionId))
        );
        studentPool = targetStudents.length ? targetStudents : (isTestSchool(schoolId) ? demoStudents.slice(0, 10) : []);
      }

      finalRecords = studentPool.map((s: any) => {
        const isPres = presentSet.has(String(s.id)) || (s.roll_number && presentSet.has(String(s.roll_number))) || (s.rollNumber && presentSet.has(String(s.rollNumber)));
        return {
          student_id: s.id,
          studentId: s.id,
          studentName: s.fullName || s.name || 'Student',
          rollNumber: s.rollNumber || s.roll_number || '',
          is_present: isPres,
          status: isPres ? 'PRESENT' : 'ABSENT',
          remarks: ''
        };
      });
    }
  }

  const presentCount = finalRecords.filter((r: any) => r.is_present).length;
  const absentCount = finalRecords.length - presentCount;

  // Build unified session metadata
  const sessionMeta: MemAttendanceSession = {
    id: sessionId,
    school_id: schoolId,
    schoolId,
    class_id: String(x.classId),
    classId: String(x.classId),
    class_number: finalClassNum,
    classNumber: finalClassNum,
    section_id: String(x.sectionId),
    sectionId: String(x.sectionId),
    section_name: finalSecName,
    sectionName: finalSecName,
    subject_id: x.subjectId || null,
    subjectId: x.subjectId || null,
    subject_name: finalSubName,
    subjectName: finalSubName,
    teacher_id: req.user!.id,
    teacherId: req.user!.id,
    takenBy: req.user!.id,
    teacher_name: req.user?.name || 'Class Faculty',
    teacherName: req.user?.name || 'Class Faculty',
    attendance_date: x.attendanceDate,
    attendanceDate: x.attendanceDate,
    start_time: x.startTime,
    startTime: x.startTime,
    end_time: x.endTime,
    endTime: x.endTime,
    total_count: finalRecords.length,
    totalCount: finalRecords.length,
    present_count: presentCount,
    presentCount,
    absent_count: absentCount,
    absentCount,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  // 3. Cache in shared in-memory store for instant reflection
  const existingMemIdx = memAttendanceSessions.findIndex(s => s.id === sessionId || (isSameSchool(s.schoolId, schoolId) && String(s.classId) === String(x.classId) && String(s.sectionId) === String(x.sectionId) && s.attendanceDate === x.attendanceDate));
  if (existingMemIdx >= 0) {
    memAttendanceSessions[existingMemIdx] = sessionMeta;
  } else {
    memAttendanceSessions.unshift(sessionMeta);
  }
  if (memAttendanceSessions.length > 200) memAttendanceSessions.length = 200;

  // Prune prior records for this session in memory
  for (let i = memAttendanceRecords.length - 1; i >= 0; i--) {
    if (memAttendanceRecords[i].sessionId === sessionId) {
      memAttendanceRecords.splice(i, 1);
    }
  }

  for (const r of finalRecords) {
    memAttendanceRecords.unshift({
      id: `att-rec-${sessionId}-${r.studentId}`,
      sessionId,
      attendance_session_id: sessionId,
      attendanceSessionId: sessionId,
      studentId: r.studentId,
      student_id: r.studentId,
      studentName: r.studentName,
      student_name: r.studentName,
      rollNumber: r.rollNumber,
      roll_number: r.rollNumber,
      schoolId,
      school_id: schoolId,
      classId: String(x.classId),
      class_id: String(x.classId),
      sectionId: String(x.sectionId),
      section_id: String(x.sectionId),
      attendanceDate: x.attendanceDate,
      attendance_date: x.attendanceDate,
      status: r.status,
      is_present: r.is_present,
      isPresent: r.is_present,
      remarks: '',
      createdAt: new Date().toISOString()
    });
  }
  if (memAttendanceRecords.length > 2000) memAttendanceRecords.length = 2000;

  // 4. Sync to Cloud Firestore in background
  syncAttendanceToFirestore(sessionMeta, finalRecords).catch(err => {
    console.warn('[Teacher] Background Firestore attendance sync warning:', err.message);
  });

  return res.status(201).json({
    success: true,
    sessionId,
    total: finalRecords.length,
    present: presentCount,
    absent: absentCount
  });
});

// ── GET /api/teacher/attendance/history ──
r.get('/attendance/history', ...teacher, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;
  const teacherId = req.user!.id;
  const isTeacher = req.user!.role === 'TEACHER';
  const identities = isTeacher ? await resolveTeacherIdentities(req.user) : { ids: [], names: [], emails: [] };

  // 1. Try PostgreSQL if enabled
  if (process.env.USE_POSTGRES === 'true') {
    try {
      const q = await pool.query(
        `SELECT a.id, a.attendance_date, a.start_time, a.end_time,
                COALESCE(a.class_number, c.class_number, 10) AS class_number,
                COALESCE(a.section_name, s.name, 'A') AS section_name,
                COALESCE(a.subject_name, sub.name, 'General') AS subject_name,
                COALESCE(a.total_count, COUNT(ar.id)::int) AS total,
                COALESCE(a.present_count, COUNT(ar.id) FILTER(WHERE ar.is_present OR ar.status = 'PRESENT')::int) AS present
         FROM attendance_sessions a
         LEFT JOIN classes c ON c.id = a.class_id
         LEFT JOIN sections s ON s.id = a.section_id
         LEFT JOIN subjects sub ON sub.id = a.subject_id
         LEFT JOIN attendance_records ar ON ar.attendance_session_id = a.id
         WHERE a.school_id = $1 ${isTeacher ? 'AND a.teacher_id = $2' : ''}
         GROUP BY a.id, a.attendance_date, a.start_time, a.end_time, a.class_number, c.class_number, a.section_name, s.name, a.subject_name, sub.name, a.total_count, a.present_count
         ORDER BY a.attendance_date DESC, a.start_time DESC`,
        isTeacher ? [sid, teacherId] : [sid]
      );
      if (q.rowCount && q.rows.length > 0) return res.json(q.rows);
    } catch {}
  }

  // 2. Query Cloud Firestore + In-Memory Store
  const historyMap = new Map<string, any>();

  // Add from in-memory sessions first
  memAttendanceSessions.forEach(s => {
    if (!isSameSchool(s.schoolId, sid)) return;
    if (isTeacher && s.teacherId && !identities.ids.includes(s.teacherId) && s.teacherId !== teacherId) return;
    historyMap.set(s.id, {
      id: s.id,
      attendance_date: s.attendanceDate,
      start_time: s.startTime,
      end_time: s.endTime,
      class_number: s.classNumber,
      section_name: s.sectionName,
      subject_name: s.subjectName,
      total: s.totalCount || 0,
      total_count: s.totalCount || 0,
      present: s.presentCount || 0,
      present_count: s.presentCount || 0,
      absent: (s.totalCount || 0) - (s.presentCount || 0),
      absent_count: (s.totalCount || 0) - (s.presentCount || 0)
    });
  });

  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.attendanceSessions().get();
      if (!snap.empty) {
        for (const doc of snap.docs) {
          if (historyMap.has(doc.id)) continue;
          const d = doc.data();
          const docSid = d.school_id || d.schoolId;
          if (docSid && !isSameSchool(docSid, sid)) continue;

          const takenBy = String(d.takenBy || d.teacher_id || d.teacherId || '');
          if (isTeacher && takenBy && !identities.ids.includes(takenBy) && takenBy !== teacherId) continue;

          let total = d.totalCount ?? d.total_count ?? 0;
          let present = d.presentCount ?? d.present_count ?? 0;
          if (!total) {
            try {
              const recSnap = await collections.attendanceRecords().where('sessionId', '==', doc.id).get();
              total = recSnap.size;
              present = recSnap.docs.filter(rd => rd.data().status === 'PRESENT' || rd.data().is_present === true).length;
            } catch {}
          }

          historyMap.set(doc.id, {
            id: doc.id,
            attendance_date: d.attendanceDate || d.attendance_date || new Date().toISOString().slice(0, 10),
            start_time: d.startTime || d.start_time || '09:00',
            end_time: d.endTime || d.end_time || '09:45',
            class_number: d.class_number ?? d.classNumber ?? 10,
            section_name: d.section_name || d.sectionName || 'A',
            subject_name: d.subject_name || d.subjectName || 'General',
            total,
            total_count: total,
            present,
            present_count: present,
            absent: Math.max(0, total - present),
            absent_count: Math.max(0, total - present)
          });
        }
      }
    } catch (err: any) {
      console.warn('[Teacher] Error querying attendance history from Firestore:', err.message);
    }
  }

  if (historyMap.size > 0) {
    const list = Array.from(historyMap.values());
    list.sort((a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime() || b.start_time.localeCompare(a.start_time));
    return res.json(list);
  }

  // 3. Fallback for test school
  if (isTestSchool(sid)) {
    return res.json([
      { id: 'sess-01', attendance_date: new Date().toISOString().slice(0, 10), start_time: '09:00:00', end_time: '09:45:00', class_number: 10, section_name: 'A', subject_name: 'Mathematics', total: 10, present: 9 },
      { id: 'sess-02', attendance_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), start_time: '09:00:00', end_time: '09:45:00', class_number: 10, section_name: 'A', subject_name: 'Mathematics', total: 10, present: 9 }
    ]);
  }

  res.json([]);
});

export default r;
