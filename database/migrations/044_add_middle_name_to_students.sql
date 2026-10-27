-- Migration 044: Add middle_name to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
