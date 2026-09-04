import { pool } from '../db';

export async function listAcademicYears(schoolId: string) {
  const { rows } = await pool.query(
    `SELECT ay.*,
      (SELECT COUNT(*)::int FROM students st WHERE st.school_id=ay.school_id AND st.academic_year_id=ay.id) AS student_count,
      (SELECT COUNT(*)::int FROM classes c WHERE c.academic_year_id=ay.id) AS class_count
     FROM academic_years ay
     WHERE ay.school_id=$1
     ORDER BY ay.start_date DESC`,
    [schoolId]
  );
  return rows;
}

export async function createAcademicYear(
  schoolId: string, name: string, startDate: string, endDate: string, makeActive=false
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (makeActive) {
      await client.query(
        `UPDATE academic_years SET is_active=FALSE, updated_at=NOW()
         WHERE school_id=$1 AND is_active=TRUE`,
        [schoolId]
      );
    }
    const { rows } = await client.query(
      `INSERT INTO academic_years
       (school_id,name,start_date,end_date,is_active)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [schoolId,name.trim(),startDate,endDate,makeActive]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch(e) {
    await client.query('ROLLBACK'); throw e;
  } finally { client.release(); }
}

export async function setActiveAcademicYear(schoolId: string, id: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query(
      `SELECT id FROM academic_years
       WHERE id=$1 AND school_id=$2 AND is_archived=FALSE`,
      [id,schoolId]
    );
    if (!check.rowCount) throw new Error('Academic year not found');

    await client.query(
      `UPDATE academic_years SET is_active=FALSE, updated_at=NOW()
       WHERE school_id=$1`,
      [schoolId]
    );
    const { rows } = await client.query(
      `UPDATE academic_years SET is_active=TRUE, updated_at=NOW()
       WHERE id=$1 AND school_id=$2 RETURNING *`,
      [id,schoolId]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch(e) {
    await client.query('ROLLBACK'); throw e;
  } finally { client.release(); }
}

export async function archiveAcademicYear(schoolId: string, id: string) {
  const check = await pool.query(
    `SELECT is_active FROM academic_years WHERE id=$1 AND school_id=$2`,
    [id,schoolId]
  );
  if (!check.rowCount) throw new Error('Academic year not found');
  if (check.rows[0].is_active) throw new Error('Active academic year cannot be archived');

  const { rows } = await pool.query(
    `UPDATE academic_years
     SET is_archived=TRUE, updated_at=NOW()
     WHERE id=$1 AND school_id=$2 RETURNING *`,
    [id,schoolId]
  );
  return rows[0];
}

export async function getActiveAcademicYear(schoolId: string) {
  const { rows } = await pool.query(
    `SELECT * FROM academic_years
     WHERE school_id=$1 AND is_active=TRUE AND is_archived=FALSE
     LIMIT 1`,
    [schoolId]
  );
  return rows[0] || null;
}
