import {pool} from '../db';

const isUuid = (val: any) => Boolean(val) && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

export async function periods(schoolId:string){
 return (await pool.query(`SELECT * FROM timetable_periods WHERE school_id=$1 ORDER BY period_number`,[schoolId])).rows;
}

export async function createPeriod(schoolId:string,data:any){
 if(!data.name||!data.startTime||!data.endTime)throw new Error('Name, start time and end time are required');
 if(data.endTime<=data.startTime)throw new Error('End time must be after start time');
 const {rows}=await pool.query(`INSERT INTO timetable_periods(school_id,name,period_number,start_time,end_time,is_break)
 VALUES($1,$2,$3,$4,$5,$6)
 ON CONFLICT (school_id, period_number)
 DO UPDATE SET name=EXCLUDED.name, start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time, is_break=EXCLUDED.is_break
 RETURNING *`,[schoolId,data.name,data.periodNumber,data.startTime,data.endTime,!!data.isBreak]);
 return rows[0];
}

export async function createTemplatePeriods(schoolId: string) {
  const template = [
    { period_number: 1, name: 'Period 1', start_time: '09:00', end_time: '09:45', is_break: false },
    { period_number: 2, name: 'Period 2', start_time: '09:45', end_time: '10:30', is_break: false },
    { period_number: 3, name: 'Short Break', start_time: '10:30', end_time: '10:45', is_break: true },
    { period_number: 4, name: 'Period 3', start_time: '10:45', end_time: '11:30', is_break: false },
    { period_number: 5, name: 'Period 4', start_time: '11:30', end_time: '12:15', is_break: false },
    { period_number: 6, name: 'Lunch Break', start_time: '12:15', end_time: '13:00', is_break: true },
    { period_number: 7, name: 'Period 5', start_time: '13:00', end_time: '13:45', is_break: false },
    { period_number: 8, name: 'Period 6', start_time: '13:45', end_time: '14:30', is_break: false }
  ];

  const results: any[] = [];
  for (const t of template) {
    const { rows } = await pool.query(
      `INSERT INTO timetable_periods (school_id, name, period_number, start_time, end_time, is_break)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (school_id, period_number)
       DO UPDATE SET name = EXCLUDED.name, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, is_break = EXCLUDED.is_break
       RETURNING *`,
      [schoolId, t.name, t.period_number, t.start_time, t.end_time, t.is_break]
    );
    if (rows[0]) results.push(rows[0]);
  }
  return results;
}

export async function createEntry(schoolId:string,userId:string,d:any){
  let validPeriodId = d.periodId;
  if (!isUuid(validPeriodId)) {
    const pNum = d.periodNumber || d.period_number;
    let pRow;
    if (pNum) {
      const res = await pool.query(`SELECT id FROM timetable_periods WHERE school_id = $1 AND period_number = $2`, [schoolId, pNum]);
      pRow = res.rows[0];
    }
    if (!pRow) {
      const matchNum = String(d.periodId || '').match(/t(\d+)$/i);
      if (matchNum) {
        const res = await pool.query(`SELECT id FROM timetable_periods WHERE school_id = $1 AND period_number = $2`, [schoolId, parseInt(matchNum[1], 10)]);
        pRow = res.rows[0];
      }
    }
    if (pRow) {
      validPeriodId = pRow.id;
    } else {
      const seeded = await createTemplatePeriods(schoolId);
      const targetPNum = pNum || (String(d.periodId || '').match(/t(\d+)$/i) ? parseInt(String(d.periodId).match(/t(\d+)$/i)![1], 10) : 1);
      const found = seeded.find(p => p.period_number === targetPNum);
      if (found) validPeriodId = found.id;
      else throw new Error('Invalid period slot specified');
    }
  }

  const classId = isUuid(d.classId) ? d.classId : null;
  const sectionId = isUuid(d.sectionId) ? d.sectionId : null;
  const subjectId = isUuid(d.subjectId) ? d.subjectId : null;
  const teacherId = isUuid(d.teacherId) ? d.teacherId : null;
  const altTeacherId = isUuid(d.altTeacherId) ? d.altTeacherId : null;
  const academicYearId = isUuid(d.academicYearId) ? d.academicYearId : null;

  const conflicts = await findConflicts(schoolId, { ...d, periodId: validPeriodId });
  if (conflicts.length) throw new Error(`Timetable conflict: ${conflicts.map(x => x.details || x.conflict_type).join('; ')}`);

  const { rows } = await pool.query(
    `INSERT INTO timetable_entries
     (school_id, academic_year_id, class_id, section_id, subject_id, teacher_id, substitute_teacher_id, period_id, day_of_week, room_name, status, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PUBLISHED', $11, $12) RETURNING *`,
    [
      schoolId,
      academicYearId,
      classId,
      sectionId,
      subjectId,
      teacherId,
      altTeacherId,
      validPeriodId,
      Number(d.dayOfWeek || d.day_of_week),
      d.roomName || d.room_name || null,
      d.notes || null,
      userId
    ]
  );
  return rows[0];
}

