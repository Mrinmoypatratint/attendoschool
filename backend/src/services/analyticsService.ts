import {pool} from '../db';
import { isTestSchool, isSameSchool } from '../utils/tenant';
import { collections, isFirebaseConfigured } from '../firebase';

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

export async function schoolOverview(schoolId:string,from?:string,to?:string){
 const start=from||new Date(Date.now()-29*86400000).toISOString().slice(0,10);
 const end=to||new Date().toISOString().slice(0,10);
 const isTest = isTestSchool(schoolId);

 try {
  const [daily,students,teachers,sessions,records]=await Promise.all([
   pool.query(`SELECT snapshot_date,total_students,total_teachers,attendance_percentage,present_records,absent_records
    FROM analytics_daily_snapshots WHERE school_id=$1 AND snapshot_date BETWEEN $2 AND $3 ORDER BY snapshot_date`,[schoolId,start,end]),
   pool.query(`SELECT COUNT(*)::int count FROM students WHERE school_id=$1 AND is_active=true`,[schoolId]),
   pool.query(`SELECT COUNT(*)::int count FROM users WHERE school_id=$1 AND role='TEACHER' AND is_active=true`,[schoolId]),
   pool.query(`SELECT COUNT(*)::int count FROM attendance_sessions WHERE school_id=$1 AND attendance_date BETWEEN $2 AND $3`,[schoolId,start,end]),
   pool.query(`SELECT COUNT(*) FILTER(WHERE ar.is_present=true)::int present, COUNT(*) FILTER(WHERE ar.is_present=false)::int absent
    FROM attendance_records ar JOIN attendance_sessions s ON s.id=ar.attendance_session_id
    WHERE s.school_id=$1 AND s.attendance_date BETWEEN $2 AND $3`,[schoolId,start,end])
  ]);
  const p=records.rows[0]; const total=(p?.present||0)+(p?.absent||0);
  const pct = total ? Number(((p.present/total)*100).toFixed(1)) : 0;

  if ((daily?.rowCount || 0) > 0 || total > 0 || (((students.rows[0]?.count as number) || 0) > 0 && !isTest)) {
    return {
      from: start,
      to: end,
      totalStudents: students.rows[0]?.count || 0,
      totalTeachers: teachers.rows[0]?.count || 0,
      attendanceSessions: sessions.rows[0]?.count || 0,
      presentRecords: p?.present || 0,
      absentRecords: p?.absent || 0,
      attendancePercentage: pct,
      daily: daily.rows || [],
      classBreakdown: [],
      lowAttendanceCount: 0,
      lowAttendanceStudents: []
    };
  }

  if (!isTest) {
    throw new Error('Fallback to clean multi-tenant response');
  }

  const mockDaily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const dayOfWeek = new Date(Date.now() - i * 86400000).getDay();
    if (dayOfWeek !== 0) { // skip Sunday
      const basePresent = 42 + Math.floor(Math.sin(i) * 5);
      const baseAbsent = Math.max(1, 5 - Math.floor(Math.sin(i) * 2));
      const pTotal = basePresent + baseAbsent;
      mockDaily.push({
        snapshot_date: d,
        present_records: basePresent,
        absent_records: baseAbsent,
        total_students: 50,
        total_teachers: 5,
        attendance_percentage: Number(((basePresent / pTotal) * 100).toFixed(1))
      });
    }
  }

  const classBreakdown = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({
    classNumber: n,
    className: `Class ${n}`,
    present: 45 + (n % 4) * 2,
    absent: 3 + (n % 3),
    percentage: Number((88 + (n % 10) * 1.1).toFixed(1))
  }));

  const lowAttendanceStudents = [
    { id: 'st-04', name: 'Ananya Sen', roll_number: '4', class_name: 'Class 8', section_name: 'B', attendance_rate: 68.5, absent_days: 7, parent_name: 'Subhash Sen', parent_phone: '9876543213', parent_email: 'subhash.sen@example.com' },
    { id: 'st-07', name: 'Karan Patel', roll_number: '7', class_name: 'Class 9', section_name: 'A', attendance_rate: 71.0, absent_days: 6, parent_name: 'Vijay Patel', parent_phone: '9876543216', parent_email: 'vijay.p@example.com' }
  ];

  return {
    from: start,
    to: end,
    totalStudents: students.rows[0]?.count || 10,
    totalTeachers: teachers.rows[0]?.count || 2,
    attendanceSessions: sessions.rows[0]?.count || 12,
    presentRecords: p?.present || 88,
    absentRecords: p?.absent || 10,
    attendancePercentage: total ? pct : 89.8,
    daily: daily.rowCount ? daily.rows : mockDaily,
    classBreakdown,
    lowAttendanceCount: lowAttendanceStudents.length,
    lowAttendanceStudents
  };
 } catch {
  // Try Firestore for real school data
  let studentCount = 0;
  let teacherCount = 0;
  let sessionCount = 0;

  if (isFirebaseConfigured() && schoolId) {
    try {
      const [stSnap, tchSnap, sessSnap] = await Promise.all([
        collections.students().get(),
        collections.teachers().get(),
        collections.attendanceSessions().get()
      ]);
      if (!stSnap.empty) {
        studentCount = stSnap.docs.filter(d => {
          const dt = d.data();
          const sid = dt.school_id || dt.schoolId;
          return sid && isSameSchool(sid, schoolId) && dt.is_active !== false;
        }).length;
      }
      if (!tchSnap.empty) {
        teacherCount = tchSnap.docs.filter(d => {
          const dt = d.data();
          const sid = dt.school_id || dt.schoolId;
          return sid && isSameSchool(sid, schoolId) && dt.is_active !== false;
        }).length;
      }
      if (!sessSnap.empty) {
        sessionCount = sessSnap.docs.filter(d => {
          const dt = d.data();
          const sid = dt.school_id || dt.schoolId;
          return sid && isSameSchool(sid, schoolId);
        }).length;
      }
    } catch {}
  }

  if (!isTest) {
    return {
      from: start,
      to: end,
      totalStudents: studentCount,
      totalTeachers: teacherCount,
      attendanceSessions: sessionCount,
      presentRecords: 0,
      absentRecords: 0,
      attendancePercentage: 0,
      daily: [],
      classBreakdown: [],
      lowAttendanceCount: 0,
      lowAttendanceStudents: []
    };
  }

  const mockDaily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const dayOfWeek = new Date(Date.now() - i * 86400000).getDay();
    if (dayOfWeek !== 0) {
      const basePresent = 44 + Math.floor(Math.cos(i) * 4);
      const baseAbsent = Math.max(1, 4 - Math.floor(Math.cos(i) * 2));
      const pTotal = basePresent + baseAbsent;
      mockDaily.push({
        snapshot_date: d,
        present_records: basePresent,
        absent_records: baseAbsent,
        total_students: 50,
        total_teachers: 4,
        attendance_percentage: Number(((basePresent / pTotal) * 100).toFixed(1))
      });
    }
  }

  const classBreakdown = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({
    classNumber: n,
    className: `Class ${n}`,
    present: 42 + (n % 4) * 2,
    absent: 3 + (n % 3),
    percentage: Number((88 + (n % 8) * 1.2).toFixed(1))
  }));

  const lowAttendanceStudents = [
    { id: 'st-04', name: 'Ananya Sen', roll_number: '4', class_name: 'Class 8', section_name: 'B', attendance_rate: 68.5, absent_days: 7, parent_name: 'Subhash Sen', parent_phone: '9876543213', parent_email: 'subhash.sen@example.com' },
    { id: 'st-07', name: 'Karan Patel', roll_number: '7', class_name: 'Class 9', section_name: 'A', attendance_rate: 71.0, absent_days: 6, parent_name: 'Vijay Patel', parent_phone: '9876543216', parent_email: 'vijay.p@example.com' }
  ];

  return {
    from: start,
    to: end,
    totalStudents: studentCount || 10,
    totalTeachers: teacherCount || 2,
    attendanceSessions: sessionCount || 14,
    presentRecords: 92,
    absentRecords: 8,
    attendancePercentage: 92.0,
    daily: mockDaily,
    classBreakdown,
    lowAttendanceCount: lowAttendanceStudents.length,
    lowAttendanceStudents
  };
 }
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
 const rec=(await pool.query(`SELECT COUNT(*) FILTER(WHERE ar.status='PRESENT')::int present,COUNT(*) FILTER(WHERE ar.status='ABSENT')::int absent
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
