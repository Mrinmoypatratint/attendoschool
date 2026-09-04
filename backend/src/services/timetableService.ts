import {pool} from '../db';

export async function periods(schoolId:string){
 return (await pool.query(`SELECT * FROM timetable_periods WHERE school_id=$1 ORDER BY period_number`,[schoolId])).rows;
}
export async function createPeriod(schoolId:string,data:any){
 if(!data.name||!data.startTime||!data.endTime)throw new Error('Name, start time and end time are required');
 if(data.endTime<=data.startTime)throw new Error('End time must be after start time');
 const {rows}=await pool.query(`INSERT INTO timetable_periods(school_id,name,period_number,start_time,end_time,is_break)
 VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[schoolId,data.name,data.periodNumber,data.startTime,data.endTime,!!data.isBreak]);
 return rows[0];
}
export async function createEntry(schoolId:string,userId:string,d:any){
 const conflicts=await findConflicts(schoolId,d);
 if(conflicts.length)throw new Error(`Timetable conflict: ${conflicts.map(x=>x.conflict_type).join(', ')}`);
 const {rows}=await pool.query(`INSERT INTO timetable_entries
 (school_id,academic_year_id,class_id,section_id,subject_id,teacher_id,period_id,day_of_week,room_name,status,notes,created_by)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT',$10,$11) RETURNING *`,
 [schoolId,d.academicYearId||null,d.classId||null,d.sectionId||null,d.subjectId||null,d.teacherId||null,d.periodId,d.dayOfWeek,d.roomName||null,d.notes||null,userId]);
 return rows[0];
}
export async function findConflicts(schoolId:string,d:any){
 const params=[schoolId,d.dayOfWeek,d.periodId,d.teacherId||null,d.classId||null,d.sectionId||null,d.roomName||null,d.id||null];
 const {rows}=await pool.query(`
 SELECT e.id,
   CASE
    WHEN $4::uuid IS NOT NULL AND e.teacher_id=$4::uuid THEN 'TEACHER_DOUBLE_BOOKED'
    WHEN $5::uuid IS NOT NULL AND $6::uuid IS NOT NULL AND e.class_id=$5::uuid AND e.section_id=$6::uuid THEN 'CLASS_SECTION_DOUBLE_BOOKED'
    WHEN $7::text IS NOT NULL AND e.room_name=$7::text THEN 'ROOM_DOUBLE_BOOKED'
    ELSE 'TIMESLOT_CONFLICT' END AS conflict_type
 FROM timetable_entries e
 WHERE e.school_id=$1 AND e.day_of_week=$2 AND e.period_id=$3
   AND e.status<>'CANCELLED' AND ($8::uuid IS NULL OR e.id<>$8::uuid)
   AND (
    ($4::uuid IS NOT NULL AND e.teacher_id=$4::uuid) OR
    ($5::uuid IS NOT NULL AND $6::uuid IS NOT NULL AND e.class_id=$5::uuid AND e.section_id=$6::uuid) OR
    ($7::text IS NOT NULL AND e.room_name=$7::text)
   )`,params);
 return rows;
}
export async function listEntries(schoolId:string,filters:any={}){
 const values=[schoolId];let where='e.school_id=$1';
 if(filters.day){values.push(filters.day);where+=' AND e.day_of_week=$'+values.length}
 if(filters.classId){values.push(filters.classId);where+=' AND e.class_id=$'+values.length}
 if(filters.sectionId){values.push(filters.sectionId);where+=' AND e.section_id=$'+values.length}
 if(filters.teacherId){values.push(filters.teacherId);where+=' AND COALESCE(e.substitute_teacher_id,e.teacher_id)=$'+values.length}
 const {rows}=await pool.query(`SELECT e.*,p.name period_name,p.period_number,p.start_time,p.end_time,
 s.name subject_name,u.name teacher_name,su.name substitute_teacher_name
 FROM timetable_entries e JOIN timetable_periods p ON p.id=e.period_id
 LEFT JOIN subjects s ON s.id=e.subject_id LEFT JOIN users u ON u.id=e.teacher_id
 LEFT JOIN users su ON su.id=e.substitute_teacher_id WHERE ${where}
 ORDER BY e.day_of_week,p.period_number`,values);
 return rows;
}
export async function publish(schoolId:string,id:string){
 const {rows}=await pool.query(`UPDATE timetable_entries SET status='PUBLISHED',updated_at=NOW()
 WHERE id=$1 AND school_id=$2 RETURNING *`,[id,schoolId]); if(!rows.length)throw new Error('Entry not found'); return rows[0];
}
export async function assignSubstitute(schoolId:string,userId:string,d:any){
 const {rows}=await pool.query(`INSERT INTO substitute_assignments(school_id,timetable_entry_id,substitute_teacher_id,effective_date,reason,created_by)
 VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(timetable_entry_id,effective_date)
 DO UPDATE SET substitute_teacher_id=EXCLUDED.substitute_teacher_id,reason=EXCLUDED.reason
 RETURNING *`,[schoolId,d.entryId,d.substituteTeacherId,d.effectiveDate,d.reason||null,userId]);
 await pool.query(`UPDATE timetable_entries SET substitute_teacher_id=$1,updated_at=NOW() WHERE id=$2 AND school_id=$3`,
 [d.substituteTeacherId,d.entryId,schoolId]);
 return rows[0];
}