export async function updateEntry(schoolId: string, userId: string, entryId: string, d: any) {
  const existingRes = await pool.query(
    `SELECT * FROM timetable_entries WHERE id = $1 AND school_id = $2`,
    [entryId, schoolId]
  );
  if (!existingRes.rows.length) {
    throw new Error('Timetable entry not found');
  }
  const existing = existingRes.rows[0];

  const subjectId = isUuid(d.subjectId) ? d.subjectId : (d.subjectId === null ? null : (isUuid(d.subject_id) ? d.subject_id : existing.subject_id));
  const teacherId = isUuid(d.teacherId) ? d.teacherId : (d.teacherId === null ? null : (isUuid(d.teacher_id) ? d.teacher_id : existing.teacher_id));
  const altTeacherId = isUuid(d.altTeacherId) ? d.altTeacherId : (isUuid(d.substituteTeacherId) ? d.substituteTeacherId : (isUuid(d.substitute_teacher_id) ? d.substitute_teacher_id : (d.altTeacherId === null || d.substituteTeacherId === null || d.substitute_teacher_id === null ? null : existing.substitute_teacher_id)));
  const roomName = d.roomName !== undefined ? d.roomName : (d.room_name !== undefined ? d.room_name : existing.room_name);

  const conflicts = await findConflicts(schoolId, {
    id: entryId,
    dayOfWeek: existing.day_of_week,
    periodId: existing.period_id,
    classId: existing.class_id,
    sectionId: existing.section_id,
    teacherId,
    roomName
  });

  if (conflicts.length) {
    throw new Error(`Timetable conflict: ${conflicts.map(x => x.details || x.conflict_type).join('; ')}`);
  }

  const { rows } = await pool.query(
    `UPDATE timetable_entries
     SET subject_id = $1,
         teacher_id = $2,
         substitute_teacher_id = $3,
         room_name = $4,
         updated_at = NOW()
     WHERE id = $5 AND school_id = $6
     RETURNING *`,
    [subjectId, teacherId, altTeacherId, roomName, entryId, schoolId]
  );

  return rows[0];
}


export async function findConflicts(schoolId:string,d:any){
 const pNum = d.periodNumber || d.period_number || null;
 const params=[schoolId,d.dayOfWeek,d.periodId,d.teacherId||null,d.classId||null,d.sectionId||null,d.roomName||null,d.id||null,pNum];
 const {rows}=await pool.query(`
 SELECT e.id,
   CASE
    WHEN $4::uuid IS NOT NULL AND (e.teacher_id=$4::uuid OR e.substitute_teacher_id=$4::uuid) THEN 'TEACHER_DOUBLE_BOOKED'
    WHEN $5::uuid IS NOT NULL AND $6::uuid IS NOT NULL AND e.class_id=$5::uuid AND e.section_id=$6::uuid THEN 'CLASS_SECTION_DOUBLE_BOOKED'
    WHEN $7::text IS NOT NULL AND e.room_name=$7::text THEN 'ROOM_DOUBLE_BOOKED'
    ELSE 'TIMESLOT_CONFLICT' END AS conflict_type
 FROM timetable_entries e
 LEFT JOIN timetable_periods p ON p.id = e.period_id
 WHERE e.school_id=$1 AND e.day_of_week=$2 
   AND (e.period_id=$3 OR ($9::int IS NOT NULL AND p.period_number=$9::int))
   AND e.status<>'CANCELLED' AND ($8::uuid IS NULL OR e.id<>$8::uuid)
   AND (
    ($4::uuid IS NOT NULL AND (e.teacher_id=$4::uuid OR e.substitute_teacher_id=$4::uuid)) OR
    ($5::uuid IS NOT NULL AND $6::uuid IS NOT NULL AND e.class_id=$5::uuid AND e.section_id=$6::uuid) OR
    ($7::text IS NOT NULL AND e.room_name=$7::text)
   )`,params);
 return rows;
}

export async function listEntries(schoolId:string,filters:any={}){
 const values=[schoolId];let where='e.school_id=$1';
 if(filters.id){values.push(filters.id);where+=' AND e.id=$'+values.length}
 if(filters.day){values.push(filters.day);where+=' AND e.day_of_week=$'+values.length}
 if(filters.classId){values.push(filters.classId);where+=' AND e.class_id=$'+values.length}
 if(filters.sectionId){values.push(filters.sectionId);where+=' AND e.section_id=$'+values.length}
 if(filters.teacherId){values.push(filters.teacherId);where+=' AND COALESCE(e.substitute_teacher_id,e.teacher_id)=$'+values.length}
 const {rows}=await pool.query(`SELECT e.*,p.name period_name,p.period_number,p.start_time,p.end_time,
 s.name subject_name,u.name teacher_name,su.name substitute_teacher_name,
 c.class_number,sec.name AS section_name
 FROM timetable_entries e
 LEFT JOIN timetable_periods p ON (p.id = e.period_id OR (p.school_id = e.school_id AND p.period_number = (CASE WHEN e.period_id::text ~ 't[0-9]+$' THEN CAST(SUBSTRING(e.period_id::text FROM 't([0-9]+)$') AS INTEGER) ELSE NULL END)))
 LEFT JOIN subjects s ON s.id=e.subject_id LEFT JOIN users u ON u.id=e.teacher_id
 LEFT JOIN users su ON su.id=e.substitute_teacher_id
 LEFT JOIN classes c ON c.id=e.class_id
 LEFT JOIN sections sec ON sec.id=e.section_id WHERE ${where}
 ORDER BY e.day_of_week, COALESCE(p.period_number, 0)`,values);
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
