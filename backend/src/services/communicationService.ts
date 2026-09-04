import {pool} from '../db';

export async function createAnnouncement(schoolId:string,userId:string,d:any){
 if(!d.title||!d.message)throw new Error('Title and message are required');
 const audience=d.audienceType||'SCHOOL';
 if(!['SCHOOL','CLASS','SECTION','PARENTS'].includes(audience))throw new Error('Invalid audience');
 const {rows}=await pool.query(`INSERT INTO announcements
 (school_id,created_by,title,message,audience_type,class_id,section_id,priority,scheduled_at,expires_at,status)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $10 IS NOT NULL THEN 'SCHEDULED' ELSE 'DRAFT' END)
 RETURNING *`,
 [schoolId,userId,d.title,d.message,audience,d.classId||null,d.sectionId||null,d.priority||'NORMAL',d.scheduledAt||null,d.expiresAt||null]);
 return rows[0];
}

export async function publishAnnouncement(schoolId:string,id:string){
 const a=(await pool.query(`SELECT * FROM announcements WHERE id=$1 AND school_id=$2`,[id,schoolId])).rows[0];
 if(!a)throw new Error('Announcement not found');
 const {rows}=await pool.query(`UPDATE announcements SET status='PUBLISHED',published_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *`,[id]);
 await createRecipients(schoolId,id);
 return rows[0];
}

async function createRecipients(schoolId:string,announcementId:string){
 const a=(await pool.query(`SELECT * FROM announcements WHERE id=$1 AND school_id=$2`,[announcementId,schoolId])).rows[0];
 let q=`SELECT DISTINCT u.id AS parent_user_id, l.student_id
        FROM parent_student_links l JOIN users u ON u.id=l.parent_user_id
        WHERE u.school_id=$1 AND u.role='PARENT'`;
 const vals:any[]=[schoolId];
 if(a.audience_type==='CLASS'){vals.push(a.class_id);q+=` AND l.student_id IN (SELECT id FROM students WHERE class_id=$${vals.length})`}
 if(a.audience_type==='SECTION'){vals.push(a.section_id);q+=` AND l.student_id IN (SELECT id FROM students WHERE section_id=$${vals.length})`}
 const recipients=(await pool.query(q,vals)).rows;
 for(const r of recipients){
  await pool.query(`INSERT INTO announcement_recipients(announcement_id,parent_user_id,student_id,delivery_channel)
   VALUES($1,$2,$3,'IN_APP') ON CONFLICT DO NOTHING`,[announcementId,r.parent_user_id,r.student_id]);
 }
 return recipients.length;
}

export async function listSchoolAnnouncements(schoolId:string){
 return (await pool.query(`SELECT a.*,u.name created_by_name,
 (SELECT COUNT(*) FROM announcement_recipients r WHERE r.announcement_id=a.id)::int recipient_count,
 (SELECT COUNT(*) FROM announcement_recipients r WHERE r.announcement_id=a.id AND r.read_at IS NOT NULL)::int read_count
 FROM announcements a LEFT JOIN users u ON u.id=a.created_by WHERE a.school_id=$1
 ORDER BY COALESCE(a.published_at,a.scheduled_at,a.created_at) DESC`,[schoolId])).rows;
}

export async function parentInbox(parentUserId:string,schoolId:string){
 return (await pool.query(`SELECT a.id,a.title,a.message,a.priority,a.published_at,a.expires_at,
 r.id recipient_id,r.student_id,r.delivery_channel,r.delivery_status,r.delivered_at,r.read_at
 FROM announcement_recipients r JOIN announcements a ON a.id=r.announcement_id
 WHERE r.parent_user_id=$1 AND a.school_id=$2 AND a.status='PUBLISHED'
 AND (a.expires_at IS NULL OR a.expires_at>NOW())
 ORDER BY a.priority='EMERGENCY' DESC,a.published_at DESC`,[parentUserId,schoolId])).rows;
}

export async function markRead(parentUserId:string,recipientId:string){
 const {rows}=await pool.query(`UPDATE announcement_recipients SET read_at=COALESCE(read_at,NOW()),delivery_status='READ'
 WHERE id=$1 AND parent_user_id=$2 RETURNING *`,[recipientId,parentUserId]);
 if(!rows.length)throw new Error('Message not found');return rows[0];
}

export async function preferences(parentUserId:string,schoolId:string){
 const {rows}=await pool.query(`INSERT INTO communication_preferences(parent_user_id,school_id)
 VALUES($1,$2) ON CONFLICT(parent_user_id,school_id) DO UPDATE SET updated_at=communication_preferences.updated_at
 RETURNING *`,[parentUserId,schoolId]);return rows[0];
}
export async function updatePreferences(parentUserId:string,schoolId:string,d:any){
 const {rows}=await pool.query(`INSERT INTO communication_preferences
 (parent_user_id,school_id,in_app_enabled,sms_enabled,whatsapp_enabled,email_enabled,emergency_override)
 VALUES($1,$2,$3,$4,$5,$6,$7)
 ON CONFLICT(parent_user_id,school_id) DO UPDATE SET in_app_enabled=$3,sms_enabled=$4,whatsapp_enabled=$5,email_enabled=$6,emergency_override=$7,updated_at=NOW()
 RETURNING *`,[parentUserId,schoolId,d.inAppEnabled!==false,d.smsEnabled!==false,d.whatsappEnabled!==false,d.emailEnabled!==false,d.emergencyOverride!==false]);
 return rows[0];
}

export async function processScheduled(){
 const {rows}=await pool.query(`SELECT id,school_id FROM announcements WHERE status='SCHEDULED' AND scheduled_at<=NOW() AND (expires_at IS NULL OR expires_at>NOW())`);
 for(const a of rows)await publishAnnouncement(a.school_id,a.id);
 return {published:rows.length};
}

export async function deliverySummary(schoolId:string){
 const {rows}=await pool.query(`SELECT channel,status,COUNT(*)::int count FROM communication_delivery_logs
 WHERE school_id=$1 GROUP BY channel,status ORDER BY channel,status`,[schoolId]);return rows;
}
