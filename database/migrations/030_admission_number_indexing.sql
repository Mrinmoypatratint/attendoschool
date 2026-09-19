-- Migration 030: Admission Number Indexing & Verification
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_number VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_students_admission_number 
  ON students(school_id, LOWER(admission_number)) 
  WHERE admission_number IS NOT NULL;
