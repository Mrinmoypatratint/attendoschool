-- Migration 042: Add document upload support to teacher assignments
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS document_name VARCHAR(255);
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS document_size INTEGER;
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS document_mime VARCHAR(100);
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS document_data TEXT;
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
