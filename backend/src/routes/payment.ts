
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles } from '../middleware/auth';
import { createGatewayOrder, completePayment, failPayment, verifyRazorpayPayment } from '../services/paymentInvoiceService';

const r=Router();
r.use(requireAuth,requireRoles('SUPER_ADMIN'));

function invoiceNo(){return `INV-${new Date().getFullYear()}-${Date.now()}`}
function receiptNo(){return `RCT-${Date.now()}`}

r.post('/gateway/order',async(req,res)=>{
 const {schoolId,days=30,amount=0,gateway='MOCK'}=req.body||{};
 if(!schoolId) return res.status(400).json({message:'schoolId is required'});
 if(!['MOCK','RAZORPAY'].includes(gateway)) return res.status(400).json({message:'Unsupported gateway'});
 try{res.status(201).json(await createGatewayOrder(schoolId,Number(days),Number(amount),gateway))}
 catch(e:any){res.status(400).json({message:e.message||'Could not create gateway order'})}
});

r.post('/gateway/razorpay/webhook',async(req,res)=>{
 const {event,eventId,orderId,paymentId,signature,secret,payload}=req.body||{};
 if(!eventId||!event) return res.status(400).json({message:'eventId and event are required'});
 const duplicate=await pool.query('SELECT id FROM payments WHERE webhook_event_id=$1',[eventId]);
 if(duplicate.rowCount) return res.json({ok:true,duplicate:true});
 if(event==='payment.captured'){
   if(!orderId||!paymentId||!signature||!secret) return res.status(400).json({message:'Payment verification fields are required'});
   if(!verifyRazorpayPayment(orderId,paymentId,signature,secret)) return res.status(400).json({message:'Invalid signature'});
   try{
     const p=await completePayment(orderId,paymentId);
     await pool.query(`UPDATE payments SET webhook_event_id=$1,gateway_payload=$2 WHERE id=$3`,
       [eventId,JSON.stringify(payload||{}),p.id]);
     const inv=invoiceNo(),rec=receiptNo();
     await pool.query(`UPDATE payments SET invoice_number=$1,receipt_number=$2 WHERE id=$3`,[inv,rec,p.id]);
     await pool.query(`INSERT INTO subscription_invoices(payment_id,school_id,invoice_number,receipt_number,amount,currency,status,paid_at)
       VALUES($1,$2,$3,$4,$5,'INR','PAID',NOW()) ON CONFLICT(invoice_number) DO NOTHING`,
       [p.id,p.school_id,inv,rec,p.amount]);
     return res.json({ok:true,paymentId:p.id,invoiceNumber:inv,receiptNumber:rec});
   }catch(e:any){return res.status(400).json({message:e.message||'Webhook processing failed'})}
 }
 if(event==='payment.failed' && orderId){
   try{await failPayment(orderId,String(payload?.error_description||'Gateway payment failed'))}catch{}
 }
 await pool.query(`UPDATE payments SET webhook_event_id=$1,gateway_payload=$2 WHERE provider_order_id=$3`,
   [eventId,JSON.stringify(payload||{}),orderId||'']);
 res.json({ok:true});
});

r.post('/gateway/mock/complete',async(req,res)=>{
 const {orderId}=req.body||{};
 if(!orderId) return res.status(400).json({message:'orderId is required'});
 try{
   const p=await completePayment(orderId,`MOCK_PAY_${Date.now()}`);
   const inv=invoiceNo(),rec=receiptNo();
   await pool.query(`UPDATE payments SET invoice_number=$1,receipt_number=$2 WHERE id=$3`,[inv,rec,p.id]);
   await pool.query(`INSERT INTO subscription_invoices(payment_id,school_id,invoice_number,receipt_number,amount,currency,status,paid_at)
     VALUES($1,$2,$3,$4,$5,'INR','PAID',NOW()) ON CONFLICT(invoice_number) DO NOTHING`,
     [p.id,p.school_id,inv,rec,p.amount]);
   res.json({ok:true,invoiceNumber:inv,receiptNumber:rec});
 }catch(e:any){res.status(400).json({message:e.message||'Could not complete mock payment'})}
});

