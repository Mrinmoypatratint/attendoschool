-- Migration 035: Add gender to teacher_profiles table
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
