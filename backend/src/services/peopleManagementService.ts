import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { validateStudentUniqueness } from '../utils/studentValidation';
import { normalizeGender } from '../utils/gender';

export async function listStudents(schoolId: string, search = '', activeOnly = true) {
  const params: any[] = [schoolId];
  let where = 'WHERE st.school_id=$1';
  if (activeOnly) where += ' AND st.is_active=TRUE';
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (st.name ILIKE $2 OR CAST(st.roll_number AS TEXT) ILIKE $2 OR COALESCE(st.admission_number,'') ILIKE $2 OR COALESCE(st.gender,'') ILIKE $2)`;
  }
  const { rows } = await pool.query(
    `SELECT st.*, c.name AS class_name, sec.name AS section_name
     FROM students st
     LEFT JOIN classes c ON c.id=st.class_id
     LEFT JOIN sections sec ON sec.id=st.section_id
     ${where}
     ORDER BY c.name, sec.name, st.roll_number, st.name`,
    params
  );
  return rows.map((r: any) => ({ ...r, gender: normalizeGender(r.gender) || '' }));
}

export async function updateStudent(schoolId: string, id: string, body: any) {
  const existingQ = await pool.query(`SELECT * FROM students WHERE id=$1 AND school_id=$2`, [id, schoolId]);
  if (!existingQ.rowCount || !existingQ.rows.length) {
    const err: any = new Error('Student not found');
    err.status = 404;
    throw err;
  }
  const stu = existingQ.rows[0];

  const targetAdmission = body.admission_number !== undefined ? body.admission_number : stu.admission_number;
  const targetRoll = body.roll_number !== undefined ? body.roll_number : (body.roll !== undefined ? body.roll : stu.roll_number);
  const targetClassId = body.class_id !== undefined ? body.class_id : stu.class_id;
  const targetSectionId = body.section_id !== undefined ? body.section_id : stu.section_id;
  const targetEmail = body.email !== undefined ? body.email : (body.student_email !== undefined ? body.student_email : stu.email);

  const validation = await validateStudentUniqueness({
    schoolId,
    academicYearId: stu.academic_year_id,
    classId: targetClassId,
    sectionId: targetSectionId,
    admissionNumber: targetAdmission,
    rollNumber: targetRoll,
    studentEmail: targetEmail,
    excludeStudentId: id
  });

  if (!validation.valid) {
    const err: any = new Error(validation.errors[0]?.message || 'Student uniqueness validation failed');
    err.status = 409;
    err.errors = validation.errors;
    throw err;
  }

  const fieldMap: Record<string, any> = {};
  if (body.name !== undefined) fieldMap['name'] = body.name === '' ? null : body.name;
  if (body.roll_number !== undefined || body.roll !== undefined) {
    fieldMap['roll_number'] = (body.roll_number ?? body.roll) === '' ? null : String(body.roll_number ?? body.roll);
  }
  if (body.class_id !== undefined) fieldMap['class_id'] = body.class_id === '' ? null : body.class_id;
  if (body.section_id !== undefined) fieldMap['section_id'] = body.section_id === '' ? null : body.section_id;
  if (body.parent_phone !== undefined || body.parent_sms_number !== undefined) {
    fieldMap['parent_sms_number'] = (body.parent_phone ?? body.parent_sms_number) === '' ? null : String(body.parent_phone ?? body.parent_sms_number);
  }
  if (body.parent_name !== undefined) fieldMap['parent_name'] = body.parent_name === '' ? null : body.parent_name;
  if (body.parent_email !== undefined) fieldMap['parent_email'] = body.parent_email === '' ? null : body.parent_email;
  if (body.email !== undefined || body.student_email !== undefined) {
    fieldMap['email'] = (body.email ?? body.student_email) === '' ? null : String(body.email ?? body.student_email).toLowerCase();
  }
  if (body.admission_number !== undefined) fieldMap['admission_number'] = body.admission_number === '' ? null : body.admission_number;
  if (body.date_of_birth !== undefined) fieldMap['date_of_birth'] = body.date_of_birth === '' ? null : body.date_of_birth;
  if (body.gender !== undefined) fieldMap['gender'] = body.gender === '' ? null : body.gender;
  if (body.address !== undefined) fieldMap['address'] = body.address === '' ? null : body.address;
  if (body.emergency_contact !== undefined) fieldMap['emergency_contact'] = body.emergency_contact === '' ? null : body.emergency_contact;
  if (body.photo_url !== undefined) fieldMap['photo_url'] = body.photo_url === '' ? null : body.photo_url;
  if (body.is_active !== undefined) fieldMap['is_active'] = Boolean(body.is_active);

  const fields: string[] = [];
  const values: any[] = [];
  for (const [k, v] of Object.entries(fieldMap)) {
    let val = v;
    if (k === 'gender') val = normalizeGender(v);
    values.push(val);
    fields.push(`${k}=$${values.length}`);
  }

  if (!fields.length && !body.password) throw new Error('No student fields supplied');

  let updatedStu = stu;
  if (fields.length) {
    values.push(id, schoolId);
    try {
      const { rows } = await pool.query(
        `UPDATE students SET ${fields.join(', ')}, updated_at=NOW()
         WHERE id=$${values.length-1} AND school_id=$${values.length}
         RETURNING *`,
        values
      );
      if (!rows.length) {
        const err: any = new Error('Student not found');
        err.status = 404;
        throw err;
      }
      updatedStu = rows[0];
    } catch (dbErr: any) {
      if (dbErr.code === '23505') {
        const constraint = dbErr.constraint || '';
        let msg = 'Duplicate record conflict during student update.';
        if (constraint.includes('admission') || dbErr.detail?.includes('admission_number')) {
          msg = `Admission number '${targetAdmission}' already exists in this school.`;
        } else if (constraint.includes('roll') || dbErr.detail?.includes('roll_number')) {
          msg = `Roll number '${targetRoll}' is already assigned in this section for the selected academic session.`;
        } else if (constraint.includes('email') || dbErr.detail?.includes('email')) {
          msg = `Student email '${targetEmail}' is already registered in this school.`;
        }
        const err: any = new Error(msg);
        err.status = 409;
        throw err;
      }
      throw dbErr;
    }
  }

  // Sync with users table
  const newIsActive = body.is_active !== undefined ? Boolean(body.is_active) : updatedStu.is_active;
  if (updatedStu.user_id) {
    if (body.password && String(body.password).trim()) {
      const hash = await bcrypt.hash(String(body.password).trim(), 10);
      await pool.query(
        `UPDATE users SET password_hash=$1, is_active=$2, updated_at=NOW() WHERE id=$3`,
        [hash, newIsActive, updatedStu.user_id]
      );
    } else if (body.is_active !== undefined) {
      await pool.query(
        `UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2`,
        [newIsActive, updatedStu.user_id]
      );
    }
  }
  return updatedStu;
}

export async function setStudentActive(schoolId: string, id: string, active: boolean) {
  const { rows } = await pool.query(
    `UPDATE students SET is_active=$1, updated_at=NOW()
     WHERE id=$2 AND school_id=$3 RETURNING *`,
    [active, id, schoolId]
  );
  if (!rows.length) throw new Error('Student not found');
  const stu = rows[0];
  if (stu.user_id) {
    await pool.query(`UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2`, [active, stu.user_id]);
  }
  return stu;
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
            tp.employee_id, tp.phone, tp.gender, tp.address, tp.date_of_birth, tp.joining_date,
            tp.qualification, tp.designation, tp.photo_url, tp.class_name, tp.section_name,
            COALESCE(tp.is_active, TRUE) AS is_active
     FROM users u
     LEFT JOIN teacher_profiles tp ON tp.user_id=u.id
     ${where}
     ORDER BY u.name`,
    params
  );
  return rows.map((r: any) => ({
    ...r,
    gender: normalizeGender(r.gender) || '',
    dob: r.date_of_birth ? String(r.date_of_birth).slice(0, 10) : '',
    date_of_birth: r.date_of_birth ? String(r.date_of_birth).slice(0, 10) : '',
    joining_date: r.joining_date ? String(r.joining_date).slice(0, 10) : '',
    joiningDate: r.joining_date ? String(r.joining_date).slice(0, 10) : ''
  }));
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

    const allowed = ['employee_id','phone','gender','address','date_of_birth','joining_date','qualification','designation','photo_url'];
    const fields: string[] = [];
    const values: any[] = [];
    for (const key of allowed) {
      const aliasKey = key === 'date_of_birth' ? (body.date_of_birth !== undefined ? 'date_of_birth' : 'dob')
                     : key === 'joining_date' ? (body.joining_date !== undefined ? 'joining_date' : 'joiningDate')
                     : key;
      if (Object.prototype.hasOwnProperty.call(body, aliasKey)) {
        let val = body[aliasKey] === '' ? null : body[aliasKey];
        if (key === 'gender') val = normalizeGender(val);
        values.push(val);
        fields.push(`${key}=$${values.length}`);
      }
    }
    if (fields.length) {
      values.push(id);
      await client.query(
        `INSERT INTO teacher_profiles (user_id, ${allowed.filter(k => Object.prototype.hasOwnProperty.call(body, k) || (k === 'date_of_birth' && body.dob !== undefined) || (k === 'joining_date' && body.joiningDate !== undefined)).join(', ')})
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
