import { pool } from '../db';
import { isFirebaseConfigured, collections } from '../firebase';
import { isSameSchool, isTestSchool } from '../utils/tenant';
import { memAttendanceSessions, memAttendanceRecords } from '../routes/teacher';
import { demoStudents } from '../routes/schoolData';

export async function attendanceSummary(
  schoolId: string | null | undefined,
  from: string,
  to: string
) {
  const isGlobal = !schoolId || schoolId === 'all';
  const usePostgres = process.env.USE_POSTGRES === 'true';

  if (usePostgres) {
    try {
      const query = isGlobal
        ? `SELECT
             COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR ar.is_present = true)::int AS present,
             COUNT(*) FILTER (WHERE ar.status = 'ABSENT' OR ar.is_present = false)::int AS absent,
             COUNT(*)::int AS marked
           FROM attendance_sessions s
           JOIN attendance_records ar ON ar.attendance_session_id = s.id
           WHERE s.attendance_date BETWEEN $1 AND $2`
        : `SELECT
             COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR ar.is_present = true)::int AS present,
             COUNT(*) FILTER (WHERE ar.status = 'ABSENT' OR ar.is_present = false)::int AS absent,
             COUNT(*)::int AS marked
           FROM attendance_sessions s
           JOIN attendance_records ar ON ar.attendance_session_id = s.id
           WHERE s.school_id = $1 AND s.attendance_date BETWEEN $2 AND $3`;
      const params = isGlobal ? [from, to] : [schoolId, from, to];
      const { rows } = await pool.query(query, params);
      const r = rows[0] || { present: 0, absent: 0, marked: 0 };
      if (Number(r.marked) > 0) {
        const percentage = Number(((Number(r.present) / Number(r.marked)) * 100).toFixed(2));
        return { ...r, percentage };
      }
    } catch {}
  }

  // Cloud Firestore & In-Memory aggregation
  let present = 0;
  let absent = 0;
  let marked = 0;

  const validSessionIds = new Set<string>();

  // 1. Cloud Firestore Sessions
  if (isFirebaseConfigured()) {
    try {
      const sessSnap = await collections.attendanceSessions().get();
      sessSnap.docs.forEach(doc => {
        const d = doc.data();
        const docSid = d.school_id || d.schoolId;
        if (!isGlobal && schoolId && docSid && !isSameSchool(docSid, schoolId)) return;
        const dStr = d.attendanceDate || d.attendance_date;
        if ((!from || dStr >= from) && (!to || dStr <= to)) {
          validSessionIds.add(doc.id);
        }
      });
    } catch (err: any) {
      console.warn('[AttendanceReport] Firestore summary query error:', err.message);
    }
  }

  // 2. In-Memory Sessions
  memAttendanceSessions.forEach(s => {
    if (!isGlobal && schoolId && !isSameSchool(s.schoolId, schoolId)) return;
    const dStr = s.attendanceDate || s.attendance_date;
    if ((!from || dStr >= from) && (!to || dStr <= to)) {
      validSessionIds.add(s.id);
    }
  });

  const countedRecordKeys = new Set<string>();

  // 3. Process Firestore Records
  if (isFirebaseConfigured() && validSessionIds.size > 0) {
    try {
      const recSnap = await collections.attendanceRecords().get();
      recSnap.docs.forEach(doc => {
        const r = doc.data();
        const sessId = r.sessionId || r.attendance_session_id;
        const key = doc.id || `${sessId}-${r.studentId || r.student_id}`;
        if (validSessionIds.has(sessId) && !countedRecordKeys.has(key)) {
          countedRecordKeys.add(key);
          const isPres = r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY' || r.is_present === true || r.isPresent === true;
          if (isPres) present++;
          else absent++;
          marked++;
        }
      });
    } catch (err: any) {
      console.warn('[AttendanceReport] Firestore summary records error:', err.message);
    }
  }

  // 4. Process In-Memory Records
  memAttendanceRecords.forEach(r => {
    const sessId = r.sessionId || r.attendance_session_id;
    const key = r.id || `${sessId}-${r.studentId || r.student_id}`;
    if (validSessionIds.has(sessId) && !countedRecordKeys.has(key)) {
      countedRecordKeys.add(key);
      const isPres = r.status === 'PRESENT' || r.status === 'LATE' || String(r.status) === 'HALF_DAY' || r.is_present === true || r.isPresent === true;
      if (isPres) present++;
      else absent++;
      marked++;
    }
  });

  const percentage = marked > 0 ? Number(((present / marked) * 100).toFixed(2)) : 0;
  return { present, absent, marked, percentage };
}

