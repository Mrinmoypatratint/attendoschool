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

// ── GET /api/teacher/classes/:classId/:sectionId/students & /api/teacher/students/:classId/:sectionId ──
const getStudentsHandler = async (req: AuthRequest, res: any) => {
  const sid = req.user!.schoolId;
  const classParam = String(req.params.classId);
  const secId = String(req.params.sectionId);
  const secParam = secId.toLowerCase();

  // 1. Check PostgreSQL
  try {
    const q = await pool.query(
      `SELECT id, name, roll_number, admission_number, parent_sms_number, email AS student_email, parent_email
       FROM students
       WHERE school_id=$1 AND (class_id=$2 OR class_id IN (SELECT id FROM classes WHERE school_id=$1 AND class_number=$2::text))
         AND (section_id=$3 OR section_id IN (SELECT id FROM sections WHERE school_id=$1 AND LOWER(name)=$4))
         AND is_active
       ORDER BY roll_number`,
      [sid, classParam, secId, secParam]
    );
    if (q.rowCount && q.rows.length > 0) return res.json(q.rows);
  } catch {}

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

// ── POST /api/teacher/attendance ──
r.post('/attendance', ...teacher, async (req: AuthRequest, res) => {
  const x = req.body;
  const schoolId = req.user!.schoolId!;
  if (!x.classId || !x.sectionId || !x.startTime || !x.endTime || !x.attendanceDate) {
    return res.status(400).json({ message: 'Attendance session data is incomplete' });
  }

  const presentSet = new Set<string>(Array.isArray(x.presentStudentIds) ? x.presentStudentIds : []);

  // 1. Try DB first
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
        const classNum = parseInt(String(classId).replace(/\D/g, ''), 10) || 8;
        const cRes = await client.query('SELECT id FROM classes WHERE school_id = $1 AND class_number = $2 LIMIT 1', [schoolId, classNum]);
        classId = cRes.rows[0]?.id || classId;
      }

      let sectionId = x.sectionId;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sectionId)) {
        const sRes = await client.query('SELECT id FROM sections WHERE school_id = $1 AND class_id = $2 LIMIT 1', [schoolId, classId]);
        sectionId = sRes.rows[0]?.id || sectionId;
      }

      let subjectId = x.subjectId || null;
      if (subjectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectId)) {
        const subRes = await client.query('SELECT id FROM subjects WHERE school_id = $1 LIMIT 1', [schoolId]);
        subjectId = subRes.rows[0]?.id || null;
      }

      const duplicate = await client.query(
        `SELECT id FROM attendance_sessions
         WHERE school_id=$1 AND class_id=$2 AND section_id=$3 AND attendance_date=$4`,
        [schoolId, classId, sectionId, x.attendanceDate]
      );

      let sessionId: string;
      if (duplicate.rowCount) {
        sessionId = duplicate.rows[0].id;
        await client.query('DELETE FROM attendance_records WHERE attendance_session_id = $1', [sessionId]);
      } else {
        const session = (await client.query(
          `INSERT INTO attendance_sessions
           (school_id,class_id,section_id,subject_id,teacher_id,attendance_date,start_time,end_time)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [schoolId, classId, sectionId, subjectId, teacherId, x.attendanceDate, x.startTime, x.endTime]
        )).rows[0];
        sessionId = session.id;
      }

      const students = (await client.query(
        `SELECT id FROM students WHERE school_id=$1 AND class_id=$2 AND section_id=$3 AND is_active`,
        [schoolId, classId, sectionId]
      )).rows;

      for (const st of students) {
        await client.query(
          `INSERT INTO attendance_records(attendance_session_id,student_id,is_present)
           VALUES($1,$2,$3)`, [sessionId, st.id, presentSet.has(st.id)]
        );
      }
      await client.query('COMMIT');

      queueAbsentSms(sessionId).catch(() => {});
      queueAbsentNotifications(sessionId).catch(() => {});

      const sessionRecords = students.map(st => ({
        student_id: st.id,
        is_present: presentSet.has(st.id),
        status: presentSet.has(st.id) ? 'PRESENT' : 'ABSENT'
      }));

      let classNum = x.classNumber ?? x.class_number ?? null;
      let secName = x.sectionName || x.section_name || '';
      let subName = x.subjectName || x.subject_name || '';
      try {
        const cRow = await client.query('SELECT class_number FROM classes WHERE id = $1', [classId]);
        if (cRow.rows[0]?.class_number) classNum = cRow.rows[0].class_number;
        const sRow = await client.query('SELECT name FROM sections WHERE id = $1', [sectionId]);
        if (sRow.rows[0]?.name) secName = sRow.rows[0].name;
        if (subjectId) {
          const subRow = await client.query('SELECT name FROM subjects WHERE id = $1', [subjectId]);
          if (subRow.rows[0]?.name) subName = subRow.rows[0].name;
        }
      } catch {}

      await syncAttendanceToFirestore({
        id: sessionId,
        school_id: schoolId,
        schoolId,
        class_id: classId,
        classId: classId,
        classNumber: classNum,
        class_number: classNum,
        section_id: sectionId,
        sectionId: sectionId,
        sectionName: secName,
        section_name: secName,
        subject_id: subjectId,
        subjectId: subjectId,
        subjectName: subName,
        subject_name: subName,
        teacher_id: teacherId,
        teacherId: teacherId,
        takenBy: teacherId,
        attendance_date: x.attendanceDate,
        attendanceDate: x.attendanceDate,
        start_time: x.startTime,
        startTime: x.startTime,
        end_time: x.endTime,
        endTime: x.endTime
      }, sessionRecords);

      return res.status(201).json({
        success: true,
        sessionId,
        total: students.length,
        present: students.filter(s => presentSet.has(s.id)).length,
        absent: students.filter(s => !presentSet.has(s.id)).length
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (_dbErr) {
    // 2. Direct Cloud Firestore fallback
    const sessId = 'sess-' + Date.now();
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

    const sessionRecords: any[] = studentPool.map((s: any) => ({
      student_id: s.id,
      is_present: presentSet.has(s.id),
      status: presentSet.has(s.id) ? 'PRESENT' : 'ABSENT'
    }));

    let cNum = x.classNumber ?? x.class_number ?? null;
    let sName = x.sectionName || x.section_name || '';
    let subName = x.subjectName || x.subject_name || '';

    if (!cNum && isFirebaseConfigured()) {
      try {
        const cDoc = await collections.classes().doc(String(x.classId)).get();
        if (cDoc.exists) cNum = cDoc.data()?.class_number ?? cDoc.data()?.classNumber;
      } catch {}
    }
    if (!sName && isFirebaseConfigured()) {
      try {
        const sDoc = await collections.sections().doc(String(x.sectionId)).get();
        if (sDoc.exists) sName = sDoc.data()?.name;
      } catch {}
    }
    if (!subName && x.subjectId && isFirebaseConfigured()) {
      try {
        const subDoc = await collections.subjects().doc(String(x.subjectId)).get();
        if (subDoc.exists) subName = subDoc.data()?.name;
      } catch {}
    }

    await syncAttendanceToFirestore({
      id: sessId,
      school_id: schoolId,
      schoolId,
      class_id: x.classId,
      classId: x.classId,
      class_number: cNum || 10,
      classNumber: cNum || 10,
      section_id: x.sectionId,
      sectionId: x.sectionId,
      section_name: sName || 'A',
      sectionName: sName || 'A',
      subject_id: x.subjectId || null,
      subjectId: x.subjectId || null,
      subject_name: subName || 'General',
      subjectName: subName || 'General',
      teacher_id: req.user!.id,
      teacherId: req.user!.id,
      takenBy: req.user!.id,
      attendance_date: x.attendanceDate,
      attendanceDate: x.attendanceDate,
      start_time: x.startTime,
      startTime: x.startTime,
      end_time: x.endTime,
      endTime: x.endTime
    }, sessionRecords);

    const presentCount = sessionRecords.filter((r: any) => r.is_present).length;
    return res.status(201).json({
      success: true,
      sessionId: sessId,
      total: sessionRecords.length,
      present: presentCount,
      absent: sessionRecords.length - presentCount
    });
  }
});

// ── GET /api/teacher/attendance/history ──
r.get('/attendance/history', ...teacher, async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;
  const teacherId = req.user!.id;
  const isTeacher = req.user!.role === 'TEACHER';
  const identities = isTeacher ? await resolveTeacherIdentities(req.user) : { ids: [], names: [], emails: [] };

  // 1. Try PostgreSQL
  try {
    const q = await pool.query(
      `SELECT a.id, a.attendance_date, a.start_time, a.end_time,
              c.class_number, s.name AS section_name, sub.name AS subject_name,
              COUNT(ar.id)::int AS total,
              COUNT(ar.id) FILTER(WHERE ar.is_present)::int AS present
       FROM attendance_sessions a
       LEFT JOIN classes c ON c.id = a.class_id
       LEFT JOIN sections s ON s.id = a.section_id
       LEFT JOIN subjects sub ON sub.id = a.subject_id
       JOIN attendance_records ar ON ar.attendance_session_id = a.id
       WHERE a.school_id = $1 ${isTeacher ? 'AND a.teacher_id = $2' : ''}
       GROUP BY a.id, c.class_number, s.name, sub.name
       ORDER BY a.attendance_date DESC, a.start_time DESC`,
      isTeacher ? [sid, teacherId] : [sid]
    );
    if (q.rowCount && q.rows.length > 0) return res.json(q.rows);
  } catch {}

  // 2. Query Cloud Firestore
  if (isFirebaseConfigured()) {
    try {
      const snap = await collections.attendanceSessions().get();
      if (!snap.empty) {
        const historyList: any[] = [];
        for (const doc of snap.docs) {
          const d = doc.data();
          const docSid = d.school_id || d.schoolId;
          if (docSid && !isSameSchool(docSid, sid)) continue;

          const takenBy = String(d.takenBy || d.teacher_id || d.teacherId || '');
          if (isTeacher && takenBy && !identities.ids.includes(takenBy) && takenBy !== teacherId) continue;

          let total = 0;
          let present = 0;
          try {
            const recSnap = await collections.attendanceRecords().where('sessionId', '==', doc.id).get();
            total = recSnap.size;
            present = recSnap.docs.filter(rd => rd.data().status === 'PRESENT').length;
          } catch {}

          historyList.push({
            id: doc.id,
            attendance_date: d.attendanceDate || d.attendance_date || new Date().toISOString().slice(0, 10),
            start_time: d.startTime || d.start_time || '09:00',
            end_time: d.endTime || d.end_time || '09:45',
            class_number: d.class_number ?? d.classNumber ?? 10,
            section_name: d.section_name || d.sectionName || 'A',
            subject_name: d.subject_name || d.subjectName || 'General',
            total,
            present
          });
        }
        if (historyList.length > 0) {
          historyList.sort((a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime() || b.start_time.localeCompare(a.start_time));
          return res.json(historyList);
        }
      }
    } catch (err: any) {
      console.warn('[Teacher] Error querying attendance history from Firestore:', err.message);
    }
  }

  // 3. Fallback for test school
  if (isTestSchool(sid)) {
    return res.json([
      { id: 'sess-01', attendance_date: new Date().toISOString(), start_time: '09:00:00', end_time: '09:45:00', class_number: 10, section_name: 'A', subject_name: 'Mathematics', total: 25, present: 23 },
      { id: 'sess-02', attendance_date: new Date(Date.now() - 86400000).toISOString(), start_time: '09:00:00', end_time: '09:45:00', class_number: 10, section_name: 'A', subject_name: 'Mathematics', total: 25, present: 24 }
    ]);
  }

  res.json([]);
});

export default r;
