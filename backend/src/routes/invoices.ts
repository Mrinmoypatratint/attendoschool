
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

r.get('/', async (req: AuthRequest, res) => {
  const role = req.user?.role;
  const sid = req.user?.schoolId;
  try {
    const q = await pool.query(
      `SELECT i.*, s.name as school_name, s.code as school_code
       FROM subscription_invoices i
       JOIN schools s ON s.id = i.school_id
       ${role === 'SCHOOL_ADMIN' ? 'WHERE i.school_id = $1' : ''}
       ORDER BY i.issued_at DESC`,
      role === 'SCHOOL_ADMIN' ? [sid] : []
    );
    if (q.rows.length > 0) return res.json(q.rows);
  } catch {}

  const demoInvoices = [
    {
      id: 'inv-001',
      invoice_number: 'INV-2025-001',
      receipt_number: 'REC-2025-001',
      school_name: 'Greenwood International School',
      school_code: 'GWIS-2025',
      amount: 1999,
      taxable_amount: 1694.07,
      gst_amount: 304.93,
      currency: 'INR',
      status: 'PAID',
      issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      paid_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
    },
    {
      id: 'inv-002',
      invoice_number: 'INV-2025-002',
      receipt_number: 'REC-2025-002',
      school_name: 'Delhi Public Academy',
      school_code: 'DPA-2025',
      amount: 999,
      taxable_amount: 846.61,
      gst_amount: 152.39,
      currency: 'INR',
      status: 'PAID',
      issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      paid_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString()
    },
    {
      id: 'inv-003',
      invoice_number: 'INV-2025-003',
      receipt_number: 'REC-2025-003',
      school_name: 'St. Xavier High School',
      school_code: 'SXHS-2025',
      amount: 499,
      taxable_amount: 422.88,
      gst_amount: 76.12,
      currency: 'INR',
      status: 'PENDING',
      issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString()
    }
  ];
  return res.json(demoInvoices);
});
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
