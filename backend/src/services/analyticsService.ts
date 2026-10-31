import { pool, isPostgresConfigured } from '../db';
import { isSameSchool } from '../utils/tenant';
import { collections, isFirebaseConfigured } from '../firebase';
import { memAttendanceSessions } from '../routes/teacher';

export async function platformOverview(){
 const [schools,students,activeSubs,revenue,expired]=await Promise.all([
  pool.query(`SELECT COUNT(*)::int count FROM schools`),
  pool.query(`SELECT COUNT(*)::int count FROM students`),
  pool.query(`SELECT COUNT(*)::int count FROM school_subscriptions WHERE status IN ('ACTIVE','GRACE')`),
  pool.query(`SELECT COALESCE(SUM(amount),0)::numeric revenue FROM payments WHERE COALESCE(status,'') IN ('PAID','SUCCESS','COMPLETED')`),
  pool.query(`SELECT COUNT(*)::int count FROM school_subscriptions WHERE status='EXPIRED'`)
 ]);
 return {
  totalSchools:schools.rows[0].count,totalStudents:students.rows[0].count,
  activeSubscriptions:activeSubs.rows[0].count,expiredSubscriptions:expired.rows[0].count,
  totalRevenue:Number(revenue.rows[0].revenue||0)
 };
}

export async function schoolOverview(
  schoolId: string, 
  from?: string, 
  to?: string,
  classId?: string,
  sectionId?: string,
  academicYearOrSession?: string
) {
  // Use Indian Standard Time (Asia/Kolkata) as school baseline date
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const end = (to && to.trim()) ? to.trim() : todayStr;

  // Build strictly continuous 14-day date list ending on `end` (14 days = 14 bars)
  const [eY, eM, eD] = end.split('-').map(Number);
  const fourteenDaysList: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(eY, eM - 1, eD - i);
    const yStr = dt.getFullYear();
    const mStr = String(dt.getMonth() + 1).padStart(2, '0');
    const dStr = String(dt.getDate()).padStart(2, '0');
    fourteenDaysList.push(`${yStr}-${mStr}-${dStr}`);
  }
  const fourteenDaysAgo = fourteenDaysList[0];
  const startDt = new Date(eY, eM - 1, eD - 29);
  const start = (from && from.trim()) ? from.trim() : `${startDt.getFullYear()}-${String(startDt.getMonth() + 1).padStart(2, '0')}-${String(startDt.getDate()).padStart(2, '0')}`;
  const filterClass = (classId || '').trim();
  const filterSection = (sectionId || '').trim();

  let totalStudents = 0;
  let totalTeachers = 0;
  let attendanceSessions = 0;
  let todayPresent = 0;
  let todayAbsent = 0;
  let todayLeftEarly = 0;
  let presentRecords = 0;
  let absentRecords = 0;
  let attendancePercentage = 0;
  let daily: any[] = [];
  let classBreakdown: any[] = [];
  let lowAttendanceStudents: any[] = [];
  let classes: any[] = [];
  let sections: any[] = [];

  let targetAyId: string | null = null;
  let targetAyName: string | null = null;

  if (isPostgresConfigured && schoolId) {
    try {
      // 1. Resolve target academic year / session
      if (academicYearOrSession && academicYearOrSession.trim()) {
        const sClean = academicYearOrSession.trim();
        const matchYears = sClean.match(/\d{4}[-–/]\d{2,4}/);
        const pattern = matchYears ? matchYears[0].replace('–', '-') : sClean.replace(/academic\s*session/i, '').trim();

        const ayMatch = await pool.query(
          `SELECT id, name FROM academic_years 
           WHERE school_id = $1 AND (
             id::text = $2 
             OR LOWER(name) = LOWER($2) 
             OR LOWER(name) LIKE '%' || LOWER($3) || '%'
             OR LOWER($2) LIKE '%' || LOWER(name) || '%'
           ) ORDER BY is_active DESC LIMIT 1`,
          [schoolId, sClean, pattern]
        ).catch(() => ({ rows: [] }));

        if (ayMatch.rows.length > 0) {
          targetAyId = ayMatch.rows[0].id;
          targetAyName = ayMatch.rows[0].name;
        }
      }

      if (!targetAyId) {
        const activeAy = await pool.query(
          `SELECT id, name FROM academic_years WHERE school_id = $1 AND is_active = true LIMIT 1`,
          [schoolId]
        ).catch(() => ({ rows: [] }));
        if (activeAy.rows.length > 0) {
          targetAyId = activeAy.rows[0].id;
          targetAyName = activeAy.rows[0].name;
        }
      }

      // 2. Resolve matched class (UUID or numeric class_number)
      let matchedClassId: string | null = null;
      let matchedClassNumber: number | null = null;
      if (filterClass) {
        const cNum = Number(filterClass);
        const cMatch = await pool.query(
          `SELECT id, class_number FROM classes 
           WHERE school_id = $1 AND (id::text = $2 OR class_number = $3)
           LIMIT 1`,
          [schoolId, filterClass, isNaN(cNum) ? -999 : cNum]
        ).catch(() => ({ rows: [] }));

        if (cMatch.rows.length > 0) {
          matchedClassId = cMatch.rows[0].id;
          matchedClassNumber = Number(cMatch.rows[0].class_number);
        } else if (!isNaN(cNum)) {
          matchedClassNumber = cNum;
        } else {
          matchedClassId = filterClass;
        }
      }

      // 3. Resolve matched section (UUID or name)
      let matchedSectionId: string | null = null;
      let matchedSectionName: string | null = null;
      if (filterSection) {
        const sMatch = await pool.query(
          `SELECT id, name FROM sections 
           WHERE school_id = $1 AND (id::text = $2 OR LOWER(name) = LOWER($2))
           LIMIT 1`,
          [schoolId, filterSection]
        ).catch(() => ({ rows: [] }));

        if (sMatch.rows.length > 0) {
          matchedSectionId = sMatch.rows[0].id;
          matchedSectionName = sMatch.rows[0].name;
        } else {
          matchedSectionName = filterSection;
        }
      }

      const [
        studentsRes,
        teachersRes,
        sessionsCountRes,
        recordsRes,
        todayAttendanceRes,
        dailyRes,
        classRes,
        atRiskRes,
        classesRes,
        sectionsRes
      ] = await Promise.all([
        // 1. Total Active Students for school & active academic year, filtered by class/section
        pool.query(`SELECT COUNT(*)::int count 
          FROM students st
          LEFT JOIN classes c ON c.id = st.class_id
          LEFT JOIN sections sec ON sec.id = st.section_id
          WHERE st.school_id = $1 AND st.is_active = true
            AND ($2::uuid IS NULL OR st.academic_year_id = $2::uuid)
            AND ($3::text IS NULL OR st.class_id::text = $3::text OR c.class_number = $4::int)
            AND ($5::text IS NULL OR st.section_id::text = $5::text OR LOWER(sec.name) = LOWER($6::text))`,
          [schoolId, targetAyId, matchedClassId, matchedClassNumber, matchedSectionId, matchedSectionName]
        ).catch(() => ({ rows: [{ count: 0 }] })),

        // 2. Total Active Teachers
        pool.query(`SELECT COUNT(*)::int count FROM users WHERE school_id=$1 AND role='TEACHER' AND is_active=true`, [schoolId])
          .catch(() => ({ rows: [{ count: 0 }] })),

        // 3. Attendance Sessions in requested period (filtered by class, section, session)
        pool.query(`SELECT COUNT(*)::int count 
          FROM attendance_sessions s
          LEFT JOIN classes c ON c.id = s.class_id
          WHERE s.school_id = $1 AND s.attendance_date BETWEEN $2 AND $3
            AND ($4::text IS NULL OR s.class_id::text = $4::text OR s.class_number = $5::int)
            AND ($6::text IS NULL OR s.section_id::text = $6::text OR LOWER(s.section_name) = LOWER($7::text))
            AND ($8::uuid IS NULL OR c.academic_year_id = $8::uuid OR EXISTS (
              SELECT 1 FROM attendance_records ar JOIN students st ON st.id = ar.student_id 
              WHERE ar.attendance_session_id = s.id AND st.academic_year_id = $8::uuid
            ))`,
          [schoolId, start, end, matchedClassId, matchedClassNumber, matchedSectionId, matchedSectionName, targetAyId]
        ).catch(() => ({ rows: [{ count: 0 }] })),

        // 4. Period records: present vs absent (filtered by class, section, session)
        pool.query(`SELECT 
          COUNT(*) FILTER(WHERE ar.is_present=true OR ar.status='PRESENT')::int present, 
          COUNT(*) FILTER(WHERE (ar.is_present=false OR ar.status='ABSENT') AND ar.status != 'LEFT_EARLY')::int absent
          FROM attendance_records ar 
          JOIN attendance_sessions s ON s.id = ar.attendance_session_id
          LEFT JOIN classes c ON c.id = s.class_id
          LEFT JOIN students st ON st.id = ar.student_id
          WHERE s.school_id = $1 AND s.attendance_date BETWEEN $2 AND $3
            AND ($4::text IS NULL OR s.class_id::text = $4::text OR s.class_number = $5::int)
            AND ($6::text IS NULL OR s.section_id::text = $6::text OR LOWER(s.section_name) = LOWER($7::text))
            AND ($8::uuid IS NULL OR c.academic_year_id = $8::uuid OR st.academic_year_id = $8::uuid)`,
          [schoolId, start, end, matchedClassId, matchedClassNumber, matchedSectionId, matchedSectionName, targetAyId]
        ).catch(() => ({ rows: [{ present: 0, absent: 0 }] })),

        // 5. Today's attendance (Real-time live metric, filtered by class, section, session)
        pool.query(`SELECT 
          COUNT(*) FILTER(WHERE ar.is_present=true OR ar.status='PRESENT')::int present, 
          COUNT(*) FILTER(WHERE (ar.is_present=false OR ar.status='ABSENT') AND ar.status != 'LEFT_EARLY')::int absent,
          COUNT(*) FILTER(WHERE ar.status='LEFT_EARLY')::int left_early
          FROM attendance_records ar 
          JOIN attendance_sessions s ON s.id = ar.attendance_session_id
          LEFT JOIN classes c ON c.id = s.class_id
          LEFT JOIN students st ON st.id = ar.student_id
          WHERE s.school_id = $1 AND s.attendance_date = $2
            AND ($3::text IS NULL OR s.class_id::text = $3::text OR s.class_number = $4::int)
            AND ($5::text IS NULL OR s.section_id::text = $5::text OR LOWER(s.section_name) = LOWER($6::text))
            AND ($7::uuid IS NULL OR c.academic_year_id = $7::uuid OR st.academic_year_id = $7::uuid)`,
          [schoolId, todayStr, matchedClassId, matchedClassNumber, matchedSectionId, matchedSectionName, targetAyId]
        ).catch(() => ({ rows: [{ present: 0, absent: 0 }] })),

        // 6. 14-Day Attendance Rhythm / Trend (filtered by class, section, session)
        pool.query(`SELECT 
          to_char(s.attendance_date, 'YYYY-MM-DD') as snapshot_date,
          COALESCE(SUM(
            CASE 
              WHEN s.present_count > 0 OR s.absent_count > 0 THEN s.present_count
              ELSE (SELECT COUNT(*) FROM attendance_records ar WHERE ar.attendance_session_id = s.id AND (ar.is_present = true OR ar.status = 'PRESENT'))
            END
          ), 0)::int as present_records,
          COALESCE(SUM(
            CASE 
              WHEN s.present_count > 0 OR s.absent_count > 0 OR s.left_early_count > 0 THEN s.absent_count
              ELSE (SELECT COUNT(*) FROM attendance_records ar WHERE ar.attendance_session_id = s.id AND (ar.is_present = false OR ar.status = 'ABSENT') AND ar.status != 'LEFT_EARLY')
            END
          ), 0)::int as absent_records,
          COALESCE(SUM(
            CASE 
              WHEN s.left_early_count > 0 THEN s.left_early_count
              ELSE (SELECT COUNT(*) FROM attendance_records ar WHERE ar.attendance_session_id = s.id AND ar.status = 'LEFT_EARLY')
            END
          ), 0)::int as left_early_records,
          COALESCE(SUM(
            CASE 
              WHEN s.total_count > 0 THEN s.total_count
              ELSE (s.present_count + s.absent_count + COALESCE(s.left_early_count, 0))
            END
          ), 0)::int as total_students
          FROM attendance_sessions s
          LEFT JOIN classes c ON c.id = s.class_id
          WHERE s.school_id = $1 AND s.attendance_date BETWEEN $2 AND $3
            AND ($4::text IS NULL OR s.class_id::text = $4::text OR s.class_number = $5::int)
            AND ($6::text IS NULL OR s.section_id::text = $6::text OR LOWER(s.section_name) = LOWER($7::text))
            AND ($8::uuid IS NULL OR c.academic_year_id = $8::uuid OR EXISTS (
              SELECT 1 FROM attendance_records ar JOIN students st ON st.id = ar.student_id 
              WHERE ar.attendance_session_id = s.id AND st.academic_year_id = $8::uuid
            ))
          GROUP BY to_char(s.attendance_date, 'YYYY-MM-DD')
          ORDER BY snapshot_date ASC`,
          [schoolId, fourteenDaysAgo, end, matchedClassId, matchedClassNumber, matchedSectionId, matchedSectionName, targetAyId]
        ).catch(() => ({ rows: [] })),

        // 7. Class-wise distribution (filtered by class, section, session)
        pool.query(`SELECT 
          s.class_number,
          s.class_id,
          COALESCE(s.class_number::text, 'Class') as class_name,
          COALESCE(SUM(s.present_count), 0)::int as present,
          COALESCE(SUM(s.absent_count), 0)::int as absent,
          COALESCE(SUM(s.left_early_count), 0)::int as left_early,
          COALESCE(SUM(s.total_count), 0)::int as total
          FROM attendance_sessions s
          LEFT JOIN classes c ON c.id = s.class_id
          WHERE s.school_id = $1 AND s.attendance_date BETWEEN $2 AND $3 AND s.class_number IS NOT NULL
            AND ($4::text IS NULL OR s.class_id::text = $4::text OR s.class_number = $5::int)
            AND ($6::text IS NULL OR s.section_id::text = $6::text OR LOWER(s.section_name) = LOWER($7::text))
            AND ($8::uuid IS NULL OR c.academic_year_id = $8::uuid OR EXISTS (
              SELECT 1 FROM attendance_records ar JOIN students st ON st.id = ar.student_id 
              WHERE ar.attendance_session_id = s.id AND st.academic_year_id = $8::uuid
            ))
          GROUP BY s.class_number, s.class_id
          ORDER BY s.class_number ASC`,
          [schoolId, start, end, matchedClassId, matchedClassNumber, matchedSectionId, matchedSectionName, targetAyId]
        ).catch(() => ({ rows: [] })),

        // 8. At-risk students (< 75% attendance in 14-day window, filtered by class, section, session)
        pool.query(`SELECT 
          st.id,
          st.name,
          st.roll_number,
          c.class_number,
          sec.name as section_name,
          st.parent_name,
          st.parent_sms_number as parent_phone,
          st.parent_email,
          COUNT(*) FILTER (WHERE ar.status = 'PRESENT' OR ar.is_present = true)::int as present_days,
          COUNT(*) FILTER (WHERE ar.status = 'ABSENT' OR ar.is_present = false)::int as absent_days,
          COUNT(*)::int as total_sessions
          FROM students st
          LEFT JOIN classes c ON c.id = st.class_id
          LEFT JOIN sections sec ON sec.id = st.section_id
          JOIN attendance_records ar ON ar.student_id = st.id
          JOIN attendance_sessions s ON s.id = ar.attendance_session_id
          WHERE st.school_id = $1 AND st.is_active = true
            AND s.attendance_date >= $2
            AND ($3::uuid IS NULL OR st.academic_year_id = $3::uuid OR c.academic_year_id = $3::uuid)
            AND ($4::text IS NULL OR s.class_id::text = $4::text OR s.class_number = $5::int OR st.class_id::text = $4::text OR c.class_number = $5::int)
            AND ($6::text IS NULL OR s.section_id::text = $6::text OR LOWER(s.section_name) = LOWER($7::text) OR st.section_id::text = $6::text OR LOWER(sec.name) = LOWER($7::text))
          GROUP BY st.id, st.name, st.roll_number, c.class_number, sec.name, st.parent_name, st.parent_sms_number, st.parent_email`,
          [schoolId, fourteenDaysAgo, targetAyId, matchedClassId, matchedClassNumber, matchedSectionId, matchedSectionName]
        ).catch(() => ({ rows: [] })),

        // 9. Classes in school (preferred for session or general)
        pool.query(`SELECT id, class_number FROM classes WHERE school_id=$1 AND ($2::uuid IS NULL OR academic_year_id = $2::uuid OR academic_year_id IS NULL) ORDER BY class_number ASC`, [schoolId, targetAyId])
          .catch(() => ({ rows: [] })),

        // 10. Sections in school (preferred for session or general)
        pool.query(`SELECT id, class_id, name FROM sections WHERE school_id=$1 AND ($2::uuid IS NULL OR academic_year_id = $2::uuid OR academic_year_id IS NULL) ORDER BY name ASC`, [schoolId, targetAyId])
          .catch(() => ({ rows: [] }))
      ]);

      classes = classesRes.rows || [];
      sections = sectionsRes.rows || [];

      if (classes.length === 0) {
        const distinctClasses = await pool.query(
          `SELECT DISTINCT class_id as id, class_number FROM attendance_sessions WHERE school_id=$1 AND class_number IS NOT NULL ORDER BY class_number ASC`,
          [schoolId]
        ).catch(() => ({ rows: [] }));
        classes = distinctClasses.rows || [];
      }
      if (sections.length === 0) {
        const distinctSections = await pool.query(
          `SELECT DISTINCT section_id as id, class_id, section_name as name FROM attendance_sessions WHERE school_id=$1 AND section_name IS NOT NULL ORDER BY section_name ASC`,
          [schoolId]
        ).catch(() => ({ rows: [] }));
        sections = distinctSections.rows || [];
      }

      totalStudents = studentsRes.rows[0]?.count || 0;
      totalTeachers = teachersRes.rows[0]?.count || 0;
      attendanceSessions = sessionsCountRes.rows[0]?.count || 0;
      presentRecords = recordsRes.rows[0]?.present || 0;
      absentRecords = recordsRes.rows[0]?.absent || 0;
      todayPresent = todayAttendanceRes.rows[0]?.present || 0;
      todayAbsent = todayAttendanceRes.rows[0]?.absent || 0;
      todayLeftEarly = todayAttendanceRes.rows[0]?.left_early || 0;

      // If today records in attendance_records were 0, check attendance_sessions
      if (todayPresent === 0 && todayAbsent === 0 && todayLeftEarly === 0 && attendanceSessions > 0) {
        const sessToday = await pool.query(
          `SELECT COALESCE(SUM(s.present_count), 0)::int as present, COALESCE(SUM(s.absent_count), 0)::int as absent, COALESCE(SUM(s.left_early_count), 0)::int as left_early 
           FROM attendance_sessions s
           LEFT JOIN classes c ON c.id = s.class_id
           WHERE s.school_id = $1 AND s.attendance_date = $2
             AND ($3::text IS NULL OR s.class_id::text = $3::text OR s.class_number = $4::int)
             AND ($5::text IS NULL OR s.section_id::text = $5::text OR LOWER(s.section_name) = LOWER($6::text))
             AND ($7::uuid IS NULL OR c.academic_year_id = $7::uuid)`,
          [schoolId, todayStr, matchedClassId, matchedClassNumber, matchedSectionId, matchedSectionName, targetAyId]
        ).catch(() => ({ rows: [{ present: 0, absent: 0, left_early: 0 }] }));
        todayPresent = sessToday.rows[0]?.present || 0;
        todayAbsent = sessToday.rows[0]?.absent || 0;
        todayLeftEarly = sessToday.rows[0]?.left_early || 0;
      }

      // If period records were 0, check attendance_sessions
      if (presentRecords === 0 && absentRecords === 0 && attendanceSessions > 0) {
        const sessPeriod = await pool.query(
          `SELECT COALESCE(SUM(s.present_count), 0)::int as present, COALESCE(SUM(s.absent_count), 0)::int as absent 
           FROM attendance_sessions s
           LEFT JOIN classes c ON c.id = s.class_id
           WHERE s.school_id = $1 AND s.attendance_date BETWEEN $2 AND $3
             AND ($4::text IS NULL OR s.class_id::text = $4::text OR s.class_number = $5::int)
             AND ($6::text IS NULL OR s.section_id::text = $6::text OR LOWER(s.section_name) = LOWER($7::text))
             AND ($8::uuid IS NULL OR c.academic_year_id = $8::uuid)`,
          [schoolId, start, end, matchedClassId, matchedClassNumber, matchedSectionId, matchedSectionName, targetAyId]
        ).catch(() => ({ rows: [{ present: 0, absent: 0 }] }));
        presentRecords = sessPeriod.rows[0]?.present || 0;
        absentRecords = sessPeriod.rows[0]?.absent || 0;
      }

      // Build date lookup map for 14-day daily rhythm from real-time DB rows
      const dbDateMap = new Map<string, { present: number; absent: number; left_early: number; total: number }>();
      for (const r of dailyRes.rows) {
        const dStr = String(r.snapshot_date).slice(0, 10);
        dbDateMap.set(dStr, {
          present: Number(r.present_records || 0),
          absent: Number(r.absent_records || 0),
          left_early: Number(r.left_early_records || 0),
          total: Number(r.total_students || 0)
        });
      }

      // Format 14-day daily rhythm ensuring all 14 consecutive calendar days are present
      daily = fourteenDaysList.map(dateKey => {
        const row = dbDateMap.get(dateKey);
        if (row && (row.present > 0 || row.absent > 0 || row.left_early > 0 || row.total > 0)) {
          const p = row.present;
          const a = row.absent;
          const le = row.left_early || 0;
          const tot = (p + a + le) > 0 ? (p + a + le) : row.total;
          const pct = tot > 0 ? Number(((p / tot) * 100).toFixed(1)) : 0;
          return {
            snapshot_date: dateKey,
            present_records: p,
            absent_records: a,
            left_early_records: le,
            total_students: row.total > 0 ? row.total : tot,
            attendance_percentage: pct,
            has_attendance: true
          };
        }
        return {
          snapshot_date: dateKey,
          present_records: 0,
          absent_records: 0,
          left_early_records: 0,
          total_students: 0,
          attendance_percentage: 0,
          has_attendance: false
        };
      });

      // Format class breakdown
      classBreakdown = classRes.rows.map(r => {
        const p = r.present || 0;
        const a = r.absent || 0;
        const le = r.left_early || 0;
        const tot = (p + a + le) > 0 ? (p + a + le) : (r.total || 0);
        const pct = tot > 0 ? Number(((p / tot) * 100).toFixed(1)) : 0;
        const cNum = Number(r.class_number);
        const cName = cNum === -1 ? 'Class L-KG' : cNum === 0 ? 'Class U-KG' : `Class ${r.class_number}`;
        return {
          classId: r.class_id,
          classNumber: r.class_number,
          className: cName,
          present: p,
          absent: a,
          leftEarly: le,
          total: tot,
          percentage: pct
        };
      });

      // Format at-risk students
      lowAttendanceStudents = atRiskRes.rows
        .map(st => {
          const rate = st.total_sessions > 0
            ? Number(((st.present_days / st.total_sessions) * 100).toFixed(1))
            : 0;
          const cNum = st.class_number !== null && st.class_number !== undefined ? Number(st.class_number) : null;
          const cName = cNum === -1 ? 'Class L-KG' : cNum === 0 ? 'Class U-KG' : (cNum !== null ? `Class ${cNum}` : '—');
          return {
            id: st.id,
            name: st.name,
            roll_number: st.roll_number || '—',
            class_name: cName,
            section_name: st.section_name || 'A',
            attendance_rate: rate,
            absent_days: st.absent_days || 0,
            total_sessions: st.total_sessions || 0,
            parent_name: st.parent_name || 'Parent/Guardian',
            parent_phone: st.parent_phone || '—',
            parent_email: st.parent_email || ''
          };
        })
        .filter(st => st.total_sessions > 0 && st.attendance_rate < 75)
        .sort((a, b) => a.attendance_rate - b.attendance_rate);

      classes = (classes.length > 0 ? classes : classesRes.rows || []).map((c: any) => {
        const num = Number(c.class_number);
        const lbl = num === -1 ? 'Class L-KG' : num === 0 ? 'Class U-KG' : `Class ${c.class_number}`;
        return {
          ...c,
          name: lbl,
          label: lbl
        };
      });

    } catch (err: any) {
      console.warn('[AnalyticsService] Postgres query error:', err.message);
    }
  }

  // Also integrate / reconcile with in-memory sessions if any exist
  try {
    const memSchoolSessions = memAttendanceSessions.filter(s => {
      if (!isSameSchool(s.schoolId || s.school_id, schoolId)) return false;
      if (filterClass && s.classId !== filterClass && String(s.classNumber) !== filterClass) return false;
      if (filterSection && s.sectionId !== filterSection && s.sectionName !== filterSection) return false;
      return true;
    });

    if (memSchoolSessions.length > 0) {
      const memTodaySessions = memSchoolSessions.filter(s => (s.attendanceDate || s.attendance_date) === todayStr);
      if (memTodaySessions.length > 0) {
        const memTodayPres = memTodaySessions.reduce((sum, s) => sum + (s.presentCount || s.present_count || 0), 0);
        const memTodayAbs = memTodaySessions.reduce((sum, s) => sum + (s.absentCount || s.absent_count || 0), 0);
        const memTodayLE = memTodaySessions.reduce((sum, s) => sum + (s.leftEarlyCount || s.left_early_count || 0), 0);
        if (todayPresent === 0 && todayAbsent === 0 && todayLeftEarly === 0) {
          todayPresent = memTodayPres;
          todayAbsent = memTodayAbs;
          todayLeftEarly = memTodayLE;
        } else if (memTodayLE > 0 && todayLeftEarly === 0) {
          todayLeftEarly = memTodayLE;
          if (todayAbsent >= memTodayLE) todayAbsent -= memTodayLE;
        }
      }

      // Reconcile daily 14-day rhythm if in-memory session has recent data
      daily = daily.map(d => {
        const memMatch = memSchoolSessions.filter(s => (s.attendanceDate || s.attendance_date) === d.snapshot_date);
        if (memMatch.length > 0) {
          const p = memMatch.reduce((sum, s) => sum + (s.presentCount || s.present_count || 0), 0);
          const a = memMatch.reduce((sum, s) => sum + (s.absentCount || s.absent_count || 0), 0);
          const le = memMatch.reduce((sum, s) => sum + (s.leftEarlyCount || s.left_early_count || 0), 0);
          const tot = (p + a + le) > 0 ? (p + a + le) : 0;
          const pct = tot > 0 ? Number(((p / tot) * 100).toFixed(1)) : 0;
          if (!d.has_attendance || (le > 0 && (!d.left_early_records || d.left_early_records === 0))) {
            return {
              ...d,
              present_records: p > 0 ? p : d.present_records,
              absent_records: a > 0 ? a : (d.absent_records >= le ? d.absent_records - le : d.absent_records),
              left_early_records: le,
              total_students: tot > 0 ? tot : d.total_students,
              attendance_percentage: pct > 0 ? pct : d.attendance_percentage,
              has_attendance: true
            };
          }
        }
        return d;
      });

      // Reconcile classBreakdown with in-memory sessions
      classBreakdown = classBreakdown.map(c => {
        const memMatch = memSchoolSessions.filter(s =>
          (c.classId && String(s.classId || s.class_id) === String(c.classId)) ||
          (c.classNumber !== undefined && Number(s.classNumber ?? s.class_number) === Number(c.classNumber))
        );
        if (memMatch.length > 0) {
          const le = memMatch.reduce((sum, s) => sum + (s.leftEarlyCount || s.left_early_count || 0), 0);
          const a = memMatch.reduce((sum, s) => sum + (s.absentCount || s.absent_count || 0), 0);
          const p = memMatch.reduce((sum, s) => sum + (s.presentCount || s.present_count || 0), 0);
          if (le > 0) {
            return {
              ...c,
              leftEarly: le,
              absent: a > 0 ? a : (c.absent >= le ? c.absent - le : c.absent),
              present: p > 0 ? p : c.present
            };
          }
        }
        return c;
      });
    }
  } catch {}

  // Calculate real average attendance percentage
  const totalRecords = presentRecords + absentRecords;
  attendancePercentage = totalRecords > 0
    ? Number(((presentRecords / totalRecords) * 100).toFixed(1))
    : 0;

  // Strict session integrity check: if 0 students exist in selected academic year, zero out sessions & counts
  if (targetAyId && totalStudents === 0) {
    attendanceSessions = 0;
    todayPresent = 0;
    todayAbsent = 0;
    presentRecords = 0;
    absentRecords = 0;
    attendancePercentage = 0;
    classBreakdown = [];
    lowAttendanceStudents = [];
    daily = daily.map(d => ({
      ...d,
      present_records: 0,
      absent_records: 0,
      total_students: 0,
      attendance_percentage: 0,
      has_attendance: false
    }));
  }

  return {
    from: start,
    to: end,
    academicYearId: targetAyId,
    academicYearName: targetAyName,
    totalStudents,
    totalTeachers,
    attendanceSessions,
    todayPresent,
    todayAbsent,
    todayLeftEarly,
    presentRecords,
    absentRecords,
    attendancePercentage,
    daily,
    classBreakdown,
    lowAttendanceCount: lowAttendanceStudents.length,
    lowAttendanceStudents,
    classes,
    sections,
    filterClass,
    filterSection
  };
}

