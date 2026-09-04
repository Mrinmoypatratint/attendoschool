
import crypto from 'crypto';
import {pool} from '../db';

export async function claim(provider:string,eventId:string,rawBody:string){
 const hash=crypto.createHash('sha256').update(rawBody).digest('hex');
 const r=await pool.query(`
 INSERT INTO webhook_events_v27(provider,event_id,payload_hash,status)
 VALUES($1,$2,$3,'PROCESSING')
 ON CONFLICT(provider,event_id) DO NOTHING
 RETURNING *`,[provider,eventId,hash]);
 if(!r.rows[0]){
  const old=await pool.query(`SELECT * FROM webhook_events_v27 WHERE provider=$1 AND event_id=$2`,[provider,eventId]);
  return {duplicate:true,event:old.rows[0]};
 }
 return {duplicate:false,event:r.rows[0]};
}
export async function complete(id:string,status='PROCESSED'){
 await pool.query(`UPDATE webhook_events_v27 SET status=$1,processed_at=NOW() WHERE id=$2`,[status,id]);
}