export async function studentAttendanceReport(
  schoolId: string | null | undefined,
  from: string,
  to: string,
  studentId?: string
) {
  const isGlobal = !schoolId || schoolId === 'all';
  const usePostgres = process.env.USE_POSTGRES === 'true';

  if (usePostgres) {
    try {
      const params: any[] = isGlobal ? [from, to] : [schoolId, from, to];
      let studentFilter = '';
      if (studentId) {
        params.push(studentId);
        studentFilter = ` AND ar.student_id = $${params.length}`;
      }

      const whereClause = isGlobal
        ? `WHERE s.attendance_date BETWEEN $1 AND $2 ${studentFilter}`
        : `WHERE s.school_id = $1 AND s.attendance_date BETWEEN $2 AND $3 ${studentFilter}`;

      const { rows } = await pool.query(
        `SELECT
           ar.student_id,
           st.name AS student_name,
           COALESCE(st.roll_number, '') AS roll,
           COALESCE(c.name, c.class_number::text, '10') AS class_name,
           COALESCE(sec.name, 'A') AS section_name,
           COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR ar.is_present = true)::int AS present_days,
           COUNT(*) FILTER (WHERE ar.status = 'ABSENT' OR ar.is_present = false)::int AS absent_days,
           COUNT(*)::int AS marked_days,
           ROUND(
             CASE WHEN COUNT(*) = 0 THEN 0
             ELSE COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR ar.is_present = true)::numeric / COUNT(*)::numeric * 100
             END, 2
           ) AS attendance_percentage
         FROM attendance_sessions s
         JOIN attendance_records ar ON ar.attendance_session_id = s.id
         JOIN students st ON st.id = ar.student_id
         LEFT JOIN classes c ON c.id = st.class_id
         LEFT JOIN sections sec ON sec.id = st.section_id
         ${whereClause}
         GROUP BY ar.student_id, st.name, st.roll_number, c.name, c.class_number, sec.name
         ORDER BY c.class_number, sec.name, st.roll_number, st.name`,
        params
      );
      if (rows && rows.length > 0) return rows;
    } catch {}
  }

  // ── Step 1: Load Real Students for this School from Firestore ──
  const schoolStudents = new Map<string, any>();
  if (isFirebaseConfigured()) {
    try {
      const studSnap = await collections.students().get();
      studSnap.docs.forEach(doc => {
        const d = doc.data();
        const docSid = d.school_id || d.schoolId;
        if (!isGlobal && schoolId && docSid && !isSameSchool(docSid, schoolId)) return;
        if (d.is_active === false || d.status === 'ARCHIVED' || d.status === 'DELETED') return;
        schoolStudents.set(doc.id, { id: doc.id, ...d });
      });
    } catch (err: any) {
      console.warn('[AttendanceReport] Failed to load students from Firestore:', err.message);
    }
  }

  // Only Greenwood test school uses demoStudents fallback if Firestore is completely empty
  if (schoolStudents.size === 0 && (!schoolId || isTestSchool(schoolId))) {
    demoStudents.forEach(s => {
      schoolStudents.set(s.id, s);
    });
  }

  // ── Step 2: Fetch Attendance Sessions for this School in Date Range ──
  const validSessions = new Map<string, any>();
  if (isFirebaseConfigured()) {
    try {
      const sessSnap = await collections.attendanceSessions().get();
      sessSnap.docs.forEach(doc => {
        const d = doc.data();
        const docSid = d.school_id || d.schoolId;
        if (!isGlobal && schoolId && docSid && !isSameSchool(docSid, schoolId)) return;
        const dStr = d.attendanceDate || d.attendance_date;
        if ((!from || dStr >= from) && (!to || dStr <= to)) {
          validSessions.set(doc.id, { id: doc.id, ...d });
        }
      });
    } catch (err: any) {
      console.warn('[AttendanceReport] Failed to load sessions from Firestore:', err.message);
    }
  }

  memAttendanceSessions.forEach(s => {
    if (!isGlobal && schoolId && !isSameSchool(s.schoolId, schoolId)) return;
    const dStr = s.attendanceDate || s.attendance_date;
    if ((!from || dStr >= from) && (!to || dStr <= to)) {
      validSessions.set(s.id, s);
    }
  });

  // ── Step 3: Populate Student Map with School's Enrolled Students ──
  const studentMap = new Map<string, {
    student_id: string;
    student_name: string;
    roll: string | number;
    class_name: string;
    section_name: string;
    present_days: number;
    absent_days: number;
    marked_days: number;
    attendance_percentage: number;
  }>();

  schoolStudents.forEach(s => {
    if (studentId && s.id !== studentId) return;
    const rawCls = s.class_number !== undefined && s.class_number !== null
      ? (s.class_number === -1 ? 'L-KG' : s.class_number === 0 ? 'U-KG' : String(s.class_number))
      : (s.className || s.class_name || s.class_id || '10');
    studentMap.set(s.id, {
      student_id: s.id,
      student_name: s.name || s.fullName || s.full_name || 'Student',
      roll: s.roll_number || s.rollNumber || '—',
      class_name: String(rawCls).replace(/^cls-/, ''),
      section_name: String(s.section_name || s.section || 'A').toUpperCase(),
      present_days: 0,
      absent_days: 0,
      marked_days: 0,
      attendance_percentage: 0
    });
  });

  // ── Step 4: Aggregate Real Attendance Records from Firestore & In-Memory ──
  const processedKeys = new Set<string>();

  const processRecord = (r: any) => {
    const sessId = r.sessionId || r.attendance_session_id;
    const sess = validSessions.get(sessId);
    if (!sess && validSessions.size > 0) return;

    const stId = String(r.studentId || r.student_id || '');
    if (!stId) return;
    if (studentId && stId !== studentId) return;

    const key = `${sessId || r.attendanceDate || r.attendance_date}-${stId}`;
    if (processedKeys.has(key)) return;
    processedKeys.add(key);

    if (!studentMap.has(stId)) {
      const rawCls = sess?.className || sess?.classNumber || sess?.class_number || '10';
      studentMap.set(stId, {
        student_id: stId,
        student_name: r.studentName || r.student_name || 'Student',
        roll: r.rollNumber || r.roll_number || '—',
        class_name: String(rawCls).replace(/^cls-/, ''),
        section_name: String(sess?.sectionName || sess?.section_name || 'A').toUpperCase(),
        present_days: 0,
        absent_days: 0,
        marked_days: 0,
        attendance_percentage: 0
      });
    }

    const rec = studentMap.get(stId)!;
    const isPres = r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY' || r.is_present === true || r.isPresent === true;
    rec.marked_days++;
    if (isPres) rec.present_days++;
    else rec.absent_days++;
    rec.attendance_percentage = rec.marked_days > 0 ? Number(((rec.present_days / rec.marked_days) * 100).toFixed(2)) : 0;
  };

  if (isFirebaseConfigured() && validSessions.size > 0) {
    try {
      const recSnap = await collections.attendanceRecords().get();
      recSnap.docs.forEach(doc => {
        processRecord(doc.data());
      });
    } catch (err: any) {
      console.warn('[AttendanceReport] Failed to process Firestore attendance records:', err.message);
    }
  }

  memAttendanceRecords.forEach(r => {
    processRecord(r);
  });

  // ── Step 5: Return Actual Student Records (No Fake Seed Data) ──
  if (studentMap.size > 0) {
    return Array.from(studentMap.values()).sort((a, b) =>
      String(a.roll).localeCompare(String(b.roll), undefined, { numeric: true }) ||
      a.student_name.localeCompare(b.student_name)
    );
  }

  return [];
}

