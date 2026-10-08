import { pool } from '../db';
import { isSameSchool, isTestSchool, isTintSchool, isGreenwoodSchool } from '../utils/tenant';
import { demoStudents } from '../routes/schoolData';

export async function listPromotionCandidates(schoolId: string, fromYearId: string) {
  const pgSchoolId = isTintSchool(schoolId)
    ? '00000000-0000-0000-0000-000000000002'
    : (isGreenwoodSchool(schoolId) ? '00000000-0000-0000-0000-000000000001' : schoolId);

  const matchedYearIds = new Set<string>();
  if (fromYearId) matchedYearIds.add(fromYearId);

  try {
    const ayQ = await pool.query(
      `SELECT id, name, is_active FROM academic_years WHERE (school_id::text = $1 OR school_id::text = $2)`,
      [pgSchoolId, schoolId]
    );
    if (ayQ.rowCount && ayQ.rows.length > 0) {
      const match = ayQ.rows.find((r: any) => 
        r.id === fromYearId || 
        r.name === fromYearId || 
        (fromYearId && r.name.toLowerCase().includes(fromYearId.toLowerCase()))
      );
      if (match) {
        matchedYearIds.add(match.id);
        const normName = match.name.replace(/[^0-9]/g, '');
        for (const r of ayQ.rows) {
          const rNorm = r.name.replace(/[^0-9]/g, '');
          if (rNorm && normName && (rNorm === normName || (normName.length >= 4 && rNorm.startsWith(normName.slice(0, 4))))) {
            matchedYearIds.add(r.id);
          }
        }
      }
    }
  } catch {}

  const yearIdArray = Array.from(matchedYearIds);

  const query = `
    SELECT st.id, st.name, st.roll_number AS roll, st.roll_number, st.admission_number,
           st.class_id AS from_class_id, st.section_id AS from_section_id,
           CASE 
             WHEN c.class_number = -1 THEN 'Class-L-KG'
             WHEN c.class_number = 0 THEN 'U-KG'
             WHEN c.class_number IS NOT NULL THEN 'Class ' || c.class_number::text
             ELSE '—'
           END AS from_class_name,
           COALESCE(sec.name, 'A') AS from_section_name,
           st.enrollment_status,
           EXISTS(
             SELECT 1 FROM student_promotions sp
             WHERE sp.student_id = st.id 
               AND (sp.from_academic_year_id::text = ANY($2::text[]))
               AND sp.status = 'CONFIRMED'
           ) AS already_processed
    FROM students st
    LEFT JOIN classes c ON c.id = st.class_id
    LEFT JOIN sections sec ON sec.id = st.section_id
    WHERE (st.school_id::text = $1::text OR st.school_id::text = $3::text)
      AND (st.academic_year_id::text = ANY($2::text[]) OR ($2 = '{}' AND st.academic_year_id IS NULL))
    ORDER BY c.class_number NULLS LAST, sec.name, st.roll_number, st.name
  `;

  try {
    const { rows } = await pool.query(query, [pgSchoolId, yearIdArray, schoolId]);
    if (rows && rows.length > 0) {
      return rows;
    }
    // If strict year match yielded 0, but candidates exist with NULL academic_year_id, fetch them
    const fallbackQ = await pool.query(
      `SELECT st.id, st.name, st.roll_number AS roll, st.roll_number, st.admission_number,
              st.class_id AS from_class_id, st.section_id AS from_section_id,
              CASE 
                WHEN c.class_number = -1 THEN 'Class-L-KG'
                WHEN c.class_number = 0 THEN 'U-KG'
                WHEN c.class_number IS NOT NULL THEN 'Class ' || c.class_number::text
                ELSE '—'
              END AS from_class_name,
              COALESCE(sec.name, 'A') AS from_section_name,
              st.enrollment_status,
              false AS already_processed
       FROM students st
       LEFT JOIN classes c ON c.id = st.class_id
       LEFT JOIN sections sec ON sec.id = st.section_id
       WHERE (st.school_id::text = $1::text OR st.school_id::text = $2::text)
         AND (st.academic_year_id IS NULL OR st.academic_year_id::text = ANY($3::text[]))
       ORDER BY c.class_number NULLS LAST, sec.name, st.roll_number, st.name`,
      [pgSchoolId, schoolId, yearIdArray]
    );
    if (fallbackQ.rowCount && fallbackQ.rows.length > 0) {
      return fallbackQ.rows;
    }
  } catch (err: any) {
    console.error('[StudentPromotions] listPromotionCandidates SQL error:', err.message);
  }

  // Fallback to in-memory demoStudents if database had 0 rows or errored
  const memoryCandidates = demoStudents
    .filter(s => (isSameSchool(s.school_id, schoolId) || isSameSchool(s.schoolId, schoolId)))
    .filter(s => yearIdArray.length === 0 || yearIdArray.includes(s.academic_year_id) || yearIdArray.includes(s.session_id) || (s.session_name && s.session_name.includes(fromYearId)))
    .map(s => ({
      id: s.id,
      name: s.name,
      roll: s.roll_number || s.roll || '1',
      roll_number: s.roll_number || s.roll || '1',
      admission_number: s.admission_number || s.admissionNumber || '',
      from_class_id: s.class_id,
      from_section_id: s.section_id,
      from_class_name: s.class_number !== undefined 
        ? (s.class_number === -1 ? 'L-KG' : s.class_number === 0 ? 'U-KG' : `Class ${s.class_number}`) 
        : (s.class_name || 'Class 10'),
      from_section_name: s.section_name || 'A',
      enrollment_status: s.enrollment_status || 'ACTIVE',
      already_processed: false
    }));

  return memoryCandidates;
}

