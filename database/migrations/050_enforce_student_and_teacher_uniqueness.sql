-- =========================================================================================
-- Migration 050: Enforce Student and Teacher Field Uniqueness (Revised & Corrected)
-- =========================================================================================
--
-- ARCHITECTURAL REVIEW & SCOPE SPECIFICATIONS:
--
-- 1. TEACHER UNIQUENESS SCOPE & RELATIONSHIP ANALYSIS:
--    - Table Relationships:
--      Each teacher has a login record in 'users' and an extension profile in 'teacher_profiles'.
--      'users' contains 'school_id' (tenant boundary) and 'email' (login username).
--      'teacher_profiles' contains 'employee_id', 'mobile', and 'phone', linked via 'user_id -> users.id'.
--    - Teacher Login Email:
--      MUST REMAIN GLOBALLY UNIQUE. 'users' is the unified authentication table across all tenants.
--      During authentication (/api/auth/login), users sign in with email. A global unique index on
--      LOWER(TRIM(email)) ensures credential integrity across schools.
--    - Teacher Employee ID & Mobile Number:
--      INTENDED SCOPE: Unique within the same school.
--      HISTORICAL INCONSISTENCY: In Migration 014, 'teacher_profiles' was created without a 'school_id'
--      column, which caused 'teacher_profiles_employee_id_key' to be created as a table-level GLOBAL
--      constraint.
--      CORRECTION: Migration 050 provides the safe path to establish a true school relationship on
--      'teacher_profiles' (by adding 'school_id UUID REFERENCES schools(id)' and backfilling from 'users'),
--      dropping the accidental global constraint, and creating school-scoped composite unique indexes.
--
-- 2. STUDENT PARENT PHONE NUMBERS (parent_sms_number) & SIBLING SHARING:
--    - Field Purpose: 'parent_sms_number' is a household guardian contact for SMS/notifications.
--    - Live Database State: Sibling pairs (e.g. Virag Mondal & Chirag Mandal in DAV Model School)
--      legitimately share the same parent phone number ('+91 7445285467', father: Ajay Mandal).
--    - DATABASE CONSTRAINT DECISION:
--      DO NOT create a strict unique index on students(parent_sms_number).
--      A database-level unique index on parent_sms_number would permanently prevent legitimate siblings
--      from enrolling in the same school and would immediately fail on existing database records.
--      Instead, student phone uniqueness is enforced at the application layer with a Sibling Exception
--      model (matching father/mother/parent name permits shared guardian contacts).
--
-- 3. STUDENT ROLL NUMBER SCOPE & HISTORICAL STUDENT LIFECYCLE:
--    - Scope: school_id + academic_year_id + class_id + section_id + LOWER(TRIM(roll_number)).
--    - Inactive / Historical Students: Partial index WHERE (is_active = true) ensures that students
--      who have transferred, graduated, or withdrawn do not block active students from reusing roll numbers.
--    - Academic Sessions: Roll numbers start fresh across different academic years and different sections.
--
-- 4. PHONE NORMALIZATION EQUIVALENCY:
--    - SQL Expression: RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10)
--    - TypeScript Expression: digits.replace(/\D/g, '').slice(-10) when length >= 10
--    - Equivalent across: +91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX, spaces, and hyphens.
--    - Blank, null, and incomplete numbers (< 10 digits) are filtered out and NEVER indexed as duplicates.
--
-- =========================================================================================
-- CRITICAL SAFETY RULES:
-- 1. DO NOT EXECUTE THIS MIGRATION BEFORE RESOLVING EXISTING DUPLICATES!
-- 2. DO NOT RUN THE AUTOMATED MIGRATION RUNNER UNTIL DATA CLEANUP IS COMPLETED BY THE ADMIN.
-- =========================================================================================


-- =========================================================================================
-- SECTION 1: PRE-FLIGHT DIAGNOSTICS FOR ADMINISTRATORS
-- =========================================================================================

-- Diagnostic 1: Student Email Duplicates (Known collision: 'rajbsmv@gmail.com' in school 5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3)
-- SELECT school_id, LOWER(TRIM(email)) AS email_norm, COUNT(*), array_agg(id) AS student_ids
-- FROM students
-- WHERE email IS NOT NULL AND TRIM(email) != ''
-- GROUP BY school_id, LOWER(TRIM(email))
-- HAVING COUNT(*) > 1;

