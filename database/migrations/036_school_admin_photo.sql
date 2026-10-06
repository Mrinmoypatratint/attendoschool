-- Migration 036: Add photo_url to users and schools for School Admin profile photo upload
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS photo_url TEXT;
