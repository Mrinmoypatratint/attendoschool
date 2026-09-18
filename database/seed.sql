-- Subscription Plans (Required for SaaS platform operation)
INSERT INTO subscription_plans (name, max_students, price_monthly, price_yearly, is_active)
VALUES
  ('Basic', 300, 499, 4999, true),
  ('Standard', 1000, 999, 9999, true),
  ('Enterprise', 5000, 1999, 19999, true)
ON CONFLICT (name) DO UPDATE SET max_students = EXCLUDED.max_students;

-- Company Super Admin Account (Only initial platform login)
-- Email: superadmin@attendance.local | Password: ChangeMe123!
INSERT INTO users (id, school_id, name, email, password_hash, role, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  NULL,
  'Company Super Admin',
  'superadmin@attendance.local',
  '$2b$10$0v9R.2SaoJq8X8PEjW7bmeClu/E5xn/VaxeGOBLowTuGb58kMdTSa',
  'SUPER_ADMIN',
  true
)
ON CONFLICT (email) DO NOTHING;

-- Demo School 1: Greenwood International School
INSERT INTO schools (id, name, code, status, enquiry_number, address)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Greenwood International School',
  'GIS001',
  'ACTIVE',
  '1800123456',
  'Campus 4, Tech Park Boulevard, Bengaluru, Karnataka'
)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  status = EXCLUDED.status,
  enquiry_number = EXCLUDED.enquiry_number,
  address = EXCLUDED.address;

-- Active Subscription for Greenwood
INSERT INTO school_subscriptions (id, school_id, plan_id, start_date, end_date, status)
SELECT 
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  id,
  '2025-04-01',
  '2027-03-31',
  'ACTIVE'
FROM subscription_plans WHERE name = 'Enterprise'
ON CONFLICT (id) DO NOTHING;

-- Initial Payment Record for Greenwood
INSERT INTO payments (id, school_id, subscription_id, provider, provider_order_id, provider_payment_id, amount, currency, status, invoice_number, receipt_number, created_at, paid_at)
VALUES (
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  'RAZORPAY',
  'order_GWIS_2025_001',
  'pay_GWIS_2025_001',
  19999.00,
  'INR',
  'PAID',
  'INV-2025-001',
  'REC-2025-001',
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '30 days'
)
ON CONFLICT (id) DO NOTHING;

-- Initial Subscription Invoice for Greenwood
INSERT INTO subscription_invoices (id, payment_id, school_id, invoice_number, receipt_number, amount, currency, status, issued_at, paid_at)
VALUES (
  '00000000-0000-0000-0000-000000000802',
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000001',
  'INV-2025-001',
  'REC-2025-001',
  19999.00,
  'INR',
  'PAID',
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '30 days'
)
ON CONFLICT (invoice_number) DO NOTHING;

-- Academic Year for Greenwood
INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_active, is_archived)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000001',
  '2025–26',
  '2025-04-01',
  '2026-03-31',
  true,
  false
)
ON CONFLICT (id) DO NOTHING;

-- School Admin Account: admin@demo-school.local | Password: ChangeMe123!
INSERT INTO users (id, school_id, name, email, password_hash, role, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000001',
  'Greenwood Principal Admin',
  'admin@demo-school.local',
  '$2b$10$0v9R.2SaoJq8X8PEjW7bmeClu/E5xn/VaxeGOBLowTuGb58kMdTSa',
  'SCHOOL_ADMIN',
  true
)
ON CONFLICT (email) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  role = EXCLUDED.role,
  password_hash = EXCLUDED.password_hash;

-- Teachers for Greenwood
INSERT INTO users (id, school_id, name, email, password_hash, role, is_active)
VALUES 
  (
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000001',
    'Rahul Sharma',
    'rahul@demo-school.local',
    '$2b$10$0v9R.2SaoJq8X8PEjW7bmeClu/E5xn/VaxeGOBLowTuGb58kMdTSa',
    'TEACHER',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000023',
    '00000000-0000-0000-0000-000000000001',
    'Priya Patel',
    'priya@demo-school.local',
    '$2b$10$0v9R.2SaoJq8X8PEjW7bmeClu/E5xn/VaxeGOBLowTuGb58kMdTSa',
    'TEACHER',
    true
  )
