-- V15: Academic Year / Session Management
CREATE TABLE IF NOT EXISTS academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date > start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_year_school_name
  ON academic_years(school_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_year_one_active
  ON academic_years(school_id) WHERE is_active=TRUE AND is_archived=FALSE;

CREATE INDEX IF NOT EXISTS idx_academic_year_school_dates
  ON academic_years(school_id, start_date DESC);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);
ALTER TABLE sections ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);
ALTER TABLE class_routines ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);

CREATE INDEX IF NOT EXISTS idx_classes_academic_year ON classes(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_sections_academic_year ON sections(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_students_academic_year ON students(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_routines_academic_year ON class_routines(academic_year_id);