-- Diagnostic 2: Teacher Mobile Placeholder Duplicates (Known collision: 46 profiles with '9876500000')
-- SELECT RIGHT(regexp_replace(mobile, '[^0-9]', '', 'g'), 10) AS mobile_norm, COUNT(*), array_agg(id) AS profile_ids
-- FROM teacher_profiles
-- WHERE mobile IS NOT NULL AND LENGTH(regexp_replace(mobile, '[^0-9]', '', 'g')) >= 10
-- GROUP BY RIGHT(regexp_replace(mobile, '[^0-9]', '', 'g'), 10)
-- HAVING COUNT(*) > 1;

-- Diagnostic 3: Verify Teacher Profiles School Backfill Readiness
-- SELECT tp.id, tp.employee_id, u.school_id
-- FROM teacher_profiles tp
-- JOIN users u ON tp.user_id = u.id
-- WHERE u.school_id IS NULL;


-- =========================================================================================
-- SECTION 2: STUDENT UNIQUENESS CONSTRAINTS & INDEXES
-- =========================================================================================

-- 2.1 Student Admission Number (Unique within School, case-insensitive, trimmed)
-- Existing index 'uq_student_admission_school' is exact-case. Supplement or replace with case-insensitive:
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_admission_lower
ON students (school_id, LOWER(TRIM(admission_number)))
WHERE (admission_number IS NOT NULL AND TRIM(admission_number) != '');

-- 2.2 Student Roll Number (Unique within School, Academic Year, Class, Section for ACTIVE students)
-- Excludes historical inactive students (is_active = false) so roll numbers can be safely reassigned.
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_scoped_roll_lower
ON students (school_id, academic_year_id, class_id, section_id, LOWER(TRIM(roll_number)))
WHERE (roll_number IS NOT NULL AND TRIM(roll_number) != '' AND is_active = true);

-- 2.3 Student Email (Unique within School, case-insensitive)
-- PREREQUISITE: School Admin must resolve duplicate 'rajbsmv@gmail.com' before creating this index.
-- Remediation:
-- UPDATE students SET email = NULL WHERE id IN ('13b5a15a-15ee-4d3d-b487-789509bfa009', '5d5c5c8c-e350-4a81-9080-f1964918aa95');
-- After remediation, apply:
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_email_lower
-- ON students (school_id, LOWER(TRIM(email)))
-- WHERE (email IS NOT NULL AND TRIM(email) != '');

-- 2.4 Student Phone (parent_sms_number)
-- ARCHITECTURAL DECISION: DO NOT CREATE UNIQUE INDEX ON parent_sms_number.
-- Sibling sharing of household guardian numbers is legitimate and common in schools.
-- Uniqueness is enforced at the application layer with a Sibling Exception Model.


-- =========================================================================================
-- SECTION 3: TEACHER UNIQUENESS CONSTRAINTS & INDEXES
-- =========================================================================================

-- 3.1 Teacher Login Email (Globally Unique across users table, case-insensitive)
-- 'users' is the global authentication table. Login emails must be globally unique.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_teacher_email_lower
ON users (LOWER(TRIM(email)))
WHERE (email IS NOT NULL AND TRIM(email) != '');

-- 3.2 Establish Reliable School Relationship on teacher_profiles
-- Add school_id to teacher_profiles so constraints can be strictly school-scoped:
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- Backfill school_id from parent users records:
UPDATE teacher_profiles tp
SET school_id = u.school_id
FROM users u
WHERE tp.user_id = u.id AND tp.school_id IS NULL AND u.school_id IS NOT NULL;

-- 3.3 Teacher Employee ID / Saviour ID (Unique within School, case-insensitive)
-- PREREQUISITE: Drop legacy global constraint and index before applying school-scoped index:
-- ALTER TABLE teacher_profiles DROP CONSTRAINT IF EXISTS teacher_profiles_employee_id_key;
-- DROP INDEX IF EXISTS uq_teacher_employee_school;
--
-- After dropping legacy global constraint, apply school-scoped unique index:
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_profiles_school_employee_lower
-- ON teacher_profiles (school_id, LOWER(TRIM(employee_id)))
-- WHERE (employee_id IS NOT NULL AND TRIM(employee_id) != '');

-- 3.4 Teacher Phone / Mobile (Unique within School, normalized 10 digits)
-- PREREQUISITE: Clean up legacy placeholder '9876500000' records before applying index.
-- Remediation:
-- UPDATE teacher_profiles SET mobile = NULL WHERE mobile = '9876500000' OR mobile LIKE '%9876500000%';
--
-- After remediation, apply school-scoped unique index:
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_profiles_school_mobile_norm
-- ON teacher_profiles (school_id, RIGHT(regexp_replace(mobile, '[^0-9]', '', 'g'), 10))
-- WHERE (mobile IS NOT NULL AND TRIM(mobile) != '' AND LENGTH(regexp_replace(mobile, '[^0-9]', '', 'g')) >= 10);
