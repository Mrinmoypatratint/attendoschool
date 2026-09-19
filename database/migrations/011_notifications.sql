
-- V11: parent notification channels and delivery analytics.
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attendance_session_id UUID REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  channel VARCHAR(20) NOT NULL CHECK(channel IN ('SMS','WHATSAPP','EMAIL')),
  recipient VARCHAR(255) NOT NULL,
  template_key VARCHAR(80) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  provider_message_id VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS school_notification_channels (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_provider VARCHAR(40) DEFAULT 'MOCK',
  email_provider VARCHAR(40) DEFAULT 'SMTP',
  whatsapp_api_url TEXT,
  whatsapp_api_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  template_key VARCHAR(80) NOT NULL,
  template_name VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id,channel,template_key)
);

CREATE INDEX IF NOT EXISTS notification_logs_school_created_idx
ON notification_logs(school_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notification_logs_status_idx
ON notification_logs(status,created_at);
