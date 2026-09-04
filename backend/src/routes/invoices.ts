
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { buildInvoicePdf } from '../services/invoicePdfService';
import { sendInvoiceEmail } from '../services/emailService';

const r=Router();
r.use(requireAuth,requireRoles('SUPER_ADMIN','SCHOOL_ADMIN'));

async function getInvoice(id:string,sid:string|null,role:string){
 const q=await pool.query(`SELECT i.*,s.name school_name,s.code school_code
   FROM subscription_invoices i JOIN schools s ON s.id=i.school_id
   WHERE i.id=$1 ${role==='SCHOOL_ADMIN'?'AND i.school_id=$2':''}`,
   role==='SCHOOL_ADMIN'?[id,sid]:[id]);
 return q.rows[0];
}

r.get('/:id/pdf',async(req:AuthRequest,res)=>{
 try{
   const x=await getInvoice(String(req.params.id),req.user!.schoolId,req.user!.role);
   if(!x) return res.status(404).json({message:'Invoice not found'});
   const pdf=await buildInvoicePdf(String(req.params.id));
   res.setHeader('Content-Type','application/pdf');
   res.setHeader('Content-Disposition',`attachment; filename="${x.invoice_number}.pdf"`);
   res.send(pdf);
 }catch(e:any){res.status(400).json({message:e.message||'Could not generate invoice PDF'})}
});

r.post('/:id/email',async(req:AuthRequest,res)=>{
 try{
   const x=await getInvoice(String(req.params.id),req.user!.schoolId,req.user!.role);
   if(!x) return res.status(404).json({message:'Invoice not found'});
   const recipient=String(req.body?.email||'').trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return res.status(400).json({message:'Valid email is required'});
   const pdf=await buildInvoicePdf(String(req.params.id));
   await sendInvoiceEmail(recipient,x.invoice_number,pdf);
   await pool.query(`UPDATE subscription_invoices SET email_sent_at=NOW(),email_status='SENT',email_error=NULL WHERE id=$1`,[String(req.params.id)]);
   res.json({ok:true,message:'Invoice emailed'});
 }catch(e:any){
   await pool.query(`UPDATE subscription_invoices SET email_status='FAILED',email_error=$1 WHERE id=$2`,[e.message||'Email failed',String(req.params.id)]).catch(()=>{});
   res.status(400).json({message:e.message||'Could not email invoice'});
 }
});

export default r;
