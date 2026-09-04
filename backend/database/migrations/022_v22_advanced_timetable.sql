-- V22: Advanced Timetable / Routine Management
CREATE TABLE IF NOT EXISTS timetable_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  period_number INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(school_id,period_number)
);
CREATE TABLE IF NOT EXISTS timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  period_id UUID NOT NULL REFERENCES timetable_periods(id) ON DELETE RESTRICT,
  day_of_week SMALLINT NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
  room_name VARCHAR(100),
  substitute_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timetable_school_day ON timetable_entries(school_id,day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable_entries(teacher_id,day_of_week,period_id);
CREATE INDEX IF NOT EXISTS idx_timetable_class_section ON timetable_entries(class_id,section_id,day_of_week,period_id);

CREATE TABLE IF NOT EXISTS timetable_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
  conflict_type VARCHAR(40) NOT NULL,
  conflicting_entry_id UUID REFERENCES timetable_entries(id) ON DELETE CASCADE,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS substitute_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  timetable_entry_id UUID NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
  substitute_teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  effective_date DATE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(timetable_entry_id,effective_date)
);

CREATE INDEX IF NOT EXISTS idx_substitute_date ON substitute_assignments(school_id,effective_date);
