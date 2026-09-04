import { pool } from '../db';

type SmsProviderResult={success:boolean;providerMessageId?:string;error?:string};

async function mockProvider(to:string,message:string):Promise<SmsProviderResult>{
  console.log(`[MOCK SMS] ${to}: ${message}`);
  return {success:true,providerMessageId:`mock-${Date.now()}-${Math.random().toString(36).slice(2,8)}`};
}

async function httpProvider(to:string,message:string):Promise<SmsProviderResult>{
  const url=process.env.SMS_PROVIDER_URL;
  const key=process.env.SMS_PROVIDER_API_KEY;
  if(!url||!key) return {success:false,error:'SMS provider is not configured'};
  try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
      body:JSON.stringify({to,message,senderId:process.env.SMS_SENDER_ID||undefined})});
    const body:any=await response.json().catch(()=>({}));
    if(!response.ok) return {success:false,error:body?.message||`Provider returned ${response.status}`};
    return {success:true,providerMessageId:body?.messageId||body?.id||undefined};
  }catch(e:any){return {success:false,error:e?.message||'Provider request failed'}};
}

export async function sendSms(provider:string,to:string,message:string){
  if(provider==='mock') return mockProvider(to,message);
  return httpProvider(to,message);
}

export async function queueAbsentSms(sessionId:string){
  const sessionQ=await pool.query(
    `SELECT a.id,a.school_id,a.class_id,a.section_id,a.subject_id,a.teacher_id,
            a.attendance_date,a.start_time,a.end_time,
            c.class_number,sec.name section_name,u.name teacher_name,
            sch.name school_name,sch.enquiry_number,
            COALESCE(ns.sms_enabled,true) sms_enabled,
            COALESCE(ns.provider,'mock') provider,
            COALESCE(ns.template,'Dear Parent, {student_name} was absent from {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.') template
     FROM attendance_sessions a
     JOIN classes c ON c.id=a.class_id
     JOIN sections sec ON sec.id=a.section_id
     JOIN users u ON u.id=a.teacher_id
     JOIN schools sch ON sch.id=a.school_id
     LEFT JOIN school_notification_settings ns ON ns.school_id=a.school_id
     WHERE a.id=$1`,[sessionId]);
  const s=sessionQ.rows[0];
  if(!s||!s.sms_enabled) return {queued:0,skipped:true};

  const students=await pool.query(
    `SELECT st.id,st.name,st.parent_sms_number,ar.is_present
     FROM attendance_records ar JOIN students st ON st.id=ar.student_id
     WHERE ar.attendance_session_id=$1 AND ar.is_present=false`,[sessionId]);

  let queued=0;
  for(const st of students.rows){
    const values:Record<string,string>={
      student_name:st.name,
      class_name:`Class ${s.class_number}`,
      section:s.section_name,
      time:`${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}`,
      teacher_name:s.teacher_name,
      enquiry_number:s.enquiry_number||'School Office'
    };
    let message=s.template;
    for(const [key,val] of Object.entries(values)) message=message.replaceAll(`{${key}}`,val);
    await pool.query(
      `INSERT INTO sms_logs(school_id,student_id,attendance_session_id,parent_number,message,provider,status)
       VALUES($1,$2,$3,$4,$5,$6,'QUEUED')`,
      [s.school_id,st.id,sessionId,st.parent_sms_number,message,s.provider]
    );
    queued++;
  }
  return {queued,skipped:false};
}

export async function processSmsQueue(limit=20){
  const q=await pool.query(
    `SELECT * FROM sms_logs
     WHERE status IN ('QUEUED','FAILED') AND attempts < 3
     ORDER BY created_at LIMIT $1`,[limit]);
  let sent=0,failed=0;
  for(const row of q.rows){
    await pool.query(`UPDATE sms_logs SET status='PROCESSING',attempts=attempts+1 WHERE id=$1`,[row.id]);
    const result=await sendSms(row.provider,row.parent_number,row.message);
    if(result.success){
      await pool.query(
        `UPDATE sms_logs SET status='SENT',provider_message_id=$2,sent_at=NOW(),last_error=NULL WHERE id=$1`,
        [row.id,result.providerMessageId||null]);
      sent++;
    }else{
      await pool.query(
        `UPDATE sms_logs SET status='FAILED',last_error=$2 WHERE id=$1`,
        [row.id,result.error||'Unknown SMS error']);
      failed++;
    }
  }
  return {processed:q.rows.length,sent,failed};
}
