-- Migration 041: Student Assignment Attachments (Phase 1)
-- Stores metadata and opaque storage keys for student assignment submissions

CREATE TABLE IF NOT EXISTS student_assignment_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    assignment_id UUID NOT NULL REFERENCES student_assignments(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES student_assignment_submissions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_provider VARCHAR(30) NOT NULL DEFAULT 'SUPABASE',
    storage_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_submission ON student_assignment_attachments(submission_id);
CREATE INDEX IF NOT EXISTS idx_attachments_school_assignment ON student_assignment_attachments(school_id, assignment_id);
CREATE INDEX IF NOT EXISTS idx_attachments_student ON student_assignment_attachments(student_id);
