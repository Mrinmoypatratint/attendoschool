
import crypto from 'crypto';
import { pool } from '../db';

export type Gateway = 'MOCK'|'RAZORPAY';

function hmac(value:string, secret:string){
  return crypto.createHmac('sha256',secret).update(value).digest('hex');
}

export function verifyRazorpayPayment(orderId:string,paymentId:string,signature:string,secret:string){
  return hmac(`${orderId}|${paymentId}`,secret)===signature;
}

export async function createGatewayOrder(schoolId:string,days:number,amount:number,gateway:Gateway='MOCK'){
  const q=await pool.query(`SELECT ss.id subscription_id,sp.name plan_name,sp.price_monthly
    FROM school_subscriptions ss JOIN subscription_plans sp ON sp.id=ss.plan_id
    WHERE ss.school_id=$1 ORDER BY ss.end_date DESC NULLS LAST LIMIT 1`,[schoolId]);
  if(!q.rowCount) throw new Error('No subscription found for school');
  const finalAmount=Number(amount||q.rows[0].price_monthly||0);
  if(finalAmount<=0) throw new Error('Payment amount must be greater than zero');
  const orderId=`${gateway}_ORD_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await pool.query(`INSERT INTO payments(school_id,subscription_id,provider,provider_order_id,amount,currency,status)
    VALUES($1,$2,$3,$4,$5,'INR','PENDING')`,
    [schoolId,q.rows[0].subscription_id,gateway,orderId,finalAmount]);
  return {orderId,amount:finalAmount,currency:'INR',gateway,days:Number(days||30),planName:q.rows[0].plan_name};
}

export async function completePayment(orderId:string,paymentId:string){
  const q=await pool.query(`UPDATE payments SET status='PAID',provider_payment_id=$1,paid_at=NOW()
    WHERE provider_order_id=$2 AND status<>'PAID' RETURNING id,school_id,subscription_id,amount`,
    [paymentId,orderId]);
  if(!q.rowCount) throw new Error('Payment order not found or already paid');
  return q.rows[0];
}

export async function failPayment(orderId:string,reason:string){
  const q=await pool.query(`UPDATE payments SET status='FAILED',last_error=$1
    WHERE provider_order_id=$2 AND status='PENDING' RETURNING id`,[reason,orderId]);
  if(!q.rowCount) throw new Error('Pending payment order not found');
  return q.rows[0];
}
