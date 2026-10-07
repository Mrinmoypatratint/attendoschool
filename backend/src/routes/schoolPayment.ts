
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { createGatewayOrder } from '../services/paymentInvoiceService';
import { collections, isFirebaseConfigured } from '../firebase';

const r = Router();
r.use(requireAuth, requireRoles('SCHOOL_ADMIN'));

r.get('/plans', async (_req, res) => {
  try {
    const q = await pool.query(`SELECT id,name,max_students,price_monthly,price_yearly,is_active FROM subscription_plans WHERE is_active=true ORDER BY price_monthly`);
    res.json(q.rows.map(r => ({ ...r, discount_percentage: 0 })));
  } catch {
    res.json([
      { id: 'plan-basic', name: 'Basic', max_students: 300, price_monthly: 499, price_yearly: 499 * 12, discount_percentage: 0, is_active: true },
      { id: 'plan-standard', name: 'Standard', max_students: 1000, price_monthly: 999, price_yearly: 999 * 12, discount_percentage: 0, is_active: true },
      { id: 'plan-enterprise', name: 'Enterprise', max_students: 5000, price_monthly: 1999, price_yearly: 1999 * 12, discount_percentage: 0, is_active: true }
    ]);
  }
});

r.get('/subscription', async (req: AuthRequest, res) => {
  const sid = req.user!.schoolId!;

  if (isFirebaseConfigured()) {
    try {
      const schoolDoc = await collections.schools().doc(sid).get();
      if (schoolDoc.exists) {
        const sData = schoolDoc.data() || {};
        const pId = sData.planId || 'plan-standard';
        let planData: any = null;
        try {
          const planDoc = await collections.subscriptionPlans().doc(pId).get();
          if (planDoc.exists) planData = planDoc.data();
          else {
            const allPlans = await collections.subscriptionPlans().get();
            const matched = allPlans.docs.find(p => p.id.toLowerCase() === pId.toLowerCase() || (p.data().name && p.data().name.toLowerCase() === String(sData.planName || '').toLowerCase()));
            if (matched) planData = matched.data();
          }
        } catch {}

        const now = new Date();
        const end = sData.subscriptionEnd ? new Date(sData.subscriptionEnd) : null;
        const daysRemaining = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000)) : 0;
        const computedStatus = sData.status === 'SUSPENDED' ? 'SUSPENDED' : daysRemaining <= 0 ? 'EXPIRED' : 'ACTIVE';
        const monthly = Number(planData?.price_monthly ?? planData?.priceMonthly ?? 999);
        const yearly = Number(planData?.price_yearly ?? planData?.priceYearly ?? monthly * 12);
        const discount = Number(planData?.discount_percentage ?? planData?.discountPercentage ?? 0);

        let studentCount = 0;
        try {
          const studentsSnap = await collections.students().where('schoolId', '==', sid).get();
          studentCount = studentsSnap.size;
        } catch {}

        return res.json({
          id: sid,
          name: sData.name || 'School',
          code: sData.code || 'GIS',
          status: sData.status || 'ACTIVE',
          subscription_id: `sub-${sid.slice(0, 8)}`,
          start_date: sData.subscriptionStart || now.toISOString().slice(0, 10),
          end_date: sData.subscriptionEnd || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
          subscription_status: sData.status || 'ACTIVE',
          plan_name: planData?.name || sData.planName || 'Standard',
          max_students: Number(planData?.max_students ?? planData?.maxStudents ?? sData.maxStudents ?? 1000),
          price_monthly: monthly,
          price_yearly: yearly,
          discount_percentage: discount,
          student_count: studentCount,
          days_remaining: daysRemaining,
          computed_status: computedStatus
        });
      }
    } catch (fbErr) {
      console.warn('[Firestore] schoolPayment subscription error:', fbErr);
    }
  }

  try {
    const q = await pool.query(`SELECT s.id,s.name,s.code,s.status,
      ss.id subscription_id,ss.start_date,ss.end_date,ss.status subscription_status,
      sp.name plan_name,sp.max_students,sp.price_monthly,sp.price_yearly,
      (SELECT COUNT(*)::int FROM students st WHERE st.school_id=s.id AND st.is_active=true) student_count
      FROM schools s
      LEFT JOIN LATERAL(SELECT * FROM school_subscriptions x WHERE x.school_id=s.id ORDER BY x.end_date DESC NULLS LAST,x.created_at DESC LIMIT 1) ss ON true
      LEFT JOIN subscription_plans sp ON sp.id=ss.plan_id
      WHERE s.id=$1`, [sid]);
    if (!q.rowCount) return res.status(404).json({ message: 'School not found' });
    const x = q.rows[0];
    const now = new Date(), end = x.end_date ? new Date(x.end_date) : null;
    const daysRemaining = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000)) : 0;
    const computedStatus = x.status === 'SUSPENDED' ? 'SUSPENDED' : daysRemaining <= 0 ? 'EXPIRED' : 'ACTIVE';
    res.json({ ...x, discount_percentage: 0, days_remaining: daysRemaining, computed_status: computedStatus });
  } catch {
    res.json({
      id: sid,
      name: 'Demo Higher Secondary School',
      code: 'DEMO001',
      status: 'ACTIVE',
      subscription_id: 'sub-01',
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
      subscription_status: 'ACTIVE',
      plan_name: 'Standard',
      max_students: 1000,
      price_monthly: 999,
      price_yearly: 999 * 12,
      discount_percentage: 0,
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
