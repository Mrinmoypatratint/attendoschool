
import crypto from 'crypto';
import { env } from '../config/env';

function authHeader(){
 const raw=`${env.razorpayKeyId}:${env.razorpayKeySecret}`;
 return `Basic ${Buffer.from(raw).toString('base64')}`;
}

export function razorpayConfigured(){
 return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

export async function createRazorpayOrder(amountInr:number,receipt:string,notes:any={}){
 if(!razorpayConfigured()) throw new Error('Razorpay is not configured');
 const response=await fetch('https://api.razorpay.com/v1/orders',{
   method:'POST',
   headers:{Authorization:authHeader(),'Content-Type':'application/json'},
   body:JSON.stringify({amount:Math.round(amountInr*100),currency:'INR',receipt,notes})
 });
 const data:any=await response.json();
 if(!response.ok) throw new Error(data?.error?.description||'Razorpay order creation failed');
 return data;
}

export function verifyCheckoutSignature(orderId:string,paymentId:string,signature:string){
 const expected=crypto.createHmac('sha256',env.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
 return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
}

export function verifyWebhookSignature(rawBody:string,signature:string){
 const expected=crypto.createHmac('sha256',env.razorpayWebhookSecret).update(rawBody).digest('hex');
 return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
}
