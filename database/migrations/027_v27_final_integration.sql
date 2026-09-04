
-- V27 final integration schema
CREATE TABLE IF NOT EXISTS student_enrollments_v27 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  class_id UUID REFERENCES classes(id),
  section_id UUID REFERENCES sections(id),
  enrollment_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, academic_year_id)
);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_v27_year_class
 ON student_enrollments_v27(academic_year_id,class_id,section_id);

ALTER TABLE IF EXISTS offline_attendance_sync_items
  ADD COLUMN IF NOT EXISTS attendance_session_id UUID;
CREATE INDEX IF NOT EXISTS idx_offline_sync_session_v27
 ON offline_attendance_sync_items(attendance_session_id);

CREATE TABLE IF NOT EXISTS parent_onboarding_v27 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initiated_by UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  invite_token_hash TEXT,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parent_onboarding_status
 ON parent_onboarding_v27(status,expires_at);

CREATE TABLE IF NOT EXISTS webhook_events_v27 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(40) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(120),
  payload_hash VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider,event_id)
);

CREATE TABLE IF NOT EXISTS integration_test_runs_v27 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  details JSONB,
  error_message TEXT
);
