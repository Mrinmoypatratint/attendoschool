-- =================================================================
-- Migration 032: Production-Grade Email Notifications Hardening
-- Adds subject, HTML body, recipient_type, idempotency key,
-- scheduled retry timestamps, and concurrency indexing.
-- =================================================================

-- 1. Ensure notification_logs has all production delivery tracking fields
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS subject VARCHAR(255);
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS html_body TEXT;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50) DEFAULT 'PARENT';
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 4;

-- 2. Concurrency and Idempotency Indexes
CREATE UNIQUE INDEX IF NOT EXISTS notification_logs_idempotency_idx 
ON notification_logs(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_logs_scheduled_status_idx 
ON notification_logs(status, scheduled_at);

CREATE INDEX IF NOT EXISTS notification_logs_session_idx 
ON notification_logs(attendance_session_id);

-- 3. Password Resets Token Hashing & Tracking
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  user_id UUID,
  role VARCHAR(50) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  token_hash VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS password_resets_email_idx ON password_resets(email, used);
CREATE INDEX IF NOT EXISTS password_resets_token_idx ON password_resets(token);