ON CONFLICT (email) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  role = EXCLUDED.role,
  password_hash = EXCLUDED.password_hash;

INSERT INTO teacher_profiles (user_id, employee_id, mobile)
SELECT id, 'EMP001', '+91 90000 00001' FROM users WHERE email = 'rahul@demo-school.local'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO teacher_profiles (user_id, employee_id, mobile)
SELECT id, 'EMP002', '+91 90000 00002' FROM users WHERE email = 'priya@demo-school.local'
ON CONFLICT (user_id) DO NOTHING;

-- Classes for Greenwood
INSERT INTO classes (id, school_id, class_number)
VALUES 
  ('00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000001', 8),
  ('00000000-0000-0000-0000-000000000309', '00000000-0000-0000-0000-000000000001', 9),
  ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000001', 10)
ON CONFLICT (school_id, class_number) DO NOTHING;

-- Sections for Greenwood
INSERT INTO sections (id, school_id, class_id, name)
VALUES 
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000308', 'A'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000308', 'B'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000309', 'A'),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000309', 'B'),
  ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000310', 'A'),
  ('00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000310', 'B')
ON CONFLICT (class_id, name) DO NOTHING;

-- Subjects for Greenwood
INSERT INTO subjects (id, school_id, name)
VALUES 
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000001', 'Mathematics'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000001', 'Science'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000001', 'English'),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000001', 'Social Studies')
ON CONFLICT (school_id, name) DO NOTHING;

-- Sample Students for Greenwood
INSERT INTO students (id, school_id, class_id, section_id, roll_number, name, parent_name, parent_sms_number, parent_email, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000405', '101', 'Aarav Sharma', 'Rajesh Sharma', '9876543210', 'rajesh.sharma@example.com', true),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000405', '102', 'Diya Patel', 'Kirit Patel', '9876543211', 'kirit.patel@example.com', true),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000406', '103', 'Rohan Gupta', 'Manoj Gupta', '9876543212', 'manoj.gupta@example.com', true),
  ('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000401', '104', 'Ananya Sen', 'Subhash Sen', '9876543213', 'subhash.sen@example.com', true),
  ('00000000-0000-0000-0000-000000000605', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000402', '105', 'Dev Mukherjee', 'Amit Mukherjee', '9876543214', 'amit.m@example.com', true)
ON CONFLICT (class_id, section_id, roll_number) DO NOTHING;

-- Demo Student User Account for Greenwood: student@greenwood.local
INSERT INTO users (id, school_id, name, email, password_hash, role, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000025',
  '00000000-0000-0000-0000-000000000001',
  'Rohan Sharma',
  'student@greenwood.local',
  '$2b$10$0v9R.2SaoJq8X8PEjW7bmeClu/E5xn/VaxeGOBLowTuGb58kMdTSa',
  'STUDENT',
  true
)
ON CONFLICT (email) DO NOTHING;

-- Demo School 2 (For multi-tenant isolation testing): Delhi Public Academy
INSERT INTO schools (id, name, code, status, enquiry_number, address)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Delhi Public Academy',
  'DPA001',
  'ACTIVE',
  '1800654321',
  'Plot 12, Institutional Area, New Delhi'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, school_id, name, email, password_hash, role, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000002',
  'Delhi Academy Admin',
  'admin@delhi-academy.local',
  '$2b$10$0v9R.2SaoJq8X8PEjW7bmeClu/E5xn/VaxeGOBLowTuGb58kMdTSa',
  'SCHOOL_ADMIN',
  true
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO classes (id, school_id, class_number)
VALUES ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000002', 10)
ON CONFLICT (school_id, class_number) DO NOTHING;

INSERT INTO sections (id, school_id, class_id, name)
VALUES ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000311', 'A')
ON CONFLICT (class_id, name) DO NOTHING;

INSERT INTO students (id, school_id, class_id, section_id, roll_number, name, parent_name, parent_sms_number, parent_email, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000699', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000411', '901', 'Ayaan Kapoor (School B)', 'Suresh Kapoor', '9800000099', 'suresh.k@example.com', true)
ON CONFLICT (class_id, section_id, roll_number) DO NOTHING;
