-- V23: Mobile/PWA + Offline Attendance Sync
CREATE TABLE IF NOT EXISTS attendance_sync_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_batch_id VARCHAR(120) NOT NULL,
  device_id VARCHAR(180),
  status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
  records_count INTEGER NOT NULL DEFAULT 0,
  synced_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_summary TEXT,
  UNIQUE(user_id,client_batch_id)
);

CREATE TABLE IF NOT EXISTS attendance_sync_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES attendance_sync_batches(id) ON DELETE CASCADE,
  client_record_id VARCHAR(120) NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  present BOOLEAN NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'OFFLINE',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id,client_record_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_batches_school_time ON attendance_sync_batches(school_id,received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_items_batch ON attendance_sync_items(batch_id);
