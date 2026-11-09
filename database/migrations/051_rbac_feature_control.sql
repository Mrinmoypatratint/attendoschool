-- Migration 051: RBAC feature control (super-admin features per plan/school/global,
-- school role permissions, per-person overrides, per-person login control, audit).
--
-- Additive and idempotent. IDs are TEXT (users/schools may be Firestore ids, SQL UUIDs or
-- tenant aliases) — intentionally NO foreign keys to users/schools. School ids are canonical
-- (backend/src/utils/tenant.ts canonicalSchoolId). Empty tables == legacy behaviour.
-- Global kill switches live in platform_settings key 'features.global' (migration 039).

CREATE TABLE IF NOT EXISTS plan_features (
  plan_key    TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_key, feature_key)
);

CREATE TABLE IF NOT EXISTS school_feature_overrides (
  school_id   TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  mode        TEXT NOT NULL CHECK (mode IN ('ON','OFF')),
  reason      TEXT,
  expires_at  TIMESTAMPTZ NULL,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_school_feature_overrides_school ON school_feature_overrides(school_id);

CREATE TABLE IF NOT EXISTS school_role_permissions (
  school_id      TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('SCHOOL_ADMIN','TEACHER','STUDENT','PARENT')),
  permission_key TEXT NOT NULL,
  allowed        BOOLEAN NOT NULL,
  updated_by     TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, role, permission_key)
);
CREATE INDEX IF NOT EXISTS idx_school_role_permissions_school ON school_role_permissions(school_id);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  school_id      TEXT NOT NULL,
  principal_role TEXT NOT NULL CHECK (principal_role IN ('SCHOOL_ADMIN','TEACHER','STUDENT','PARENT')),
  principal_id   TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  effect         TEXT NOT NULL CHECK (effect IN ('ALLOW','DENY')),
  reason         TEXT,
  updated_by     TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, principal_role, principal_id, permission_key)
);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_school ON user_permission_overrides(school_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_principal ON user_permission_overrides(school_id, principal_role, principal_id);

CREATE TABLE IF NOT EXISTS user_login_controls (
  school_id      TEXT NOT NULL,
  principal_role TEXT NOT NULL CHECK (principal_role IN ('SCHOOL_ADMIN','TEACHER','STUDENT','PARENT')),
  principal_id   TEXT NOT NULL,
  login_enabled  BOOLEAN NOT NULL,
  reason         TEXT,
  updated_by     TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_id, principal_role, principal_id)
);
CREATE INDEX IF NOT EXISTS idx_user_login_controls_school ON user_login_controls(school_id);

