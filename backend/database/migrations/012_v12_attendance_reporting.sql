-- V12: Advanced Attendance & Reporting
-- Adds reporting-friendly indexes and a materialized monthly summary view.
-- Safe to run after V11.

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_date
  ON attendance_sessions (school_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_session_status
  ON attendance_records (attendance_session_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_records_student
  ON attendance_records (student_id);

CREATE INDEX IF NOT EXISTS idx_students_school_class_section
  ON students (school_id, class_id, section_id);

CREATE OR REPLACE VIEW attendance_monthly_summary_v12 AS
SELECT
  s.school_id,
  ar.student_id,
  date_trunc('month', s.attendance_date)::date AS month,
  COUNT(*) FILTER (WHERE ar.status = 'PRESENT') AS present_days,
  COUNT(*) FILTER (WHERE ar.status = 'ABSENT') AS absent_days,
  COUNT(*) AS marked_days,
  ROUND(
    CASE WHEN COUNT(*) = 0 THEN 0
    ELSE (COUNT(*) FILTER (WHERE ar.status = 'PRESENT')::numeric / COUNT(*)::numeric) * 100
    END, 2
  ) AS attendance_percentage
FROM attendance_sessions s
JOIN attendance_records ar ON ar.attendance_session_id = s.id
GROUP BY s.school_id, ar.student_id, date_trunc('month', s.attendance_date);
