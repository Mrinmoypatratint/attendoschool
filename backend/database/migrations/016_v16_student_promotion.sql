-- V16: Student Promotion / Carry Forward
CREATE TABLE IF NOT EXISTS student_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  from_academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  to_academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  student_id UUID NOT NULL REFERENCES students(id),
  from_class_id UUID REFERENCES classes(id),
  from_section_id UUID REFERENCES sections(id),
  to_class_id UUID REFERENCES classes(id),
  to_section_id UUID REFERENCES sections(id),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('PROMOTED','RETAINED','GRADUATED','TRANSFERRED')),
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('CONFIRMED','CANCELLED')),
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_promotion_year
 ON student_promotions(student_id, from_academic_year_id, to_academic_year_id);

CREATE INDEX IF NOT EXISTS idx_student_promotions_school
 ON student_promotions(school_id, from_academic_year_id, to_academic_year_id);

ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_students_enrollment_status ON students(school_id, enrollment_status);