CREATE TABLE IF NOT EXISTS access_versions (
  school_id TEXT PRIMARY KEY,
  version   BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS access_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   TEXT NULL,
  actor_id    TEXT NOT NULL,
  actor_role  TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT,
  before      JSONB,
  after       JSONB,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_school_time ON access_audit_log(school_id, created_at DESC);

-- Seed: every existing plan x every toggleable feature = enabled (nothing changes).
-- plan_key = subscription_plans.id (what subscriptionEnforcementService.getSubscription returns as plan_id).
INSERT INTO plan_features (plan_key, feature_key, enabled, updated_by)
SELECT sp.id::text, f.feature_key, TRUE, 'migration-051'
FROM subscription_plans sp
CROSS JOIN (VALUES ('students'), ('teachers'), ('classes_subjects'), ('designations'), ('academic_calendar'), ('timetable'), ('attendance'), ('attendance_corrections'), ('attendance_reports'), ('offline_attendance'), ('mentors_and_temporary_assignments'), ('assignments'), ('announcements_communication'), ('notification_logs'), ('student_leave'), ('teacher_leave'), ('leave_policy'), ('photo_approvals'), ('promotions'), ('analytics'), ('parent_portal'), ('student_portal')) AS f(feature_key)
ON CONFLICT (plan_key, feature_key) DO NOTHING;

-- Keep the legacy /api/permissions endpoints working: register catalog keys (legacy keys untouched).
INSERT INTO permission_definitions (permission_key, description) VALUES
  ('access.manage', '[access_control] Manage roles & permissions'),
  ('access.login.manage', '[access_control] Enable / disable user logins'),
  ('billing.view', '[billing] View subscription & invoices'),
  ('billing.pay', '[billing] Pay / renew subscription'),
  ('dashboard.view', '[dashboard] View dashboard'),
  ('profile.self', '[profile] Manage own profile'),
  ('profile.school.manage', '[profile] Manage school profile'),
  ('students.view', '[students] View students'),
  ('students.create', '[students] Add / import students'),
  ('students.edit', '[students] Edit students'),
  ('students.delete', '[students] Delete students'),
  ('students.export', '[students] Export student list'),
  ('parents.manage', '[parent_portal] Onboard & link parents'),
  ('teachers.view', '[teachers] View teachers'),
  ('teachers.create', '[teachers] Add / import teachers'),
  ('teachers.edit', '[teachers] Edit teachers'),
  ('teachers.delete', '[teachers] Delete teachers'),
  ('designations.view', '[designations] View designations'),
  ('designations.manage', '[designations] Manage designations'),
  ('designations.promote', '[designations] Promote teacher designations'),
  ('classes.view', '[classes_subjects] View classes, sections & subjects'),
  ('classes.manage', '[classes_subjects] Manage classes, sections & subjects'),
  ('subjects.assign', '[classes_subjects] Allocate subjects to teachers'),
  ('academic_years.view', '[classes_subjects] View academic years'),
  ('academic_years.manage', '[classes_subjects] Manage academic years'),
  ('calendar.view', '[academic_calendar] View academic calendar'),
  ('calendar.manage', '[academic_calendar] Manage holidays & working days'),
  ('timetable.view', '[timetable] View timetable'),
  ('timetable.manage', '[timetable] Manage timetable'),
  ('timetable.publish', '[timetable] Publish timetable'),
  ('attendance.view', '[attendance] View attendance'),
  ('attendance.take', '[attendance] Take attendance'),
  ('attendance.edit', '[attendance] Edit attendance records'),
  ('attendance.edit_past', '[attendance] Re-take (re-attendance) past sessions'),
  ('attendance.audit.export', '[attendance] Export attendance audit trail'),
  ('attendance.offline.sync', '[offline_attendance] Offline attendance sync'),
  ('attendance.offline.import', '[offline_attendance] Import offline attendance'),
  ('attendance.reports.view', '[attendance_reports] View attendance reports'),
  ('attendance.reports.export', '[attendance_reports] Export attendance reports'),
  ('attendance.corrections.view', '[attendance_corrections] View correction requests'),
  ('attendance.corrections.request', '[attendance_corrections] Request attendance corrections'),
  ('attendance.corrections.review', '[attendance_corrections] Review attendance corrections'),
  ('mentors.manage', '[mentors_and_temporary_assignments] Assign class mentors'),
  ('mentors.workspace', '[mentors_and_temporary_assignments] Mentor workspace'),
  ('mentors.permissions.manage', '[mentors_and_temporary_assignments] Manage mentor publishing permissions'),
  ('temporary_assignments.manage', '[mentors_and_temporary_assignments] Manage temporary class assignments'),
  ('assignments.view', '[assignments] View assignments'),
  ('assignments.create', '[assignments] Create / edit assignments'),
  ('assignments.delete', '[assignments] Delete assignments'),
  ('assignments.grade', '[assignments] View submissions & grade'),
  ('student.assignments.view', '[assignments] View my assignments'),
  ('student.assignments.submit', '[assignments] Submit assignments'),
  ('announcements.view', '[announcements_communication] View announcements'),
  ('announcements.manage', '[announcements_communication] Create / edit announcements'),
  ('announcements.publish', '[announcements_communication] Publish announcements'),
  ('announcements.reply', '[announcements_communication] Reply to announcements'),
  ('announcements.replies.view', '[announcements_communication] View replies'),
  ('announcements.delivery.view', '[announcements_communication] View delivery summary'),
  ('notifications.logs.view', '[notification_logs] View notification logs'),
  ('notifications.settings.manage', '[notification_logs] Manage channels, templates & SMTP'),
  ('notifications.attendance_email.send', '[notification_logs] Send attendance e-mails'),
  ('leave.student.view', '[student_leave] View student leave requests'),
  ('leave.student.review', '[student_leave] Approve / reject student leave'),
  ('student.leave.apply', '[student_leave] Apply for student leave'),
  ('leave.teacher.apply', '[teacher_leave] Apply for teacher leave'),
  ('leave.teacher.view', '[teacher_leave] View / export teacher leave'),
  ('leave.teacher.review', '[teacher_leave] Approve / reject teacher leave'),
  ('leave.policy.view', '[leave_policy] View leave policy'),
  ('leave.policy.manage', '[leave_policy] Manage leave policy'),
  ('photos.request', '[photo_approvals] Request photo change'),
  ('photos.view', '[photo_approvals] View photo requests'),
  ('photos.review', '[photo_approvals] Approve / reject photos'),
  ('promotions.view', '[promotions] View promotion candidates'),
  ('promotions.manage', '[promotions] Execute promotions'),
  ('analytics.view', '[analytics] View analytics'),
  ('analytics.manage', '[analytics] Capture analytics snapshots'),
  ('parent.portal.view', '[parent_portal] Parent portal'),
  ('student.portal.view', '[student_portal] Student portal')
ON CONFLICT (permission_key) DO UPDATE SET description = EXCLUDED.description;
