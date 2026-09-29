import { queueAbsentNotifications } from '../services/notificationService';
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { queueAbsentSms, sendSms } from '../services/smsService';
import { demoStudents, demoClasses, demoSections, demoSubjects, demoTeachers } from './schoolData';
import { syncAttendanceToFirestore, syncAttendanceAuditLogToFirestore } from '../services/firestoreSync';
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
  left_early_count?: number;
  leftEarlyCount?: number;
  late_count?: number;
  lateCount?: number;
  is_reattendance?: boolean;
  isReattendance?: boolean;
  reattendance_count?: number;
  reattendanceCount?: number;
  last_modified_by?: string;
  lastModifiedBy?: string;
  last_modified_name?: string;
  lastModifiedName?: string;
  last_modified_at?: string;
  lastModifiedAt?: string;
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
  status: 'PRESENT' | 'ABSENT' | 'LEFT_EARLY' | 'LATE' | 'EXCUSED';
  is_present: boolean;
  isPresent: boolean;
  departure_period?: string;
  departurePeriod?: string;
  departure_time?: string;
  departureTime?: string;
  arrival_period?: string;
  arrivalPeriod?: string;
  arrival_time?: string;
  arrivalTime?: string;
  updated_by?: string;
  updatedBy?: string;
  updated_by_name?: string;
  updatedByName?: string;
  updated_at?: string;
  updatedAt?: string;
  remarks?: string;
  createdAt?: string;
}

export interface MemAttendanceAuditLog {
  id: string;
  schoolId: string;
  school_id?: string;
  sessionId: string;
  session_id?: string;
  studentId?: string;
  student_id?: string;
  studentName?: string;
  student_name?: string;
  rollNumber?: string;
  roll_number?: string;
  action: 'LEFT_EARLY' | 'LATE_ARRIVAL' | 'STATUS_UPDATE' | 'REATTENDANCE_BATCH' | 'INITIAL_SUBMISSION';
  previousStatus?: string;
  previous_status?: string;
  newStatus: string;
  new_status?: string;
  departurePeriod?: string;
  departure_period?: string;
  departureTime?: string;
  departure_time?: string;
  arrivalPeriod?: string;
  arrival_period?: string;
  arrivalTime?: string;
  arrival_time?: string;
  reason?: string;
  changedBy: string;
  changed_by?: string;
  changedByName: string;
  changed_by_name?: string;
  modified_by_name?: string;
  modifiedByName?: string;
  notificationSent?: boolean;
  notification_sent?: boolean;
  createdAt: string;
  created_at?: string;
}

export const memAttendanceSessions: MemAttendanceSession[] = [];
export const memAttendanceRecords: MemAttendanceRecord[] = [];
export const memAttendanceAuditLogs: MemAttendanceAuditLog[] = [];

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

  return res.json([]);
};

r.get('/classes/:classId/:sectionId/students', ...teacher, getStudentsHandler);
r.get('/students/:classId/:sectionId', ...teacher, getStudentsHandler);
r.get('/students', ...teacher, getStudentsHandler);

/**
 * Helper: Dispatch notification/SMS alert for student re-attendance (e.g. left early or late arrival)
 */