export async function dailyAttendanceReport(
  schoolId: string | null | undefined,
  from: string,
  to: string
) {
  const isGlobal = !schoolId || schoolId === 'all';
  const usePostgres = process.env.USE_POSTGRES === 'true';

  if (usePostgres) {
    try {
      const params = isGlobal ? [from, to] : [schoolId, from, to];
      const whereClause = isGlobal
        ? `WHERE s.attendance_date BETWEEN $1 AND $2`
        : `WHERE s.school_id = $1 AND s.attendance_date BETWEEN $2 AND $3`;

      const { rows } = await pool.query(
        `SELECT
           s.attendance_date,
           COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR ar.is_present = true)::int AS present,
           COUNT(*) FILTER (WHERE ar.status = 'ABSENT' OR ar.is_present = false)::int AS absent,
           COUNT(*)::int AS marked
         FROM attendance_sessions s
         JOIN attendance_records ar ON ar.attendance_session_id = s.id
         ${whereClause}
         GROUP BY s.attendance_date
         ORDER BY s.attendance_date`,
        params
      );
      if (rows && rows.length > 0) {
        return rows.map(r => ({
          ...r,
          percentage: Number(r.marked) ? Number(((Number(r.present) / Number(r.marked)) * 100).toFixed(1)) : 0
        }));
      }
    } catch {}
  }

  const dayMap = new Map<string, { attendance_date: string; present: number; absent: number; marked: number; percentage: number }>();

  const validSessions = new Map<string, string>();
  if (isFirebaseConfigured()) {
    try {
      const sessSnap = await collections.attendanceSessions().get();
      sessSnap.docs.forEach(doc => {
        const d = doc.data();
        const docSid = d.school_id || d.schoolId;
        if (!isGlobal && schoolId && docSid && !isSameSchool(docSid, schoolId)) return;
        const dStr = d.attendanceDate || d.attendance_date;
        if ((!from || dStr >= from) && (!to || dStr <= to)) {
          validSessions.set(doc.id, dStr);
        }
      });
    } catch {}
  }

  memAttendanceSessions.forEach(s => {
    if (!isGlobal && schoolId && !isSameSchool(s.schoolId, schoolId)) return;
    const dStr = s.attendanceDate || s.attendance_date;
    if ((!from || dStr >= from) && (!to || dStr <= to)) {
      validSessions.set(s.id, dStr);
    }
  });

  const processed = new Set<string>();
  const addDayRecord = (dateStr: string, isPres: boolean, key: string) => {
    if (!dateStr || (from && dateStr < from) || (to && dateStr > to)) return;
    if (processed.has(key)) return;
    processed.add(key);

    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, { attendance_date: dateStr, present: 0, absent: 0, marked: 0, percentage: 0 });
    }
    const d = dayMap.get(dateStr)!;
    d.marked++;
    if (isPres) d.present++;
    else d.absent++;
    d.percentage = Number(((d.present / d.marked) * 100).toFixed(1));
  };

  if (isFirebaseConfigured() && validSessions.size > 0) {
    try {
      const recSnap = await collections.attendanceRecords().get();
      recSnap.docs.forEach(doc => {
        const r = doc.data();
        const sessId = r.sessionId || r.attendance_session_id;
        const dStr = validSessions.get(sessId) || r.attendanceDate || r.attendance_date;
        if (dStr) {
          const isPres = r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY' || r.is_present === true || r.isPresent === true;
          addDayRecord(dStr, isPres, doc.id || `${sessId}-${r.studentId}`);
        }
      });
    } catch {}
  }

  memAttendanceRecords.forEach(r => {
    const sessId = r.sessionId || r.attendance_session_id;
    const dStr = validSessions.get(sessId) || r.attendanceDate || r.attendance_date;
    if (dStr) {
      const isPres = r.status === 'PRESENT' || r.status === 'LATE' || String(r.status) === 'HALF_DAY' || r.is_present === true || r.isPresent === true;
      addDayRecord(dStr, isPres, r.id || `${sessId}-${r.studentId}`);
    }
  });

  if (dayMap.size > 0) {
    return Array.from(dayMap.values()).sort((a, b) => a.attendance_date.localeCompare(b.attendance_date));
  }

  return [];
}
