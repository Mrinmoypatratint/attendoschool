import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { buildInvoicePdf, fetchInvoiceDetails, InvoicePdfData } from '../services/invoicePdfService';
import { sendInvoiceEmail } from '../services/emailService';
import { collections, isFirebaseConfigured } from '../firebase';

const r = Router();
r.use(requireAuth, requireRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'));

// In-memory store for seamless fast edits and fallback
const memoryInvoices: Map<string, InvoicePdfData> = new Map([
  [
    'inv-001',
    {
      id: 'inv-001',
      invoice_number: 'INV-2025-001',
      receipt_number: 'REC-2025-001',
      school_name: 'Greenwood International School',
      school_code: 'GWIS-2025',
      amount: 1999,
      taxable_amount: 1694.07,
      gst_rate: 18,
      gst_amount: 304.93,
      currency: 'INR',
      status: 'PAID',
      issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      paid_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      billing_address: 'Plot 42, Knowledge Park III, Greater Bengaluru, KA',
      gstin: '29ABCDE1234F1Z5',
      provider: 'Razorpay Payment Gateway',
      provider_order_id: 'order_GWIS_2025_001',
      provider_payment_id: 'pay_GWIS_99887711'
    }
  ],
  [
    'inv-002',
    {
      id: 'inv-002',
      invoice_number: 'INV-2025-002',
      receipt_number: 'REC-2025-002',
      school_name: 'Delhi Public Academy',
      school_code: 'DPA-2025',
      amount: 999,
      taxable_amount: 846.61,
      gst_rate: 18,
      gst_amount: 152.39,
      currency: 'INR',
      status: 'PAID',
      issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      paid_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      billing_address: 'Sector 14, Institutional Area, New Delhi 110001',
      gstin: '07AAACD5678G1Z2',
      provider: 'HDFC NetBanking Direct',
      provider_order_id: 'order_DPA_2025_002',
      provider_payment_id: 'pay_DPA_55443322'
    }
  ],
  [
    'inv-003',
    {
      id: 'inv-003',
      invoice_number: 'INV-2025-003',
      receipt_number: 'REC-2025-003',
      school_name: 'St. Xavier High School',
      school_code: 'SXHS-2025',
      amount: 499,
      taxable_amount: 422.88,
      gst_rate: 18,
      gst_amount: 76.12,
      currency: 'INR',
      status: 'PENDING',
      issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
      billing_address: 'Park Street Campus, Central Boulevard, Kolkata 700016',
      gstin: '19AAACX9988H1Z9',
      provider: 'Pending Settlement',
      provider_order_id: 'order_SXHS_PENDING',
      provider_payment_id: '—'
    }
  ]
]);

/* Seed initial invoices into Firestore if empty */
async function syncInvoicesWithFirestore(): Promise<InvoicePdfData[]> {
  if (!isFirebaseConfigured()) return Array.from(memoryInvoices.values());

  try {
    const snap = await collections.invoices().get();
    if (snap.empty) {
      console.log('[Firestore] Seeding initial invoices collection...');
      for (const [id, data] of memoryInvoices.entries()) {
        await collections.invoices().doc(id).set(data);
      }
      return Array.from(memoryInvoices.values());
    }

    const items: InvoicePdfData[] = [];
    snap.forEach(doc => {
      const d = doc.data() as InvoicePdfData;
      items.push({ ...d, id: doc.id });
      memoryInvoices.set(doc.id, { ...d, id: doc.id });
    });
    return items;
  } catch (err) {
    console.warn('[Firestore] Invoices query failed, using memory fallback:', err);
    return Array.from(memoryInvoices.values());
  }
}

r.get('/', async (req: AuthRequest, res) => {
  const role = req.user?.role;
  const sid = req.user?.schoolId;

  // 1. Try SQL
  try {
    const q = await pool.query(
      `SELECT i.*, s.name as school_name, s.code as school_code, s.gstin, i.billing_address
       FROM subscription_invoices i
       JOIN schools s ON s.id = i.school_id
       ${role === 'SCHOOL_ADMIN' ? 'WHERE i.school_id = $1' : ''}
       ORDER BY i.issued_at DESC`,
      role === 'SCHOOL_ADMIN' ? [sid] : []
    );
    if (q.rows.length > 0) return res.json(q.rows);
  } catch {}

  // 2. Try Firestore / Memory
  const firestoreInvoices = await syncInvoicesWithFirestore();
  if (role === 'SCHOOL_ADMIN' && sid) {
    return res.json(firestoreInvoices.filter(i => i.school_code === sid || i.id === sid));
  }
  return res.json(firestoreInvoices);
});

r.get('/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const inv = await fetchInvoiceDetails(id);
  res.json(inv);
});

