-- V18: School Admin & Granular Permissions
CREATE TABLE IF NOT EXISTS permission_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key VARCHAR(80) UNIQUE NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO permission_definitions(permission_key,description) VALUES
('STUDENTS_MANAGE','Create, edit and deactivate students'),
('TEACHERS_MANAGE','Create, edit and deactivate teachers'),
('ATTENDANCE_MANAGE','Take and correct attendance'),
('REPORTS_VIEW','View and export attendance reports'),
('NOTIFICATIONS_MANAGE','Manage parent notification channels/templates'),
('BILLING_MANAGE','View and manage school billing'),
('ACADEMIC_MANAGE','Manage academic years, classes and sections'),
('SETTINGS_MANAGE','Manage school settings')
ON CONFLICT(permission_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS school_admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id,name)
);

CREATE TABLE IF NOT EXISTS school_admin_role_permissions (
  role_id UUID NOT NULL REFERENCES school_admin_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permission_definitions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id,permission_id)
);

CREATE TABLE IF NOT EXISTS school_admin_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES school_admin_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,role_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_assignments_school ON school_admin_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_admin_assignments_user ON school_admin_assignments(user_id);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(80),
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_activity_school_time
 ON admin_activity_logs(school_id,created_at DESC);
