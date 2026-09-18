-- Subscription Plans (Required for SaaS platform operation)
INSERT INTO subscription_plans (name, max_students, price_monthly, price_yearly, is_active)
VALUES
  ('Basic', 300, 499, 4999, true),
  ('Standard', 1000, 999, 9999, true),
  ('Enterprise', NULL, 1999, 19999, true)
ON CONFLICT (name) DO NOTHING;

-- Company Super Admin Account (Only initial platform login)
-- Email: superadmin@attendance.local | Password: ChangeMe123!
INSERT INTO users (school_id, name, email, password_hash, role, is_active)
SELECT NULL, 'Company Super Admin', 'superadmin@attendance.local',
       '$2b$10$0v9R.2SaoJq8X8PEjW7bmeClu/E5xn/VaxeGOBLowTuGb58kMdTSa',
       'SUPER_ADMIN', true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE LOWER(email) = LOWER('superadmin@attendance.local')
);