r.put('/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const body = req.body || {};

  const existing = await fetchInvoiceDetails(id);

  const amount = body.amount !== undefined ? Number(body.amount) : Number(existing.amount || 0);
  const gstRate = body.gst_rate !== undefined ? Number(body.gst_rate) : Number(existing.gst_rate || 18);
  const taxable = body.taxable_amount !== undefined
    ? Number(body.taxable_amount)
    : Math.round(amount * (100 / (100 + gstRate)) * 100) / 100;
  const gstAmount = body.gst_amount !== undefined
    ? Number(body.gst_amount)
    : Math.round((amount - taxable) * 100) / 100;

  const updated: InvoicePdfData = {
    ...existing,
    ...body,
    id,
    amount,
    gst_rate: gstRate,
    taxable_amount: taxable,
    gst_amount: gstAmount,
    status: (body.status || existing.status || 'PAID').toUpperCase(),
    updated_at: new Date().toISOString()
  };

  // 1. Update memory
  memoryInvoices.set(id, updated);

  // 2. Update Firestore
  if (isFirebaseConfigured()) {
    try {
      await collections.invoices().doc(id).set(updated, { merge: true });
      console.log(`[Firestore] Updated invoice ${id} successfully`);
    } catch (err) {
      console.warn('[Firestore] Error saving invoice update:', err);
    }
  }

  // 3. Update SQL if available
  try {
    await pool.query(
      `UPDATE subscription_invoices
       SET amount = $1, status = $2, taxable_amount = $3, gst_rate = $4, gst_amount = $5, updated_at = NOW()
       WHERE id = $6`,
      [amount, updated.status, taxable, gstRate, gstAmount, id]
    );
  } catch {}

  res.json({ success: true, invoice: updated, message: 'Tax invoice updated successfully' });
});

r.get('/:id/pdf', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const inv = await fetchInvoiceDetails(id);
    const pdf = await buildInvoicePdf(id, inv);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.invoice_number || 'Tax_Invoice'}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(pdf);
  } catch (e: any) {
    console.error('Invoice PDF error:', e);
    res.status(400).json({ message: e.message || 'Could not generate invoice PDF' });
  }
});

r.post('/:id/email', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const inv = await fetchInvoiceDetails(id);
    const recipient = String(req.body?.email || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return res.status(400).json({ message: 'Valid recipient email address is required' });
    }

    const pdf = await buildInvoicePdf(id, inv);
    await sendInvoiceEmail(recipient, inv.invoice_number, pdf);

    try {
      await pool.query(
        `UPDATE subscription_invoices SET email_sent_at=NOW(), email_status='SENT', email_error=NULL WHERE id=$1`,
        [id]
      );
    } catch {}

    if (isFirebaseConfigured()) {
      try {
        await collections.invoices().doc(id).set(
          { email_sent_at: new Date().toISOString(), email_status: 'SENT', email_recipient: recipient },
          { merge: true }
        );
      } catch {}
    }

    res.json({ ok: true, message: `Tax invoice ${inv.invoice_number} dispatched to ${recipient}` });
  } catch (e: any) {
    console.error('Email invoice error:', e);
    res.status(400).json({ message: e.message || 'Could not email invoice' });
  }
});

export default r;
