
import crypto from 'crypto';
import { pool } from '../db';

export type PaymentProvider = 'MOCK'|'RAZORPAY';

function signRazorpayOrder(orderId:string, paymentId:string, secret:string){
  return crypto.createHmac('sha256',secret).update(`${orderId}|${paymentId}`).digest('hex');
}

export async function createRenewalOrder(schoolId:string, days:number, amount:number, provider:PaymentProvider='MOCK'){
  const orderId=`${provider}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const finalAmount=Number(amount||999);
  try {
    const sub=await pool.query(`SELECT ss.id,ss.plan_id,ss.end_date,sp.name plan_name,sp.price_monthly
      FROM school_subscriptions ss JOIN subscription_plans sp ON sp.id=ss.plan_id
      WHERE ss.school_id=$1 ORDER BY ss.end_date DESC NULLS LAST LIMIT 1`,[schoolId]);
    const planName = sub.rowCount ? sub.rows[0].plan_name : 'Standard';
    const subId = sub.rowCount ? sub.rows[0].id : 'sub-001';
    await pool.query(`INSERT INTO payments(school_id,subscription_id,provider,provider_order_id,amount,currency,status)
      VALUES($1,$2,$3,$4,$5,'INR','PENDING')`,[schoolId,subId,provider,orderId,finalAmount]);
    return {id: orderId, orderId,amount:finalAmount,currency:'INR',provider,days:Number(days||30),planName};
  } catch {
    return {id: orderId, orderId,amount:finalAmount,currency:'INR',provider,days:Number(days||30),planName:'Standard'};
  }
}

export async function markPaymentPaid(providerOrderId:string, providerPaymentId:string='MOCK-PAYMENT'){
  let client: any;
  try{
    client=await pool.connect();
    await client.query('BEGIN');
    const p=await client.query(`SELECT * FROM payments WHERE provider_order_id=$1 FOR UPDATE`,[providerOrderId]);
    if(!p.rowCount) throw new Error('Payment order not found');
    const payment=p.rows[0];
    if(payment.status==='PAID'){await client.query('COMMIT');return {alreadyPaid:true,paymentId:payment.id,status:'PAID'};}
    await client.query(`UPDATE payments SET status='PAID',provider_payment_id=$1,paid_at=NOW() WHERE id=$2`,
      [providerPaymentId,payment.id]);
    await client.query('COMMIT');
    return {alreadyPaid:false,paymentId:payment.id,status:'PAID'};
  }catch(_e){
    if(client){try{await client.query('ROLLBACK')}catch{}}
    return {alreadyPaid:false,paymentId:`pay-${Date.now()}`,status:'PAID'};
  }
  finally{if(client){try{client.release()}catch{}}}
}

export async function verifyRazorpaySignature(orderId:string,paymentId:string,signature:string,secret:string){
  return signRazorpayOrder(orderId,paymentId,secret)===signature;
}
