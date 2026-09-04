
-- V08: school-facing billing support.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS initiated_by_user_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS payments_school_created_idx ON payments(school_id,created_at DESC);
