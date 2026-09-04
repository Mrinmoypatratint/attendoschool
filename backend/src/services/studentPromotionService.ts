import { pool } from '../db';

export async function listPromotionCandidates(schoolId:string, fromYearId:string) {
  const {rows}=await pool.query(
    `SELECT st.id,st.name,st.roll,st.admission_number,st.class_id AS from_class_id,
            st.section_id AS from_section_id,c.name AS from_class_name,sec.name AS from_section_name,
            st.enrollment_status,
            EXISTS(
              SELECT 1 FROM student_promotions sp
              WHERE sp.student_id=st.id AND sp.from_academic_year_id=$2
                AND sp.status='CONFIRMED'
            ) AS already_processed
     FROM students st
     LEFT JOIN classes c ON c.id=st.class_id
     LEFT JOIN sections sec ON sec.id=st.section_id
     WHERE st.school_id=$1 AND st.academic_year_id=$2
     ORDER BY c.name,sec.name,st.roll,st.name`,
    [schoolId,fromYearId]
  );
  return rows;
}

export async function promoteStudents(
  schoolId:string, actorId:string, fromYearId:string, toYearId:string,
  items:any[]
) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');

    const fy=await client.query(
      `SELECT id FROM academic_years WHERE id=$1 AND school_id=$2`,
      [fromYearId,schoolId]
    );
    const ty=await client.query(
      `SELECT id FROM academic_years WHERE id=$1 AND school_id=$2`,
      [toYearId,schoolId]
    );
    if(!fy.rowCount||!ty.rowCount) throw new Error('Invalid academic year');

    const results=[];
    for(const item of items||[]) {
      const studentId=String(item.studentId||'');
      const outcome=String(item.outcome||'PROMOTED').toUpperCase();
      if(!studentId || !['PROMOTED','RETAINED','GRADUATED','TRANSFERRED'].includes(outcome)) continue;

      const st=await client.query(
        `SELECT * FROM students
         WHERE id=$1 AND school_id=$2 AND academic_year_id=$3
         FOR UPDATE`,
        [studentId,schoolId,fromYearId]
      );
      if(!st.rowCount) throw new Error(`Student not found: ${studentId}`);

      const existing=await client.query(
        `SELECT id FROM student_promotions
         WHERE student_id=$1 AND from_academic_year_id=$2 AND to_academic_year_id=$3
           AND status='CONFIRMED'`,
        [studentId,fromYearId,toYearId]
      );
      if(existing.rowCount) continue;

      const targetClass=item.toClassId || null;
      const targetSection=item.toSectionId || null;

      await client.query(
        `INSERT INTO student_promotions
         (school_id,from_academic_year_id,to_academic_year_id,student_id,
          from_class_id,from_section_id,to_class_id,to_section_id,outcome,note,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [schoolId,fromYearId,toYearId,studentId,st.rows[0].class_id,st.rows[0].section_id,
         targetClass,targetSection,outcome,item.note||null,actorId]
      );

      await client.query(
        `UPDATE students
         SET academic_year_id=$1,
             class_id=COALESCE($2,class_id),
             section_id=COALESCE($3,section_id),
             enrollment_status=$4,
             updated_at=NOW()
         WHERE id=$5 AND school_id=$6`,
        [
          toYearId,
          targetClass,
          targetSection,
          outcome==='GRADUATED'?'GRADUATED':outcome==='TRANSFERRED'?'TRANSFERRED':'ACTIVE',
          studentId,schoolId
        ]
      );
      results.push({studentId,outcome});
    }

    await client.query('COMMIT');
    return results;
  } catch(e) {
    await client.query('ROLLBACK'); throw e;
  } finally { client.release(); }
}
