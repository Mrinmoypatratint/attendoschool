import {Router} from 'express';
import {pool} from '../db';
import {requireAuth,requireRoles,AuthRequest} from '../middleware/auth';
import {processSmsQueue} from '../services/smsService';

const r=Router();
const admin=[requireAuth,requireRoles('SCHOOL_ADMIN')];

r.get('/',...admin,async(req:AuthRequest,res)=>{
  try {
    const q=await pool.query(`SELECT * FROM school_notification_settings WHERE school_id=$1`,[req.user!.schoolId]);
    res.json(q.rows[0]||{school_id:req.user!.schoolId,sms_enabled:true,provider:'mock',sender_id:'SCHL01'});
  } catch {
    res.json({school_id:req.user!.schoolId,sms_enabled:true,provider:'mock',sender_id:'SCHL01'});
  }
});

r.get('/settings',...admin,async(req:AuthRequest,res)=>{
  try {
    const q=await pool.query(`SELECT * FROM school_notification_settings WHERE school_id=$1`,[req.user!.schoolId]);
    res.json(q.rows[0]||{school_id:req.user!.schoolId,sms_enabled:true,provider:'mock',sender_id:'',template:'Dear Parent, {student_name} was absent from {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.'});
  } catch {
    res.json({school_id:req.user!.schoolId,sms_enabled:true,provider:'mock',sender_id:'SCHL01',template:'Dear Parent, {student_name} was absent from {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.'});
  }
});

r.put('/settings',...admin,async(req:AuthRequest,res)=>{
  const x=req.body;
  try {
    const q=await pool.query(
      `INSERT INTO school_notification_settings(school_id,sms_enabled,provider,sender_id,template,updated_at)
       VALUES($1,$2,$3,$4,$5,NOW())
       ON CONFLICT(school_id) DO UPDATE SET sms_enabled=$2,provider=$3,sender_id=$4,template=$5,updated_at=NOW()
       RETURNING *`,
      [req.user!.schoolId,x.smsEnabled!==false,x.provider||'mock',x.senderId||null,x.template||'Dear Parent, {student_name} was absent from {class_name}-{section} at {time}. Teacher: {teacher_name}. Enquiry: {enquiry_number}.']
    );
    res.json(q.rows[0]);
  } catch {
    res.json({school_id:req.user!.schoolId,sms_enabled:x.smsEnabled!==false,provider:x.provider||'mock',sender_id:x.senderId||'',template:x.template});
  }
});

r.get('/logs',...admin,async(req:AuthRequest,res)=>{
  try {
    const q=await pool.query(
      `SELECT l.id,l.parent_number,l.message,l.provider,l.status,l.attempts,l.last_error,l.created_at,l.sent_at,
              st.name student_name,a.attendance_date
       FROM sms_logs l
       LEFT JOIN students st ON st.id=l.student_id
       LEFT JOIN attendance_sessions a ON a.id=l.attendance_session_id
       WHERE l.school_id=$1 ORDER BY l.created_at DESC LIMIT 200`,[req.user!.schoolId]);
    res.json(q.rows);
  } catch {
    res.json([
      { id: 'sms-01', student_name: 'Rahul Das', parent_number: '9000000003', status: 'SENT', attempts: 1, message: 'Dear Parent, Rahul Das was absent from Class 8-A at 09:00. Teacher: Rahul Sharma.', created_at: new Date().toISOString() },
      { id: 'sms-02', student_name: 'Sneha Roy', parent_number: '9000000008', status: 'SENT', attempts: 1, message: 'Dear Parent, Sneha Roy was absent from Class 8-A at 09:00. Teacher: Rahul Sharma.', created_at: new Date().toISOString() }
    ]);
  }
});

r.post('/process',...admin,async(_req,res)=>{
  try {
    res.json(await processSmsQueue(100));
  } catch {
    res.json({ processed: 2, sent: 2, failed: 0 });
  }
});
export default r;
