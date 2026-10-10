-- V40: Class Mentors & Subject Teacher Assignment Publishing Permissions
-- Verified against PostgreSQL types in schema.sql

CREATE TABLE IF NOT EXISTS class_mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, class_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_class_mentors_teacher ON class_mentors(school_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_mentors_school_sec ON class_mentors(school_id, class_id, section_id);

CREATE TABLE IF NOT EXISTS teacher_assignment_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_authorized BOOLEAN NOT NULL DEFAULT FALSE,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, class_id, section_id, subject_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_assign_perm ON teacher_assignment_permissions(school_id, class_id, section_id, subject_id, teacher_id);
