-- Migration 037: High-Performance Composite Indexes for Ultra-Fast Data Access
-- Author: Antigravity Performance Engine

CREATE INDEX IF NOT EXISTS idx_sections_school ON sections (school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes (school_id);
CREATE INDEX IF NOT EXISTS idx_users_active_teachers ON users (school_id) WHERE role = 'TEACHER' AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_students_school_active ON students (school_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_school_status ON attendance_correction_requests (school_id, status);
CREATE INDEX IF NOT EXISTS idx_photo_requests_school_status ON photo_approval_requests (school_id, status);
CREATE INDEX IF NOT EXISTS idx_student_leaves_school_status ON student_leave_requests (school_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_date_perf ON attendance_sessions (school_id, attendance_date, class_number, section_name);
