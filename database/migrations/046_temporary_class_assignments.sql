-- Migration: Create temporary_class_assignments table with exclusion constraint to prevent overlapping assignments
-- Uses btree_gist extension for exclusion on UUID columns

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS temporary_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  section_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_tmp_assign_school   FOREIGN KEY (school_id)   REFERENCES schools (id)   ON DELETE CASCADE,
  CONSTRAINT fk_tmp_assign_class    FOREIGN KEY (class_id)    REFERENCES classes (id)   ON DELETE CASCADE,
  CONSTRAINT fk_tmp_assign_section  FOREIGN KEY (section_id)  REFERENCES sections (id)  ON DELETE CASCADE,
  CONSTRAINT fk_tmp_assign_teacher  FOREIGN KEY (teacher_id)  REFERENCES users (id)     ON DELETE CASCADE,

  CONSTRAINT chk_tmp_assign_period CHECK (end_at > start_at)
);

-- Exclusion constraint to prevent overlapping assignments for the same school/class/section
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_tmp_assignments'
  ) THEN
    ALTER TABLE temporary_class_assignments
      ADD CONSTRAINT no_overlapping_tmp_assignments
      EXCLUDE USING GIST (
        school_id WITH =,
        class_id WITH =,
        section_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      );
  END IF;
END $$;

-- Indexes for common lookup patterns
CREATE INDEX IF NOT EXISTS idx_tmp_assign_school   ON temporary_class_assignments (school_id);
CREATE INDEX IF NOT EXISTS idx_tmp_assign_class    ON temporary_class_assignments (class_id);
CREATE INDEX IF NOT EXISTS idx_tmp_assign_section  ON temporary_class_assignments (section_id);
CREATE INDEX IF NOT EXISTS idx_tmp_assign_teacher  ON temporary_class_assignments (teacher_id);
CREATE INDEX IF NOT EXISTS idx_tmp_assign_active_range
  ON temporary_class_assignments (school_id, class_id, section_id, start_at, end_at);
