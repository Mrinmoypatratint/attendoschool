-- V14: Complete Student & Teacher Management
-- Adds operational profile fields and safe deactivation instead of destructive deletion.

ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_number VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(30);
ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(30);
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name VARCHAR(150);
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_email VARCHAR(180);
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS qualification VARCHAR(200);
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_admission_school
  ON students(school_id, admission_number)
  WHERE admission_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_active_school
  ON students(school_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_employee_school
  ON teacher_profiles(employee_id)
  WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_active
  ON teacher_profiles(is_active);
