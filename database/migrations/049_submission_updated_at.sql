-- Migration 049: Add updated_at and extend status constraint for student_assignment_submissions
-- Idempotent and non-destructive

-- 1. Add updated_at column to student_assignment_submissions if not already present
ALTER TABLE student_assignment_submissions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Backfill existing records with submitted_at or created_at if updated_at is null
UPDATE student_assignment_submissions
SET updated_at = COALESCE(submitted_at, created_at, NOW())
WHERE updated_at IS NULL;

-- 3. Extend status CHECK constraint to support 'RESUBMITTED' safely
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_assignment_submissions_status_check'
    ) THEN
        ALTER TABLE student_assignment_submissions DROP CONSTRAINT student_assignment_submissions_status_check;
        ALTER TABLE student_assignment_submissions ADD CONSTRAINT student_assignment_submissions_status_check
            CHECK (status IN ('PENDING', 'SUBMITTED', 'RESUBMITTED', 'GRADED', 'OVERDUE'));
    END IF;
END $$;
