-- V31: Fix Attendance Schema (Ensure status, remarks, counters, and indexes exist)
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PRESENT';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT '';

-- Backfill status for existing records if null
UPDATE attendance_records
SET status = CASE WHEN is_present = true THEN 'PRESENT' ELSE 'ABSENT' END
WHERE status IS NULL;

-- Attendance session counters and metadata
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS class_number SMALLINT;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS section_name VARCHAR(50);
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS subject_name VARCHAR(150);
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS present_count INTEGER DEFAULT 0;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS absent_count INTEGER DEFAULT 0;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS total_count INTEGER DEFAULT 0;

-- Performance indexes for reporting & roll-call lookup
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_status
  ON attendance_records (attendance_session_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_records_student_status
  ON attendance_records (student_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_date
  ON attendance_sessions (school_id, attendance_date);
