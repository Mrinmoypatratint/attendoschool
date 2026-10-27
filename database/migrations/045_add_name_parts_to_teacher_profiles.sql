-- Migration 045: Add first_name, middle_name, last_name to teacher_profiles and users
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
