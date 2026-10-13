-- Migration 042: Add website column to schools table
-- Allows storing official school website URL for institutional branding and student/teacher navigation

ALTER TABLE schools ADD COLUMN IF NOT EXISTS website TEXT;
