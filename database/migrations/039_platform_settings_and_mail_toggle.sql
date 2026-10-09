-- Migration 039: Platform Settings & Master Mail Service Toggle
-- Stores system-wide configuration, feature toggles, and email/SMTP gateway state.

CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial mail_service configuration
INSERT INTO platform_settings (key, value, description)
VALUES ('mail_service', '{"enabled": true, "updated_by": "system"}'::jsonb, 'Global Email & SMTP Gateway Dispatch Master Toggle')
ON CONFLICT (key) DO NOTHING;
