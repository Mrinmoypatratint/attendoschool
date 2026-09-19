-- V19: Subscription Enforcement & Renewal Automation
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  event_type VARCHAR(60) NOT NULL,
  old_status VARCHAR(40),
  new_status VARCHAR(40),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscription_events_school_time
 ON subscription_events(school_id,created_at DESC);

CREATE TABLE IF NOT EXISTS subscription_renewal_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES school_subscriptions(id) ON DELETE CASCADE,
  reminder_type VARCHAR(40) NOT NULL,
  scheduled_for DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  UNIQUE(subscription_id,reminder_type,scheduled_for)
);

CREATE TABLE IF NOT EXISTS subscription_access_policies (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  grace_period_days INTEGER NOT NULL DEFAULT 3,
  block_attendance_when_expired BOOLEAN NOT NULL DEFAULT TRUE,
  block_admin_when_expired BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_students INTEGER;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_teachers INTEGER;
ALTER TABLE school_subscriptions ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_school_subscriptions_dates
 ON school_subscriptions(start_date,end_date);
