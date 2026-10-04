import { pool } from '../db';

export async function listStudents(schoolId: string, search = '', activeOnly = true) {
  const params: any[] = [schoolId];
  let where = 'WHERE st.school_id=$1';
  if (activeOnly) where += ' AND st.is_active=TRUE';
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (st.name ILIKE $2 OR CAST(st.roll AS TEXT) ILIKE $2 OR COALESCE(st.admission_number,'') ILIKE $2 OR COALESCE(st.gender,'') ILIKE $2)`;
  }
  const { rows } = await pool.query(
    `SELECT st.*, c.name AS class_name, sec.name AS section_name
     FROM students st
     LEFT JOIN classes c ON c.id=st.class_id
     LEFT JOIN sections sec ON sec.id=st.section_id
     ${where}
     ORDER BY c.name, sec.name, st.roll, st.name`,
    params
  );
  return rows;
}

export async function updateStudent(schoolId: string, id: string, body: any) {
  const allowed = [
    'name','roll','class_id','section_id','parent_phone','parent_name',
    'parent_email','admission_number','date_of_birth','gender','address',
    'emergency_contact','photo_url'
  ];
  const fields: string[] = [];
  const values: any[] = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      values.push(body[key] === '' ? null : body[key]);
      fields.push(`${key}=$${values.length}`);
    }
  }
  if (!fields.length) throw new Error('No student fields supplied');
  values.push(id, schoolId);
  const { rows } = await pool.query(
    `UPDATE students SET ${fields.join(', ')}, updated_at=NOW()
     WHERE id=$${values.length-1} AND school_id=$${values.length}
     RETURNING *`,
    values
  );
  if (!rows.length) throw new Error('Student not found');
  return rows[0];
}

export async function setStudentActive(schoolId: string, id: string, active: boolean) {
  const { rows } = await pool.query(
    `UPDATE students SET is_active=$1, updated_at=NOW()
     WHERE id=$2 AND school_id=$3 RETURNING *`,
    [active, id, schoolId]
  );
  if (!rows.length) throw new Error('Student not found');
  return rows[0];
}

export async function listTeachers(schoolId: string, search = '', activeOnly = true) {
  const params: any[] = [schoolId];
  let where = `WHERE u.school_id=$1 AND u.role='TEACHER'`;
  if (activeOnly) where += ` AND COALESCE(tp.is_active, TRUE)=TRUE AND u.is_active=TRUE`;
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (u.name ILIKE $2 OR u.email ILIKE $2 OR COALESCE(tp.employee_id,'') ILIKE $2 OR COALESCE(tp.gender,'') ILIKE $2)`;
  }
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.is_active AS user_active,
            tp.employee_id, tp.phone, tp.gender, tp.address, tp.joining_date,
            tp.qualification, tp.photo_url, COALESCE(tp.is_active, TRUE) AS is_active
     FROM users u
     LEFT JOIN teacher_profiles tp ON tp.user_id=u.id
     ${where}
     ORDER BY u.name`,
    params
  );
  return rows;
}

export async function updateTeacher(schoolId: string, id: string, body: any) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const teacher = await client.query(
      `SELECT u.id FROM users u WHERE u.id=$1 AND u.school_id=$2 AND u.role='TEACHER'`,
      [id, schoolId]
    );
    if (!teacher.rowCount) throw new Error('Teacher not found');

    const userFields: string[] = [];
    const userValues: any[] = [];
    if (body.name !== undefined) { userValues.push(body.name); userFields.push(`name=$${userValues.length}`); }
    if (body.email !== undefined) { userValues.push(body.email); userFields.push(`email=$${userValues.length}`); }
    if (userFields.length) {
      userValues.push(id, schoolId);
      await client.query(
        `UPDATE users SET ${userFields.join(', ')}, updated_at=NOW()
         WHERE id=$${userValues.length-1} AND school_id=$${userValues.length}`,
        userValues
      );
    }

    const allowed = ['employee_id','phone','gender','address','joining_date','qualification','photo_url'];
    const fields: string[] = [];
    const values: any[] = [];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        values.push(body[key] === '' ? null : body[key]);
        fields.push(`${key}=$${values.length}`);
      }
    }
    if (fields.length) {
      values.push(id);
      await client.query(
        `INSERT INTO teacher_profiles (user_id, ${allowed.filter(k => Object.prototype.hasOwnProperty.call(body,k)).join(', ')})
         VALUES ($${values.length}, ${values.slice(0,-1).map((_,i)=>'$'+(i+1)).join(', ')})
         ON CONFLICT (user_id) DO UPDATE SET ${fields.join(', ')}`,
        values
      );
    }
    await client.query('COMMIT');
    return (await listTeachers(schoolId, '', false)).find(t => t.id === id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

export async function setTeacherActive(schoolId: string, id: string, active: boolean) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query(
      `SELECT id FROM users WHERE id=$1 AND school_id=$2 AND role='TEACHER'`,
      [id, schoolId]
    );
    if (!check.rowCount) throw new Error('Teacher not found');
    await client.query(`UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2`, [active, id]);
    await client.query(
      `INSERT INTO teacher_profiles (user_id, is_active)
       VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE SET is_active=$2`,
      [id, active]
    );
    await client.query('COMMIT');
    return { id, is_active: active };
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally { client.release(); }
}