export async function schoolRankings(limit=20){
 const {rows}=await pool.query(`SELECT s.id,s.name,s.code,
  COUNT(DISTINCT st.id)::int students,
  COUNT(DISTINCT u.id) FILTER(WHERE u.role='TEACHER')::int teachers,
  COALESCE(AVG(d.attendance_percentage),0)::numeric(6,2) attendance_percentage
  FROM schools s
  LEFT JOIN students st ON st.school_id=s.id
  LEFT JOIN users u ON u.school_id=s.id
  LEFT JOIN analytics_daily_snapshots d ON d.school_id=s.id AND d.snapshot_date>=CURRENT_DATE-29
  GROUP BY s.id ORDER BY attendance_percentage DESC LIMIT $1`,[limit]);
 return rows;
}

export async function buildDailySnapshot(schoolId:string,date:string){
 const students=(await pool.query(`SELECT COUNT(*)::int count FROM students WHERE school_id=$1`,[schoolId])).rows[0].count;
 const activeStudents=(await pool.query(`SELECT COUNT(*)::int count FROM students WHERE school_id=$1 AND COALESCE(is_active,TRUE)=TRUE`,[schoolId])).rows[0].count;
 const teachers=(await pool.query(`SELECT COUNT(*)::int count FROM users WHERE school_id=$1 AND role='TEACHER'`,[schoolId])).rows[0].count;
 const sessions=(await pool.query(`SELECT COUNT(*)::int count FROM attendance_sessions WHERE school_id=$1 AND attendance_date=$2`,[schoolId,date])).rows[0].count;
 const rec=(await pool.query(`SELECT COUNT(*) FILTER(WHERE ar.status='PRESENT' OR ar.is_present=true)::int present,COUNT(*) FILTER(WHERE ar.status='ABSENT' OR ar.is_present=false)::int absent
  FROM attendance_records ar JOIN attendance_sessions s ON s.id=ar.attendance_session_id WHERE s.school_id=$1 AND s.attendance_date=$2`,[schoolId,date])).rows[0];
 const total=(rec.present||0)+(rec.absent||0), pct=total?Number(((rec.present/total)*100).toFixed(2)):0;
 const sub=(await pool.query(`SELECT EXISTS(SELECT 1 FROM school_subscriptions WHERE school_id=$1 AND status IN ('ACTIVE','GRACE')) ok`,[schoolId])).rows[0].ok;
 const {rows}=await pool.query(`INSERT INTO analytics_daily_snapshots
 (school_id,snapshot_date,total_students,active_students,total_teachers,attendance_sessions,present_records,absent_records,attendance_percentage,active_subscription)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
 ON CONFLICT(school_id,snapshot_date) DO UPDATE SET total_students=EXCLUDED.total_students,active_students=EXCLUDED.active_students,total_teachers=EXCLUDED.total_teachers,
 attendance_sessions=EXCLUDED.attendance_sessions,present_records=EXCLUDED.present_records,absent_records=EXCLUDED.absent_records,
 attendance_percentage=EXCLUDED.attendance_percentage,active_subscription=EXCLUDED.active_subscription
 RETURNING *`,[schoolId,date,students,activeStudents,teachers,sessions,rec.present||0,rec.absent||0,pct,sub]);
 return rows[0];
}