function toSafeUuid(val?: string | null): string | null {
  if (!val) return null;
  const s = String(val).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return s;
  }
  return null;
}

export async function promoteStudents(
  schoolId: string,
  actorId: string,
  fromYearId: string,
  toYearId: string,
  items: any[]
) {
  const pgSchoolId = isTintSchool(schoolId)
    ? '00000000-0000-0000-0000-000000000002'
    : (isGreenwoodSchool(schoolId) ? '00000000-0000-0000-0000-000000000001' : schoolId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve fromYearId and toYearId
    let resolvedFromId = fromYearId;
    let resolvedToId = toYearId;
    const ayQ = await client.query(
      `SELECT id, name FROM academic_years WHERE (school_id::text = $1 OR school_id::text = $2)`,
      [pgSchoolId, schoolId]
    );
    if (ayQ.rowCount && ayQ.rows.length > 0) {
      const fFound = ayQ.rows.find((r: any) => r.id === fromYearId || r.name === fromYearId || (fromYearId && r.name.toLowerCase().includes(fromYearId.toLowerCase())));
      if (fFound) resolvedFromId = fFound.id;
      const tFound = ayQ.rows.find((r: any) => r.id === toYearId || r.name === toYearId || (toYearId && r.name.toLowerCase().includes(toYearId.toLowerCase())));
      if (tFound) resolvedToId = tFound.id;
    }

    const fy = await client.query(
      `SELECT id FROM academic_years WHERE id::text = $1 AND (school_id::text = $2 OR school_id::text = $3)`,
      [resolvedFromId, pgSchoolId, schoolId]
    );
    const ty = await client.query(
      `SELECT id FROM academic_years WHERE id::text = $1 AND (school_id::text = $2 OR school_id::text = $3)`,
      [resolvedToId, pgSchoolId, schoolId]
    );
    if (!fy.rowCount || !ty.rowCount) {
      throw new Error('Invalid academic session specified');
    }

    // Resolve valid actor user UUID
    let validActorId = actorId;
    const userCheck = await client.query('SELECT id FROM users WHERE id::text = $1 LIMIT 1', [actorId]);
    if (!userCheck.rowCount) {
      const adminUser = await client.query(
        `SELECT id FROM users WHERE (school_id::text = $1 OR school_id::text = $2) AND role IN ('SCHOOL_ADMIN', 'SUPER_ADMIN') LIMIT 1`,
        [pgSchoolId, schoolId]
      );
      if (adminUser.rowCount) validActorId = adminUser.rows[0].id;
    }

    const results = [];
    for (const item of items || []) {
      const studentId = String(item.studentId || '');
      const outcome = String(item.outcome || 'PROMOTED').toUpperCase();
      if (!studentId || !['PROMOTED', 'RETAINED', 'GRADUATED', 'TRANSFERRED'].includes(outcome)) continue;

      const st = await client.query(
        `SELECT * FROM students
         WHERE id::text = $1 AND (school_id::text = $2 OR school_id::text = $3)`,
        [studentId, pgSchoolId, schoolId]
      );
      if (!st.rowCount) throw new Error(`Student not found: ${studentId}`);

      const currentStudent = st.rows[0];

      // Retrieve class number if student is in a class
      let currentClassNumber: number | null = null;
      if (currentStudent.class_id) {
        const cQ = await client.query(
          `SELECT class_number FROM classes WHERE id::text = $1 LIMIT 1`,
          [String(currentStudent.class_id)]
        );
        if (cQ.rowCount) {
          currentClassNumber = cQ.rows[0].class_number;
        }
      }

      // Check if already processed
      const existing = await client.query(
        `SELECT id FROM student_promotions
         WHERE student_id::text = $1 AND from_academic_year_id::text = $2 AND to_academic_year_id::text = $3
           AND status = 'CONFIRMED'`,
        [studentId, resolvedFromId, resolvedToId]
      );
      if (existing.rowCount) continue;

      let targetClass: string | null = toSafeUuid(item.toClassId);
      let targetSection: string | null = toSafeUuid(item.toSectionId);

      if (outcome === 'PROMOTED' && !targetClass && currentClassNumber !== null && currentClassNumber !== undefined) {
        // Automatically determine next class number
        const nextClassNum = currentClassNumber + 1;
        const nextClsQ = await client.query(
          `SELECT id FROM classes WHERE (school_id::text = $1 OR school_id::text = $2) AND class_number = $3 LIMIT 1`,
          [pgSchoolId, schoolId, nextClassNum]
        );
        if (nextClsQ.rowCount) {
          targetClass = nextClsQ.rows[0].id;
          if (currentStudent.section_id) {
            const curSecQ = await client.query(`SELECT name FROM sections WHERE id::text = $1`, [String(currentStudent.section_id)]);
            if (curSecQ.rowCount) {
              const nextSecQ = await client.query(
                `SELECT id FROM sections WHERE class_id::text = $1 AND name = $2 LIMIT 1`,
                [String(targetClass), curSecQ.rows[0].name]
              );
              if (nextSecQ.rowCount) targetSection = nextSecQ.rows[0].id;
            }
          }
        }
      } else if (outcome === 'RETAINED') {
        targetClass = toSafeUuid(currentStudent.class_id);
        targetSection = toSafeUuid(currentStudent.section_id);
      }

      await client.query(
        `INSERT INTO student_promotions
         (school_id, from_academic_year_id, to_academic_year_id, student_id,
          from_class_id, from_section_id, to_class_id, to_section_id, outcome, note, created_by)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::uuid, $8::uuid, $9, $10, $11::uuid)
         ON CONFLICT (student_id, from_academic_year_id, to_academic_year_id) DO UPDATE SET
           to_class_id = EXCLUDED.to_class_id,
           to_section_id = EXCLUDED.to_section_id,
           outcome = EXCLUDED.outcome,
           status = 'CONFIRMED'`,
        [
          pgSchoolId,
          resolvedFromId,
          resolvedToId,
          studentId,
          toSafeUuid(currentStudent.class_id),
          toSafeUuid(currentStudent.section_id),
          targetClass,
          targetSection,
          outcome,
          item.note || null,
          validActorId
        ]
      );

      await client.query(
        `UPDATE students
         SET academic_year_id = $1::uuid,
             class_id = COALESCE($2::uuid, class_id),
             section_id = COALESCE($3::uuid, section_id),
             enrollment_status = $4,
             updated_at = NOW()
         WHERE id::text = $5`,
        [
          resolvedToId,
          targetClass,
          targetSection,
          outcome === 'GRADUATED' ? 'GRADUATED' : (outcome === 'TRANSFERRED' ? 'TRANSFERRED' : 'ACTIVE'),
          studentId
        ]
      );

      // In-memory demo store sync
      const demoStu = demoStudents.find(s => s.id === studentId);
      if (demoStu) {
        demoStu.academic_year_id = resolvedToId;
        demoStu.session_id = resolvedToId;
        if (targetClass) demoStu.class_id = targetClass;
        if (targetSection) demoStu.section_id = targetSection;
        demoStu.enrollment_status = outcome === 'GRADUATED' ? 'GRADUATED' : (outcome === 'TRANSFERRED' ? 'TRANSFERRED' : 'ACTIVE');
      }

      results.push({ studentId, outcome });
    }

    await client.query('COMMIT');
    return results;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
