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
  sectionId?: string
) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const start = from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const end = to || todayStr;
  const fourteenDaysAgo = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  const filterClass = (classId || '').trim();
  const filterSection = (sectionId || '').trim();

  let totalStudents = 0;
  let totalTeachers = 0;
  let attendanceSessions = 0;
  let todayPresent = 0;
  let todayAbsent = 0;
  let presentRecords = 0;
  let absentRecords = 0;
  let attendancePercentage = 0;
  let daily: any[] = [];
  let classBreakdown: any[] = [];
  let lowAttendanceStudents: any[] = [];
  let classes: any[] = [];
  let sections: any[] = [];

  if (isPostgresConfigured && schoolId) {
    try {
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
        // 1. Total Active Students
        pool.query(`SELECT COUNT(*)::int count FROM students WHERE school_id=$1 AND is_active=true`, [schoolId])
          .catch(() => ({ rows: [{ count: 0 }] })),

        // 2. Total Active Teachers
        pool.query(`SELECT COUNT(*)::int count FROM users WHERE school_id=$1 AND role='TEACHER' AND is_active=true`, [schoolId])
          .catch(() => ({ rows: [{ count: 0 }] })),

        // 3. Attendance Sessions in requested period
        pool.query(`SELECT COUNT(*)::int count FROM attendance_sessions WHERE school_id=$1 AND attendance_date BETWEEN $2 AND $3`, [schoolId, start, end])
          .catch(() => ({ rows: [{ count: 0 }] })),

        // 4. Period records: present vs absent
        pool.query(`SELECT 
          COUNT(*) FILTER(WHERE ar.is_present=true OR ar.status='PRESENT')::int present, 
          COUNT(*) FILTER(WHERE (ar.is_present=false OR ar.status='ABSENT') AND ar.status != 'LEFT_EARLY')::int absent
          FROM attendance_records ar 
          JOIN attendance_sessions s ON s.id=ar.attendance_session_id
          WHERE s.school_id=$1 AND s.attendance_date BETWEEN $2 AND $3`, [schoolId, start, end])
          .catch(() => ({ rows: [{ present: 0, absent: 0 }] })),

        // 5. Today's attendance (Real-time live metric)
        pool.query(`SELECT 
          COUNT(*) FILTER(WHERE ar.is_present=true OR ar.status='PRESENT')::int present, 
          COUNT(*) FILTER(WHERE (ar.is_present=false OR ar.status='ABSENT') AND ar.status != 'LEFT_EARLY')::int absent
          FROM attendance_records ar 
          JOIN attendance_sessions s ON s.id=ar.attendance_session_id
          WHERE s.school_id=$1 AND s.attendance_date = $2`, [schoolId, todayStr])
          .catch(() => ({ rows: [{ present: 0, absent: 0 }] })),

        // 6. 14-Day Attendance Rhythm / Trend (filtered by class & section if provided)
        pool.query(`SELECT 
          s.attendance_date::text as snapshot_date,
          COALESCE(SUM(s.present_count), 0)::int as present_records,
          COALESCE(SUM(s.absent_count), 0)::int as absent_records,
          COALESCE(SUM(s.total_count), 0)::int as total_students
          FROM attendance_sessions s
          WHERE s.school_id=$1 AND s.attendance_date >= $2
            AND ($3 = '' OR s.class_id::text = $3 OR s.class_number::text = $3)
            AND ($4 = '' OR s.section_id::text = $4 OR LOWER(s.section_name) = LOWER($4))
          GROUP BY s.attendance_date
          ORDER BY s.attendance_date ASC`, [schoolId, fourteenDaysAgo, filterClass, filterSection])
          .catch(() => ({ rows: [] })),

        // 7. Class-wise distribution
        pool.query(`SELECT 
          s.class_number,
          COALESCE(s.class_number::text, 'Class') as class_name,
          COALESCE(SUM(s.present_count), 0)::int as present,
          COALESCE(SUM(s.absent_count), 0)::int as absent,
          COALESCE(SUM(s.total_count), 0)::int as total
          FROM attendance_sessions s
          WHERE s.school_id=$1 AND s.attendance_date BETWEEN $2 AND $3 AND s.class_number IS NOT NULL
          GROUP BY s.class_number
          ORDER BY s.class_number ASC`, [schoolId, start, end])
          .catch(() => ({ rows: [] })),

        // 8. At-risk students (< 75% attendance in 14-day window, filtered by class & section)
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
            AND ($3 = '' OR s.class_id::text = $3 OR s.class_number::text = $3 OR st.class_id::text = $3 OR c.class_number::text = $3)
            AND ($4 = '' OR s.section_id::text = $4 OR LOWER(s.section_name) = LOWER($4) OR st.section_id::text = $4 OR LOWER(sec.name) = LOWER($4))
          GROUP BY st.id, st.name, st.roll_number, c.class_number, sec.name, st.parent_name, st.parent_sms_number, st.parent_email`, [schoolId, fourteenDaysAgo, filterClass, filterSection])
          .catch(() => ({ rows: [] })),

        // 9. All classes in school
        pool.query(`SELECT id, class_number FROM classes WHERE school_id=$1 ORDER BY class_number ASC`, [schoolId])
          .catch(() => ({ rows: [] })),

        // 10. All sections in school
        pool.query(`SELECT id, class_id, name FROM sections WHERE school_id=$1 ORDER BY name ASC`, [schoolId])
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

      // If today records in attendance_records were 0, check if attendance_sessions has counts for today
      if (todayPresent === 0 && todayAbsent === 0) {
        const sessToday = await pool.query(
          `SELECT COALESCE(SUM(present_count), 0)::int as present, COALESCE(SUM(absent_count), 0)::int as absent 
           FROM attendance_sessions WHERE school_id=$1 AND attendance_date=$2`,
          [schoolId, todayStr]
        ).catch(() => ({ rows: [{ present: 0, absent: 0 }] }));
        todayPresent = sessToday.rows[0]?.present || 0;
        todayAbsent = sessToday.rows[0]?.absent || 0;
      }

      // If period records were 0, check attendance_sessions
      if (presentRecords === 0 && absentRecords === 0) {
        const sessPeriod = await pool.query(
          `SELECT COALESCE(SUM(present_count), 0)::int as present, COALESCE(SUM(absent_count), 0)::int as absent 
           FROM attendance_sessions WHERE school_id=$1 AND attendance_date BETWEEN $2 AND $3`,
          [schoolId, start, end]
        ).catch(() => ({ rows: [{ present: 0, absent: 0 }] }));
        presentRecords = sessPeriod.rows[0]?.present || 0;
        absentRecords = sessPeriod.rows[0]?.absent || 0;
      }

      // Format 14-day daily rhythm
      daily = dailyRes.rows.map(r => {
        const p = r.present_records || 0;
        const a = r.absent_records || 0;
        const tot = p + a;
        const pct = tot > 0 ? Number(((p / tot) * 100).toFixed(1)) : 0;
        return {
          snapshot_date: r.snapshot_date,
          present_records: p,
          absent_records: a,
          total_students: r.total_students || tot,
          attendance_percentage: pct
        };
      });

      // Format class breakdown
      classBreakdown = classRes.rows.map(r => {
        const p = r.present || 0;
        const a = r.absent || 0;
        const tot = p + a;
        const pct = tot > 0 ? Number(((p / tot) * 100).toFixed(1)) : 0;
        const cNum = Number(r.class_number);
        const cName = cNum === -1 ? 'Class L-KG' : cNum === 0 ? 'Class U-KG' : `Class ${r.class_number}`;
        return {
          classNumber: r.class_number,
          className: cName,
          present: p,
          absent: a,
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

  // Also integrate / reconcile with in-memory sessions if any exist (e.g. freshly taken attendance or memory mode)
  try {
    const memSchoolSessions = memAttendanceSessions.filter(s => isSameSchool(s.schoolId || s.school_id, schoolId));
    if (memSchoolSessions.length > 0) {
      const memTodaySessions = memSchoolSessions.filter(s => (s.attendanceDate || s.attendance_date) === todayStr);
      if (memTodaySessions.length > 0) {
        const memTodayPres = memTodaySessions.reduce((sum, s) => sum + (s.presentCount || s.present_count || 0), 0);
        const memTodayAbs = memTodaySessions.reduce((sum, s) => sum + (s.absentCount || s.absent_count || 0), 0);
        // If Postgres didn't have today's sessions yet or memory has newer
        if (todayPresent === 0 && todayAbsent === 0) {
          todayPresent = memTodayPres;
          todayAbsent = memTodayAbs;
        }
      }
    }
  } catch {}

  // Calculate real average attendance percentage
  const totalRecords = presentRecords + absentRecords;
  attendancePercentage = totalRecords > 0
    ? Number(((presentRecords / totalRecords) * 100).toFixed(1))
    : 0;

  return {
    from: start,
    to: end,
    totalStudents,
    totalTeachers,
    attendanceSessions,
    todayPresent,
    todayAbsent,
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
