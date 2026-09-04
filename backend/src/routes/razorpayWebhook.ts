
import { Router } from 'express';
import express from 'express';
import { pool } from '../db';
import { verifyWebhookSignature } from '../services/razorpayService';

const r=Router();

r.post('/razorpay/webhook',express.raw({type:'application/json'}),async(req,res)=>{
 const signature=String(req.headers['x-razorpay-signature']||'');
 const eventId=String(req.headers['x-razorpay-event-id']||'');
 const raw=Buffer.isBuffer(req.body)?req.body.toString('utf8'):JSON.stringify(req.body||{});
 if(!signature) return res.status(400).json({message:'Missing Razorpay webhook signature'});
 if(!verifyWebhookSignature(raw,signature)) return res.status(400).json({message:'Invalid webhook signature'});
 let body:any={};try{body=JSON.parse(raw)}catch{return res.status(400).json({message:'Invalid JSON'})}
 if(eventId){
   const dup=await pool.query('SELECT id FROM payments WHERE webhook_event_id=$1',[eventId]);
   if(dup.rowCount) return res.json({ok:true,duplicate:true});
 }
 const event=body.event;
 const entity=body?.payload?.payment?.entity;
 const orderId=entity?.order_id;
 const paymentId=entity?.id;
 if(event==='payment.captured' && orderId){
   const p=await pool.query(`UPDATE payments SET status='PAID',provider_payment_id=COALESCE(provider_payment_id,$1),
      paid_at=COALESCE(paid_at,NOW()),reconciliation_status='RECONCILED',reconciled_at=NOW(),webhook_event_id=$2,gateway_payload=$3
      WHERE provider_order_id=$4 RETURNING id,school_id,amount`,
      [paymentId,eventId,JSON.stringify(body),orderId]);
   if(p.rowCount){
     const invoice=`INV-${new Date().getFullYear()}-${Date.now()}`;
     const receipt=`RCT-${Date.now()}`;
     await pool.query(`UPDATE payments SET invoice_number=$1,receipt_number=$2 WHERE id=$3 AND invoice_number IS NULL`,
       [invoice,receipt,p.rows[0].id]);
     await pool.query(`INSERT INTO subscription_invoices(payment_id,school_id,invoice_number,receipt_number,amount,currency,status,paid_at)
       SELECT $1,$2,$3,$4,$5,'INR','PAID',NOW()
       WHERE NOT EXISTS(SELECT 1 FROM subscription_invoices WHERE payment_id=$1)`,
       [p.rows[0].id,p.rows[0].school_id,invoice,receipt,p.rows[0].amount]);
   }
 } else if(event==='payment.failed' && orderId){
   await pool.query(`UPDATE payments SET status='FAILED',failure_reason=$1,webhook_event_id=$2,gateway_payload=$3 WHERE provider_order_id=$4`,
     [entity?.error_description||'Payment failed',eventId,JSON.stringify(body),orderId]);
 }
 res.json({ok:true});
});
export default r;
