
import nodemailer from 'nodemailer';
import { env } from '../config/env';

function configured(){return Boolean(env.smtpHost&&env.smtpUser&&env.smtpPass&&env.smtpFrom)}
export async function sendInvoiceEmail(to:string,invoiceNumber:string,pdf:Buffer){
 if(!configured()) throw new Error('SMTP is not configured');
 const transporter=nodemailer.createTransport({
   host:env.smtpHost,port:env.smtpPort,secure:env.smtpPort===465,
   auth:{user:env.smtpUser,pass:env.smtpPass}
 });
 await transporter.sendMail({
   from:env.smtpFrom,to,
   subject:`Subscription invoice ${invoiceNumber}`,
   text:`Please find your School Attendance SaaS subscription invoice ${invoiceNumber} attached.`,
   attachments:[{filename:`${invoiceNumber}.pdf`,content:pdf,contentType:'application/pdf'}]
 });
}
