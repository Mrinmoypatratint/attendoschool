-- V34: Announcement Audience Extension & Notification Replies Schema
-- File: database/migrations/034_notification_replies.sql

-- 1. Create notification_replies table for threaded responses from parents and students
CREATE TABLE IF NOT EXISTS notification_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  reply_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_replies_announcement 
  ON notification_replies(announcement_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_notification_replies_school
  ON notification_replies(school_id, created_at DESC);
