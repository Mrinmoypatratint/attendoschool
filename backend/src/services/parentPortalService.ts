import { pool } from '../db';

export async function getParentChildren(schoolId:string,parentUserId:string){
  const {rows}=await pool.query(
    `SELECT st.id,st.name,st.roll,st.admission_number,st.photo_url,
            st.parent_name,st.parent_phone,st.parent_email,
            c.name AS class_name,sec.name AS section_name
     FROM parent_student_links psl
     JOIN students st ON st.id=psl.student_id
     LEFT JOIN classes c ON c.id=st.class_id
     LEFT JOIN sections sec ON sec.id=st.section_id
     WHERE psl.school_id=$1 AND psl.parent_user_id=$2 AND st.is_active=TRUE
     ORDER BY c.name,sec.name,st.roll,st.name`,
    [schoolId,parentUserId]
  );
  return rows;
}

export async function getChildAttendance(schoolId:string,parentUserId:string,studentId:string,from:string,to:string){
  const allowed=await pool.query(
    `SELECT 1 FROM parent_student_links WHERE school_id=$1 AND parent_user_id=$2 AND student_id=$3`,
    [schoolId,parentUserId,studentId]
  );
  if(!allowed.rowCount) throw new Error('Student is not linked to this parent');

  const {rows}=await pool.query(
    `SELECT s.attendance_date,ar.status,
            s.start_time,s.end_time,u.name AS teacher_name
     FROM attendance_records ar
     JOIN attendance_sessions s ON s.id=ar.attendance_session_id
     LEFT JOIN users u ON u.id=s.teacher_id
     WHERE s.school_id=$1 AND ar.student_id=$2
       AND s.attendance_date BETWEEN $3 AND $4
     ORDER BY s.attendance_date DESC,s.start_time DESC`,
    [schoolId,studentId,from,to]
  );
  const present=rows.filter((x:any)=>x.status==='PRESENT').length;
  const absent=rows.filter((x:any)=>x.status==='ABSENT').length;
  const marked=present+absent;
  return {records:rows,summary:{present,absent,marked,percentage:marked?Number((present/marked*100).toFixed(2)):0}};
}
