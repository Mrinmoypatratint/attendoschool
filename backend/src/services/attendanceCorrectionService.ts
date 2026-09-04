import { pool } from '../db';

export async function createCorrection(
  schoolId: string,
  attendanceRecordId: string,
  requestedBy: string,
  requestedStatus: string,
  reason: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rec = await client.query(
      `SELECT ar.id, ar.status, s.school_id
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.attendance_session_id
       WHERE ar.id=$1 AND s.school_id=$2
       FOR UPDATE`,
      [attendanceRecordId, schoolId]
    );
    if (!rec.rowCount) throw new Error('Attendance record not found');
    if (!['PRESENT','ABSENT'].includes(requestedStatus)) throw new Error('Invalid requested status');
    if (!reason || reason.trim().length < 3) throw new Error('Reason is required');

    const existing = await client.query(
      `SELECT id FROM attendance_correction_requests
       WHERE attendance_record_id=$1 AND status='PENDING'`,
      [attendanceRecordId]
    );
    if (existing.rowCount) throw new Error('A pending correction already exists');

    const result = await client.query(
      `INSERT INTO attendance_correction_requests
       (school_id, attendance_record_id, requested_by, requested_status, current_status, reason)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [schoolId, attendanceRecordId, requestedBy, requestedStatus, rec.rows[0].status, reason.trim()]
    );

    await client.query(
      `INSERT INTO attendance_correction_audit
       (school_id, correction_request_id, actor_user_id, action, old_status, new_status, note)
       VALUES ($1,$2,$3,'REQUESTED',$4,$5,$6)`,
      [schoolId, result.rows[0].id, requestedBy, rec.rows[0].status, requestedStatus, reason.trim()]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listCorrections(schoolId: string, status?: string) {
  const params: any[] = [schoolId];
  let where = 'WHERE acr.school_id=$1';
  if (status && ['PENDING','APPROVED','REJECTED','CANCELLED'].includes(status)) {
    params.push(status);
    where += ` AND acr.status=$2`;
  }
  const { rows } = await pool.query(
    `SELECT acr.*,
            u.name AS requester_name,
            ru.name AS reviewer_name,
            ar.student_id,
            st.name AS student_name,
            st.roll,
            c.name AS class_name,
            sec.name AS section_name,
            s.attendance_date
     FROM attendance_correction_requests acr
     JOIN users u ON u.id=acr.requested_by
     LEFT JOIN users ru ON ru.id=acr.reviewed_by
     JOIN attendance_records ar ON ar.id=acr.attendance_record_id
     JOIN students st ON st.id=ar.student_id
     JOIN attendance_sessions s ON s.id=ar.attendance_session_id
     LEFT JOIN classes c ON c.id=st.class_id
     LEFT JOIN sections sec ON sec.id=st.section_id
     ${where}
     ORDER BY acr.requested_at DESC`,
    params
  );
  return rows;
}

export async function reviewCorrection(
  schoolId: string,
  requestId: string,
  reviewerId: string,
  decision: 'APPROVED' | 'REJECTED',
  reviewNote?: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const req = await client.query(
      `SELECT * FROM attendance_correction_requests
       WHERE id=$1 AND school_id=$2
       FOR UPDATE`,
      [requestId, schoolId]
    );
    if (!req.rowCount) throw new Error('Correction request not found');
    const item = req.rows[0];
    if (item.status !== 'PENDING') throw new Error('Only pending requests can be reviewed');

    if (decision === 'APPROVED') {
      await client.query(
        `UPDATE attendance_records SET status=$1 WHERE id=$2`,
        [item.requested_status, item.attendance_record_id]
      );
    }

    await client.query(
      `UPDATE attendance_correction_requests
       SET status=$1, reviewed_by=$2, review_note=$3, reviewed_at=NOW()
       WHERE id=$4`,
      [decision, reviewerId, reviewNote || null, requestId]
    );

    await client.query(
      `INSERT INTO attendance_correction_audit
       (school_id, correction_request_id, actor_user_id, action, old_status, new_status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [schoolId, requestId, reviewerId, decision, item.current_status, item.requested_status,
       reviewNote || null]
    );

    await client.query('COMMIT');
    return { ...item, status: decision };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
