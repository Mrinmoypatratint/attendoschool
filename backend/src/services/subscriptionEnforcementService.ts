import {pool} from '../db';

export async function getSubscription(schoolId:string){
 const {rows}=await pool.query(`
  SELECT ss.*, sp.name AS plan_name, sp.max_students, sp.max_teachers,
         COALESCE(ss.grace_period_days,3) AS effective_grace_days
  FROM school_subscriptions ss
  LEFT JOIN subscription_plans sp ON sp.id=ss.plan_id
  WHERE ss.school_id=$1
  ORDER BY ss.end_date DESC NULLS LAST LIMIT 1`,[schoolId]);
 if(!rows.length)return null;
 const s=rows[0], now=new Date();
 const end=s.end_date?new Date(s.end_date):null;
 let status='ACTIVE';
 if(end && now>end){
   const graceEnd=new Date(end); graceEnd.setDate(graceEnd.getDate()+Number(s.effective_grace_days||3));
   status=now<=graceEnd?'GRACE':'EXPIRED';
 }
 return {...s,effective_status:status};
}

export async function checkAccess(schoolId:string,action:string){
 const s=await getSubscription(schoolId);
 if(!s) return {allowed:false,status:'NO_SUBSCRIPTION',message:'No active subscription found.'};
 if(s.effective_status==='EXPIRED' && action==='ATTENDANCE')
   return {allowed:false,status:'EXPIRED',message:'School subscription has expired. Renew to continue attendance.'};
 return {allowed:true,status:s.effective_status,subscription:s};
}

export async function enforceSubscriptions(){
 const {rows}=await pool.query(`
  SELECT ss.school_id,ss.id,ss.status,ss.end_date,COALESCE(ss.grace_period_days,3) grace_days
  FROM school_subscriptions ss
  WHERE ss.end_date IS NOT NULL`);
 let changed=0;
 for(const s of rows){
  const now=new Date(), end=new Date(s.end_date);
  const grace=new Date(end); grace.setDate(grace.getDate()+Number(s.grace_days||3));
  const next=now<=end?'ACTIVE':now<=grace?'GRACE':'EXPIRED';
  if(s.status!==next){
   await pool.query(`UPDATE school_subscriptions SET status=$1 WHERE id=$2`,[next,s.id]);
   await pool.query(`INSERT INTO subscription_events(school_id,event_type,old_status,new_status,metadata)
                     VALUES($1,'STATUS_CHANGED',$2,$3,$4)`,
                    [s.school_id,s.status,next,JSON.stringify({subscriptionId:s.id})]);
   changed++;
  }
  for(const [type,days] of [['DUE_30',30],['DUE_7',7],['DUE_1',1]] as any){
   const target=new Date(end); target.setDate(target.getDate()-days);
   if(target.toISOString().slice(0,10)===now.toISOString().slice(0,10)){
    await pool.query(`INSERT INTO subscription_renewal_reminders
      (school_id,subscription_id,reminder_type,scheduled_for)
      VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [s.school_id,s.id,type,target.toISOString().slice(0,10)]);
   }
  }
 }
 return {checked:rows.length,changed};
}

export async function subscriptionSummary(schoolId:string){
 const s=await getSubscription(schoolId);
 if(!s)return null;
 const students=await pool.query(`SELECT COUNT(*)::int count FROM students WHERE school_id=$1 AND COALESCE(is_active,TRUE)=TRUE`,[schoolId]);
 let teachers={rows:[{count:0}]};
 try{teachers=await pool.query(`SELECT COUNT(*)::int count FROM users WHERE school_id=$1 AND role='TEACHER'`,[schoolId])}catch{}
 return {...s,student_count:students.rows[0].count,teacher_count:teachers.rows[0].count};
}
