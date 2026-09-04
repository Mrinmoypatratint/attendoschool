
import {pool} from '../db';

export async function syncItem(input:{
 attendanceSessionId:string; studentId:string; status:string;
 markedAt?:string; deviceId:string; teacherId:string
}){
 const allowed=['PRESENT','ABSENT','LATE','EXCUSED'];
 if(!allowed.includes(input.status)) throw new Error('Invalid attendance status');
 const r=await pool.query(`
 SELECT s.id AS session_id,s.teacher_id,s.class_id,s.section_id
 FROM attendance_sessions s
 WHERE s.id=$1`,[input.attendanceSessionId]);
 if(!r.rows[0]) throw new Error('Attendance session not found');
 const session=r.rows[0];
 if(String(session.teacher_id)!==String(input.teacherId)) throw new Error('Teacher does not own session');
 const student=await pool.query(`SELECT id,class_id,section_id FROM students WHERE id=$1 AND active=true`,[input.studentId]);
 if(!student.rows[0]) throw new Error('Student not found or inactive');
 if(session.class_id && student.rows[0].class_id && String(session.class_id)!==String(student.rows[0].class_id))
  throw new Error('Student is not in the session class');
 if(session.section_id && student.rows[0].section_id && String(session.section_id)!==String(student.rows[0].section_id))
  throw new Error('Student is not in the session section');
 const up=await pool.query(`
 INSERT INTO attendance_records(attendance_session_id,student_id,status,marked_at)
 VALUES($1,$2,$3,$4)
 ON CONFLICT(attendance_session_id,student_id)
 DO UPDATE SET status=EXCLUDED.status,marked_at=EXCLUDED.marked_at
 RETURNING *`,
 [input.attendanceSessionId,input.studentId,input.status,input.markedAt||new Date().toISOString()]);
 return up.rows[0];
}
