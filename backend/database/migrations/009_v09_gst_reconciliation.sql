
-- V09: GST-ready invoices and payment reconciliation.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS gstin VARCHAR(30);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS billing_address TEXT;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(20) DEFAULT 'UNRECONCILED';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

ALTER TABLE subscription_invoices ADD COLUMN IF NOT EXISTS gstin VARCHAR(30);
ALTER TABLE subscription_invoices ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE subscription_invoices ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12,2);
ALTER TABLE subscription_invoices ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE subscription_invoices ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS payments_reconciliation_idx
ON payments(reconciliation_status,created_at DESC);