export async function eventSummary(){
 const {rows}=await pool.query(`SELECT event_type,COUNT(*)::int count,COALESCE(SUM(value_numeric),0)::numeric value
 FROM analytics_events WHERE created_at>=NOW()-INTERVAL '30 days' GROUP BY event_type ORDER BY count DESC`);
 return rows;
}

export async function getExportStudentsData(
  schoolId: string,
  classId?: string,
  sectionId?: string,
  academicYearOrSession?: string
) {
  // 1. Resolve target academic year / session
  let targetAyId: string | null = null;
  let targetAyName: string | null = null;
  if (academicYearOrSession && academicYearOrSession.trim()) {
    const sClean = academicYearOrSession.trim();
    const matchYears = sClean.match(/\d{4}[-–/]\d{2,4}/);
    const pattern = matchYears ? matchYears[0].replace('–', '-') : sClean.replace(/academic\s*session/i, '').trim();

    const ayMatch = await pool.query(
      `SELECT id, name FROM academic_years 
       WHERE school_id = $1 AND (
         id::text = $2 
         OR LOWER(name) = LOWER($2) 
         OR LOWER(name) LIKE '%' || LOWER($3) || '%'
         OR LOWER($2) LIKE '%' || LOWER(name) || '%'
       ) ORDER BY is_active DESC LIMIT 1`,
      [schoolId, sClean, pattern]
    ).catch(() => ({ rows: [] }));

    if (ayMatch.rows.length > 0) {
      targetAyId = ayMatch.rows[0].id;
      targetAyName = ayMatch.rows[0].name;
    }
  }

  if (!targetAyId) {
    const activeAy = await pool.query(
      `SELECT id, name FROM academic_years WHERE school_id = $1 AND is_active = true LIMIT 1`,
      [schoolId]
    ).catch(() => ({ rows: [] }));
    if (activeAy.rows.length > 0) {
      targetAyId = activeAy.rows[0].id;
      targetAyName = activeAy.rows[0].name;
    }
  }

  // 2. Resolve matched class (UUID or numeric class_number)
  let matchedClassId: string | null = null;
  let matchedClassNumber: number | null = null;
  if (classId && classId.trim()) {
    const cNum = Number(classId.trim());
    const cMatch = await pool.query(
      `SELECT id, class_number FROM classes 
       WHERE school_id = $1 AND (id::text = $2 OR class_number = $3)
       LIMIT 1`,
      [schoolId, classId.trim(), isNaN(cNum) ? -999 : cNum]
    ).catch(() => ({ rows: [] }));

    if (cMatch.rows.length > 0) {
      matchedClassId = cMatch.rows[0].id;
      matchedClassNumber = Number(cMatch.rows[0].class_number);
    } else if (!isNaN(cNum)) {
      matchedClassNumber = cNum;
    } else {
      matchedClassId = classId.trim();
    }
  }

  // 3. Resolve matched section (UUID or name)
  let matchedSectionId: string | null = null;
  let matchedSectionName: string | null = null;
  if (sectionId && sectionId.trim()) {
    const sec = sectionId.trim();
    const sMatch = await pool.query(
      `SELECT id, name FROM sections 
       WHERE school_id = $1 AND (id::text = $2 OR LOWER(name) = LOWER($2))
       LIMIT 1`,
      [schoolId, sec]
    ).catch(() => ({ rows: [] }));

    if (sMatch.rows.length > 0) {
      matchedSectionId = sMatch.rows[0].id;
      matchedSectionName = sMatch.rows[0].name;
    } else {
      matchedSectionName = sec;
    }
  }

  // 4. Query all matching students along with attendance record summaries
  const { rows } = await pool.query(
    `SELECT 
       st.id,
       COALESCE(st.roll_number, '') as roll_number,
       COALESCE(st.admission_number, '') as admission_number,
       st.name,
       st.gender,
       c.class_number,
       COALESCE(
         CASE 
           WHEN c.class_number = -1 THEN 'Class L-KG'
           WHEN c.class_number = 0 THEN 'Class U-KG'
           WHEN c.class_number IS NOT NULL THEN 'Class ' || c.class_number::text
           ELSE NULL
         END,
         'Class ' || COALESCE(st.class_id::text, '')
       ) AS class_name,
       COALESCE(sec.name, 'A') AS section_name,
       COALESCE(st.parent_name, 'Parent/Guardian') as parent_name,
       COALESCE(st.parent_sms_number, '') as parent_phone,
       COALESCE(st.parent_email, '') as parent_email,
       ay.name as academic_session,
       COUNT(ar.id) FILTER (WHERE ar.status = 'PRESENT' OR ar.is_present = true)::int as present_count,
       COUNT(ar.id) FILTER (WHERE (ar.status = 'ABSENT' OR ar.is_present = false) AND ar.status != 'LEFT_EARLY')::int as absent_count,
       COUNT(ar.id)::int as total_sessions
     FROM students st
     LEFT JOIN classes c ON c.id = st.class_id
     LEFT JOIN sections sec ON sec.id = st.section_id
     LEFT JOIN academic_years ay ON ay.id = st.academic_year_id
     LEFT JOIN attendance_records ar ON ar.student_id = st.id
     WHERE st.school_id = $1 
       AND st.is_active = true
       AND ($2::uuid IS NULL OR st.academic_year_id = $2::uuid)
       AND ($3::text IS NULL OR st.class_id::text = $3::text OR c.class_number = $4::int)
       AND ($5::text IS NULL OR st.section_id::text = $5::text OR LOWER(sec.name) = LOWER($6::text))
     GROUP BY st.id, st.roll_number, st.admission_number, st.name, st.gender, c.class_number, sec.name, st.parent_name, st.parent_sms_number, st.parent_email, ay.name
     ORDER BY c.class_number ASC NULLS LAST, sec.name ASC, st.roll_number ASC, st.name ASC`,
    [schoolId, targetAyId, matchedClassId, matchedClassNumber, matchedSectionId, matchedSectionName]
  ).catch(() => ({ rows: [] }));

  const students = rows.map((r: any) => {
    const tot = Number(r.total_sessions || 0);
    const pres = Number(r.present_count || 0);
    const abs = Number(r.absent_count || 0);
    const rate = tot > 0 ? Number(((pres / tot) * 100).toFixed(1)) : 0;
    const status = tot === 0 
      ? 'No Attendance Recorded' 
      : (rate >= 75 ? 'Good Standing (≥75%)' : 'At-Risk (<75%)');

    return {
      id: r.id,
      roll_number: r.roll_number,
      admission_number: r.admission_number,
      name: r.name,
      gender: r.gender || '',
      class_name: r.class_name,
      section_name: r.section_name,
      present_count: pres,
      absent_count: abs,
      total_sessions: tot,
      attendance_rate: rate,
      attendance_status: status,
      parent_name: r.parent_name,
      parent_phone: r.parent_phone,
      parent_email: r.parent_email,
      academic_session: r.academic_session || targetAyName || ''
    };
  });

  return {
    students,
    targetAyId,
    targetAyName,
    matchedClassId,
    matchedClassNumber,
    matchedSectionId,
    matchedSectionName,
    totalCount: students.length
  };
}
