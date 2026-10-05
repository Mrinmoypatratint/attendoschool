import { pool, isPostgresConfigured } from '../db';
import { isFirebaseConfigured, collections } from '../firebase';
import { isSameSchool, isTestSchool, isTintSchool } from '../utils/tenant';
import { memAttendanceSessions, memAttendanceRecords } from '../routes/teacher';
import { demoStudents } from '../routes/schoolData';

export async function attendanceSummary(
  schoolId: string | null | undefined,
  from: string,
  to: string
) {
  const isGlobal = !schoolId || schoolId === 'all';
  const usePostgres = isPostgresConfigured;

  if (usePostgres) {
    try {
      const isTint = isTintSchool(schoolId);
      const isGw = isTestSchool(schoolId);
      let schoolCond = `s.school_id::text = $1`;
      if (isTint) {
        schoolCond = `(s.school_id::text = $1 OR s.school_id = '00000000-0000-0000-0000-000000000002' OR s.school_id::text = 'sch-1790665531365')`;
      } else if (isGw) {
        schoolCond = `(s.school_id::text = $1 OR s.school_id = '00000000-0000-0000-0000-000000000001')`;
      }
      const query = isGlobal
        ? `SELECT
             COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR (ar.is_present = true AND ar.status != 'LEFT_EARLY' AND ar.departure_period IS NULL))::int AS present,
             COUNT(*) FILTER (WHERE ar.status = 'ABSENT' OR ar.is_present = false)::int AS absent,
             COUNT(*) FILTER (WHERE ar.status = 'LEFT_EARLY' OR ar.departure_period IS NOT NULL)::int AS left_early,
             COUNT(*)::int AS marked
           FROM attendance_sessions s
           JOIN attendance_records ar ON ar.attendance_session_id = s.id
           WHERE s.attendance_date BETWEEN $1 AND $2`
        : `SELECT
             COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR (ar.is_present = true AND ar.status != 'LEFT_EARLY' AND ar.departure_period IS NULL))::int AS present,
             COUNT(*) FILTER (WHERE ar.status = 'ABSENT' OR ar.is_present = false)::int AS absent,
             COUNT(*) FILTER (WHERE ar.status = 'LEFT_EARLY' OR ar.departure_period IS NOT NULL)::int AS left_early,
             COUNT(*)::int AS marked
           FROM attendance_sessions s
           JOIN attendance_records ar ON ar.attendance_session_id = s.id
           WHERE ${schoolCond} AND s.attendance_date BETWEEN $2 AND $3`;
      const params = isGlobal ? [from, to] : [schoolId, from, to];
      const { rows } = await pool.query(query, params);
      const r = rows[0] || { present: 0, absent: 0, left_early: 0, marked: 0 };
      if (Number(r.marked) > 0) {
        const percentage = Number(((Number(r.present) / Number(r.marked)) * 100).toFixed(2));
        return { ...r, percentage, leftEarly: r.left_early ?? 0 };
      }
    } catch {}
  }

  // Cloud Firestore & In-Memory aggregation
  let present = 0;
  let absent = 0;
  let leftEarly = 0;
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
          const isLeftEarly = r.status === 'LEFT_EARLY' || Boolean(r.departurePeriod || r.departure_period || (r as any).isLeftEarly || (r as any).left_early || (r as any).leftEarly);
          const isPres = r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY' || isLeftEarly || r.is_present === true || r.isPresent === true;
          if (isLeftEarly) leftEarly++;
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
      const isLeftEarly = r.status === 'LEFT_EARLY' || Boolean(r.departurePeriod || r.departure_period || (r as any).isLeftEarly || (r as any).left_early || (r as any).leftEarly);
      const isPres = r.status === 'PRESENT' || r.status === 'LATE' || String(r.status) === 'HALF_DAY' || isLeftEarly || r.is_present === true || (r as any).isPresent === true;
      if (isLeftEarly) leftEarly++;
      if (isPres) present++;
      else absent++;
      marked++;
    }
  });

  const percentage = marked > 0 ? Number(((present / marked) * 100).toFixed(2)) : 0;
  return { present, absent, marked, percentage, left_early: leftEarly, leftEarly };
}