async function dispatchStudentReattendanceAlert(params: {
  schoolId: string;
  sessionId: string;
  student: any;
  status: string;
  period?: string;
  time?: string;
  reason?: string;
  teacherName: string;
  className: string;
  sectionName: string;
}) {
  const { schoolId, sessionId, student, status, period, time, reason, teacherName, className, sectionName } = params;
  const parentPhone = student.parent_sms_number || student.parentPhone || student.parent_phone || '';
  const studentName = student.name || student.studentName || 'Student';

  let alertMessage = '';
  if (status === 'LEFT_EARLY') {
    alertMessage = `AttendoSchool Notice: Your ward ${studentName} (Class ${className}-${sectionName}) was recorded as leaving school ${period ? period + ' ' : ''}at ${time || 'today'}. Reason: ${reason || 'Early departure'}. Recorded by: ${teacherName}. Contact school office for any queries.`;
  } else if (status === 'LATE') {
    alertMessage = `AttendoSchool Notice: Your ward ${studentName} (Class ${className}-${sectionName}) arrived at school ${period ? period + ' ' : ''}at ${time || 'today'}. Reason: ${reason || 'Late arrival'}. Recorded by: ${teacherName}.`;
  } else if (status === 'ABSENT') {
    alertMessage = `AttendoSchool Alert: Your ward ${studentName} was marked ABSENT for Class ${className}-${sectionName} today by ${teacherName}.`;
  } else {
    alertMessage = `AttendoSchool Notice: Attendance status for ${studentName} (Class ${className}-${sectionName}) was updated to ${status} by ${teacherName}.`;
  }

  // 1. Send SMS if phone is available
  if (parentPhone) {
    try {
      await sendSms('mock', parentPhone, alertMessage);
      if (process.env.USE_POSTGRES === 'true') {
        await pool.query(
          `INSERT INTO sms_logs(school_id, student_id, attendance_session_id, parent_number, message, provider, status, sent_at)
           VALUES($1, $2, $3, $4, $5, 'mock', 'SENT', NOW())`,
          [schoolId, student.id || student.studentId || null, sessionId, parentPhone, alertMessage]
        ).catch(() => {});
      }
    } catch (err: any) {
      console.warn('[Teacher Alert] SMS dispatch warning:', err.message);
    }
  }

  // 2. Log in Firestore notifications if configured
  if (isFirebaseConfigured()) {
    try {
      await collections.notifications().doc(`alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).set({
        schoolId,
        attendanceSessionId: sessionId,
        studentId: student.id || student.studentId || null,
        studentName,
        recipient: parentPhone || student.parentEmail || student.parent_email || 'Parent',
        recipientType: 'PARENT',
        channel: 'SMS',
        message: alertMessage,
        status: 'SENT',
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch {}
  }
}

// ── GET /api/teacher/attendance/today-status & GET /api/attendance/today-status ──
const todayStatusHandler = async (req: AuthRequest, res: any) => {
  const sid = req.user!.schoolId!;
  const classParam = String(req.query.classId || req.query.class_id || req.query.class_number || '');
  const secParam = String(req.query.sectionId || req.query.section_id || req.query.section_name || '');
  const dateParam = String(req.query.date || req.query.attendance_date || new Date().toISOString().slice(0, 10));

  if (!classParam) {
    return res.status(400).json({ message: 'classId or class_number query parameter is required' });
  }

  const matchSession = (s: any) => {
    const sDate = s.attendance_date || s.attendanceDate;
    if (sDate !== dateParam && sDate?.slice(0, 10) !== dateParam) return false;
    const docSid = s.school_id || s.schoolId;
    if (docSid && !isSameSchool(docSid, sid)) return false;

    const sClassId = String(s.class_id || s.classId || '');
    const sClassNum = String(s.class_number ?? s.classNumber ?? '');
    const targetClassNum = classParam.replace(/\D/g, '');

    const classMatches =
      sClassId === classParam ||
      (targetClassNum && (sClassNum === targetClassNum || sClassId.endsWith(`-${targetClassNum}`))) ||
      sClassNum === classParam;
    if (!classMatches) return false;

    if (!secParam) return true;
    const cleanSecTarget = secParam.replace(/section\s*/i, '').trim().toLowerCase();
    const sSecId = String(s.section_id || s.sectionId || '').toLowerCase();
    const sSecName = String(s.section_name || s.sectionName || '').replace(/section\s*/i, '').trim().toLowerCase();

    return !cleanSecTarget || sSecId === cleanSecTarget || sSecName === cleanSecTarget || (cleanSecTarget && sSecName.includes(cleanSecTarget));
  };

  // 1. Check in-memory first for latest live state
  let session = memAttendanceSessions.find(matchSession);

  // 2. If not found in memory, check Cloud Firestore
  if (!session && isFirebaseConfigured()) {
    try {
      const snap = await collections.attendanceSessions().get();
      for (const doc of snap.docs) {
        const d: any = { id: doc.id, ...doc.data() };
        if (matchSession(d)) {
          session = {
            id: doc.id,
            school_id: d.school_id || d.schoolId || sid,
            schoolId: d.school_id || d.schoolId || sid,
            class_id: d.class_id || d.classId || classParam,
            classId: d.class_id || d.classId || classParam,
            class_number: Number(d.class_number ?? d.classNumber ?? 10),
            classNumber: Number(d.class_number ?? d.classNumber ?? 10),
            section_id: d.section_id || d.sectionId || secParam,
            sectionId: d.section_id || d.sectionId || secParam,
            section_name: d.section_name || d.sectionName || 'A',
            sectionName: d.section_name || d.sectionName || 'A',
            subject_id: d.subject_id || d.subjectId || null,
            subjectId: d.subject_id || d.subjectId || null,
            subject_name: d.subject_name || d.subjectName || 'General',
            subjectName: d.subject_name || d.subjectName || 'General',
            attendance_date: d.attendance_date || d.attendanceDate || dateParam,
            attendanceDate: d.attendance_date || d.attendanceDate || dateParam,
            start_time: d.start_time || d.startTime || '09:00',
            startTime: d.start_time || d.startTime || '09:00',
            end_time: d.end_time || d.endTime || '09:45',
            endTime: d.end_time || d.endTime || '09:45',
            teacher_id: d.teacher_id || d.teacherId || d.takenBy || '',
            teacherId: d.teacher_id || d.teacherId || d.takenBy || '',
            takenBy: d.takenBy || d.teacher_id || '',
            teacher_name: d.teacher_name || d.teacherName || 'Faculty Member',
            teacherName: d.teacher_name || d.teacherName || 'Faculty Member',
            total_count: d.total_count ?? d.totalCount ?? 0,
            totalCount: d.total_count ?? d.totalCount ?? 0,
            present_count: d.present_count ?? d.presentCount ?? 0,
            presentCount: d.present_count ?? d.presentCount ?? 0,
            absent_count: d.absent_count ?? d.absentCount ?? 0,
            absentCount: d.absent_count ?? d.absentCount ?? 0,
            left_early_count: d.left_early_count ?? d.leftEarlyCount ?? 0,
            leftEarlyCount: d.left_early_count ?? d.leftEarlyCount ?? 0,
            late_count: d.late_count ?? d.lateCount ?? 0,
            lateCount: d.late_count ?? d.lateCount ?? 0,
            is_reattendance: Boolean(d.is_reattendance ?? d.isReattendance ?? false),
            isReattendance: Boolean(d.is_reattendance ?? d.isReattendance ?? false),
            reattendance_count: d.reattendance_count ?? d.reattendanceCount ?? 0,
            reattendanceCount: d.reattendance_count ?? d.reattendanceCount ?? 0,
            last_modified_by: d.last_modified_by ?? d.lastModifiedBy,
            last_modified_name: d.last_modified_name ?? d.lastModifiedName,
            last_modified_at: d.last_modified_at ?? d.lastModifiedAt,
            created_at: d.created_at || d.createdAt || new Date().toISOString(),
            createdAt: d.created_at || d.createdAt || new Date().toISOString()
          };
          break;
        }
      }
    } catch {}
  }

  // 3. Check PostgreSQL if enabled
  if (!session && process.env.USE_POSTGRES === 'true') {
    try {
      const q = await pool.query(
        `SELECT a.*, u.name AS teacher_name, c.class_number, s.name AS section_name, sub.name AS subject_name
         FROM attendance_sessions a
         LEFT JOIN users u ON u.id = a.teacher_id
         LEFT JOIN classes c ON c.id = a.class_id
         LEFT JOIN sections s ON s.id = a.section_id
         LEFT JOIN subjects sub ON sub.id = a.subject_id
         WHERE a.school_id = $1 AND a.attendance_date = $2
           AND (a.class_id::text = $3 OR c.class_number = $4)
         LIMIT 1`,
        [sid, dateParam, classParam, parseInt(classParam.replace(/\D/g, ''), 10) || 10]
      );
      if (q.rowCount && q.rows[0]) {
        const row = q.rows[0];
        session = {
          id: row.id,
          school_id: row.school_id,
          schoolId: row.school_id,
          class_id: row.class_id,
          classId: row.class_id,
          class_number: row.class_number,
          classNumber: row.class_number,
          section_id: row.section_id,
          sectionId: row.section_id,
          section_name: row.section_name,
          sectionName: row.section_name,
          subject_id: row.subject_id,
          subjectId: row.subject_id,
          subject_name: row.subject_name || 'General',
          subjectName: row.subject_name || 'General',
          attendance_date: row.attendance_date,
          attendanceDate: row.attendance_date,
          start_time: row.start_time,
          startTime: row.start_time,
          end_time: row.end_time,
          endTime: row.end_time,
          teacher_id: row.teacher_id,
          teacherId: row.teacher_id,
          takenBy: row.teacher_id,
          teacher_name: row.teacher_name || 'Faculty Member',
          teacherName: row.teacher_name || 'Faculty Member',
          total_count: row.total_count,
          totalCount: row.total_count,
          present_count: row.present_count,
          presentCount: row.present_count,
          absent_count: row.absent_count,
          absentCount: row.absent_count,
          left_early_count: row.left_early_count || 0,
          leftEarlyCount: row.left_early_count || 0,
          late_count: row.late_count || 0,
          lateCount: row.late_count || 0,
          is_reattendance: Boolean(row.is_reattendance),
          isReattendance: Boolean(row.is_reattendance),
          reattendance_count: row.reattendance_count || 0,
          reattendanceCount: row.reattendance_count || 0,
          last_modified_by: row.last_modified_by,
          last_modified_name: row.last_modified_name,
          last_modified_at: row.last_modified_at,
          created_at: row.submitted_at || row.created_at,
          createdAt: row.submitted_at || row.created_at
        };
      }
    } catch {}
  }

  if (!session) {
    return res.json({ hasAttendance: false });
  }

  // Find records for this session
  let records: any[] = memAttendanceRecords.filter(r => r.sessionId === session.id);

  if (records.length === 0 && isFirebaseConfigured()) {
    try {
      const snap = await collections.attendanceRecords().where('sessionId', '==', session.id).get();
      if (!snap.empty) {
        records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch {}
  }

  if (records.length === 0 && process.env.USE_POSTGRES === 'true') {
    try {
      const q = await pool.query(
        `SELECT ar.*, st.name AS student_name, st.roll_number
         FROM attendance_records ar
         JOIN students st ON st.id = ar.student_id
         WHERE ar.attendance_session_id = $1
         ORDER BY st.roll_number`,
        [session.id]
      );
      if (q.rowCount) {
        records = q.rows.map(r => ({
          id: r.id,
          sessionId: session.id,
          studentId: r.student_id,
          studentName: r.student_name,
          rollNumber: r.roll_number,
          status: r.status,
          is_present: r.is_present,
          isPresent: r.is_present,
          departurePeriod: r.departure_period,
          departureTime: r.departure_time,
          arrivalPeriod: r.arrival_period,
          arrivalTime: r.arrival_time,
          updatedByName: r.updated_by_name,
          updatedAt: r.updated_at,
          remarks: r.remarks
        }));
      }
    } catch {}
  }

  // Find audit logs
  let auditLogs: any[] = memAttendanceAuditLogs.filter(a => a.sessionId === session.id);
  if (auditLogs.length === 0 && isFirebaseConfigured()) {
    try {
      const aSnap = await collections.auditLogs().where('entity_id', '==', session.id).get();
      if (!aSnap.empty) {
        auditLogs = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch {}
  }

  return res.json({
    hasAttendance: true,
    session,
    records,
    auditLogs
  });
};

r.get('/attendance/today-status', ...teacher, todayStatusHandler);
r.get('/today-status', ...teacher, todayStatusHandler);

// ── GET /api/teacher/attendance/:sessionId/records & GET /api/attendance/:sessionId/records ──
const sessionRecordsHandler = async (req: AuthRequest, res: any) => {
  const sid = req.user!.schoolId!;
  const sessionId = String(req.params.sessionId);

  let session = memAttendanceSessions.find(s => s.id === sessionId && isSameSchool(s.schoolId, sid));
  if (!session && isFirebaseConfigured()) {
    try {
      const doc = await collections.attendanceSessions().doc(sessionId).get();
      if (doc.exists) {
        session = { id: doc.id, ...doc.data() } as any;
      }
    } catch {}
  }

  let records: any[] = memAttendanceRecords.filter(r => r.sessionId === sessionId);
  if (records.length === 0 && isFirebaseConfigured()) {
    try {
      const snap = await collections.attendanceRecords().where('sessionId', '==', sessionId).get();
      if (!snap.empty) {
        records = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      }
    } catch {}
  }

  let auditLogs: any[] = memAttendanceAuditLogs.filter(a => a.sessionId === sessionId);
  if (auditLogs.length === 0 && isFirebaseConfigured()) {
    try {
      const aSnap = await collections.auditLogs().where('entity_id', '==', sessionId).get();
      if (!aSnap.empty) {
        auditLogs = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      }
    } catch {}
  }

  return res.json({ session, records, auditLogs });
};

r.get('/attendance/:sessionId/records', ...teacher, sessionRecordsHandler);
r.get('/:sessionId/records', ...teacher, sessionRecordsHandler);

// ── PUT /api/teacher/attendance/:sessionId/student/:studentId & PUT /api/attendance/:sessionId/student/:studentId ──
const updateStudentAttendanceHandler = async (req: AuthRequest, res: any) => {
  const sid = req.user!.schoolId!;
  const sessionId = String(req.params.sessionId);
  const studentId = String(req.params.studentId);
  const { status, reason, departurePeriod, departureTime, arrivalPeriod, arrivalTime, notifyParent } = req.body || {};

  if (!status || !['PRESENT', 'ABSENT', 'LEFT_EARLY', 'LATE', 'EXCUSED'].includes(status)) {
    return res.status(400).json({ message: 'Valid status is required (PRESENT, ABSENT, LEFT_EARLY, LATE, EXCUSED)' });
  }

  // 1. Locate session
  let session = memAttendanceSessions.find(s => s.id === sessionId && isSameSchool(s.schoolId, sid));
  if (!session && isFirebaseConfigured()) {
    try {
      const doc = await collections.attendanceSessions().doc(sessionId).get();
      if (doc.exists) {
        session = { id: doc.id, ...doc.data() } as any;
        if (session && !memAttendanceSessions.some(s => s.id === sessionId)) {
          memAttendanceSessions.unshift(session);
        }
      }
    } catch {}
  }

  if (!session) {
    return res.status(404).json({ message: 'Attendance session not found for this school' });
  }

  // 2. Locate or create record
  let record: MemAttendanceRecord | undefined = memAttendanceRecords.find(r => r.sessionId === sessionId && String(r.studentId) === String(studentId));
  const prevStatus = record ? record.status : 'UNKNOWN';
  const nowStr = new Date().toISOString();
  const userName = req.user?.name || 'Class Faculty';

  const isPresent = status === 'PRESENT' || status === 'LATE';

  if (record) {
    record.status = status as any;
    record.is_present = isPresent;
    record.isPresent = isPresent;
    record.remarks = reason || record.remarks || '';
    if (status === 'LEFT_EARLY') {
      record.departurePeriod = departurePeriod || record.departurePeriod || 'After 1st Period';
      record.departureTime = departureTime || record.departureTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (status === 'LATE') {
      record.arrivalPeriod = arrivalPeriod || record.arrivalPeriod || 'Period 2';
      record.arrivalTime = arrivalTime || record.arrivalTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    record.updatedBy = req.user!.id;
    record.updatedByName = userName;
    record.updatedAt = nowStr;
  } else {
    const newRec: MemAttendanceRecord = {
      id: `att-rec-${sessionId}-${studentId}`,
      sessionId,
      attendance_session_id: sessionId,
      attendanceSessionId: sessionId,
      studentId,
      student_id: studentId,
      schoolId: sid,
      school_id: sid,
      classId: session.classId,
      class_id: session.classId,
      sectionId: session.sectionId,
      section_id: session.sectionId,
      attendanceDate: session.attendanceDate,
      attendance_date: session.attendanceDate,
      status: status as any,
      is_present: isPresent,
      isPresent,
      departurePeriod: status === 'LEFT_EARLY' ? (departurePeriod || 'After 1st Period') : undefined,
      departureTime: status === 'LEFT_EARLY' ? (departureTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : undefined,
      arrivalPeriod: status === 'LATE' ? (arrivalPeriod || 'Period 2') : undefined,
      arrivalTime: status === 'LATE' ? (arrivalTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : undefined,
      updatedBy: req.user!.id,
      updatedByName: userName,
      updatedAt: nowStr,
      remarks: reason || '',
      createdAt: nowStr
    };
    memAttendanceRecords.unshift(newRec);
    record = newRec;
  }

  // 3. Recalculate session totals
  const allSessionRecs = memAttendanceRecords.filter(r => r.sessionId === sessionId);
  const presCount = allSessionRecs.filter(r => r.status === 'PRESENT' || (r.status !== 'ABSENT' && r.status !== 'LEFT_EARLY' && r.is_present)).length;
  const leftEarlyCount = allSessionRecs.filter(r => r.status === 'LEFT_EARLY').length;
  const lateCount = allSessionRecs.filter(r => r.status === 'LATE').length;
  const absCount = allSessionRecs.filter(r => r.status === 'ABSENT' || (!r.is_present && r.status !== 'LEFT_EARLY' && r.status !== 'LATE')).length;

  session.present_count = presCount;
  session.presentCount = presCount;
  session.absent_count = absCount;
  session.absentCount = absCount;
  session.left_early_count = leftEarlyCount;
  session.leftEarlyCount = leftEarlyCount;
  session.late_count = lateCount;
  session.lateCount = lateCount;
  session.is_reattendance = true;
  session.isReattendance = true;
  session.reattendance_count = (session.reattendanceCount || session.reattendance_count || 0) + 1;
  session.reattendanceCount = (session.reattendanceCount || session.reattendance_count || 0) + 1;
  session.last_modified_by = req.user!.id;
  session.lastModifiedBy = req.user!.id;
  session.last_modified_name = userName;
  session.lastModifiedName = userName;
  session.last_modified_at = nowStr;
  session.lastModifiedAt = nowStr;

  const auditLog: MemAttendanceAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    schoolId: sid,
    school_id: sid,
    sessionId,
    session_id: sessionId,
    studentId,
    student_id: studentId,
    studentName: record.studentName || 'Student',
    student_name: record.studentName || 'Student',
    rollNumber: record.rollNumber,
    roll_number: record.rollNumber,
    action: status === 'LEFT_EARLY' ? 'LEFT_EARLY' : status === 'LATE' ? 'LATE_ARRIVAL' : 'STATUS_UPDATE',
    previousStatus: prevStatus,
    previous_status: prevStatus,
    newStatus: status,
    new_status: status,
    departurePeriod: record.departurePeriod,
    departure_period: record.departurePeriod,
    departureTime: record.departureTime,
    departure_time: record.departureTime,
    arrivalPeriod: record.arrivalPeriod,
    arrival_period: record.arrivalPeriod,
    arrivalTime: record.arrivalTime,
    arrival_time: record.arrivalTime,
    reason: reason || `Updated by ${userName}`,
    changedBy: req.user!.id,
    changed_by: req.user!.id,
    changedByName: userName,
    changed_by_name: userName,
    modified_by_name: userName,
    modifiedByName: userName,
    notificationSent: Boolean(notifyParent),
    notification_sent: Boolean(notifyParent),
    createdAt: nowStr,
    created_at: nowStr
  };
  memAttendanceAuditLogs.unshift(auditLog);
  if (memAttendanceAuditLogs.length > 1000) memAttendanceAuditLogs.length = 1000;

  // 5. Sync to Firestore in background
  syncAttendanceToFirestore(session, allSessionRecs).catch(() => {});
  syncAttendanceAuditLogToFirestore(auditLog).catch(() => {});

  // 6. Sync to Postgres if enabled
  if (process.env.USE_POSTGRES === 'true') {
    pool.query(
      `UPDATE attendance_records
       SET status=$1, is_present=$2, remarks=$3, departure_period=$4, departure_time=$5,
           arrival_period=$6, arrival_time=$7, updated_by=$8, updated_by_name=$9, updated_at=NOW()
       WHERE attendance_session_id=$10 AND student_id=$11`,
      [status, isPresent, reason || '', record.departurePeriod || null, record.departureTime || null,
       record.arrivalPeriod || null, record.arrivalTime || null, req.user!.id, userName, sessionId, studentId]
    ).catch(() => {});

    pool.query(
      `UPDATE attendance_sessions
       SET present_count=$1, absent_count=$2, left_early_count=$3, late_count=$4,
           is_reattendance=TRUE, reattendance_count=COALESCE(reattendance_count, 0) + 1,
           last_modified_by=$5, last_modified_name=$6, last_modified_at=NOW()
       WHERE id=$7`,
      [presCount, absCount, leftEarlyCount, lateCount, req.user!.id, userName, sessionId]
    ).catch(() => {});

    pool.query(
      `INSERT INTO attendance_audit_logs(
         school_id, session_id, student_id, student_name, roll_number, action,
         previous_status, new_status, departure_period, departure_time,
         arrival_period, arrival_time, reason, changed_by, changed_by_name, notification_sent
       ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [sid, sessionId, studentId, record.studentName || 'Student', record.rollNumber || '',
       auditLog.action, prevStatus, status, record.departurePeriod || null, record.departureTime || null,
       record.arrivalPeriod || null, record.arrivalTime || null, reason || '', req.user!.id, userName, Boolean(notifyParent)]
    ).catch(() => {});
  }

  // 7. Dispatch Alert if notifyParent is true
  if (notifyParent) {
    dispatchStudentReattendanceAlert({
      schoolId: sid,
      sessionId,
      student: record,
      status,
      period: status === 'LEFT_EARLY' ? record.departurePeriod : record.arrivalPeriod,
      time: status === 'LEFT_EARLY' ? record.departureTime : record.arrivalTime,
      reason,
      teacherName: userName,
      className: String(session.classNumber || session.class_number || '10'),
      sectionName: session.sectionName || session.section_name || 'A'
    }).catch(err => console.warn('[Reattendance Alert Error]:', err.message));
  }

  return res.json({
    success: true,
    message: `Attendance status for ${record.studentName || 'student'} updated to ${status}.`,
    session,
    record,
    auditLog
  });
};

r.put('/attendance/:sessionId/student/:studentId', ...teacher, updateStudentAttendanceHandler);
r.put('/:sessionId/student/:studentId', ...teacher, updateStudentAttendanceHandler);

// ── POST /api/teacher/attendance/:sessionId/reattendance & POST /api/attendance/:sessionId/reattendance ──
const batchReattendanceHandler = async (req: AuthRequest, res: any) => {
  const sid = req.user!.schoolId!;
  const sessionId = String(req.params.sessionId);
  const { records, reason, notifyParents } = req.body || {};

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: 'records array is required' });
  }

  let session = memAttendanceSessions.find(s => s.id === sessionId && isSameSchool(s.schoolId, sid));
  if (!session && isFirebaseConfigured()) {
    try {
      const doc = await collections.attendanceSessions().doc(sessionId).get();
      if (doc.exists) {
        session = { id: doc.id, ...doc.data() } as any;
        if (session && !memAttendanceSessions.some(s => s.id === sessionId)) {
          memAttendanceSessions.unshift(session);
        }
      }
    } catch {}
  }

  if (!session) {
    return res.status(404).json({ message: 'Attendance session not found' });
  }

  const nowStr = new Date().toISOString();
  const userName = req.user?.name || 'Class Faculty';

  for (const r of records) {
    const studentId = String(r.studentId || r.student_id || r.id);
    const status = r.status || (r.is_present || r.isPresent ? 'PRESENT' : 'ABSENT');
    const isPres = status === 'PRESENT' || status === 'LATE';

    let memRec = memAttendanceRecords.find(rec => rec.sessionId === sessionId && String(rec.studentId) === studentId);
    if (memRec) {
      memRec.status = status;
      memRec.is_present = isPres;
      memRec.isPresent = isPres;
      memRec.remarks = r.remarks || memRec.remarks;
      if (r.departurePeriod) memRec.departurePeriod = r.departurePeriod;
      if (r.departureTime) memRec.departureTime = r.departureTime;
      if (r.arrivalPeriod) memRec.arrivalPeriod = r.arrivalPeriod;
      if (r.arrivalTime) memRec.arrivalTime = r.arrivalTime;
      memRec.updatedBy = req.user!.id;
      memRec.updatedByName = userName;
      memRec.updatedAt = nowStr;
    } else {
      const newRec: MemAttendanceRecord = {
        id: `att-rec-${sessionId}-${studentId}`,
        sessionId,
        attendance_session_id: sessionId,
        attendanceSessionId: sessionId,
        studentId,
        student_id: studentId,
        studentName: r.studentName || r.name,
        rollNumber: r.rollNumber || r.roll_number,
        schoolId: sid,
        school_id: sid,
        classId: session.classId,
        class_id: session.classId,
        sectionId: session.sectionId,
        section_id: session.sectionId,
        attendanceDate: session.attendanceDate,
        attendance_date: session.attendanceDate,
        status,
        is_present: isPres,
        isPresent: isPres,
        departurePeriod: r.departurePeriod,
        departureTime: r.departureTime,
        arrivalPeriod: r.arrivalPeriod,
        arrivalTime: r.arrivalTime,
        updatedBy: req.user!.id,
        updatedByName: userName,
        updatedAt: nowStr,
        remarks: r.remarks || '',
        createdAt: nowStr
      };
      memAttendanceRecords.unshift(newRec);
    }
  }

  const allSessionRecs = memAttendanceRecords.filter(r => r.sessionId === sessionId);
  const presCount = allSessionRecs.filter(r => r.status === 'PRESENT' || (r.status !== 'ABSENT' && r.status !== 'LEFT_EARLY' && r.is_present)).length;
  const leftEarlyCount = allSessionRecs.filter(r => r.status === 'LEFT_EARLY').length;
  const lateCount = allSessionRecs.filter(r => r.status === 'LATE').length;
  const absCount = allSessionRecs.filter(r => r.status === 'ABSENT' || (!r.is_present && r.status !== 'LEFT_EARLY' && r.status !== 'LATE')).length;

  session.present_count = presCount;
  session.presentCount = presCount;
  session.absent_count = absCount;
  session.absentCount = absCount;
  session.left_early_count = leftEarlyCount;
  session.leftEarlyCount = leftEarlyCount;
  session.late_count = lateCount;
  session.lateCount = lateCount;
  session.is_reattendance = true;
  session.isReattendance = true;
  session.reattendance_count = (session.reattendanceCount || session.reattendance_count || 0) + 1;
  session.reattendanceCount = (session.reattendanceCount || session.reattendance_count || 0) + 1;
  session.last_modified_by = req.user!.id;
  session.lastModifiedBy = req.user!.id;
  session.last_modified_name = userName;
  session.lastModifiedName = userName;
  session.last_modified_at = nowStr;
  session.lastModifiedAt = nowStr;

  const auditLog: MemAttendanceAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    schoolId: sid,
    school_id: sid,
    sessionId,
    session_id: sessionId,
    action: 'REATTENDANCE_BATCH',
    newStatus: 'BATCH_UPDATED',
    new_status: 'BATCH_UPDATED',
    reason: reason || `Batch re-attendance processed by ${userName}`,
    changedBy: req.user!.id,
    changed_by: req.user!.id,
    changedByName: userName,
    changed_by_name: userName,
    modified_by_name: userName,
    modifiedByName: userName,
    notificationSent: Boolean(notifyParents),
    notification_sent: Boolean(notifyParents),
    createdAt: nowStr,
    created_at: nowStr
  };
  memAttendanceAuditLogs.unshift(auditLog);

  syncAttendanceToFirestore(session, allSessionRecs).catch(() => {});
  syncAttendanceAuditLogToFirestore(auditLog).catch(() => {});

  return res.json({
    success: true,
    message: `Batch re-attendance updated successfully for ${records.length} students.`,
    session,
    records: allSessionRecs,
    present: presCount,
    absent: absCount,
    leftEarly: leftEarlyCount,
    late: lateCount
  });
};

