-- Migration 043: Add date_of_birth and joining_date to teacher_profiles table
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS joining_date DATE;
