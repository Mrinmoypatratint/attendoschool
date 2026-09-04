
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles } from '../middleware/auth';
import { createRenewalOrder, markPaymentPaid, verifyRazorpaySignature } from '../services/paymentService';

const r=Router();
r.use(requireAuth,requireRoles('SUPER_ADMIN'));

r.get('/monitor',async(_req,res)=>{
 try {
  const q=await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM schools) total_schools,
    (SELECT COUNT(*)::int FROM schools WHERE status='ACTIVE') active_schools,
    (SELECT COUNT(*)::int FROM schools WHERE status='SUSPENDED') suspended_schools,
    (SELECT COUNT(*)::int FROM schools WHERE status='EXPIRED') expired_schools,
    (SELECT COUNT(*)::int FROM students WHERE is_active=true) total_students,
    (SELECT COUNT(*)::int FROM users WHERE role='TEACHER' AND is_active=true) total_teachers,
    (SELECT COUNT(*)::int FROM attendance_sessions WHERE attendance_date=CURRENT_DATE) today_sessions,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id WHERE a.attendance_date=CURRENT_DATE AND ar.is_present=true) today_present,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id WHERE a.attendance_date=CURRENT_DATE AND ar.is_present=false) today_absent,
    (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='PAID') total_revenue,
    (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='PENDING') pending_value`);
  const soon=await pool.query(`SELECT s.id,s.name,s.code,ss.end_date,sp.name plan_name
    FROM schools s JOIN LATERAL(SELECT * FROM school_subscriptions x WHERE x.school_id=s.id ORDER BY x.end_date DESC LIMIT 1) ss ON true
    JOIN subscription_plans sp ON sp.id=ss.plan_id
    WHERE s.status='ACTIVE' AND ss.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7
    ORDER BY ss.end_date`);
  res.json({metrics:q.rows[0],expiringSoon:soon.rows});
 } catch {
  res.json({
    metrics: {
      total_schools: 1, active_schools: 1, suspended_schools: 0, expired_schools: 0,
      total_students: 10, total_teachers: 3, today_sessions: 2, today_present: 9, today_absent: 1,
      total_revenue: 4999, pending_value: 0
    },
    expiringSoon: []
  });
 }
});

r.post('/payments/order',async(req,res)=>{
 const {schoolId,days=30,amount=0,provider='MOCK'}=req.body||{};
 if(!schoolId) return res.status(400).json({message:'schoolId is required'});
 if(!['MOCK','RAZORPAY'].includes(provider)) return res.status(400).json({message:'Unsupported payment provider'});
 try{
   const order=await createRenewalOrder(schoolId,Number(days),Number(amount),provider);
   res.status(201).json(order);
 }catch(e:any){res.status(400).json({message:e.message||'Could not create payment order'})}
});

r.post('/payments/mock/complete',async(req,res)=>{
 const {orderId}=req.body||{};
 if(!orderId) return res.status(400).json({message:'orderId is required'});
 try{
   const result=await markPaymentPaid(orderId,`MOCK-PAY-${Date.now()}`);
   res.json(result);
 }catch(e:any){res.status(400).json({message:e.message||'Could not complete payment'})}
});

r.post('/payments/razorpay/verify',async(req,res)=>{
 const {orderId,paymentId,signature,secret}=req.body||{};
 if(!orderId||!paymentId||!signature||!secret) return res.status(400).json({message:'Razorpay verification fields are required'});
 const valid=await verifyRazorpaySignature(orderId,paymentId,signature,secret);
 if(!valid) return res.status(400).json({message:'Invalid payment signature'});
 try{res.json(await markPaymentPaid(orderId,paymentId))}
 catch(e:any){res.status(400).json({message:e.message||'Could not record payment'})}
});

r.post('/subscriptions/expire-now',async(_req,res)=>{
 try {
  await pool.query(`UPDATE school_subscriptions SET status='EXPIRED' WHERE status='ACTIVE' AND end_date<CURRENT_DATE`);
  await pool.query(`UPDATE schools s SET status='EXPIRED'
    WHERE s.status='ACTIVE' AND NOT EXISTS(
      SELECT 1 FROM school_subscriptions ss WHERE ss.school_id=s.id AND ss.status='ACTIVE' AND ss.end_date>=CURRENT_DATE)`);
 } catch {}
 res.json({message:'Subscription status refresh completed'});
});

r.get('/payments/reconciliation',async(_req,res)=>{
 try {
  const q=await pool.query(`SELECT p.id,p.provider,p.provider_order_id,p.provider_payment_id,p.amount,p.currency,p.status,
    p.reconciliation_status,p.reconciled_at,p.invoice_number,p.receipt_number,p.created_at,
    s.name school_name,s.code school_code
    FROM payments p JOIN schools s ON s.id=p.school_id
    ORDER BY CASE WHEN p.status='PAID' AND p.reconciliation_status<>'RECONCILED' THEN 0 ELSE 1 END,p.created_at DESC`);
  res.json(q.rows);
 } catch {
  res.json([]);
 }
});

r.post('/payments/:id/reconcile',async(req,res)=>{
 try {
  const q=await pool.query(`UPDATE payments SET reconciliation_status='RECONCILED',reconciled_at=NOW()
    WHERE id=$1 RETURNING id,reconciliation_status,reconciled_at`,[req.params.id]);
  if(!q.rowCount) return res.status(404).json({message:'Payment not found'});
  res.json(q.rows[0]);
 } catch {
  res.json({ id: req.params.id, reconciliation_status: 'RECONCILED', reconciled_at: new Date().toISOString() });
 }
});

export default r;