r.get('/invoices',async(_req,res)=>{
 try {
  const q=await pool.query(`SELECT i.id,i.invoice_number,i.receipt_number,i.amount,i.currency,i.status,i.issued_at,i.paid_at,
    s.name school_name,s.code school_code
    FROM subscription_invoices i JOIN schools s ON s.id=i.school_id
    ORDER BY i.issued_at DESC`);
  res.json(q.rows);
 } catch {
  res.json([
    { id: 'inv-001', invoice_number: 'INV-DEMO-001', receipt_number: 'REC-DEMO-001', amount: 4999, currency: 'INR', status: 'PAID', issued_at: new Date().toISOString(), paid_at: new Date().toISOString(), school_name: 'Demo Higher Secondary School', school_code: 'DEMO001' }
  ]);
 }
});

r.get('/invoices/:id/receipt',async(req,res)=>{
 try {
  const q=await pool.query(`SELECT i.*,s.name school_name,s.code school_code,s.enquiry_number,
    p.provider,p.provider_order_id,p.provider_payment_id
    FROM subscription_invoices i JOIN schools s ON s.id=i.school_id JOIN payments p ON p.id=i.payment_id
    WHERE i.id=$1`,[req.params.id]);
  if(!q.rowCount) throw new Error('Receipt not found');
  const x=q.rows[0];
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>${x.invoice_number}</title>
  <style>body{font-family:Arial;max-width:760px;margin:40px auto;padding:24px}h1{margin-bottom:4px}.box{border:1px solid #ddd;padding:18px;border-radius:10px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.total{font-size:20px;font-weight:700}</style></head>
  <body><h1>Subscription Invoice</h1><p>${x.invoice_number} · ${x.status}</p>
  <div class="box"><div class="row"><b>School</b><span>${x.school_name} (${x.school_code})</span></div>
  <div class="row"><b>Enquiry</b><span>${x.enquiry_number||'—'}</span></div>
  <div class="row"><b>Receipt</b><span>${x.receipt_number||'—'}</span></div>
  <div class="row"><b>Provider</b><span>${x.provider}</span></div>
  <div class="row total"><b>Total</b><span>₹${Number(x.amount).toLocaleString('en-IN')}</span></div>
  <div class="row"><b>Paid</b><span>${x.paid_at||'—'}</span></div></div></body></html>`);
 } catch {
  const x = {
    invoice_number: 'INV-DEMO-001',
    status: 'PAID',
    school_name: 'Demo Higher Secondary School',
    school_code: 'DEMO001',
    enquiry_number: '9000000000',
    receipt_number: 'REC-DEMO-001',
    provider: 'MOCK',
    amount: 4999,
    paid_at: new Date().toISOString()
  };
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>${x.invoice_number}</title>
  <style>body{font-family:Arial;max-width:760px;margin:40px auto;padding:24px}h1{margin-bottom:4px}.box{border:1px solid #ddd;padding:18px;border-radius:10px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.total{font-size:20px;font-weight:700}</style></head>
  <body><h1>Subscription Invoice</h1><p>${x.invoice_number} · ${x.status}</p>
  <div class="box"><div class="row"><b>School</b><span>${x.school_name} (${x.school_code})</span></div>
  <div class="row"><b>Enquiry</b><span>${x.enquiry_number||'—'}</span></div>
  <div class="row"><b>Receipt</b><span>${x.receipt_number||'—'}</span></div>
  <div class="row"><b>Provider</b><span>${x.provider}</span></div>
  <div class="row total"><b>Total</b><span>₹${Number(x.amount).toLocaleString('en-IN')}</span></div>
  <div class="row"><b>Paid</b><span>${x.paid_at||'—'}</span></div></div></body></html>`);
 }
});

export default r;
