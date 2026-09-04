import {pool} from '../db';

export async function receiveBatch(schoolId:string,userId:string,payload:any){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const batchId=payload.batchId, records=Array.isArray(payload.records)?payload.records:[];
  if(!batchId)throw new Error('batchId is required');
  if(records.length>500)throw new Error('Maximum 500 records per sync batch');
  const existing=await client.query(`SELECT * FROM attendance_sync_batches WHERE user_id=$1 AND client_batch_id=$2`,[userId,batchId]);
  if(existing.rowCount){await client.query('COMMIT');return existing.rows[0];}
  const b=(await client.query(`INSERT INTO attendance_sync_batches(school_id,user_id,client_batch_id,device_id,records_count)
    VALUES($1,$2,$3,$4,$5) RETURNING *`,[schoolId,userId,batchId,payload.deviceId||null,records.length])).rows[0];
  for(const r of records){
   if(!r.clientRecordId||!r.studentId||!r.attendanceDate)continue;
   await client.query(`INSERT INTO attendance_sync_items(batch_id,client_record_id,student_id,attendance_date,present)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT(batch_id,client_record_id) DO NOTHING`,
     [b.id,r.clientRecordId,r.studentId,r.attendanceDate,!!r.present]);
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
  for(const item of items){
   try{
    // Safe fallback: store sync result in the existing attendance_records table when schema matches.
    // A production deployment should map these records to a selected attendance_session.
    const session=(await client.query(`SELECT id FROM attendance_sessions
      WHERE school_id=$1 AND attendance_date=$2 ORDER BY created_at DESC LIMIT 1`,
      [schoolId,item.attendance_date])).rows[0];
    if(!session)throw new Error('No attendance session exists for this date');
    await client.query(`INSERT INTO attendance_records(attendance_session_id,student_id,status)
      VALUES($1,$2,$3)
      ON CONFLICT(attendance_session_id,student_id) DO UPDATE SET status=EXCLUDED.status`,
      [session.id,item.student_id,item.present?'PRESENT':'ABSENT']);
    await client.query(`UPDATE attendance_sync_items SET status='SYNCED' WHERE id=$1`,[item.id]);synced++;
   }catch(e:any){
    await client.query(`UPDATE attendance_sync_items SET status='FAILED',error_message=$1 WHERE id=$2`,[e.message,item.id]);failed++;
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