r.post('/attendance/:sessionId/reattendance', ...teacher, batchReattendanceHandler);
r.post('/:sessionId/reattendance', ...teacher, batchReattendanceHandler);

// ── POST /api/teacher/attendance & POST /api/attendance ──
const postAttendanceHandler = async (req: AuthRequest, res: any) => {
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
  let isExistingSession = false;
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
          isExistingSession = true;
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
        const status = r.status || (r.is_present || r.isPresent ? 'PRESENT' : 'ABSENT');
        const isPres = status === 'PRESENT' || status === 'LATE' || r.isPresent === true || r.is_present === true || presentSet.has(String(r.studentId || r.id));
        return {
          student_id: String(r.studentId || r.student_id || r.id),
          studentId: String(r.studentId || r.student_id || r.id),
          studentName: r.studentName || r.name || 'Student',
          rollNumber: String(r.rollNumber || r.roll_number || ''),
          is_present: isPres,
          status,
          departurePeriod: r.departurePeriod || r.departure_period,
          departureTime: r.departureTime || r.departure_time,
          arrivalPeriod: r.arrivalPeriod || r.arrival_period,
          arrivalTime: r.arrivalTime || r.arrival_time,
          updatedByName: r.updatedByName || r.updated_by_name,
          updatedAt: r.updatedAt || r.updated_at,
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

  const presentCount = finalRecords.filter((r: any) => r.status === 'PRESENT' || (r.status !== 'ABSENT' && r.status !== 'LEFT_EARLY' && r.is_present)).length;
  const leftEarlyCount = finalRecords.filter((r: any) => r.status === 'LEFT_EARLY').length;
  const lateCount = finalRecords.filter((r: any) => r.status === 'LATE').length;
  const absentCount = finalRecords.filter((r: any) => r.status === 'ABSENT' || (!r.is_present && r.status !== 'LEFT_EARLY' && r.status !== 'LATE')).length;

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
    left_early_count: leftEarlyCount,
    leftEarlyCount,
    late_count: lateCount,
    lateCount,
    is_reattendance: false,
    isReattendance: false,
    reattendance_count: 0,
    reattendanceCount: 0,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  // 3. Cache in shared in-memory store for instant reflection
  const existingMemIdx = memAttendanceSessions.findIndex(s => s.id === sessionId || (isSameSchool(s.schoolId, schoolId) && String(s.classId) === String(x.classId) && String(s.sectionId) === String(x.sectionId) && s.attendanceDate === x.attendanceDate));
  if (existingMemIdx >= 0) {
    const prior = memAttendanceSessions[existingMemIdx];
    sessionId = prior.id;
    isExistingSession = true;
    sessionMeta.id = prior.id;
    sessionMeta.is_reattendance = true;
    sessionMeta.isReattendance = true;
    sessionMeta.reattendance_count = (prior.reattendanceCount || prior.reattendance_count || 0) + 1;
    sessionMeta.reattendanceCount = (prior.reattendanceCount || prior.reattendance_count || 0) + 1;
    sessionMeta.last_modified_by = req.user!.id;
    sessionMeta.lastModifiedBy = req.user!.id;
    sessionMeta.last_modified_name = req.user?.name || 'Class Faculty';
    sessionMeta.lastModifiedName = req.user?.name || 'Class Faculty';
    sessionMeta.last_modified_at = new Date().toISOString();
    sessionMeta.lastModifiedAt = new Date().toISOString();
    sessionMeta.created_at = prior.createdAt || prior.created_at || sessionMeta.created_at;
    sessionMeta.createdAt = prior.createdAt || prior.created_at || sessionMeta.createdAt;
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
      departurePeriod: r.departurePeriod,
      departureTime: r.departureTime,
      arrivalPeriod: r.arrivalPeriod,
      arrivalTime: r.arrivalTime,
      updatedByName: r.updatedByName,
      updatedAt: r.updatedAt,
      remarks: r.remarks || '',
      createdAt: new Date().toISOString()
    });
  }
  if (memAttendanceRecords.length > 2000) memAttendanceRecords.length = 2000;

  // 4. Sync to Cloud Firestore in background
  syncAttendanceToFirestore(sessionMeta, finalRecords).catch(err => {
    console.warn('[Teacher] Background Firestore attendance sync warning:', err.message);
  });

  return res.status(isExistingSession ? 200 : 201).json({
    success: true,
    sessionId,
    total: finalRecords.length,
    present: presentCount,
    absent: absentCount,
    leftEarly: leftEarlyCount,
    late: lateCount,
    isReattendance: sessionMeta.isReattendance
  });
};

