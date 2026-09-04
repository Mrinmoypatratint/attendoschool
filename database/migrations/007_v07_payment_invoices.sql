
-- V07 migration: invoices, receipts, gateway webhook support.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(80);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(80);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS webhook_event_id VARCHAR(150);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payload JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS payments_webhook_event_uidx
  ON payments(webhook_event_id) WHERE webhook_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invoice_number VARCHAR(80) NOT NULL UNIQUE,
  receipt_number VARCHAR(80),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS subscription_invoices_school_idx
  ON subscription_invoices(school_id, issued_at DESC);
