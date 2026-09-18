
import PDFDocument from 'pdfkit';
import { pool } from '../db';
import { env } from '../config/env';

export async function buildInvoicePdf(invoiceId:string):Promise<Buffer>{
 const q=await pool.query(`SELECT i.*,s.name school_name,s.code school_code,s.gstin,i.billing_address,s.enquiry_number,
   p.provider,p.provider_order_id,p.provider_payment_id
   FROM subscription_invoices i JOIN schools s ON s.id=i.school_id JOIN payments p ON p.id=i.payment_id
   WHERE i.id=$1`,[invoiceId]);
 if(!q.rowCount) throw new Error('Invoice not found');
 const x=q.rows[0];

 return await new Promise((resolve,reject)=>{
   const doc=new PDFDocument({size:'A4',margin:48});
   const chunks:Buffer[]=[];
   doc.on('data',(c:Buffer)=>chunks.push(c));
   doc.on('end',()=>resolve(Buffer.concat(chunks)));
   doc.on('error',reject);

   doc.fontSize(22).text(env.companyName,{bold:true});
   doc.fontSize(10).text(env.companyAddress||'');
   if(env.companyPhone) doc.text(`Phone: ${env.companyPhone}`);
   if(env.companyGstin) doc.text(`GSTIN: ${env.companyGstin}`);
   doc.moveDown();
   doc.fontSize(18).text('TAX INVOICE');
   doc.fontSize(10).text(`Invoice: ${x.invoice_number}`);
   doc.text(`Receipt: ${x.receipt_number||'—'}`);
   doc.text(`Issued: ${new Date(x.issued_at).toLocaleString('en-IN')}`);
   doc.moveDown();
   doc.fontSize(13).text('Bill To');
   doc.fontSize(10).text(`${x.school_name} (${x.school_code})`);
   doc.text(`Address: ${x.billing_address||'—'}`);
   doc.text(`GSTIN: ${x.gstin||'—'}`);
   doc.text(`Enquiry: ${x.enquiry_number||'—'}`);
   doc.moveDown();
   doc.fontSize(11).text('Description',60).text('Taxable',260).text('GST',350).text('Total',450);
   doc.moveTo(48,doc.y+5).lineTo(547,doc.y+5).stroke();
   doc.moveDown(0.7);
   doc.fontSize(10).text('School attendance SaaS subscription',60).text(`₹${Number(x.taxable_amount||x.amount).toFixed(2)}`,260)
      .text(`₹${Number(x.gst_amount||0).toFixed(2)}`,350).text(`₹${Number(x.amount).toFixed(2)}`,450);
   doc.moveDown(2);
   doc.fontSize(12).text(`GST Rate: ${Number(x.gst_rate||0).toFixed(2)}%`);
   doc.fontSize(16).text(`Grand Total: ₹${Number(x.amount).toFixed(2)}`);
   doc.moveDown();
   doc.fontSize(9).text(`Payment Provider: ${x.provider}`);
   doc.text(`Order ID: ${x.provider_order_id||'—'}`);
   doc.text(`Payment ID: ${x.provider_payment_id||'—'}`);
   doc.moveDown(2);
   doc.text('Thank you for using School Attendance SaaS.');
   doc.end();
 });
}