r.post('/attendance', ...teacher, postAttendanceHandler);
r.post('/', ...teacher, postAttendanceHandler);

// ── GET /api/teacher/attendance/history & GET /api/attendance/history ──
const attendanceHistoryHandler = async (req: AuthRequest, res: any) => {
  const sid = req.user!.schoolId!;

  // 1. Try PostgreSQL if enabled
  if (process.env.USE_POSTGRES === 'true') {
    try {
      const q = await pool.query(
        `SELECT a.id, a.attendance_date, a.start_time, a.end_time,
                COALESCE(a.class_number, c.class_number, 10) AS class_number,
                COALESCE(a.section_name, s.name, 'A') AS section_name,
                COALESCE(a.subject_name, sub.name, 'General') AS subject_name,
                a.class_id, a.section_id, a.subject_id,
                COALESCE(a.total_count, COUNT(ar.id)::int) AS total,
                COALESCE(a.total_count, COUNT(ar.id)::int) AS total_count,
                COALESCE(a.present_count, COUNT(ar.id) FILTER(WHERE ar.is_present OR ar.status = 'PRESENT' OR ar.status = 'LATE')::int) AS present,
                COALESCE(a.present_count, COUNT(ar.id) FILTER(WHERE ar.is_present OR ar.status = 'PRESENT' OR ar.status = 'LATE')::int) AS present_count,
                COALESCE(a.absent_count, COUNT(ar.id) FILTER(WHERE ar.status = 'ABSENT' OR (!ar.is_present AND ar.status != 'LEFT_EARLY' AND ar.status != 'LATE'))::int) AS absent,
                COALESCE(a.absent_count, COUNT(ar.id) FILTER(WHERE ar.status = 'ABSENT' OR (!ar.is_present AND ar.status != 'LEFT_EARLY' AND ar.status != 'LATE'))::int) AS absent_count,
                COALESCE(a.left_early_count, COUNT(ar.id) FILTER(WHERE ar.status = 'LEFT_EARLY')::int, 0) AS left_early_count,
                COALESCE(a.late_count, COUNT(ar.id) FILTER(WHERE ar.status = 'LATE')::int, 0) AS late_count,
                COALESCE(a.is_reattendance, FALSE) AS is_reattendance,
                COALESCE(a.reattendance_count, 0) AS reattendance_count,
                u.name AS teacher_name, a.teacher_id, a.last_modified_name, a.last_modified_at
         FROM attendance_sessions a
         LEFT JOIN classes c ON c.id = a.class_id
         LEFT JOIN sections s ON s.id = a.section_id
         LEFT JOIN subjects sub ON sub.id = a.subject_id
         LEFT JOIN users u ON u.id = a.teacher_id
         LEFT JOIN attendance_records ar ON ar.attendance_session_id = a.id
         WHERE a.school_id = $1
         GROUP BY a.id, a.attendance_date, a.start_time, a.end_time, a.class_number, c.class_number, a.section_name, s.name, a.subject_name, sub.name, a.class_id, a.section_id, a.subject_id, a.total_count, a.present_count, a.absent_count, a.left_early_count, a.late_count, a.is_reattendance, a.reattendance_count, u.name, a.teacher_id, a.last_modified_name, a.last_modified_at
         ORDER BY a.attendance_date DESC, a.start_time DESC`,
        [sid]
      );
      if (q.rowCount && q.rows.length > 0) return res.json(q.rows);
    } catch {}
  }

  // 2. Query Cloud Firestore + In-Memory Store
  const historyMap = new Map<string, any>();

  // Add from in-memory sessions first (VISIBLE TO ALL TEACHERS IN THE SCHOOL)
  memAttendanceSessions.forEach(s => {
    if (!isSameSchool(s.schoolId, sid)) return;
    historyMap.set(s.id, {
      id: s.id,
      attendance_date: s.attendanceDate,
      start_time: s.startTime,
      end_time: s.endTime,
      class_number: s.classNumber,
      class_id: s.classId,
      section_name: s.sectionName,
      section_id: s.sectionId,
      subject_name: s.subjectName,
      teacher_id: s.teacherId,
      teacher_name: s.teacherName || 'Faculty Member',
      taken_by: s.takenBy || s.teacherId,
      total: s.totalCount || 0,
      total_count: s.totalCount || 0,
      present: s.presentCount || 0,
      present_count: s.presentCount || 0,
      absent: s.absentCount ?? Math.max(0, (s.totalCount || 0) - (s.presentCount || 0)),
      absent_count: s.absentCount ?? Math.max(0, (s.totalCount || 0) - (s.presentCount || 0)),
      left_early_count: s.leftEarlyCount ?? s.left_early_count ?? 0,
      late_count: s.lateCount ?? s.late_count ?? 0,
      is_reattendance: Boolean(s.isReattendance ?? s.is_reattendance ?? false),
      reattendance_count: s.reattendanceCount ?? s.reattendance_count ?? 0,
      last_modified_name: s.lastModifiedName ?? s.last_modified_name ?? null,
      last_modified_at: s.lastModifiedAt ?? s.last_modified_at ?? null
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

          let total = d.totalCount ?? d.total_count ?? 0;
          let present = d.presentCount ?? d.present_count ?? 0;
          let leftEarly = d.leftEarlyCount ?? d.left_early_count ?? 0;
          let late = d.lateCount ?? d.late_count ?? 0;
          let absent = d.absentCount ?? d.absent_count ?? 0;

          if (!total) {
            try {
              const recSnap = await collections.attendanceRecords().where('sessionId', '==', doc.id).get();
              total = recSnap.size;
              present = recSnap.docs.filter(rd => rd.data().status === 'PRESENT' || rd.data().is_present === true).length;
              leftEarly = recSnap.docs.filter(rd => rd.data().status === 'LEFT_EARLY').length;
              late = recSnap.docs.filter(rd => rd.data().status === 'LATE').length;
              absent = Math.max(0, total - present - leftEarly);
            } catch {}
          }

          historyMap.set(doc.id, {
            id: doc.id,
            attendance_date: d.attendanceDate || d.attendance_date || new Date().toISOString().slice(0, 10),
            start_time: d.startTime || d.start_time || '09:00',
            end_time: d.endTime || d.end_time || '09:45',
            class_number: d.class_number ?? d.classNumber ?? 10,
            class_id: d.class_id || d.classId || '',
            section_name: d.section_name || d.sectionName || 'A',
            section_id: d.section_id || d.sectionId || '',
            subject_name: d.subject_name || d.subjectName || 'General',
            teacher_id: d.teacherId || d.teacher_id || d.takenBy || '',
            teacher_name: d.teacherName || d.teacher_name || 'Faculty Member',
            taken_by: d.takenBy || d.teacher_id || '',
            total,
            total_count: total,
            present,
            present_count: present,
            absent: absent || Math.max(0, total - present),
            absent_count: absent || Math.max(0, total - present),
            left_early_count: leftEarly,
            late_count: late,
            is_reattendance: Boolean(d.isReattendance ?? d.is_reattendance ?? false),
            reattendance_count: d.reattendanceCount ?? d.reattendance_count ?? 0,
            last_modified_name: d.lastModifiedName ?? d.last_modified_name ?? null,
            last_modified_at: d.lastModifiedAt ?? d.last_modified_at ?? null
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
      { id: 'sess-01', attendance_date: new Date().toISOString().slice(0, 10), start_time: '09:00:00', end_time: '09:45:00', class_number: 10, section_name: 'A', subject_name: 'Mathematics', teacher_name: 'Rahul Sharma', total: 10, present: 9, absent: 1, left_early_count: 0, is_reattendance: false },
      { id: 'sess-02', attendance_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), start_time: '09:00:00', end_time: '09:45:00', class_number: 10, section_name: 'A', subject_name: 'Science', teacher_name: 'Priya Patel', total: 10, present: 9, absent: 0, left_early_count: 1, is_reattendance: true, reattendance_count: 1 }
    ]);
  }

  res.json([]);
};

r.get('/attendance/history', ...teacher, attendanceHistoryHandler);
r.get('/history', ...teacher, attendanceHistoryHandler);

export default r;
