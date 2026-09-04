-- V24: Advanced SaaS Analytics
CREATE TABLE IF NOT EXISTS analytics_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_students INTEGER NOT NULL DEFAULT 0,
  active_students INTEGER NOT NULL DEFAULT 0,
  total_teachers INTEGER NOT NULL DEFAULT 0,
  attendance_sessions INTEGER NOT NULL DEFAULT 0,
  present_records INTEGER NOT NULL DEFAULT 0,
  absent_records INTEGER NOT NULL DEFAULT 0,
  attendance_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  active_subscription BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id,snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_school_date
 ON analytics_daily_snapshots(school_id,snapshot_date DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL,
  value_numeric NUMERIC(14,2),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time ON analytics_events(event_type,created_at DESC);
