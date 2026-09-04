
import { Router } from 'express';
import express from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { createRazorpayOrder, razorpayConfigured, verifyCheckoutSignature, verifyWebhookSignature } from '../services/razorpayService';

const r=Router();

function inv(){return `INV-${new Date().getFullYear()}-${Date.now()}`}
function rec(){return `RCT-${Date.now()}`}

r.use(requireAuth,requireRoles('SCHOOL_ADMIN'));

r.post('/razorpay/order',async(req:AuthRequest,res)=>{
 const {days=30,amount=0}=req.body||{};
 if(!razorpayConfigured()) return res.status(503).json({message:'Razorpay is not configured on the server'});
 const n=Number(amount);
 if(n<=0) return res.status(400).json({message:'Amount must be greater than zero'});
 try{
   const order=await createRazorpayOrder(n,`school-${req.user!.schoolId}-${Date.now()}`,{schoolId:req.user!.schoolId,days});
   const p=await pool.query(`SELECT id FROM school_subscriptions WHERE school_id=$1 ORDER BY end_date DESC NULLS LAST LIMIT 1`,[req.user!.schoolId]);
   await pool.query(`INSERT INTO payments(school_id,subscription_id,provider,provider_order_id,amount,currency,status,reconciliation_status)
     VALUES($1,$2,'RAZORPAY',$3,$4,'INR','PENDING','UNRECONCILED')`,
     [req.user!.schoolId,p.rows[0]?.id||null,order.id,n]);
   res.status(201).json({keyId:process.env.RAZORPAY_KEY_ID,orderId:order.id,amount:order.amount,currency:order.currency,days});
 }catch(e:any){res.status(400).json({message:e.message||'Could not create Razorpay order'})}
});

r.post('/razorpay/verify',async(req:AuthRequest,res)=>{
 const {orderId,paymentId,signature,days=30}=req.body||{};
 if(!orderId||!paymentId||!signature) return res.status(400).json({message:'orderId, paymentId and signature are required'});
 if(!razorpayConfigured()) return res.status(503).json({message:'Razorpay is not configured'});
 if(!verifyCheckoutSignature(orderId,paymentId,signature)) return res.status(400).json({message:'Invalid Razorpay signature'});
 const client=await pool.connect();
 try{
   await client.query('BEGIN');
   const p=await client.query(`SELECT * FROM payments WHERE provider_order_id=$1 AND school_id=$2 FOR UPDATE`,[orderId,req.user!.schoolId]);
   if(!p.rowCount) throw new Error('Payment order not found');
   const pay=p.rows[0];
   await client.query(`UPDATE payments SET status='PAID',provider_payment_id=$1,paid_at=NOW(),reconciliation_status='RECONCILED',reconciled_at=NOW()
     WHERE id=$2`,[paymentId,pay.id]);
   const invoice=inv(),receipt=rec(),amount=Number(pay.amount||0),rate=Number(req.body.gstRate||0);
   const taxable=rate>0?amount/(1+rate/100):amount;
   const gst=amount-taxable;
   await client.query(`UPDATE payments SET invoice_number=$1,receipt_number=$2,gst_rate=$3,taxable_amount=$4,gst_amount=$5 WHERE id=$6`,
     [invoice,receipt,rate,taxable,gst,pay.id]);
   await client.query(`INSERT INTO subscription_invoices(payment_id,school_id,invoice_number,receipt_number,amount,currency,status,paid_at,gstin,billing_address,taxable_amount,gst_rate,gst_amount)
     SELECT $1,$2,$3,$4,$5,'INR','PAID',NOW(),gstin,billing_address,$6,$7,$8 FROM schools WHERE id=$2`,
     [pay.id,req.user!.schoolId,invoice,receipt,amount,taxable,rate,gst]);
   const old=await client.query(`SELECT * FROM school_subscriptions WHERE school_id=$1 ORDER BY end_date DESC NULLS LAST LIMIT 1`,[req.user!.schoolId]);
   if(old.rowCount){
     const base=new Date(Math.max(Date.now(),new Date(old.rows[0].end_date).getTime()));
     base.setUTCDate(base.getUTCDate()+Math.max(1,Number(days)));
     await client.query(`INSERT INTO school_subscriptions(school_id,plan_id,start_date,end_date,status)
       VALUES($1,$2,GREATEST(CURRENT_DATE,$3::date),$4,'ACTIVE')`,
       [req.user!.schoolId,old.rows[0].plan_id,old.rows[0].end_date,base.toISOString().slice(0,10)]);
     await client.query(`UPDATE schools SET status='ACTIVE' WHERE id=$1`,[req.user!.schoolId]);
   }
   await client.query('COMMIT');
   res.json({ok:true,invoiceNumber:invoice,receiptNumber:receipt});
 }catch(e:any){await client.query('ROLLBACK');res.status(400).json({message:e.message||'Payment verification failed'})}
 finally{client.release()}
});

export default r;
