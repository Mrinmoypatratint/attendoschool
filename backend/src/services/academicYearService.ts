import { pool } from '../db';

export async function listAcademicYears(schoolId: string) {
  let { rows } = await pool.query(
    `SELECT ay.*,
      (SELECT COUNT(*)::int FROM students st WHERE st.school_id=ay.school_id AND st.academic_year_id=ay.id) AS student_count,
      (SELECT COUNT(*)::int FROM classes c WHERE c.school_id=ay.school_id AND (c.academic_year_id=ay.id OR (c.academic_year_id IS NULL AND ay.is_active=TRUE))) AS class_count
     FROM academic_years ay
     WHERE ay.school_id=$1
     ORDER BY ay.start_date DESC`,
    [schoolId]
  );

  // If this school has zero academic years in the database, initialize clean baseline records in PostgreSQL
  if (!rows || rows.length === 0) {
    try {
      await pool.query(
        `INSERT INTO academic_years (school_id, name, start_date, end_date, is_active, is_archived, created_at, updated_at)
         VALUES 
           ($1, '2024–25 Academic Session', '2024-04-01', '2025-03-31', false, true, NOW(), NOW()),
           ($1, '2025–26 Academic Session', '2025-04-01', '2026-03-31', true, false, NOW(), NOW()),
           ($1, '2026–27 Academic Session', '2026-04-01', '2027-03-31', false, false, NOW(), NOW())
         ON CONFLICT (school_id, name) DO NOTHING`,
        [schoolId]
      );

      const refreshed = await pool.query(
        `SELECT ay.*,
          (SELECT COUNT(*)::int FROM students st WHERE st.school_id=ay.school_id AND st.academic_year_id=ay.id) AS student_count,
          (SELECT COUNT(*)::int FROM classes c WHERE c.school_id=ay.school_id AND (c.academic_year_id=ay.id OR (c.academic_year_id IS NULL AND ay.is_active=TRUE))) AS class_count
         FROM academic_years ay
         WHERE ay.school_id=$1
         ORDER BY ay.start_date DESC`,
        [schoolId]
      );
      rows = refreshed.rows;
    } catch (_seedErr) {
      // Return empty if insert was blocked
    }
  }

  return rows || [];
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
       (school_id,name,start_date,end_date,is_active,is_archived)
       VALUES ($1,$2,$3,$4,$5,false) RETURNING *`,
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
      `SELECT id FROM academic_years WHERE id=$1 AND school_id=$2`,
      [id,schoolId]
    );
    if (!check.rowCount) throw new Error('Academic year not found');

    await client.query(
      `UPDATE academic_years SET is_active=FALSE, updated_at=NOW()
       WHERE school_id=$1`,
      [schoolId]
    );
    const { rows } = await client.query(
      `UPDATE academic_years SET is_active=TRUE, is_archived=FALSE, updated_at=NOW()
       WHERE id=$1 AND school_id=$2 RETURNING *`,
      [id,schoolId]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch(e) {
    await client.query('ROLLBACK'); throw e;
  } finally { client.release(); }
}

export async function deactivateAcademicYear(schoolId: string, id: string) {
  const check = await pool.query(
    `SELECT id, is_active FROM academic_years WHERE id=$1 AND school_id=$2`,
    [id,schoolId]
  );
  if (!check.rowCount) throw new Error('Academic year not found');

  const { rows } = await pool.query(
    `UPDATE academic_years
     SET is_active=FALSE, updated_at=NOW()
     WHERE id=$1 AND school_id=$2 RETURNING *`,
    [id,schoolId]
  );
  return rows[0];
}

export async function archiveAcademicYear(schoolId: string, id: string) {
  const check = await pool.query(
    `SELECT id FROM academic_years WHERE id=$1 AND school_id=$2`,
    [id,schoolId]
  );
  if (!check.rowCount) throw new Error('Academic year not found');

  const { rows } = await pool.query(
    `UPDATE academic_years
     SET is_archived=TRUE, is_active=FALSE, updated_at=NOW()
     WHERE id=$1 AND school_id=$2 RETURNING *`,
    [id,schoolId]
  );
  return rows[0];
}

export async function unarchiveAcademicYear(schoolId: string, id: string) {
  const check = await pool.query(
    `SELECT id FROM academic_years WHERE id=$1 AND school_id=$2`,
    [id,schoolId]
  );
  if (!check.rowCount) throw new Error('Academic year not found');

  const { rows } = await pool.query(
    `UPDATE academic_years
     SET is_archived=FALSE, is_active=FALSE, updated_at=NOW()
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
