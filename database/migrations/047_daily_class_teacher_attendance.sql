-- Migration: Enforce Class Teacher-Based Daily Attendance
-- 1. Cleans up any potential duplicate sessions per class/section per date
-- 2. Adds unique constraint to attendance_sessions (school_id, class_id, section_id, attendance_date)
-- 3. Adds lookup index for instant daily attendance checks

-- Step 1: Deduplicate any existing sessions keeping the most recently submitted session
DO $$
DECLARE
  dup RECORD;
  keep_session_id UUID;
BEGIN
  FOR dup IN
    SELECT school_id, class_id, section_id, attendance_date, array_agg(id ORDER BY submitted_at DESC) AS session_ids
    FROM attendance_sessions
    GROUP BY school_id, class_id, section_id, attendance_date
    HAVING count(*) > 1
  LOOP
    keep_session_id := dup.session_ids[1];

    -- Re-link or remove child records belonging to older duplicate sessions
    DELETE FROM attendance_records
    WHERE attendance_session_id = ANY(dup.session_ids[2:array_length(dup.session_ids, 1)]);

    DELETE FROM attendance_audit_logs
    WHERE session_id = ANY(dup.session_ids[2:array_length(dup.session_ids, 1)]);

    -- Remove the duplicate sessions
    DELETE FROM attendance_sessions
    WHERE id = ANY(dup.session_ids[2:array_length(dup.session_ids, 1)]);
  END LOOP;
END $$;

-- Step 2: Add unique constraint ensuring exactly one attendance session per class section per calendar day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_attendance_sessions_daily'
  ) THEN
    ALTER TABLE attendance_sessions
      ADD CONSTRAINT uq_attendance_sessions_daily
      UNIQUE (school_id, class_id, section_id, attendance_date);
  END IF;
END $$;

-- Step 3: Add index for instant daily status checks
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_daily_lookup
  ON attendance_sessions (school_id, class_id, section_id, attendance_date);
