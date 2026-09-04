import { pool } from '../db';

export async function attendanceSummary(
  schoolId: string,
  from: string,
  to: string
) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE ar.status = 'PRESENT')::int AS present,
       COUNT(*) FILTER (WHERE ar.status = 'ABSENT')::int AS absent,
       COUNT(*)::int AS marked
     FROM attendance_sessions s
     JOIN attendance_records ar ON ar.attendance_session_id = s.id
     WHERE s.school_id = $1 AND s.attendance_date BETWEEN $2 AND $3`,
    [schoolId, from, to]
  );
  const r = rows[0] || { present: 0, absent: 0, marked: 0 };
  const percentage = Number(r.marked) ? Number(((Number(r.present) / Number(r.marked)) * 100).toFixed(2)) : 0;
  return { ...r, percentage };
}

export async function studentAttendanceReport(
  schoolId: string,
  from: string,
  to: string,
  studentId?: string
) {
  const params: any[] = [schoolId, from, to];
  let studentFilter = '';
  if (studentId) {
    params.push(studentId);
    studentFilter = ` AND ar.student_id = $4`;
  }

  const { rows } = await pool.query(
    `SELECT
       ar.student_id,
       st.name AS student_name,
       st.roll,
       c.name AS class_name,
       sec.name AS section_name,
       COUNT(*) FILTER (WHERE ar.status = 'PRESENT')::int AS present_days,
       COUNT(*) FILTER (WHERE ar.status = 'ABSENT')::int AS absent_days,
       COUNT(*)::int AS marked_days,
       ROUND(
         CASE WHEN COUNT(*) = 0 THEN 0
         ELSE COUNT(*) FILTER (WHERE ar.status = 'PRESENT')::numeric / COUNT(*)::numeric * 100
         END, 2
       ) AS attendance_percentage
     FROM attendance_sessions s
     JOIN attendance_records ar ON ar.attendance_session_id = s.id
     JOIN students st ON st.id = ar.student_id
     LEFT JOIN classes c ON c.id = st.class_id
     LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE s.school_id = $1
       AND s.attendance_date BETWEEN $2 AND $3
       ${studentFilter}
     GROUP BY ar.student_id, st.name, st.roll, c.name, sec.name
     ORDER BY c.name, sec.name, st.roll, st.name`,
    params
  );
  return rows;
}

export async function dailyAttendanceReport(
  schoolId: string,
  from: string,
  to: string
) {
  const { rows } = await pool.query(
    `SELECT
       s.attendance_date,
       COUNT(*) FILTER (WHERE ar.status = 'PRESENT')::int AS present,
       COUNT(*) FILTER (WHERE ar.status = 'ABSENT')::int AS absent,
       COUNT(*)::int AS marked
     FROM attendance_sessions s
     JOIN attendance_records ar ON ar.attendance_session_id = s.id
     WHERE s.school_id = $1 AND s.attendance_date BETWEEN $2 AND $3
     GROUP BY s.attendance_date
     ORDER BY s.attendance_date`,
    [schoolId, from, to]
  );
  return rows;
}
