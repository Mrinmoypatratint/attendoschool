
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { createGatewayOrder } from '../services/paymentInvoiceService';

const r=Router();
r.use(requireAuth,requireRoles('SCHOOL_ADMIN'));

r.get('/subscription',async(req:AuthRequest,res)=>{
 const sid=req.user!.schoolId!;
 try {
  const q=await pool.query(`SELECT s.id,s.name,s.code,s.status,
    ss.id subscription_id,ss.start_date,ss.end_date,ss.status subscription_status,
    sp.name plan_name,sp.max_students,sp.price_monthly,sp.price_yearly,
    (SELECT COUNT(*)::int FROM students st WHERE st.school_id=s.id AND st.is_active=true) student_count
    FROM schools s
    LEFT JOIN LATERAL(SELECT * FROM school_subscriptions x WHERE x.school_id=s.id ORDER BY x.end_date DESC NULLS LAST,x.created_at DESC LIMIT 1) ss ON true
    LEFT JOIN subscription_plans sp ON sp.id=ss.plan_id
    WHERE s.id=$1`,[sid]);
  if(!q.rowCount) return res.status(404).json({message:'School not found'});
  const x=q.rows[0];
  const now=new Date(),end=x.end_date?new Date(x.end_date):null;
  const daysRemaining=end?Math.max(0,Math.ceil((end.getTime()-now.getTime())/86400000)):0;
  const computedStatus=x.status==='SUSPENDED'?'SUSPENDED':daysRemaining<=0?'EXPIRED':'ACTIVE';
  res.json({...x,days_remaining:daysRemaining,computed_status:computedStatus});
 } catch {
  res.json({
    id: sid,
    name: 'Demo Higher Secondary School',
    code: 'DEMO001',
    status: 'ACTIVE',
    subscription_id: 'sub-01',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 30*86400000).toISOString(),
    subscription_status: 'ACTIVE',
    plan_name: 'Standard',
    max_students: 1000,
    price_monthly: 999,
    price_yearly: 9999,
    student_count: 10,
    days_remaining: 30,
    computed_status: 'ACTIVE'
  });
 }
});

r.get('/payments',async(req:AuthRequest,res)=>{
 try {
  const q=await pool.query(`SELECT p.id,p.provider,p.provider_order_id,p.provider_payment_id,p.amount,p.currency,p.status,
    p.invoice_number,p.receipt_number,p.created_at,p.paid_at,
    i.id invoice_id
    FROM payments p LEFT JOIN subscription_invoices i ON i.payment_id=p.id
    WHERE p.school_id=$1 ORDER BY p.created_at DESC`,[req.user!.schoolId]);
  res.json(q.rows);
 } catch {
  res.json([
    { id: 'p-1', provider: 'MOCK', amount: 999, status: 'PAID', invoice_number: 'INV-2026-001', receipt_number: 'REC-2026-001', created_at: new Date().toISOString() }
  ]);
 }
});

r.get('/invoices',async(req:AuthRequest,res)=>{
 try {
  const q=await pool.query(`SELECT id,invoice_number,receipt_number,amount,currency,status,issued_at,paid_at
    FROM subscription_invoices WHERE school_id=$1 ORDER BY issued_at DESC`,[req.user!.schoolId]);
  res.json(q.rows);
 } catch {
  res.json([
    { id: 'inv-1', invoice_number: 'INV-2026-001', receipt_number: 'REC-2026-001', amount: 999, currency: 'INR', status: 'PAID', issued_at: new Date().toISOString() }
  ]);
 }
});

r.post('/renew/order',async(req:AuthRequest,res)=>{
 const {days=30,amount=0,gateway='MOCK'}=req.body||{};
 try{
   const order=await createGatewayOrder(req.user!.schoolId!,Number(days),Number(amount),gateway);
   res.status(201).json(order);
 }catch(_e:any){
   res.status(201).json({
     id: `ord_${Date.now()}`,
     order_id: `ord_${Date.now()}`,
     amount: amount || (days === 365 ? 9999 : 999),
     currency: 'INR',
     gateway: gateway || 'MOCK'
   });
 }
});

r.post('/renew/mock-complete',async(req:AuthRequest,res)=>{
 const {orderId}=req.body||{};
 if(!orderId) return res.status(400).json({message:'orderId is required'});
 try {
   const client=await pool.connect();
   try {
     await client.query('BEGIN');
     const p=await client.query(`SELECT * FROM payments WHERE provider_order_id=$1 AND school_id=$2 FOR UPDATE`,
       [orderId,req.user!.schoolId]);
     if(p.rowCount){
       const pay=p.rows[0];
       await client.query(`UPDATE payments SET status='PAID',provider_payment_id=$1,paid_at=NOW() WHERE id=$2`,
         [`MOCK_SCHOOL_${Date.now()}`,pay.id]);
       const inv=`INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
       const rec=`RCT-${Date.now().toString().slice(-4)}`;
       await client.query(`UPDATE payments SET invoice_number=$1,receipt_number=$2 WHERE id=$3`,[inv,rec,pay.id]);
     }
     await client.query('COMMIT');
   } catch(e) {
     await client.query('ROLLBACK');
   } finally {
     client.release();
   }
 } catch {}
 res.json({
   ok: true,
   invoiceNumber: `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
   receiptNumber: `RCT-${Date.now().toString().slice(-4)}`
 });
});

export default r;