export async function studentAttendanceReport(
  schoolId: string | null | undefined,
  from: string,
  to: string,
  studentId?: string
) {
  const isGlobal = !schoolId || schoolId === 'all';
  const usePostgres = isPostgresConfigured;

  if (usePostgres) {
    try {
      const isTint = isTintSchool(schoolId);
      const isGw = isTestSchool(schoolId);
      let schoolCond = `s.school_id::text = $1`;
      if (isTint) {
        schoolCond = `(s.school_id::text = $1 OR s.school_id = '00000000-0000-0000-0000-000000000002' OR s.school_id::text = 'sch-1790665531365')`;
      } else if (isGw) {
        schoolCond = `(s.school_id::text = $1 OR s.school_id = '00000000-0000-0000-0000-000000000001')`;
      }

      const params: any[] = isGlobal ? [from, to] : [schoolId, from, to];
      let studentFilter = '';
      if (studentId) {
        params.push(studentId);
        studentFilter = ` AND ar.student_id::text = $${params.length}`;
      }

      const whereClause = isGlobal
        ? `WHERE s.attendance_date BETWEEN $1 AND $2 ${studentFilter}`
        : `WHERE ${schoolCond} AND s.attendance_date BETWEEN $2 AND $3 ${studentFilter}`;

      const { rows } = await pool.query(
        `SELECT
           ar.student_id,
           st.name AS student_name,
           COALESCE(st.roll_number, '') AS roll,
           st.class_id,
           st.section_id,
           st.academic_year_id,
           c.class_number,
           COALESCE(
             CASE 
               WHEN c.class_number = -1 THEN 'L-KG'
               WHEN c.class_number = 0 THEN 'U-KG'
               WHEN c.class_number IS NOT NULL THEN 'Class ' || c.class_number::text
               ELSE NULL
             END,
             'Class 10'
           ) AS class_name,
           COALESCE(sec.name, 'A') AS section_name,
           COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR (ar.is_present = true AND ar.status != 'LEFT_EARLY' AND ar.departure_period IS NULL))::int AS present_days,
           COUNT(*) FILTER (WHERE ar.status = 'ABSENT' OR ar.is_present = false)::int AS absent_days,
           COUNT(*) FILTER (WHERE ar.status = 'LEFT_EARLY' OR ar.departure_period IS NOT NULL)::int AS left_early_days,
           COUNT(*)::int AS marked_days,
           ROUND(
             CASE WHEN COUNT(*) = 0 THEN 0
             ELSE COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR (ar.is_present = true AND ar.status != 'LEFT_EARLY' AND ar.departure_period IS NULL))::numeric / COUNT(*)::numeric * 100
             END, 2
           ) AS attendance_percentage
         FROM attendance_sessions s
         JOIN attendance_records ar ON ar.attendance_session_id = s.id
         JOIN students st ON st.id = ar.student_id
         LEFT JOIN classes c ON c.id = st.class_id
         LEFT JOIN sections sec ON sec.id = st.section_id
         ${whereClause}
         GROUP BY ar.student_id, st.name, st.roll_number, st.class_id, st.section_id, st.academic_year_id, c.class_number, sec.name
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

  if (validSessions.size === 0) {
    return [];
  }

  // ── Step 3: Populate Student Map with School's Enrolled Students ──
  const studentMap = new Map<string, {
    student_id: string;
    student_name: string;
    roll: string | number;
    class_id?: string;
    section_id?: string;
    academic_year_id?: string;
    class_number?: number;
    class_name: string;
    section_name: string;
    present_days: number;
    absent_days: number;
    left_early_days: number;
    marked_days: number;
    attendance_percentage: number;
  }>();

  schoolStudents.forEach(s => {
    if (studentId && s.id !== studentId) return;
    const rawCls = s.class_number !== undefined && s.class_number !== null
      ? (s.class_number === -1 ? 'L-KG' : s.class_number === 0 ? 'U-KG' : `Class ${s.class_number}`)
      : (s.className || s.class_name || (s.class_id ? `Class ${String(s.class_id).replace(/^cls-/, '')}` : 'Class 10'));
    const formattedCls = String(rawCls).startsWith('Class ') || rawCls === 'L-KG' || rawCls === 'U-KG'
      ? String(rawCls)
      : `Class ${String(rawCls).replace(/^cls-/, '')}`;
    studentMap.set(s.id, {
      student_id: s.id,
      student_name: s.name || s.fullName || s.full_name || 'Student',
      roll: s.roll_number || s.rollNumber || '—',
      class_id: s.class_id || s.classId,
      section_id: s.section_id || s.sectionId,
      academic_year_id: s.academic_year_id || s.academicYearId,
      class_number: s.class_number !== undefined ? Number(s.class_number) : undefined,
      class_name: formattedCls,
      section_name: String(s.section_name || s.section || 'A').toUpperCase(),
      present_days: 0,
      absent_days: 0,
      left_early_days: 0,
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
      const formattedCls = (rawCls === -1 || rawCls === '-1') ? 'L-KG' : (rawCls === 0 || rawCls === '0') ? 'U-KG' : (String(rawCls).startsWith('Class ') ? String(rawCls) : `Class ${String(rawCls).replace(/^cls-/, '')}`);
      studentMap.set(stId, {
        student_id: stId,
        student_name: r.studentName || r.student_name || 'Student',
        roll: r.rollNumber || r.roll_number || '—',
        class_id: r.classId || r.class_id || sess?.classId || sess?.class_id,
        section_id: r.sectionId || r.section_id || sess?.sectionId || sess?.section_id,
        academic_year_id: r.academicYearId || r.academic_year_id || sess?.academicYearId || sess?.academic_year_id,
        class_number: sess?.class_number !== undefined ? Number(sess.class_number) : undefined,
        class_name: formattedCls,
        section_name: String(sess?.sectionName || sess?.section_name || 'A').toUpperCase(),
        present_days: 0,
        absent_days: 0,
        left_early_days: 0,
        marked_days: 0,
        attendance_percentage: 0
      });
    }

    const rec = studentMap.get(stId)!;
    const isLeftEarly = r.status === 'LEFT_EARLY' || Boolean(r.departurePeriod || r.departure_period || (r as any).isLeftEarly || (r as any).left_early || (r as any).leftEarly);
    const isPres = r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY' || isLeftEarly || r.is_present === true || r.isPresent === true;
    rec.marked_days++;
    if (isLeftEarly) {
      rec.left_early_days = (rec.left_early_days || 0) + 1;
    }
    if (isPres && !isLeftEarly) rec.present_days++;
    else if (!isPres) rec.absent_days++;
    else rec.present_days++;
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
  const attendedStudents = Array.from(studentMap.values()).filter(s => s.marked_days > 0);
  if (attendedStudents.length > 0) {
    return attendedStudents.sort((a, b) =>
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
  const usePostgres = isPostgresConfigured;

  if (usePostgres) {
    try {
      const isTint = isTintSchool(schoolId);
      const isGw = isTestSchool(schoolId);
      let schoolCond = `s.school_id::text = $1`;
      if (isTint) {
        schoolCond = `(s.school_id::text = $1 OR s.school_id = '00000000-0000-0000-0000-000000000002' OR s.school_id::text = 'sch-1790665531365')`;
      } else if (isGw) {
        schoolCond = `(s.school_id::text = $1 OR s.school_id = '00000000-0000-0000-0000-000000000001')`;
      }

      const params = isGlobal ? [from, to] : [schoolId, from, to];
      const whereClause = isGlobal
        ? `WHERE s.attendance_date BETWEEN $1 AND $2`
        : `WHERE ${schoolCond} AND s.attendance_date BETWEEN $2 AND $3`;

      const { rows } = await pool.query(
        `SELECT
           s.attendance_date,
           COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR (ar.is_present = true AND ar.status != 'LEFT_EARLY' AND ar.departure_period IS NULL))::int AS present,
           COUNT(*) FILTER (WHERE ar.status = 'ABSENT' OR ar.is_present = false)::int AS absent,
           COUNT(*) FILTER (WHERE ar.status = 'LEFT_EARLY' OR ar.departure_period IS NOT NULL)::int AS left_early,
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

  const dayMap = new Map<string, { attendance_date: string; present: number; absent: number; left_early: number; marked: number; percentage: number }>();

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
  const addDayRecord = (dateStr: string, isPres: boolean, isLeftEarly: boolean, key: string) => {
    if (!dateStr || (from && dateStr < from) || (to && dateStr > to)) return;
    if (processed.has(key)) return;
    processed.add(key);

    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, { attendance_date: dateStr, present: 0, absent: 0, left_early: 0, marked: 0, percentage: 0 });
    }
    const d = dayMap.get(dateStr)!;
    d.marked++;
    if (isLeftEarly) d.left_early++;
    if (isPres && !isLeftEarly) d.present++;
    else if (!isPres) d.absent++;
    else d.present++;
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
          const isLeftEarly = r.status === 'LEFT_EARLY' || Boolean(r.departurePeriod || r.departure_period || (r as any).isLeftEarly || (r as any).left_early || (r as any).leftEarly);
          const isPres = r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'HALF_DAY' || isLeftEarly || r.is_present === true || r.isPresent === true;
          addDayRecord(dStr, isPres, isLeftEarly, doc.id || `${sessId}-${r.studentId}`);
        }
      });
    } catch {}
  }

  memAttendanceRecords.forEach(r => {
    const sessId = r.sessionId || r.attendance_session_id;
    const dStr = validSessions.get(sessId) || r.attendanceDate || r.attendance_date;
    if (dStr) {
      const isLeftEarly = r.status === 'LEFT_EARLY' || Boolean(r.departurePeriod || r.departure_period || (r as any).isLeftEarly || (r as any).left_early || (r as any).leftEarly);
      const isPres = r.status === 'PRESENT' || r.status === 'LATE' || String(r.status) === 'HALF_DAY' || isLeftEarly || r.is_present === true || r.isPresent === true;
      addDayRecord(dStr, isPres, isLeftEarly, r.id || `${sessId}-${r.studentId}`);
    }
  });

  if (dayMap.size > 0) {
    return Array.from(dayMap.values()).sort((a, b) => a.attendance_date.localeCompare(b.attendance_date));
  }

  return [];
}
