
-- V10: invoice PDF and email delivery tracking.
ALTER TABLE subscription_invoices ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE subscription_invoices ADD COLUMN IF NOT EXISTS email_status VARCHAR(20) DEFAULT 'NOT_SENT';
ALTER TABLE subscription_invoices ADD COLUMN IF NOT EXISTS email_error TEXT;

CREATE INDEX IF NOT EXISTS invoices_email_status_idx
ON subscription_invoices(email_status,issued_at DESC);
