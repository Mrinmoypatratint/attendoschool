-- Migration 038: Critical Auth & Login Performance Indexes
-- These indexes directly accelerate the hottest code paths: login, institute lookup, and dashboard queries.
-- Without these, every login triggers sequential full-table scans on users and students tables.

-- Auth: Fast email-based user lookup (login hot path)
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- Auth: Fast student login by admission number (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_students_admission_lower ON students (LOWER(admission_number));

-- Auth: Student email lookup scoped to school (institute lookup)
CREATE INDEX IF NOT EXISTS idx_students_school_email ON students (school_id, email) WHERE email IS NOT NULL;

-- Auth: Student roll number lookup
CREATE INDEX IF NOT EXISTS idx_students_roll_number_lower ON students (LOWER(roll_number)) WHERE roll_number IS NOT NULL;

-- Dashboard: Active academic year lookup (called on every dashboard load)
CREATE INDEX IF NOT EXISTS idx_academic_years_school_active ON academic_years (school_id) WHERE is_active = true;

-- Schools: Fast lookup by code (used in login institute resolution)
CREATE INDEX IF NOT EXISTS idx_schools_code_lower ON schools (LOWER(code));

-- Schools: Active schools filter (used in /api/auth/institutes)
CREATE INDEX IF NOT EXISTS idx_schools_active ON schools (status) WHERE status = 'ACTIVE';

-- Users: School-scoped user lookup with role filter
CREATE INDEX IF NOT EXISTS idx_users_school_role ON users (school_id, role) WHERE is_active = true;

-- Students: Class/section navigation (used in attendance, reports)
CREATE INDEX IF NOT EXISTS idx_students_class_section ON students (school_id, class_id, section_id) WHERE is_active = true;
