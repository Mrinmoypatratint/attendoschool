-- Migration 048: General Assignment Management & Attachments
-- Transactional, non-destructive backfill of assigned_date and attachment infrastructure

BEGIN;

-- 1. Add assigned_date only if missing (initially nullable to allow backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'student_assignments' 
      AND column_name = 'assigned_date'
  ) THEN
    ALTER TABLE student_assignments ADD COLUMN assigned_date DATE;
  END IF;
END $$;

-- 2. Backfill existing historical records using their true creation date
UPDATE student_assignments
SET assigned_date = COALESCE(created_at::date, CURRENT_DATE)
WHERE assigned_date IS NULL;

-- 3. Set DEFAULT CURRENT_DATE for all future records
ALTER TABLE student_assignments 
  ALTER COLUMN assigned_date SET DEFAULT CURRENT_DATE;

-- 4. Enforce NOT NULL constraint now that all rows are populated
ALTER TABLE student_assignments 
  ALTER COLUMN assigned_date SET NOT NULL;

-- 5. Create assignment_attachments table for teacher assignment attachments
CREATE TABLE IF NOT EXISTS assignment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES student_assignments(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  storage_key TEXT,
  file_url TEXT,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Indexes for high-performance lookup and tenant isolation
CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment_id
  ON assignment_attachments (assignment_id);

CREATE INDEX IF NOT EXISTS idx_assignment_attachments_school
  ON assignment_attachments (school_id, assignment_id);

CREATE INDEX IF NOT EXISTS idx_student_assignments_school_class_sec
  ON student_assignments (school_id, class_id, section_id, assigned_date);

-- 7. Create view 'assignments' as an alias to 'student_assignments' for schema naming flexibility
CREATE OR REPLACE VIEW assignments AS
  SELECT id, school_id, teacher_id, class_id, section_id, subject_id,
         title, description, assigned_date, due_date, max_marks,
         document_url, document_name, document_size, document_mime, document_data,
         storage_key, attachments, created_at, updated_at
  FROM student_assignments;

COMMIT;
