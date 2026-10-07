import {pool} from '../db';

export async function receiveBatch(schoolId:string,userId:string,payload:any){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const batchId=payload.batchId, records=Array.isArray(payload.records)?payload.records:[];
  if(!batchId)throw new Error('batchId is required');
  if(records.length>500)throw new Error('Maximum 500 records per sync batch');

  let pgUserId = userId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId));
  if (!isUuid) {
    const uRes = await client.query('SELECT id FROM users WHERE school_id=$1 LIMIT 1', [schoolId]);
    if (uRes.rowCount) pgUserId = uRes.rows[0].id;
  } else {
    const uCheck = await client.query('SELECT id FROM users WHERE id=$1', [userId]);
    if (!uCheck.rowCount) {
      const uRes = await client.query('SELECT id FROM users WHERE school_id=$1 LIMIT 1', [schoolId]);
      if (uRes.rowCount) pgUserId = uRes.rows[0].id;
    }
  }

  const existing=await client.query(`SELECT * FROM attendance_sync_batches WHERE user_id=$1 AND client_batch_id=$2`,[pgUserId,batchId]);
  if(existing.rowCount){await client.query('COMMIT');return existing.rows[0];}
  const b=(await client.query(`INSERT INTO attendance_sync_batches(school_id,user_id,client_batch_id,device_id,records_count)
    VALUES($1,$2,$3,$4,$5) RETURNING *`,[schoolId,pgUserId,batchId,payload.deviceId||null,records.length])).rows[0];
  const validRecords = [];
  for (const r of records) {
    if (!r.clientRecordId || !r.studentId || !r.attendanceDate) continue;
    validRecords.push(r);
  }

  if (validRecords.length > 0) {
    // Check if any non-uuid student IDs exist
    let defaultStudentId: string | null = null;
    const hasNonUuid = validRecords.some(r => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(r.studentId)));
    if (hasNonUuid) {
      const sChk = await client.query('SELECT id FROM students WHERE school_id=$1 LIMIT 1', [schoolId]);
      defaultStudentId = sChk.rows[0]?.id || null;
    }

    const CHUNK_SIZE = 50;
    for (let c = 0; c < validRecords.length; c += CHUNK_SIZE) {
      const chunk = validRecords.slice(c, c + CHUNK_SIZE);
      const clauses: string[] = [];
      const params: any[] = [];
      for (let i = 0; i < chunk.length; i++) {
        const r = chunk[i];
        const isStuUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(r.studentId));
        const finalStudentId = isStuUuid ? r.studentId : defaultStudentId;
        if (!finalStudentId) continue;

        const offset = params.length;
        clauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
        params.push(b.id, r.clientRecordId, finalStudentId, r.attendanceDate, !!r.present);
      }
      if (clauses.length > 0) {
        await client.query(`
          INSERT INTO attendance_sync_items(batch_id, client_record_id, student_id, attendance_date, present)
          VALUES ${clauses.join(', ')}
          ON CONFLICT(batch_id, client_record_id) DO NOTHING
        `, params);
      }
    }
  }
  await client.query('COMMIT'); return b;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

export async function processBatch(schoolId:string,userId:string,batchId:string){
 const client=await pool.connect();
 let synced=0,failed=0;
 try{
  await client.query('BEGIN');
  const b=(await client.query(`SELECT * FROM attendance_sync_batches WHERE id=$1 AND school_id=$2 AND user_id=$3 FOR UPDATE`,
    [batchId,schoolId,userId])).rows[0];
  if(!b)throw new Error('Sync batch not found');
  const items=(await client.query(`SELECT * FROM attendance_sync_items WHERE batch_id=$1 AND status='PENDING'`,[batchId])).rows;

  if (items.length > 0) {
    const dates = Array.from(new Set(items.map(it => it.attendance_date)));
    const sessionsRes = await client.query(
      `SELECT id, attendance_date FROM attendance_sessions WHERE school_id=$1 AND attendance_date = ANY($2) ORDER BY created_at DESC`,
      [schoolId, dates]
    );
    const sessionMap = new Map<string, string>();
    sessionsRes.rows.forEach(s => {
      const dStr = typeof s.attendance_date === 'string' ? s.attendance_date.slice(0, 10) : new Date(s.attendance_date).toISOString().slice(0, 10);
      if (!sessionMap.has(dStr)) sessionMap.set(dStr, s.id);
    });

    const syncedItemIds: string[] = [];
    const failedItemIds: string[] = [];
    const recordsToInsert: { sessionId: string; studentId: string; status: string }[] = [];

    for (const item of items) {
      const dStr = typeof item.attendance_date === 'string' ? item.attendance_date.slice(0, 10) : new Date(item.attendance_date).toISOString().slice(0, 10);
      const sessionId = sessionMap.get(dStr);
      if (sessionId) {
        recordsToInsert.push({ sessionId, studentId: item.student_id, status: item.present ? 'PRESENT' : 'ABSENT' });
        syncedItemIds.push(item.id);
        synced++;
      } else {
        failedItemIds.push(item.id);
        failed++;
      }
    }

    if (recordsToInsert.length > 0) {
      const CHUNK = 50;
      for (let c = 0; c < recordsToInsert.length; c += CHUNK) {
        const chunk = recordsToInsert.slice(c, c + CHUNK);
        const clauses: string[] = [];
        const params: any[] = [];
        for (let i = 0; i < chunk.length; i++) {
          const r = chunk[i];
          const offset = i * 3;
          clauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
          params.push(r.sessionId, r.studentId, r.status);
        }
        await client.query(`
          INSERT INTO attendance_records(attendance_session_id, student_id, status)
          VALUES ${clauses.join(', ')}
          ON CONFLICT(attendance_session_id, student_id) DO UPDATE SET status=EXCLUDED.status
        `, params);
      }
    }

    if (syncedItemIds.length > 0) {
      await client.query(`UPDATE attendance_sync_items SET status='SYNCED' WHERE id = ANY($1)`, [syncedItemIds]);
    }
    if (failedItemIds.length > 0) {
      await client.query(`UPDATE attendance_sync_items SET status='FAILED', error_message='No attendance session exists for this date' WHERE id = ANY($1)`, [failedItemIds]);
    }
  }

  const status=failed?'PARTIAL':'COMPLETED';
  const updated=(await client.query(`UPDATE attendance_sync_batches SET status=$1,synced_count=$2,failed_count=$3,completed_at=NOW()
    WHERE id=$4 RETURNING *`,[status,synced,failed,batchId])).rows[0];
  await client.query('COMMIT');return updated;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

export async function batchStatus(schoolId:string,userId:string,batchId:string){
 const {rows}=await pool.query(`SELECT b.*,COALESCE(json_agg(i ORDER BY i.created_at) FILTER(WHERE i.id IS NOT NULL),'[]') items
 FROM attendance_sync_batches b LEFT JOIN attendance_sync_items i ON i.batch_id=b.id
 WHERE b.id=$1 AND b.school_id=$2 AND b.user_id=$3 GROUP BY b.id`,[batchId,schoolId,userId]);
 if(!rows.length)throw new Error('Sync batch not found');return rows[0];
}
