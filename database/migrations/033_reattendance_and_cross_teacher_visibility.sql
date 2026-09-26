-- =================================================================
-- Migration 033: Re-attendance & Cross-Teacher Visibility
-- Enables full re-attendance tracking (left early, late arrival),
-- multi-teacher session audit trails, and departure/arrival timestamps.
-- =================================================================

-- 1. Extend attendance_sessions for re-attendance & departure tracking
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS left_early_count INTEGER DEFAULT 0;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS late_count INTEGER DEFAULT 0;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS is_reattendance BOOLEAN DEFAULT FALSE;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS reattendance_count INTEGER DEFAULT 0;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS last_modified_name VARCHAR(150);
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ;

-- 2. Extend attendance_records with departure and arrival period tracking
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS departure_period VARCHAR(50);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS departure_time VARCHAR(20);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS arrival_period VARCHAR(50);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS arrival_time VARCHAR(20);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(150);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 3. Dedicated attendance audit logs table for full transparency across all teachers
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(150),
  roll_number VARCHAR(30),
  action VARCHAR(50) NOT NULL,
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  departure_period VARCHAR(50),
  departure_time VARCHAR(20),
  arrival_period VARCHAR(50),
  arrival_time VARCHAR(20),
  reason TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name VARCHAR(150),
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_att_audit_school_session ON attendance_audit_logs(school_id, session_id);
CREATE INDEX IF NOT EXISTS idx_att_audit_student ON attendance_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_att_audit_created ON attendance_audit_logs(created_at DESC);
